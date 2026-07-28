import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { ProjectRole } from '@prisma/client';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface TaskDates {
  id: string;
  startDate: Date | null;
  endDate: Date | null;
}

interface Edge {
  blockingTaskId: string;
  blockedTaskId: string;
  lagDays: number;
}

export interface RescheduleResult {
  /** Tâches dont les dates ont changé, y compris celle déplacée. */
  updated: { id: string; startDate: string; endDate: string }[];
  /** Nombre de tâches repoussées par effet de cascade. */
  cascadedCount: number;
}

/**
 * Replanification du Gantt.
 *
 * Déplacer une barre ne se limite pas à écrire deux dates : les tâches
 * bloquées par celle qu'on bouge doivent suivre, sinon le planning affiché
 * contredit les dépendances qu'il dessine.
 *
 * Règle appliquée : une tâche bloquée ne peut pas démarrer avant la fin de
 * ses bloquants (plus le décalage éventuel). On ne repousse que ce qui viole
 * cette contrainte — une tâche déjà planifiée plus tard n'est pas ramenée en
 * arrière, car son placement peut répondre à une raison métier.
 */
@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /**
   * Déplace une tâche et propage aux tâches bloquées.
   *
   * Réservé aux gestionnaires du projet : replanifier engage l'ensemble de
   * l'équipe, pas seulement l'assigné de la tâche déplacée.
   */
  async rescheduleTask(
    taskId: string,
    userId: string,
    startDate: string,
    endDate: string,
  ): Promise<RescheduleResult> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });

    if (!task) {
      throw new BadRequestException('Tâche introuvable');
    }

    await this.projectAccess.requireProjectRole(
      task.projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Dates invalides');
    }
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException(
        'La date de fin ne peut pas précéder la date de début',
      );
    }

    // Graphe complet du projet, chargé en deux requêtes plutôt qu'en
    // parcourant les dépendances une par une.
    const [tasks, edges] = await Promise.all([
      this.prisma.task.findMany({
        where: { projectId: task.projectId },
        select: { id: true, startDate: true, endDate: true },
      }),
      this.prisma.taskDependency.findMany({
        where: { blockingTask: { projectId: task.projectId } },
        select: { blockingTaskId: true, blockedTaskId: true, lagDays: true },
      }),
    ]);

    const dates = new Map<string, TaskDates>(
      tasks.map((t) => [t.id, { ...t }]),
    );
    const moved = dates.get(taskId);
    if (!moved) {
      throw new BadRequestException('Tâche absente du projet');
    }

    moved.startDate = start;
    moved.endDate = end;

    const changed = this.propagate(taskId, dates, edges);
    changed.add(taskId);

    // Une seule transaction : un planning à moitié recalculé serait pire que
    // pas de recalcul du tout.
    await this.prisma.$transaction(
      [...changed].map((id) => {
        const d = dates.get(id)!;
        return this.prisma.task.update({
          where: { id },
          data: { startDate: d.startDate, endDate: d.endDate },
        });
      }),
    );

    this.logger.log(
      `Replanification de ${taskId} : ${changed.size - 1} tâche(s) repoussée(s)`,
    );

    return {
      updated: [...changed].map((id) => {
        const d = dates.get(id)!;
        return {
          id,
          startDate: d.startDate!.toISOString(),
          endDate: d.endDate!.toISOString(),
        };
      }),
      cascadedCount: changed.size - 1,
    };
  }

  /**
   * Propage le déplacement aux tâches bloquées, en largeur.
   *
   * Le graphe peut contenir un cycle malgré la vérification à la création des
   * dépendances (données héritées, création concurrente) : on borne donc le
   * nombre d'itérations au lieu de boucler indéfiniment.
   */
  private propagate(
    startTaskId: string,
    dates: Map<string, TaskDates>,
    edges: Edge[],
  ): Set<string> {
    // Index des successeurs : pour une tâche donnée, celles qu'elle bloque.
    const successors = new Map<string, Edge[]>();
    for (const edge of edges) {
      const list = successors.get(edge.blockingTaskId) ?? [];
      list.push(edge);
      successors.set(edge.blockingTaskId, list);
    }

    const changed = new Set<string>();
    const queue: string[] = [startTaskId];
    let guard = 0;
    const maxIterations = edges.length * 4 + dates.size + 10;

    while (queue.length > 0) {
      if (++guard > maxIterations) {
        this.logger.warn(
          'Propagation interrompue : cycle probable dans les dépendances',
        );
        break;
      }

      const currentId = queue.shift()!;
      const current = dates.get(currentId);
      if (!current?.endDate) continue;

      for (const edge of successors.get(currentId) ?? []) {
        const next = dates.get(edge.blockedTaskId);
        // Une tâche sans dates n'est pas encore planifiée : la propagation
        // n'a rien à décaler, on ne lui invente pas un calendrier.
        if (!next?.startDate || !next.endDate) continue;

        const earliestStart = new Date(
          current.endDate.getTime() + edge.lagDays * MS_PER_DAY,
        );

        // Uniquement si la contrainte est violée : on repousse, jamais on
        // n'avance une tâche placée volontairement plus tard.
        if (next.startDate.getTime() >= earliestStart.getTime()) continue;

        const duration = next.endDate.getTime() - next.startDate.getTime();
        next.startDate = earliestStart;
        next.endDate = new Date(earliestStart.getTime() + duration);

        changed.add(edge.blockedTaskId);
        queue.push(edge.blockedTaskId);
      }
    }

    return changed;
  }

  /**
   * Fige les dates courantes comme référence (baseline).
   *
   * Sert de point de comparaison : une fois le planning validé, la dérive se
   * mesure entre les dates courantes et cette photographie.
   */
  async setBaseline(projectId: string, userId: string) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        startDate: { not: null },
        endDate: { not: null },
      },
      select: { id: true, startDate: true, endDate: true },
    });

    await this.prisma.$transaction(
      tasks.map((t) =>
        this.prisma.task.update({
          where: { id: t.id },
          data: { baselineStart: t.startDate, baselineEnd: t.endDate },
        }),
      ),
    );

    return { message: 'Référence enregistrée', taskCount: tasks.length };
  }
}

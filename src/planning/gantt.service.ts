import { Injectable, Logger } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

/** Type pour les tâches Gantt (startDate/endDate présents en BDD, pas toujours dans le type Prisma généré). */
type GanttTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  startDate: Date | null;
  endDate: Date | null;
  deadline: Date | null;
  baselineStart: Date | null;
  baselineEnd: Date | null;
  assignments: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
    };
  }[];
  blockedBy: { blockingTaskId: string; lagDays: number }[];
};

/** Écart en jours entre deux dates, arrondi au jour entier. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Données pour la vue Gantt : tâches avec dates début/fin et dépendances.
 *
 * Le déplacement d'une barre passe par `PATCH /planning/tasks/:id/schedule`,
 * qui répercute le décalage sur les tâches bloquées — et non plus par un
 * simple `PATCH /tasks/:id` qui laissait le planning incohérent.
 */
@Injectable()
export class GanttService {
  private readonly logger = new Logger(GanttService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private async ensureProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    // Lecture seule : tout membre du projet, y compris VIEWER.
    await this.projectAccess.requireMember(projectId, userId);
  }

  /**
   * Retourne les tâches du projet formatées pour un diagramme de Gantt :
   * id, title, startDate, endDate, duration (jours), dépendances, assignés.
   */
  async getGanttData(projectId: string, userId: string) {
    this.logger.debug(`[Gantt] Récupération données pour projet ${projectId}`);
    await this.ensureProjectAccess(projectId, userId);

    const tasks = (await this.prisma.task.findMany({
      where: { projectId, parentId: null },
      include: {
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        blockedBy: { select: { blockingTaskId: true, lagDays: true } },
      },
      orderBy: { createdAt: 'asc' },
    })) as unknown as GanttTaskRow[];

    // Jalons du projet : points datés affichés sur la même frise.
    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
      select: {
        id: true,
        name: true,
        date: true,
        reached: true,
      },
    });

    this.logger.log(
      `✅ [Gantt] ${tasks.length} tâches trouvées pour le projet`,
    );

    const ganttTasks = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      startDate: t.startDate?.toISOString() ?? null,
      endDate: t.endDate?.toISOString() ?? null,
      deadline: t.deadline?.toISOString() ?? null,
      durationDays:
        t.startDate && t.endDate
          ? Math.ceil(
              (t.endDate.getTime() - t.startDate.getTime()) /
                (24 * 60 * 60 * 1000),
            )
          : null,
      baselineStart: t.baselineStart?.toISOString() ?? null,
      baselineEnd: t.baselineEnd?.toISOString() ?? null,
      // Dérive par rapport à la référence : positif = en retard sur le plan
      // initial. Null tant qu'aucune baseline n'a été figée.
      driftDays:
        t.baselineEnd && t.endDate
          ? daysBetween(t.endDate, t.baselineEnd)
          : null,
      dependencies: t.blockedBy.map((d) => ({
        taskId: d.blockingTaskId,
        lagDays: d.lagDays,
      })),
      assignees: t.assignments.map((a) => a.user),
    }));

    return {
      tasks: ganttTasks,
      milestones: milestones.map((m) => ({
        id: m.id,
        name: m.name,
        date: m.date.toISOString(),
        reached: m.reached,
        // Jalon dépassé sans avoir été atteint : le signaler vaut mieux que
        // le laisser se confondre avec les autres.
        overdue: !m.reached && m.date.getTime() < Date.now(),
      })),
      hasBaseline: ganttTasks.some((t) => t.baselineEnd !== null),
    };
  }
}

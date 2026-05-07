import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

/** Type pour les tâches Gantt (startDate/endDate présents en BDD, pas toujours dans le type Prisma généré). */
type GanttTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  priority: string;
  startDate: Date | null;
  endDate: Date | null;
  deadline: Date | null;
  assignments: {
    user: {
      id: string;
      firstName: string;
      lastName: string;
      avatar: string | null;
    };
  }[];
  blockedBy: { blockingTaskId: string }[];
};

/**
 * Données pour la vue Gantt : tâches avec dates début/fin et dépendances.
 * Le front affiche des barres horizontales ; le drag & drop met à jour via PATCH /tache/:id (startDate, endDate).
 */
@Injectable()
export class GanttService {
  private readonly logger = new Logger(GanttService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async ensureProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException('Projet introuvable');
    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember)
      throw new ForbiddenException("Vous n'avez pas accès à ce projet");
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
        blockedBy: { select: { blockingTaskId: true } },
      },
      orderBy: { createdAt: 'asc' },
    })) as unknown as GanttTaskRow[];

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
      dependencies: t.blockedBy.map((d) => d.blockingTaskId),
      assignees: t.assignments.map((a) => a.user),
    }));

    this.logger.debug(
      `[Gantt] Données formatées:`,
      JSON.stringify(ganttTasks.slice(0, 1), null, 2),
    );

    return ganttTasks;
  }
}

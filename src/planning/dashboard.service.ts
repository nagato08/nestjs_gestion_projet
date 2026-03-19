import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TaskStatus } from '@prisma/client';

/**
 * Tableaux de bord : Donut des statuts (TODO / DOING / DONE) et Matrice d'Eisenhower (Urgent vs Important).
 */
@Injectable()
export class DashboardService {
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
   * Donut Chart : répartition des tâches par statut (À faire, En cours, Terminé).
   */
  async getStatusDonut(projectId: string, userId: string) {
    await this.ensureProjectAccess(projectId, userId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, parentId: null },
      select: { status: true },
    });

    const todo = tasks.filter((t) => t.status === TaskStatus.TODO).length;
    const doing = tasks.filter((t) => t.status === TaskStatus.DOING).length;
    const done = tasks.filter((t) => t.status === TaskStatus.DONE).length;

    return {
      labels: ['À faire', 'En cours', 'Terminé'],
      values: [todo, doing, done],
      total: tasks.length,
    };
  }

  /**
   * Matrice d'Eisenhower : 4 quadrants (Urgent+Important, Urgent+Pas important, Pas urgent+Important, Pas urgent+Pas important).
   * Urgent = deadline dans les 7 prochains jours ou dépassée.
   * Important = priorité HIGH (ou MEDIUM si on veut).
   */
  async getEisenhowerMatrix(projectId: string, userId: string) {
    await this.ensureProjectAccess(projectId, userId);

    const tasks = await this.prisma.task.findMany({
      where: { projectId, parentId: null },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        deadline: true,
      },
    });

    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const urgentImportant: typeof tasks = [];
    const urgentNotImportant: typeof tasks = [];
    const notUrgentImportant: typeof tasks = [];
    const notUrgentNotImportant: typeof tasks = [];

    for (const t of tasks) {
      const urgent = t.deadline != null && t.deadline <= in7Days;
      const important = t.priority === 'HIGH';

      if (urgent && important) urgentImportant.push(t);
      else if (urgent && !important) urgentNotImportant.push(t);
      else if (!urgent && important) notUrgentImportant.push(t);
      else notUrgentNotImportant.push(t);
    }

    return {
      urgentImportant: urgentImportant.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        deadline: t.deadline?.toISOString() ?? null,
      })),
      urgentNotImportant: urgentNotImportant.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        deadline: t.deadline?.toISOString() ?? null,
      })),
      notUrgentImportant: notUrgentImportant.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        deadline: t.deadline?.toISOString() ?? null,
      })),
      notUrgentNotImportant: notUrgentNotImportant.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        deadline: t.deadline?.toISOString() ?? null,
      })),
    };
  }
}

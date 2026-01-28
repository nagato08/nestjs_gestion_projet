/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateManualTimeEntryDto } from './dto/create-manual-time-entry.dto';

@Injectable()
export class TimeEntryService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UTILITAIRE : Vérifie qu'une tâche existe et que l'utilisateur a accès
   */
  private async verifyTaskAccess(
    taskId: string,
    userId: string,
  ): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          include: { members: true },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    const isMember = task.project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException("Vous n'avez pas accès à cette tâche");
    }
  }

  /**
   * UTILITAIRE : Vérifie si l'utilisateur a un timer actif
   */
  private async getActiveTimer(userId: string) {
    return this.prisma.timeEntry.findFirst({
      where: {
        userId,
        endTime: null,
        isManual: false,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  // 1️⃣ Démarrer un timer pour une tâche
  async startTimer(userId: string, dto: StartTimerDto) {
    await this.verifyTaskAccess(dto.taskId, userId);

    // Vérifier qu'il n'y a pas déjà un timer actif
    const activeTimer = await this.getActiveTimer(userId);
    if (activeTimer) {
      throw new ConflictException(
        `Vous avez déjà un timer actif pour la tâche "${activeTimer.task.title}". Arrêtez-le d'abord.`,
      );
    }

    const timeEntry = await this.prisma.timeEntry.create({
      data: {
        taskId: dto.taskId,
        userId,
        startTime: new Date(),
        isManual: false,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return timeEntry;
  }

  // 2️⃣ Arrêter le timer actif
  async stopTimer(userId: string) {
    const activeTimer = await this.getActiveTimer(userId);

    if (!activeTimer) {
      throw new NotFoundException('Aucun timer actif trouvé');
    }

    const endTime = new Date();
    const duration = Math.floor(
      (endTime.getTime() - activeTimer.startTime.getTime()) / 1000 / 60,
    ); // Durée en minutes

    const updated = await this.prisma.timeEntry.update({
      where: { id: activeTimer.id },
      data: {
        endTime,
        duration,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  // 3️⃣ Récupérer le timer actif
  async getActiveTimerForUser(userId: string) {
    const timer = await this.getActiveTimer(userId);
    return timer;
  }

  // 4️⃣ Créer une entrée de temps manuelle
  async createManualTimeEntry(userId: string, dto: CreateManualTimeEntryDto) {
    await this.verifyTaskAccess(dto.taskId, userId);

    const startTime = new Date(dto.startTime);
    let endTime: Date | null = null;
    let duration: number | null = null;

    if (dto.endTime) {
      endTime = new Date(dto.endTime);
      duration = Math.floor(
        (endTime.getTime() - startTime.getTime()) / 1000 / 60,
      );
    } else if (dto.duration) {
      duration = dto.duration;
      endTime = new Date(startTime.getTime() + duration * 60 * 1000);
    } else {
      throw new ConflictException(
        'Vous devez fournir soit endTime soit duration',
      );
    }

    if (duration <= 0) {
      throw new ConflictException('La durée doit être positive');
    }

    const timeEntry = await this.prisma.timeEntry.create({
      data: {
        taskId: dto.taskId,
        userId,
        startTime,
        endTime,
        duration,
        isManual: true,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return timeEntry;
  }

  // 5️⃣ Récupérer l'historique des entrées de temps d'un utilisateur
  async getMyTimeEntries(userId: string, taskId?: string, projectId?: string) {
    const where: any = {
      userId,
    };

    if (taskId) {
      where.taskId = taskId;
    }

    if (projectId) {
      where.task = {
        projectId,
      };
    }

    const timeEntries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    return timeEntries;
  }

  // 6️⃣ Récupérer les statistiques de temps pour un utilisateur
  async getMyTimeStats(userId: string, projectId?: string) {
    const where: any = {
      userId,
      endTime: { not: null }, // Seulement les entrées terminées
    };

    if (projectId) {
      where.task = {
        projectId,
      };
    }

    const timeEntries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
            project: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const totalMinutes = timeEntries.reduce(
      (sum, entry) => sum + (entry.duration || 0),
      0,
    );
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;

    // Statistiques par projet
    const statsByProject = timeEntries.reduce(
      (acc, entry) => {
        const projectId = entry.task.project.id;
        const projectName = entry.task.project.name;

        if (!acc[projectId]) {
          acc[projectId] = {
            projectId,
            projectName,
            totalMinutes: 0,
            entries: 0,
          };
        }

        acc[projectId].totalMinutes += entry.duration || 0;
        acc[projectId].entries += 1;

        return acc;
      },
      {} as Record<
        string,
        {
          projectId: string;
          projectName: string;
          totalMinutes: number;
          entries: number;
        }
      >,
    );

    // Statistiques par tâche
    const statsByTask = timeEntries.reduce(
      (acc, entry) => {
        const taskId = entry.task.id;
        const taskTitle = entry.task.title;

        if (!acc[taskId]) {
          acc[taskId] = {
            taskId,
            taskTitle,
            totalMinutes: 0,
            entries: 0,
          };
        }

        acc[taskId].totalMinutes += entry.duration || 0;
        acc[taskId].entries += 1;

        return acc;
      },
      {} as Record<
        string,
        {
          taskId: string;
          taskTitle: string;
          totalMinutes: number;
          entries: number;
        }
      >,
    );

    return {
      total: {
        hours: totalHours,
        minutes: remainingMinutes,
        totalMinutes,
      },
      byProject: Object.values(statsByProject).map((stat) => ({
        ...stat,
        hours: Math.floor(stat.totalMinutes / 60),
        minutes: stat.totalMinutes % 60,
      })),
      byTask: Object.values(statsByTask).map((stat) => ({
        ...stat,
        hours: Math.floor(stat.totalMinutes / 60),
        minutes: stat.totalMinutes % 60,
      })),
      totalEntries: timeEntries.length,
    };
  }

  // 7️⃣ Récupérer les statistiques de temps pour un projet
  async getProjectTimeStats(projectId: string, userId: string) {
    // Vérifier l'accès au projet
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }

    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException("Vous n'avez pas accès à ce projet");
    }

    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        task: {
          projectId,
        },
        endTime: { not: null },
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    const totalMinutes = timeEntries.reduce(
      (sum, entry) => sum + (entry.duration || 0),
      0,
    );

    // Statistiques par utilisateur
    const statsByUser = timeEntries.reduce(
      (acc, entry) => {
        const userId = entry.userId;
        const userName = `${entry.user.firstName} ${entry.user.lastName}`;

        if (!acc[userId]) {
          acc[userId] = {
            userId,
            userName,
            avatar: entry.user.avatar,
            totalMinutes: 0,
            entries: 0,
          };
        }

        acc[userId].totalMinutes += entry.duration || 0;
        acc[userId].entries += 1;

        return acc;
      },
      {} as Record<
        string,
        {
          userId: string;
          userName: string;
          avatar: string | null;
          totalMinutes: number;
          entries: number;
        }
      >,
    );

    // Statistiques par tâche
    const statsByTask = timeEntries.reduce(
      (acc, entry) => {
        const taskId = entry.task.id;
        const taskTitle = entry.task.title;

        if (!acc[taskId]) {
          acc[taskId] = {
            taskId,
            taskTitle,
            totalMinutes: 0,
            entries: 0,
          };
        }

        acc[taskId].totalMinutes += entry.duration || 0;
        acc[taskId].entries += 1;

        return acc;
      },
      {} as Record<
        string,
        {
          taskId: string;
          taskTitle: string;
          totalMinutes: number;
          entries: number;
        }
      >,
    );

    return {
      project: {
        id: project.id,
        name: project.name,
      },
      total: {
        hours: Math.floor(totalMinutes / 60),
        minutes: totalMinutes % 60,
        totalMinutes,
      },
      byUser: Object.values(statsByUser).map((stat) => ({
        ...stat,
        hours: Math.floor(stat.totalMinutes / 60),
        minutes: stat.totalMinutes % 60,
      })),
      byTask: Object.values(statsByTask).map((stat) => ({
        ...stat,
        hours: Math.floor(stat.totalMinutes / 60),
        minutes: stat.totalMinutes % 60,
      })),
      totalEntries: timeEntries.length,
    };
  }

  // 8️⃣ Supprimer une entrée de temps
  async deleteTimeEntry(timeEntryId: string, userId: string) {
    const timeEntry = await this.prisma.timeEntry.findUnique({
      where: { id: timeEntryId },
    });

    if (!timeEntry) {
      throw new NotFoundException('Entrée de temps introuvable');
    }

    if (timeEntry.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres entrées de temps',
      );
    }

    await this.prisma.timeEntry.delete({
      where: { id: timeEntryId },
    });

    return {
      message: 'Entrée de temps supprimée avec succès',
    };
  }
}

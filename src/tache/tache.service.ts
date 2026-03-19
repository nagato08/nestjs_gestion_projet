/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { TaskStatus } from '@prisma/client';

@Injectable()
export class TacheService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UTILITAIRE : Vérifie que l'utilisateur est membre du projet
   */
  private async verifyProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
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
  }

  /**
   * UTILITAIRE : Vérifie qu'une tâche existe et que l'utilisateur a accès au projet
   */
  private async verifyTaskAccess(
    taskId: string,
    userId: string,
  ): Promise<{ id: string; projectId: string }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { include: { members: true } } },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    const isMember = task.project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException("Vous n'avez pas accès à cette tâche");
    }

    return { id: task.id, projectId: task.projectId };
  }

  // 1️⃣ Créer une tâche
  async createTask(userId: string, dto: CreateTaskDto) {
    // Vérifier l'accès au projet
    await this.verifyProjectAccess(dto.projectId, userId);

    // Si parentId est fourni, vérifier que la tâche parent existe et appartient au même projet
    if (dto.parentId) {
      const parentTask = await this.prisma.task.findUnique({
        where: { id: dto.parentId },
      });

      if (!parentTask) {
        throw new NotFoundException('Tâche parent introuvable');
      }

      if (parentTask.projectId !== dto.projectId) {
        throw new ConflictException(
          'La tâche parent doit appartenir au même projet',
        );
      }
    }

    // Si des utilisateurs sont assignés, vérifier qu'ils sont membres du projet
    if (dto.assignedUserIds && dto.assignedUserIds.length > 0) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        include: { members: true },
      });

      if (!project) {
        throw new NotFoundException('Projet introuvable');
      }

      // Vérifier que tous les utilisateurs assignés sont membres du projet
      const assignedUserIds = [...new Set(dto.assignedUserIds)]; // Supprimer les doublons
      const projectMemberIds = project.members.map((m) => m.userId);

      const invalidUserIds = assignedUserIds.filter(
        (id) => !projectMemberIds.includes(id),
      );

      if (invalidUserIds.length > 0) {
        throw new ForbiddenException(
          `Les utilisateurs suivants ne sont pas membres du projet : ${invalidUserIds.join(', ')}`,
        );
      }

      // Vérifier que tous les utilisateurs existent et ne sont pas supprimés
      const users = await this.prisma.user.findMany({
        where: {
          id: { in: assignedUserIds },
          deletedAt: null,
        },
      });

      if (users.length !== assignedUserIds.length) {
        throw new NotFoundException(
          'Un ou plusieurs utilisateurs assignés introuvables',
        );
      }
    }

    const createData = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      deadline: dto.deadline ? new Date(dto.deadline) : null,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      optimisticDays: dto.optimisticDays ?? null,
      probableDays: dto.probableDays ?? null,
      pessimisticDays: dto.pessimisticDays ?? null,
      storyPoints: dto.storyPoints ?? null,
      projectId: dto.projectId,
      parentId: dto.parentId,
      status: TaskStatus.TODO,
      assignments:
        dto.assignedUserIds && dto.assignedUserIds.length > 0
          ? {
              create: dto.assignedUserIds.map((userId) => ({ userId })),
            }
          : undefined,
    };

    const task = await this.prisma.task.create({
      data: createData as any,
      include: {
        project: {
          select: { id: true, name: true },
        },
        parent: {
          select: { id: true, title: true },
        },
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
        _count: {
          select: {
            subTasks: true,
            comments: true,
            dependencies: true,
            blockedBy: true,
          },
        },
      },
    });

    return task;
  }

  // 2️⃣ Récupérer toutes les tâches d'un projet (pour Kanban)
  async getTasksByProject(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId);

    const tasks = await this.prisma.task.findMany({
      where: {
        projectId,
        parentId: null, // Seulement les tâches principales (pas les sous-tâches)
      },
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
        subTasks: {
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
          },
        },
        dependencies: {
          include: {
            blockingTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        blockedBy: {
          include: {
            blockedTask: {
              select: {
                id: true,
                title: true,
                status: true,
              },
            },
          },
        },
        _count: {
          select: {
            comments: true,
            timeEntries: true,
          },
        },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });

    return tasks;
  }

  // 3️⃣ Récupérer une tâche par ID
  async getTaskById(taskId: string, userId: string) {
    await this.verifyTaskAccess(taskId, userId);

    const fullTask = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            owner: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        parent: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        subTasks: {
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
          },
          orderBy: { createdAt: 'asc' },
        },
        assignments: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
                jobTitle: true,
              },
            },
          },
        },
        dependencies: {
          include: {
            blockingTask: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
              },
            },
          },
        },
        blockedBy: {
          include: {
            blockedTask: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
              },
            },
          },
        },
        comments: {
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
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            timeEntries: true,
          },
        },
      },
    });

    return fullTask;
  }

  // 4️⃣ Mettre à jour une tâche
  async updateTask(taskId: string, userId: string, dto: UpdateTaskDto) {
    await this.verifyTaskAccess(taskId, userId);

    const updateData: any = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.deadline !== undefined) {
      updateData.deadline = dto.deadline ? new Date(dto.deadline) : null;
    }
    if (dto.startDate !== undefined) {
      updateData.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.endDate !== undefined) {
      updateData.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }
    if (dto.optimisticDays !== undefined) {
      updateData.optimisticDays = dto.optimisticDays;
    }
    if (dto.probableDays !== undefined) {
      updateData.probableDays = dto.probableDays;
    }
    if (dto.pessimisticDays !== undefined) {
      updateData.pessimisticDays = dto.pessimisticDays;
    }
    if (dto.storyPoints !== undefined) {
      updateData.storyPoints = dto.storyPoints;
    }

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: updateData,
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
        _count: {
          select: {
            subTasks: true,
            comments: true,
          },
        },
      },
    });

    return updatedTask;
  }

  // 5️⃣ Supprimer une tâche
  async deleteTask(taskId: string, userId: string) {
    await this.verifyTaskAccess(taskId, userId);

    // Vérifier qu'il n'y a pas de sous-tâches
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        subTasks: true,
        dependencies: true,
        blockedBy: true,
      },
    });

    if (task && task.subTasks.length > 0) {
      throw new ConflictException(
        'Impossible de supprimer une tâche qui contient des sous-tâches',
      );
    }

    await this.prisma.task.delete({
      where: { id: taskId },
    });

    return {
      message: 'Tâche supprimée avec succès',
    };
  }

  // 6️⃣ Assigner des utilisateurs à une tâche
  async assignUsersToTask(taskId: string, userId: string, dto: AssignTaskDto) {
    await this.verifyTaskAccess(taskId, userId);

    // Récupérer la tâche pour obtenir le projectId
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });

    if (!task) {
      throw new NotFoundException('Tâche introuvable');
    }

    // Vérifier que tous les utilisateurs existent et sont membres du projet
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: dto.userIds },
        deletedAt: null,
      },
    });

    if (users.length !== dto.userIds.length) {
      throw new NotFoundException('Un ou plusieurs utilisateurs introuvables');
    }

    // Vérifier que tous les utilisateurs sont membres du projet
    const projectMembers = await this.prisma.projectMember.findMany({
      where: {
        projectId: task.projectId,
        userId: { in: dto.userIds },
      },
    });

    if (projectMembers.length !== dto.userIds.length) {
      throw new ForbiddenException(
        'Tous les utilisateurs doivent être membres du projet',
      );
    }

    // Supprimer les assignations existantes
    await this.prisma.taskAssignment.deleteMany({
      where: { taskId },
    });

    // Créer les nouvelles assignations
    const assignments = await Promise.all(
      dto.userIds.map((userId) =>
        this.prisma.taskAssignment.create({
          data: {
            taskId,
            userId,
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                email: true,
              },
            },
          },
        }),
      ),
    );

    return assignments;
  }

  // 7️⃣ Retirer un utilisateur d'une tâche
  async unassignUserFromTask(
    taskId: string,
    userId: string,
    targetUserId: string,
  ) {
    await this.verifyTaskAccess(taskId, userId);

    const assignment = await this.prisma.taskAssignment.findUnique({
      where: {
        taskId_userId: {
          taskId,
          userId: targetUserId,
        },
      },
    });

    if (!assignment) {
      throw new NotFoundException(
        "Cet utilisateur n'est pas assigné à cette tâche",
      );
    }

    await this.prisma.taskAssignment.delete({
      where: {
        taskId_userId: {
          taskId,
          userId: targetUserId,
        },
      },
    });

    return {
      message: 'Utilisateur retiré de la tâche avec succès',
    };
  }

  // 8️⃣ Créer une dépendance entre tâches
  async createTaskDependency(
    taskId: string,
    userId: string,
    dto: CreateTaskDependencyDto,
  ) {
    await this.verifyTaskAccess(taskId, userId);
    await this.verifyTaskAccess(dto.blockedTaskId, userId);

    // Récupérer les deux tâches pour vérifier qu'elles appartiennent au même projet
    const [blockingTask, blockedTask] = await Promise.all([
      this.prisma.task.findUnique({
        where: { id: taskId },
        select: { projectId: true },
      }),
      this.prisma.task.findUnique({
        where: { id: dto.blockedTaskId },
        select: { projectId: true },
      }),
    ]);

    if (!blockingTask || !blockedTask) {
      throw new NotFoundException('Une ou plusieurs tâches introuvables');
    }

    // Vérifier que les deux tâches appartiennent au même projet
    if (blockingTask.projectId !== blockedTask.projectId) {
      throw new ConflictException(
        'Les tâches doivent appartenir au même projet',
      );
    }

    // Vérifier qu'on ne crée pas une dépendance circulaire
    if (taskId === dto.blockedTaskId) {
      throw new ConflictException("Une tâche ne peut pas dépendre d'elle-même");
    }

    // Vérifier si la dépendance existe déjà
    const existingDependency = await this.prisma.taskDependency.findFirst({
      where: {
        blockingTaskId: taskId,
        blockedTaskId: dto.blockedTaskId,
      },
    });

    if (existingDependency) {
      throw new ConflictException('Cette dépendance existe déjà');
    }

    // Vérifier les dépendances circulaires (simplifié)
    const wouldCreateCycle = await this.checkCircularDependency(
      taskId,
      dto.blockedTaskId,
    );
    if (wouldCreateCycle) {
      throw new ConflictException(
        'Cette dépendance créerait une boucle circulaire',
      );
    }

    const dependency = await this.prisma.taskDependency.create({
      data: {
        blockingTaskId: taskId,
        blockedTaskId: dto.blockedTaskId,
      },
      include: {
        blockingTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
        blockedTask: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return dependency;
  }

  // 9️⃣ Supprimer une dépendance
  async deleteTaskDependency(
    taskId: string,
    blockedTaskId: string,
    userId: string,
  ) {
    await this.verifyTaskAccess(taskId, userId);

    const dependency = await this.prisma.taskDependency.findFirst({
      where: {
        blockingTaskId: taskId,
        blockedTaskId,
      },
    });

    if (!dependency) {
      throw new NotFoundException('Dépendance introuvable');
    }

    await this.prisma.taskDependency.delete({
      where: { id: dependency.id },
    });

    return {
      message: 'Dépendance supprimée avec succès',
    };
  }

  // 🔟 Créer un commentaire sur une tâche
  async createComment(taskId: string, userId: string, dto: CreateCommentDto) {
    await this.verifyTaskAccess(taskId, userId);

    const comment = await this.prisma.comment.create({
      data: {
        content: dto.content,
        taskId,
        userId,
        mentions: dto.mentions || [],
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            email: true,
          },
        },
      },
    });

    return comment;
  }

  // 1️⃣1️⃣ Supprimer un commentaire
  async deleteComment(commentId: string, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      throw new NotFoundException('Commentaire introuvable');
    }

    // Vérifier l'accès à la tâche
    await this.verifyTaskAccess(comment.taskId, userId);

    // Seul l'auteur peut supprimer son commentaire
    if (comment.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres commentaires',
      );
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });

    return {
      message: 'Commentaire supprimé avec succès',
    };
  }

  // 1️⃣2️⃣ Changer le statut d'une tâche (pour Kanban)
  async changeTaskStatus(
    taskId: string,
    userId: string,
    dto: ChangeTaskStatusDto,
  ) {
    await this.verifyTaskAccess(taskId, userId);

    const updatedTask = await this.prisma.task.update({
      where: { id: taskId },
      data: { status: dto.status },
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
        _count: {
          select: {
            subTasks: true,
            comments: true,
          },
        },
      },
    });

    return updatedTask;
  }

  // 1️⃣3️⃣ Récupérer les tâches assignées à un utilisateur
  async getMyTasks(userId: string) {
    const tasks = await this.prisma.task.findMany({
      where: {
        assignments: {
          some: {
            userId,
          },
        },
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
          },
        },
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
        _count: {
          select: {
            subTasks: true,
            comments: true,
          },
        },
      },
      orderBy: [{ deadline: 'asc' }, { priority: 'desc' }],
    });

    return tasks;
  }

  // UTILITAIRE : Vérifier les dépendances circulaires (simplifié)
  private async checkCircularDependency(
    blockingTaskId: string,
    blockedTaskId: string,
  ): Promise<boolean> {
    // Si blockedTask bloque blockingTask (directement ou indirectement), on a un cycle
    const visited = new Set<string>();
    const queue = [blockedTaskId];

    while (queue.length > 0) {
      const currentTaskId = queue.shift()!;

      if (currentTaskId === blockingTaskId) {
        return true; // Cycle détecté
      }

      if (visited.has(currentTaskId)) {
        continue;
      }

      visited.add(currentTaskId);

      const dependencies = await this.prisma.taskDependency.findMany({
        where: {
          blockingTaskId: currentTaskId,
        },
      });

      for (const dep of dependencies) {
        queue.push(dep.blockedTaskId);
      }
    }

    return false;
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { NotificationService } from './notification.service';

@Injectable()
export class NotificationHelperService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  // 1️⃣ Notifier lors de l'assignation d'une tâche
  async notifyTaskAssigned(taskId: string, userIds: string[]) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { name: true } } },
    });

    if (!task) return;

    const notifications = await Promise.all(
      userIds.map((userId) =>
        this.notificationService.createNotification({
          type: 'TASK_ASSIGNED',
          content: `Vous avez été assigné à la tâche "${task.title}" dans le projet ${task.project.name}`,
          userId,
        }),
      ),
    );

    return notifications;
  }

  // 2️⃣ Notifier lors du changement de statut d'une tâche
  async notifyTaskStatusChanged(
    taskId: string,
    newStatus: string,
    changedByUserId: string,
  ) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { name: true } },
        assignments: { select: { userId: true } },
      },
    });

    if (!task) return;

    // Notifier tous les assignés sauf celui qui a changé le statut
    const userIdsToNotify = task.assignments
      .map((a) => a.userId)
      .filter((id) => id !== changedByUserId);

    if (userIdsToNotify.length === 0) return;

    const notifications = await Promise.all(
      userIdsToNotify.map((userId) =>
        this.notificationService.createNotification({
          type: 'TASK_STATUS_CHANGED',
          content: `Le statut de la tâche "${task.title}" a été changé en "${newStatus}"`,
          userId,
        }),
      ),
    );

    return notifications;
  }

  // 3️⃣ Notifier lors d'un commentaire sur une tâche
  async notifyTaskComment(taskId: string, commenterId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: { select: { name: true } },
        assignments: { select: { userId: true } },
      },
    });

    if (!task) return;

    // Notifier tous les assignés sauf celui qui a commenté
    const userIdsToNotify = task.assignments
      .map((a) => a.userId)
      .filter((id) => id !== commenterId);

    if (userIdsToNotify.length === 0) return;

    const notifications = await Promise.all(
      userIdsToNotify.map((userId) =>
        this.notificationService.createNotification({
          type: 'TASK_COMMENT',
          content: `Nouveau commentaire sur la tâche "${task.title}"`,
          userId,
        }),
      ),
    );

    return notifications;
  }

  // 4️⃣ Notifier lors de l'upload d'un document
  async notifyDocumentUploaded(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: {
          include: {
            members: { select: { userId: true } },
          },
        },
      },
    });

    if (!document) return;

    // Notifier tous les membres sauf l'auteur
    const userIdsToNotify = document.project.members
      .map((m) => m.userId)
      .filter((id) => id !== document.uploadedBy);

    if (userIdsToNotify.length === 0) return;

    const notifications = await Promise.all(
      userIdsToNotify.map((userId) =>
        this.notificationService.createNotification({
          type: 'DOCUMENT_UPLOADED',
          content: `Nouveau document "${document.name}" dans le projet ${document.project.name}`,
          userId,
        }),
      ),
    );

    return notifications;
  }

  // 5️⃣ Notifier lors d'un commentaire sur un document
  async notifyDocumentComment(documentId: string, commenterId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: {
        project: {
          include: {
            members: { select: { userId: true } },
          },
        },
      },
    });

    if (!document) return;

    // Notifier tous les membres sauf celui qui a commenté
    const userIdsToNotify = document.project.members
      .map((m) => m.userId)
      .filter((id) => id !== commenterId);

    if (userIdsToNotify.length === 0) return;

    const notifications = await Promise.all(
      userIdsToNotify.map((userId) =>
        this.notificationService.createNotification({
          type: 'DOCUMENT_COMMENT',
          content: `Nouveau commentaire sur le document "${document.name}"`,
          userId,
        }),
      ),
    );

    return notifications;
  }

  // 6️⃣ Notifier lors de l'ajout d'un membre à un projet
  async notifyProjectMemberAdded(projectId: string, newMemberId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: { select: { userId: true } },
      },
    });

    if (!project) return;

    // Notifier le nouveau membre
    await this.notificationService.createNotification({
      type: 'PROJECT_MEMBER_ADDED',
      content: `Vous avez été ajouté au projet "${project.name}"`,
      userId: newMemberId,
    });
  }

  // 7️⃣ Notifier les deadlines approchantes (à appeler via un cron job)
  async notifyApproachingDeadlines() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfter = new Date(tomorrow);
    dayAfter.setDate(dayAfter.getDate() + 1);

    const tasks = await this.prisma.task.findMany({
      where: {
        deadline: {
          gte: tomorrow,
          lt: dayAfter,
        },
        status: {
          not: 'DONE',
        },
      },
      include: {
        assignments: { select: { userId: true } },
        project: { select: { name: true } },
      },
    });

    const notifications = await Promise.all(
      tasks.flatMap((task) =>
        task.assignments.map((assignment) =>
          this.notificationService.createNotification({
            type: 'DEADLINE_APPROACHING',
            content: `La tâche "${task.title}" arrive à échéance demain dans le projet ${task.project.name}`,
            userId: assignment.userId,
          }),
        ),
      ),
    );

    return notifications;
  }
}

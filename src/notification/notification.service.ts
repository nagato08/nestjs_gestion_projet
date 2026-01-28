/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { SocketService } from 'src/socket/socket.service';

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  // 1️⃣ Créer une notification
  async createNotification(dto: CreateNotificationDto) {
    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, notificationSettings: true },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier les paramètres de notification de l'utilisateur
    const settings = user.notificationSettings[0];
    const shouldNotify = !settings || settings.realtime !== false; // Par défaut, notifier

    const notification = await this.prisma.notification.create({
      data: {
        type: dto.type,
        content: dto.content,
        userId: dto.userId,
        isRead: false,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Envoyer une notification en temps réel si activée
    if (shouldNotify && this.socketService.server) {
      this.socketService.server
        .to(`user:${dto.userId}`)
        .emit('new-notification', notification);
    }

    return notification;
  }

  // 2️⃣ Récupérer toutes les notifications d'un utilisateur
  async getMyNotifications(userId: string, unreadOnly = false) {
    const notifications = await this.prisma.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
    });

    return notifications;
  }

  // 3️⃣ Marquer une notification comme lue
  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable');
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return updated;
  }

  // 4️⃣ Marquer toutes les notifications comme lues
  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
      },
    });

    return {
      message: 'Toutes les notifications ont été marquées comme lues',
    };
  }

  // 5️⃣ Supprimer une notification
  async deleteNotification(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification introuvable');
    }

    if (notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable');
    }

    await this.prisma.notification.delete({
      where: { id: notificationId },
    });

    return {
      message: 'Notification supprimée avec succès',
    };
  }

  // 6️⃣ Compter les notifications non lues
  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });

    return { count };
  }

  // 7️⃣ Créer une notification pour plusieurs utilisateurs (helper)
  async notifyUsers(userIds: string[], type: string, content: string) {
    const notifications = await Promise.all(
      userIds.map((userId) =>
        this.createNotification({
          type,
          content,
          userId,
        }),
      ),
    );

    return notifications;
  }
}

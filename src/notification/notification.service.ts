import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { Notification } from '@prisma/client';
import {
  Paginated,
  PaginationDto,
  resolvePagination,
} from 'src/common/pagination/pagination.dto';
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

    // Envoyer une notification en temps réel si activée.
    //
    // Le nom de l'événement doit rester `notification:new` : le front écoute
    // exclusivement celui-là. Un `new-notification` émis ici n'atteignait
    // personne, et les notifications n'apparaissaient qu'au rechargement de
    // la page.
    if (shouldNotify && this.socketService.server) {
      this.socketService.server
        .to(`user:${dto.userId}`)
        .emit('notification:new', notification);
    }

    return notification;
  }

  // 2️⃣ Récupérer toutes les notifications d'un utilisateur
  /**
   * Notifications de l'utilisateur, page par page.
   *
   * Cette collection ne cesse de croître : un compte actif depuis six mois en
   * accumule des milliers, et les renvoyer toutes chargeait autant la base que
   * le navigateur pour un panneau qui n'en montre qu'une poignée.
   */
  async getMyNotifications(
    userId: string,
    unreadOnly = false,
    pagination: PaginationDto = {},
  ): Promise<Paginated<Notification>> {
    const { skip, take } = resolvePagination(pagination);
    const where = {
      userId,
      ...(unreadOnly && { isRead: false }),
    };

    // Total et page en parallèle : l'interface annonce « 50 sur 1 240 ».
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, skip, take };
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

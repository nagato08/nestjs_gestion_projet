/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';
import { Role } from '@prisma/client';

@Injectable()
export class NotificationSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1️⃣ Récupérer les paramètres de notification d'un utilisateur
  async getMyNotificationSettings(userId: string) {
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    // Si les paramètres n'existent pas, les créer avec les valeurs par défaut
    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: {
          userId,
          email: true,
          realtime: true,
        },
      });
    }

    return settings;
  }

  // 2️⃣ Mettre à jour les paramètres de notification
  async updateNotificationSettings(
    userId: string,
    dto: UpdateNotificationSettingsDto,
  ) {
    // Vérifier que l'utilisateur existe
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    // Vérifier si les paramètres existent
    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Créer les paramètres s'ils n'existent pas
      settings = await this.prisma.notificationSettings.create({
        data: {
          userId,
          email: dto.email ?? true,
          realtime: dto.realtime ?? true,
        },
      });
    } else {
      // Mettre à jour les paramètres existants
      settings = await this.prisma.notificationSettings.update({
        where: { userId },
        data: dto,
      });
    }

    return settings;
  }

  // 3️⃣ Récupérer les paramètres de notification d'un utilisateur spécifique (pour les admins)
  async getUserNotificationSettings(userId: string, requesterId: string) {
    // Vérifier que le demandeur est admin
    const requester = await this.prisma.user.findUnique({
      where: { id: requesterId },
      select: { role: true },
    });

    if (!requester || requester.role !== Role.ADMIN) {
      throw new NotFoundException('Accès réservé aux administrateurs');
    }

    let settings = await this.prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      settings = await this.prisma.notificationSettings.create({
        data: {
          userId,
          email: true,
          realtime: true,
        },
      });
    }

    return settings;
  }
}

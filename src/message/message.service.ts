/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateMessageDto } from './dto/create-message.dto';
import { SocketService } from 'src/socket/socket.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

@Injectable()
export class MessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /**
   * UTILITAIRE : Vérifie que l'utilisateur est membre du projet
   */
  private async verifyProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.projectAccess.requireMember(projectId, userId);
  }

  /**
   * UTILITAIRE : Publier un message exige MEMBER minimum (un VIEWER ne poste pas).
   */
  private async verifyProjectContributorAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.projectAccess.requireContributor(projectId, userId);
  }

  // 1️⃣ Créer un message dans un projet
  async createMessage(
    projectId: string,
    userId: string,
    dto: CreateMessageDto,
  ) {
    await this.verifyProjectContributorAccess(projectId, userId);

    const message = await this.prisma.message.create({
      data: {
        content: dto.content,
        projectId,
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
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Payload aplati pour matcher SocketEventMap['project:message:new'] côté front
    const socketPayload = {
      id: message.id,
      content: message.content,
      projectId: message.projectId,
      userId: message.userId,
      user: {
        id: message.user.id,
        firstName: message.user.firstName,
        lastName: message.user.lastName,
        avatar: message.user.avatar ?? undefined,
      },
      mentions: message.mentions ?? [],
      createdAt: message.createdAt.toISOString(),
    };

    if (this.socketService.server) {
      this.socketService.server
        .to(`project:${projectId}`)
        .emit('project:message:new', socketPayload);

      if (dto.mentions && dto.mentions.length > 0) {
        dto.mentions.forEach((mentionedUserId) => {
          this.socketService.server
            .to(`user:${mentionedUserId}`)
            .emit('mentioned-in-project-message', socketPayload);
        });
      }
    }

    return message;
  }

  // 2️⃣ Récupérer tous les messages d'un projet
  async getMessagesByProject(projectId: string, userId: string) {
    await this.verifyProjectAccess(projectId, userId);

    const messages = await this.prisma.message.findMany({
      where: {
        projectId,
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
      orderBy: { createdAt: 'asc' },
    });

    return messages;
  }

  // 3️⃣ Récupérer un message par ID
  async getMessageById(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
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
        project: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!message) {
      throw new NotFoundException('Message introuvable');
    }

    // Vérifier l'accès
    await this.verifyProjectAccess(message.projectId, userId);

    return message;
  }

  // 4️⃣ Supprimer un message
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('Message introuvable');
    }

    // Seul l'auteur peut supprimer son message
    if (message.userId !== userId) {
      throw new ForbiddenException(
        'Vous ne pouvez supprimer que vos propres messages',
      );
    }

    await this.prisma.message.delete({
      where: { id: messageId },
    });

    return {
      message: 'Message supprimé avec succès',
    };
  }
}

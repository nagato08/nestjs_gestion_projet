/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
  ) {}

  private async ensureProjectMember(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException('Projet introuvable');
    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember) {
      throw new ForbiddenException(
        "Vous n'êtes pas membre de ce projet. Seuls les membres peuvent discuter dans le chat du projet.",
      );
    }
  }

  /**
   * Envoyer un message dans le canal de chat du projet.
   * La conversation est créée automatiquement à la création du projet ; on la crée ici si absente (migration).
   */
  async sendProjectMessage({
    projectId,
    content,
    senderId,
  }: {
    projectId: string;
    content: string;
    senderId: string;
  }) {
    await this.ensureProjectMember(projectId, senderId);

    let conversation = await this.prisma.conversation.findUnique({
      where: { projectId },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { projectId },
      });
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        messages: {
          create: {
            content,
            senderId,
          },
        },
      },
      select: {
        id: true,
        projectId: true,
        messages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const lastMessage = (updated as { messages: typeof updated.messages })
      .messages[0];
    if (this.socketService.server && lastMessage) {
      this.socketService.server
        .to(`project:${projectId}`)
        .emit('project-chat-message', lastMessage);
    }

    return {
      error: false,
      message: 'Message envoyé.',
      data: lastMessage,
    };
  }

  /**
   * Récupérer la conversation (messages) du projet.
   */
  async getProjectConversation({
    projectId,
    userId,
  }: {
    projectId: string;
    userId: string;
  }) {
    await this.ensureProjectMember(projectId, userId);

    const conversation = await this.prisma.conversation.findUnique({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        updatedAt: true,
        messages: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            sender: {
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
      },
    });

    if (!conversation) {
      return { id: null, projectId, messages: [] };
    }
    return conversation;
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /** Lecture du chat : tout membre du projet, VIEWER compris. */
  private async ensureProjectMember(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.projectAccess.requireMember(projectId, userId);
  }

  /** Écriture dans le chat : MEMBER minimum, un VIEWER ne peut pas poster. */
  private async ensureProjectContributor(
    projectId: string,
    userId: string,
  ): Promise<void> {
    await this.projectAccess.requireContributor(projectId, userId);
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
    await this.ensureProjectContributor(projectId, senderId);

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
            senderId: true,
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

    const raw = (updated as { messages: typeof updated.messages }).messages[0];
    const lastMessage = raw
      ? { ...raw, userId: raw.senderId, user: raw.sender, projectId }
      : null;

    if (this.socketService.server && lastMessage) {
      this.socketService.server
        .to(`project:${projectId}`)
        .emit('message:new', lastMessage);
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
            senderId: true,
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

    return {
      ...conversation,
      messages: conversation.messages.map((msg) => ({
        id: msg.id,
        content: msg.content,
        createdAt: msg.createdAt,
        projectId,
        userId: msg.senderId,
        user: msg.sender,
      })),
    };
  }
}

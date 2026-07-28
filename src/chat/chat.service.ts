import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  PaginationDto,
  resolvePagination,
} from 'src/common/pagination/pagination.dto';
import { SocketService } from 'src/socket/socket.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { NotificationService } from 'src/notification/notification.service';

/** Métadonnées d'un fichier joint, telles que fournies à la création. */
export interface ChatAttachmentInput {
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

/**
 * Champs remontés pour un message. Défini une fois et réutilisé par l'envoi
 * et la lecture : les deux doivent renvoyer exactement la même forme, sinon
 * le message qui apparaît en direct diffère de celui rechargé.
 */
const CHAT_MESSAGE_SELECT = {
  id: true,
  content: true,
  createdAt: true,
  senderId: true,
  mentions: true,
  sender: {
    select: { id: true, firstName: true, lastName: true, avatar: true },
  },
  attachments: {
    select: { id: true, name: true, url: true, size: true, mimeType: true },
  },
} as const;

export interface ChatMessageRow {
  id: string;
  content: string;
  createdAt: Date;
  senderId: string;
  mentions: string[];
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    avatar: string | null;
  };
  attachments: {
    id: string;
    name: string;
    url: string;
    size: number;
    mimeType: string;
  }[];
}

export interface ChatMessagePayload {
  id: string;
  content: string;
  createdAt: Date;
  projectId: string;
  userId: string;
  user: ChatMessageRow['sender'];
  mentions: string[];
  attachments: ChatMessageRow['attachments'];
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly projectAccess: ProjectAccessService,
    private readonly notificationService: NotificationService,
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
    mentions = [],
    attachments = [],
  }: {
    projectId: string;
    content: string;
    senderId: string;
    mentions?: string[];
    attachments?: ChatAttachmentInput[];
  }) {
    await this.ensureProjectContributor(projectId, senderId);

    // On ne notifie que des membres réels du projet : une mention fabriquée
    // côté client ne doit pas permettre d'alerter n'importe quel compte.
    const validMentions = await this.filterProjectMembers(projectId, mentions);

    let conversation = await this.prisma.conversation.findUnique({
      where: { projectId },
    });
    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { projectId },
      });
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        content,
        senderId,
        conversationId: conversation.id,
        mentions: validMentions,
        attachments: attachments.length ? { create: attachments } : undefined,
      },
      select: CHAT_MESSAGE_SELECT,
    });

    const payload = this.toPayload(message, projectId);

    if (this.socketService.server) {
      this.socketService.server
        .to(`project:${projectId}`)
        .emit('message:new', payload);

      // Notification ciblée pour chaque personne mentionnée, en plus du
      // message diffusé à la room : elle peut ne pas avoir le chat ouvert.
      for (const userId of validMentions) {
        if (userId === senderId) continue;
        this.socketService.server
          .to(`user:${userId}`)
          .emit('chat:mentioned', payload);
      }
    }

    // Notification persistante (cloche) pour les mentionnés absents.
    void this.notifyMentions({
      mentions: validMentions,
      senderId,
      projectId,
      content,
    });

    return {
      error: false,
      message: 'Message envoyé.',
      data: payload,
    };
  }

  /** Ne conserve que les identifiants réellement membres du projet. */
  private async filterProjectMembers(
    projectId: string,
    userIds: string[],
  ): Promise<string[]> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return [];

    const members = await this.prisma.projectMember.findMany({
      where: { projectId, userId: { in: unique } },
      select: { userId: true },
    });

    return members.map((m) => m.userId);
  }

  /** Notification persistante pour chaque personne mentionnée. */
  private async notifyMentions({
    mentions,
    senderId,
    projectId,
    content,
  }: {
    mentions: string[];
    senderId: string;
    projectId: string;
    content: string;
  }): Promise<void> {
    const targets = mentions.filter((id) => id !== senderId);
    if (targets.length === 0) return;

    const [sender, project] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: senderId },
        select: { firstName: true, lastName: true },
      }),
      this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      }),
    ]);

    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`
      : 'Quelqu’un';
    const extract = content.length > 80 ? `${content.slice(0, 80)}…` : content;

    await Promise.all(
      targets.map((userId) =>
        this.notificationService.createNotification({
          type: 'CHAT_MENTION',
          content: `${senderName} vous a mentionné dans ${project?.name ?? 'un projet'} : « ${extract} »`,
          userId,
        }),
      ),
    );
  }

  /** Forme attendue par le front : `userId`/`user` plutôt que `senderId`/`sender`. */
  private toPayload(
    message: ChatMessageRow,
    projectId: string,
  ): ChatMessagePayload {
    return {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      projectId,
      userId: message.senderId,
      user: message.sender,
      mentions: message.mentions,
      attachments: message.attachments,
    };
  }

  /**
   * Récupérer la conversation (messages) du projet.
   */
  async getProjectConversation({
    projectId,
    userId,
    pagination = {},
  }: {
    projectId: string;
    userId: string;
    pagination?: PaginationDto;
  }) {
    await this.ensureProjectMember(projectId, userId);
    const { skip, take } = resolvePagination(pagination);

    const conversation = await this.prisma.conversation.findUnique({
      where: { projectId },
      select: { id: true, projectId: true, updatedAt: true },
    });

    if (!conversation) {
      return { id: null, projectId, messages: [], total: 0, hasMore: false };
    }

    // Tri décroissant pour prendre les messages les plus récents : c'est ce
    // qu'on ouvre en arrivant dans une conversation. Un tri croissant aurait
    // ramené les tout premiers messages du projet.
    const [recent, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { conversationId: conversation.id },
        select: CHAT_MESSAGE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatMessage.count({
        where: { conversationId: conversation.id },
      }),
    ]);

    return {
      ...conversation,
      // Remis dans l'ordre de lecture : l'affichage attend du chronologique.
      messages: recent
        .slice()
        .reverse()
        .map((msg) => this.toPayload(msg, projectId)),
      total,
      // Permet au client de proposer « charger les messages précédents ».
      hasMore: skip + recent.length < total,
    };
  }
}

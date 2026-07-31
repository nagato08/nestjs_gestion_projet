import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import {
  PaginationDto,
  resolvePagination,
} from 'src/common/pagination/pagination.dto';
import { SocketService } from 'src/socket/socket.service';
import { NotificationService } from 'src/notification/notification.service';
import { ChatAttachmentInput, CHAT_MESSAGE_SELECT } from './chat.service';

const PARTICIPANT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatar: true,
  jobTitle: true,
} as const;

/**
 * Messagerie directe : des fils de personne à personne, à l'échelle de
 * l'organisation.
 *
 * Distincte du chat de projet, qui tire ses droits de lecture de
 * `ProjectMember`. Ici l'appartenance est explicite — on lit un fil parce
 * qu'on en est participant, pas parce qu'on partage un projet.
 */
@Injectable()
export class DirectMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Ouvre le fil avec quelqu'un, en le créant au besoin.
   *
   * Idempotent : deux personnes qui s'écrivent en même temps doivent retomber
   * sur le même fil, jamais sur deux fils parallèles.
   */
  async openDirectConversation(userId: string, otherUserId: string) {
    if (userId === otherUserId) {
      throw new BadRequestException(
        'Impossible d’ouvrir une conversation avec soi-même',
      );
    }

    const other = await this.prisma.user.findFirst({
      where: { id: otherUserId, deletedAt: null },
      select: PARTICIPANT_SELECT,
    });
    if (!other) throw new NotFoundException('Utilisateur introuvable');

    const existing = await this.findDirectConversation(userId, otherUserId);
    if (existing) return existing;

    const created = await this.prisma.conversation.create({
      data: {
        type: ConversationType.DIRECT,
        participants: {
          create: [{ userId }, { userId: otherUserId }],
        },
      },
      select: { id: true, createdAt: true },
    });

    return {
      id: created.id,
      type: ConversationType.DIRECT,
      participant: other,
      lastMessageAt: null,
    };
  }

  /** Fil existant entre exactement ces deux personnes, s'il y en a un. */
  private async findDirectConversation(userId: string, otherUserId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        type: ConversationType.DIRECT,
        // Les deux appartenances sont exigées séparément : un unique `in`
        // ramènerait aussi les fils où seule l'une des deux figure.
        AND: [
          { participants: { some: { userId } } },
          { participants: { some: { userId: otherUserId } } },
        ],
      },
      select: {
        id: true,
        updatedAt: true,
        participants: {
          where: { userId: otherUserId },
          select: { user: { select: PARTICIPANT_SELECT } },
        },
      },
    });

    if (!conversation) return null;

    return {
      id: conversation.id,
      type: ConversationType.DIRECT,
      participant: conversation.participants[0]?.user ?? null,
      lastMessageAt: conversation.updatedAt,
    };
  }

  /** Garde d'accès : on ne lit un fil direct qu'en tant que participant. */
  private async requireParticipant(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        type: true,
        participants: { select: { userId: true } },
      },
    });

    if (!conversation || conversation.type !== ConversationType.DIRECT) {
      throw new NotFoundException('Conversation introuvable');
    }
    if (!conversation.participants.some((p) => p.userId === userId)) {
      throw new ForbiddenException('Cette conversation ne vous concerne pas');
    }

    return conversation;
  }

  /**
   * Annuaire pour démarrer un fil : tous les comptes actifs, soi-même exclu.
   *
   * Volontairement réduit à ce qu'il faut pour reconnaître quelqu'un — ni
   * courriel, ni rôle, ni service. `GET /auth/users`, réservé aux
   * administrateurs, expose bien plus et n'avait pas à s'ouvrir à tous pour
   * cet usage.
   */
  async listDirectory(userId: string) {
    return this.prisma.user.findMany({
      where: { deletedAt: null, id: { not: userId } },
      select: PARTICIPANT_SELECT,
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    });
  }

  /** Fils directs de l'utilisateur, le plus récemment actif en tête. */
  async listMyConversations(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        type: ConversationType.DIRECT,
        participants: { some: { userId } },
      },
      select: {
        id: true,
        updatedAt: true,
        participants: {
          where: { userId: { not: userId } },
          select: { user: { select: PARTICIPANT_SELECT } },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { content: true, createdAt: true, senderId: true },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return conversations.map((conversation) => ({
      id: conversation.id,
      type: ConversationType.DIRECT,
      participant: conversation.participants[0]?.user ?? null,
      lastMessage: conversation.messages[0] ?? null,
      lastMessageAt: conversation.updatedAt,
    }));
  }

  async getMessages({
    conversationId,
    userId,
    pagination = {},
  }: {
    conversationId: string;
    userId: string;
    pagination?: PaginationDto;
  }) {
    await this.requireParticipant(conversationId, userId);
    const { skip, take } = resolvePagination(pagination);

    // Ordre décroissant pour prendre les messages les plus récents, puis
    // remis à l'endroit : c'est le bas du fil qu'on ouvre en arrivant.
    const [recent, total] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { conversationId },
        select: CHAT_MESSAGE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.chatMessage.count({ where: { conversationId } }),
    ]);

    return {
      id: conversationId,
      messages: recent
        .slice()
        .reverse()
        .map((message) => ({
          id: message.id,
          content: message.content,
          createdAt: message.createdAt,
          conversationId,
          userId: message.senderId,
          user: message.sender,
          mentions: message.mentions,
          attachments: message.attachments,
        })),
      total,
      hasMore: skip + recent.length < total,
    };
  }

  async sendMessage({
    conversationId,
    senderId,
    content,
    attachments = [],
  }: {
    conversationId: string;
    senderId: string;
    content: string;
    attachments?: ChatAttachmentInput[];
  }) {
    const conversation = await this.requireParticipant(
      conversationId,
      senderId,
    );

    const message = await this.prisma.chatMessage.create({
      data: {
        content,
        senderId,
        conversationId,
        attachments: attachments.length ? { create: attachments } : undefined,
      },
      select: CHAT_MESSAGE_SELECT,
    });

    // Fait remonter le fil en tête de liste côté destinataire.
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    const payload = {
      id: message.id,
      content: message.content,
      createdAt: message.createdAt,
      conversationId,
      userId: message.senderId,
      user: message.sender,
      mentions: message.mentions,
      attachments: message.attachments,
    };

    // Diffusion sur les rooms personnelles, déjà rejointes au handshake :
    // un fil direct n'a que deux destinataires, une room dédiée n'apporterait
    // rien de plus.
    const recipients = conversation.participants.map((p) => p.userId);
    if (this.socketService.server) {
      for (const recipientId of recipients) {
        this.socketService.server
          .to(`user:${recipientId}`)
          .emit('dm:new', payload);
      }
    }

    void this.notifyRecipient({ recipients, senderId, content });

    return { error: false, message: 'Message envoyé.', data: payload };
  }

  /** Notification persistante pour le destinataire hors ligne. */
  private async notifyRecipient({
    recipients,
    senderId,
    content,
  }: {
    recipients: string[];
    senderId: string;
    content: string;
  }): Promise<void> {
    const targets = recipients.filter((id) => id !== senderId);
    if (targets.length === 0) return;

    const sender = await this.prisma.user.findUnique({
      where: { id: senderId },
      select: { firstName: true, lastName: true },
    });
    const senderName = sender
      ? `${sender.firstName} ${sender.lastName}`
      : 'Quelqu’un';
    const extract = content.length > 80 ? `${content.slice(0, 80)}…` : content;

    await Promise.all(
      targets.map((userId) =>
        this.notificationService.createNotification({
          type: 'CHAT_MENTION',
          content: `${senderName} vous a écrit : « ${extract} »`,
          userId,
        }),
      ),
    );
  }
}

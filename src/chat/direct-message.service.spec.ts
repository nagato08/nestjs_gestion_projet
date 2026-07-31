import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConversationType } from '@prisma/client';
import { DirectMessageService } from './direct-message.service';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';
import { NotificationService } from 'src/notification/notification.service';

const ME = 'utilisateur-1';
const OTHER = 'utilisateur-2';
const INTRUDER = 'utilisateur-3';
const CONVERSATION_ID = 'conversation-1';

function buildService() {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: OTHER, firstName: 'Awa' }),
      findUnique: jest.fn().mockResolvedValue({
        firstName: 'Awa',
        lastName: 'Ndiaye',
      }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    conversation: {
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: CONVERSATION_ID,
        createdAt: new Date(),
      }),
      update: jest.fn().mockResolvedValue({ id: CONVERSATION_ID }),
    },
    chatMessage: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue({
        id: 'message-1',
        content: 'Bonjour',
        createdAt: new Date(),
        senderId: ME,
        mentions: [],
        sender: { id: ME, firstName: 'A', lastName: 'B', avatar: null },
        attachments: [],
      }),
    },
  };

  const emit = jest.fn();
  const socketService = { server: { to: jest.fn(() => ({ emit })) } };
  const notificationService = {
    createNotification: jest.fn().mockResolvedValue({}),
  };

  const service = new DirectMessageService(
    prisma as unknown as PrismaService,
    socketService as unknown as SocketService,
    notificationService as unknown as NotificationService,
  );

  return { service, prisma, socketService, notificationService, emit };
}

/** Conversation directe entre ME et OTHER, telle que la garde d'accès la lit. */
function directConversation() {
  return {
    id: CONVERSATION_ID,
    type: ConversationType.DIRECT,
    participants: [{ userId: ME }, { userId: OTHER }],
  };
}

describe('Ouverture d’un fil direct', () => {
  it('refuse une conversation avec soi-même', async () => {
    const { service, prisma } = buildService();

    await expect(service.openDirectConversation(ME, ME)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('réutilise le fil existant plutôt que d’en créer un second', async () => {
    // Deux personnes qui s'écrivent doivent toujours retomber sur le même
    // fil, sinon la conversation se scinde en deux historiques parallèles.
    const { service, prisma } = buildService();
    prisma.conversation.findFirst.mockResolvedValue({
      id: CONVERSATION_ID,
      updatedAt: new Date(),
      participants: [{ user: { id: OTHER, firstName: 'Awa' } }],
    });

    const result = await service.openDirectConversation(ME, OTHER);

    expect(result.id).toBe(CONVERSATION_ID);
    expect(prisma.conversation.create).not.toHaveBeenCalled();
  });

  it('exige les deux participants pour reconnaître un fil existant', async () => {
    const { service, prisma } = buildService();

    await service.openDirectConversation(ME, OTHER);

    const call = prisma.conversation.findFirst.mock.calls[0][0] as {
      where: { AND: unknown[] };
    };
    // Un seul `in` ramènerait aussi les fils où une seule des deux personnes
    // figure : les deux appartenances se vérifient séparément.
    expect(call.where.AND).toHaveLength(2);
  });

  it('crée le fil avec ses deux participants', async () => {
    const { service, prisma } = buildService();

    await service.openDirectConversation(ME, OTHER);

    const call = prisma.conversation.create.mock.calls[0][0] as {
      data: { type: string; participants: { create: { userId: string }[] } };
    };
    expect(call.data.type).toBe(ConversationType.DIRECT);
    expect(call.data.participants.create.map((p) => p.userId).sort()).toEqual(
      [ME, OTHER].sort(),
    );
  });

  it('refuse d’écrire à un compte supprimé', async () => {
    const { service, prisma } = buildService();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.openDirectConversation(ME, OTHER)).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('Accès à un fil direct', () => {
  it('refuse la lecture à quelqu’un qui n’en est pas participant', async () => {
    const { service, prisma } = buildService();
    prisma.conversation.findUnique.mockResolvedValue(directConversation());

    await expect(
      service.getMessages({
        conversationId: CONVERSATION_ID,
        userId: INTRUDER,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuse l’envoi à quelqu’un qui n’en est pas participant', async () => {
    const { service, prisma } = buildService();
    prisma.conversation.findUnique.mockResolvedValue(directConversation());

    await expect(
      service.sendMessage({
        conversationId: CONVERSATION_ID,
        senderId: INTRUDER,
        content: 'Bonjour',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it('n’expose pas un canal de projet par la route des fils directs', async () => {
    // Le canal d'un projet se lit via ses propres règles d'appartenance :
    // y accéder par ici contournerait le contrôle de membre du projet.
    const { service, prisma } = buildService();
    prisma.conversation.findUnique.mockResolvedValue({
      id: CONVERSATION_ID,
      type: ConversationType.PROJECT,
      participants: [],
    });

    await expect(
      service.getMessages({ conversationId: CONVERSATION_ID, userId: ME }),
    ).rejects.toThrow(NotFoundException);
  });
});

describe('Envoi d’un message direct', () => {
  it('diffuse aux deux participants et notifie le seul destinataire', async () => {
    const { service, prisma, socketService, notificationService } =
      buildService();
    prisma.conversation.findUnique.mockResolvedValue(directConversation());

    await service.sendMessage({
      conversationId: CONVERSATION_ID,
      senderId: ME,
      content: 'Bonjour',
    });

    const rooms = socketService.server.to.mock.calls.map((c) => c[0] as string);
    expect(rooms).toEqual([`user:${ME}`, `user:${OTHER}`]);

    // On ne se notifie pas soi-même de son propre message.
    expect(notificationService.createNotification).toHaveBeenCalledTimes(1);
    const notification = notificationService.createNotification.mock
      .calls[0][0] as { userId: string };
    expect(notification.userId).toBe(OTHER);
  });

  it('fait remonter le fil en tête de liste', async () => {
    const { service, prisma } = buildService();
    prisma.conversation.findUnique.mockResolvedValue(directConversation());

    await service.sendMessage({
      conversationId: CONVERSATION_ID,
      senderId: ME,
      content: 'Bonjour',
    });

    expect(prisma.conversation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CONVERSATION_ID } }),
    );
  });
});

describe('Annuaire', () => {
  it('exclut les comptes supprimés et soi-même', async () => {
    const { service, prisma } = buildService();

    await service.listDirectory(ME);

    const call = prisma.user.findMany.mock.calls[0][0] as {
      where: { deletedAt: null; id: { not: string } };
      select: Record<string, unknown>;
    };
    expect(call.where.deletedAt).toBeNull();
    expect(call.where.id.not).toBe(ME);
    // Identité seule : ni courriel ni rôle ne sortent par cette route,
    // ouverte à tous les comptes.
    expect(call.select.email).toBeUndefined();
    expect(call.select.role).toBeUndefined();
  });
});

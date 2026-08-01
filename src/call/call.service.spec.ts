import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CallStatus } from '@prisma/client';
import { CallService } from './call.service';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';
import { NotificationService } from 'src/notification/notification.service';

const CALLER = 'utilisateur-1';
const CALLEE = 'utilisateur-2';
const INTRUDER = 'utilisateur-3';
const CALL_ID = 'appel-1';

function buildService() {
  const prisma = {
    user: { findFirst: jest.fn().mockResolvedValue({ id: CALLEE }) },
    call: {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue({ id: CALL_ID }),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({
        id: CALL_ID,
        callerId: CALLER,
        calleeId: CALLEE,
        caller: { firstName: 'Awa', lastName: 'Ndiaye' },
      }),
      update: jest.fn().mockResolvedValue({
        id: CALL_ID,
        callerId: CALLER,
        calleeId: CALLEE,
        caller: { firstName: 'Awa', lastName: 'Ndiaye' },
      }),
    },
  };

  const emit = jest.fn();
  const socketService = {
    server: { to: jest.fn((room: string) => ({ emit, room })) },
  };
  const notificationService = {
    createNotification: jest.fn().mockResolvedValue({}),
  };

  const service = new CallService(
    prisma as unknown as PrismaService,
    socketService as unknown as SocketService,
    notificationService as unknown as NotificationService,
  );

  return { service, prisma, socketService, notificationService };
}

/** Appel qui sonne encore, tel que le lit la garde d'accès. */
function ringing(overrides: Record<string, unknown> = {}) {
  return {
    id: CALL_ID,
    callerId: CALLER,
    calleeId: CALLEE,
    status: CallStatus.RINGING,
    answeredAt: null,
    endedAt: null,
    ...overrides,
  };
}

const flush = () => new Promise(setImmediate);

describe('Lancement d’un appel', () => {
  it('refuse de s’appeler soi-même', async () => {
    const { service, prisma } = buildService();

    await expect(service.start(CALLER, CALLER)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.call.create).not.toHaveBeenCalled();
  });

  it('refuse d’appeler un compte supprimé', async () => {
    const { service, prisma } = buildService();
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.start(CALLER, CALLEE)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('refuse un second appel quand l’un des deux est déjà occupé', async () => {
    // Deux sonneries concurrentes sur la même personne rendraient
    // l'historique incohérent : le premier appel doit se terminer d'abord.
    const { service, prisma } = buildService();
    prisma.call.findFirst.mockResolvedValue({ id: 'appel-en-cours' });

    await expect(service.start(CALLER, CALLEE)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.call.create).not.toHaveBeenCalled();
  });

  it('solde les sonneries abandonnees avant de tester l’occupation', async () => {
    // Un appel laisse en sonnerie — onglet ferme, micro refuse — bloquait
    // definitivement tous les appels suivants de ces deux personnes.
    const { service, prisma } = buildService();

    await service.start(CALLER, CALLEE);

    expect(prisma.call.updateMany).toHaveBeenCalled();
    const purge = prisma.call.updateMany.mock.calls[0][0] as {
      where: { status: string; startedAt: { lt: Date } };
      data: { status: string };
    };
    expect(purge.where.status).toBe(CallStatus.RINGING);
    expect(purge.where.startedAt.lt).toBeInstanceOf(Date);
    expect(purge.data.status).toBe(CallStatus.MISSED);

    // Le menage precede le test d'occupation, sinon il ne servirait a rien.
    const purgeOrder = prisma.call.updateMany.mock.invocationCallOrder[0];
    const busyOrder = prisma.call.findFirst.mock.invocationCallOrder[0];
    expect(purgeOrder).toBeLessThan(busyOrder);
  });

  it('fait sonner le destinataire, et lui seul', async () => {
    const { service, socketService } = buildService();

    await service.start(CALLER, CALLEE);

    const rooms = socketService.server.to.mock.calls.map(([room]) => room);
    expect(rooms).toEqual([`user:${CALLEE}`]);
  });
});

describe('Réponse à un appel', () => {
  it('refuse le décrochage à quelqu’un d’étranger à l’appel', async () => {
    const { service, prisma } = buildService();
    prisma.call.findUnique.mockResolvedValue(ringing());

    await expect(service.answer(CALL_ID, INTRUDER)).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.call.update).not.toHaveBeenCalled();
  });

  it('interdit à l’appelant de décrocher son propre appel', async () => {
    const { service, prisma } = buildService();
    prisma.call.findUnique.mockResolvedValue(ringing());

    await expect(service.answer(CALL_ID, CALLER)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('horodate le décrochage et prévient l’appelant', async () => {
    const { service, prisma, socketService } = buildService();
    prisma.call.findUnique.mockResolvedValue(ringing());

    await service.answer(CALL_ID, CALLEE);

    const call = prisma.call.update.mock.calls[0][0] as {
      data: { status: string; answeredAt: Date };
    };
    expect(call.data.status).toBe(CallStatus.ANSWERED);
    expect(call.data.answeredAt).toBeInstanceOf(Date);

    const rooms = socketService.server.to.mock.calls.map(([room]) => room);
    expect(rooms).toEqual([`user:${CALLER}`]);
  });

  it('refuse de décrocher un appel qui ne sonne plus', async () => {
    const { service, prisma } = buildService();
    prisma.call.findUnique.mockResolvedValue(
      ringing({ status: CallStatus.ANSWERED }),
    );

    await expect(service.answer(CALL_ID, CALLEE)).rejects.toThrow(
      BadRequestException,
    );
  });
});

describe('Fin d’un appel', () => {
  it('compte comme manqué un appel raccroché avant tout décrochage', async () => {
    const { service, prisma, notificationService } = buildService();
    prisma.call.findUnique.mockResolvedValue(ringing());

    await service.end(CALL_ID, CALLER);
    await flush();

    const call = prisma.call.update.mock.calls[0][0] as {
      data: { status: string };
    };
    expect(call.data.status).toBe(CallStatus.MISSED);

    const sent = notificationService.createNotification.mock.calls[0][0] as {
      type: string;
      userId: string;
    };
    expect(sent.type).toBe('CALL_MISSED');
    // L'appel manqué se signale au destinataire, pas à celui qui a appelé.
    expect(sent.userId).toBe(CALLEE);
  });

  it('conserve le statut « répondu » quand on raccroche après avoir parlé', async () => {
    const { service, prisma, notificationService } = buildService();
    prisma.call.findUnique.mockResolvedValue(
      ringing({ status: CallStatus.ANSWERED, answeredAt: new Date() }),
    );

    await service.end(CALL_ID, CALLEE);
    await flush();

    const call = prisma.call.update.mock.calls[0][0] as {
      data: { status: string; endedAt: Date };
    };
    expect(call.data.status).toBe(CallStatus.ANSWERED);
    expect(call.data.endedAt).toBeInstanceOf(Date);
    expect(notificationService.createNotification).not.toHaveBeenCalled();
  });

  it('ne repousse pas la date de fin d’un appel déjà raccroché', async () => {
    // Les deux interlocuteurs raccrochent : sans cette garde, le second
    // raccrochage allongerait la durée enregistrée.
    const { service, prisma } = buildService();
    prisma.call.findUnique.mockResolvedValue(
      ringing({ status: CallStatus.ANSWERED, endedAt: new Date() }),
    );

    await service.end(CALL_ID, CALLER);

    expect(prisma.call.update).not.toHaveBeenCalled();
  });

  it('prévient l’autre partie, quel que soit celui qui raccroche', async () => {
    const { service, prisma, socketService } = buildService();
    prisma.call.findUnique.mockResolvedValue(
      ringing({ status: CallStatus.ANSWERED, answeredAt: new Date() }),
    );

    await service.end(CALL_ID, CALLEE);

    const rooms = socketService.server.to.mock.calls.map(([room]) => room);
    expect(rooms).toEqual([`user:${CALLER}`]);
  });
});

describe('Journal des appels', () => {
  it('calcule la durée à partir du décrochage, pas de la première sonnerie', async () => {
    const { service, prisma } = buildService();
    prisma.call.findMany.mockResolvedValue([
      {
        id: CALL_ID,
        callerId: CALLER,
        calleeId: CALLEE,
        status: CallStatus.ANSWERED,
        startedAt: new Date('2026-08-01T10:00:00Z'),
        answeredAt: new Date('2026-08-01T10:00:20Z'),
        endedAt: new Date('2026-08-01T10:02:20Z'),
      },
    ]);

    const [call] = await service.listMine(CALLER);

    // 20 secondes de sonnerie ne comptent pas : deux minutes de conversation.
    expect(call.durationSeconds).toBe(120);
    expect(call.outgoing).toBe(true);
  });

  it('donne une durée nulle à un appel jamais décroché', async () => {
    const { service, prisma } = buildService();
    prisma.call.findMany.mockResolvedValue([
      {
        id: CALL_ID,
        callerId: CALLEE,
        calleeId: CALLER,
        status: CallStatus.MISSED,
        startedAt: new Date(),
        answeredAt: null,
        endedAt: new Date(),
      },
    ]);

    const [call] = await service.listMine(CALLER);

    expect(call.durationSeconds).toBe(0);
    expect(call.outgoing).toBe(false);
  });
});

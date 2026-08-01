import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CallStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { SocketService } from 'src/socket/socket.service';
import { NotificationService } from 'src/notification/notification.service';

const PEER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  avatar: true,
} as const;

const CALL_INCLUDE = {
  caller: { select: PEER_SELECT },
  callee: { select: PEER_SELECT },
} as const;

/**
 * Appels audio entre deux personnes.
 *
 * L'audio lui-même ne passe jamais par le serveur : les deux navigateurs
 * s'échangent directement le flux (WebRTC), la gateway ne servant qu'à les
 * mettre en relation. Ce service ne gère donc que le cycle de vie et la trace
 * de l'appel — qui a appelé qui, quand, et ce qu'il en est advenu.
 */
@Injectable()
export class CallService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Prévient un interlocuteur d'un changement d'état de l'appel.
   *
   * Passe par la room personnelle, déjà rejointe au handshake : un appel n'a
   * que deux destinataires, une room dédiée n'apporterait rien.
   */
  private emitTo(userId: string, event: string, payload: unknown) {
    this.socketService.server?.to(`user:${userId}`).emit(event, payload);
  }

  /**
   * Enregistre un appel qui commence à sonner.
   *
   * Refuse d'ouvrir un second appel tant qu'un des deux interlocuteurs est
   * déjà occupé : deux appels simultanés sur la même personne produiraient
   * deux sonneries concurrentes et un historique incohérent.
   */
  async start(callerId: string, calleeId: string, conversationId?: string) {
    if (callerId === calleeId) {
      throw new BadRequestException('Impossible de s’appeler soi-même');
    }

    const callee = await this.prisma.user.findFirst({
      where: { id: calleeId, deletedAt: null },
      select: { id: true },
    });
    if (!callee) throw new NotFoundException('Utilisateur introuvable');

    const busy = await this.prisma.call.findFirst({
      where: {
        status: CallStatus.RINGING,
        OR: [
          { callerId: { in: [callerId, calleeId] } },
          { calleeId: { in: [callerId, calleeId] } },
        ],
      },
      select: { id: true },
    });
    if (busy) {
      throw new BadRequestException('Un appel est déjà en cours');
    }

    const call = await this.prisma.call.create({
      data: { callerId, calleeId, conversationId },
      include: CALL_INCLUDE,
    });

    this.emitTo(calleeId, 'call:incoming', call);
    return call;
  }

  /** Appel en cours, vérifié comme appartenant à celui qui agit. */
  private async requireParticipant(callId: string, userId: string) {
    const call = await this.prisma.call.findUnique({
      where: { id: callId },
      select: {
        id: true,
        callerId: true,
        calleeId: true,
        status: true,
        answeredAt: true,
        endedAt: true,
      },
    });
    if (!call) throw new NotFoundException('Appel introuvable');
    if (call.callerId !== userId && call.calleeId !== userId) {
      throw new ForbiddenException('Cet appel ne vous concerne pas');
    }
    return call;
  }

  /** Décrochage — seul l'appelé décroche. */
  async answer(callId: string, userId: string) {
    const call = await this.requireParticipant(callId, userId);
    if (call.calleeId !== userId) {
      throw new ForbiddenException('Seul le destinataire peut décrocher');
    }
    if (call.status !== CallStatus.RINGING) {
      throw new BadRequestException('Cet appel n’est plus en attente');
    }

    const answered = await this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.ANSWERED, answeredAt: new Date() },
      include: CALL_INCLUDE,
    });

    this.emitTo(answered.callerId, 'call:answered', answered);
    return answered;
  }

  /** Refus explicite — seul l'appelé refuse. */
  async reject(callId: string, userId: string) {
    const call = await this.requireParticipant(callId, userId);
    if (call.calleeId !== userId) {
      throw new ForbiddenException('Seul le destinataire peut refuser');
    }
    if (call.status !== CallStatus.RINGING) {
      throw new BadRequestException('Cet appel n’est plus en attente');
    }

    const rejected = await this.prisma.call.update({
      where: { id: callId },
      data: { status: CallStatus.REJECTED, endedAt: new Date() },
      include: CALL_INCLUDE,
    });

    this.emitTo(rejected.callerId, 'call:rejected', rejected);
    return rejected;
  }

  /**
   * Raccrochage, des deux côtés.
   *
   * Raccrocher avant tout décrochage n'est pas la même chose que raccrocher
   * après : dans le premier cas l'appel n'a jamais eu lieu, il devient un
   * appel manqué et le destinataire en est averti.
   */
  async end(callId: string, userId: string) {
    const call = await this.requireParticipant(callId, userId);

    // Un appel déjà clos ne se reclôt pas : sa date de fin doit rester celle
    // du premier raccrochage, sinon la durée enregistrée s'allonge toute seule.
    if (call.status !== CallStatus.RINGING && call.endedAt !== null) {
      return this.prisma.call.findUniqueOrThrow({
        where: { id: callId },
        include: CALL_INCLUDE,
      });
    }

    const missed = call.status === CallStatus.RINGING;
    const updated = await this.prisma.call.update({
      where: { id: callId },
      data: {
        status: missed ? CallStatus.MISSED : call.status,
        endedAt: new Date(),
      },
      include: CALL_INCLUDE,
    });

    // L'autre partie doit raccrocher aussi, quel que soit celui qui a mis fin.
    const peerId = call.callerId === userId ? call.calleeId : call.callerId;
    this.emitTo(peerId, 'call:ended', updated);

    if (missed) void this.notifyMissed(updated);

    return updated;
  }

  private async notifyMissed(call: {
    calleeId: string;
    caller: { firstName: string; lastName: string };
  }): Promise<void> {
    await this.notificationService.createNotification({
      type: 'CALL_MISSED',
      content: `Appel manqué de ${call.caller.firstName} ${call.caller.lastName}`,
      userId: call.calleeId,
    });
  }

  /**
   * Journal des appels de l'utilisateur, le plus récent en tête.
   *
   * La durée est calculée ici plutôt que stockée : elle se déduit des deux
   * horodatages, la dupliquer en base ouvrirait la porte à une incohérence.
   */
  async listMine(userId: string, take = 50) {
    const calls = await this.prisma.call.findMany({
      where: { OR: [{ callerId: userId }, { calleeId: userId }] },
      include: CALL_INCLUDE,
      orderBy: { startedAt: 'desc' },
      take,
    });

    return calls.map((call) => ({
      ...call,
      outgoing: call.callerId === userId,
      durationSeconds:
        call.answeredAt && call.endedAt
          ? Math.max(
              0,
              Math.round(
                (call.endedAt.getTime() - call.answeredAt.getTime()) / 1000,
              ),
            )
          : 0,
    }));
  }
}

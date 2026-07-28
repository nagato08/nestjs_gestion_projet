/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/require-await */
import { Global, Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { DefaultEventsMap, Server, Socket } from 'socket.io';
import { SocketService } from './socket/socket.service';
import { PrismaService } from './prisma.service';
import { ProjectAccessService } from './common/access/project-access.service';
import { getCorsOptions } from './common/cors.config';

/** Données attachées à la socket après authentification du handshake. */
interface SocketData {
  userId?: string;
}

type AuthSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  SocketData
>;

@Global()
@WebSocketGateway({
  // Mêmes origines que l'API HTTP. Note : le CORS ne protège que les
  // navigateurs — la vraie barrière est l'authentification du handshake.
  cors: getCorsOptions(),
  namespace: '/',
})
export class AppGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleInit
{
  private readonly logger = new Logger(AppGateway.name);

  /**
   * Sockets ouvertes par utilisateur.
   *
   * Un même compte peut avoir plusieurs onglets ou appareils : on compte les
   * connexions plutôt que de stocker un booléen, sinon fermer un onglet
   * ferait apparaître l'utilisateur hors ligne alors qu'il est toujours là.
   */
  private readonly onlineUsers = new Map<string, Set<string>>();

  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private socketService: SocketService,
    private prisma: PrismaService,
    private projectAccess: ProjectAccessService,
    private jwtService: JwtService,
  ) {}

  afterInit() {
    this.socketService.server = this.server;
  }

  onModuleInit() {
    this.server.emit('confirmation');
  }

  /**
   * Authentifie la connexion WebSocket.
   *
   * Le JWT est vérifié au handshake et l'identité qui en découle est stockée
   * sur la socket. Tous les handlers s'appuient dessus : l'identifiant fourni
   * par le client dans les messages n'est jamais une source d'autorité, sinon
   * n'importe qui pourrait se faire passer pour un autre utilisateur.
   */
  handleConnection(socket: AuthSocket) {
    const token = this.extractToken(socket);

    if (!token) {
      this.logger.warn('Connexion WebSocket sans jeton : rejetée');
      socket.emit('error', { message: 'Authentification requise' });
      socket.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<{ sub: string }>(token);
      socket.data.userId = payload.sub;
      // Room personnelle : les notifications n'exigent plus d'événement client.
      socket.join(`user:${payload.sub}`);
      this.markOnline(payload.sub, socket.id);
    } catch {
      this.logger.warn('Connexion WebSocket avec jeton invalide : rejetée');
      socket.emit('error', { message: 'Jeton invalide ou expiré' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: AuthSocket) {
    const userId = this.getUserId(socket);
    if (userId) this.markOffline(userId, socket.id);
  }

  /**
   * Enregistre une connexion et annonce l'arrivée si c'est la première.
   * Les connexions suivantes du même compte ne rediffusent rien.
   */
  private markOnline(userId: string, socketId: string) {
    const sockets = this.onlineUsers.get(userId) ?? new Set<string>();
    const wasOffline = sockets.size === 0;
    sockets.add(socketId);
    this.onlineUsers.set(userId, sockets);

    if (wasOffline) {
      this.server.emit('presence:online', { userId });
    }
  }

  /** Retire une connexion ; l'utilisateur passe hors ligne à la dernière. */
  private markOffline(userId: string, socketId: string) {
    const sockets = this.onlineUsers.get(userId);
    if (!sockets) return;

    sockets.delete(socketId);

    if (sockets.size === 0) {
      this.onlineUsers.delete(userId);
      this.server.emit('presence:offline', { userId });
    }
  }

  /** Liste des utilisateurs actuellement connectés. */
  private getOnlineUserIds(): string[] {
    return [...this.onlineUsers.keys()];
  }

  /**
   * Instantané de présence, demandé à l'ouverture d'une page : les événements
   * `presence:online` ne couvrent que les changements postérieurs à la
   * connexion, il faut donc un état initial.
   */
  @SubscribeMessage('presence:list')
  async listPresence(@ConnectedSocket() socket: AuthSocket) {
    if (!this.getUserId(socket)) return;
    socket.emit('presence:list', { userIds: this.getOnlineUserIds() });
  }

  /**
   * Récupère le jeton depuis le handshake, quel que soit l'emplacement
   * utilisé par le client (`auth.token`, en-tête Authorization, ou query).
   */
  private extractToken(socket: AuthSocket): string | null {
    const raw =
      (socket.handshake.auth?.token as string | undefined) ??
      socket.handshake.headers.authorization ??
      (socket.handshake.query?.token as string | undefined);

    if (!raw) return null;
    return raw.startsWith('Bearer ') ? raw.slice(7) : raw;
  }

  /** Identité authentifiée de la socket, ou `null` si absente. */
  private getUserId(socket: AuthSocket): string | null {
    return socket.data?.userId ?? null;
  }

  /**
   * UTILITAIRE : Vérifie que l'utilisateur a accès au projet.
   *
   * Renvoie un booléen plutôt qu'une exception : côté WebSocket on répond par
   * un événement `error`, pas par un code HTTP.
   */
  private async verifyProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    try {
      const role = await this.projectAccess.getEffectiveRole(projectId, userId);
      return role !== null;
    } catch {
      // Projet introuvable ou supprimé.
      return false;
    }
  }

  @SubscribeMessage('test')
  async sendMessage(
    @MessageBody() data,
    @ConnectedSocket() socket: AuthSocket,
  ) {
    this.logger.debug(data);
    socket.emit('chat', "Salut j'ai bien reçu ton message");
  }

  @SubscribeMessage('join-chat-room')
  async joinChatRoom(
    @MessageBody() conversationId: string,
    @ConnectedSocket() socket: AuthSocket,
  ) {
    const userId = this.getUserId(socket);
    if (!conversationId || !userId) return;

    // Une conversation appartient à un projet : on exige d'en être membre,
    // sinon n'importe qui pourrait écouter la room d'un projet fermé.
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { projectId: true },
    });

    if (!conversation) {
      socket.emit('error', { message: 'Conversation introuvable' });
      return;
    }

    const isMember = await this.verifyProjectMembership(
      conversation.projectId,
      userId,
    );
    if (!isMember) {
      socket.emit('error', { message: "Vous n'avez pas accès à ce projet" });
      return;
    }

    socket.join(conversationId);
  }

  @SubscribeMessage('join-user-room')
  async joinUserRoom(@ConnectedSocket() socket: AuthSocket) {
    // La room personnelle est déjà rejointe au handshake ; on se contente de
    // confirmer. L'identifiant vient du jeton, jamais du message client.
    const userId = this.getUserId(socket);
    if (userId) {
      socket.join(`user:${userId}`);
      socket.emit('joined-user-room', { userId });
    }
  }

  @SubscribeMessage('join-project-room')
  async joinProjectRoom(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() socket: AuthSocket,
  ) {
    const { projectId } = data;
    const userId = this.getUserId(socket);

    if (!projectId || !userId) {
      socket.emit('error', {
        message: 'projectId requis et connexion authentifiée',
      });
      return;
    }

    // Vérifier que l'utilisateur est membre du projet
    const isMember = await this.verifyProjectMembership(projectId, userId);

    if (!isMember) {
      socket.emit('error', {
        message: "Vous n'êtes pas membre de ce projet",
      });
      return;
    }

    // Rejoindre la room du projet pour recevoir le chat
    socket.join(`project:${projectId}`);
    socket.emit('joined-project-room', { projectId });

    // Historique du chat projet (Conversation / ChatMessage). Prisma client pas régénéré (projectId sur Conversation).
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */
    const conversation = await this.prisma.conversation.findUnique({
      where: { projectId } as any,
      select: {
        id: true,
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
          orderBy: { createdAt: 'asc' as const },
          take: 100,
        },
      },
    } as any);
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

    const messages =
      (conversation as { messages?: unknown[] } | null)?.messages ?? [];
    socket.emit('project-chat-history', {
      projectId,
      messages,
    });
  }

  @SubscribeMessage('leave-project-room')
  async leaveProjectRoom(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() socket: AuthSocket,
  ) {
    const { projectId } = data;
    if (projectId) {
      socket.leave(`project:${projectId}`);
      socket.emit('left-project-room', { projectId });
    }
  }

  @SubscribeMessage('user:typing')
  async handleTypingStart(
    @MessageBody()
    data: { projectId: string; userName?: string },
    @ConnectedSocket() socket: AuthSocket,
  ) {
    const { projectId, userName } = data;
    const userId = this.getUserId(socket);

    if (!projectId || !userId) {
      return;
    }

    const isMember = await this.verifyProjectMembership(projectId, userId);
    if (!isMember) {
      return;
    }

    socket.to(`project:${projectId}`).emit('user:typing', {
      projectId,
      userId,
      userName,
    });
  }

  @SubscribeMessage('user:stopped-typing')
  async handleTypingStop(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() socket: AuthSocket,
  ) {
    const { projectId } = data;
    const userId = this.getUserId(socket);

    if (!projectId || !userId) {
      return;
    }

    const isMember = await this.verifyProjectMembership(projectId, userId);
    if (!isMember) {
      return;
    }

    socket.to(`project:${projectId}`).emit('user:stopped-typing', {
      projectId,
      userId,
    });
  }

  @SubscribeMessage('connection')
  async sendConfirm(@ConnectedSocket() socket: AuthSocket) {
    socket.emit('confirmation');
  }
}

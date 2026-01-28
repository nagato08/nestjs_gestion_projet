/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/require-await */
import { Global, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SocketService } from './socket/socket.service';
import { PrismaService } from './prisma.service';

@Global()
@WebSocketGateway({
  cors: '*',
  namespace: '/',
})
export class AppGateway implements OnGatewayInit, OnModuleInit {
  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private socketService: SocketService,
    private prisma: PrismaService,
  ) {}

  afterInit() {
    this.socketService.server = this.server;
  }

  onModuleInit() {
    this.server.emit('confirmation');
  }

  /**
   * UTILITAIRE : Vérifie que l'utilisateur est membre du projet
   */
  private async verifyProjectMembership(
    projectId: string,
    userId: string,
  ): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });

    if (!project) {
      return false;
    }

    return project.members.some((m) => m.userId === userId);
  }

  @SubscribeMessage('test')
  async sendMessage(@MessageBody() data, @ConnectedSocket() socket: Socket) {
    console.log(data);
    socket.emit('chat', "Salut j'ai bien reçu ton message");
  }

  @SubscribeMessage('join-chat-room')
  async joinChatRoom(
    @MessageBody() conversationId: string,
    @ConnectedSocket() socket: Socket,
  ) {
    console.log({ conversationId });
    socket.join(conversationId);
  }

  @SubscribeMessage('join-user-room')
  async joinUserRoom(
    @MessageBody() data: { userId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    // Rejoindre la room de l'utilisateur pour recevoir ses notifications
    const userId = data.userId || (socket.handshake.query.userId as string);
    if (userId) {
      socket.join(`user:${userId}`);
      socket.emit('joined-user-room', { userId });
    }
  }

  @SubscribeMessage('join-project-room')
  async joinProjectRoom(
    @MessageBody() data: { projectId: string; userId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { projectId, userId } = data;

    if (!projectId || !userId) {
      socket.emit('error', {
        message: 'projectId et userId sont requis',
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

    // Rejoindre la room du projet pour recevoir les messages
    socket.join(`project:${projectId}`);
    socket.emit('joined-project-room', { projectId });

    // Envoyer les messages récents du projet
    const messages = await this.prisma.message.findMany({
      where: { projectId },
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
      orderBy: { createdAt: 'desc' },
      take: 50, // Derniers 50 messages
    });

    socket.emit('project-messages-history', {
      projectId,
      messages: messages.reverse(), // Inverser pour avoir l'ordre chronologique
    });
  }

  @SubscribeMessage('leave-project-room')
  async leaveProjectRoom(
    @MessageBody() data: { projectId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { projectId } = data;
    if (projectId) {
      socket.leave(`project:${projectId}`);
      socket.emit('left-project-room', { projectId });
    }
  }

  @SubscribeMessage('typing-start')
  async handleTypingStart(
    @MessageBody()
    data: { projectId: string; userId: string; userName: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { projectId, userId, userName } = data;

    if (!projectId || !userId) {
      return;
    }

    // Vérifier que l'utilisateur est membre du projet
    const isMember = await this.verifyProjectMembership(projectId, userId);
    if (!isMember) {
      return;
    }

    // Notifier les autres membres du projet que quelqu'un tape
    socket.to(`project:${projectId}`).emit('user-typing', {
      projectId,
      userId,
      userName,
    });
  }

  @SubscribeMessage('typing-stop')
  async handleTypingStop(
    @MessageBody() data: { projectId: string; userId: string },
    @ConnectedSocket() socket: Socket,
  ) {
    const { projectId, userId } = data;

    if (!projectId || !userId) {
      return;
    }

    // Vérifier que l'utilisateur est membre du projet
    const isMember = await this.verifyProjectMembership(projectId, userId);
    if (!isMember) {
      return;
    }

    // Notifier que l'utilisateur a arrêté de taper
    socket.to(`project:${projectId}`).emit('user-stopped-typing', {
      projectId,
      userId,
    });
  }

  @SubscribeMessage('connection')
  async sendConfirm(@ConnectedSocket() socket: Socket) {
    socket.emit('confirmation');
  }
}

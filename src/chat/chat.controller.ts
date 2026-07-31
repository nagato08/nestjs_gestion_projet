import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
  Query,
} from '@nestjs/common';
import { PaginationDto } from 'src/common/pagination/pagination.dto';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { RequestWithUser } from 'src/auth/jwt.strategy';
import { ChatService } from './chat.service';
import { DirectMessageService } from './direct-message.service';
import { SendChatDto } from './dto/send-chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly directMessageService: DirectMessageService,
  ) {}

  // --- Messagerie directe ---
  //
  // Déclarée avant les routes `project/...` : sans importance ici, les
  // préfixes ne se recouvrent pas, mais garde les deux familles groupées.

  @UseGuards(JwtAuthGuard)
  @Get('direct')
  @ApiOperation({
    summary: 'Mes conversations directes, la plus active en tête',
  })
  async listDirectConversations(@Request() request: RequestWithUser) {
    return await this.directMessageService.listMyConversations(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('direct/directory')
  @ApiOperation({
    summary: 'Annuaire des personnes à qui écrire (identité seule)',
  })
  async listDirectory(@Request() request: RequestWithUser) {
    return await this.directMessageService.listDirectory(request.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('direct/with/:userId')
  @ApiOperation({
    summary: 'Ouvrir (ou retrouver) la conversation avec quelqu’un',
  })
  async openDirectConversation(
    @Param('userId') otherUserId: string,
    @Request() request: RequestWithUser,
  ) {
    return await this.directMessageService.openDirectConversation(
      request.user.id,
      otherUserId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('direct/:conversationId')
  @ApiOperation({ summary: 'Messages d’une conversation directe' })
  async getDirectMessages(
    @Param('conversationId') conversationId: string,
    @Request() request: RequestWithUser,
    @Query() pagination: PaginationDto,
  ) {
    return await this.directMessageService.getMessages({
      conversationId,
      userId: request.user.id,
      pagination,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('direct/:conversationId')
  @ApiOperation({ summary: 'Envoyer un message direct' })
  async sendDirectMessage(
    @Param('conversationId') conversationId: string,
    @Body() dto: SendChatDto,
    @Request() request: RequestWithUser,
  ) {
    return await this.directMessageService.sendMessage({
      conversationId,
      senderId: request.user.id,
      content: dto.content,
      attachments: dto.attachments,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('project/:projectId')
  @ApiOperation({ summary: 'Envoyer un message dans le chat du projet' })
  async sendProjectMessage(
    @Param('projectId') projectId: string,
    @Body() dto: SendChatDto,
    @Request() request: RequestWithUser,
  ) {
    return await this.chatService.sendProjectMessage({
      projectId,
      content: dto.content,
      senderId: request.user.id,
      mentions: dto.mentions,
      attachments: dto.attachments,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('project/:projectId')
  @ApiOperation({ summary: 'Récupérer la conversation (messages) du projet' })
  async getProjectConversation(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithUser,
    @Query() pagination: PaginationDto,
  ) {
    return await this.chatService.getProjectConversation({
      projectId,
      userId: request.user.id,
      pagination,
    });
  }
}

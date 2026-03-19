import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import type { RequestWithUser } from 'src/auth/jwt.strategy';
import { ChatService } from './chat.service';
import { SendChatDto } from './dto/send-chat.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

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
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('project/:projectId')
  @ApiOperation({ summary: 'Récupérer la conversation (messages) du projet' })
  async getProjectConversation(
    @Param('projectId') projectId: string,
    @Request() request: RequestWithUser,
  ) {
    return await this.chatService.getProjectConversation({
      projectId,
      userId: request.user.id,
    });
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MessageService } from './message.service';
import { CreateMessageDto } from './dto/create-message.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  // 1️⃣ Créer un message dans un projet
  @Post('project/:projectId')
  @ApiOperation({ summary: 'Créer un message dans un projet' })
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messageService.createMessage(
      projectId,
      req.user.id,
      createMessageDto,
    );
  }

  // 2️⃣ Récupérer tous les messages d'un projet
  @Get('project/:projectId')
  @ApiOperation({ summary: "Récupérer tous les messages d'un projet" })
  getMessagesByProject(@Param('projectId') projectId: string, @Req() req: any) {
    return this.messageService.getMessagesByProject(projectId, req.user.id);
  }

  // 3️⃣ Récupérer un message par ID
  @Get(':id')
  @ApiOperation({ summary: 'Récupérer un message par ID' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.messageService.getMessageById(id, req.user.id);
  }

  // 4️⃣ Supprimer un message
  @Delete(':id')
  @ApiOperation({ summary: 'Supprimer un message' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.messageService.deleteMessage(id, req.user.id);
  }
}

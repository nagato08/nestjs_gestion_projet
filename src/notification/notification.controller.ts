/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  // 1️⃣ Créer une notification (pour les admins ou système)
  @Post()
  @ApiOperation({ title: 'Créer une notification' })
  create(@Body() createNotificationDto: CreateNotificationDto) {
    return this.notificationService.createNotification(createNotificationDto);
  }

  // 2️⃣ Récupérer mes notifications
  @Get()
  @ApiOperation({ title: 'Récupérer mes notifications' })
  getMyNotifications(
    @Req() req: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    const unread = unreadOnly === 'true';
    return this.notificationService.getMyNotifications(req.user.id, unread);
  }

  // 3️⃣ Compter les notifications non lues
  @Get('unread-count')
  @ApiOperation({ title: 'Compter mes notifications non lues' })
  getUnreadCount(@Req() req: any) {
    return this.notificationService.getUnreadCount(req.user.id);
  }

  // 4️⃣ Marquer une notification comme lue
  @Patch(':id/read')
  @ApiOperation({ title: 'Marquer une notification comme lue' })
  markAsRead(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.markAsRead(id, req.user.id);
  }

  // 5️⃣ Marquer toutes les notifications comme lues
  @Patch('read-all')
  @ApiOperation({ title: 'Marquer toutes mes notifications comme lues' })
  markAllAsRead(@Req() req: any) {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  // 6️⃣ Supprimer une notification
  @Delete(':id')
  @ApiOperation({ title: 'Supprimer une notification' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.notificationService.deleteNotification(id, req.user.id);
  }
}

/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { NotificationSettingsService } from './notification-settings.service';
import { UpdateNotificationSettingsDto } from './dto/update-notification-settings.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notification-settings')
export class NotificationSettingsController {
  constructor(
    private readonly notificationSettingsService: NotificationSettingsService,
  ) {}

  // 1️⃣ Récupérer mes paramètres de notification
  @Get()
  @ApiOperation({ summary: 'Récupérer mes paramètres de notification' })
  getMyNotificationSettings(@Req() req: any) {
    return this.notificationSettingsService.getMyNotificationSettings(
      req.user.id,
    );
  }

  // 2️⃣ Mettre à jour mes paramètres de notification
  @Patch()
  @ApiOperation({ summary: 'Mettre à jour mes paramètres de notification' })
  updateMyNotificationSettings(
    @Req() req: any,
    @Body() updateNotificationSettingsDto: UpdateNotificationSettingsDto,
  ) {
    return this.notificationSettingsService.updateNotificationSettings(
      req.user.id,
      updateNotificationSettingsDto,
    );
  }

  // 3️⃣ Récupérer les paramètres d'un utilisateur (Admin uniquement)
  @Get(':userId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary:
      "Récupérer les paramètres de notification d'un utilisateur (Admin uniquement)",
  })
  getUserNotificationSettings(
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.notificationSettingsService.getUserNotificationSettings(
      userId,
      req.user.id,
    );
  }
}

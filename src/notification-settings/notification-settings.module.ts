import { Module } from '@nestjs/common';
import { NotificationSettingsController } from './notification-settings.controller';
import { NotificationSettingsService } from './notification-settings.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [NotificationSettingsController],
  providers: [NotificationSettingsService, PrismaService],
  exports: [NotificationSettingsService],
})
export class NotificationSettingsModule {}

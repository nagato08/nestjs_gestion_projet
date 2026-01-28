import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationHelperService } from './notification-helper.service';
import { PrismaService } from 'src/prisma.service';
import { SocketModule } from 'src/socket/socket.module';

@Module({
  imports: [SocketModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationHelperService, PrismaService],
  exports: [NotificationService, NotificationHelperService],
})
export class NotificationModule {}

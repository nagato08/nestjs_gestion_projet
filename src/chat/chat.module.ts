import { Module } from '@nestjs/common';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { DirectMessageService } from './direct-message.service';
import { PrismaService } from 'src/prisma.service';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [NotificationModule],
  controllers: [ChatController],
  providers: [ChatService, DirectMessageService, PrismaService],
})
export class ChatModule {}

import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { PrismaService } from 'src/prisma.service';
import { SocketModule } from 'src/socket/socket.module';

@Module({
  imports: [SocketModule],
  controllers: [MessageController],
  providers: [MessageService, PrismaService],
  exports: [MessageService],
})
export class MessageModule {}

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AppGateway } from './app.gateway';
import { ChatModule } from './chat/chat.module';
import { SocketModule } from './socket/socket.module';
import { ProjectModule } from './project/project.module';
import { TacheModule } from './tache/tache.module';
import { DocumentModule } from './document/document.module';
import { MessageModule } from './message/message.module';
import { NotificationModule } from './notification/notification.module';
import { TimeEntryModule } from './time-entry/time-entry.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    AuthModule,
    ChatModule,
    SocketModule,
    ProjectModule,
    TacheModule,
    DocumentModule,
    MessageModule,
    NotificationModule,
    TimeEntryModule,
    CompanySettingsModule,
    NotificationSettingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppGateway, PrismaService],
})
export class AppModule {}

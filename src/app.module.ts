import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { PlanningModule } from './planning/planning.module';
import { PrismaService } from './prisma.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AiModule } from './ai/ai.module';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        ttl: 60_000, // 1 minute
        limit: 10, // 10 requêtes max par minute par IP
      },
    ]),
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
    PlanningModule,
    AiModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    AppGateway,
    PrismaService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- provider Nest
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}

import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AppGateway } from './app.gateway';
import { ChatModule } from './chat/chat.module';
import { SocketModule } from './socket/socket.module';
import { ProjectModule } from './project/project.module';
import { TacheModule } from './tache/tache.module';
import { DocumentModule } from './document/document.module';
import { NotificationModule } from './notification/notification.module';
import { TimeEntryModule } from './time-entry/time-entry.module';
import { CompanySettingsModule } from './company-settings/company-settings.module';
import { ProjectSettingsModule } from './project-settings/project-settings.module';
import { ProjectIssueModule } from './project-issue/project-issue.module';
import { StatusReportModule } from './status-report/status-report.module';
import { NotificationSettingsModule } from './notification-settings/notification-settings.module';
import { PlanningModule } from './planning/planning.module';
import { SearchModule } from './search/search.module';
import { PrismaService } from './prisma.service';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AccessModule } from './common/access/access.module';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { AuditModule } from './common/audit/audit.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { RequestIdMiddleware } from './common/logging/request-id.middleware';
import { AiModule } from './ai/ai.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 20 },
      { name: 'medium', ttl: 10_000, limit: 100 },
      { name: 'long', ttl: 60_000, limit: 300 },
    ]),
    AccessModule,
    AuditModule,
    AuthModule,
    ChatModule,
    SocketModule,
    ProjectModule,
    TacheModule,
    ProjectSettingsModule,
    ProjectIssueModule,
    StatusReportModule,
    DocumentModule,
    NotificationModule,
    TimeEntryModule,
    CompanySettingsModule,
    NotificationSettingsModule,
    PlanningModule,
    SearchModule,
    AiModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    AppGateway,
    PrismaService,
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },

    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // En tête de chaîne : toutes les requêtes doivent porter un identifiant
    // de corrélation, y compris celles qui échouent plus loin.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

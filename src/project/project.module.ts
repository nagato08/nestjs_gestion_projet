import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { InvitationController } from './invitation.controller';
import { InvitationService } from './invitation.service';
import { TemplateController } from './template.controller';
import { TemplateService } from './template.service';
import { PrismaService } from 'src/prisma.service';
import { NotificationModule } from 'src/notification/notification.module';
import { MailerService } from 'src/mailer.service';

@Module({
  imports: [NotificationModule],
  controllers: [ProjectController, InvitationController, TemplateController],
  providers: [
    ProjectService,
    InvitationService,
    TemplateService,
    PrismaService,
    MailerService,
  ],
})
export class ProjectModule {}

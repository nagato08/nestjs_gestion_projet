import { Module } from '@nestjs/common';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { PrismaService } from 'src/prisma.service';
import { NotificationModule } from 'src/notification/notification.module';
import { MailerService } from 'src/mailer.service';

@Module({
  imports: [NotificationModule],
  controllers: [ProjectController],
  providers: [ProjectService, PrismaService, MailerService],
})
export class ProjectModule {}

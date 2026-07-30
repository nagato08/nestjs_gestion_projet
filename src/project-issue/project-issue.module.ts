import { Module } from '@nestjs/common';
import { ProjectIssueController } from './project-issue.controller';
import { ProjectIssueService } from './project-issue.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ProjectIssueController],
  providers: [ProjectIssueService, PrismaService],
  exports: [ProjectIssueService],
})
export class ProjectIssueModule {}

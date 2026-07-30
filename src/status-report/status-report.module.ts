import { Module } from '@nestjs/common';
import { StatusReportController } from './status-report.controller';
import { StatusReportService } from './status-report.service';
import { PrismaService } from 'src/prisma.service';
import { PlanningModule } from 'src/planning/planning.module';
import { ProjectIssueModule } from 'src/project-issue/project-issue.module';

@Module({
  imports: [PlanningModule, ProjectIssueModule],
  controllers: [StatusReportController],
  providers: [StatusReportService, PrismaService],
})
export class StatusReportModule {}

import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { GanttService } from './gantt.service';
import { PertService } from './pert.service';
import { DashboardService } from './dashboard.service';
import { BurndownService } from './burndown.service';
import { WorkloadService } from './workload.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [PlanningController],
  providers: [
    GanttService,
    PertService,
    DashboardService,
    BurndownService,
    WorkloadService,
    PrismaService,
  ],
  exports: [
    GanttService,
    PertService,
    DashboardService,
    BurndownService,
    WorkloadService,
  ],
})
export class PlanningModule {}

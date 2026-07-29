import { Module } from '@nestjs/common';
import { PlanningController } from './planning.controller';
import { GanttService } from './gantt.service';
import { PertService } from './pert.service';
import { DashboardService } from './dashboard.service';
import { BurndownService } from './burndown.service';
import { WorkloadService } from './workload.service';
import { ScheduleService } from './schedule.service';
import { SprintService } from './sprint.service';
import { MilestoneService } from './milestone.service';
import { PhaseService } from './phase.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [PlanningController],
  providers: [
    GanttService,
    PertService,
    DashboardService,
    BurndownService,
    WorkloadService,
    ScheduleService,
    SprintService,
    MilestoneService,
    PhaseService,
    PrismaService,
  ],
  exports: [
    GanttService,
    PertService,
    DashboardService,
    BurndownService,
    WorkloadService,
    ScheduleService,
    SprintService,
    MilestoneService,
    PhaseService,
  ],
})
export class PlanningModule {}

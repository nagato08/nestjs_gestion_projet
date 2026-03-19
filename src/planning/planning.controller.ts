import { Controller, Get, Query, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { GanttService } from './gantt.service';
import { PertService } from './pert.service';
import { DashboardService } from './dashboard.service';
import { BurndownService } from './burndown.service';
import { WorkloadService } from './workload.service';

@ApiTags('Planning')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('planning')
export class PlanningController {
  constructor(
    private readonly ganttService: GanttService,
    private readonly pertService: PertService,
    private readonly dashboardService: DashboardService,
    private readonly burndownService: BurndownService,
    private readonly workloadService: WorkloadService,
  ) {}

  /** Gantt : données pour la vue calendrier (barres par tâche). Drag & drop = PATCH /tache/:id avec startDate/endDate. */
  @Get('projects/:projectId/gantt')
  @ApiOperation({ summary: 'Données Gantt du projet' })
  getGantt(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.ganttService.getGanttData(projectId, req.user.id);
  }

  /** PERT : nœuds, arêtes, chemin critique et te = (o+4m+p)/6. */
  @Get('projects/:projectId/pert')
  @ApiOperation({ summary: 'Données PERT et chemin critique' })
  getPert(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.pertService.getPertData(projectId, req.user.id);
  }

  /** Donut : répartition des tâches (À faire / En cours / Terminé). */
  @Get('projects/:projectId/dashboard/status-donut')
  @ApiOperation({ summary: 'Donut des statuts du projet' })
  getStatusDonut(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.dashboardService.getStatusDonut(projectId, req.user.id);
  }

  /** Matrice Eisenhower : 4 quadrants Urgent/Important. */
  @Get('projects/:projectId/dashboard/eisenhower')
  @ApiOperation({ summary: 'Matrice Eisenhower du projet' })
  getEisenhower(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.dashboardService.getEisenhowerMatrix(projectId, req.user.id);
  }

  /** Burndown : travail restant vs temps (idéal vs réel). */
  @Get('projects/:projectId/burndown')
  @ApiOperation({ summary: 'Données Burndown du projet' })
  getBurndown(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.burndownService.getBurndownData(
      projectId,
      req.user.id,
      startDate,
      endDate,
    );
  }

  /** Charge : heures par employé par jour/semaine. Seuil 40h/semaine pour alerte. */
  @Get('workload')
  @ApiOperation({ summary: 'Histogramme de charge (workload)' })
  getWorkload(
    @Req() req: { user: { id: string } },
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('projectId') projectId?: string,
    @Query('groupBy') groupBy?: 'day' | 'week',
  ) {
    return this.workloadService.getWorkload(
      req.user.id,
      startDate,
      endDate,
      projectId,
      groupBy === 'week' ? 'week' : 'day',
    );
  }
}

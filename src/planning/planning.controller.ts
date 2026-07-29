import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Audit } from 'src/common/audit/audit.decorator';
import { GanttService } from './gantt.service';
import { PertService } from './pert.service';
import { DashboardService } from './dashboard.service';
import { BurndownService } from './burndown.service';
import { WorkloadService } from './workload.service';
import { ScheduleService } from './schedule.service';
import { SprintService } from './sprint.service';
import { MilestoneService } from './milestone.service';
import { PhaseService } from './phase.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { RescheduleTaskDto } from './dto/reschedule-task.dto';
import { AssignSprintTasksDto } from './dto/assign-sprint-tasks.dto';

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
    private readonly scheduleService: ScheduleService,
    private readonly sprintService: SprintService,
    private readonly milestoneService: MilestoneService,
    private readonly phaseService: PhaseService,
  ) {}

  // ---------------------------------------------------------------
  // Replanification (Gantt interactif)
  // ---------------------------------------------------------------

  /**
   * Déplace une tâche et répercute sur les tâches bloquées.
   *
   * Remplace le `PATCH /tasks/:id` utilisé jusqu'ici pour le drag & drop, qui
   * écrivait deux dates sans tenir compte des dépendances.
   */
  @Patch('tasks/:taskId/schedule')
  @Audit({
    action: 'task.reschedule',
    targetType: 'Task',
    targetId: (req) => (req.params as Record<string, string>)?.taskId,
    metadata: (req, result) => ({
      startDate: (req.body as RescheduleTaskDto)?.startDate,
      endDate: (req.body as RescheduleTaskDto)?.endDate,
      cascadedCount: (result as { cascadedCount?: number })?.cascadedCount,
    }),
  })
  @ApiOperation({
    summary:
      'Replanifier une tâche avec propagation aux dépendances (ADMIN projet)',
  })
  rescheduleTask(
    @Param('taskId') taskId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: RescheduleTaskDto,
  ) {
    return this.scheduleService.rescheduleTask(
      taskId,
      req.user.id,
      dto.startDate,
      dto.endDate,
    );
  }

  /** Fige les dates courantes comme référence de comparaison. */
  @Post('projects/:projectId/baseline')
  @Audit({ action: 'project.baseline.set', targetType: 'Project' })
  @ApiOperation({
    summary: 'Enregistrer la référence de planning (ADMIN projet)',
  })
  setBaseline(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.scheduleService.setBaseline(projectId, req.user.id);
  }

  // ---------------------------------------------------------------
  // Sprints
  // ---------------------------------------------------------------

  @Get('projects/:projectId/sprints')
  @ApiOperation({ summary: 'Sprints du projet avec avancement' })
  listSprints(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.sprintService.list(projectId, req.user.id);
  }

  @Post('projects/:projectId/sprints')
  @Audit({
    action: 'sprint.create',
    targetType: 'Project',
    metadata: (req) => ({ name: (req.body as CreateSprintDto)?.name }),
  })
  @ApiOperation({ summary: 'Créer un sprint (ADMIN projet)' })
  createSprint(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: CreateSprintDto,
  ) {
    return this.sprintService.create(projectId, req.user.id, dto);
  }

  @Patch('projects/:projectId/sprints/:sprintId')
  @Audit({
    action: 'sprint.update',
    targetType: 'Project',
    metadata: (req) => ({
      sprintId: (req.params as Record<string, string>)?.sprintId,
      status: (req.body as UpdateSprintDto)?.status,
    }),
  })
  @ApiOperation({ summary: 'Modifier un sprint (ADMIN projet)' })
  updateSprint(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateSprintDto,
  ) {
    return this.sprintService.update(projectId, sprintId, req.user.id, dto);
  }

  @Delete('projects/:projectId/sprints/:sprintId')
  @Audit({
    action: 'sprint.delete',
    targetType: 'Project',
    metadata: (req) => ({
      sprintId: (req.params as Record<string, string>)?.sprintId,
    }),
  })
  @ApiOperation({ summary: 'Supprimer un sprint (ADMIN projet)' })
  deleteSprint(
    @Param('projectId') projectId: string,
    @Param('sprintId') sprintId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.sprintService.remove(projectId, sprintId, req.user.id);
  }

  @Patch('projects/:projectId/sprints/tasks/assign')
  @Audit({
    action: 'sprint.tasks.assign',
    targetType: 'Project',
    metadata: (req) => ({
      sprintId: (req.body as AssignSprintTasksDto)?.sprintId,
      taskCount: (req.body as AssignSprintTasksDto)?.taskIds?.length,
    }),
  })
  @ApiOperation({
    summary: 'Rattacher des tâches à un sprint, ou les renvoyer au backlog',
  })
  assignSprintTasks(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: AssignSprintTasksDto,
  ) {
    return this.sprintService.assignTasks(
      projectId,
      req.user.id,
      dto.taskIds,
      dto.sprintId ?? null,
    );
  }

  // ---------------------------------------------------------------
  // Jalons
  // ---------------------------------------------------------------

  @Get('projects/:projectId/milestones')
  @ApiOperation({ summary: 'Jalons du projet' })
  listMilestones(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.milestoneService.list(projectId, req.user.id);
  }

  @Post('projects/:projectId/milestones')
  @Audit({
    action: 'milestone.create',
    targetType: 'Project',
    metadata: (req) => ({ name: (req.body as CreateMilestoneDto)?.name }),
  })
  @ApiOperation({ summary: 'Créer un jalon (ADMIN projet)' })
  createMilestone(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.milestoneService.create(projectId, req.user.id, dto);
  }

  @Patch('projects/:projectId/milestones/:milestoneId')
  @Audit({
    action: 'milestone.update',
    targetType: 'Project',
    metadata: (req) => ({
      milestoneId: (req.params as Record<string, string>)?.milestoneId,
      reached: (req.body as UpdateMilestoneDto)?.reached,
    }),
  })
  @ApiOperation({ summary: 'Modifier un jalon (ADMIN projet)' })
  updateMilestone(
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: UpdateMilestoneDto,
  ) {
    return this.milestoneService.update(
      projectId,
      milestoneId,
      req.user.id,
      dto,
    );
  }

  @Delete('projects/:projectId/milestones/:milestoneId')
  @Audit({
    action: 'milestone.delete',
    targetType: 'Project',
    metadata: (req) => ({
      milestoneId: (req.params as Record<string, string>)?.milestoneId,
    }),
  })
  @ApiOperation({ summary: 'Supprimer un jalon (ADMIN projet)' })
  deleteMilestone(
    @Param('projectId') projectId: string,
    @Param('milestoneId') milestoneId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.milestoneService.remove(projectId, milestoneId, req.user.id);
  }

  // --- Feuille de route : phases macro du projet ---

  @Get('projects/:projectId/phases')
  @ApiOperation({ summary: 'Phases du projet (feuille de route)' })
  listPhases(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.phaseService.list(projectId, req.user.id);
  }

  @Post('projects/:projectId/phases')
  @Audit({
    action: 'phase.create',
    targetType: 'Project',
    metadata: (req) => ({ name: (req.body as CreatePhaseDto)?.name }),
  })
  @ApiOperation({ summary: 'Créer une phase (ADMIN projet)' })
  createPhase(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: CreatePhaseDto,
  ) {
    return this.phaseService.create(projectId, req.user.id, dto);
  }

  @Patch('projects/:projectId/phases/:phaseId')
  @Audit({
    action: 'phase.update',
    targetType: 'Project',
    metadata: (req) => ({
      phaseId: (req.params as Record<string, string>)?.phaseId,
    }),
  })
  @ApiOperation({ summary: 'Modifier une phase (ADMIN projet)' })
  updatePhase(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: UpdatePhaseDto,
  ) {
    return this.phaseService.update(projectId, phaseId, req.user.id, dto);
  }

  @Delete('projects/:projectId/phases/:phaseId')
  @Audit({
    action: 'phase.delete',
    targetType: 'Project',
    metadata: (req) => ({
      phaseId: (req.params as Record<string, string>)?.phaseId,
    }),
  })
  @ApiOperation({ summary: 'Supprimer une phase (ADMIN projet)' })
  deletePhase(
    @Param('projectId') projectId: string,
    @Param('phaseId') phaseId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.phaseService.remove(projectId, phaseId, req.user.id);
  }

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
    @Query('sprintId') sprintId?: string,
  ) {
    return this.burndownService.getBurndownData(
      projectId,
      req.user.id,
      startDate,
      endDate,
      sprintId,
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

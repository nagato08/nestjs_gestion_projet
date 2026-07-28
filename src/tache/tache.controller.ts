/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Put,
  Param,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TacheService } from './tache.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignTaskDto } from './dto/assign-task.dto';
import { CreateTaskDependencyDto } from './dto/create-task-dependency.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { ChangeTaskStatusDto } from './dto/change-task-status.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { SetRecurrenceDto } from './dto/set-recurrence.dto';
import { ChecklistService } from './checklist.service';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Audit } from 'src/common/audit/audit.decorator';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TacheController {
  constructor(
    private readonly tacheService: TacheService,
    private readonly checklistService: ChecklistService,
  ) {}

  // 1️⃣ Créer une tâche
  @Post()
  @Audit({
    action: 'task.create',
    targetType: 'Task',
    // L'identifiant n'existe qu'une fois la tâche créée : on le lit dans la réponse.
    targetId: (_req, result) => (result as { id?: string })?.id,
    metadata: (req) => ({
      title: (req.body as CreateTaskDto)?.title,
      projectId: (req.body as CreateTaskDto)?.projectId,
      priority: (req.body as CreateTaskDto)?.priority,
    }),
  })
  @ApiOperation({ summary: 'Créer une nouvelle tâche' })
  create(@Req() req: any, @Body() createTaskDto: CreateTaskDto) {
    return this.tacheService.createTask(req.user.id, createTaskDto);
  }

  // 2️⃣ Récupérer toutes les tâches d'un projet (pour Kanban)
  @Get('project/:projectId')
  @ApiOperation({
    summary: "Récupérer toutes les tâches d'un projet (pour tableau Kanban)",
  })
  getTasksByProject(@Param('projectId') projectId: string, @Req() req: any) {
    return this.tacheService.getTasksByProject(projectId, req.user.id);
  }

  // 3️⃣ Récupérer mes tâches assignées
  @Get('my-tasks')
  @ApiOperation({ summary: 'Récupérer toutes mes tâches assignées' })
  getMyTasks(@Req() req: any) {
    return this.tacheService.getMyTasks(req.user.id);
  }

  // 4️⃣ Récupérer une tâche par ID
  @Get(':id')
  @ApiOperation({ summary: "Récupérer les détails d'une tâche" })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.tacheService.getTaskById(id, req.user.id);
  }

  // 5️⃣ Mettre à jour une tâche
  @Patch(':id')
  @Audit({
    action: 'task.update',
    targetType: 'Task',
    metadata: (req) => ({
      fields: Object.keys((req.body as object) ?? {}),
    }),
  })
  @ApiOperation({ summary: 'Mettre à jour une tâche' })
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateTaskDto: UpdateTaskDto,
  ) {
    return this.tacheService.updateTask(id, req.user.id, updateTaskDto);
  }

  // 6️⃣ Supprimer une tâche
  @Delete(':id')
  @Audit({ action: 'task.delete', targetType: 'Task' })
  @ApiOperation({ summary: 'Supprimer une tâche' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.tacheService.deleteTask(id, req.user.id);
  }

  // 7️⃣ Changer le statut d'une tâche (pour Kanban)
  @Patch(':id/status')
  @Audit({
    action: 'task.status.update',
    targetType: 'Task',
    metadata: (req) => ({
      status: (req.body as ChangeTaskStatusDto)?.status,
    }),
  })
  @ApiOperation({
    summary: "Changer le statut d'une tâche (TODO → DOING → DONE)",
  })
  changeStatus(
    @Param('id') id: string,
    @Req() req: any,
    @Body() changeTaskStatusDto: ChangeTaskStatusDto,
  ) {
    return this.tacheService.changeTaskStatus(
      id,
      req.user.id,
      changeTaskStatusDto,
    );
  }

  // 8️⃣ Assigner des utilisateurs à une tâche
  @Post(':id/assign')
  @Audit({
    action: 'task.assign',
    targetType: 'Task',
    metadata: (req) => ({
      assignedUserIds: (req.body as AssignTaskDto)?.userIds,
    }),
  })
  @ApiOperation({
    summary: 'Assigner un ou plusieurs utilisateurs à une tâche',
  })
  assignUsers(
    @Param('id') id: string,
    @Req() req: any,
    @Body() assignTaskDto: AssignTaskDto,
  ) {
    return this.tacheService.assignUsersToTask(id, req.user.id, assignTaskDto);
  }

  // 9️⃣ Retirer un utilisateur d'une tâche
  @Delete(':id/assign/:userId')
  @Audit({
    action: 'task.unassign',
    targetType: 'Task',
    metadata: (req) => ({
      memberId: (req.params as Record<string, string>)?.userId,
    }),
  })
  @ApiOperation({ summary: "Retirer un utilisateur d'une tâche" })
  unassignUser(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Req() req: any,
  ) {
    return this.tacheService.unassignUserFromTask(id, req.user.id, userId);
  }

  // 🔟 Créer une dépendance entre tâches
  @Post(':id/dependencies')
  @Audit({
    action: 'task.dependency.create',
    targetType: 'Task',
    metadata: (req) => ({
      blockedTaskId: (req.body as CreateTaskDependencyDto)?.blockedTaskId,
    }),
  })
  @ApiOperation({
    summary: 'Créer une dépendance : cette tâche bloque une autre tâche',
  })
  createDependency(
    @Param('id') id: string,
    @Req() req: any,
    @Body() createTaskDependencyDto: CreateTaskDependencyDto,
  ) {
    return this.tacheService.createTaskDependency(
      id,
      req.user.id,
      createTaskDependencyDto,
    );
  }

  // 1️⃣1️⃣ Supprimer une dépendance
  @Delete(':id/dependencies/:blockedTaskId')
  @Audit({
    action: 'task.dependency.delete',
    targetType: 'Task',
    metadata: (req) => ({
      blockedTaskId: (req.params as Record<string, string>)?.blockedTaskId,
    }),
  })
  @ApiOperation({ summary: 'Supprimer une dépendance entre tâches' })
  deleteDependency(
    @Param('id') id: string,
    @Param('blockedTaskId') blockedTaskId: string,
    @Req() req: any,
  ) {
    return this.tacheService.deleteTaskDependency(
      id,
      blockedTaskId,
      req.user.id,
    );
  }

  // 1️⃣2️⃣ Créer un commentaire sur une tâche
  @Post(':id/comments')
  @ApiOperation({ summary: 'Ajouter un commentaire à une tâche' })
  createComment(
    @Param('id') id: string,
    @Req() req: any,
    @Body() createCommentDto: CreateCommentDto,
  ) {
    return this.tacheService.createComment(id, req.user.id, createCommentDto);
  }

  // 1️⃣3️⃣ Supprimer un commentaire
  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Supprimer un commentaire' })
  deleteComment(@Param('commentId') commentId: string, @Req() req: any) {
    return this.tacheService.deleteComment(commentId, req.user.id);
  }

  // ---------------------------------------------------------------
  // Liste de contrôle
  // ---------------------------------------------------------------

  @Get(':id/checklist')
  @ApiOperation({ summary: 'Éléments de la liste de contrôle' })
  listChecklist(@Param('id') id: string, @Req() req: any) {
    return this.checklistService.list(id, req.user.id);
  }

  @Post(':id/checklist')
  @ApiOperation({ summary: 'Ajouter un élément à la liste de contrôle' })
  addChecklistItem(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.checklistService.add(id, req.user.id, dto);
  }

  @Patch('checklist/:itemId')
  @ApiOperation({ summary: 'Cocher ou renommer un élément' })
  updateChecklistItem(
    @Param('itemId') itemId: string,
    @Req() req: any,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.checklistService.update(itemId, req.user.id, dto);
  }

  @Delete('checklist/:itemId')
  @ApiOperation({ summary: 'Supprimer un élément de la liste' })
  deleteChecklistItem(@Param('itemId') itemId: string, @Req() req: any) {
    return this.checklistService.remove(itemId, req.user.id);
  }

  // ---------------------------------------------------------------
  // Récurrence
  // ---------------------------------------------------------------

  @Put(':id/recurrence')
  @Audit({
    action: 'task.recurrence.set',
    targetType: 'Task',
    metadata: (req) => ({
      frequency: (req.body as SetRecurrenceDto)?.frequency,
      interval: (req.body as SetRecurrenceDto)?.interval ?? 1,
    }),
  })
  @ApiOperation({
    summary: 'Définir la récurrence d’une tâche (ADMIN projet)',
  })
  setRecurrence(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: SetRecurrenceDto,
  ) {
    return this.checklistService.setRecurrence(id, req.user.id, dto);
  }

  @Delete(':id/recurrence')
  @Audit({ action: 'task.recurrence.remove', targetType: 'Task' })
  @ApiOperation({ summary: 'Supprimer la récurrence (ADMIN projet)' })
  removeRecurrence(@Param('id') id: string, @Req() req: any) {
    return this.checklistService.removeRecurrence(id, req.user.id);
  }
}

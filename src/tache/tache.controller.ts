/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TacheController {
  constructor(private readonly tacheService: TacheService) {}

  // 1️⃣ Créer une tâche
  @Post()
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
  @ApiOperation({ summary: 'Supprimer une tâche' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.tacheService.deleteTask(id, req.user.id);
  }

  // 7️⃣ Changer le statut d'une tâche (pour Kanban)
  @Patch(':id/status')
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
}

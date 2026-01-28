/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { RemoveProjectMemberDto } from './dto/remove-project-member.dto';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // On garde les Guards ici (Jwt vérifie l'identité, RolesGuard vérifie les permissions)
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  // 1. SEULS ADMIN ET PM PEUVENT CRÉER
  @Post()
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @ApiOperation({ title: 'Créer un nouveau projet' })
  create(@Req() req: any, @Body() createProjectDto: CreateProjectDto) {
    return this.projectService.createProject(req.user.id, createProjectDto);
  }

  // 2. TOUT LE MONDE PEUT VOIR SES PROJETS
  @Get('my-projects')
  @ApiOperation({ title: 'Récupérer mes projets (membre ou owner)' })
  findMyProjects(@Req() req: any) {
    return this.projectService.getMyProjects(req.user.id);
  }

  // 3. TOUT LE MONDE PEUT VOIR UN PROJET (le service vérifiera s'il est membre)
  @Get(':id')
  @ApiOperation({ title: 'Détails d’un projet spécifique' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.projectService.getProjectById(id, req.user.id);
  }

  // 4. LE SERVICE VÉRIFIERA SI L'USER EST OWNER
  @Patch(':id')
  @ApiOperation({ title: 'Mettre à jour un projet (Owner uniquement)' })
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(id, req.user.id, updateProjectDto);
  }

  @Post(':id/members')
  @ApiOperation({ title: 'Ajouter un membre (Owner uniquement)' })
  addMember(
    @Param('id') id: string,
    @Req() req: any,
    @Body() addProjectMemberDto: AddProjectMemberDto,
  ) {
    return this.projectService.addMember(id, req.user.id, addProjectMemberDto);
  }

  @Delete(':id/members')
  @ApiOperation({ title: 'Retirer un membre (Owner uniquement)' })
  removeMember(
    @Param('id') id: string,
    @Req() req: any,
    @Body() removeProjectMemberDto: RemoveProjectMemberDto,
  ) {
    return this.projectService.removeMember(
      id,
      req.user.id,
      removeProjectMemberDto,
    );
  }

  // 5. TOUT LE MONDE PEUT REJOINDRE
  @Post('join/code')
  @ApiOperation({ title: 'Rejoindre via code' })
  joinByCode(@Body('projectCode') projectCode: string, @Req() req: any) {
    return this.projectService.joinByProjectCode(projectCode, req.user.id);
  }

  @Post('join/token')
  @ApiOperation({ title: 'Rejoindre via token' })
  joinByToken(@Body('inviteToken') inviteToken: string, @Req() req: any) {
    return this.projectService.joinByInviteToken(inviteToken, req.user.id);
  }

  @Patch(':id/regenerate-token')
  @ApiOperation({ title: 'Régénérer le token (Owner uniquement)' })
  regenerateToken(@Param('id') id: string, @Req() req: any) {
    return this.projectService.regenerateInviteToken(id, req.user.id);
  }

  // 🔟 Supprimer un projet (soft delete)
  @Delete(':id')
  @ApiOperation({
    title: 'Supprimer un projet (soft delete - Owner ou Admin uniquement)',
  })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.projectService.deleteProject(id, req.user.id);
  }
}

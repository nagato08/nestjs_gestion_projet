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
import { InvitationService } from './invitation.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { RemoveProjectMemberDto } from './dto/remove-project-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { InviteProjectMemberDto } from './dto/invite-project-member.dto';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Role } from '@prisma/client';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Audit } from 'src/common/audit/audit.decorator';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard) // On garde les Guards ici (Jwt vérifie l'identité, RolesGuard vérifie les permissions)
@Controller('projects')
export class ProjectController {
  constructor(
    private readonly projectService: ProjectService,
    private readonly invitationService: InvitationService,
  ) {}

  // 1. SEULS ADMIN ET PM PEUVENT CRÉER
  @Post()
  @Roles(Role.ADMIN, Role.PROJECT_MANAGER)
  @ApiOperation({ summary: 'Créer un nouveau projet' })
  create(@Req() req: any, @Body() createProjectDto: CreateProjectDto) {
    return this.projectService.createProject(req.user.id, createProjectDto);
  }

  // 2. TOUT LE MONDE PEUT VOIR SES PROJETS
  @Get('my-projects')
  @ApiOperation({ summary: 'Récupérer mes projets (membre ou owner)' })
  findMyProjects(@Req() req: any) {
    return this.projectService.getMyProjects(req.user.id);
  }

  // 3. TOUT LE MONDE PEUT VOIR UN PROJET (le service vérifiera s'il est membre)
  @Get(':id')
  @ApiOperation({ summary: 'Détails d’un projet spécifique' })
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.projectService.getProjectById(id, req.user.id);
  }

  // 4. LE SERVICE VÉRIFIE LE RÔLE PROJET (ADMIN projet minimum)
  @Patch(':id')
  @Audit({
    action: 'project.update',
    targetType: 'Project',
    // Le statut est la modification qui engage le plus : on la trace à part.
    metadata: (req) => ({
      status: (req.body as UpdateProjectDto)?.status,
      fields: Object.keys((req.body as object) ?? {}),
    }),
  })
  @ApiOperation({
    summary: 'Mettre à jour un projet (propriétaire ou administrateur projet)',
  })
  update(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateProjectDto: UpdateProjectDto,
  ) {
    return this.projectService.updateProject(id, req.user.id, updateProjectDto);
  }

  @Post(':id/members')
  @Audit({
    action: 'project.member.add',
    targetType: 'Project',
    metadata: (req) => ({
      memberId: (req.body as AddProjectMemberDto)?.userId,
      role: (req.body as AddProjectMemberDto)?.role ?? 'MEMBER',
    }),
  })
  @ApiOperation({
    summary: 'Ajouter un membre (propriétaire ou administrateur du projet)',
  })
  addMember(
    @Param('id') id: string,
    @Req() req: any,
    @Body() addProjectMemberDto: AddProjectMemberDto,
  ) {
    return this.projectService.addMember(id, req.user.id, addProjectMemberDto);
  }

  @Post(':id/invite')
  @Audit({
    action: 'project.invite.send',
    targetType: 'Project',
    metadata: (req) => ({
      email: (req.body as InviteProjectMemberDto)?.email,
      role: (req.body as InviteProjectMemberDto)?.role ?? 'MEMBER',
    }),
  })
  @ApiOperation({
    summary:
      'Inviter par email (propriétaire ou administrateur du projet) — crée une invitation nominative',
  })
  inviteMember(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: InviteProjectMemberDto,
  ) {
    return this.invitationService.invite(id, req.user.id, dto.email, dto.role);
  }

  @Get(':id/invitations')
  @ApiOperation({
    summary: 'Lister les invitations du projet (ADMIN projet)',
  })
  listInvitations(@Param('id') id: string, @Req() req: any) {
    return this.invitationService.list(id, req.user.id);
  }

  @Delete(':id/invitations/:invitationId')
  @Audit({
    action: 'project.invite.revoke',
    targetType: 'Project',
    metadata: (req) => ({
      invitationId: (req.params as Record<string, string>)?.invitationId,
    }),
  })
  @ApiOperation({
    summary: 'Révoquer une invitation en attente (ADMIN projet)',
  })
  revokeInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @Req() req: any,
  ) {
    return this.invitationService.revoke(id, invitationId, req.user.id);
  }

  @Delete(':id/members')
  @Audit({
    action: 'project.member.remove',
    targetType: 'Project',
    metadata: (req) => ({
      memberId: (req.body as RemoveProjectMemberDto)?.userId,
    }),
  })
  @ApiOperation({
    summary: 'Retirer un membre (propriétaire ou administrateur du projet)',
  })
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

  @Patch(':id/members/role')
  @Audit({
    action: 'project.member.role.update',
    targetType: 'Project',
    metadata: (req) => ({
      memberId: (req.body as UpdateMemberRoleDto)?.userId,
      newRole: (req.body as UpdateMemberRoleDto)?.role,
    }),
  })
  @ApiOperation({
    summary:
      'Changer le rôle projet d’un membre (propriétaire ou administrateur du projet)',
  })
  updateMemberRole(
    @Param('id') id: string,
    @Req() req: any,
    @Body() updateMemberRoleDto: UpdateMemberRoleDto,
  ) {
    return this.projectService.updateMemberRole(
      id,
      req.user.id,
      updateMemberRoleDto,
    );
  }

  @Patch(':id/transfer-ownership')
  @Audit({
    action: 'project.transfer_ownership',
    targetType: 'Project',
    metadata: (req) => ({
      newOwnerId: (req.body as { newOwnerId?: string })?.newOwnerId,
    }),
  })
  @ApiOperation({
    summary:
      'Transférer la propriété du projet à un autre membre (Owner uniquement)',
  })
  transferOwnership(
    @Param('id') id: string,
    @Req() req: any,
    @Body('newOwnerId') newOwnerId: string,
  ) {
    return this.projectService.transferOwnership(id, req.user.id, newOwnerId);
  }

  // 5. TOUT LE MONDE PEUT REJOINDRE
  @Post('join/code')
  @Audit({
    action: 'project.member.join',
    targetType: 'Project',
    // Le projet n'est connu qu'après résolution du code : l'id vient du résultat.
    targetId: (_req, result) => (result as { projectId?: string })?.projectId,
    metadata: () => ({ method: 'code' }),
  })
  @ApiOperation({ summary: 'Rejoindre via code' })
  joinByCode(@Body('projectCode') projectCode: string, @Req() req: any) {
    return this.projectService.joinByProjectCode(projectCode, req.user.id);
  }

  @Post('join/token')
  @Audit({
    action: 'project.member.join',
    targetType: 'Project',
    targetId: (_req, result) => (result as { projectId?: string })?.projectId,
    metadata: () => ({ method: 'token' }),
  })
  @ApiOperation({ summary: 'Rejoindre via le lien partagé du projet' })
  joinByToken(@Body('inviteToken') inviteToken: string, @Req() req: any) {
    return this.projectService.joinByInviteToken(inviteToken, req.user.id);
  }

  @Post('invitations/accept')
  @Audit({
    action: 'project.invite.accept',
    targetType: 'Project',
    targetId: (_req, result) => (result as { projectId?: string })?.projectId,
  })
  @ApiOperation({
    summary:
      'Accepter une invitation nominative — l’email du compte doit correspondre à celui invité',
  })
  acceptInvitation(@Body('token') token: string, @Req() req: any) {
    return this.invitationService.accept(token, req.user.id);
  }

  @Patch(':id/regenerate-token')
  @ApiOperation({ summary: 'Régénérer le token (Owner uniquement)' })
  regenerateToken(@Param('id') id: string, @Req() req: any) {
    return this.projectService.regenerateInviteToken(id, req.user.id);
  }

  // 🔟 Supprimer un projet (soft delete)
  @Delete(':id')
  @Audit({ action: 'project.delete', targetType: 'Project' })
  @ApiOperation({
    summary: 'Supprimer un projet (soft delete - Owner ou Admin uniquement)',
  })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.projectService.deleteProject(id, req.user.id);
  }
}

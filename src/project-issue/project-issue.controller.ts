/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Audit } from 'src/common/audit/audit.decorator';
import { ProjectIssueService } from './project-issue.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';

@ApiTags('Difficultés de projet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/issues')
export class ProjectIssueController {
  constructor(private readonly service: ProjectIssueService) {}

  @Get()
  @ApiOperation({
    summary: 'Difficultés signalées sur le projet, filtrables',
  })
  list(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Query() filters: QueryIssuesDto,
  ) {
    return this.service.list(projectId, req.user.id, filters);
  }

  @Post()
  @Audit({
    action: 'issue.create',
    targetType: 'Project',
    metadata: (req) => ({
      title: (req.body as CreateIssueDto)?.title,
      taskId: (req.body as CreateIssueDto)?.taskId,
    }),
  })
  @ApiOperation({
    summary: 'Signaler une difficulté (tout contributeur du projet)',
  })
  create(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: CreateIssueDto,
  ) {
    return this.service.create(projectId, req.user.id, dto);
  }

  @Patch(':issueId')
  @Audit({
    action: 'issue.update',
    targetType: 'Project',
    metadata: (req) => ({
      issueId: (req.params as Record<string, string>)?.issueId,
      status: (req.body as UpdateIssueDto)?.status,
    }),
  })
  @ApiOperation({
    summary:
      'Mettre à jour le statut ou l’action corrective (gestionnaires uniquement)',
  })
  update(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Req() req: any,
    @Body() dto: UpdateIssueDto,
  ) {
    return this.service.update(projectId, issueId, req.user.id, dto);
  }

  @Delete(':issueId')
  @Audit({
    action: 'issue.delete',
    targetType: 'Project',
    metadata: (req) => ({
      issueId: (req.params as Record<string, string>)?.issueId,
    }),
  })
  @ApiOperation({
    summary: 'Supprimer une difficulté (son auteur, ou un gestionnaire)',
  })
  remove(
    @Param('projectId') projectId: string,
    @Param('issueId') issueId: string,
    @Req() req: any,
  ) {
    return this.service.remove(projectId, issueId, req.user.id);
  }
}

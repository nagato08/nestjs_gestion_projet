import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Audit } from 'src/common/audit/audit.decorator';
import { TemplateService } from './template.service';
import { CreateTemplateFromProjectDto } from './dto/create-template-from-project.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';

@ApiTags('Modèles de projet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('project-templates')
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  @ApiOperation({ summary: 'Modèles partagés, plus les siens' })
  list(@Req() req: { user: { id: string } }) {
    return this.templateService.list(req.user.id);
  }

  @Get(':templateId')
  @ApiOperation({ summary: 'Détail d’un modèle avec ses tâches types' })
  getById(
    @Param('templateId') templateId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.templateService.getById(templateId, req.user.id);
  }

  @Post()
  @Audit({
    action: 'template.create',
    targetType: 'ProjectTemplate',
    targetId: (_req, result) => (result as { id?: string })?.id,
    metadata: (req) => ({
      name: (req.body as CreateTemplateFromProjectDto)?.name,
      sourceProjectId: (req.body as CreateTemplateFromProjectDto)?.projectId,
    }),
  })
  @ApiOperation({
    summary: 'Capturer un projet existant comme modèle (ADMIN projet source)',
  })
  createFromProject(
    @Req() req: { user: { id: string } },
    @Body() dto: CreateTemplateFromProjectDto,
  ) {
    return this.templateService.createFromProject(req.user.id, dto);
  }

  @Post(':templateId/instantiate')
  @Audit({
    action: 'template.instantiate',
    targetType: 'Project',
    targetId: (_req, result) => (result as { id?: string })?.id,
    metadata: (req) => ({
      templateId: (req.params as Record<string, string>)?.templateId,
      name: (req.body as InstantiateTemplateDto)?.name,
    }),
  })
  @ApiOperation({
    summary: 'Créer un projet à partir du modèle (ADMIN ou chef de projet)',
  })
  instantiate(
    @Param('templateId') templateId: string,
    @Req() req: { user: { id: string } },
    @Body() dto: InstantiateTemplateDto,
  ) {
    return this.templateService.instantiate(templateId, req.user.id, dto);
  }

  @Delete(':templateId')
  @Audit({ action: 'template.delete', targetType: 'ProjectTemplate' })
  @ApiOperation({ summary: 'Supprimer un modèle (auteur ou ADMIN global)' })
  remove(
    @Param('templateId') templateId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.templateService.remove(templateId, req.user.id);
  }
}

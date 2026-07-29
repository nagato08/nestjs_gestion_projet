/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { Audit } from 'src/common/audit/audit.decorator';
import { ProjectSettingsService } from './project-settings.service';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto';

@ApiTags('Paramètres de projet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/settings')
export class ProjectSettingsController {
  constructor(private readonly service: ProjectSettingsService) {}

  @Get()
  @ApiOperation({
    summary:
      'Calendrier ouvré, seuils d’alerte et configuration générale du projet',
  })
  get(@Param('projectId') projectId: string, @Req() req: any) {
    return this.service.getSettings(projectId, req.user.id);
  }

  @Patch()
  @Audit({ action: 'project.settings.update', targetType: 'Project' })
  @ApiOperation({
    summary: 'Modifier les paramètres (gestionnaires du projet uniquement)',
  })
  update(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body() dto: UpdateProjectSettingsDto,
  ) {
    return this.service.updateSettings(projectId, req.user.id, dto);
  }
}

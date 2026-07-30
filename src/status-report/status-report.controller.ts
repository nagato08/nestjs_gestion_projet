/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { StatusReportService } from './status-report.service';

@ApiTags('Rapport d’état')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('projects/:projectId/status-report')
export class StatusReportController {
  constructor(private readonly service: StatusReportService) {}

  @Get()
  @ApiOperation({
    summary:
      'Synthèse imprimable du projet : avancement, feuille de route, charge, difficultés',
  })
  get(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Query('issuesTaskId') issuesTaskId?: string,
  ) {
    return this.service.getReport(projectId, req.user.id, issuesTaskId);
  }
}

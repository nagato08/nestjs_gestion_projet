import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { ProjectExportService } from './project-export.service';

@ApiTags('Recherche & export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller()
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly exportService: ProjectExportService,
  ) {}

  @Get('search')
  @ApiOperation({
    summary:
      'Recherche transverse (projets, tâches, documents, utilisateurs), limitée au périmètre visible',
  })
  search(@Req() req: { user: { id: string } }, @Query('q') q = '') {
    return this.searchService.search(req.user.id, q);
  }

  @Get('projects/:projectId/export')
  @ApiOperation({
    summary:
      'Données du projet à plat (tâches, membres), pour export Excel ou PDF côté client',
  })
  exportProject(
    @Param('projectId') projectId: string,
    @Req() req: { user: { id: string } },
  ) {
    return this.exportService.exportProject(projectId, req.user.id);
  }
}

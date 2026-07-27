import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { AuditService } from './audit.service';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @ApiOperation({
    summary: "Consulter le journal d'audit (ADMIN global uniquement)",
  })
  list(@Query() query: QueryAuditLogsDto) {
    return this.auditService.list(query);
  }

  /**
   * Déclaré avant `:id` implicite et distinct de `list` : l'export ignore la
   * pagination pour renvoyer l'intégralité du jeu filtré.
   */
  @Get('export')
  @ApiOperation({
    summary: 'Jeu complet correspondant aux filtres, pour export fichier',
  })
  export(@Query() query: QueryAuditLogsDto) {
    return this.auditService.listForExport(query);
  }

  @Get('filter-options')
  @ApiOperation({
    summary: 'Valeurs distinctes (actions, types de cible, auteurs)',
  })
  filterOptions() {
    return this.auditService.getFilterOptions();
  }

  @Get('stats')
  @ApiOperation({
    summary:
      'Indicateurs de synthèse, calculés sur le périmètre des filtres fournis',
  })
  stats(@Query() query: QueryAuditLogsDto) {
    return this.auditService.getStats(query);
  }
}

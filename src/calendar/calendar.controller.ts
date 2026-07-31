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
import { CalendarService } from './calendar.service';
import { AbsenceService } from './absence.service';
import { CalendarRangeDto } from './dto/calendar-range.dto';
import { CreateAbsenceDto } from './dto/create-absence.dto';
import { UpdateAbsenceDto } from './dto/update-absence.dto';

@ApiTags('Agenda')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calendar')
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly absenceService: AbsenceService,
  ) {}

  @Get('personal')
  @ApiOperation({
    summary: 'Agenda personnel : mes échéances et mes disponibilités',
  })
  getPersonal(@Req() req: any, @Query() range: CalendarRangeDto) {
    return this.calendarService.getPersonal(
      req.user.id,
      range.start,
      range.end,
    );
  }

  @Get('organisation')
  @ApiOperation({
    summary:
      'Agenda d’organisation : activité de l’équipe, jalons, sprints, absences',
  })
  getOrganisation(@Req() req: any, @Query() range: CalendarRangeDto) {
    return this.calendarService.getOrganisation(
      req.user.id,
      req.user.role,
      range.start,
      range.end,
    );
  }

  @Get('absences')
  @ApiOperation({ summary: 'Mes disponibilités déclarées, motif compris' })
  listMyAbsences(@Req() req: any, @Query() range: CalendarRangeDto) {
    return this.absenceService.listMine(req.user.id, range.start, range.end);
  }

  @Post('absences')
  @Audit({
    action: 'absence.create',
    targetType: 'User',
    metadata: (req) => ({
      type: (req.body as CreateAbsenceDto)?.type,
      startDate: (req.body as CreateAbsenceDto)?.startDate,
      endDate: (req.body as CreateAbsenceDto)?.endDate,
    }),
  })
  @ApiOperation({ summary: 'Déclarer une indisponibilité (pour soi-même)' })
  createAbsence(@Req() req: any, @Body() dto: CreateAbsenceDto) {
    return this.absenceService.create(req.user.id, dto);
  }

  @Patch('absences/:absenceId')
  @Audit({
    action: 'absence.update',
    targetType: 'User',
    metadata: (req) => ({
      absenceId: (req.params as Record<string, string>)?.absenceId,
    }),
  })
  @ApiOperation({ summary: 'Modifier une de ses disponibilités' })
  updateAbsence(
    @Param('absenceId') absenceId: string,
    @Req() req: any,
    @Body() dto: UpdateAbsenceDto,
  ) {
    return this.absenceService.update(absenceId, req.user.id, dto);
  }

  @Delete('absences/:absenceId')
  @Audit({
    action: 'absence.delete',
    targetType: 'User',
    metadata: (req) => ({
      absenceId: (req.params as Record<string, string>)?.absenceId,
    }),
  })
  @ApiOperation({ summary: 'Supprimer une de ses disponibilités' })
  removeAbsence(@Param('absenceId') absenceId: string, @Req() req: any) {
    return this.absenceService.remove(absenceId, req.user.id);
  }
}

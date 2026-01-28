/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Controller,
  Get,
  Post,
  Body,
  Delete,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { TimeEntryService } from './time-entry.service';
import { StartTimerDto } from './dto/start-timer.dto';
import { CreateManualTimeEntryDto } from './dto/create-manual-time-entry.dto';

@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('time-entries')
export class TimeEntryController {
  constructor(private readonly timeEntryService: TimeEntryService) {}

  // 1️⃣ Démarrer un timer
  @Post('start')
  @ApiOperation({ title: 'Démarrer un timer pour une tâche' })
  startTimer(@Req() req: any, @Body() startTimerDto: StartTimerDto) {
    return this.timeEntryService.startTimer(req.user.id, startTimerDto);
  }

  // 2️⃣ Arrêter le timer actif
  @Post('stop')
  @ApiOperation({ title: 'Arrêter le timer actif' })
  stopTimer(@Req() req: any) {
    return this.timeEntryService.stopTimer(req.user.id);
  }

  // 3️⃣ Récupérer le timer actif
  @Get('active')
  @ApiOperation({ title: 'Récupérer le timer actif' })
  getActiveTimer(@Req() req: any) {
    return this.timeEntryService.getActiveTimerForUser(req.user.id);
  }

  // 4️⃣ Créer une entrée de temps manuelle
  @Post('manual')
  @ApiOperation({ title: 'Créer une entrée de temps manuelle' })
  createManual(
    @Req() req: any,
    @Body() createManualTimeEntryDto: CreateManualTimeEntryDto,
  ) {
    return this.timeEntryService.createManualTimeEntry(
      req.user.id,
      createManualTimeEntryDto,
    );
  }

  // 5️⃣ Récupérer mes entrées de temps
  @Get('my-entries')
  @ApiOperation({ title: 'Récupérer mes entrées de temps' })
  getMyTimeEntries(
    @Req() req: any,
    @Query('taskId') taskId?: string,
    @Query('projectId') projectId?: string,
  ) {
    return this.timeEntryService.getMyTimeEntries(
      req.user.id,
      taskId,
      projectId,
    );
  }

  // 6️⃣ Récupérer mes statistiques de temps
  @Get('my-stats')
  @ApiOperation({ title: 'Récupérer mes statistiques de temps' })
  getMyTimeStats(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.timeEntryService.getMyTimeStats(req.user.id, projectId);
  }

  // 7️⃣ Récupérer les statistiques de temps d'un projet
  @Get('project/:projectId/stats')
  @ApiOperation({ title: "Récupérer les statistiques de temps d'un projet" })
  getProjectTimeStats(@Param('projectId') projectId: string, @Req() req: any) {
    return this.timeEntryService.getProjectTimeStats(projectId, req.user.id);
  }

  // 8️⃣ Supprimer une entrée de temps
  @Delete(':id')
  @ApiOperation({ title: 'Supprimer une entrée de temps' })
  remove(@Param('id') id: string, @Req() req: any) {
    return this.timeEntryService.deleteTimeEntry(id, req.user.id);
  }
}

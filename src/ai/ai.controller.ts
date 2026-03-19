/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { RequestWithUser } from '../auth/jwt.strategy';
import { AiAllowedGuard } from './guards/ai-allowed.guard';
import { AiService } from './ai.service';
import { InterpretDto } from './dto/interpret.dto';
import { ExecuteDto } from './dto/execute.dto';
import { ActDto } from './dto/act.dto';

@ApiTags('IA')
@ApiBearerAuth()
@Controller('ai')
@UseGuards(JwtAuthGuard, AiAllowedGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('interpret')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Interpréter un message et obtenir une action suggérée (sans exécution)',
  })
  async interpret(
    @Body() dto: InterpretDto,
  ): Promise<ReturnType<AiService['interpret']>> {
    return await this.aiService.interpret(dto.projectId, dto.message);
  }

  @Post('execute')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary:
      'Exécuter une action préalablement suggérée (créer tâche, assigner)',
  })
  async execute(
    @Body() dto: ExecuteDto,
    @Request() req: RequestWithUser,
  ): Promise<Awaited<ReturnType<AiService['execute']>>> {
    return await this.aiService.execute(
      dto.projectId,
      dto.action,
      dto.params,
      req.user.id,
    );
  }

  @Post('act')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Interpréter puis exécuter en un appel (suggestion + application)',
  })
  async act(
    @Body() dto: ActDto,
    @Request() req: RequestWithUser,
  ): Promise<Awaited<ReturnType<AiService['act']>>> {
    return await this.aiService.act(dto.projectId, dto.message, req.user.id);
  }

  @Get('analyze/gantt/:projectId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Interprétation du diagramme de Gantt par l’IA' })
  async analyzeGantt(
    @Param('projectId') projectId: string,
    @Request() req: RequestWithUser,
  ): Promise<{ analysis: string }> {
    return await this.aiService.analyzeGantt(projectId, req.user.id);
  }

  @Get('analyze/pert/:projectId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Interprétation du diagramme PERT par l’IA' })
  async analyzePert(
    @Param('projectId') projectId: string,
    @Request() req: RequestWithUser,
  ): Promise<{ analysis: string }> {
    return await this.aiService.analyzePert(projectId, req.user.id);
  }

  @Get('analyze/delays/:projectId')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Prévoir les retards sur le projet' })
  async predictDelays(
    @Param('projectId') projectId: string,
  ): Promise<{ prediction: string }> {
    return await this.aiService.predictDelays(projectId);
  }
}

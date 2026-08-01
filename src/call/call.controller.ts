/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { CallService } from './call.service';
import { StartCallDto } from './dto/start-call.dto';

@ApiTags('Appels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallController {
  constructor(private readonly callService: CallService) {}

  @Get()
  @ApiOperation({ summary: 'Journal de mes appels, le plus récent en tête' })
  listMine(@Req() req: any) {
    return this.callService.listMine(req.user.id);
  }

  @Post()
  @ApiOperation({
    summary: 'Lancer un appel : le destinataire se met à sonner',
  })
  start(@Req() req: any, @Body() dto: StartCallDto) {
    return this.callService.start(
      req.user.id,
      dto.calleeId,
      dto.conversationId,
    );
  }

  @Patch(':callId/answer')
  @ApiOperation({ summary: 'Décrocher (destinataire uniquement)' })
  answer(@Param('callId') callId: string, @Req() req: any) {
    return this.callService.answer(callId, req.user.id);
  }

  @Patch(':callId/reject')
  @ApiOperation({ summary: 'Refuser (destinataire uniquement)' })
  reject(@Param('callId') callId: string, @Req() req: any) {
    return this.callService.reject(callId, req.user.id);
  }

  @Patch(':callId/end')
  @ApiOperation({ summary: 'Raccrocher — des deux côtés' })
  end(@Param('callId') callId: string, @Req() req: any) {
    return this.callService.end(callId, req.user.id);
  }
}

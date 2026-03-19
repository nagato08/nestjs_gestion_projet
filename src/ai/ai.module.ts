import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PlanningModule } from '../planning/planning.module';
import { TacheModule } from '../tache/tache.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { AiAllowedGuard } from './guards/ai-allowed.guard';

@Module({
  imports: [PlanningModule, TacheModule],
  controllers: [AiController],
  providers: [AiService, AiAllowedGuard, PrismaService],
})
export class AiModule {}

import { Module } from '@nestjs/common';
import { TacheController } from './tache.controller';
import { TacheService } from './tache.service';
import { ChecklistService } from './checklist.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TacheController],
  providers: [TacheService, ChecklistService, PrismaService],
  exports: [TacheService, ChecklistService],
})
export class TacheModule {}

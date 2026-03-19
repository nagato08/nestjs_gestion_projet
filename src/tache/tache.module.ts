import { Module } from '@nestjs/common';
import { TacheController } from './tache.controller';
import { TacheService } from './tache.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TacheController],
  providers: [TacheService, PrismaService],
  exports: [TacheService],
})
export class TacheModule {}

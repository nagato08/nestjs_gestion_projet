import { Module } from '@nestjs/common';
import { TimeEntryController } from './time-entry.controller';
import { TimeEntryService } from './time-entry.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [TimeEntryController],
  providers: [TimeEntryService, PrismaService],
  exports: [TimeEntryService],
})
export class TimeEntryModule {}

import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { AbsenceService } from './absence.service';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [CalendarController],
  providers: [CalendarService, AbsenceService, PrismaService],
  exports: [CalendarService, AbsenceService],
})
export class CalendarModule {}

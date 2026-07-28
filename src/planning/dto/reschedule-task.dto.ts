import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';

export class RescheduleTaskDto {
  @ApiProperty({ example: '2026-08-01T00:00:00.000Z' })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({ example: '2026-08-05T00:00:00.000Z' })
  @IsISO8601()
  endDate!: string;
}

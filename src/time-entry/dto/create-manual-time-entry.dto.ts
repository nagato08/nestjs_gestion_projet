import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateManualTimeEntryDto {
  @ApiProperty({ example: 'cuid_task_id' })
  @IsNotEmpty()
  @IsString()
  taskId: string;

  @ApiProperty({
    example: '2026-01-15T09:00:00Z',
    description: 'Date et heure de début',
  })
  @IsNotEmpty()
  @IsDateString()
  startTime: string;

  @ApiProperty({
    example: '2026-01-15T17:00:00Z',
    description: 'Date et heure de fin',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiProperty({
    example: 480,
    description: "Durée en minutes (si endTime n'est pas fourni)",
    required: false,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  duration?: number;
}

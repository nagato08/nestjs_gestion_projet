import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Priority, TaskStatus } from '@prisma/client';

export class UpdateTaskDto {
  @ApiProperty({
    example: 'Implémenter la fonctionnalité de login',
    required: false,
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty({
    example: 'Créer le formulaire de connexion avec validation',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: Priority, required: false })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({ enum: TaskStatus, required: false })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ example: '2026-02-20T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  /** Gantt : mise à jour des dates (drag & drop) */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** PERT : estimations en jours */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  optimisticDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  probableDays?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pessimisticDays?: number;

  /** Burndown : points de story */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  storyPoints?: number;
}

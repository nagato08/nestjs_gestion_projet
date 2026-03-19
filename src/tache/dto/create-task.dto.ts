/* eslint-disable @typescript-eslint/no-unsafe-call */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implémenter la fonctionnalité de login' })
  @IsNotEmpty()
  @IsString()
  title: string;

  @ApiProperty({
    example: 'Créer le formulaire de connexion avec validation',
    required: false,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'HIGH', enum: ['HIGH', 'MEDIUM', 'LOW'] })
  @IsNotEmpty()
  @IsString()
  priority: string;

  @ApiProperty({ example: '2026-02-15T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  /** Gantt : date de début de la barre */
  @ApiProperty({ example: '2026-01-10T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  /** Gantt : date de fin de la barre */
  @ApiProperty({ example: '2026-01-20T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  /** PERT : estimation optimiste (jours) pour te = (o+4m+p)/6 */
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

  @ApiProperty({ example: 'cuid_project_id' })
  @IsNotEmpty()
  @IsString()
  projectId: string;

  @ApiProperty({ example: 'cuid_parent_task_id', required: false })
  @IsOptional()
  @IsString()
  parentId?: string;

  @ApiProperty({
    example: ['cuid_user_1', 'cuid_user_2'],
    description:
      'Liste des IDs des utilisateurs à assigner à la tâche lors de la création',
    required: false,
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  assignedUserIds?: string[];
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
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

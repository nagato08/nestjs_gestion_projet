import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '@prisma/client';

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

  @ApiProperty({
    example: 'MEDIUM',
    enum: ['HIGH', 'MEDIUM', 'LOW'],
    required: false,
  })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiProperty({ enum: TaskStatus, required: false })
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiProperty({ example: '2026-02-20T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;
}

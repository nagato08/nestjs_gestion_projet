import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { Priority, ProjectStatus } from '@prisma/client';

export class CreateProjectDto {
  @ApiProperty({ example: 'Projet Alpha' })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ example: 'Application de gestion interne', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 'Améliorer la productivité', required: false })
  @IsOptional()
  @IsString()
  objectives?: string;

  @ApiProperty({ enum: Priority })
  @IsNotEmpty()
  @IsEnum(Priority)
  priority: Priority;

  @ApiProperty({ enum: ProjectStatus, default: ProjectStatus.PLANNING })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiProperty({ example: '2026-01-15' })
  @IsNotEmpty()
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-06-30', required: false })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

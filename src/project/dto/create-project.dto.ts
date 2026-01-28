/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ProjectStatus } from '@prisma/client';

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

  @ApiProperty({ example: 'HIGH' })
  @IsNotEmpty()
  @IsString()
  priority: string;

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

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
  @IsNotEmpty({ message: 'Le nom du projet est requis' })
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  name!: string;

  @ApiProperty({ example: 'Application de gestion interne', required: false })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  description?: string;

  @ApiProperty({ example: 'Améliorer la productivité', required: false })
  @IsOptional()
  @IsString({ message: 'Les objectifs doivent être une chaîne de caractères' })
  objectives?: string;

  @ApiProperty({ enum: Priority })
  @IsNotEmpty({ message: 'La priorité est requise' })
  @IsEnum(Priority, {
    message: 'Priorité invalide (LOW, MEDIUM, HIGH, CRITICAL)',
  })
  priority!: Priority;

  @ApiProperty({ enum: ProjectStatus, default: ProjectStatus.PLANNING })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Statut de projet invalide' })
  status?: ProjectStatus;

  @ApiProperty({ example: '2026-01-15' })
  @IsNotEmpty({ message: 'La date de début est requise' })
  @IsDateString({}, { message: 'Date de début invalide (format ISO attendu)' })
  startDate!: string;

  @ApiProperty({ example: '2026-06-30', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide (format ISO attendu)' })
  endDate?: string;
}

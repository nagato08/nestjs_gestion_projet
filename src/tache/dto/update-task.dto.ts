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
  @IsString({ message: 'Le titre doit être une chaîne de caractères' })
  title?: string;

  @ApiProperty({
    example: 'Créer le formulaire de connexion avec validation',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  description?: string;

  @ApiProperty({ enum: Priority, required: false })
  @IsOptional()
  @IsEnum(Priority, {
    message: 'Priorité invalide (LOW, MEDIUM, HIGH, CRITICAL)',
  })
  priority?: Priority;

  @ApiProperty({ enum: TaskStatus, required: false })
  @IsOptional()
  @IsEnum(TaskStatus, {
    message: 'Statut de tâche invalide (TODO, DOING, DONE)',
  })
  status?: TaskStatus;

  @ApiProperty({ example: '2026-02-20T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Échéance invalide (format ISO attendu)' })
  deadline?: string;

  /** Gantt : mise à jour des dates (drag & drop) */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début invalide (format ISO attendu)' })
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide (format ISO attendu)' })
  endDate?: string;

  /** PERT : estimations en jours */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt({ message: 'Le nombre de jours optimistes doit être un entier' })
  @Min(0, { message: 'Le nombre de jours optimistes ne peut pas être négatif' })
  optimisticDays?: number;

  @IsOptional()
  @IsInt({ message: 'Le nombre de jours probables doit être un entier' })
  @Min(0, { message: 'Le nombre de jours probables ne peut pas être négatif' })
  probableDays?: number;

  @IsOptional()
  @IsInt({ message: 'Le nombre de jours pessimistes doit être un entier' })
  @Min(0, {
    message: 'Le nombre de jours pessimistes ne peut pas être négatif',
  })
  pessimisticDays?: number;

  /** Burndown : points de story */
  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt({ message: 'Les story points doivent être un entier' })
  @Min(0, { message: 'Les story points ne peuvent pas être négatifs' })
  storyPoints?: number;
}

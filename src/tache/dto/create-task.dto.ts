import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Priority } from '@prisma/client';

export class CreateTaskDto {
  @ApiProperty({ example: 'Implémenter la fonctionnalité de login' })
  @IsNotEmpty({ message: 'Le titre de la tâche est requis' })
  @IsString({ message: 'Le titre doit être une chaîne de caractères' })
  title!: string;

  @ApiProperty({
    example: 'Créer le formulaire de connexion avec validation',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  description?: string;

  @ApiProperty({ enum: Priority })
  @IsNotEmpty({ message: 'La priorité est requise' })
  @IsEnum(Priority, {
    message: 'Priorité invalide (LOW, MEDIUM, HIGH, CRITICAL)',
  })
  priority!: Priority;

  @ApiProperty({ example: '2026-02-15T10:00:00Z', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Échéance invalide (format ISO attendu)' })
  deadline?: string;

  /** Gantt : date de début de la barre */
  @ApiProperty({ example: '2026-01-10T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début invalide (format ISO attendu)' })
  startDate?: string;

  /** Gantt : date de fin de la barre */
  @ApiProperty({ example: '2026-01-20T00:00:00Z', required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide (format ISO attendu)' })
  endDate?: string;

  /** PERT : estimation optimiste (jours) pour te = (o+4m+p)/6 */
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

  @ApiProperty({ example: 'cuid_project_id' })
  @IsNotEmpty({ message: "L'identifiant du projet est requis" })
  @IsString({
    message: "L'identifiant du projet doit être une chaîne de caractères",
  })
  projectId!: string;

  @ApiProperty({ example: 'cuid_parent_task_id', required: false })
  @IsOptional()
  @IsString({
    message:
      "L'identifiant de la tâche parente doit être une chaîne de caractères",
  })
  parentId?: string;

  @ApiProperty({
    example: ['cuid_user_1', 'cuid_user_2'],
    description:
      'Liste des IDs des utilisateurs à assigner à la tâche lors de la création',
    required: false,
  })
  @IsOptional()
  @IsArray({ message: 'La liste des utilisateurs doit être un tableau' })
  @IsString({
    each: true,
    message: 'Chaque identifiant utilisateur doit être une chaîne',
  })
  assignedUserIds?: string[];
}

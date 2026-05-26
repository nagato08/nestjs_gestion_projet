import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { Priority, ProjectStatus } from '@prisma/client';

export class UpdateProjectDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'Le nom doit être une chaîne de caractères' })
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'La description doit être une chaîne de caractères' })
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString({ message: 'Les objectifs doivent être une chaîne de caractères' })
  objectives?: string;

  @ApiProperty({ enum: Priority, required: false })
  @IsOptional()
  @IsEnum(Priority, {
    message: 'Priorité invalide (LOW, MEDIUM, HIGH, CRITICAL)',
  })
  priority?: Priority;

  @ApiProperty({ enum: ProjectStatus, required: false })
  @IsOptional()
  @IsEnum(ProjectStatus, { message: 'Statut de projet invalide' })
  status?: ProjectStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début invalide (format ISO attendu)' })
  startDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide (format ISO attendu)' })
  endDate?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateSprintDto {
  @ApiProperty({ example: 'Sprint 1 — Authentification' })
  @IsString()
  @MinLength(1, { message: 'Le nom du sprint est requis' })
  name!: string;

  @ApiPropertyOptional({
    example: 'Livrer un parcours de connexion complet',
    description: 'Objectif du sprint, affiché en tête du burndown',
  })
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiProperty({ example: '2026-08-01' })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({ example: '2026-08-15' })
  @IsISO8601()
  endDate!: string;
}

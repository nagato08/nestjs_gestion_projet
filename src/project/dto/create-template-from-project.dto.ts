import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTemplateFromProjectDto {
  @ApiProperty({ description: 'Projet source à capturer' })
  @IsString()
  projectId!: string;

  @ApiProperty({ example: 'Modèle — Projet web standard' })
  @IsString()
  @MinLength(1, { message: 'Le nom du modèle est requis' })
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    default: true,
    description: 'Partagé avec toute l’organisation, ou privé à son auteur',
  })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;
}

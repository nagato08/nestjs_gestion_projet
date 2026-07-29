import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreatePhaseDto {
  @ApiProperty({ example: 'Conception' })
  @IsString()
  @MinLength(1, { message: 'Le nom de la phase est requis' })
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-09-01' })
  @IsISO8601()
  startDate!: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsISO8601()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Ordre d’affichage', example: 0 })
  @IsOptional()
  @IsInt()
  order?: number;
}

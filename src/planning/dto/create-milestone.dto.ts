import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateMilestoneDto {
  @ApiProperty({ example: 'Livraison v1' })
  @IsString()
  @MinLength(1, { message: 'Le nom du jalon est requis' })
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '2026-09-30' })
  @IsISO8601()
  date!: string;
}

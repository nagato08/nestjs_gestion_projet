import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateDocumentDto {
  @ApiProperty({ example: 'Rapport_Projet_2025_v2.pdf', required: false })
  @IsOptional()
  @IsString()
  name?: string;
}

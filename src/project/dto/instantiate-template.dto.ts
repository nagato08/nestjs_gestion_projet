import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsString, MinLength } from 'class-validator';

export class InstantiateTemplateDto {
  @ApiProperty({ example: 'Refonte site vitrine' })
  @IsString()
  @MinLength(1, { message: 'Le nom du projet est requis' })
  name!: string;

  @ApiProperty({
    example: '2026-09-01',
    description:
      'Date de démarrage. Les décalages du modèle sont appliqués à partir de là.',
  })
  @IsISO8601()
  startDate!: string;
}

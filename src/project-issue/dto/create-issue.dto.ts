import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IssueSeverity } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateIssueDto {
  @ApiProperty({ example: 'Retard de livraison du matériel fournisseur' })
  @IsString()
  @MinLength(1, { message: 'Le titre de la difficulté est requis' })
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: IssueSeverity, default: IssueSeverity.MEDIUM })
  @IsOptional()
  @IsEnum(IssueSeverity, {
    message: 'Gravité invalide (LOW, MEDIUM, HIGH)',
  })
  severity?: IssueSeverity;

  @ApiPropertyOptional({
    example: 'cuid_task_id',
    description:
      'Tâche concernée (optionnel : une difficulté peut porter sur le projet entier)',
  })
  @IsOptional()
  @IsString()
  taskId?: string;
}

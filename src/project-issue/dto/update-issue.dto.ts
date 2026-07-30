import { ApiPropertyOptional } from '@nestjs/swagger';
import { IssueStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

/**
 * Réservé aux gestionnaires du projet : c'est le suivi de la résolution,
 * distinct du signalement initial ouvert à tout contributeur.
 */
export class UpdateIssueDto {
  @ApiPropertyOptional({ enum: IssueStatus })
  @IsOptional()
  @IsEnum(IssueStatus, {
    message: 'Statut invalide (OPEN, IN_PROGRESS, RESOLVED)',
  })
  status?: IssueStatus;

  @ApiPropertyOptional({
    description: 'Action mise en œuvre pour résoudre la difficulté',
  })
  @IsOptional()
  @IsString()
  correctiveAction?: string;
}

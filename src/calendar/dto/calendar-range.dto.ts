import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/**
 * Fenêtre affichée par l'agenda. Toujours explicite : sans bornes, la requête
 * ramènerait l'historique entier des tâches et des absences pour peupler une
 * grille qui n'en montre qu'un mois.
 */
export class CalendarRangeDto {
  @ApiProperty({ example: '2026-08-01' })
  @IsDateString({}, { message: 'Date de début invalide' })
  start!: string;

  @ApiProperty({ example: '2026-08-31' })
  @IsDateString({}, { message: 'Date de fin invalide' })
  end!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateManualTimeEntryDto {
  @ApiProperty({ example: 'cuid_task_id' })
  @IsNotEmpty({ message: "L'identifiant de la tâche est requis" })
  @IsString({ message: "L'identifiant doit être une chaîne de caractères" })
  taskId: string;

  @ApiProperty({
    example: '2026-01-15T09:00:00Z',
    description: 'Date et heure de début',
  })
  @IsNotEmpty({ message: "L'heure de début est requise" })
  @IsDateString(
    {},
    { message: "Heure de début invalide (format ISO attendu)" },
  )
  startTime: string;

  @ApiProperty({
    example: '2026-01-15T17:00:00Z',
    description: 'Date et heure de fin',
    required: false,
  })
  @IsOptional()
  @IsDateString({}, { message: 'Heure de fin invalide (format ISO attendu)' })
  endTime?: string;

  @ApiProperty({
    example: 480,
    description: "Durée en minutes (si endTime n'est pas fourni)",
    required: false,
  })
  @IsOptional()
  @IsInt({ message: 'La durée doit être un entier (minutes)' })
  @Min(1, { message: 'La durée doit être supérieure à 0' })
  duration?: number;
}

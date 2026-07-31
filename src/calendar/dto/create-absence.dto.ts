import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbsenceType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateAbsenceDto {
  @ApiPropertyOptional({ enum: AbsenceType, default: AbsenceType.LEAVE })
  @IsOptional()
  @IsEnum(AbsenceType, {
    message: 'Type invalide (LEAVE, SICK, REMOTE, TRAINING, OTHER)',
  })
  type?: AbsenceType;

  @ApiProperty({ example: '2026-08-10' })
  @IsDateString({}, { message: 'Date de début invalide' })
  startDate!: string;

  @ApiProperty({
    example: '2026-08-14',
    description:
      'Borne incluse. Pour une absence d’une seule journée, répéter la date de début.',
  })
  @IsDateString({}, { message: 'Date de fin invalide' })
  endDate!: string;

  @ApiPropertyOptional({
    description: 'Motif, visible de son seul auteur.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

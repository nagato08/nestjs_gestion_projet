import { ApiPropertyOptional } from '@nestjs/swagger';
import { AbsenceType } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateAbsenceDto {
  @ApiPropertyOptional({ enum: AbsenceType })
  @IsOptional()
  @IsEnum(AbsenceType, {
    message: 'Type invalide (LEAVE, SICK, REMOTE, TRAINING, OTHER)',
  })
  type?: AbsenceType;

  @ApiPropertyOptional({ example: '2026-08-10' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de début invalide' })
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-08-14' })
  @IsOptional()
  @IsDateString({}, { message: 'Date de fin invalide' })
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}

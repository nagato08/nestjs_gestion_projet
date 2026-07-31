import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AbsenceStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';

export class DecideAbsenceDto {
  @ApiProperty({
    enum: [AbsenceStatus.APPROVED, AbsenceStatus.REJECTED],
    description:
      'Suite donnée à la demande. `PENDING` n’est pas une décision et n’est pas accepté ici.',
  })
  @IsEnum(AbsenceStatus)
  @IsIn([AbsenceStatus.APPROVED, AbsenceStatus.REJECTED], {
    message: 'Décision invalide (APPROVED ou REJECTED)',
  })
  status!: AbsenceStatus;

  @ApiPropertyOptional({
    description: 'Motif du refus, ou remarque accompagnant l’accord.',
  })
  @IsOptional()
  @IsString()
  decisionNote?: string;
}

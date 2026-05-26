import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

export class ChangeProjectStatusDto {
  @ApiProperty({ enum: ProjectStatus })
  @IsEnum(ProjectStatus, { message: 'Statut de projet invalide' })
  status!: ProjectStatus;
}

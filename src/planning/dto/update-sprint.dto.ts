import { ApiPropertyOptional } from '@nestjs/swagger';
import { SprintStatus } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateSprintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    enum: SprintStatus,
    description: 'Un seul sprint ACTIVE à la fois par projet',
  })
  @IsOptional()
  @IsEnum(SprintStatus)
  status?: SprintStatus;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { ChargeUnit, ProjectMethodology } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateProjectSettingsDto {
  @ApiPropertyOptional({
    description: 'Heures travaillées par jour',
    example: 8,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  hoursPerDay?: number;

  @ApiPropertyOptional({
    description: 'Jours ouvrés de la semaine, 0 = dimanche … 6 = samedi',
    example: [1, 2, 3, 4, 5],
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  workingDays?: number[];

  @ApiPropertyOptional({
    description: 'Jours fériés ou de fermeture du projet (dates ISO)',
  })
  @IsOptional()
  @IsArray()
  // Plafond de confort : au-delà, c'est un calendrier récurrent qu'il
  // faudrait modéliser autrement, pas une simple liste de dates.
  @ArrayMaxSize(200)
  @IsISO8601({}, { each: true })
  publicHolidays?: string[];

  @ApiPropertyOptional({
    description:
      'Capacité machine disponible par jour, en heures (0 = non suivie)',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  machineCapacityPerDay?: number;

  @ApiPropertyOptional({
    description:
      'Nombre de jours avant échéance à partir duquel une tâche est signalée à risque',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60)
  lateAlertThresholdDays?: number;

  @ApiPropertyOptional({ description: 'Budget prévisionnel du projet' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  budgetAmount?: number;

  @ApiPropertyOptional({ example: 'EUR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ enum: ProjectMethodology })
  @IsOptional()
  @IsEnum(ProjectMethodology)
  methodology?: ProjectMethodology;

  @ApiPropertyOptional({ enum: ChargeUnit })
  @IsOptional()
  @IsEnum(ChargeUnit)
  chargeUnit?: ChargeUnit;
}

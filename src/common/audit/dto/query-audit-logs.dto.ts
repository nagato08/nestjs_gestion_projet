import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { AUDIT_CATEGORIES, AUDIT_SEVERITIES } from '../audit-actions.catalog';

/**
 * Accepte indifféremment `?actions=a&actions=b` et `?actions=a,b`.
 *
 * Les deux formes circulent selon la façon dont le client sérialise ses
 * tableaux ; normaliser ici évite de dupliquer la gestion partout.
 */
function toStringArray({ value }: { value: unknown }): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : [value];
  const items = raw
    .flatMap((entry) => String(entry).split(','))
    .map((entry) => entry.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

/** Filtres de consultation du journal d'audit. */
export class QueryAuditLogsDto {
  @ApiPropertyOptional({ description: 'Nombre d’entrées à ignorer' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({
    description: 'Nombre d’entrées à retourner (max 200)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;

  @ApiPropertyOptional({ description: 'Verbe exact, ex. project.delete' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({
    description: 'Plusieurs verbes, séparés par des virgules',
    type: [String],
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsString({ each: true })
  actions?: string[];

  @ApiPropertyOptional({
    description: 'Catégories métier',
    enum: AUDIT_CATEGORIES,
    isArray: true,
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsIn(AUDIT_CATEGORIES, { each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Niveaux de gravité',
    enum: AUDIT_SEVERITIES,
    isArray: true,
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsIn(AUDIT_SEVERITIES, { each: true })
  severities?: string[];

  @ApiPropertyOptional({ description: 'Auteur de l’action' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Plusieurs auteurs', type: [String] })
  @IsOptional()
  @Transform(toStringArray)
  @IsString({ each: true })
  userIds?: string[];

  @ApiPropertyOptional({ description: 'Type de cible, ex. Project' })
  @IsOptional()
  @IsString()
  targetType?: string;

  @ApiPropertyOptional({
    description: 'Plusieurs types de cible',
    type: [String],
  })
  @IsOptional()
  @Transform(toStringArray)
  @IsString({ each: true })
  targetTypes?: string[];

  @ApiPropertyOptional({ description: 'Identifiant de la cible' })
  @IsOptional()
  @IsString()
  targetId?: string;

  @ApiPropertyOptional({ description: 'Adresse IP exacte' })
  @IsOptional()
  @IsString()
  ip?: string;

  @ApiPropertyOptional({
    description: 'Identifiant de requête, pour corréler avec les logs',
  })
  @IsOptional()
  @IsString()
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Raccourci de période',
    enum: ['7d', '30d', '90d'],
  })
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  period?: '7d' | '30d' | '90d';

  @ApiPropertyOptional({ description: 'Début de période (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fin de période (ISO 8601), incluse' })
  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @ApiPropertyOptional({
    description:
      'Recherche libre : email de l’auteur, action, cible, IP, requête',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Ordre chronologique',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sort?: 'asc' | 'desc';
}

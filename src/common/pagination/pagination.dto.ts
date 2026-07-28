import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * Pagination par décalage, partagée par les collections qui grandissent sans
 * borne naturelle : notifications, messages, saisies de temps.
 *
 * Le contrat reprend celui déjà en place sur le journal d'audit — `skip`,
 * `take`, et une réponse `{ items, total }` — pour qu'il n'existe qu'une seule
 * convention de pagination dans l'API.
 */
export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Nombre d’entrées à ignorer',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number;

  @ApiPropertyOptional({
    description: 'Nombre d’entrées à retourner (max 100)',
    default: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  take?: number;
}

/** Taille de page par défaut : de quoi remplir un écran sans le déborder. */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * Plafond absolu.
 *
 * Le client choisit sa taille de page, mais ne décide pas de la charge qu'il
 * impose au serveur : sans ce plafond, `?take=1000000` ramènerait la
 * situation exacte que la pagination corrige.
 */
export const MAX_PAGE_SIZE = 100;

/** Réponse paginée, forme unique pour toute l'API. */
export interface Paginated<T> {
  items: T[];
  /** Total sans pagination : nécessaire pour afficher « 50 sur 1 240 ». */
  total: number;
  skip: number;
  take: number;
}

/** Normalise les paramètres reçus en bornes sûres. */
export function resolvePagination(dto: PaginationDto = {}): {
  skip: number;
  take: number;
} {
  return {
    skip: Math.max(0, dto.skip ?? 0),
    take: Math.min(dto.take ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
  };
}

import { Logger } from '@nestjs/common';

const logger = new Logger('CorsConfig');

/**
 * Origines autorisées, lues depuis `CORS_ORIGIN` (liste séparée par des virgules).
 *
 * Source unique pour l'API HTTP **et** la passerelle WebSocket : les deux
 * doivent accepter exactement les mêmes origines, sinon durcir l'une laisse
 * l'autre ouverte.
 *
 * - Variable définie : seules ces origines sont acceptées.
 * - Variable absente hors production : reflet de l'origine appelante, pour ne
 *   pas gêner le développement local.
 * - Variable absente en production : aucune origine acceptée. On préfère une
 *   panne visible à une API silencieusement ouverte à tous.
 */
export function getCorsOrigins(): string[] | boolean {
  const raw = process.env.CORS_ORIGIN?.trim();

  if (raw) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === 'production') {
    logger.error(
      'CORS_ORIGIN non défini en production : toutes les origines sont refusées.',
    );
    return false;
  }

  return true;
}

/** Options CORS partagées (HTTP et WebSocket). */
export function getCorsOptions() {
  return {
    origin: getCorsOrigins(),
    credentials: true,
  };
}

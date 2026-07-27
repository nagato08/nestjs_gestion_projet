import * as Sentry from '@sentry/nestjs';

/**
 * Initialisation de Sentry.
 *
 * DOIT être importé en tout premier dans `main.ts` : Sentry instrumente les
 * modules Node (http, express, ...) au chargement, et n'attrape rien de ce qui
 * a été importé avant lui.
 *
 * Sans `SENTRY_DSN`, l'appel est ignoré et l'application démarre normalement :
 * le suivi d'erreurs est optionnel, jamais bloquant.
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,

    // Échantillonnage des traces de performance. 10 % en production suffit à
    // dégager les tendances sans saturer le quota.
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1,

    // Ne jamais transmettre le corps des requêtes ni les en-têtes : ils
    // contiennent mots de passe, jetons et données personnelles.
    sendDefaultPii: false,

    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
      }
      return event;
    },
  });
}

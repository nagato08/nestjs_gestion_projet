import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  method?: string;
  url?: string;
  userId?: string;
}

/**
 * Contexte propagé pendant toute la durée d'une requête.
 *
 * Permet au logger d'ajouter l'identifiant de corrélation sans que chaque
 * service ait à le transporter dans ses signatures.
 */
export const requestContext = new AsyncLocalStorage<RequestContext>();

/** Contexte de la requête courante, ou `undefined` hors requête (tâches, boot). */
export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

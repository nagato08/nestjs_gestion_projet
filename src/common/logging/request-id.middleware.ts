import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { requestContext } from './request-context';

/** En-tête porteur de l'identifiant de corrélation. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Attribue un identifiant unique à chaque requête.
 *
 * Toutes les lignes de log d'une même requête le portent, ce qui permet de
 * reconstituer un incident dans un agrégateur. Si un proxy en amont en fournit
 * déjà un, on le conserve pour ne pas casser la trace de bout en bout.
 *
 * L'identifiant est renvoyé au client : un utilisateur qui signale une erreur
 * peut communiquer l'identifiant exact de sa requête.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(
    req: Request & { requestId?: string },
    res: Response,
    next: NextFunction,
  ) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const requestId =
      (typeof incoming === 'string' && incoming.trim()) || randomUUID();

    req.requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    // La suite du traitement s'exécute dans le contexte : le logger y accède
    // sans que les services aient à transporter l'identifiant.
    requestContext.run(
      { requestId, method: req.method, url: req.originalUrl },
      () => next(),
    );
  }
}

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface RequestWithUser {
  user?: { id?: string };
  ip?: string;
  ips?: string[];
}

/**
 * Limitation de débit indexée sur l'utilisateur authentifié.
 *
 * Par défaut `@nestjs/throttler` compte par adresse IP. Derrière un reverse
 * proxy, tous les utilisateurs d'un même réseau partagent alors le même
 * compteur : un seul suffit à bloquer les autres. À l'inverse, un attaquant
 * authentifié changeant d'IP contourne la limite.
 *
 * On compte donc par identifiant utilisateur dès qu'il est connu, et on
 * retombe sur l'IP pour le trafic anonyme (login, inscription, reset).
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: RequestWithUser): Promise<string> {
    const userId = req.user?.id;
    if (userId) return Promise.resolve(`user:${userId}`);

    // `ips` est peuplé quand `trust proxy` est actif : la première entrée est
    // le client réel, les suivantes sont les proxys traversés.
    const ip = req.ips?.length ? req.ips[0] : req.ip;
    return Promise.resolve(`ip:${ip ?? 'inconnu'}`);
  }
}

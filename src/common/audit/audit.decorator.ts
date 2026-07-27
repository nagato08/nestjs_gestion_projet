import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const AUDIT_KEY = 'audit';

/** Requête enrichie par JwtAuthGuard et le middleware de corrélation. */
export interface AuditRequest extends Request {
  user?: { id?: string; sub?: string; email?: string };
  requestId?: string;
}

export interface AuditOptions {
  /** Verbe métier, ex. `project.delete`. Convention : `<domaine>.<action>`. */
  action: string;

  /** Type de l'objet visé, ex. `Project`. */
  targetType?: string;

  /**
   * Identifiant de la cible. Par défaut `params.id`.
   * Reçoit la requête et la réponse du handler (utile quand l'id est créé
   * pendant l'appel, comme à la création d'un utilisateur).
   */
  targetId?: (req: AuditRequest, result: unknown) => string | undefined;

  /** Contexte additionnel : ancien/nouveau rôle, nom de l'objet, etc. */
  metadata?: (
    req: AuditRequest,
    result: unknown,
  ) => Record<string, unknown> | undefined;
}

/**
 * Marque une route comme sensible : l'`AuditInterceptor` enregistre une entrée
 * dans le journal après son exécution réussie.
 *
 * @example
 * ```ts
 * @Delete(':id')
 * @Audit({ action: 'project.delete', targetType: 'Project' })
 * remove(@Param('id') id: string) {}
 * ```
 */
export const Audit = (options: AuditOptions) => SetMetadata(AUDIT_KEY, options);

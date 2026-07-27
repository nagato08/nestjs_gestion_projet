import { SetMetadata } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';

export const PROJECT_ROLE_KEY = 'projectRole';

/**
 * Rôle projet minimum requis sur une route.
 *
 * S'utilise avec {@link ProjectAccessGuard}, qui résout l'identifiant du
 * projet depuis les paramètres, le corps ou la query de la requête.
 *
 * @example
 * ```ts
 * @Patch(':id/settings')
 * @MinProjectRole(ProjectRole.ADMIN)
 * updateSettings(...) {}
 * ```
 */
export const MinProjectRole = (role: ProjectRole) =>
  SetMetadata(PROJECT_ROLE_KEY, role);

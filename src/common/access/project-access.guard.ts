import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ProjectRole } from '@prisma/client';
import { PROJECT_ROLE_KEY } from './project-roles.decorator';
import { ProjectAccessService } from './project-access.service';

interface RequestWithUser {
  user?: { id?: string };
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  projectRole?: ProjectRole;
}

/** Emplacements où l'identifiant de projet peut se trouver, par ordre de priorité. */
const PROJECT_ID_KEYS = ['projectId', 'id'] as const;

/**
 * Applique le rôle projet minimum déclaré par {@link MinProjectRole}.
 *
 * À utiliser après JwtAuthGuard. Le rôle effectif est déposé sur la requête
 * (`req.projectRole`) pour que le contrôleur puisse l'exploiter sans requête
 * supplémentaire.
 */
@Injectable()
export class ProjectAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRole = this.reflector.getAllAndOverride<ProjectRole>(
      PROJECT_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Aucune exigence déclarée : le guard ne s'applique pas.
    if (!requiredRole) return true;

    const request = context.switchToHttp().getRequest<RequestWithUser>();

    const userId = request.user?.id;
    if (!userId) throw new UnauthorizedException('Authentification requise');

    const projectId = this.resolveProjectId(request);
    if (!projectId) {
      throw new BadRequestException('Identifiant de projet manquant');
    }

    request.projectRole = await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      requiredRole,
    );

    return true;
  }

  private resolveProjectId(request: RequestWithUser): string | undefined {
    for (const source of [request.params, request.body, request.query]) {
      if (!source) continue;
      for (const key of PROJECT_ID_KEYS) {
        const value = source[key];
        if (typeof value === 'string' && value.length > 0) return value;
      }
    }
    return undefined;
  }
}

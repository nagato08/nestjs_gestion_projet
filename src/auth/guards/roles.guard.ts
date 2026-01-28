/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    // 1. Récupérer les rôles requis définis par le décorateur @Roles
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 2. Si aucun rôle n'est spécifié sur la route, on laisse passer
    if (!requiredRoles) {
      return true;
    }

    // 3. Récupérer l'utilisateur depuis la requête (injecté par le JwtAuthGuard)
    const { user } = context.switchToHttp().getRequest();

    // 4. Vérifier si l'utilisateur a au moins l'un des rôles requis
    return requiredRoles.some((role) => user?.role === role);
  }
}

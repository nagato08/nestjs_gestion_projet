/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

/**
 * Garde : seuls l'admin et le chef de projet (owner) peuvent accéder aux routes IA.
 * À utiliser après JwtAuthGuard (req.user doit être défini).
 * projectId peut être dans req.params.projectId ou req.body.projectId.
 */
@Injectable()
export class AiAllowedGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user?.id) {
      throw new ForbiddenException('Authentification requise');
    }

    if (user.role === Role.ADMIN) {
      return true;
    }

    const projectId = request.params?.projectId ?? request.body?.projectId;
    if (!projectId) {
      throw new ForbiddenException('projectId manquant');
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    });
    if (!project) {
      throw new NotFoundException('Projet introuvable');
    }
    if (project.ownerId !== user.id) {
      throw new ForbiddenException(
        "Seuls l'administrateur et le chef de projet peuvent utiliser l'IA.",
      );
    }
    return true;
  }
}

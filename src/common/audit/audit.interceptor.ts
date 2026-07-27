import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_KEY, AuditOptions, AuditRequest } from './audit.decorator';
import { AuditService } from './audit.service';

/**
 * Enregistre une entrée d'audit pour toute route décorée par `@Audit`.
 *
 * L'écriture a lieu **après** le succès du handler : une action refusée ou en
 * erreur ne laisse pas de fausse trace d'exécution. L'appel n'est pas attendu
 * (`void`) pour ne pas rallonger la réponse ; `AuditService` avale ses propres
 * erreurs.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<AuditOptions>(AUDIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<AuditRequest>();

    return next.handle().pipe(
      tap((result) => {
        void this.auditService.record({
          action: options.action,
          userId: request.user?.id ?? request.user?.sub ?? null,
          userEmail: request.user?.email ?? null,
          targetType: options.targetType ?? null,
          targetId: this.resolveTargetId(options, request, result),
          metadata: options.metadata?.(request, result) ?? null,
          ip: request.ip ?? null,
          userAgent: request.headers['user-agent'] ?? null,
          requestId: request.requestId ?? null,
        });
      }),
    );
  }

  /** Id explicite si fourni, sinon `params.id` par convention REST. */
  private resolveTargetId(
    options: AuditOptions,
    request: AuditRequest,
    result: unknown,
  ): string | null {
    if (options.targetId) {
      return options.targetId(request, result) ?? null;
    }
    const params = request.params as Record<string, string> | undefined;
    return params?.id ?? null;
  }
}

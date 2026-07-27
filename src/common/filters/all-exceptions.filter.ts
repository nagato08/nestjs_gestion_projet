/* eslint-disable @typescript-eslint/no-base-to-string */
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { Request, Response } from 'express';
import { getRequestContext } from '../logging/request-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? (exception.getResponse() as string | { message?: string | string[] })
        : exception instanceof Error
          ? exception.message
          : 'Erreur interne';

    const body =
      typeof message === 'object' && message !== null && 'message' in message
        ? (message as { message: string | string[] }).message
        : message;

    const requestId = getRequestContext()?.requestId;

    this.logger.error(
      `${request.method} ${request.url} ${status} - ${String(body)}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    // Seules les erreurs serveur remontent à Sentry. Les 4xx sont des
    // réponses métier attendues (validation, droits) : les envoyer noierait
    // les vraies pannes sous le bruit.
    if (status >= Number(HttpStatus.INTERNAL_SERVER_ERROR)) {
      Sentry.withScope((scope) => {
        if (requestId) scope.setTag('requestId', requestId);
        scope.setTag('method', request.method);
        scope.setTag('route', request.url);
        Sentry.captureException(exception);
      });
    }

    response.status(status).json({
      statusCode: status,
      message: Array.isArray(body) ? body : [body],
      // Permet à l'utilisateur de citer l'identifiant exact de sa requête
      // lorsqu'il signale un incident.
      requestId,
      error:
        exception instanceof HttpException
          ? exception.name
          : (HttpStatus[status] ?? 'Internal Server Error'),
    });
  }
}

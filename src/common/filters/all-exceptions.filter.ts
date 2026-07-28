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
import { MulterError } from 'multer';
import { getRequestContext } from '../logging/request-context';
import { DOCUMENT_MAX_BYTES, formatBytes } from '../upload/upload.config';

/**
 * Traduit une erreur multer en réponse HTTP intelligible.
 *
 * Un fichier trop volumineux est une erreur du client, pas une panne : sans
 * cette conversion il ressortait en 500, et l'utilisateur n'avait aucun moyen
 * de comprendre ce qu'on lui reprochait.
 */
function describeMulterError(error: MulterError): {
  status: number;
  message: string;
} {
  switch (error.code) {
    case 'LIMIT_FILE_SIZE':
      return {
        status: HttpStatus.PAYLOAD_TOO_LARGE,
        message: `Fichier trop volumineux (maximum ${formatBytes(DOCUMENT_MAX_BYTES)})`,
      };
    case 'LIMIT_FILE_COUNT':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'Un seul fichier peut être envoyé à la fois',
      };
    case 'LIMIT_UNEXPECTED_FILE':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Champ de fichier inattendu (${error.field ?? 'inconnu'})`,
      };
    default:
      return {
        status: HttpStatus.BAD_REQUEST,
        message: `Envoi de fichier refusé (${error.code})`,
      };
  }
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Les erreurs multer surviennent hors du cycle habituel : elles ne sont
    // pas des HttpException et tomberaient donc en 500.
    const multer =
      exception instanceof MulterError ? describeMulterError(exception) : null;

    const status = multer
      ? multer.status
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = multer
      ? multer.message
      : exception instanceof HttpException
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

import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { getRequestContext } from './request-context';

/**
 * Logger applicatif au format JSON, une ligne par événement.
 *
 * Le logger par défaut de Nest produit du texte coloré, illisible pour un
 * agrégateur (Loki, ELK, CloudWatch...). Ici chaque ligne est un objet JSON
 * indexable, enrichi de l'identifiant de corrélation de la requête courante.
 *
 * En développement on garde l'affichage lisible de Nest : le JSON n'apporte
 * rien dans un terminal et gêne la lecture.
 */
export class JsonLogger extends ConsoleLogger {
  private readonly useJson = process.env.NODE_ENV === 'production';

  protected printMessages(
    messages: unknown[],
    context = '',
    logLevel: LogLevel = 'log',
    writeStreamType?: 'stdout' | 'stderr',
  ): void {
    if (!this.useJson) {
      super.printMessages(messages, context, logLevel, writeStreamType);
      return;
    }

    const requestCtx = getRequestContext();
    const stream =
      writeStreamType === 'stderr' ? process.stderr : process.stdout;

    for (const message of messages) {
      const line = JSON.stringify({
        timestamp: new Date().toISOString(),
        level: logLevel,
        context: context || undefined,
        message: this.stringify(message),
        requestId: requestCtx?.requestId,
        method: requestCtx?.method,
        url: requestCtx?.url,
        userId: requestCtx?.userId,
      });

      stream.write(`${line}\n`);
    }
  }

  /** Les objets sont sérialisés ; les erreurs conservent leur pile. */
  private stringify(message: unknown): string {
    if (typeof message === 'string') return message;
    if (message instanceof Error) return message.stack ?? message.message;

    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
}

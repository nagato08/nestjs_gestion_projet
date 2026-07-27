/* eslint-disable @typescript-eslint/no-floating-promises */
// Doit rester le tout premier import : Sentry instrumente les modules Node au
// chargement et n'intercepte rien de ce qui est importé avant lui.
import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import { getCorsOptions } from './common/cors.config';
import { JsonLogger } from './common/logging/json.logger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Logs JSON en production (exploitables par un agrégateur),
    // affichage lisible en développement.
    logger: new JsonLogger(),
  });

  // L'API est servie derrière Nginx Proxy Manager. Sans cette option, Express
  // voit l'IP du proxy pour toutes les requêtes : le rate-limit par IP
  // compterait alors l'ensemble des visiteurs sur un seul compteur.
  // La valeur 1 = un seul proxy de confiance devant l'application.
  app.set('trust proxy', 1);

  // Lecture des cookies (refresh token en httpOnly)
  app.use(cookieParser());

  app.enableCors({
    ...getCorsOptions(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  const config = new DocumentBuilder()
    .setTitle('Formation NestJS')
    .setVersion('1.0')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document, {
    swaggerUrl: 'swagger-json',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Ajoute '0.0.0.0' comme deuxième argument
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
bootstrap();

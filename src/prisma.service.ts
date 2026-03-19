// import 'dotenv/config';
// import { Injectable } from '@nestjs/common';
// import { PrismaClient } from '@prisma/client';
// import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// @Injectable()
// export class PrismaService extends PrismaClient {
//   constructor() {
//     const url = process.env.DATABASE_URL ?? 'file:./prisma/dev.db';
//     const adapter = new PrismaBetterSqlite3({ url });
//     super({ adapter });
//   }
// }
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

// On s'assure que le .env est chargé
dotenv.config();

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // 1. Création du pool de connexion avec la lib 'pg'
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });

    // 2. Création de l'adapter Prisma pour PostgreSQL
    const adapter = new PrismaPg(pool);

    // 3. Passage de l'adapter au constructeur parent
    super({ adapter });
    this.logger.log('PrismaService instancié avec Driver Adapter');
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connexion à la base de données réussie');
    } catch (error) {
      this.logger.error('Erreur de connexion DB dans onModuleInit', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

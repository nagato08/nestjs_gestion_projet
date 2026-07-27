import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * Module global : l'audit est transverse, tout module peut l'injecter sans
 * l'importer, et l'intercepteur est enregistré globalement dans `AppModule`.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, PrismaService],
  exports: [AuditService],
})
export class AuditModule {}

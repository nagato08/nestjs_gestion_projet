import { Global, Module } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from './project-access.service';

/**
 * Module global : le contrôle d'accès par projet est transverse, tous les
 * modules métier l'injectent sans avoir à l'importer explicitement.
 */
@Global()
@Module({
  providers: [ProjectAccessService, PrismaService],
  exports: [ProjectAccessService],
})
export class AccessModule {}

import { Global, Module } from '@nestjs/common';
import { ProjectSettingsController } from './project-settings.controller';
import { ProjectSettingsService } from './project-settings.service';
import { PrismaService } from 'src/prisma.service';

/**
 * Global : WorkloadService (module planning) en a besoin pour les seuils de
 * charge, et d'autres consommateurs suivront (alertes, feuille de route)
 * sans qu'il faille réimporter ce module partout.
 *
 * ProjectAccessService n'est volontairement pas re-fourni ici : AccessModule
 * est déjà global et l'exporte, comme dans tous les autres modules du projet.
 */
@Global()
@Module({
  controllers: [ProjectSettingsController],
  providers: [ProjectSettingsService, PrismaService],
  exports: [ProjectSettingsService],
})
export class ProjectSettingsModule {}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { UpdateProjectSettingsDto } from './dto/update-project-settings.dto';

/**
 * Paramètres de pilotage d'un projet : calendrier ouvré, seuils d'alerte,
 * configuration générale.
 *
 * Alimente aujourd'hui le calcul de charge (`WorkloadService`), qui lit
 * `hoursPerDay` et `workingDays` au lieu des constantes 8h/40h en dur.
 *
 * Volontairement PAS encore branché sur la replanification du Gantt
 * (`ScheduleService`) : celle-ci raisonne en jours calendaires bruts, et la
 * faire respecter jours fériés et week-ends demanderait de reconvertir toute
 * son arithmétique en jours ouvrés. C'est un chantier à part, pas une
 * extension de ce service.
 */
@Injectable()
export class ProjectSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /**
   * Récupère les paramètres du projet, créés avec leurs valeurs par défaut à
   * la première consultation — même logique que `CompanySettings` : ne pas
   * forcer une ligne pour des projets qui ne personnalisent jamais rien.
   */
  async getSettings(projectId: string, userId: string) {
    await this.projectAccess.requireMember(projectId, userId);

    const existing = await this.prisma.projectSettings.findUnique({
      where: { projectId },
    });
    if (existing) return existing;

    return this.prisma.projectSettings.create({ data: { projectId } });
  }

  /**
   * Modifie les paramètres. Réservé aux gestionnaires du projet : ces
   * réglages pilotent des calculs (charge, alertes) qui engagent toute
   * l'équipe, pas une préférence individuelle.
   */
  async updateSettings(
    projectId: string,
    userId: string,
    dto: UpdateProjectSettingsDto,
  ) {
    await this.projectAccess.requireManager(projectId, userId);

    const data = {
      ...dto,
      publicHolidays: dto.publicHolidays?.map((d) => new Date(d)),
    };

    return this.prisma.projectSettings.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
    });
  }
}

import { WorkloadService } from './workload.service';
import { PrismaService } from 'src/prisma.service';
import { ProjectSettingsService } from 'src/project-settings/project-settings.service';

/**
 * Seuil de surcharge.
 *
 * Avant les paramètres de projet, ce seuil était une constante en dur
 * (8h/jour, 40h/semaine) identique pour tous les projets. Le point à
 * protéger : un projet qui personnalise son calendrier (un chantier à
 * 10h/jour, par exemple) doit voir son seuil recalculé en conséquence, et la
 * vue globale sans projet doit continuer à utiliser les anciennes constantes.
 */

const PROJECT_ID = 'projet-1';
const USER_ID = 'utilisateur-1';

function buildService(
  settings: { hoursPerDay: number; workingDays: number[] } | null,
) {
  const prisma = {
    projectMember: { findMany: jest.fn().mockResolvedValue([]) },
    timeEntry: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const projectSettings = {
    getSettings: jest.fn().mockResolvedValue(settings),
  };

  const service = new WorkloadService(
    prisma as unknown as PrismaService,
    projectSettings as unknown as ProjectSettingsService,
  );

  return { service };
}

describe('Seuil de surcharge', () => {
  it('utilise les heures par jour du projet pour le seuil journalier', async () => {
    const { service } = buildService({
      hoursPerDay: 10,
      workingDays: [1, 2, 3, 4, 5],
    });

    const result = await service.getWorkload(
      USER_ID,
      '2026-01-01',
      '2026-01-07',
      PROJECT_ID,
      'day',
    );

    expect(result.overloadThresholdHours).toBe(10);
  });

  it('multiplie les heures par jour par le nombre de jours ouvrés pour le seuil hebdomadaire', async () => {
    // Semaine de 6 jours ouvrés à 10h : 60h, pas les 40h par défaut.
    const { service } = buildService({
      hoursPerDay: 10,
      workingDays: [1, 2, 3, 4, 5, 6],
    });

    const result = await service.getWorkload(
      USER_ID,
      '2026-01-01',
      '2026-01-07',
      PROJECT_ID,
      'week',
    );

    expect(result.overloadThresholdHours).toBe(60);
  });

  it('retombe sur les constantes historiques pour la vue globale sans projet', async () => {
    const { service } = buildService(null);

    const result = await service.getWorkload(
      USER_ID,
      '2026-01-01',
      '2026-01-07',
    );

    expect(result.overloadThresholdHours).toBe(8);
  });
});

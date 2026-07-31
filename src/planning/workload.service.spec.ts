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

type MockSettings = {
  hoursPerDay: number;
  workingDays: number[];
  chargeUnit?: 'HOURS' | 'PERSON_DAYS';
  machineCapacityPerDay?: number;
} | null;

function buildService(settings: MockSettings, entries: unknown[] = []) {
  const prisma = {
    projectMember: { findMany: jest.fn().mockResolvedValue([]) },
    timeEntry: { findMany: jest.fn().mockResolvedValue(entries) },
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

function timeEntry(opts: {
  userId: string;
  firstName: string;
  lastName: string;
  endTime: string;
  durationMinutes: number;
}) {
  return {
    duration: opts.durationMinutes,
    endTime: new Date(opts.endTime),
    user: {
      id: opts.userId,
      firstName: opts.firstName,
      lastName: opts.lastName,
      avatar: null,
    },
  };
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

describe("Unité d'affichage", () => {
  it('convertit les heures en jours-homme quand le projet le demande', async () => {
    const { service } = buildService(
      {
        hoursPerDay: 8,
        workingDays: [1, 2, 3, 4, 5],
        chargeUnit: 'PERSON_DAYS',
      },
      [
        timeEntry({
          userId: 'utilisateur-2',
          firstName: 'Awa',
          lastName: 'Ndiaye',
          endTime: '2026-01-05T10:00:00.000Z',
          durationMinutes: 480, // 8h = 1 jour-homme à 8h/jour
        }),
      ],
    );

    const result = await service.getWorkload(
      USER_ID,
      '2026-01-01',
      '2026-01-07',
      PROJECT_ID,
      'day',
    );

    expect(result.chargeUnit).toBe('PERSON_DAYS');
    expect(result.entries[0].hours).toBe(1);
    expect(result.totalHours).toBe(1);
  });

  it('laisse les heures brutes inchangées par défaut', async () => {
    const { service } = buildService(
      { hoursPerDay: 8, workingDays: [1, 2, 3, 4, 5] },
      [
        timeEntry({
          userId: 'utilisateur-2',
          firstName: 'Awa',
          lastName: 'Ndiaye',
          endTime: '2026-01-05T10:00:00.000Z',
          durationMinutes: 480,
        }),
      ],
    );

    const result = await service.getWorkload(
      USER_ID,
      '2026-01-01',
      '2026-01-07',
      PROJECT_ID,
      'day',
    );

    expect(result.chargeUnit).toBe('HOURS');
    expect(result.entries[0].hours).toBe(8);
  });
});

describe('Capacité machine', () => {
  it("reste absente quand la ressource n'est pas suivie (0, le défaut)", async () => {
    const { service } = buildService({
      hoursPerDay: 8,
      workingDays: [1, 2, 3, 4, 5],
      machineCapacityPerDay: 0,
    });

    const result = await service.getWorkload(
      USER_ID,
      '2026-01-01',
      '2026-01-07',
      PROJECT_ID,
      'day',
    );

    expect(result.machine).toBeNull();
  });

  it("signale un dépassement collectif même si aucun individu n'est en surcharge", async () => {
    // Seuil individuel 8h/jour : personne n'est en surcharge pris seul (6h
    // chacun). Mais la machine ne tient que 10h/jour, et l'équipe cumule 12h
    // ce jour-là — c'est elle, pas les individus, qui est à l'arrêt.
    const { service } = buildService(
      {
        hoursPerDay: 8,
        workingDays: [1, 2, 3, 4, 5],
        machineCapacityPerDay: 10,
      },
      [
        timeEntry({
          userId: 'utilisateur-a',
          firstName: 'A',
          lastName: 'A',
          endTime: '2026-01-05T09:00:00.000Z',
          durationMinutes: 360,
        }),
        timeEntry({
          userId: 'utilisateur-b',
          firstName: 'B',
          lastName: 'B',
          endTime: '2026-01-05T09:00:00.000Z',
          durationMinutes: 360,
        }),
      ],
    );

    const result = await service.getWorkload(
      USER_ID,
      '2026-01-01',
      '2026-01-07',
      PROJECT_ID,
      'day',
    );

    expect(result.entries.every((e) => !e.isOverloaded)).toBe(true);
    expect(result.machine).not.toBeNull();
    expect(result.machine!.capacityPerPeriod).toBe(10);
    const day = result.machine!.byPeriod.find((p) => p.date === '2026-01-05');
    expect(day?.hours).toBe(12);
    expect(day?.overCapacity).toBe(true);
  });
});

describe('Bornes de la période', () => {
  it('étend la date de fin à la fin de journée pour inclure les pointages du jour même', async () => {
    const { service } = buildService(null);
    const prisma = (
      service as unknown as { prisma: { timeEntry: { findMany: jest.Mock } } }
    ).prisma;

    await service.getWorkload(USER_ID, '2026-01-01', '2026-01-07');

    const call = prisma.timeEntry.findMany.mock.calls[0][0] as {
      where: { endTime: { lte: Date } };
    };
    const upperBound = call.where.endTime.lte;

    // Minuit exclurait tout pointage fait plus tard le 7 janvier — celui
    // qu'on vient justement de créer aujourd'hui.
    expect(upperBound.getHours()).toBe(23);
    expect(upperBound.getMinutes()).toBe(59);
  });
});

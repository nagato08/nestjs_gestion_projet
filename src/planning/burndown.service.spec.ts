import { NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { BurndownService } from './burndown.service';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

/**
 * Courbe d'avancement (burndown).
 *
 * Deux propriétés valent d'être verrouillées ici :
 *
 * - la courbe se fonde sur `completedAt`, figé au passage en DONE, et non sur
 *   `updatedAt` qui bougeait à chaque écriture et réécrivait l'historique
 *   après coup ;
 * - une tâche terminée dans la journée doit apparaître brûlée le jour même,
 *   la comparaison portant sur la fin du jour et non son début.
 */

const PROJECT_ID = 'projet-1';
const USER_ID = 'utilisateur-1';

/** Trois jours pleins : le 10, le 11 et le 12 janvier. */
const START = new Date('2026-01-10T00:00:00.000Z');
const END = new Date('2026-01-12T00:00:00.000Z');

function jour(iso: string, heure = '12:00:00') {
  return new Date(`${iso}T${heure}.000Z`);
}

interface TaskRow {
  id: string;
  storyPoints: number | null;
  status: TaskStatus;
  createdAt: Date;
  completedAt: Date | null;
}

function buildService(tasks: TaskRow[]) {
  const prisma = {
    project: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ startDate: START, endDate: END }),
    },
    sprint: { findFirst: jest.fn().mockResolvedValue(null) },
    task: { findMany: jest.fn().mockResolvedValue(tasks) },
  };
  const access = { requireMember: jest.fn().mockResolvedValue('OWNER') };

  const service = new BurndownService(
    prisma as unknown as PrismaService,
    access as unknown as ProjectAccessService,
  );

  return { service, prisma, access };
}

function task(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: `tache-${Math.random()}`,
    storyPoints: null,
    status: TaskStatus.TODO,
    createdAt: START,
    completedAt: null,
    ...overrides,
  };
}

describe('Courbe d’avancement', () => {
  it('compte en nombre de tâches quand aucune n’est estimée', async () => {
    const { service } = buildService([task(), task(), task()]);

    const data = await service.getBurndownData(PROJECT_ID, USER_ID);

    expect(data.useStoryPoints).toBe(false);
    expect(data.totalWork).toBe(3);
  });

  it('compte en points dès qu’au moins une tâche est estimée', async () => {
    const { service } = buildService([
      task({ storyPoints: 5 }),
      task({ storyPoints: 3 }),
    ]);

    const data = await service.getBurndownData(PROJECT_ID, USER_ID);

    expect(data.useStoryPoints).toBe(true);
    expect(data.totalWork).toBe(8);
  });

  it('montre une tâche brûlée le jour même où elle est terminée', async () => {
    // Terminée le 11 à midi : le reste doit tomber dès le 11, pas le 12.
    const { service } = buildService([
      task({
        status: TaskStatus.DONE,
        completedAt: jour('2026-01-11'),
      }),
      task(),
    ]);

    const data = await service.getBurndownData(PROJECT_ID, USER_ID);

    expect(data.dates).toEqual(['2026-01-10', '2026-01-11', '2026-01-12']);
    expect(data.actual).toEqual([2, 1, 1]);
  });

  it('ignore une tâche terminée après la fenêtre observée', async () => {
    const { service } = buildService([
      task({ status: TaskStatus.DONE, completedAt: jour('2026-02-01') }),
    ]);

    const data = await service.getBurndownData(PROJECT_ID, USER_ID);

    // Elle reste due sur toute la période : sa complétion est postérieure.
    expect(data.actual).toEqual([1, 1, 1]);
  });

  it('décroît linéairement du total vers zéro sur la courbe idéale', async () => {
    const { service } = buildService([task(), task(), task(), task()]);

    const data = await service.getBurndownData(PROJECT_ID, USER_ID);

    expect(data.ideal[0]).toBe(4);
    expect(data.ideal[data.ideal.length - 1]).toBe(0);
  });

  it('n’ouvre la courbe qu’aux membres du projet', async () => {
    const { service, access } = buildService([task()]);

    await service.getBurndownData(PROJECT_ID, USER_ID);

    expect(access.requireMember).toHaveBeenCalledWith(PROJECT_ID, USER_ID);
  });

  it('signale un sprint introuvable plutôt que de retomber sur le projet', async () => {
    const { service } = buildService([task()]);

    await expect(
      service.getBurndownData(
        PROJECT_ID,
        USER_ID,
        undefined,
        undefined,
        'sprint-inexistant',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});

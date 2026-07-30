import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PhaseService } from './phase.service';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

const PROJECT_ID = 'projet-1';
const PHASE_ID = 'phase-1';
const USER_ID = 'utilisateur-1';

function buildService() {
  const prisma = {
    phase: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const access = {
    requireMember: jest.fn().mockResolvedValue('VIEWER'),
    requireProjectRole: jest.fn().mockResolvedValue('ADMIN'),
  };

  const service = new PhaseService(
    prisma as unknown as PrismaService,
    access as unknown as ProjectAccessService,
  );

  return { service, prisma, access };
}

describe('Phases de la feuille de route', () => {
  it('un VIEWER peut consulter la liste des phases', async () => {
    const { service, prisma, access } = buildService();
    prisma.phase.findMany.mockResolvedValue([]);

    await service.list(PROJECT_ID, USER_ID);

    expect(access.requireMember).toHaveBeenCalledWith(PROJECT_ID, USER_ID);
  });

  it('trie les phases par ordre explicite puis par date de début', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findMany.mockResolvedValue([]);

    await service.list(PROJECT_ID, USER_ID);

    expect(prisma.phase.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ order: 'asc' }, { startDate: 'asc' }],
      }),
    );
  });

  describe('avancement', () => {
    /** Phase dont l'échéance est déjà passée, avec les tâches fournies. */
    function pastPhase(tasks: { status: TaskStatus }[]) {
      const endDate = new Date();
      endDate.setDate(endDate.getDate() - 5);
      return { id: PHASE_ID, projectId: PROJECT_ID, endDate, tasks };
    }

    it('compte toujours en tâches, jamais en points', async () => {
      // Une phase peut couvrir plusieurs sprints à l'usage des points
      // hétérogène : mélanger ces échelles produirait un pourcentage sans
      // signification. Le résultat ne doit donc jamais dépendre de
      // storyPoints, qui n'est même pas sélectionné par la requête.
      const { service, prisma } = buildService();
      prisma.phase.findMany.mockResolvedValue([
        {
          id: PHASE_ID,
          projectId: PROJECT_ID,
          endDate: new Date(Date.now() + 86_400_000),
          tasks: [
            { status: TaskStatus.DONE },
            { status: TaskStatus.DONE },
            { status: TaskStatus.TODO },
            { status: TaskStatus.DOING },
          ],
        },
      ]);

      const [result] = await service.list(PROJECT_ID, USER_ID);

      expect(result.taskCount).toBe(4);
      expect(result.doneCount).toBe(2);
      expect(result.progressPercent).toBe(50);
    });

    it('affiche 0 % pour une phase sans aucune tâche', async () => {
      const { service, prisma } = buildService();
      prisma.phase.findMany.mockResolvedValue([
        {
          id: PHASE_ID,
          projectId: PROJECT_ID,
          endDate: new Date(),
          tasks: [],
        },
      ]);

      const [result] = await service.list(PROJECT_ID, USER_ID);

      expect(result.progressPercent).toBe(0);
    });

    it('signale en retard une phase échue avec du travail restant', async () => {
      const { service, prisma } = buildService();
      prisma.phase.findMany.mockResolvedValue([
        pastPhase([{ status: TaskStatus.DONE }, { status: TaskStatus.TODO }]),
      ]);

      const [result] = await service.list(PROJECT_ID, USER_ID);

      expect(result.isLate).toBe(true);
    });

    it('ne signale pas de retard si toutes les tâches sont terminées', async () => {
      const { service, prisma } = buildService();
      prisma.phase.findMany.mockResolvedValue([
        pastPhase([{ status: TaskStatus.DONE }, { status: TaskStatus.DONE }]),
      ]);

      const [result] = await service.list(PROJECT_ID, USER_ID);

      expect(result.isLate).toBe(false);
    });

    it('ne signale jamais en retard une phase sans aucune tâche', async () => {
      // Une phase vide n'a rien pu manquer : la signaler en retard serait
      // trompeur, l'échéance dépassée ne reflète alors qu'une phase jamais
      // remplie plutôt qu'un vrai dérapage.
      const { service, prisma } = buildService();
      prisma.phase.findMany.mockResolvedValue([pastPhase([])]);

      const [result] = await service.list(PROJECT_ID, USER_ID);

      expect(result.isLate).toBe(false);
    });

    it('ne signale pas de retard tant que l’échéance n’est pas dépassée', async () => {
      const { service, prisma } = buildService();
      prisma.phase.findMany.mockResolvedValue([
        {
          id: PHASE_ID,
          projectId: PROJECT_ID,
          endDate: new Date(Date.now() + 86_400_000),
          tasks: [{ status: TaskStatus.TODO }],
        },
      ]);

      const [result] = await service.list(PROJECT_ID, USER_ID);

      expect(result.isLate).toBe(false);
    });
  });

  it('refuse une phase dont la fin précède le début', async () => {
    const { service } = buildService();

    await expect(
      service.create(PROJECT_ID, USER_ID, {
        name: 'Conception',
        startDate: '2026-09-30',
        endDate: '2026-09-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse une phase aux dates identiques', async () => {
    const { service } = buildService();

    await expect(
      service.create(PROJECT_ID, USER_ID, {
        name: 'Conception',
        startDate: '2026-09-01',
        endDate: '2026-09-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('exige un rôle ADMIN projet pour créer une phase', async () => {
    const { service, prisma, access } = buildService();
    prisma.phase.create.mockResolvedValue({ id: PHASE_ID });

    await service.create(PROJECT_ID, USER_ID, {
      name: 'Conception',
      startDate: '2026-09-01',
      endDate: '2026-09-30',
    });

    expect(access.requireProjectRole).toHaveBeenCalledWith(
      PROJECT_ID,
      USER_ID,
      'ADMIN',
    );
  });

  it('conserve la date de début existante si seule la fin est modifiée', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findFirst.mockResolvedValue({
      id: PHASE_ID,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'),
    });
    prisma.phase.update.mockResolvedValue({ id: PHASE_ID });

    await service.update(PROJECT_ID, PHASE_ID, USER_ID, {
      endDate: '2026-10-15',
    });

    const call = prisma.phase.update.mock.calls[0][0] as {
      data: { startDate: Date; endDate: Date };
    };
    expect(call.data.startDate).toEqual(new Date('2026-09-01'));
    expect(call.data.endDate).toEqual(new Date('2026-10-15'));
  });

  it('refuse une modification qui ferait précéder la fin au début', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findFirst.mockResolvedValue({
      id: PHASE_ID,
      startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'),
    });

    await expect(
      service.update(PROJECT_ID, PHASE_ID, USER_ID, {
        endDate: '2026-08-01',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('signale une phase introuvable dans ce projet', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findFirst.mockResolvedValue(null);

    await expect(
      service.update(PROJECT_ID, PHASE_ID, USER_ID, { name: 'x' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('supprime une phase existante', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findFirst.mockResolvedValue({ id: PHASE_ID });

    await service.remove(PROJECT_ID, PHASE_ID, USER_ID);

    expect(prisma.phase.delete).toHaveBeenCalledWith({
      where: { id: PHASE_ID },
    });
  });

  it('refuse de supprimer une phase d’un autre projet', async () => {
    const { service, prisma } = buildService();
    // findFirst filtre déjà sur { id, projectId } : simuler l'absence de
    // résultat quand la phase existe mais dans un autre projet.
    prisma.phase.findFirst.mockResolvedValue(null);

    await expect(service.remove(PROJECT_ID, PHASE_ID, USER_ID)).rejects.toThrow(
      NotFoundException,
    );
    expect(prisma.phase.delete).not.toHaveBeenCalled();
  });
});

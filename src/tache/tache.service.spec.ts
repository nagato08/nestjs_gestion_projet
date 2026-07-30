import { ConflictException, NotFoundException } from '@nestjs/common';
import { Priority, TaskStatus } from '@prisma/client';
import { TacheService } from './tache.service';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { ChecklistService } from './checklist.service';
import { NotificationHelperService } from 'src/notification/notification-helper.service';

/**
 * Date de complétion d'une tâche.
 *
 * Cette date doit être figée au passage en DONE. Le burndown s'appuyait
 * auparavant sur `updatedAt`, si bien que toute modification ultérieure d'une
 * tâche terminée déplaçait sa complétion et réécrivait l'historique de la
 * courbe. La garde ci-dessous est ce qui empêche ce défaut de revenir : sans
 * elle, resauvegarder une tâche déjà terminée repousserait sa date.
 */

function completionPatch(
  previous: TaskStatus,
  next: TaskStatus | undefined,
): { completedAt?: Date | null } {
  const service = Object.create(TacheService.prototype) as TacheService;
  return (
    service as unknown as {
      completionPatch: (
        p: TaskStatus,
        n: TaskStatus | undefined,
      ) => { completedAt?: Date | null };
    }
  ).completionPatch(previous, next);
}

describe('Date de complétion d’une tâche', () => {
  it('est posée au passage en terminé', () => {
    const patch = completionPatch(TaskStatus.DOING, TaskStatus.DONE);

    expect(patch.completedAt).toBeInstanceOf(Date);
  });

  it('n’est pas repoussée quand une tâche déjà terminée est resauvegardée', () => {
    const patch = completionPatch(TaskStatus.DONE, TaskStatus.DONE);

    // Champ absent : la mise à jour ne touchera pas à la colonne.
    expect(patch).not.toHaveProperty('completedAt');
  });

  it('est effacée quand la tâche ressort de terminé', () => {
    const patch = completionPatch(TaskStatus.DONE, TaskStatus.DOING);

    expect(patch.completedAt).toBeNull();
  });

  it('reste intacte lors d’un changement sans rapport avec le terminé', () => {
    const patch = completionPatch(TaskStatus.TODO, TaskStatus.DOING);

    expect(patch).not.toHaveProperty('completedAt');
  });

  it('reste intacte quand la mise à jour ne porte pas sur le statut', () => {
    const patch = completionPatch(TaskStatus.DONE, undefined);

    expect(patch).not.toHaveProperty('completedAt');
  });
});

/**
 * Rattachement d'une tâche à une phase de la feuille de route.
 *
 * Le point à protéger : l'identifiant de phase seul ne prouve rien. Sans
 * cette vérification, rien n'empêcherait de rattacher une tâche à la phase
 * d'un autre projet.
 */
const PROJECT_ID = 'projet-1';
const OTHER_PROJECT_ID = 'projet-2';
const TASK_ID = 'tache-1';
const PHASE_ID = 'phase-1';
const USER_ID = 'utilisateur-1';

function buildService() {
  const prisma = {
    phase: { findUnique: jest.fn() },
    task: {
      create: jest.fn().mockResolvedValue({ id: TASK_ID }),
      update: jest.fn().mockResolvedValue({ id: TASK_ID }),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ status: TaskStatus.TODO }),
    },
    project: { findUnique: jest.fn() },
  };
  const projectAccess = {
    requireManager: jest.fn().mockResolvedValue('ADMIN'),
    requireTaskWriteAccess: jest
      .fn()
      .mockResolvedValue({ id: TASK_ID, projectId: PROJECT_ID, role: 'ADMIN' }),
  };

  const service = new TacheService(
    prisma as unknown as PrismaService,
    projectAccess as unknown as ProjectAccessService,
    {} as ChecklistService,
    { notifyTaskAssigned: jest.fn() } as unknown as NotificationHelperService,
  );

  return { service, prisma, projectAccess };
}

describe('Rattachement d’une tâche à une phase', () => {
  it('refuse une phase inexistante à la création', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findUnique.mockResolvedValue(null);

    await expect(
      service.createTask(USER_ID, {
        title: 'Tâche',
        priority: Priority.MEDIUM,
        projectId: PROJECT_ID,
        phaseId: PHASE_ID,
      }),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('refuse une phase appartenant à un autre projet à la création', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findUnique.mockResolvedValue({ projectId: OTHER_PROJECT_ID });

    await expect(
      service.createTask(USER_ID, {
        title: 'Tâche',
        priority: Priority.MEDIUM,
        projectId: PROJECT_ID,
        phaseId: PHASE_ID,
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('accepte une phase du même projet à la création', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findUnique.mockResolvedValue({ projectId: PROJECT_ID });

    await service.createTask(USER_ID, {
      title: 'Tâche',
      priority: Priority.MEDIUM,
      projectId: PROJECT_ID,
      phaseId: PHASE_ID,
    });

    expect(prisma.task.create).toHaveBeenCalled();
  });

  it('ne vérifie aucune phase quand aucune n’est fournie', async () => {
    const { service, prisma } = buildService();

    await service.createTask(USER_ID, {
      title: 'Tâche',
      priority: Priority.MEDIUM,
      projectId: PROJECT_ID,
    });

    expect(prisma.phase.findUnique).not.toHaveBeenCalled();
    expect(prisma.task.create).toHaveBeenCalled();
  });

  it('refuse une phase d’un autre projet à la modification', async () => {
    const { service, prisma } = buildService();
    prisma.phase.findUnique.mockResolvedValue({ projectId: OTHER_PROJECT_ID });

    await expect(
      service.updateTask(TASK_ID, USER_ID, { phaseId: PHASE_ID }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it('détache une tâche de sa phase avec une chaîne vide', async () => {
    const { service, prisma } = buildService();

    await service.updateTask(TASK_ID, USER_ID, { phaseId: '' });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ phaseId: null }),
      }),
    );
  });
});

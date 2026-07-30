import { ConflictException, NotFoundException } from '@nestjs/common';
import { IssueStatus } from '@prisma/client';
import { ProjectIssueService } from './project-issue.service';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

const PROJECT_ID = 'projet-1';
const OTHER_PROJECT_ID = 'projet-2';
const TASK_ID = 'tache-1';
const ISSUE_ID = 'difficulte-1';
const REPORTER_ID = 'utilisateur-1';
const OTHER_USER_ID = 'utilisateur-2';

function buildService() {
  const prisma = {
    task: { findUnique: jest.fn() },
    projectIssue: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const access = {
    requireMember: jest.fn().mockResolvedValue('VIEWER'),
    requireContributor: jest.fn().mockResolvedValue('MEMBER'),
    requireManager: jest.fn().mockResolvedValue('ADMIN'),
  };

  const service = new ProjectIssueService(
    prisma as unknown as PrismaService,
    access as unknown as ProjectAccessService,
  );

  return { service, prisma, access };
}

describe('Journal des difficultés', () => {
  describe('consultation', () => {
    it('un VIEWER peut consulter les difficultés du projet', async () => {
      const { service, prisma, access } = buildService();
      prisma.projectIssue.findMany.mockResolvedValue([]);

      await service.list(PROJECT_ID, REPORTER_ID, {});

      expect(access.requireMember).toHaveBeenCalledWith(
        PROJECT_ID,
        REPORTER_ID,
      );
    });

    it('les difficultés ouvertes passent avant les résolues', async () => {
      const { service, prisma } = buildService();
      prisma.projectIssue.findMany.mockResolvedValue([]);

      await service.list(PROJECT_ID, REPORTER_ID, {});

      expect(prisma.projectIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        }),
      );
    });

    it('filtre par tâche quand demandé', async () => {
      const { service, prisma } = buildService();
      prisma.projectIssue.findMany.mockResolvedValue([]);

      await service.list(PROJECT_ID, REPORTER_ID, { taskId: TASK_ID });

      expect(prisma.projectIssue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ taskId: TASK_ID }),
        }),
      );
    });
  });

  describe('signalement', () => {
    it('un contributeur (MEMBER) peut signaler une difficulté', async () => {
      const { service, prisma, access } = buildService();
      prisma.projectIssue.create.mockResolvedValue({ id: ISSUE_ID });

      await service.create(PROJECT_ID, REPORTER_ID, { title: 'Problème' });

      expect(access.requireContributor).toHaveBeenCalledWith(
        PROJECT_ID,
        REPORTER_ID,
      );
      expect(prisma.projectIssue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reportedById: REPORTER_ID }),
        }),
      );
    });

    it('accepte une difficulté sans tâche rattachée', async () => {
      const { service, prisma } = buildService();
      prisma.projectIssue.create.mockResolvedValue({ id: ISSUE_ID });

      await service.create(PROJECT_ID, REPORTER_ID, { title: 'Problème' });

      expect(prisma.task.findUnique).not.toHaveBeenCalled();
      expect(prisma.projectIssue.create).toHaveBeenCalled();
    });

    it('refuse une tâche appartenant à un autre projet', async () => {
      const { service, prisma } = buildService();
      prisma.task.findUnique.mockResolvedValue({ projectId: OTHER_PROJECT_ID });

      await expect(
        service.create(PROJECT_ID, REPORTER_ID, {
          title: 'Problème',
          taskId: TASK_ID,
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.projectIssue.create).not.toHaveBeenCalled();
    });

    it('accepte une tâche du même projet', async () => {
      const { service, prisma } = buildService();
      prisma.task.findUnique.mockResolvedValue({ projectId: PROJECT_ID });
      prisma.projectIssue.create.mockResolvedValue({ id: ISSUE_ID });

      await service.create(PROJECT_ID, REPORTER_ID, {
        title: 'Problème',
        taskId: TASK_ID,
      });

      expect(prisma.projectIssue.create).toHaveBeenCalled();
    });
  });

  describe('suivi de la résolution', () => {
    it('exige un rôle de gestionnaire pour modifier le statut', async () => {
      const { service, prisma, access } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue({
        status: IssueStatus.OPEN,
      });
      prisma.projectIssue.update.mockResolvedValue({ id: ISSUE_ID });

      await service.update(PROJECT_ID, ISSUE_ID, OTHER_USER_ID, {
        status: IssueStatus.IN_PROGRESS,
      });

      expect(access.requireManager).toHaveBeenCalledWith(
        PROJECT_ID,
        OTHER_USER_ID,
      );
    });

    it('fige la date de résolution au passage en RESOLVED', async () => {
      const { service, prisma } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue({
        status: IssueStatus.IN_PROGRESS,
      });
      prisma.projectIssue.update.mockResolvedValue({ id: ISSUE_ID });

      await service.update(PROJECT_ID, ISSUE_ID, OTHER_USER_ID, {
        status: IssueStatus.RESOLVED,
      });

      const call = prisma.projectIssue.update.mock.calls[0][0] as {
        data: { resolvedAt?: Date | null };
      };
      expect(call.data.resolvedAt).toBeInstanceOf(Date);
    });

    it('efface la date de résolution si la difficulté est rouverte', async () => {
      const { service, prisma } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue({
        status: IssueStatus.RESOLVED,
      });
      prisma.projectIssue.update.mockResolvedValue({ id: ISSUE_ID });

      await service.update(PROJECT_ID, ISSUE_ID, OTHER_USER_ID, {
        status: IssueStatus.OPEN,
      });

      const call = prisma.projectIssue.update.mock.calls[0][0] as {
        data: { resolvedAt?: Date | null };
      };
      expect(call.data.resolvedAt).toBeNull();
    });

    it('ne repousse pas la date de résolution si déjà résolue', async () => {
      // Même garde que Task.completedAt : resauvegarder une difficulté déjà
      // résolue ne doit pas déplacer sa date de résolution.
      const { service, prisma } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue({
        status: IssueStatus.RESOLVED,
      });
      prisma.projectIssue.update.mockResolvedValue({ id: ISSUE_ID });

      await service.update(PROJECT_ID, ISSUE_ID, OTHER_USER_ID, {
        status: IssueStatus.RESOLVED,
      });

      const call = prisma.projectIssue.update.mock.calls[0][0] as {
        data: { resolvedAt?: Date | null };
      };
      expect(call.data.resolvedAt).toBeUndefined();
    });

    it('signale une difficulté introuvable dans ce projet', async () => {
      const { service, prisma } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue(null);

      await expect(
        service.update(PROJECT_ID, ISSUE_ID, OTHER_USER_ID, {
          status: IssueStatus.RESOLVED,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('suppression', () => {
    it('l’auteur supprime son propre signalement sans être gestionnaire', async () => {
      const { service, prisma, access } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue({
        reportedById: REPORTER_ID,
      });

      await service.remove(PROJECT_ID, ISSUE_ID, REPORTER_ID);

      expect(access.requireManager).not.toHaveBeenCalled();
      expect(prisma.projectIssue.delete).toHaveBeenCalledWith({
        where: { id: ISSUE_ID },
      });
    });

    it('un gestionnaire supprime le signalement de quelqu’un d’autre', async () => {
      const { service, prisma, access } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue({
        reportedById: REPORTER_ID,
      });

      await service.remove(PROJECT_ID, ISSUE_ID, OTHER_USER_ID);

      expect(access.requireManager).toHaveBeenCalledWith(
        PROJECT_ID,
        OTHER_USER_ID,
      );
      expect(prisma.projectIssue.delete).toHaveBeenCalled();
    });

    it('refuse la suppression à un simple contributeur qui n’est pas l’auteur', async () => {
      const { service, prisma, access } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue({
        reportedById: REPORTER_ID,
      });
      access.requireManager.mockRejectedValue(new Error('Forbidden'));

      await expect(
        service.remove(PROJECT_ID, ISSUE_ID, OTHER_USER_ID),
      ).rejects.toThrow();
      expect(prisma.projectIssue.delete).not.toHaveBeenCalled();
    });

    it('signale une difficulté introuvable', async () => {
      const { service, prisma } = buildService();
      prisma.projectIssue.findFirst.mockResolvedValue(null);

      await expect(
        service.remove(PROJECT_ID, ISSUE_ID, REPORTER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

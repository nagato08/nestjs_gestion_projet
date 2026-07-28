import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectService } from './project.service';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { NotificationHelperService } from 'src/notification/notification-helper.service';

/**
 * Corbeille des projets.
 *
 * Ne couvre que ce qui est réellement soft-deleté dans ce projet : `Project`
 * uniquement. Tâches et documents sont supprimés en dur ailleurs dans le
 * code, et ce n'est pas ce que ces tests prétendent vérifier.
 *
 * Point d'attention particulier : `restoreProject` et `purgeProjectNow` ne
 * peuvent pas passer par `projectAccess.requireOwner`, qui résout le rôle via
 * `getEffectiveRole` — lequel filtre `deletedAt: null` et lèverait NotFound
 * sur le projet précisément supprimé qu'on veut restaurer. La vérification
 * de propriété est donc refaite directement dans le service, et c'est cette
 * logique dupliquée que ces tests protègent.
 */

const OWNER_ID = 'proprietaire-1';
const OTHER_ID = 'autre-utilisateur';
const PROJECT_ID = 'projet-1';

function buildService() {
  const prisma = {
    project: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const access = {
    isGlobalAdmin: jest.fn().mockResolvedValue(false),
  };

  const service = new ProjectService(
    prisma as unknown as PrismaService,
    access as unknown as ProjectAccessService,
    {} as NotificationHelperService,
  );

  return { service, prisma, access };
}

function trashedProject(overrides: Record<string, unknown> = {}) {
  return {
    id: PROJECT_ID,
    ownerId: OWNER_ID,
    name: 'Projet supprimé',
    deletedAt: new Date(),
    ...overrides,
  };
}

describe('Corbeille des projets', () => {
  describe('liste', () => {
    it('purge les projets expirés avant de lister', async () => {
      const { service, prisma } = buildService();
      prisma.project.findMany.mockResolvedValue([]);

      await service.getTrashedProjects(OWNER_ID);

      expect(prisma.project.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { deletedAt: { lt: expect.any(Date) } },
        }),
      );
    });

    it('ne montre à un propriétaire que ses propres projets supprimés', async () => {
      const { service, prisma } = buildService();
      prisma.project.findMany.mockResolvedValue([]);

      await service.getTrashedProjects(OWNER_ID);

      expect(prisma.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ ownerId: OWNER_ID }),
        }),
      );
    });

    it('montre à un ADMIN global les projets de tous les propriétaires', async () => {
      const { service, prisma, access } = buildService();
      access.isGlobalAdmin.mockResolvedValue(true);
      prisma.project.findMany.mockResolvedValue([]);

      await service.getTrashedProjects('admin-1');

      const call = prisma.project.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
      };
      expect(call.where).not.toHaveProperty('ownerId');
    });

    it('calcule les jours restants avant purge définitive', async () => {
      const { service, prisma } = buildService();
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 25); // supprimé il y a 25 jours

      prisma.project.findMany.mockResolvedValue([
        trashedProject({ deletedAt }),
      ]);

      const [result] = await service.getTrashedProjects(OWNER_ID);

      // Fenêtre de 30 jours - 25 déjà écoulés = 5 jours restants.
      expect(result.daysUntilPurge).toBe(5);
    });

    it('ne renvoie jamais un compte de jours négatif', async () => {
      const { service, prisma } = buildService();
      const deletedAt = new Date();
      deletedAt.setDate(deletedAt.getDate() - 40); // au-delà de la fenêtre

      prisma.project.findMany.mockResolvedValue([
        trashedProject({ deletedAt }),
      ]);

      const [result] = await service.getTrashedProjects(OWNER_ID);

      expect(result.daysUntilPurge).toBe(0);
    });
  });

  describe('restauration', () => {
    it('le propriétaire restaure son propre projet', async () => {
      const { service, prisma } = buildService();
      prisma.project.findUnique.mockResolvedValue(trashedProject());
      prisma.project.update.mockResolvedValue({
        ...trashedProject(),
        deletedAt: null,
      });

      await service.restoreProject(PROJECT_ID, OWNER_ID);

      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: { deletedAt: null },
      });
    });

    it('un ADMIN global restaure le projet d’un autre propriétaire', async () => {
      const { service, prisma, access } = buildService();
      access.isGlobalAdmin.mockResolvedValue(true);
      prisma.project.findUnique.mockResolvedValue(trashedProject());
      prisma.project.update.mockResolvedValue(
        trashedProject({ deletedAt: null }),
      );

      await expect(
        service.restoreProject(PROJECT_ID, 'admin-1'),
      ).resolves.toBeDefined();
    });

    it('refuse la restauration à qui n’est pas le propriétaire', async () => {
      const { service, prisma } = buildService();
      prisma.project.findUnique.mockResolvedValue(trashedProject());

      await expect(
        service.restoreProject(PROJECT_ID, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.project.update).not.toHaveBeenCalled();
    });

    it('signale un projet introuvable plutôt que de restaurer un projet actif', async () => {
      const { service, prisma } = buildService();
      // Projet existant mais jamais supprimé : deletedAt est null.
      prisma.project.findUnique.mockResolvedValue(
        trashedProject({ deletedAt: null }),
      );

      await expect(
        service.restoreProject(PROJECT_ID, OWNER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('signale un identifiant qui ne correspond à aucun projet', async () => {
      const { service, prisma } = buildService();
      prisma.project.findUnique.mockResolvedValue(null);

      await expect(
        service.restoreProject(PROJECT_ID, OWNER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('purge anticipée', () => {
    it('le propriétaire supprime définitivement son projet', async () => {
      const { service, prisma } = buildService();
      prisma.project.findUnique.mockResolvedValue(trashedProject());

      await service.purgeProjectNow(PROJECT_ID, OWNER_ID);

      expect(prisma.project.delete).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
      });
    });

    it('refuse la purge à qui n’est pas le propriétaire', async () => {
      const { service, prisma } = buildService();
      prisma.project.findUnique.mockResolvedValue(trashedProject());

      await expect(
        service.purgeProjectNow(PROJECT_ID, OTHER_ID),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.project.delete).not.toHaveBeenCalled();
    });

    it('refuse de purger un projet qui n’est pas dans la corbeille', async () => {
      const { service, prisma } = buildService();
      prisma.project.findUnique.mockResolvedValue(
        trashedProject({ deletedAt: null }),
      );

      await expect(
        service.purgeProjectNow(PROJECT_ID, OWNER_ID),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProjectRole, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from './project-access.service';

/**
 * Contrôle d'accès par projet — le cœur de la sécurité applicative.
 *
 * Les intitulés sont volontairement écrits en langage métier : la sortie de
 * `npm test` doit se lire comme un cahier de recettes, y compris par un
 * lecteur qui n'ouvre pas le code.
 *
 * Prisma est simulé : ces règles sont de la logique pure, les faire dépendre
 * d'une base rendrait les tests lents et instables sans rien prouver de plus.
 */

const PROJECT_ID = 'projet-1';
const TASK_ID = 'tache-1';
const USER_ID = 'utilisateur-1';
const OWNER_ID = 'proprietaire-1';

interface PrismaStub {
  project: { findFirst: jest.Mock; findMany: jest.Mock };
  task: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
  projectMember: { findMany: jest.Mock };
}

function createPrismaStub(): PrismaStub {
  return {
    project: { findFirst: jest.fn(), findMany: jest.fn() },
    task: { findUnique: jest.fn() },
    user: { findUnique: jest.fn() },
    projectMember: { findMany: jest.fn() },
  };
}

/** Projet dont l'utilisateur testé est membre avec le rôle donné. */
function projectWithMember(role: ProjectRole | null) {
  return {
    ownerId: OWNER_ID,
    members: role ? [{ role }] : [],
  };
}

describe('Contrôle d’accès projet', () => {
  let prisma: PrismaStub;
  let access: ProjectAccessService;

  beforeEach(() => {
    prisma = createPrismaStub();
    access = new ProjectAccessService(prisma as unknown as PrismaService);
    // Utilisateur ordinaire par défaut : chaque test qui veut un
    // administrateur global le déclare explicitement.
    prisma.user.findUnique.mockResolvedValue({ role: Role.EMPLOYEE });
  });

  describe('rôle effectif', () => {
    it('le propriétaire du projet est OWNER', async () => {
      prisma.project.findFirst.mockResolvedValue({
        ownerId: USER_ID,
        members: [],
      });

      await expect(access.getEffectiveRole(PROJECT_ID, USER_ID)).resolves.toBe(
        ProjectRole.OWNER,
      );
    });

    it('un non-membre n’a aucun rôle', async () => {
      prisma.project.findFirst.mockResolvedValue(projectWithMember(null));

      await expect(
        access.getEffectiveRole(PROJECT_ID, USER_ID),
      ).resolves.toBeNull();
    });

    it('un projet supprimé est introuvable', async () => {
      // Le service filtre sur deletedAt: null — la requête ne renvoie rien.
      prisma.project.findFirst.mockResolvedValue(null);

      await expect(
        access.getEffectiveRole(PROJECT_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
    });

    it('un ADMIN global garde ses droits même ajouté comme simple VIEWER', async () => {
      // Régression : l'appartenance écrasait auparavant le rôle global, si
      // bien qu'ajouter un administrateur à un projet le dégradait.
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.VIEWER),
      );
      prisma.user.findUnique.mockResolvedValue({ role: Role.ADMIN });

      await expect(access.getEffectiveRole(PROJECT_ID, USER_ID)).resolves.toBe(
        ProjectRole.OWNER,
      );
    });
  });

  describe('hiérarchie des rôles', () => {
    it.each([
      [ProjectRole.OWNER, true],
      [ProjectRole.ADMIN, true],
      [ProjectRole.MEMBER, false],
      [ProjectRole.VIEWER, false],
    ])('gérer le projet en tant que %s : %s', async (role, autorise) => {
      prisma.project.findFirst.mockResolvedValue(projectWithMember(role));

      const attempt = access.requireManager(PROJECT_ID, USER_ID);

      if (autorise) {
        await expect(attempt).resolves.toBe(role);
      } else {
        await expect(attempt).rejects.toThrow(ForbiddenException);
      }
    });

    it('un VIEWER ne peut pas contribuer', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.VIEWER),
      );

      await expect(
        access.requireContributor(PROJECT_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un VIEWER peut consulter', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.VIEWER),
      );

      await expect(access.requireMember(PROJECT_ID, USER_ID)).resolves.toBe(
        ProjectRole.VIEWER,
      );
    });

    it('un ADMIN de projet ne peut pas mener une action réservée au propriétaire', async () => {
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.ADMIN),
      );

      await expect(access.requireOwner(PROJECT_ID, USER_ID)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('modification d’une tâche', () => {
    /** Tâche du projet, assignée ou non à l'utilisateur testé. */
    function taskAssigned(assigned: boolean) {
      return {
        id: TASK_ID,
        projectId: PROJECT_ID,
        assignments: assigned ? [{ id: 'assignation-1' }] : [],
      };
    }

    it('un MEMBER modifie une tâche qui lui est assignée', async () => {
      prisma.task.findUnique.mockResolvedValue(taskAssigned(true));
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.MEMBER),
      );

      await expect(
        access.requireTaskWriteAccess(TASK_ID, USER_ID),
      ).resolves.toMatchObject({ id: TASK_ID, role: ProjectRole.MEMBER });
    });

    it('un MEMBER ne modifie pas une tâche qui ne lui est pas assignée', async () => {
      prisma.task.findUnique.mockResolvedValue(taskAssigned(false));
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.MEMBER),
      );

      await expect(
        access.requireTaskWriteAccess(TASK_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('un gestionnaire modifie une tâche sans y être assigné', async () => {
      prisma.task.findUnique.mockResolvedValue(taskAssigned(false));
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.ADMIN),
      );

      await expect(
        access.requireTaskWriteAccess(TASK_ID, USER_ID),
      ).resolves.toMatchObject({ role: ProjectRole.ADMIN });
    });

    it('un VIEWER ne modifie aucune tâche, même assignée', async () => {
      prisma.task.findUnique.mockResolvedValue(taskAssigned(true));
      prisma.project.findFirst.mockResolvedValue(
        projectWithMember(ProjectRole.VIEWER),
      );

      await expect(
        access.requireTaskWriteAccess(TASK_ID, USER_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('une tâche inexistante est signalée avant toute vérification de rôle', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        access.requireTaskWriteAccess(TASK_ID, USER_ID),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.project.findFirst).not.toHaveBeenCalled();
    });
  });
});

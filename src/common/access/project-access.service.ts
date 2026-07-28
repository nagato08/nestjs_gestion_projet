import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, Role } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

/**
 * Rang numérique de chaque rôle projet. Un rôle donne accès à tout ce
 * qu'autorisent les rôles de rang inférieur.
 */
export const PROJECT_ROLE_RANK: Record<ProjectRole, number> = {
  [ProjectRole.OWNER]: 4,
  [ProjectRole.ADMIN]: 3,
  [ProjectRole.MEMBER]: 2,
  [ProjectRole.VIEWER]: 1,
};

/** Messages d'erreur par niveau requis, pour rester explicite côté client. */
const FORBIDDEN_MESSAGE: Record<ProjectRole, string> = {
  [ProjectRole.OWNER]: 'Action réservée au propriétaire du projet',
  [ProjectRole.ADMIN]:
    'Action réservée aux gestionnaires du projet (propriétaire ou administrateur)',
  [ProjectRole.MEMBER]:
    'Action réservée aux contributeurs du projet (accès en lecture seule)',
  [ProjectRole.VIEWER]: "Vous n'avez pas accès à ce projet",
};

/**
 * Point d'entrée unique du contrôle d'accès par projet.
 *
 * Remplace les vérifications `include: { members: true }` dupliquées dans
 * chaque service : ici la règle est écrite une seule fois, et l'ajout d'un
 * rôle ou d'une exception se répercute partout.
 */
@Injectable()
export class ProjectAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Rôle effectif de l'utilisateur sur le projet, ou `null` s'il n'y a
   * aucun accès. Lève NotFound si le projet n'existe pas ou est supprimé.
   *
   * Deux règles s'ajoutent à l'appartenance :
   * - le propriétaire du projet est toujours OWNER, même si la ligne
   *   ProjectMember dit autre chose (filet de sécurité) ;
   * - un ADMIN global est traité comme OWNER sur tous les projets.
   */
  async getEffectiveRole(
    projectId: string,
    userId: string,
  ): Promise<ProjectRole | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, deletedAt: null },
      select: {
        ownerId: true,
        members: {
          where: { userId },
          select: { role: true },
        },
      },
    });

    if (!project) throw new NotFoundException('Projet introuvable');

    if (project.ownerId === userId) return ProjectRole.OWNER;

    const membership = project.members[0];
    // Déjà au maximum : inutile d'interroger le rôle global.
    if (membership?.role === ProjectRole.OWNER) return ProjectRole.OWNER;

    // Le bypass ADMIN global prime sur l'appartenance : un administrateur
    // ajouté comme simple VIEWER garde ses prérogatives d'administrateur.
    if (await this.isGlobalAdmin(userId)) return ProjectRole.OWNER;

    return membership?.role ?? null;
  }

  /**
   * Vérifie que l'utilisateur atteint au moins `minimumRole` sur le projet,
   * et renvoie son rôle effectif. Lève Forbidden sinon.
   */
  async requireProjectRole(
    projectId: string,
    userId: string,
    minimumRole: ProjectRole,
  ): Promise<ProjectRole> {
    const role = await this.getEffectiveRole(projectId, userId);

    if (!role || PROJECT_ROLE_RANK[role] < PROJECT_ROLE_RANK[minimumRole]) {
      throw new ForbiddenException(FORBIDDEN_MESSAGE[minimumRole]);
    }

    return role;
  }

  /** Lecture : tout membre, y compris VIEWER. */
  requireMember(projectId: string, userId: string): Promise<ProjectRole> {
    return this.requireProjectRole(projectId, userId, ProjectRole.VIEWER);
  }

  /** Écriture sur le contenu (tâches, documents, chat) : MEMBER minimum. */
  requireContributor(projectId: string, userId: string): Promise<ProjectRole> {
    return this.requireProjectRole(projectId, userId, ProjectRole.MEMBER);
  }

  /** Gestion du projet (membres, paramètres) : ADMIN projet minimum. */
  requireManager(projectId: string, userId: string): Promise<ProjectRole> {
    return this.requireProjectRole(projectId, userId, ProjectRole.ADMIN);
  }

  /** Actions irréversibles (suppression, transfert) : OWNER uniquement. */
  requireOwner(projectId: string, userId: string): Promise<ProjectRole> {
    return this.requireProjectRole(projectId, userId, ProjectRole.OWNER);
  }

  /**
   * Variante « par tâche » : résout le projet de la tâche puis applique la
   * même règle. Renvoie l'identité de la tâche pour éviter une requête de plus.
   */
  async requireTaskRole(
    taskId: string,
    userId: string,
    minimumRole: ProjectRole,
  ): Promise<{ id: string; projectId: string; role: ProjectRole }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });

    if (!task) throw new NotFoundException('Tâche introuvable');

    const role = await this.requireProjectRole(
      task.projectId,
      userId,
      minimumRole,
    );

    return { ...task, role };
  }

  /**
   * Droit de MODIFIER une tâche précise.
   *
   * Les gestionnaires (ADMIN projet et au-dessus) agissent sur toutes les
   * tâches du projet. Un MEMBER n'agit que sur les tâches qui lui sont
   * assignées : il exécute son travail, il ne réorganise pas celui des autres.
   * Un VIEWER est exclu.
   */
  async requireTaskWriteAccess(
    taskId: string,
    userId: string,
  ): Promise<{ id: string; projectId: string; role: ProjectRole }> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        assignments: { where: { userId }, select: { id: true } },
      },
    });

    if (!task) throw new NotFoundException('Tâche introuvable');

    const role = await this.requireProjectRole(
      task.projectId,
      userId,
      ProjectRole.MEMBER,
    );

    const isManager =
      PROJECT_ROLE_RANK[role] >= PROJECT_ROLE_RANK[ProjectRole.ADMIN];
    if (!isManager && task.assignments.length === 0) {
      throw new ForbiddenException(
        'Vous ne pouvez modifier que les tâches qui vous sont assignées',
      );
    }

    return { id: task.id, projectId: task.projectId, role };
  }

  /**
   * Rôles effectifs de l'utilisateur sur plusieurs projets, en une requête.
   * Sert à exposer `myRole` dans les listes sans faire du N+1.
   */
  async getRolesForProjects(
    projectIds: string[],
    userId: string,
  ): Promise<Map<string, ProjectRole>> {
    if (projectIds.length === 0) return new Map();

    const [memberships, projects, isGlobalAdmin] = await Promise.all([
      this.prisma.projectMember.findMany({
        where: { projectId: { in: projectIds }, userId },
        select: { projectId: true, role: true },
      }),
      this.prisma.project.findMany({
        where: { id: { in: projectIds }, ownerId: userId },
        select: { id: true },
      }),
      this.isGlobalAdmin(userId),
    ]);

    const roles = new Map<string, ProjectRole>();

    // Même ordre de priorité que getEffectiveRole : propriétaire, puis
    // ADMIN global, puis appartenance.
    if (isGlobalAdmin) {
      for (const id of projectIds) roles.set(id, ProjectRole.OWNER);
      return roles;
    }

    for (const m of memberships) roles.set(m.projectId, m.role);
    for (const p of projects) roles.set(p.id, ProjectRole.OWNER);

    return roles;
  }

  /** True si l'utilisateur a le rôle global ADMIN. */
  async isGlobalAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role === Role.ADMIN;
  }
}

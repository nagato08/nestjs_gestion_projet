/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { RemoveProjectMemberDto } from './dto/remove-project-member.dto';
import { randomUUID } from 'crypto';
import { Project, ProjectMember, ProjectRole } from '@prisma/client';
import {
  PROJECT_ROLE_RANK,
  ProjectAccessService,
} from 'src/common/access/project-access.service';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class ProjectService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  // 1️⃣ Créer un projet (Transactionnel : Projet + Premier Membre)
  async createProject(
    ownerId: string,
    dto: CreateProjectDto,
  ): Promise<Project> {
    const projectCode = randomUUID().split('-')[0].toUpperCase(); // Code plus court (ex: 4F3E2A)

    return this.prisma.$transaction(async (tx) => {
      // Extraire les champs du DTO et convertir les dates
      const { startDate, endDate, ...restDto } = dto;

      const project = await tx.project.create({
        data: {
          ...restDto,
          ownerId, // S'assurer que ownerId est défini (passé en paramètre)
          projectCode,
          inviteToken: randomUUID(),
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
        },
      });

      // On ajoute l'owner comme membre par défaut
      await tx.projectMember.create({
        data: { projectId: project.id, userId: ownerId },
      });

      // Créer automatiquement le canal de chat du projet
      await tx.conversation.create({
        data: { projectId: project.id } as any,
      });

      return project;
    });
  }

  // 2️⃣ Récupérer les projets d'un utilisateur (Dashboard)
  async getMyProjects(userId: string) {
    const projects = await this.prisma.project.findMany({
      where: {
        members: { some: { userId } },
        deletedAt: null, // ✅ Exclure les projets supprimés
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        _count: {
          select: { tasks: true, members: true }, // Pour afficher des badges sur le front
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (projects.length === 0) return projects;

    const doneCounts = await this.prisma.task.groupBy({
      by: ['projectId'],
      where: {
        projectId: { in: projects.map((p) => p.id) },
        status: 'DONE',
      },
      _count: { _all: true },
    });
    const doneMap = new Map(
      doneCounts.map((d) => [d.projectId, d._count._all]),
    );

    // Rôles résolus en une requête groupée plutôt qu'un appel par projet.
    const roles = await this.projectAccess.getRolesForProjects(
      projects.map((p) => p.id),
      userId,
    );

    return projects.map((p) => ({
      ...p,
      completedTasksCount: doneMap.get(p.id) ?? 0,
      myRole: roles.get(p.id) ?? null,
    }));
  }

  // 3️⃣ Récupérer un projet par ID avec vérification d'accès
  async getProjectById(projectId: string, userId: string) {
    // VIEWER suffit pour consulter ; lève NotFound/Forbidden le cas échéant.
    const myRole = await this.projectAccess.requireMember(projectId, userId);

    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null, // ✅ Exclure les projets supprimés
      },
      include: {
        owner: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                jobTitle: true,
              },
            },
          },
        },
        _count: { select: { tasks: true, members: true } },
      },
    });

    if (!project) throw new NotFoundException('Projet introuvable');

    const completedTasksCount = await this.prisma.task.count({
      where: { projectId, status: 'DONE' },
    });

    // `myRole` permet au front de masquer les actions interdites sans rejouer la règle.
    return { ...project, completedTasksCount, myRole };
  }

  // 4️⃣ Mettre à jour (propriétaire ou administrateur du projet)
  async updateProject(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ) {
    await this.projectAccess.requireManager(projectId, userId);

    // Préparer les données avec conversion des dates
    const updateData: any = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.objectives !== undefined) updateData.objectives = dto.objectives;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.startDate !== undefined) {
      updateData.startDate = new Date(dto.startDate);
    }
    if (dto.endDate !== undefined) {
      updateData.endDate = dto.endDate ? new Date(dto.endDate) : null;
    }

    return this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });
  }

  // 5️⃣ & 7️⃣ & 8️⃣ Ajouter/Rejoindre (Logique mutualisée pour éviter les doublons)
  private async addMemberToProject(
    projectId: string,
    userId: string,
    role: ProjectRole = ProjectRole.MEMBER,
  ): Promise<ProjectMember> {
    const existingMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (existingMember)
      throw new ConflictException('L’utilisateur est déjà membre du projet');

    return this.prisma.projectMember.create({
      data: { projectId, userId, role },
    });
  }

  async addMember(
    projectId: string,
    actorId: string,
    dto: AddProjectMemberDto,
  ) {
    const actorRole = await this.projectAccess.requireManager(
      projectId,
      actorId,
    );
    const role = dto.role ?? ProjectRole.MEMBER;

    // On ne crée pas un second propriétaire : la propriété se transfère.
    if (role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Utiliser le transfert de propriété pour désigner un nouveau propriétaire',
      );
    }
    // Un ADMIN projet ne peut pas nommer quelqu'un à son propre niveau.
    this.assertCanAssignRole(actorRole, role);

    return this.addMemberToProject(projectId, dto.userId, role);
  }

  async joinByProjectCode(projectCode: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        projectCode,
        deletedAt: null, // ✅ Exclure les projets supprimés
      },
    });
    if (!project) throw new NotFoundException('Code projet invalide');
    return this.addMemberToProject(project.id, userId);
  }

  async joinByInviteToken(inviteToken: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        inviteToken,
        deletedAt: null, // ✅ Exclure les projets supprimés
      },
    });
    if (!project) throw new NotFoundException("Lien d'invitation invalide");
    return this.addMemberToProject(project.id, userId);
  }

  // 6️⃣ Retirer un membre
  async removeMember(
    projectId: string,
    actorId: string,
    dto: RemoveProjectMemberDto,
  ) {
    const actorRole = await this.projectAccess.requireManager(
      projectId,
      actorId,
    );

    if (actorId === dto.userId) {
      throw new ForbiddenException(
        'Un gestionnaire ne peut pas se retirer lui-même du projet',
      );
    }

    const target = await this.getMembershipOrThrow(projectId, dto.userId);

    // On ne retire jamais le propriétaire, et un ADMIN ne peut pas
    // évincer un autre ADMIN — seul le propriétaire le peut.
    if (target.role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Le propriétaire du projet ne peut pas être retiré',
      );
    }
    this.assertOutranks(actorRole, target.role);

    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
  }

  /**
   * Change le rôle d'un membre existant.
   * Réservé aux gestionnaires ; le passage à OWNER se fait par transfert.
   */
  async updateMemberRole(
    projectId: string,
    actorId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const actorRole = await this.projectAccess.requireManager(
      projectId,
      actorId,
    );

    if (actorId === dto.userId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier votre propre rôle',
      );
    }
    if (dto.role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Utiliser le transfert de propriété pour désigner un nouveau propriétaire',
      );
    }

    const target = await this.getMembershipOrThrow(projectId, dto.userId);
    if (target.role === ProjectRole.OWNER) {
      throw new ForbiddenException(
        'Le rôle du propriétaire ne peut pas être modifié',
      );
    }

    // Il faut dominer à la fois le rôle actuel de la cible et celui qu'on lui donne.
    this.assertOutranks(actorRole, target.role);
    this.assertCanAssignRole(actorRole, dto.role);

    return this.prisma.projectMember.update({
      where: { projectId_userId: { projectId, userId: dto.userId } },
      data: { role: dto.role },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });
  }

  /**
   * Transfère la propriété du projet à un autre membre.
   * L'ancien propriétaire est rétrogradé ADMIN pour ne pas perdre la main.
   */
  async transferOwnership(
    projectId: string,
    actorId: string,
    newOwnerId: string,
  ) {
    await this.projectAccess.requireOwner(projectId, actorId);

    if (actorId === newOwnerId) {
      throw new ConflictException('Vous êtes déjà propriétaire de ce projet');
    }

    await this.getMembershipOrThrow(projectId, newOwnerId);

    return this.prisma.$transaction(async (tx) => {
      const project = await tx.project.update({
        where: { id: projectId },
        data: { ownerId: newOwnerId },
      });

      await tx.projectMember.update({
        where: { projectId_userId: { projectId, userId: newOwnerId } },
        data: { role: ProjectRole.OWNER },
      });

      await tx.projectMember.update({
        where: { projectId_userId: { projectId, userId: actorId } },
        data: { role: ProjectRole.ADMIN },
      });

      return project;
    });
  }

  /** Récupère l'appartenance d'un utilisateur au projet, ou lève NotFound. */
  private async getMembershipOrThrow(projectId: string, userId: string) {
    const membership = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException("L'utilisateur n'est pas membre du projet");
    }
    return membership;
  }

  /** L'acteur doit être strictement au-dessus de sa cible. */
  private assertOutranks(actorRole: ProjectRole, targetRole: ProjectRole) {
    if (PROJECT_ROLE_RANK[actorRole] <= PROJECT_ROLE_RANK[targetRole]) {
      throw new ForbiddenException(
        'Vous ne pouvez pas agir sur un membre de rang égal ou supérieur au vôtre',
      );
    }
  }

  /** On n'attribue jamais un rôle supérieur ou égal au sien. */
  private assertCanAssignRole(actorRole: ProjectRole, targetRole: ProjectRole) {
    if (PROJECT_ROLE_RANK[targetRole] >= PROJECT_ROLE_RANK[actorRole]) {
      throw new ForbiddenException(
        'Vous ne pouvez pas attribuer un rôle supérieur ou égal au vôtre',
      );
    }
  }

  // 9️⃣ Régénérer le token
  async regenerateInviteToken(projectId: string, userId: string) {
    await this.projectAccess.requireManager(projectId, userId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { inviteToken: randomUUID() },
    });
  }

  // 🔟 Supprimer un projet (soft delete)
  async deleteProject(projectId: string, userId: string) {
    // OWNER uniquement — l'ADMIN global est traité comme OWNER par le service d'accès.
    await this.projectAccess.requireOwner(projectId, userId);

    // Soft delete
    const deletedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: new Date() },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      message: 'Projet supprimé avec succès',
      project: deletedProject,
    };
  }
}

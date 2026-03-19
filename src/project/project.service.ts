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
import { Project, ProjectMember, Role } from '@prisma/client';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * UTILITAIRE : Vérifie l'existence d'un projet et si l'utilisateur en est l'owner.
   */
  private async getProjectIfOwner(
    projectId: string,
    userId: string,
  ): Promise<Project> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null, // ✅ Exclure les projets supprimés
      },
    });

    if (!project) throw new NotFoundException('Projet introuvable');
    if (project.ownerId !== userId) {
      throw new ForbiddenException('Action réservée au propriétaire du projet');
    }
    return project;
  }

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
    return await this.prisma.project.findMany({
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
  }

  // 3️⃣ Récupérer un projet par ID avec vérification d'accès
  async getProjectById(projectId: string, userId: string) {
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
      },
    });

    if (!project) throw new NotFoundException('Projet introuvable');

    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember)
      throw new ForbiddenException("Vous n'avez pas accès à ce projet");

    return project;
  }

  // 4️⃣ Mettre à jour (Utilise l'utilitaire privé)
  async updateProject(
    projectId: string,
    userId: string,
    dto: UpdateProjectDto,
  ) {
    await this.getProjectIfOwner(projectId, userId);

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
  ): Promise<ProjectMember> {
    const existingMember = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (existingMember)
      throw new ConflictException('L’utilisateur est déjà membre du projet');

    return this.prisma.projectMember.create({
      data: { projectId, userId },
    });
  }

  async addMember(
    projectId: string,
    ownerId: string,
    dto: AddProjectMemberDto,
  ) {
    await this.getProjectIfOwner(projectId, ownerId);
    return this.addMemberToProject(projectId, dto.userId);
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
    ownerId: string,
    dto: RemoveProjectMemberDto,
  ) {
    await this.getProjectIfOwner(projectId, ownerId);

    if (ownerId === dto.userId) {
      throw new ForbiddenException(
        'Le propriétaire ne peut pas se retirer lui-même',
      );
    }

    return this.prisma.projectMember.delete({
      where: { projectId_userId: { projectId, userId: dto.userId } },
    });
  }

  // 9️⃣ Régénérer le token
  async regenerateInviteToken(projectId: string, userId: string) {
    await this.getProjectIfOwner(projectId, userId);
    return this.prisma.project.update({
      where: { id: projectId },
      data: { inviteToken: randomUUID() },
    });
  }

  // 🔟 Supprimer un projet (soft delete)
  async deleteProject(projectId: string, userId: string) {
    // Vérifier que le projet existe et n'est pas déjà supprimé
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new NotFoundException('Projet introuvable ou déjà supprimé');
    }

    // Vérifier les permissions : seul le propriétaire ou un admin peut supprimer
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isOwner = project.ownerId === userId;
    const isAdmin = user?.role === Role.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'Seul le propriétaire du projet ou un administrateur peut le supprimer',
      );
    }

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

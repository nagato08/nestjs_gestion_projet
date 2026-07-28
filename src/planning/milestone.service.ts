import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';

@Injectable()
export class MilestoneService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async list(projectId: string, userId: string) {
    await this.projectAccess.requireMember(projectId, userId);

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
    });

    return milestones.map((m) => ({
      ...m,
      // Un jalon dont la date est passée sans avoir été atteint est en retard.
      overdue: !m.reached && m.date.getTime() < Date.now(),
    }));
  }

  async create(projectId: string, userId: string, dto: CreateMilestoneDto) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    return this.prisma.milestone.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        date: new Date(dto.date),
      },
    });
  }

  async update(
    projectId: string,
    milestoneId: string,
    userId: string,
    dto: UpdateMilestoneDto,
  ) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true, reached: true },
    });
    if (!milestone) throw new NotFoundException('Jalon introuvable');

    // `reachedAt` suit `reached` : on horodate au passage à true, on efface
    // au retour à false, plutôt que de laisser une date orpheline.
    const reachedChanged =
      dto.reached !== undefined && dto.reached !== milestone.reached;

    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        name: dto.name,
        description: dto.description,
        date: dto.date ? new Date(dto.date) : undefined,
        reached: dto.reached,
        ...(reachedChanged
          ? { reachedAt: dto.reached ? new Date() : null }
          : {}),
      },
    });
  }

  async remove(projectId: string, milestoneId: string, userId: string) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const milestone = await this.prisma.milestone.findFirst({
      where: { id: milestoneId, projectId },
      select: { id: true },
    });
    if (!milestone) throw new NotFoundException('Jalon introuvable');

    await this.prisma.milestone.delete({ where: { id: milestoneId } });
    return { message: 'Jalon supprimé' };
  }
}

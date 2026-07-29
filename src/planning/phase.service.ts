import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';

/**
 * Phases d'un projet — le regroupement macro qui donne sa structure à la
 * feuille de route, distinct des tâches individuelles du Gantt.
 */
@Injectable()
export class PhaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async list(projectId: string, userId: string) {
    await this.projectAccess.requireMember(projectId, userId);

    return this.prisma.phase.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { startDate: 'asc' }],
    });
  }

  async create(projectId: string, userId: string, dto: CreatePhaseDto) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'La date de fin doit suivre la date de début',
      );
    }

    return this.prisma.phase.create({
      data: {
        projectId,
        name: dto.name,
        description: dto.description,
        startDate: start,
        endDate: end,
        order: dto.order ?? 0,
      },
    });
  }

  async update(
    projectId: string,
    phaseId: string,
    userId: string,
    dto: UpdatePhaseDto,
  ) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException('Phase introuvable');

    const start = dto.startDate ? new Date(dto.startDate) : phase.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : phase.endDate;
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'La date de fin doit suivre la date de début',
      );
    }

    return this.prisma.phase.update({
      where: { id: phaseId },
      data: {
        name: dto.name,
        description: dto.description,
        startDate: start,
        endDate: end,
        order: dto.order,
      },
    });
  }

  async remove(projectId: string, phaseId: string, userId: string) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const phase = await this.prisma.phase.findFirst({
      where: { id: phaseId, projectId },
    });
    if (!phase) throw new NotFoundException('Phase introuvable');

    await this.prisma.phase.delete({ where: { id: phaseId } });
    return { message: 'Phase supprimée' };
  }
}

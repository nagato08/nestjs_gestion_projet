import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, TaskStatus } from '@prisma/client';
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

  /**
   * Avancement d'une phase, toujours compté en nombre de tâches.
   *
   * Contrairement au sprint, une phase peut s'étendre sur plusieurs sprints
   * à l'usage des points hétérogène : mélanger des tâches estimées et
   * d'autres non estimées produirait un pourcentage sans signification.
   */
  private summarize(tasks: { status: TaskStatus }[], endDate: Date) {
    const doneCount = tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const progressPercent =
      tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : 0;

    return {
      taskCount: tasks.length,
      doneCount,
      progressPercent,
      // En retard : l'échéance est dépassée et du travail reste à faire.
      // Une phase sans aucune tâche n'est jamais en retard — il n'y a rien
      // à y avoir manqué.
      isLate:
        tasks.length > 0 &&
        progressPercent < 100 &&
        endDate.getTime() < Date.now(),
    };
  }

  async list(projectId: string, userId: string) {
    await this.projectAccess.requireMember(projectId, userId);

    const phases = await this.prisma.phase.findMany({
      where: { projectId },
      orderBy: [{ order: 'asc' }, { startDate: 'asc' }],
      include: {
        tasks: { select: { status: true } },
      },
    });

    return phases.map(({ tasks, ...phase }) => ({
      ...phase,
      ...this.summarize(tasks, phase.endDate),
    }));
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

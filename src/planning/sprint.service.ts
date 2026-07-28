import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectRole, SprintStatus, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';

@Injectable()
export class SprintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /** Agrégats affichés pour chaque sprint : avancement et volume de travail. */
  private summarize(
    tasks: { status: TaskStatus; storyPoints: number | null }[],
  ) {
    const done = tasks.filter((t) => t.status === TaskStatus.DONE);
    // Le travail se compte en points si le projet en utilise, sinon en tâches.
    const usesPoints = tasks.some((t) => (t.storyPoints ?? 0) > 0);
    const total = usesPoints
      ? tasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
      : tasks.length;
    const completed = usesPoints
      ? done.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0)
      : done.length;

    return {
      taskCount: tasks.length,
      doneCount: done.length,
      totalWork: total,
      completedWork: completed,
      usesStoryPoints: usesPoints,
      progressPercent: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }

  async list(projectId: string, userId: string) {
    await this.projectAccess.requireMember(projectId, userId);

    const sprints = await this.prisma.sprint.findMany({
      where: { projectId },
      orderBy: { startDate: 'asc' },
      include: {
        tasks: { select: { status: true, storyPoints: true } },
      },
    });

    return sprints.map(({ tasks, ...sprint }) => ({
      ...sprint,
      ...this.summarize(tasks),
    }));
  }

  async create(projectId: string, userId: string, dto: CreateSprintDto) {
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

    return this.prisma.sprint.create({
      data: {
        projectId,
        name: dto.name,
        goal: dto.goal,
        startDate: start,
        endDate: end,
      },
    });
  }

  async update(
    projectId: string,
    sprintId: string,
    userId: string,
    dto: UpdateSprintDto,
  ) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!sprint) throw new NotFoundException('Sprint introuvable');

    const start = dto.startDate ? new Date(dto.startDate) : sprint.startDate;
    const end = dto.endDate ? new Date(dto.endDate) : sprint.endDate;
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException(
        'La date de fin doit suivre la date de début',
      );
    }

    // Un seul sprint actif à la fois : deux sprints en cours rendraient le
    // burndown ambigu et la notion d'itération sans objet.
    if (dto.status === SprintStatus.ACTIVE) {
      const otherActive = await this.prisma.sprint.findFirst({
        where: {
          projectId,
          status: SprintStatus.ACTIVE,
          id: { not: sprintId },
        },
        select: { name: true },
      });
      if (otherActive) {
        throw new ConflictException(
          `Le sprint « ${otherActive.name} » est déjà en cours. Terminez-le d'abord.`,
        );
      }
    }

    return this.prisma.sprint.update({
      where: { id: sprintId },
      data: {
        name: dto.name,
        goal: dto.goal,
        startDate: start,
        endDate: end,
        status: dto.status,
      },
    });
  }

  async remove(projectId: string, sprintId: string, userId: string) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    const sprint = await this.prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { id: true },
    });
    if (!sprint) throw new NotFoundException('Sprint introuvable');

    // Les tâches retournent au backlog (onDelete: SetNull), elles ne sont
    // jamais supprimées avec le sprint.
    await this.prisma.sprint.delete({ where: { id: sprintId } });
    return {
      message: 'Sprint supprimé, ses tâches sont retournées au backlog',
    };
  }

  /** Rattache ou détache un lot de tâches. `sprintId` nul = retour au backlog. */
  async assignTasks(
    projectId: string,
    userId: string,
    taskIds: string[],
    sprintId: string | null,
  ) {
    await this.projectAccess.requireProjectRole(
      projectId,
      userId,
      ProjectRole.ADMIN,
    );

    if (sprintId) {
      const sprint = await this.prisma.sprint.findFirst({
        where: { id: sprintId, projectId },
        select: { id: true },
      });
      if (!sprint) throw new NotFoundException('Sprint introuvable');
    }

    // `projectId` dans le filtre : on ne rattache pas une tâche d'un autre
    // projet, même si son identifiant est fourni.
    const result = await this.prisma.task.updateMany({
      where: { id: { in: taskIds }, projectId },
      data: { sprintId },
    });

    return { updated: result.count };
  }
}

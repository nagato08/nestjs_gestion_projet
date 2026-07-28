import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Priority, ProjectRole, Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { CreateTemplateFromProjectDto } from './dto/create-template-from-project.dto';
import { InstantiateTemplateDto } from './dto/instantiate-template.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class TemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  /** Modèles visibles : les partagés, plus les siens. */
  async list(userId: string) {
    return this.prisma.projectTemplate.findMany({
      where: { OR: [{ isShared: true }, { createdById: userId }] },
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        _count: { select: { tasks: true } },
      },
    });
  }

  async getById(templateId: string, userId: string) {
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id: templateId },
      include: {
        tasks: { orderBy: { position: 'asc' } },
        createdBy: { select: { firstName: true, lastName: true } },
      },
    });

    if (!template) throw new NotFoundException('Modèle introuvable');
    if (!template.isShared && template.createdById !== userId) {
      throw new ForbiddenException('Ce modèle est privé');
    }

    return template;
  }

  /**
   * Capture un projet existant comme modèle réutilisable.
   *
   * Les dates absolues sont converties en décalages relatifs au démarrage :
   * un modèle doit pouvoir s'appliquer à n'importe quelle date de début.
   */
  async createFromProject(userId: string, dto: CreateTemplateFromProjectDto) {
    await this.projectAccess.requireManager(dto.projectId, userId);

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: dto.projectId },
      select: { name: true, description: true, startDate: true },
    });

    const tasks = await this.prisma.task.findMany({
      where: { projectId: dto.projectId, parentId: null },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        startDate: true,
        endDate: true,
        storyPoints: true,
        checklist: { orderBy: { position: 'asc' }, select: { label: true } },
        blockedBy: { select: { blockingTaskId: true } },
      },
    });

    // Les dépendances sont mémorisées par position et non par identifiant :
    // les tâches instanciées plus tard auront de nouveaux identifiants.
    const positionById = new Map(tasks.map((t, index) => [t.id, index]));
    const origin = project.startDate;

    return this.prisma.projectTemplate.create({
      data: {
        name: dto.name,
        description: dto.description ?? project.description,
        isShared: dto.isShared ?? true,
        createdById: userId,
        tasks: {
          create: tasks.map((task, index) => {
            const start = task.startDate ?? origin;
            const end = task.endDate ?? start;

            return {
              title: task.title,
              description: task.description,
              priority: task.priority,
              startOffsetDays: Math.max(
                0,
                Math.round((start.getTime() - origin.getTime()) / MS_PER_DAY),
              ),
              durationDays: Math.max(
                1,
                Math.round((end.getTime() - start.getTime()) / MS_PER_DAY),
              ),
              storyPoints: task.storyPoints,
              position: index,
              blockedByPositions: task.blockedBy
                .map((d) => positionById.get(d.blockingTaskId))
                .filter((p): p is number => p !== undefined),
              checklist: task.checklist.map((c) => c.label),
            };
          }),
        },
      },
      include: { _count: { select: { tasks: true } } },
    });
  }

  /**
   * Crée un projet à partir d'un modèle.
   *
   * Les décalages relatifs sont reconvertis en dates réelles à partir de la
   * date de démarrage choisie, et les dépendances internes sont rétablies.
   */
  async instantiate(
    templateId: string,
    userId: string,
    dto: InstantiateTemplateDto,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true },
    });

    // Même exigence que la création directe d'un projet.
    if (user.role !== Role.ADMIN && user.role !== Role.PROJECT_MANAGER) {
      throw new ForbiddenException(
        'Seuls les administrateurs et chefs de projet peuvent créer un projet',
      );
    }

    const template = await this.getById(templateId, userId);
    const startDate = new Date(dto.startDate);

    const taskEnd = (offset: number, duration: number) =>
      new Date(startDate.getTime() + (offset + duration) * MS_PER_DAY);

    // Tout ou rien : un projet à moitié instancié serait ingérable.
    return this.prisma.$transaction(async (tx) => {
      const lastEnd = template.tasks.reduce(
        (max, t) =>
          Math.max(max, taskEnd(t.startOffsetDays, t.durationDays).getTime()),
        startDate.getTime(),
      );

      const project = await tx.project.create({
        data: {
          name: dto.name,
          description: template.description,
          priority: Priority.MEDIUM,
          startDate,
          endDate: new Date(lastEnd),
          projectCode: randomUUID().split('-')[0].toUpperCase(),
          inviteToken: randomUUID(),
          ownerId: userId,
        },
      });

      await tx.projectMember.create({
        data: { projectId: project.id, userId, role: ProjectRole.OWNER },
      });
      await tx.conversation.create({ data: { projectId: project.id } });

      // Première passe : créer les tâches et retenir l'identifiant obtenu
      // pour chaque position, afin de rétablir les dépendances ensuite.
      const idByPosition = new Map<number, string>();

      for (const templateTask of template.tasks) {
        const start = new Date(
          startDate.getTime() + templateTask.startOffsetDays * MS_PER_DAY,
        );

        const created = await tx.task.create({
          data: {
            projectId: project.id,
            title: templateTask.title,
            description: templateTask.description,
            priority: templateTask.priority,
            startDate: start,
            endDate: taskEnd(
              templateTask.startOffsetDays,
              templateTask.durationDays,
            ),
            storyPoints: templateTask.storyPoints,
            checklist: {
              create: templateTask.checklist.map((label, index) => ({
                label,
                position: index,
              })),
            },
          },
          select: { id: true },
        });

        idByPosition.set(templateTask.position, created.id);
      }

      // Seconde passe : les dépendances, une fois tous les identifiants connus.
      const dependencies = template.tasks.flatMap((templateTask) => {
        const blockedId = idByPosition.get(templateTask.position);
        if (!blockedId) return [];

        return templateTask.blockedByPositions
          .map((position) => idByPosition.get(position))
          .filter((id): id is string => Boolean(id))
          .map((blockingTaskId) => ({
            blockingTaskId,
            blockedTaskId: blockedId,
          }));
      });

      if (dependencies.length > 0) {
        await tx.taskDependency.createMany({ data: dependencies });
      }

      return { ...project, taskCount: template.tasks.length };
    });
  }

  async remove(templateId: string, userId: string) {
    const template = await this.prisma.projectTemplate.findUnique({
      where: { id: templateId },
      select: { id: true, createdById: true },
    });
    if (!template) throw new NotFoundException('Modèle introuvable');

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true },
    });

    // Son auteur, ou un administrateur global.
    if (template.createdById !== userId && user.role !== Role.ADMIN) {
      throw new ForbiddenException(
        'Seul l’auteur du modèle ou un administrateur peut le supprimer',
      );
    }

    await this.prisma.projectTemplate.delete({ where: { id: templateId } });
    return { message: 'Modèle supprimé' };
  }
}

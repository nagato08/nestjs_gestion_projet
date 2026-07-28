import { Injectable, NotFoundException } from '@nestjs/common';
import { ProjectRole, RecurrenceFrequency } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { SetRecurrenceDto } from './dto/set-recurrence.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class ChecklistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async list(taskId: string, userId: string) {
    await this.projectAccess.requireTaskRole(
      taskId,
      userId,
      ProjectRole.VIEWER,
    );

    return this.prisma.checklistItem.findMany({
      where: { taskId },
      orderBy: { position: 'asc' },
    });
  }

  async add(taskId: string, userId: string, dto: CreateChecklistItemDto) {
    // Cocher et gérer la liste relève de l'exécution de la tâche : mêmes
    // droits que sa modification, donc assignation requise pour un MEMBER.
    await this.projectAccess.requireTaskWriteAccess(taskId, userId);

    const last = await this.prisma.checklistItem.findFirst({
      where: { taskId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    return this.prisma.checklistItem.create({
      data: {
        taskId,
        label: dto.label,
        position: (last?.position ?? -1) + 1,
      },
    });
  }

  async update(itemId: string, userId: string, dto: UpdateChecklistItemDto) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, taskId: true },
    });
    if (!item) throw new NotFoundException('Élément introuvable');

    await this.projectAccess.requireTaskWriteAccess(item.taskId, userId);

    return this.prisma.checklistItem.update({
      where: { id: itemId },
      data: { label: dto.label, done: dto.done },
    });
  }

  async remove(itemId: string, userId: string) {
    const item = await this.prisma.checklistItem.findUnique({
      where: { id: itemId },
      select: { id: true, taskId: true },
    });
    if (!item) throw new NotFoundException('Élément introuvable');

    await this.projectAccess.requireTaskWriteAccess(item.taskId, userId);

    await this.prisma.checklistItem.delete({ where: { id: itemId } });
    return { message: 'Élément supprimé' };
  }

  /**
   * Définit ou remplace la règle de récurrence d'une tâche.
   *
   * Réservé aux gestionnaires : une tâche récurrente engendre du travail
   * pour l'équipe à chaque échéance, ce n'est pas une décision individuelle.
   */
  async setRecurrence(taskId: string, userId: string, dto: SetRecurrenceDto) {
    const { projectId } = await this.projectAccess.requireTaskRole(
      taskId,
      userId,
      ProjectRole.ADMIN,
    );
    void projectId;

    return this.prisma.taskRecurrence.upsert({
      where: { taskId },
      create: {
        taskId,
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        until: dto.until ? new Date(dto.until) : null,
      },
      update: {
        frequency: dto.frequency,
        interval: dto.interval ?? 1,
        until: dto.until ? new Date(dto.until) : null,
        active: dto.active ?? true,
      },
    });
  }

  async removeRecurrence(taskId: string, userId: string) {
    await this.projectAccess.requireTaskRole(taskId, userId, ProjectRole.ADMIN);

    await this.prisma.taskRecurrence.deleteMany({ where: { taskId } });
    return { message: 'Récurrence supprimée' };
  }

  /**
   * Engendre la prochaine occurrence d'une tâche récurrente terminée.
   *
   * Appelé au passage en DONE plutôt que par une tâche planifiée : la
   * répétition suit l'achèvement réel, pas le calendrier théorique. Une tâche
   * hebdomadaire terminée avec trois jours de retard décale d'autant la
   * suivante, ce qui reflète le rythme réel de l'équipe.
   */
  async generateNextOccurrence(taskId: string): Promise<string | null> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        recurrence: true,
        checklist: { orderBy: { position: 'asc' } },
        assignments: { select: { userId: true } },
      },
    });

    const rule = task?.recurrence;
    if (!task || !rule || !rule.active) return null;

    const base = task.startDate ?? new Date();
    const next = this.addInterval(base, rule.frequency, rule.interval);

    if (rule.until && next.getTime() > rule.until.getTime()) {
      // Fin de série : on désactive plutôt que de supprimer, l'historique
      // de la règle reste consultable.
      await this.prisma.taskRecurrence.update({
        where: { id: rule.id },
        data: { active: false },
      });
      return null;
    }

    const duration =
      task.startDate && task.endDate
        ? task.endDate.getTime() - task.startDate.getTime()
        : 0;

    const created = await this.prisma.task.create({
      data: {
        projectId: task.projectId,
        title: task.title,
        description: task.description,
        priority: task.priority,
        startDate: next,
        endDate: new Date(next.getTime() + duration),
        deadline: task.deadline
          ? this.addInterval(task.deadline, rule.frequency, rule.interval)
          : null,
        storyPoints: task.storyPoints,
        recurrenceOfId: task.id,
        // La liste de contrôle repart vierge : elle décrit ce qu'il reste
        // à faire pour cette occurrence, pas l'historique de la précédente.
        checklist: {
          create: task.checklist.map((item, index) => ({
            label: item.label,
            position: index,
          })),
        },
        assignments: {
          create: task.assignments.map((a) => ({ userId: a.userId })),
        },
      },
      select: { id: true },
    });

    await this.prisma.taskRecurrence.update({
      where: { id: rule.id },
      data: { lastGeneratedAt: new Date() },
    });

    return created.id;
  }

  private addInterval(
    date: Date,
    frequency: RecurrenceFrequency,
    interval: number,
  ): Date {
    const next = new Date(date);
    const step = Math.max(1, interval);

    switch (frequency) {
      case RecurrenceFrequency.DAILY:
        next.setTime(next.getTime() + step * MS_PER_DAY);
        break;
      case RecurrenceFrequency.WEEKLY:
        next.setTime(next.getTime() + step * 7 * MS_PER_DAY);
        break;
      case RecurrenceFrequency.MONTHLY:
        // setMonth gère le débordement : 31 janvier + 1 mois donne le
        // 3 mars, ce qui est le comportement attendu par défaut en JS.
        next.setMonth(next.getMonth() + step);
        break;
    }

    return next;
  }
}

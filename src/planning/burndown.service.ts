import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { TaskStatus } from '@prisma/client';

/**
 * Burndown Chart : travail restant (story points ou nombre de tâches) vs temps.
 * Courbe idéale = ligne droite de total à 0 ; courbe réelle = travail restant chaque jour.
 */
@Injectable()
export class BurndownService {
  constructor(private readonly prisma: PrismaService) {}

  private async ensureProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { members: true },
    });
    if (!project) throw new NotFoundException('Projet introuvable');
    const isMember = project.members.some((m) => m.userId === userId);
    if (!isMember)
      throw new ForbiddenException("Vous n'avez pas accès à ce projet");
  }

  /**
   * Données pour le Burndown sur une plage de dates (ex. sprint).
   * Si startDate/endDate non fournis, on utilise les dates du projet.
   * Retourne : dates (chaque jour), ideal (travail restant idéal), actual (travail restant réel).
   * Travail = story points si présents, sinon nombre de tâches non DONE.
   */
  async getBurndownData(
    projectId: string,
    userId: string,
    startDate?: string,
    endDate?: string,
  ) {
    await this.ensureProjectAccess(projectId, userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { startDate: true, endDate: true },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    const start = startDate ? new Date(startDate) : project.startDate;
    const end = endDate ? new Date(endDate) : (project.endDate ?? new Date());
    const totalDays =
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) || 1;

    type BurndownTaskRow = {
      id: string;
      storyPoints: number | null;
      status: TaskStatus;
      createdAt: Date;
      updatedAt: Date;
    };
    // select includes storyPoints; cast needed until Prisma client is regenerated
    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- result cast to BurndownTaskRow[] */
    const tasks = (await this.prisma.task.findMany({
      where: { projectId, parentId: null },
      select: {
        id: true,
        storyPoints: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      } as any,
    })) as unknown as BurndownTaskRow[];
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */

    const useStoryPoints = tasks.some(
      (t) => t.storyPoints != null && t.storyPoints > 0,
    );
    const totalWork = useStoryPoints
      ? tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0)
      : tasks.length;

    const dates: string[] = [];
    const ideal: number[] = [];
    const actual: number[] = [];

    for (let d = 0; d <= totalDays; d++) {
      const date = new Date(start);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split('T')[0];
      dates.push(dateStr);

      const idealRemaining = totalWork - (totalWork * d) / totalDays;
      ideal.push(Math.max(0, Math.round(idealRemaining * 10) / 10));

      let remaining: number;
      if (useStoryPoints) {
        remaining = tasks
          .filter((t) => {
            const doneAt = t.status === TaskStatus.DONE ? t.updatedAt : null;
            return !doneAt || doneAt > date;
          })
          .reduce((s, t) => s + (t.storyPoints ?? 0), 0);
      } else {
        remaining = tasks.filter((t) => {
          const doneAt = t.status === TaskStatus.DONE ? t.updatedAt : null;
          return !doneAt || doneAt > date;
        }).length;
      }
      actual.push(remaining);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      totalWork,
      useStoryPoints,
      dates,
      ideal,
      actual,
    };
  }
}

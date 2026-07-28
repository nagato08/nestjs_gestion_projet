import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { TaskStatus } from '@prisma/client';

/**
 * Burndown Chart : travail restant (story points ou nombre de tâches) vs temps.
 * Courbe idéale = ligne droite de total à 0 ; courbe réelle = travail restant chaque jour.
 */
@Injectable()
export class BurndownService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private async ensureProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    // Lecture seule : tout membre du projet, y compris VIEWER.
    await this.projectAccess.requireMember(projectId, userId);
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
    sprintId?: string,
  ) {
    await this.ensureProjectAccess(projectId, userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { startDate: true, endDate: true },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    // Un sprint donne au graphe sa raison d'être : sa période et son
    // périmètre de tâches remplacent les dates arbitraires du projet.
    const sprint = sprintId
      ? await this.prisma.sprint.findFirst({
          where: { id: sprintId, projectId },
          select: {
            id: true,
            name: true,
            goal: true,
            startDate: true,
            endDate: true,
            status: true,
          },
        })
      : null;

    if (sprintId && !sprint) {
      throw new NotFoundException('Sprint introuvable');
    }

    const start = sprint
      ? sprint.startDate
      : startDate
        ? new Date(startDate)
        : project.startDate;
    const end = sprint
      ? sprint.endDate
      : endDate
        ? new Date(endDate)
        : (project.endDate ?? new Date());
    const totalDays =
      Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) || 1;

    type BurndownTaskRow = {
      id: string;
      storyPoints: number | null;
      status: TaskStatus;
      createdAt: Date;
      completedAt: Date | null;
    };
    const tasks: BurndownTaskRow[] = await this.prisma.task.findMany({
      // Avec un sprint, le périmètre est celui du sprint et non tout le
      // projet — c'est ce qui distingue un burndown d'itération d'une courbe
      // d'avancement global.
      where: {
        projectId,
        parentId: null,
        ...(sprint ? { sprintId: sprint.id } : {}),
      },
      select: {
        id: true,
        storyPoints: true,
        status: true,
        createdAt: true,
        completedAt: true,
      },
    });

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

      // Borne haute du jour : un burndown lit « ce qu'il restait le soir du
      // jour J ». Comparer au petit matin repousserait au lendemain toute
      // tâche terminée dans la journée.
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const idealRemaining = totalWork - (totalWork * d) / totalDays;
      ideal.push(Math.max(0, Math.round(idealRemaining * 10) / 10));

      let remaining: number;
      if (useStoryPoints) {
        remaining = tasks
          .filter((t) => {
            return !t.completedAt || t.completedAt > endOfDay;
          })
          .reduce((s, t) => s + (t.storyPoints ?? 0), 0);
      } else {
        remaining = tasks.filter((t) => {
          return !t.completedAt || t.completedAt > endOfDay;
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
      // Null quand la courbe porte sur le projet entier : le front distingue
      // ainsi un vrai burndown de sprint d'un avancement global.
      sprint: sprint
        ? {
            id: sprint.id,
            name: sprint.name,
            goal: sprint.goal,
            status: sprint.status,
          }
        : null,
    };
  }
}

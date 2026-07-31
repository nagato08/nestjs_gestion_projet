import { Injectable } from '@nestjs/common';
import { AbsenceStatus, AbsenceType, Role, TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { AbsenceService } from './absence.service';

/**
 * Événement affiché sur une grille d'agenda, quelle que soit son origine.
 *
 * Forme unique volontaire : la grille se contente de poser des pastilles sur
 * des jours, elle n'a pas à connaître la différence entre une échéance de
 * tâche et un congé. Le `kind` ne sert qu'à la couleur et au libellé.
 */
export interface CalendarEvent {
  id: string;
  kind: 'TASK' | 'MILESTONE' | 'SPRINT' | 'ABSENCE';
  title: string;
  /** Bornes incluses. Un événement ponctuel porte la même date des deux côtés. */
  startDate: string;
  endDate: string;
  projectId: string | null;
  projectName: string | null;
  /** Statut de tâche, pour distinguer d'un coup d'œil ce qui est déjà fait. */
  status: TaskStatus | null;
  /** Renseignés pour les absences uniquement. */
  userName: string | null;
  absenceType: AbsenceType | null;
  /** Une demande encore en attente ne vaut pas une absence acquise. */
  absenceStatus: AbsenceStatus | null;
}

@Injectable()
export class CalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly absenceService: AbsenceService,
  ) {}

  private toDayString(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private windowBounds(start: string, end: string) {
    const from = new Date(start);
    from.setHours(0, 0, 0, 0);
    const to = new Date(end);
    to.setHours(23, 59, 59, 999);
    return { from, to };
  }

  /** Projets non supprimés auxquels l'utilisateur appartient. */
  private async myProjectIds(userId: string): Promise<string[]> {
    const memberships = await this.prisma.projectMember.findMany({
      where: { userId, project: { deletedAt: null } },
      select: { projectId: true },
    });
    return memberships.map((m) => m.projectId);
  }

  /**
   * Agenda personnel : ce dont l'utilisateur est lui-même responsable —
   * les tâches qui lui sont assignées et ses propres disponibilités.
   */
  async getPersonal(
    userId: string,
    start: string,
    end: string,
  ): Promise<CalendarEvent[]> {
    const { from, to } = this.windowBounds(start, end);

    const [tasks, absences] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          deadline: { gte: from, lte: to },
          assignments: { some: { userId } },
          project: { deletedAt: null },
        },
        select: {
          id: true,
          title: true,
          status: true,
          deadline: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      this.absenceService.listMine(userId, start, end),
    ]);

    const events: CalendarEvent[] = tasks.map((task) => ({
      id: task.id,
      kind: 'TASK',
      title: task.title,
      startDate: this.toDayString(task.deadline!),
      endDate: this.toDayString(task.deadline!),
      projectId: task.projectId,
      projectName: task.project.name,
      status: task.status,
      userName: null,
      absenceType: null,
      absenceStatus: null,
    }));

    for (const absence of absences) {
      events.push({
        id: absence.id,
        kind: 'ABSENCE',
        title: 'Indisponible',
        startDate: this.toDayString(absence.startDate),
        endDate: this.toDayString(absence.endDate),
        projectId: null,
        projectName: null,
        status: null,
        userName: null,
        absenceType: absence.type,
        absenceStatus: absence.status,
      });
    }

    return events;
  }

  /**
   * Agenda d'organisation : l'activité de l'équipe sur les projets communs —
   * échéances, jalons, sprints, et qui est indisponible quand.
   *
   * Restreint aux projets dont l'utilisateur est membre, comme partout
   * ailleurs dans l'application : un agenda ne fait pas exception à la règle
   * de cloisonnement. Un administrateur voit en plus les absences de tous,
   * puisqu'il administre déjà l'ensemble des comptes.
   */
  async getOrganisation(
    userId: string,
    userRole: Role,
    start: string,
    end: string,
  ): Promise<CalendarEvent[]> {
    const { from, to } = this.windowBounds(start, end);
    const projectIds = await this.myProjectIds(userId);

    const [tasks, milestones, sprints, colleagueIds] = await Promise.all([
      this.prisma.task.findMany({
        where: {
          projectId: { in: projectIds },
          deadline: { gte: from, lte: to },
        },
        select: {
          id: true,
          title: true,
          status: true,
          deadline: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      this.prisma.milestone.findMany({
        where: { projectId: { in: projectIds }, date: { gte: from, lte: to } },
        select: {
          id: true,
          name: true,
          date: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      this.prisma.sprint.findMany({
        where: {
          projectId: { in: projectIds },
          startDate: { lte: to },
          endDate: { gte: from },
        },
        select: {
          id: true,
          name: true,
          startDate: true,
          endDate: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),
      this.visibleUserIds(userId, userRole, projectIds),
    ]);

    const absences = await this.absenceService.listForUsers(
      colleagueIds,
      start,
      end,
    );

    const events: CalendarEvent[] = [];

    for (const task of tasks) {
      events.push({
        id: task.id,
        kind: 'TASK',
        title: task.title,
        startDate: this.toDayString(task.deadline!),
        endDate: this.toDayString(task.deadline!),
        projectId: task.projectId,
        projectName: task.project.name,
        status: task.status,
        userName: null,
        absenceType: null,
        absenceStatus: null,
      });
    }

    for (const milestone of milestones) {
      events.push({
        id: milestone.id,
        kind: 'MILESTONE',
        title: milestone.name,
        startDate: this.toDayString(milestone.date),
        endDate: this.toDayString(milestone.date),
        projectId: milestone.projectId,
        projectName: milestone.project.name,
        status: null,
        userName: null,
        absenceType: null,
        absenceStatus: null,
      });
    }

    for (const sprint of sprints) {
      events.push({
        id: sprint.id,
        kind: 'SPRINT',
        title: sprint.name,
        startDate: this.toDayString(sprint.startDate),
        endDate: this.toDayString(sprint.endDate),
        projectId: sprint.projectId,
        projectName: sprint.project.name,
        status: null,
        userName: null,
        absenceType: null,
        absenceStatus: null,
      });
    }

    for (const absence of absences) {
      events.push({
        id: absence.id,
        kind: 'ABSENCE',
        title: `${absence.user.firstName} ${absence.user.lastName}`,
        startDate: this.toDayString(absence.startDate),
        endDate: this.toDayString(absence.endDate),
        projectId: null,
        projectName: null,
        status: null,
        userName: `${absence.user.firstName} ${absence.user.lastName}`,
        absenceType: absence.type,
        absenceStatus: absence.status,
      });
    }

    return events;
  }

  /**
   * Personnes dont l'utilisateur peut voir les indisponibilités : ses
   * collègues de projet, ou tout le monde s'il administre l'application.
   */
  private async visibleUserIds(
    userId: string,
    userRole: Role,
    projectIds: string[],
  ): Promise<string[]> {
    if (userRole === Role.ADMIN) {
      const users = await this.prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true },
      });
      return users.map((u) => u.id);
    }

    if (projectIds.length === 0) return [userId];

    const members = await this.prisma.projectMember.findMany({
      where: { projectId: { in: projectIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    return members.map((m) => m.userId);
  }
}

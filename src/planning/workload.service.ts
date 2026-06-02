import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

const DEFAULT_WEEKLY_HOURS = 40;
const DEFAULT_DAILY_HOURS = 8;

type WorkloadEntry = {
  userId: string;
  userName: string;
  avatar: string | null;
  hours: number;
  isOverloaded: boolean;
  byPeriod: { date: string; hours: number }[];
};

@Injectable()
export class WorkloadService {
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

  async getWorkload(
    userId: string,
    startDate: string,
    endDate: string,
    projectId?: string,
    groupBy: 'day' | 'week' = 'day',
  ) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (projectId) await this.ensureProjectAccess(projectId, userId);

    const overloadThresholdHours =
      groupBy === 'week' ? DEFAULT_WEEKLY_HOURS : DEFAULT_DAILY_HOURS;

    // 1. Récupérer tous les membres concernés (du projet si fourni, sinon ceux ayant pointé)
    const projectMembers = projectId
      ? await this.prisma.projectMember.findMany({
          where: { projectId },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        })
      : [];

    // 2. Récupérer les TimeEntry terminés sur la période
    const where: {
      endTime: { not: null; gte?: Date; lte?: Date };
      task?: { projectId: string };
    } = {
      endTime: { not: null, gte: start, lte: end },
    };
    if (projectId) where.task = { projectId };

    const entries = await this.prisma.timeEntry.findMany({
      where,
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    });

    // 3. Initialiser une map avec tous les membres (charge 0)
    const byUser = new Map<string, WorkloadEntry>();
    for (const m of projectMembers) {
      byUser.set(m.user.id, {
        userId: m.user.id,
        userName: `${m.user.firstName} ${m.user.lastName}`,
        avatar: m.user.avatar,
        hours: 0,
        isOverloaded: false,
        byPeriod: [],
      });
    }

    // 4. Agréger les minutes par utilisateur et période
    for (const e of entries) {
      if (!e.duration || !e.endTime) continue;
      const u = e.user;
      if (!byUser.has(u.id)) {
        byUser.set(u.id, {
          userId: u.id,
          userName: `${u.firstName} ${u.lastName}`,
          avatar: u.avatar,
          hours: 0,
          isOverloaded: false,
          byPeriod: [],
        });
      }
      const rec = byUser.get(u.id)!;
      const periodKey =
        groupBy === 'week'
          ? getWeekStart(e.endTime)
          : e.endTime.toISOString().split('T')[0];
      const existing = rec.byPeriod.find((p) => p.date === periodKey);
      const hours = e.duration / 60;
      if (existing) existing.hours += hours;
      else rec.byPeriod.push({ date: periodKey, hours });
    }

    // 5. Finaliser : trier byPeriod, calculer total, flag surcharge
    let totalHours = 0;
    for (const rec of byUser.values()) {
      rec.byPeriod.sort((a, b) => a.date.localeCompare(b.date));
      rec.byPeriod = rec.byPeriod.map((p) => ({
        date: p.date,
        hours: Math.round(p.hours * 10) / 10,
      }));
      const sumHours = rec.byPeriod.reduce((acc, p) => acc + p.hours, 0);
      rec.hours = Math.round(sumHours * 10) / 10;
      rec.isOverloaded = rec.byPeriod.some(
        (p) => p.hours > overloadThresholdHours,
      );
      totalHours += rec.hours;
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      groupBy,
      overloadThresholdHours,
      totalHours: Math.round(totalHours * 10) / 10,
      entries: Array.from(byUser.values()),
    };
  }
}

function getWeekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

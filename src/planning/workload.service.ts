import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

/** Seuil hebdo en minutes (40h) pour alerter surcharge */
const DEFAULT_WEEKLY_MINUTES = 40 * 60;

/**
 * Histogramme de charge : heures par employé par jour ou par semaine.
 * Si un employé dépasse 40h/semaine, le front peut afficher en rouge.
 */
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

  /**
   * Charge par utilisateur et par jour (ou par semaine si groupBy=week).
   * projectId optionnel : si fourni, seules les entrées des tâches de ce projet sont comptées.
   */
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
        task: { select: { id: true, title: true, projectId: true } },
      },
    });

    const byUser = new Map<
      string,
      {
        userId: string;
        userName: string;
        avatar: string | null;
        byDay: { date: string; minutes: number }[];
        byWeek?: { weekStart: string; minutes: number }[];
        totalMinutes: number;
        isOverloaded: boolean;
      }
    >();

    for (const e of entries) {
      if (!e.duration || !e.endTime) continue;
      const u = e.user;
      if (!byUser.has(u.id)) {
        byUser.set(u.id, {
          userId: u.id,
          userName: `${u.firstName} ${u.lastName}`,
          avatar: u.avatar,
          byDay: [],
          totalMinutes: 0,
          isOverloaded: false,
        });
      }
      const rec = byUser.get(u.id)!;
      const dayKey = e.endTime.toISOString().split('T')[0];
      const existing = rec.byDay.find((d) => d.date === dayKey);
      if (existing) existing.minutes += e.duration;
      else rec.byDay.push({ date: dayKey, minutes: e.duration });
      rec.totalMinutes += e.duration;
    }

    for (const rec of byUser.values()) {
      rec.byDay.sort((a, b) => a.date.localeCompare(b.date));
      if (groupBy === 'week') {
        const byWeek = new Map<string, number>();
        for (const d of rec.byDay) {
          const weekStart = getWeekStart(d.date);
          byWeek.set(weekStart, (byWeek.get(weekStart) ?? 0) + d.minutes);
        }
        rec.byWeek = Array.from(byWeek.entries()).map(
          ([weekStart, minutes]) => ({
            weekStart,
            minutes,
          }),
        );
        rec.isOverloaded = rec.byWeek.some(
          (w) => w.minutes > DEFAULT_WEEKLY_MINUTES,
        );
      }
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      groupBy,
      overloadThresholdMinutes: DEFAULT_WEEKLY_MINUTES,
      byUser: Array.from(byUser.values()),
    };
  }
}

function getWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}

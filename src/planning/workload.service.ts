import { Injectable } from '@nestjs/common';
import { ChargeUnit } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectSettingsService } from 'src/project-settings/project-settings.service';

// Repli pour la charge globale (sans projectId) : aucun ProjectSettings ne
// s'applique alors, il faut bien une valeur par défaut.
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

type MachinePeriod = { date: string; hours: number; overCapacity: boolean };

/** Convertit des heures brutes vers l'unité d'affichage choisie par le projet. */
function toUnit(hours: number, unit: ChargeUnit, hoursPerDay: number): number {
  const value = unit === ChargeUnit.PERSON_DAYS ? hours / hoursPerDay : hours;
  return Math.round(value * 10) / 10;
}

@Injectable()
export class WorkloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectSettings: ProjectSettingsService,
  ) {}

  async getWorkload(
    userId: string,
    startDate: string,
    endDate: string,
    projectId?: string,
    groupBy: 'day' | 'week' = 'day',
  ) {
    const start = new Date(startDate);
    // Borne haute du jour : sans ceci, `endDate` (une date sans heure) vaut
    // minuit et exclut tout pointage fait plus tard dans la journée même —
    // typiquement, toute heure enregistrée aujourd'hui n'apparaît jamais.
    // Même correctif que le burndown (`burndown.service.ts`).
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // `getSettings` vérifie déjà l'accès (requireMember) : pas besoin d'un
    // second appel à `ensureProjectAccess` en plus.
    const settings = projectId
      ? await this.projectSettings.getSettings(projectId, userId)
      : null;

    // Sans projet (vue globale), aucun calendrier ne s'applique : on retombe
    // sur les constantes historiques. Avec un projet, ses propres réglages
    // priment — un chantier à 10h/jour n'a pas le même seuil de surcharge
    // qu'un projet de bureau à 8h/jour.
    const overloadThresholdHours = settings
      ? groupBy === 'week'
        ? settings.hoursPerDay * settings.workingDays.length
        : settings.hoursPerDay
      : groupBy === 'week'
        ? DEFAULT_WEEKLY_HOURS
        : DEFAULT_DAILY_HOURS;

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
    const teamPeriodTotals = new Map<string, number>();
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

      for (const p of rec.byPeriod) {
        teamPeriodTotals.set(
          p.date,
          (teamPeriodTotals.get(p.date) ?? 0) + p.hours,
        );
      }
    }

    // 6. Capacité machine : seuil collectif, indépendant des individus — un
    // projet borné par une seule machine ne peut pas dépasser sa capacité
    // même si dix personnes s'y relaient. 0 = ressource non suivie (défaut).
    let machine: {
      capacityPerPeriod: number;
      byPeriod: MachinePeriod[];
    } | null = null;
    if (settings && settings.machineCapacityPerDay > 0) {
      const capacityPerPeriod =
        groupBy === 'week'
          ? settings.machineCapacityPerDay * settings.workingDays.length
          : settings.machineCapacityPerDay;

      machine = {
        capacityPerPeriod: toUnit(
          capacityPerPeriod,
          settings.chargeUnit,
          settings.hoursPerDay,
        ),
        byPeriod: Array.from(teamPeriodTotals.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, hours]) => ({
            date,
            hours: toUnit(hours, settings.chargeUnit, settings.hoursPerDay),
            overCapacity: hours > capacityPerPeriod,
          })),
      };
    }

    // 7. Unité d'affichage : heures brutes par défaut, ou jour-homme si le
    // projet l'a choisi — un chef de projet raisonne plus naturellement en
    // jours qu'en heures pour un rapport de charge. Appliquée en tout dernier :
    // les comparaisons de surcharge ci-dessus raisonnent toujours en heures.
    const chargeUnit = settings?.chargeUnit ?? ChargeUnit.HOURS;
    const hoursPerDay = settings?.hoursPerDay ?? DEFAULT_DAILY_HOURS;

    for (const rec of byUser.values()) {
      rec.byPeriod = rec.byPeriod.map((p) => ({
        date: p.date,
        hours: toUnit(p.hours, chargeUnit, hoursPerDay),
      }));
      rec.hours = toUnit(rec.hours, chargeUnit, hoursPerDay);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      groupBy,
      chargeUnit,
      overloadThresholdHours: toUnit(
        overloadThresholdHours,
        chargeUnit,
        hoursPerDay,
      ),
      totalHours: toUnit(totalHours, chargeUnit, hoursPerDay),
      machine,
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

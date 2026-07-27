import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import {
  AUDIT_ACTION_CATALOG,
  AUDIT_CATEGORIES,
  AUDIT_SEVERITIES,
  actionsForCategories,
  actionsForSeverities,
} from './audit-actions.catalog';

/** Filtres communs à la consultation et à l'export. */
export interface AuditFilters {
  /** Une action précise. */
  action?: string;
  /** Plusieurs actions à la fois. */
  actions?: string[];
  /** Catégories métier (Projet, Membres, Tâches, Documents, Comptes). */
  categories?: string[];
  /** Niveaux de gravité (critical, warning, info). */
  severities?: string[];
  userId?: string;
  userIds?: string[];
  targetType?: string;
  targetTypes?: string[];
  targetId?: string;
  /** Origine réseau, pour pister une session suspecte. */
  ip?: string;
  /** Corrélation avec les logs applicatifs. */
  requestId?: string;
  /** Raccourci de période : 7, 30 ou 90 derniers jours. */
  period?: '7d' | '30d' | '90d';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  /** Tri chronologique. Par défaut du plus récent au plus ancien. */
  sort?: 'asc' | 'desc';
}

export interface AuditEntry {
  action: string;
  userId?: string | null;
  userEmail?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Écriture du journal d'audit.
 *
 * Règle de conception : **auditer ne doit jamais casser l'action auditée**.
 * Une panne d'écriture du journal est donc tracée dans les logs applicatifs
 * mais n'interrompt pas la requête en cours.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: entry.action,
          userId: entry.userId ?? null,
          userEmail: entry.userEmail ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          metadata: (entry.metadata ?? undefined) as Prisma.InputJsonValue,
          ip: entry.ip ?? null,
          userAgent: entry.userAgent ?? null,
          requestId: entry.requestId ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Échec d'écriture du journal d'audit pour "${entry.action}"`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /** Nombre maximum d'entrées renvoyées à l'écran en une fois. */
  private static readonly MAX_PAGE_SIZE = 200;

  /**
   * Plafond de l'export. Volontairement élevé mais fini : un export sans
   * filtre sur une base ancienne ne doit ni saturer l'API ni le navigateur.
   */
  private static readonly MAX_EXPORT_SIZE = 10_000;

  /** Nombre de jours couverts par chaque raccourci de période. */
  private static readonly PERIOD_DAYS: Record<string, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
  };

  /**
   * Croise les trois façons de désigner des actions (code exact, catégorie,
   * gravité) en une seule liste.
   *
   * L'intersection est volontaire : demander « catégorie Tâches » ET
   * « gravité critique » doit renvoyer les actions qui satisfont les deux, pas
   * leur union. Une combinaison sans recoupement renvoie donc zéro résultat,
   * ce qui est le comportement attendu d'un filtre.
   */
  private resolveActionFilter(filters: AuditFilters): string[] | null {
    const constraints: string[][] = [];

    const explicit = [
      ...(filters.actions ?? []),
      ...(filters.action ? [filters.action] : []),
    ];
    if (explicit.length) constraints.push(explicit);

    if (filters.categories?.length) {
      constraints.push(actionsForCategories(filters.categories));
    }
    if (filters.severities?.length) {
      constraints.push(actionsForSeverities(filters.severities));
    }

    if (constraints.length === 0) return null;

    return constraints.reduce((acc, list) =>
      acc.filter((action) => list.includes(action)),
    );
  }

  /** Borne basse déduite du raccourci de période, si fourni. */
  private periodStart(period?: string): Date | undefined {
    if (!period) return undefined;
    const days = AuditService.PERIOD_DAYS[period];
    if (!days) return undefined;

    const start = new Date();
    start.setDate(start.getDate() - days);
    return start;
  }

  /** Traduit les filtres exposés par l'API en clause Prisma. */
  private buildWhere(filters: AuditFilters): Prisma.AuditLogWhereInput {
    const { dateTo, search } = filters;

    // Une date explicite l'emporte sur le raccourci de période : si
    // l'utilisateur saisit une date, c'est elle qui fait foi.
    const periodStart = this.periodStart(filters.period);
    const from = filters.dateFrom ? new Date(filters.dateFrom) : periodStart;

    const actionFilter = this.resolveActionFilter(filters);

    const userIds = [
      ...(filters.userIds ?? []),
      ...(filters.userId ? [filters.userId] : []),
    ];
    const targetTypes = [
      ...(filters.targetTypes ?? []),
      ...(filters.targetType ? [filters.targetType] : []),
    ];

    return {
      ...(actionFilter ? { action: { in: actionFilter } } : {}),
      ...(userIds.length ? { userId: { in: userIds } } : {}),
      ...(targetTypes.length ? { targetType: { in: targetTypes } } : {}),
      ...(filters.targetId ? { targetId: filters.targetId } : {}),
      ...(filters.ip ? { ip: filters.ip } : {}),
      ...(filters.requestId ? { requestId: filters.requestId } : {}),
      ...(from || dateTo
        ? {
            createdAt: {
              ...(from ? { gte: from } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
      ...(search
        ? {
            OR: [
              { userEmail: { contains: search, mode: 'insensitive' } },
              { action: { contains: search, mode: 'insensitive' } },
              { targetId: { contains: search, mode: 'insensitive' } },
              { ip: { contains: search, mode: 'insensitive' } },
              { requestId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  /** Ordre chronologique demandé, du plus récent par défaut. */
  private orderBy(
    filters: AuditFilters,
  ): Prisma.AuditLogOrderByWithRelationInput {
    return { createdAt: filters.sort === 'asc' ? 'asc' : 'desc' };
  }

  /**
   * Consultation du journal, du plus récent au plus ancien.
   * Réservé aux administrateurs (voir le contrôleur).
   */
  async list(params: AuditFilters & { skip?: number; take?: number }) {
    const { skip = 0, take = 25, ...filters } = params;
    const where = this.buildWhere(filters);
    const pageSize = Math.min(take, AuditService.MAX_PAGE_SIZE);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: this.orderBy(filters),
        skip,
        take: pageSize,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, skip, take: pageSize };
  }

  /**
   * Jeu complet correspondant aux filtres, destiné à l'export.
   *
   * Séparé de `list` : l'écran pagine par 25, l'export doit sortir l'ensemble
   * de ce que l'utilisateur a filtré, sans qu'il ait à parcourir les pages.
   */
  async listForExport(filters: AuditFilters) {
    const where = this.buildWhere(filters);

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: this.orderBy(filters),
        take: AuditService.MAX_EXPORT_SIZE,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items,
      total,
      // Signale une troncature pour que l'interface avertisse l'utilisateur
      // au lieu de lui livrer un export silencieusement incomplet.
      truncated: total > AuditService.MAX_EXPORT_SIZE,
      limit: AuditService.MAX_EXPORT_SIZE,
    };
  }

  /**
   * Valeurs distinctes présentes en base, pour alimenter les listes de filtres
   * sans les coder en dur côté interface.
   */
  async getFilterOptions() {
    const [actions, targetTypes, actors, ips] = await Promise.all([
      this.prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['targetType'],
        select: { targetType: true },
        where: { targetType: { not: null } },
        orderBy: { targetType: 'asc' },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['userId'],
        select: {
          userId: true,
          userEmail: true,
          user: { select: { firstName: true, lastName: true } },
        },
        where: { userId: { not: null } },
      }),
      this.prisma.auditLog.findMany({
        distinct: ['ip'],
        select: { ip: true },
        where: { ip: { not: null } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const usedActions = actions.map((a) => a.action);

    return {
      // Catalogue complet : libellés, gravités et catégories, pour que
      // l'interface n'ait pas à dupliquer cette table.
      catalog: AUDIT_ACTION_CATALOG,
      categories: AUDIT_CATEGORIES,
      severities: AUDIT_SEVERITIES,
      // Actions réellement présentes en base : proposer un filtre qui ne
      // renverrait jamais rien induirait en erreur.
      actions: usedActions,
      targetTypes: targetTypes
        .map((t) => t.targetType)
        .filter((t): t is string => Boolean(t)),
      actors: actors
        .filter((a) => a.userId)
        .map((a) => ({
          id: a.userId as string,
          email: a.userEmail,
          name: a.user
            ? `${a.user.firstName} ${a.user.lastName}`
            : (a.userEmail ?? 'Compte supprimé'),
        })),
      ips: ips
        .map((row) => row.ip)
        .filter((ip): ip is string => Boolean(ip))
        .slice(0, 100),
    };
  }

  /**
   * Indicateurs d'en-tête : volume total, activité du jour et des 7 derniers
   * jours, nombre d'auteurs distincts, et répartition par action.
   */
  async getStats(filters: AuditFilters = {}) {
    // Les indicateurs suivent les filtres courants : afficher un total global
    // au-dessus d'un tableau filtré donnerait deux chiffres contradictoires.
    const where = this.buildWhere(filters);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [matching, overall, today, lastSevenDays, byAction, actors] =
      await Promise.all([
        this.prisma.auditLog.count({ where }),
        this.prisma.auditLog.count(),
        this.prisma.auditLog.count({
          where: { ...where, createdAt: { gte: startOfDay } },
        }),
        this.prisma.auditLog.count({
          where: { ...where, createdAt: { gte: sevenDaysAgo } },
        }),
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where,
          _count: { _all: true },
          orderBy: { _count: { action: 'desc' } },
        }),
        this.prisma.auditLog.findMany({
          where: { ...where, userId: { not: null } },
          distinct: ['userId'],
          select: { userId: true },
        }),
      ]);

    return {
      /** Entrées correspondant aux filtres courants. */
      total: matching,
      /** Volume total du journal, tous filtres confondus. */
      overall,
      today,
      lastSevenDays,
      distinctActors: actors.length,
      byAction: byAction.map((row) => ({
        action: row.action,
        count: row._count._all,
      })),
    };
  }
}

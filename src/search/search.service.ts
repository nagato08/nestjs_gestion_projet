import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

/** Limite par catégorie, pour que la réponse reste utilisable. */
const PER_TYPE_LIMIT = 8;

export type SearchResultType = 'project' | 'task' | 'document' | 'user';

export interface SearchResult {
  type: SearchResultType;
  id: string;
  title: string;
  /** Contexte affiché sous le titre (nom du projet, email...). */
  subtitle: string | null;
  /** Route front vers l'élément. */
  url: string;
}

/**
 * Recherche transverse projets / tâches / documents / utilisateurs.
 *
 * Principe de visibilité : on ne renvoie que ce à quoi l'utilisateur a déjà
 * accès. Projets, tâches et documents sont filtrés sur l'appartenance au
 * projet ; un ADMIN global voit tout, cohérent avec le reste du contrôle
 * d'accès.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(userId: string, rawQuery: string) {
    const query = rawQuery.trim();

    // En dessous de deux caractères, la recherche ramènerait presque tout
    // sans rien cibler.
    if (query.length < 2) {
      return { query, results: [], total: 0 };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    const isGlobalAdmin = user?.role === Role.ADMIN;

    // Portée : tous les projets pour un ADMIN global, sinon ceux dont
    // l'utilisateur est membre.
    const projectScope = isGlobalAdmin
      ? { deletedAt: null }
      : { deletedAt: null, members: { some: { userId } } };

    const contains = { contains: query, mode: 'insensitive' as const };

    const [projects, tasks, documents, users] = await Promise.all([
      this.prisma.project.findMany({
        where: {
          ...projectScope,
          OR: [{ name: contains }, { description: contains }],
        },
        take: PER_TYPE_LIMIT,
        select: { id: true, name: true, status: true },
      }),

      this.prisma.task.findMany({
        where: {
          project: projectScope,
          OR: [{ title: contains }, { description: contains }],
        },
        take: PER_TYPE_LIMIT,
        select: {
          id: true,
          title: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),

      this.prisma.document.findMany({
        where: { project: projectScope, name: contains },
        take: PER_TYPE_LIMIT,
        select: {
          id: true,
          name: true,
          projectId: true,
          project: { select: { name: true } },
        },
      }),

      // Les utilisateurs ne sont pas cloisonnés par projet : l'annuaire sert
      // à assigner et inviter. Les comptes supprimés restent exclus.
      this.prisma.user.findMany({
        where: {
          deletedAt: null,
          OR: [
            { firstName: contains },
            { lastName: contains },
            { email: contains },
          ],
        },
        take: PER_TYPE_LIMIT,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          jobTitle: true,
        },
      }),
    ]);

    const results: SearchResult[] = [
      ...projects.map<SearchResult>((p) => ({
        type: 'project',
        id: p.id,
        title: p.name,
        subtitle: p.status,
        url: `/projects/${p.id}/kanban`,
      })),
      ...tasks.map<SearchResult>((t) => ({
        type: 'task',
        id: t.id,
        title: t.title,
        subtitle: t.project.name,
        url: `/projects/${t.projectId}/tasks/${t.id}`,
      })),
      ...documents.map<SearchResult>((d) => ({
        type: 'document',
        id: d.id,
        title: d.name,
        subtitle: d.project.name,
        url: `/projects/${d.projectId}/documents`,
      })),
      ...users.map<SearchResult>((u) => ({
        type: 'user',
        id: u.id,
        title: `${u.firstName} ${u.lastName}`,
        subtitle: u.jobTitle ?? u.email,
        url: `/settings/users`,
      })),
    ];

    return {
      query,
      results,
      total: results.length,
      countsByType: {
        project: projects.length,
        task: tasks.length,
        document: documents.length,
        user: users.length,
      },
    };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

/**
 * Extraction à plat des données d'un projet, prête à l'export.
 *
 * Le fichier lui-même (Excel ou PDF) est produit côté navigateur par
 * `lib/utils/export.ts` — l'utilitaire générique écrit pour le journal
 * d'audit. Le serveur ne renvoie donc que des lignes déjà aplaties, sans
 * dépendance de génération de document.
 */
@Injectable()
export class ProjectExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async exportProject(projectId: string, userId: string) {
    // Consultation : tout membre, y compris VIEWER.
    await this.projectAccess.requireMember(projectId, userId);

    const project = await this.prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        name: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        endDate: true,
        owner: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        startDate: true,
        endDate: true,
        deadline: true,
        storyPoints: true,
        baselineEnd: true,
        sprint: { select: { name: true } },
        assignments: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
        checklist: { select: { done: true } },
        timeEntries: { select: { duration: true } },
      },
    });

    const members = await this.prisma.projectMember.findMany({
      where: { projectId },
      select: {
        role: true,
        joinedAt: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    const day = 24 * 60 * 60 * 1000;

    return {
      project: {
        ...project,
        ownerName: project.owner
          ? `${project.owner.firstName} ${project.owner.lastName}`
          : null,
      },
      // Une ligne par tâche, tous champs résolus en valeurs simples : le
      // front n'a plus qu'à choisir les colonnes.
      tasks: tasks.map((t) => {
        const checklistDone = t.checklist.filter((c) => c.done).length;
        const minutes = t.timeEntries.reduce(
          (sum, e) => sum + (e.duration ?? 0),
          0,
        );

        return {
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          sprint: t.sprint?.name ?? null,
          startDate: t.startDate?.toISOString() ?? null,
          endDate: t.endDate?.toISOString() ?? null,
          deadline: t.deadline?.toISOString() ?? null,
          storyPoints: t.storyPoints,
          assignees: t.assignments
            .map((a) => `${a.user.firstName} ${a.user.lastName}`)
            .join(', '),
          checklistProgress: t.checklist.length
            ? `${checklistDone}/${t.checklist.length}`
            : null,
          timeSpentHours: minutes > 0 ? Math.round(minutes / 6) / 10 : 0,
          // Dérive : positif = fin repoussée par rapport à la référence.
          driftDays:
            t.baselineEnd && t.endDate
              ? Math.round(
                  (t.endDate.getTime() - t.baselineEnd.getTime()) / day,
                )
              : null,
        };
      }),
      members: members.map((m) => ({
        name: `${m.user.firstName} ${m.user.lastName}`,
        email: m.user.email,
        role: m.role,
        joinedAt: m.joinedAt.toISOString(),
      })),
      exportedAt: new Date().toISOString(),
    };
  }
}

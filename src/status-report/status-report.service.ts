import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { PhaseService } from 'src/planning/phase.service';
import { MilestoneService } from 'src/planning/milestone.service';
import { WorkloadService } from 'src/planning/workload.service';
import { ProjectIssueService } from 'src/project-issue/project-issue.service';

/**
 * Rapport d'état d'un projet — la synthèse imprimable qui réunit ce que les
 * autres vues du pilotage montrent séparément : avancement, feuille de
 * route, charge et difficultés en cours.
 *
 * N'implémente aucun calcul en propre : chaque section délègue au service
 * qui en est déjà responsable, pour ne jamais faire dériver deux endroits
 * qui devraient dire la même chose sur, par exemple, l'avancement d'une
 * phase.
 */
@Injectable()
export class StatusReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
    private readonly phaseService: PhaseService,
    private readonly milestoneService: MilestoneService,
    private readonly workloadService: WorkloadService,
    private readonly issueService: ProjectIssueService,
  ) {}

  /**
   * @param issuesTaskId Restreint la seule section « difficultés » du
   * rapport à une tâche précise — le reste (avancement, phases, charge)
   * reste toujours à l'échelle du projet, ces indicateurs n'ayant pas de
   * sens ramenés à une seule tâche.
   */
  async getReport(projectId: string, userId: string, issuesTaskId?: string) {
    await this.projectAccess.requireMember(projectId, userId);

    const project = await this.prisma.project.findUnique({
      where: { id: projectId, deletedAt: null },
      select: {
        id: true,
        name: true,
        description: true,
        status: true,
        priority: true,
        startDate: true,
        endDate: true,
        owner: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Projet introuvable');

    const [taskCount, doneTaskCount] = await Promise.all([
      this.prisma.task.count({ where: { projectId } }),
      this.prisma.task.count({ where: { projectId, status: 'DONE' } }),
    ]);

    // Charge des 30 derniers jours : la même fenêtre par défaut que le
    // diagramme de charge autonome, pour qu'un même mot — « la charge » —
    // désigne toujours la même période dans toute l'application.
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    const [phases, milestones, workload, issues] = await Promise.all([
      this.phaseService.list(projectId, userId),
      this.milestoneService.list(projectId, userId),
      this.workloadService.getWorkload(
        userId,
        start.toISOString(),
        end.toISOString(),
        projectId,
        'week',
      ),
      this.issueService.list(projectId, userId, {
        taskId: issuesTaskId,
      }),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      project: {
        ...project,
        taskCount,
        doneTaskCount,
        progressPercent:
          taskCount > 0 ? Math.round((doneTaskCount / taskCount) * 100) : 0,
      },
      phases,
      milestones,
      workload,
      issues,
    };
  }
}

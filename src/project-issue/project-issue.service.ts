import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { IssueStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';
import { CreateIssueDto } from './dto/create-issue.dto';
import { UpdateIssueDto } from './dto/update-issue.dto';
import { QueryIssuesDto } from './dto/query-issues.dto';

const ISSUE_INCLUDE = {
  reportedBy: {
    select: { id: true, firstName: true, lastName: true, avatar: true },
  },
  task: { select: { id: true, title: true } },
} as const;

/**
 * Journal des difficultés d'un projet.
 *
 * Distinct du journal d'audit : l'audit trace ce que le système a fait,
 * celui-ci trace ce qu'un humain juge problématique. Signalé par quiconque
 * contribue au projet — c'est la personne qui bute sur un blocage qui le
 * connaît en premier — mais visible en lecture par tout membre : la
 * transparence sur les difficultés ne se réserve pas aux gestionnaires.
 */
@Injectable()
export class ProjectIssueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private async verifyTaskBelongsToProject(
    taskId: string,
    projectId: string,
  ): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { projectId: true },
    });
    if (!task) throw new NotFoundException('Tâche introuvable');
    if (task.projectId !== projectId) {
      throw new ConflictException('La tâche doit appartenir au même projet');
    }
  }

  async list(projectId: string, userId: string, filters: QueryIssuesDto) {
    await this.projectAccess.requireMember(projectId, userId);

    return this.prisma.projectIssue.findMany({
      where: {
        projectId,
        ...(filters.taskId ? { taskId: filters.taskId } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.status ? { status: filters.status } : {}),
      },
      // Les difficultés ouvertes en tête : ce sont celles qui appellent une
      // action, l'historique résolu passe après.
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: ISSUE_INCLUDE,
    });
  }

  async create(projectId: string, userId: string, dto: CreateIssueDto) {
    // Contributeur minimum : c'est l'exécutant du travail qui rencontre le
    // problème en premier, pas seulement le gestionnaire.
    await this.projectAccess.requireContributor(projectId, userId);

    if (dto.taskId) {
      await this.verifyTaskBelongsToProject(dto.taskId, projectId);
    }

    return this.prisma.projectIssue.create({
      data: {
        projectId,
        taskId: dto.taskId,
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        reportedById: userId,
      },
      include: ISSUE_INCLUDE,
    });
  }

  /**
   * Suivi de la résolution — réservé aux gestionnaires. Signaler une
   * difficulté reste ouvert à tous ; en assurer le suivi engage l'équipe,
   * pas seulement son auteur.
   */
  async update(
    projectId: string,
    issueId: string,
    userId: string,
    dto: UpdateIssueDto,
  ) {
    await this.projectAccess.requireManager(projectId, userId);

    const issue = await this.prisma.projectIssue.findFirst({
      where: { id: issueId, projectId },
      select: { status: true },
    });
    if (!issue) throw new NotFoundException('Difficulté introuvable');

    return this.prisma.projectIssue.update({
      where: { id: issueId },
      data: {
        status: dto.status,
        correctiveAction: dto.correctiveAction,
        // Figée au passage en résolu, sur le même principe que
        // Task.completedAt : ne bouge plus après coup, sinon le délai de
        // résolution mesuré deviendrait faux à la moindre modification
        // ultérieure.
        resolvedAt:
          dto.status === IssueStatus.RESOLVED &&
          issue.status !== IssueStatus.RESOLVED
            ? new Date()
            : dto.status !== undefined &&
                dto.status !== IssueStatus.RESOLVED &&
                issue.status === IssueStatus.RESOLVED
              ? null
              : undefined,
      },
      include: ISSUE_INCLUDE,
    });
  }

  async remove(projectId: string, issueId: string, userId: string) {
    const issue = await this.prisma.projectIssue.findFirst({
      where: { id: issueId, projectId },
      select: { reportedById: true },
    });
    if (!issue) throw new NotFoundException('Difficulté introuvable');

    // L'auteur peut retirer son propre signalement (une fausse manœuvre ne
    // doit pas exiger un gestionnaire) ; au-delà, seul un gestionnaire
    // supprime le signalement de quelqu'un d'autre.
    if (issue.reportedById !== userId) {
      await this.projectAccess.requireManager(projectId, userId);
    }

    await this.prisma.projectIssue.delete({ where: { id: issueId } });
    return { message: 'Difficulté supprimée' };
  }
}

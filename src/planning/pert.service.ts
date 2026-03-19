import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';

/** Type pour les tâches PERT (optimisticDays/probableDays/pessimisticDays en BDD, pas toujours dans le type Prisma généré). */
type PertTaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  optimisticDays: number | null;
  probableDays: number | null;
  pessimisticDays: number | null;
  blockedBy: { blockingTaskId: string }[];
};

/**
 * PERT : graphe logique (ordre des tâches), temps attendu te = (o + 4m + p) / 6, et chemin critique.
 */
@Injectable()
export class PertService {
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
   * Temps attendu (jours) : te = (optimiste + 4*probable + pessimiste) / 6
   */
  private expectedDays(
    o: number | null,
    m: number | null,
    p: number | null,
  ): number | null {
    if (o == null || m == null || p == null) return null;
    return Math.round((o + 4 * m + p) / 6);
  }

  /**
   * Retourne : nœuds (tâches avec te), arêtes (dépendances), liste des IDs du chemin critique.
   * Chemin critique = plus long chemin (somme des te) de la source à la fin.
   */
  async getPertData(projectId: string, userId: string) {
    await this.ensureProjectAccess(projectId, userId);

    const tasks = (await this.prisma.task.findMany({
      where: { projectId, parentId: null },
      include: {
        blockedBy: { select: { blockingTaskId: true } },
      },
    })) as unknown as PertTaskRow[];

    const taskMap = new Map(
      tasks.map((t) => [
        t.id,
        {
          id: t.id,
          title: t.title,
          status: t.status,
          optimisticDays: t.optimisticDays,
          probableDays: t.probableDays,
          pessimisticDays: t.pessimisticDays,
          expectedDays: this.expectedDays(
            t.optimisticDays,
            t.probableDays,
            t.pessimisticDays,
          ),
          blockingIds: t.blockedBy.map((d) => d.blockingTaskId),
        },
      ]),
    );

    const edges: { from: string; to: string }[] = [];
    for (const t of tasks) {
      for (const d of t.blockedBy) {
        edges.push({ from: d.blockingTaskId, to: t.id });
      }
    }

    // Chemin critique : plus long chemin (en jours) dans le DAG
    const criticalPath = this.computeCriticalPath(tasks, taskMap);

    return {
      nodes: Array.from(taskMap.values()),
      edges,
      criticalPath,
    };
  }

  /**
   * Chemin critique = plus long chemin (somme des te) dans le DAG.
   * L[i] = longueur max jusqu'à la fin de la tâche i = max(L[j] pour j prédécesseur) + te(i).
   */
  private computeCriticalPath(
    tasks: { id: string }[],
    taskMap: Map<
      string,
      {
        id: string;
        expectedDays: number | null;
        blockingIds: string[];
      }
    >,
  ): string[] {
    const idToIndex = new Map(tasks.map((t, i) => [t.id, i]));
    const n = tasks.length;
    const L = new Array<number>(n).fill(0);
    const prev = new Array<number>(n).fill(-1);

    for (let pass = 0; pass < n; pass++) {
      for (const t of tasks) {
        const i = idToIndex.get(t.id)!;
        const node = taskMap.get(t.id)!;
        const days = node.expectedDays ?? 0;
        let maxPred = 0;
        let bestJ = -1;
        for (const blockId of node.blockingIds) {
          const j = idToIndex.get(blockId);
          if (j === undefined) continue;
          const predVal = L[j] ?? 0;
          if (predVal > maxPred) {
            maxPred = predVal;
            bestJ = j;
          }
        }
        L[i] = maxPred + days;
        prev[i] = bestJ;
      }
    }

    let maxLen = 0;
    let endIdx = 0;
    for (let i = 0; i < n; i++) {
      if ((L[i] ?? 0) > maxLen) {
        maxLen = L[i]!;
        endIdx = i;
      }
    }

    const path: string[] = [];
    let idx = endIdx;
    while (idx >= 0) {
      path.unshift(tasks[idx].id);
      idx = prev[idx];
    }
    return path;
  }
}

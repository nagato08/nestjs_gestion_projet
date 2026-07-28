import { Injectable } from '@nestjs/common';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { ProjectAccessService } from 'src/common/access/project-access.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  private async ensureProjectAccess(
    projectId: string,
    userId: string,
  ): Promise<void> {
    // Lecture seule : tout membre du projet, y compris VIEWER.
    await this.projectAccess.requireMember(projectId, userId);
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

    if (tasks.length === 0) {
      return {
        nodes: [],
        edges: [],
        criticalPath: [],
        milestones: [],
        projectDurationDays: 0,
      };
    }

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

    // Marges par tâche (passes avant/arrière). Une marge nulle signifie
    // qu'aucun retard n'est absorbable sans décaler la fin du projet.
    const floats = this.computeFloats(taskMap);

    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { date: 'asc' },
      select: { id: true, name: true, date: true, reached: true },
    });

    const nodes = Array.from(taskMap.values()).map((node) => {
      const f = floats.get(node.id);
      return {
        ...node,
        earliestStart: f?.earliestStart ?? null,
        earliestFinish: f?.earliestFinish ?? null,
        latestStart: f?.latestStart ?? null,
        latestFinish: f?.latestFinish ?? null,
        slackDays: f?.slack ?? null,
        // Le chemin critique se déduit des marges plutôt que d'un unique
        // parcours remonté : un projet peut avoir plusieurs chemins critiques
        // parallèles, que le backtracking seul manquerait.
        isCritical: f ? f.slack === 0 : false,
      };
    });

    return {
      nodes,
      milestones: milestones.map((m) => ({
        ...m,
        date: m.date.toISOString(),
        overdue: !m.reached && m.date.getTime() < Date.now(),
      })),
      projectDurationDays: Math.max(
        0,
        ...[...floats.values()].map((f) => f.earliestFinish),
      ),
      edges,
      criticalPath,
    };
  }

  /**
   * Marges par tâche, via les deux passes classiques de la méthode CPM.
   *
   * Passe avant : au plus tôt, une tâche démarre quand tous ses prédécesseurs
   * sont finis. Passe arrière : au plus tard, elle doit finir avant que ses
   * successeurs ne doivent démarrer, sans repousser la fin du projet.
   *
   * La marge est l'écart entre les deux. Marge nulle = tout retard sur cette
   * tâche décale la fin du projet : c'est la définition du chemin critique.
   */
  private computeFloats(
    taskMap: Map<
      string,
      { id: string; expectedDays: number | null; blockingIds: string[] }
    >,
  ): Map<
    string,
    {
      earliestStart: number;
      earliestFinish: number;
      latestStart: number;
      latestFinish: number;
      slack: number;
    }
  > {
    const nodes = [...taskMap.values()];
    const duration = (id: string) => taskMap.get(id)?.expectedDays ?? 0;

    // Successeurs, pour la passe arrière.
    const successors = new Map<string, string[]>();
    for (const node of nodes) {
      for (const blockingId of node.blockingIds) {
        const list = successors.get(blockingId) ?? [];
        list.push(node.id);
        successors.set(blockingId, list);
      }
    }

    // --- Passe avant : au plus tôt ---
    const earliestStart = new Map<string, number>(nodes.map((n) => [n.id, 0]));
    // Relaxation itérative plutôt qu'un tri topologique : elle converge de la
    // même façon et reste bornée même si les données contiennent un cycle.
    for (let pass = 0; pass < nodes.length; pass++) {
      let stable = true;
      for (const node of nodes) {
        const candidate = node.blockingIds.reduce((max, blockingId) => {
          if (!taskMap.has(blockingId)) return max;
          const finish =
            (earliestStart.get(blockingId) ?? 0) + duration(blockingId);
          return Math.max(max, finish);
        }, 0);

        if (candidate > (earliestStart.get(node.id) ?? 0)) {
          earliestStart.set(node.id, candidate);
          stable = false;
        }
      }
      if (stable) break;
    }

    const projectEnd = nodes.reduce(
      (max, n) =>
        Math.max(max, (earliestStart.get(n.id) ?? 0) + duration(n.id)),
      0,
    );

    // --- Passe arrière : au plus tard ---
    const latestFinish = new Map<string, number>(
      nodes.map((n) => [n.id, projectEnd]),
    );
    for (let pass = 0; pass < nodes.length; pass++) {
      let stable = true;
      for (const node of nodes) {
        const nexts = successors.get(node.id) ?? [];
        if (nexts.length === 0) continue;

        const candidate = nexts.reduce((min, nextId) => {
          const nextLatestStart =
            (latestFinish.get(nextId) ?? projectEnd) - duration(nextId);
          return Math.min(min, nextLatestStart);
        }, Number.POSITIVE_INFINITY);

        if (candidate < (latestFinish.get(node.id) ?? projectEnd)) {
          latestFinish.set(node.id, candidate);
          stable = false;
        }
      }
      if (stable) break;
    }

    const result = new Map<
      string,
      {
        earliestStart: number;
        earliestFinish: number;
        latestStart: number;
        latestFinish: number;
        slack: number;
      }
    >();

    for (const node of nodes) {
      const es = earliestStart.get(node.id) ?? 0;
      const lf = latestFinish.get(node.id) ?? projectEnd;
      const d = duration(node.id);

      result.set(node.id, {
        earliestStart: es,
        earliestFinish: es + d,
        latestStart: lf - d,
        latestFinish: lf,
        slack: Math.max(0, lf - d - es),
      });
    }

    return result;
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

    if (n === 0) return [];

    let maxLen = -1;
    let endIdx = -1;
    for (let i = 0; i < n; i++) {
      if ((L[i] ?? 0) > maxLen) {
        maxLen = L[i]!;
        endIdx = i;
      }
    }

    if (endIdx < 0) return [];

    const path: string[] = [];
    let idx = endIdx;
    while (idx >= 0 && idx < n) {
      const t = tasks[idx];
      if (!t) break;
      path.unshift(t.id);
      idx = prev[idx] ?? -1;
    }
    return path;
  }
}

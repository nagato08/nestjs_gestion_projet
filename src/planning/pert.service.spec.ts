import { PertService } from './pert.service';

/**
 * Calcul des marges (méthode du chemin critique).
 *
 * Le graphe de référence est assez petit pour que les marges se vérifient à
 * la main, ce qui est le seul moyen d'attester que l'implémentation calcule
 * la bonne chose et pas seulement quelque chose de stable.
 *
 *      A(3) ─┐
 *            ├─> C(2) ──> D(4)
 *      B(2) ─┘
 *
 * Chemin le plus long : A → C → D = 9 jours, c'est la durée du projet.
 * Par B : 2 + 2 + 4 = 8 jours. B dispose donc d'exactement 1 jour de marge ;
 * A, C et D sont sur le chemin critique et n'en ont aucune.
 */

type PertNode = {
  id: string;
  expectedDays: number | null;
  blockingIds: string[];
};

function graph(...nodes: PertNode[]): Map<string, PertNode> {
  return new Map(nodes.map((n) => [n.id, n]));
}

/**
 * `computeFloats` est privé : le tester directement reste préférable à
 * monter tout le service avec Prisma pour atteindre une fonction purement
 * arithmétique.
 */
function computeFloats(tasks: Map<string, PertNode>) {
  const service = Object.create(PertService.prototype) as PertService;
  return (
    service as unknown as {
      computeFloats: (t: Map<string, PertNode>) => Map<
        string,
        {
          earliestStart: number;
          earliestFinish: number;
          latestStart: number;
          latestFinish: number;
          slack: number;
        }
      >;
    }
  ).computeFloats(tasks);
}

describe('Marges et chemin critique', () => {
  it('n’accorde aucune marge aux tâches du chemin critique', () => {
    const floats = computeFloats(
      graph(
        { id: 'A', expectedDays: 3, blockingIds: [] },
        { id: 'B', expectedDays: 2, blockingIds: [] },
        { id: 'C', expectedDays: 2, blockingIds: ['A', 'B'] },
        { id: 'D', expectedDays: 4, blockingIds: ['C'] },
      ),
    );

    expect(floats.get('A')!.slack).toBe(0);
    expect(floats.get('C')!.slack).toBe(0);
    expect(floats.get('D')!.slack).toBe(0);
  });

  it('accorde à une tâche parallèle plus courte la marge exacte qui lui revient', () => {
    const floats = computeFloats(
      graph(
        { id: 'A', expectedDays: 3, blockingIds: [] },
        { id: 'B', expectedDays: 2, blockingIds: [] },
        { id: 'C', expectedDays: 2, blockingIds: ['A', 'B'] },
        { id: 'D', expectedDays: 4, blockingIds: ['C'] },
      ),
    );

    // B dure 1 jour de moins que A et alimente le même successeur.
    expect(floats.get('B')!.slack).toBe(1);
  });

  it('positionne chaque tâche au plus tôt après ses bloqueurs', () => {
    const floats = computeFloats(
      graph(
        { id: 'A', expectedDays: 3, blockingIds: [] },
        { id: 'B', expectedDays: 2, blockingIds: [] },
        { id: 'C', expectedDays: 2, blockingIds: ['A', 'B'] },
        { id: 'D', expectedDays: 4, blockingIds: ['C'] },
      ),
    );

    expect(floats.get('A')!.earliestStart).toBe(0);
    // C attend le plus tardif de ses deux bloqueurs, soit la fin de A.
    expect(floats.get('C')!.earliestStart).toBe(3);
    expect(floats.get('D')!.earliestStart).toBe(5);
    expect(floats.get('D')!.earliestFinish).toBe(9);
  });

  it('reconnaît deux chemins critiques de même longueur', () => {
    // Un « plus long chemin » unique n'en aurait retenu qu'un seul ; la marge
    // nulle, elle, distingue correctement les deux.
    const floats = computeFloats(
      graph(
        { id: 'A', expectedDays: 5, blockingIds: [] },
        { id: 'B', expectedDays: 5, blockingIds: [] },
        { id: 'FIN', expectedDays: 1, blockingIds: ['A', 'B'] },
      ),
    );

    expect(floats.get('A')!.slack).toBe(0);
    expect(floats.get('B')!.slack).toBe(0);
  });

  it('traite une tâche sans estimation comme instantanée', () => {
    const floats = computeFloats(
      graph(
        { id: 'A', expectedDays: null, blockingIds: [] },
        { id: 'B', expectedDays: 4, blockingIds: ['A'] },
      ),
    );

    expect(floats.get('B')!.earliestStart).toBe(0);
  });

  it('termine malgré une dépendance circulaire', () => {
    // Les cycles ne devraient pas exister, mais un calcul qui boucle
    // indéfiniment bloquerait la requête : la borne d'itération doit tenir.
    const floats = computeFloats(
      graph(
        { id: 'A', expectedDays: 2, blockingIds: ['B'] },
        { id: 'B', expectedDays: 2, blockingIds: ['A'] },
      ),
    );

    expect(floats.size).toBe(2);
  });

  it('ignore un bloqueur absent du périmètre', () => {
    // Une dépendance vers une tâche d'un autre projet ne doit pas décaler le
    // planning ni faire échouer le calcul.
    const floats = computeFloats(
      graph({ id: 'A', expectedDays: 3, blockingIds: ['inconnue'] }),
    );

    expect(floats.get('A')!.earliestStart).toBe(0);
    expect(floats.get('A')!.slack).toBe(0);
  });
});

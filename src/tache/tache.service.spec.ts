import { TaskStatus } from '@prisma/client';
import { TacheService } from './tache.service';

/**
 * Date de complétion d'une tâche.
 *
 * Cette date doit être figée au passage en DONE. Le burndown s'appuyait
 * auparavant sur `updatedAt`, si bien que toute modification ultérieure d'une
 * tâche terminée déplaçait sa complétion et réécrivait l'historique de la
 * courbe. La garde ci-dessous est ce qui empêche ce défaut de revenir : sans
 * elle, resauvegarder une tâche déjà terminée repousserait sa date.
 */

function completionPatch(
  previous: TaskStatus,
  next: TaskStatus | undefined,
): { completedAt?: Date | null } {
  const service = Object.create(TacheService.prototype) as TacheService;
  return (
    service as unknown as {
      completionPatch: (
        p: TaskStatus,
        n: TaskStatus | undefined,
      ) => { completedAt?: Date | null };
    }
  ).completionPatch(previous, next);
}

describe('Date de complétion d’une tâche', () => {
  it('est posée au passage en terminé', () => {
    const patch = completionPatch(TaskStatus.DOING, TaskStatus.DONE);

    expect(patch.completedAt).toBeInstanceOf(Date);
  });

  it('n’est pas repoussée quand une tâche déjà terminée est resauvegardée', () => {
    const patch = completionPatch(TaskStatus.DONE, TaskStatus.DONE);

    // Champ absent : la mise à jour ne touchera pas à la colonne.
    expect(patch).not.toHaveProperty('completedAt');
  });

  it('est effacée quand la tâche ressort de terminé', () => {
    const patch = completionPatch(TaskStatus.DONE, TaskStatus.DOING);

    expect(patch.completedAt).toBeNull();
  });

  it('reste intacte lors d’un changement sans rapport avec le terminé', () => {
    const patch = completionPatch(TaskStatus.TODO, TaskStatus.DOING);

    expect(patch).not.toHaveProperty('completedAt');
  });

  it('reste intacte quand la mise à jour ne porte pas sur le statut', () => {
    const patch = completionPatch(TaskStatus.DONE, undefined);

    expect(patch).not.toHaveProperty('completedAt');
  });
});

/**
 * Catalogue des actions auditables.
 *
 * Source de vérité unique : le serveur s'en sert pour filtrer par catégorie ou
 * par gravité, et l'expose à l'interface pour l'affichage. Sans ce catalogue
 * partagé, la liste des libellés diverge inévitablement entre back et front.
 *
 * Ajouter une action ici la rend immédiatement filtrable et lisible partout.
 */

export type AuditSeverity = 'critical' | 'warning' | 'info';

export type AuditCategory =
  | 'Projet'
  | 'Membres'
  | 'Tâches'
  | 'Documents'
  | 'Comptes'
  | 'Planning';

export interface AuditActionDescriptor {
  action: string;
  label: string;
  description: string;
  severity: AuditSeverity;
  category: AuditCategory;
}

export const AUDIT_ACTION_CATALOG: AuditActionDescriptor[] = [
  // --- Projet ---
  {
    action: 'project.delete',
    label: 'Suppression de projet',
    description:
      'Le projet a été supprimé. La suppression est logique : les données restent en base mais le projet disparaît de l’application.',
    severity: 'critical',
    category: 'Projet',
  },
  {
    action: 'project.restore',
    label: 'Restauration de projet',
    description:
      'Un projet précédemment supprimé a été restauré depuis la corbeille, avant l’expiration de sa fenêtre de rétention.',
    severity: 'warning',
    category: 'Projet',
  },
  {
    action: 'project.purge',
    label: 'Purge définitive de projet',
    description:
      'Un projet de la corbeille a été supprimé définitivement, par anticipation ou par expiration de la fenêtre de rétention. Irréversible.',
    severity: 'critical',
    category: 'Projet',
  },
  {
    action: 'project.update',
    label: 'Modification de projet',
    description:
      'Les informations du projet ont été modifiées (nom, dates, priorité ou statut).',
    severity: 'info',
    category: 'Projet',
  },
  {
    action: 'project.transfer_ownership',
    label: 'Transfert de propriété',
    description:
      'La propriété du projet a changé de main. L’ancien propriétaire a été rétrogradé administrateur.',
    severity: 'critical',
    category: 'Projet',
  },
  {
    action: 'project.settings.update',
    label: 'Modification des paramètres de pilotage',
    description:
      'Le calendrier ouvré, les seuils d’alerte ou la configuration générale du projet ont été modifiés.',
    severity: 'warning',
    category: 'Projet',
  },

  // --- Membres ---
  {
    action: 'project.member.add',
    label: 'Ajout d’un membre',
    description: 'Un utilisateur a été ajouté au projet avec un rôle donné.',
    severity: 'info',
    category: 'Membres',
  },
  {
    action: 'project.member.remove',
    label: 'Retrait d’un membre',
    description: 'Un utilisateur a été retiré du projet et perd tout accès.',
    severity: 'warning',
    category: 'Membres',
  },
  {
    action: 'project.invite.send',
    label: 'Invitation envoyée',
    description:
      'Le lien d’invitation du projet a été envoyé par email à une adresse.',
    severity: 'info',
    category: 'Membres',
  },
  {
    action: 'project.invite.revoke',
    label: 'Invitation révoquée',
    description:
      'Une invitation en attente a été annulée : le lien envoyé ne fonctionne plus.',
    severity: 'warning',
    category: 'Membres',
  },
  {
    action: 'project.invite.accept',
    label: 'Invitation acceptée',
    description:
      'Un invité a rejoint le projet via son lien nominatif, avec le rôle prévu à l’invitation.',
    severity: 'info',
    category: 'Membres',
  },
  {
    action: 'project.member.join',
    label: 'Adhésion au projet',
    description:
      'Un utilisateur a rejoint le projet lui-même, via un code ou un lien d’invitation.',
    severity: 'info',
    category: 'Membres',
  },
  {
    action: 'project.member.role.update',
    label: 'Changement de rôle',
    description:
      'Le rôle d’un membre dans le projet a été modifié, ce qui change ses permissions.',
    severity: 'warning',
    category: 'Membres',
  },

  // --- Tâches ---
  {
    action: 'task.create',
    label: 'Création de tâche',
    description: 'Une tâche a été ajoutée au projet.',
    severity: 'info',
    category: 'Tâches',
  },
  {
    action: 'task.update',
    label: 'Modification de tâche',
    description:
      'Le contenu d’une tâche a été modifié (titre, description, dates, estimations).',
    severity: 'info',
    category: 'Tâches',
  },
  {
    action: 'task.status.update',
    label: 'Changement de statut',
    description:
      'Une tâche a changé d’étape sur le tableau (à faire, en cours, terminé).',
    severity: 'info',
    category: 'Tâches',
  },
  {
    action: 'task.delete',
    label: 'Suppression de tâche',
    description: 'Une tâche a été supprimée du projet.',
    severity: 'warning',
    category: 'Tâches',
  },
  {
    action: 'task.assign',
    label: 'Assignation de tâche',
    description:
      'Un ou plusieurs utilisateurs ont été assignés à une tâche, ce qui leur en donne la charge et le droit de la modifier.',
    severity: 'info',
    category: 'Tâches',
  },
  {
    action: 'task.unassign',
    label: 'Désassignation de tâche',
    description:
      'Un utilisateur a été retiré des assignés : il perd le droit de modifier cette tâche.',
    severity: 'warning',
    category: 'Tâches',
  },
  {
    action: 'task.dependency.create',
    label: 'Ajout de dépendance',
    description:
      'Un lien de blocage a été créé entre deux tâches : la tâche bloquée ne peut plus démarrer avant l’autre.',
    severity: 'info',
    category: 'Tâches',
  },
  {
    action: 'task.dependency.delete',
    label: 'Suppression de dépendance',
    description:
      'Un lien de blocage entre deux tâches a été retiré, ce qui débloque le planning.',
    severity: 'warning',
    category: 'Tâches',
  },

  // --- Documents ---
  {
    action: 'document.create',
    label: 'Création de document',
    description: 'Un document a été créé dans le projet.',
    severity: 'info',
    category: 'Documents',
  },
  {
    action: 'document.version.upload',
    label: 'Dépôt de version',
    description:
      'Un fichier a été déposé comme nouvelle version d’un document existant.',
    severity: 'info',
    category: 'Documents',
  },
  {
    action: 'document.update',
    label: 'Modification de document',
    description: 'Les métadonnées d’un document ont été modifiées.',
    severity: 'info',
    category: 'Documents',
  },
  {
    action: 'document.delete',
    label: 'Suppression de document',
    description:
      'Un document et son historique de versions ont été supprimés du projet.',
    severity: 'warning',
    category: 'Documents',
  },

  // --- Planning ---
  {
    action: 'task.reschedule',
    label: 'Replanification',
    description:
      'Une tâche a été déplacée dans le Gantt. Les tâches qui en dépendent ont pu être repoussées automatiquement.',
    severity: 'warning',
    category: 'Planning',
  },
  {
    action: 'project.baseline.set',
    label: 'Référence de planning figée',
    description:
      'Les dates courantes ont été enregistrées comme référence. La dérive se mesure désormais par rapport à cette photographie.',
    severity: 'warning',
    category: 'Planning',
  },
  {
    action: 'sprint.create',
    label: 'Création de sprint',
    description: 'Une itération a été ajoutée au projet.',
    severity: 'info',
    category: 'Planning',
  },
  {
    action: 'sprint.update',
    label: 'Modification de sprint',
    description:
      'Les dates, l’objectif ou le statut d’un sprint ont été modifiés.',
    severity: 'info',
    category: 'Planning',
  },
  {
    action: 'sprint.delete',
    label: 'Suppression de sprint',
    description:
      'Un sprint a été supprimé. Ses tâches sont retournées au backlog, elles ne sont pas perdues.',
    severity: 'warning',
    category: 'Planning',
  },
  {
    action: 'sprint.tasks.assign',
    label: 'Affectation au sprint',
    description:
      'Des tâches ont été rattachées à un sprint ou renvoyées au backlog.',
    severity: 'info',
    category: 'Planning',
  },
  {
    action: 'milestone.create',
    label: 'Création de jalon',
    description: 'Un point de repère daté a été ajouté au projet.',
    severity: 'info',
    category: 'Planning',
  },
  {
    action: 'milestone.update',
    label: 'Modification de jalon',
    description:
      'La date, le libellé ou l’état d’atteinte d’un jalon a été modifié.',
    severity: 'info',
    category: 'Planning',
  },
  {
    action: 'milestone.delete',
    label: 'Suppression de jalon',
    description: 'Un jalon a été retiré du projet.',
    severity: 'warning',
    category: 'Planning',
  },
  {
    action: 'phase.create',
    label: 'Création de phase',
    description:
      'Une phase macro (conception, recette, déploiement…) a été ajoutée à la feuille de route.',
    severity: 'info',
    category: 'Planning',
  },
  {
    action: 'phase.update',
    label: 'Modification de phase',
    description: 'Le nom, les dates ou l’ordre d’une phase ont été modifiés.',
    severity: 'info',
    category: 'Planning',
  },
  {
    action: 'phase.delete',
    label: 'Suppression de phase',
    description: 'Une phase a été retirée de la feuille de route.',
    severity: 'warning',
    category: 'Planning',
  },

  // --- Comptes ---
  {
    action: 'user.create_by_admin',
    label: 'Création de compte',
    description:
      'Un administrateur a créé un compte. Le mot de passe a été généré et envoyé par email.',
    severity: 'info',
    category: 'Comptes',
  },
  {
    action: 'user.delete',
    label: 'Suppression de compte',
    description:
      'Un compte utilisateur a été supprimé. Ses actions passées restent tracées dans ce journal.',
    severity: 'critical',
    category: 'Comptes',
  },
  {
    action: 'user.self_delete',
    label: 'Suppression de compte (demande RGPD)',
    description:
      'Un utilisateur a demandé la suppression de son propre compte au titre du droit à l’effacement.',
    severity: 'critical',
    category: 'Comptes',
  },
  {
    action: 'user.data_export',
    label: 'Export de données personnelles (RGPD)',
    description: 'Un utilisateur a exporté ses propres données personnelles.',
    severity: 'info',
    category: 'Comptes',
  },
];

/** Index par code d'action, pour un accès direct. */
export const AUDIT_ACTION_BY_CODE = new Map(
  AUDIT_ACTION_CATALOG.map((entry) => [entry.action, entry]),
);

/** Codes d'action appartenant aux catégories demandées. */
export function actionsForCategories(categories: string[]): string[] {
  return AUDIT_ACTION_CATALOG.filter((entry) =>
    categories.includes(entry.category),
  ).map((entry) => entry.action);
}

/** Codes d'action correspondant aux niveaux de gravité demandés. */
export function actionsForSeverities(severities: string[]): string[] {
  return AUDIT_ACTION_CATALOG.filter((entry) =>
    severities.includes(entry.severity),
  ).map((entry) => entry.action);
}

export const AUDIT_CATEGORIES: AuditCategory[] = [
  'Projet',
  'Membres',
  'Tâches',
  'Documents',
  'Comptes',
];

export const AUDIT_SEVERITIES: AuditSeverity[] = [
  'critical',
  'warning',
  'info',
];

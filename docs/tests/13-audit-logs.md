# Journal d’audit – Tests

Traçabilité des actions sensibles : qui a fait quoi, quand, sur quel objet.

---

## Prérequis

- **JWT** pour toutes les routes.
- **ADMIN global** obligatoire : toutes les routes renvoient 403 sinon.
- La migration `20260727120000_add_audit_log` doit être appliquée.

Le journal se remplit **à partir des actions réalisées après déploiement** : il
est normal qu’il soit vide au départ.

---

## Actions tracées (20)

| Catégorie | Action | Gravité | Contexte enregistré |
| --------- | ------ | ------- | ------------------- |
| Projet | `project.update` | Courant | statut, champs modifiés |
| Projet | `project.delete` | Critique | — |
| Projet | `project.transfer_ownership` | Critique | nouveau propriétaire |
| Membres | `project.member.add` | Courant | membre, rôle |
| Membres | `project.member.remove` | Sensible | membre |
| Membres | `project.member.role.update` | Sensible | membre, nouveau rôle |
| Tâches | `task.create` | Courant | titre, projet, priorité |
| Tâches | `task.update` | Courant | champs modifiés |
| Tâches | `task.status.update` | Courant | nouveau statut |
| Tâches | `task.delete` | Sensible | — |
| Tâches | `task.assign` | Courant | utilisateurs assignés |
| Tâches | `task.unassign` | Sensible | membre retiré |
| Tâches | `task.dependency.create` | Courant | tâche bloquée |
| Tâches | `task.dependency.delete` | Sensible | tâche bloquée |
| Documents | `document.create` | Courant | nom, projet |
| Documents | `document.version.upload` | Courant | nom, taille, type du fichier |
| Documents | `document.update` | Courant | champs modifiés |
| Documents | `document.delete` | Sensible | — |
| Comptes | `user.create_by_admin` | Courant | email, rôle |
| Comptes | `user.delete` | Critique | réattribution |

Chaque entrée porte en plus : auteur (id + email dénormalisé), date, objet visé,
adresse IP, navigateur et **identifiant de requête** pour corréler avec les logs
applicatifs.

Deux garanties : l’entrée n’est écrite qu’**après le succès** de l’action (une
tentative refusée en 403 ne laisse pas de trace d’exécution), et elle **survit à
la suppression du compte** auteur (`ON DELETE SET NULL`).

---

## Endpoints

### 1. Consulter le journal

| Élément | Valeur |
| ------- | ------ |
| Méthode | `GET` |
| URL | `/audit-logs` |
| Auth | Oui + **ADMIN global** |

**Filtres (tous cumulables)** :

| Paramètre | Effet |
| --------- | ----- |
| `skip`, `take` | pagination (`take` plafonné à 200) |
| `period` | `7d`, `30d` ou `90d` |
| `dateFrom`, `dateTo` | plage ISO 8601 ; **prioritaire sur `period`** |
| `severities` | `critical`, `warning`, `info` — liste séparée par virgules |
| `categories` | `Projet`, `Membres`, `Tâches`, `Documents`, `Comptes` |
| `actions` | codes d’action précis |
| `action` | un code unique (raccourci) |
| `userIds` / `userId` | auteurs |
| `targetTypes` / `targetType` | `Project`, `Task`, `Document`, `User` |
| `targetId` | suivre un objet précis |
| `ip` | origine réseau exacte |
| `requestId` | corrélation avec les logs |
| `search` | libre sur email, action, cible, IP, requête |
| `sort` | `asc` ou `desc` (défaut) |

Action, catégorie et gravité se **croisent** : demander catégorie `Tâches` et
gravité `critical` ne renvoie que les actions satisfaisant les deux — donc rien
aujourd’hui, aucune action de tâche n’étant critique. C’est le comportement
attendu d’un filtre, pas un bug.

**Exemple curl :**

```bash
curl -s "http://localhost:4000/audit-logs?period=30d&severities=critical,warning&categories=Membres&take=25" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** entrées triées du plus récent au plus ancien, `total` cohérent
avec les filtres, 403 pour un non-ADMIN.

---

### 2. Export

| Élément | Valeur |
| ------- | ------ |
| Méthode | `GET` |
| URL | `/audit-logs/export` |
| Auth | Oui + **ADMIN global** |

Mêmes filtres, sans pagination : renvoie l’intégralité du jeu filtré, plafonné à
**10 000 entrées**. La réponse porte `truncated: true` au-delà, ce que
l’interface signale explicitement.

---

### 3. Valeurs de filtres

`GET /audit-logs/filter-options` → catalogue complet des actions (libellé,
description, gravité, catégorie), catégories, gravités, plus les actions,
types d’objet, auteurs et adresses IP **réellement présents en base**.

Le catalogue est la source de vérité des libellés : l’interface le consomme au
lieu de dupliquer la table.

---

### 4. Statistiques

`GET /audit-logs/stats` → accepte les **mêmes filtres** que la liste. Renvoie
`total` (périmètre filtré), `overall` (volume global), `today`,
`lastSevenDays`, `distinctActors` et `byAction`.

---

## Interface

Page `/settings/audit-logs`, visible dans la barre latérale pour les ADMIN
uniquement. Période en accès direct (7j / 30j / 90j / Tout), puis gravité,
catégories, recherche, auteur, actions précises, et un panneau « Filtres
avancés » replié pour l’enquête (type et identifiant d’objet, IP, identifiant de
requête, plage de dates, ordre).

Export Excel et PDF du jeu filtré complet.

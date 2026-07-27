# Module Projets – Tests

CRUD projets, membres, code d’invitation, token d’invitation, régénération token.

---

## Prérequis

- **JWT** pour toutes les routes.
- **ADMIN** ou **PROJECT_MANAGER** (rôle global) pour créer un projet.
- Le reste des permissions dépend du **rôle projet**, pas du rôle global.

---

## Rôles projet (RBAC fin)

Chaque membre porte un rôle dans le projet, indépendant de son rôle global.
Hiérarchie : `OWNER` > `ADMIN` > `MEMBER` > `VIEWER`. Un rôle hérite de tout
ce qu'autorisent les rôles inférieurs.

| Action                                            | Rôle minimum |
| ------------------------------------------------- | ------------ |
| Consulter projet, tâches, planning, docs, chat    | `VIEWER`     |
| Commenter une tâche, poster dans le chat, déposer un document | `MEMBER` |
| Modifier une tâche, changer son statut, y saisir du temps | `MEMBER` **et être assigné à cette tâche** |
| Créer/supprimer des tâches, assigner, gérer les dépendances | `ADMIN` |
| Ajouter/retirer des membres, changer leur rôle, modifier le projet, régénérer le token | `ADMIN` |
| Supprimer le projet, transférer la propriété      | `OWNER`      |

Trois règles complémentaires :

- Le propriétaire du projet est toujours traité comme `OWNER`.
- Un **ADMIN global** est traité comme `OWNER` sur tous les projets.
- Un `MEMBER` ne modifie **que les tâches qui lui sont assignées** : il exécute
  son travail, il ne réorganise pas celui des autres. Les gestionnaires
  (`ADMIN` et au-dessus) agissent sur toutes les tâches du projet. Commenter
  reste ouvert à tous les membres, sans exigence d'assignation.

Garde-fous anti-escalade : on ne peut ni attribuer un rôle supérieur ou égal au
sien, ni agir sur un membre de rang supérieur ou égal, ni modifier son propre rôle.
`OWNER` ne s'attribue pas : il passe par le transfert de propriété.

Les réponses `GET /projects/my-projects` et `GET /projects/:id` exposent `myRole`,
pour que le front masque les actions interdites.

---

## Endpoints

### 1. Créer un projet

| Élément | Valeur                                 |
| ------- | -------------------------------------- |
| Méthode | `POST`                                 |
| URL     | `/projects`                            |
| Auth    | Oui + **ADMIN** ou **PROJECT_MANAGER** |

**Body (JSON)** : `name`, `priority`, `startDate` (ISO), optionnel : `description`, `objectives`, `status`, `endDate`.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/projects \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Projet Alpha",
    "description": "Application interne",
    "priority": "HIGH",
    "startDate": "2026-01-15",
    "endDate": "2026-06-30"
  }'
```

**À vérifier :** 201, objet projet avec `id`, `projectCode`, `inviteToken`, `ownerId`. Un canal de chat est créé automatiquement.

---

### 2. Mes projets

| Élément | Valeur                  |
| ------- | ----------------------- |
| Méthode | `GET`                   |
| URL     | `/projects/my-projects` |
| Auth    | Oui                     |

**Exemple curl :**

```bash
curl -s http://localhost:4000/projects/my-projects \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Liste des projets dont l’utilisateur est membre (avec owner, \_count tasks/members).

---

### 3. Détail d’un projet

| Élément | Valeur                 |
| ------- | ---------------------- |
| Méthode | `GET`                  |
| URL     | `/projects/:id`        |
| Auth    | Oui (membre du projet) |

**Exemple curl :**

```bash
curl -s http://localhost:4000/projects/PROJECT_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Détails du projet (403 si non membre).

---

### 4. Mettre à jour un projet (owner)

| Élément | Valeur          |
| ------- | --------------- |
| Méthode | `PATCH`         |
| URL     | `/projects/:id` |
| Auth    | Oui + **owner** |

**Body (JSON)** : champs à modifier (name, description, objectives, priority, status, startDate, endDate).

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/projects/PROJECT_ID \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Projet Alpha v2", "priority": "MEDIUM"}'
```

**À vérifier :** Projet mis à jour. 403 si non-owner.

---

### 5. Ajouter un membre (ADMIN projet)

| Élément | Valeur                  |
| ------- | ----------------------- |
| Méthode | `POST`                  |
| URL     | `/projects/:id/members` |
| Auth    | Oui + **ADMIN projet**  |

**Body (JSON)** : `userId` (id de l’utilisateur à ajouter), `role` optionnel
(`ADMIN`, `MEMBER` par défaut, `VIEWER`).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/projects/PROJECT_ID/members \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID_A_AJOUTER", "role": "VIEWER"}'
```

**À vérifier :** Membre ajouté avec le rôle demandé. 403 si `MEMBER`/`VIEWER`.
403 aussi si `role: "OWNER"` (passer par le transfert de propriété) ou si un
`ADMIN` projet tente d'attribuer `ADMIN`.

---

### 6. Retirer un membre (ADMIN projet)

| Élément | Valeur                  |
| ------- | ----------------------- |
| Méthode | `DELETE`                |
| URL     | `/projects/:id/members` |
| Auth    | Oui + **ADMIN projet**  |

**Body (JSON)** : `userId` (id du membre à retirer).

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/projects/PROJECT_ID/members \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID_A_RETIRER"}'
```

**À vérifier :** Membre retiré. 403 si `MEMBER`/`VIEWER`, si la cible est
`OWNER`, ou si un `ADMIN` projet vise un autre `ADMIN`.

---

### 6 bis. Changer le rôle d’un membre (ADMIN projet)

| Élément | Valeur                       |
| ------- | ---------------------------- |
| Méthode | `PATCH`                      |
| URL     | `/projects/:id/members/role` |
| Auth    | Oui + **ADMIN projet**       |

**Body (JSON)** : `userId`, `role` (`ADMIN`, `MEMBER` ou `VIEWER`).

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/projects/PROJECT_ID/members/role \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID", "role": "VIEWER"}'
```

**À vérifier :** Rôle mis à jour. 403 sur son propre rôle, sur un `OWNER`,
sur `role: "OWNER"`, ou en cas d'escalade (attribuer un rôle ≥ au sien).

---

### 6 ter. Transférer la propriété (OWNER)

| Élément | Valeur                             |
| ------- | ---------------------------------- |
| Méthode | `PATCH`                            |
| URL     | `/projects/:id/transfer-ownership` |
| Auth    | Oui + **OWNER**                    |

**Body (JSON)** : `newOwnerId` (doit déjà être membre du projet).

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/projects/PROJECT_ID/transfer-ownership \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"newOwnerId": "USER_ID"}'
```

**À vérifier :** `ownerId` du projet mis à jour, le nouveau propriétaire passe
`OWNER`, l'ancien est rétrogradé `ADMIN`. 404 si la cible n'est pas membre.

---

### 7. Rejoindre par code

| Élément | Valeur                |
| ------- | --------------------- |
| Méthode | `POST`                |
| URL     | `/projects/join/code` |
| Auth    | Oui                   |

**Body (JSON)** : `projectCode` (code court du projet, ex. 4F3E2A).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/projects/join/code \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"projectCode": "CODE_DU_PROJET"}'
```

**À vérifier :** Utilisateur ajouté comme membre du projet.

---

### 8. Rejoindre par token

| Élément | Valeur                            |
| ------- | --------------------------------- |
| Méthode | `POST`                            |
| URL     | `/projects/join/token`            |
| Auth    | Non (ou Oui selon implémentation) |

**Body (JSON)** : `inviteToken` (token d’invitation du projet).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/projects/join/token \
  -H "Content-Type: application/json" \
  -d '{"inviteToken": "TOKEN_INVITATION"}'
```

**À vérifier :** Réponse indiquant l’adhésion au projet (vérifier dans le code si JWT est requis).

---

### 9. Régénérer le token d’invitation (owner)

| Élément | Valeur                           |
| ------- | -------------------------------- |
| Méthode | `PATCH`                          |
| URL     | `/projects/:id/regenerate-token` |
| Auth    | Oui + **owner**                  |

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/projects/PROJECT_ID/regenerate-token \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Nouveau `inviteToken` retourné.

---

### 9 bis. Inviter par email (ADMIN projet)

| Élément | Valeur                  |
| ------- | ----------------------- |
| Méthode | `POST`                  |
| URL     | `/projects/:id/invite`  |
| Auth    | Oui + **ADMIN projet**  |

**Body (JSON)** : `email`.

N'ajoute **aucun membre immédiatement** : le projet n'a qu'un seul token
d'invitation partagé, l'endpoint se contente de l'envoyer par email plutôt que
de le faire copier-coller manuellement. Le destinataire peut ne pas encore
avoir de compte — le lien `/invite/:token` du front le guide vers
l'inscription puis rejoint automatiquement le projet.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/projects/PROJECT_ID/invite \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email": "collegue@exemple.fr"}'
```

**À vérifier :** email reçu (template Resend), 409 si la personne est déjà
membre, 403 si `MEMBER`/`VIEWER`.

---

### 10. Supprimer un projet (owner)

| Élément | Valeur          |
| ------- | --------------- |
| Méthode | `DELETE`        |
| URL     | `/projects/:id` |
| Auth    | Oui + **owner** |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/projects/PROJECT_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Projet supprimé (soft delete). 403 si non-owner.

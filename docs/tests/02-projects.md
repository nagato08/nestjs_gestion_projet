# Module Projets – Tests

CRUD projets, membres, code d’invitation, token d’invitation, régénération token.

---

## Prérequis

- **JWT** pour toutes les routes.
- **ADMIN** ou **PROJECT_MANAGER** pour créer un projet.
- **Owner du projet** pour : mise à jour, ajout/retrait de membres, régénération token, suppression.

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

### 5. Ajouter un membre (owner)

| Élément | Valeur                  |
| ------- | ----------------------- |
| Méthode | `POST`                  |
| URL     | `/projects/:id/members` |
| Auth    | Oui + **owner**         |

**Body (JSON)** : `userId` (id de l’utilisateur à ajouter).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/projects/PROJECT_ID/members \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID_A_AJOUTER"}'
```

**À vérifier :** Membre ajouté. 403 si non-owner.

---

### 6. Retirer un membre (owner)

| Élément | Valeur                  |
| ------- | ----------------------- |
| Méthode | `DELETE`                |
| URL     | `/projects/:id/members` |
| Auth    | Oui + **owner**         |

**Body (JSON)** : `userId` (id du membre à retirer).

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/projects/PROJECT_ID/members \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID_A_RETIRER"}'
```

**À vérifier :** Membre retiré. 403 si non-owner.

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

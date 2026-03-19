# Module Tâches – Tests

CRUD tâches, statut, assignations, dépendances, commentaires.

---

## Prérequis

- **JWT** pour toutes les routes.
- Utilisateur **membre du projet** concerné pour les opérations sur les tâches de ce projet.

---

## Endpoints

### 1. Créer une tâche

| Élément | Valeur   |
| ------- | -------- |
| Méthode | `POST`   |
| URL     | `/tasks` |
| Auth    | Oui      |

**Body (JSON)** : `projectId`, `title`, `priority` (HIGH | MEDIUM | LOW), optionnel : `description`, `deadline`, `startDate`, `endDate`, `optimisticDays`, `probableDays`, `pessimisticDays`, `storyPoints`, `parentId`, `assignedUserIds[]`.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/tasks \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "PROJECT_ID",
    "title": "Implémenter le login",
    "priority": "HIGH",
    "description": "Formulaire + validation"
  }'
```

**À vérifier :** 201, tâche créée avec `id`. 403 si non membre du projet.

---

### 2. Tâches d’un projet

| Élément | Valeur                      |
| ------- | --------------------------- |
| Méthode | `GET`                       |
| URL     | `/tasks/project/:projectId` |
| Auth    | Oui                         |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/tasks/project/PROJECT_ID" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Liste des tâches du projet (racines et/ou avec sous-tâches selon l’API).

---

### 3. Mes tâches

| Élément | Valeur            |
| ------- | ----------------- |
| Méthode | `GET`             |
| URL     | `/tasks/my-tasks` |
| Auth    | Oui               |

**Exemple curl :**

```bash
curl -s http://localhost:4000/tasks/my-tasks \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Tâches assignées à l’utilisateur.

---

### 4. Détail d’une tâche

| Élément | Valeur       |
| ------- | ------------ |
| Méthode | `GET`        |
| URL     | `/tache/:id` |
| Auth    | Oui          |

**Exemple curl :**

```bash
curl -s http://localhost:4000/tasks/TASK_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Détails de la tâche. 403 si non membre du projet.

---

### 5. Mettre à jour une tâche

| Élément | Valeur       |
| ------- | ------------ |
| Méthode | `PATCH`      |
| URL     | `/tasks/:id` |
| Auth    | Oui          |

**Body (JSON)** : champs à modifier (title, description, priority, deadline, startDate, endDate, etc.).

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/tasks/TASK_ID \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"title": "Nouveau titre", "priority": "MEDIUM"}'
```

**À vérifier :** Tâche mise à jour.

---

### 6. Supprimer une tâche

| Élément | Valeur       |
| ------- | ------------ |
| Méthode | `DELETE`     |
| URL     | `/tasks/:id` |
| Auth    | Oui          |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/tasks/TASK_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Tâche supprimée (ou soft delete).

---

### 7. Changer le statut d’une tâche

| Élément | Valeur              |
| ------- | ------------------- |
| Méthode | `PATCH`             |
| URL     | `/tasks/:id/status` |
| Auth    | Oui                 |

**Body (JSON)** : `status` (TODO | DOING | DONE).

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/tasks/TASK_ID/status \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"status": "DOING"}'
```

**À vérifier :** Statut mis à jour.

---

### 8. Assigner des utilisateurs à une tâche

| Élément | Valeur              |
| ------- | ------------------- |
| Méthode | `POST`              |
| URL     | `/tasks/:id/assign` |
| Auth    | Oui                 |

**Body (JSON)** : `userIds` (tableau d’ids utilisateurs, membres du projet).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/tasks/TASK_ID/assign \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"userIds": ["USER_ID_1"]}'
```

**À vérifier :** Assignations créées (remplace les assignations existantes).

---

### 9. Retirer un utilisateur d’une tâche

| Élément | Valeur                      |
| ------- | --------------------------- |
| Méthode | `DELETE`                    |
| URL     | `/tasks/:id/assign/:userId` |
| Auth    | Oui                         |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/tasks/TASK_ID/assign/USER_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Assignation supprimée.

---

### 10. Ajouter une dépendance

| Élément | Valeur                    |
| ------- | ------------------------- |
| Méthode | `POST`                    |
| URL     | `/tasks/:id/dependencies` |
| Auth    | Oui                       |

**Body (JSON)** : `blockedTaskId` (id de la tâche qui bloque la tâche courante).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/tasks/TASK_ID/dependencies \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"blockedTaskId": "ID_TACHE_BLOQUANTE"}'
```

**À vérifier :** Dépendance créée (pas de cycle).

---

### 11. Supprimer une dépendance

| Élément | Valeur                                   |
| ------- | ---------------------------------------- |
| Méthode | `DELETE`                                 |
| URL     | `/tasks/:id/dependencies/:blockedTaskId` |
| Auth    | Oui                                      |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/tasks/TASK_ID/dependencies/BLOCKED_TASK_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Dépendance supprimée.

---

### 12. Ajouter un commentaire

| Élément | Valeur                |
| ------- | --------------------- |
| Méthode | `POST`                |
| URL     | `/tasks/:id/comments` |
| Auth    | Oui                   |

**Body (JSON)** : `content` (texte du commentaire).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/tasks/TASK_ID/comments \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"content": "Commentaire de suivi"}'
```

**À vérifier :** Commentaire créé.

---

### 13. Supprimer un commentaire

| Élément | Valeur                       |
| ------- | ---------------------------- |
| Méthode | `DELETE`                     |
| URL     | `/tasks/comments/:commentId` |
| Auth    | Oui                          |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/tasks/comments/COMMENT_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Commentaire supprimé.

# Module Time entries – Tests

Démarrage / arrêt du timer, saisie manuelle, statistiques de temps.

---

## Prérequis

- **JWT** pour toutes les routes.
- **Membre du projet** pour les stats par projet.

---

## Endpoints

### 1. Démarrer un timer

| Élément | Valeur                |
| ------- | --------------------- |
| Méthode | `POST`                |
| URL     | `/time-entries/start` |
| Auth    | Oui                   |

**Body (JSON)** : selon le DTO (ex. `taskId`). Vérifier `StartTimerDto`.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/time-entries/start \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"taskId": "TASK_ID"}'
```

**À vérifier :** Entrée créée avec startTime, endTime null (timer en cours). Une seule entrée active par utilisateur selon les règles métier.

---

### 2. Arrêter le timer

| Élément | Valeur               |
| ------- | -------------------- |
| Méthode | `POST`               |
| URL     | `/time-entries/stop` |
| Auth    | Oui                  |

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/time-entries/stop \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** L’entrée active est mise à jour (endTime, duration). Réponse avec l’entrée finalisée.

---

### 3. Entrée active (timer en cours)

| Élément | Valeur                 |
| ------- | ---------------------- |
| Méthode | `GET`                  |
| URL     | `/time-entries/active` |
| Auth    | Oui                    |

**Exemple curl :**

```bash
curl -s http://localhost:4000/time-entries/active \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** L’entrée en cours (taskId, startTime) ou null si aucun timer actif.

---

### 4. Saisie manuelle de temps

| Élément | Valeur                 |
| ------- | ---------------------- |
| Méthode | `POST`                 |
| URL     | `/time-entries/manual` |
| Auth    | Oui                    |

**Body (JSON)** : selon `CreateManualTimeEntryDto` (ex. `taskId`, `startTime`, `endTime` ou `duration`, `isManual`).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/time-entries/manual \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "TASK_ID",
    "startTime": "2026-01-15T09:00:00Z",
    "endTime": "2026-01-15T12:00:00Z"
  }'
```

**À vérifier :** Entrée créée avec durée calculée.

---

### 5. Mes entrées de temps

| Élément | Valeur                     |
| ------- | -------------------------- |
| Méthode | `GET`                      |
| URL     | `/time-entries/my-entries` |
| Auth    | Oui                        |

**Query** : optionnel (période, taskId, etc. selon l’API).

**Exemple curl :**

```bash
curl -s "http://localhost:4000/time-entries/my-entries" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Liste des entrées de l’utilisateur.

---

### 6. Mes statistiques de temps

| Élément | Valeur                   |
| ------- | ------------------------ |
| Méthode | `GET`                    |
| URL     | `/time-entries/my-stats` |
| Auth    | Oui                      |

**Query** : optionnel (startDate, endDate).

**Exemple curl :**

```bash
curl -s "http://localhost:4000/time-entries/my-stats" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Agrégation (total heures, par tâche/projet selon l’API).

---

### 7. Statistiques temps d’un projet

| Élément | Valeur                                   |
| ------- | ---------------------------------------- |
| Méthode | `GET`                                    |
| URL     | `/time-entries/project/:projectId/stats` |
| Auth    | Oui (membre du projet)                   |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/time-entries/project/PROJECT_ID/stats" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Stats de temps pour le projet (par tâche, par utilisateur, etc.).

---

### 8. Supprimer une entrée

| Élément | Valeur              |
| ------- | ------------------- |
| Méthode | `DELETE`            |
| URL     | `/time-entries/:id` |
| Auth    | Oui                 |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/time-entries/ENTRY_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Entrée supprimée. 403 si l’entrée n’appartient pas à l’utilisateur.

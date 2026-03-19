# Module Planning – Tests

Gantt, PERT, dashboard (donut statuts, Eisenhower), burndown, charge (workload).

---

## Prérequis

- **JWT** pour toutes les routes.
- Utilisateur **membre du projet** pour les endpoints liés à un `projectId`.
- Pour **workload** : membre d’au moins un projet (ou filtre par `projectId`).

---

## Endpoints

### 1. Données Gantt

| Élément | Valeur                                |
| ------- | ------------------------------------- |
| Méthode | `GET`                                 |
| URL     | `/planning/projects/:projectId/gantt` |
| Auth    | Oui                                   |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/planning/projects/PROJECT_ID/gantt" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Liste de tâches avec `id`, `title`, `status`, `priority`, `startDate`, `endDate`, `deadline`, `durationDays`, `dependencies`, `assignees`.

---

### 2. Données PERT et chemin critique

| Élément | Valeur                               |
| ------- | ------------------------------------ |
| Méthode | `GET`                                |
| URL     | `/planning/projects/:projectId/pert` |
| Auth    | Oui                                  |


**Exemple curl :**

```bash
curl -s "http://localhost:4000/planning/projects/PROJECT_ID/pert" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** `nodes` (tâches avec `expectedDays`), `edges` (from/to), `criticalPath` (liste d’ids de tâches sur le chemin critique).

---

### 3. Donut des statuts (dashboard)

| Élément | Valeur                                                 |
| ------- | ------------------------------------------------------ |
| Méthode | `GET`                                                  |
| URL     | `/planning/projects/:projectId/dashboard/status-donut` |
| Auth    | Oui                                                    |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/planning/projects/PROJECT_ID/dashboard/status-donut" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Données pour un graphique donut (répartition TODO / DOING / DONE).

---

### 4. Matrice Eisenhower

| Élément | Valeur                                               |
| ------- | ---------------------------------------------------- |
| Méthode | `GET`                                                |
| URL     | `/planning/projects/:projectId/dashboard/eisenhower` |
| Auth    | Oui                                                  |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/planning/projects/PROJECT_ID/dashboard/eisenhower" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Quadrants (urgent/important, etc.) avec tâches associées.

---

### 5. Burndown

| Élément | Valeur                                   |
| ------- | ---------------------------------------- |
| Méthode | `GET`                                    |
| URL     | `/planning/projects/:projectId/burndown` |
| Auth    | Oui                                      |

**Query (optionnel)** : `startDate`, `endDate` (ISO).

**Exemple curl :**

```bash
curl -s "http://localhost:4000/planning/projects/PROJECT_ID/burndown?startDate=2026-01-01&endDate=2026-03-31" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Données burndown (idéal vs réel, basé sur story points ou nombre de tâches selon la config).

---

### 6. Charge (workload)

| Élément | Valeur               |
| ------- | -------------------- |
| Méthode | `GET`                |
| URL     | `/planning/workload` |
| Auth    | Oui                  |

**Query** : `startDate`, `endDate` (obligatoires), optionnel : `projectId`, `groupBy` (day | week).

**Exemple curl :**

```bash
curl -s "http://localhost:4000/planning/workload?startDate=2026-01-01&endDate=2026-01-31&groupBy=week" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Données de charge par utilisateur (heures par jour/semaine, alertes si > 40h/semaine selon la logique métier).

# Comment fonctionnent les tâches et le module Planning

## 1. Tâches (tache.service.ts) et nouveaux champs

### Champs ajoutés sur le modèle `Task` (Prisma)

| Champ                                                       | Rôle                                                                                                                                                                     |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **startDate** / **endDate**                                 | Gantt : début et fin de la barre. Quand tu déplaces une barre (drag & drop), le front envoie `PATCH /tache/:id` avec ces deux champs.                                    |
| **optimisticDays** / **probableDays** / **pessimisticDays** | PERT : estimations en jours pour la formule **te = (o + 4m + p) / 6** (temps attendu).                                                                                   |
| **storyPoints**                                             | Burndown (ou vélocité) : nombre de points par tâche. Si au moins une tâche a des points, le burndown utilise la somme des points ; sinon il utilise le nombre de tâches. |

### Création d’une tâche (`createTask`)

1. Vérification que l’utilisateur a accès au projet.
2. Si `parentId` est fourni : vérification que la tâche parent existe et appartient au même projet.
3. Si `assignedUserIds` est fourni : vérification que tous sont membres du projet.
4. Création en base avec tous les champs du DTO, y compris `startDate`, `endDate`, `optimisticDays`, `probableDays`, `pessimisticDays`, `storyPoints` (optionnels).

### Mise à jour d’une tâche (`updateTask`)

1. Vérification que l’utilisateur a accès à la tâche (membre du projet).
2. Construction de `updateData` : seuls les champs présents dans le DTO sont mis à jour.
3. Les champs Planning sont bien pris en compte : `startDate`, `endDate`, `optimisticDays`, `probableDays`, `pessimisticDays`, `storyPoints`.

**Drag & drop Gantt** : le front appelle `PATCH /tache/:id` avec uniquement `startDate` et `endDate` ; le reste de la tâche ne change pas.

---

## 2. Module Planning (dossier `src/planning`)

Tous les endpoints sont protégés par **JwtAuthGuard** et vérifient que l’utilisateur est **membre du projet** (sauf workload qui peut être global ou filtré par projet).

### 2.1 Gantt (gantt.service.ts)

- **Rôle** : fournir les données pour afficher un diagramme de Gantt (barres par tâche, dépendances).
- **Endpoint** : `GET /planning/projects/:projectId/gantt`
- **Fonctionnement** :
  1. Vérification d’accès au projet.
  2. Récupération des tâches **racine** du projet (`parentId: null`) avec dépendances et assignés.
  3. Pour chaque tâche, renvoi : `id`, `title`, `status`, `priority`, `startDate`, `endDate`, `deadline`, `durationDays` (calculé si start/end présents), `dependencies` (IDs des tâches bloquantes), `assignees`.
- **Côté front** : afficher une barre par tâche entre `startDate` et `endDate` ; au drag, envoyer `PATCH /tache/:id` avec les nouvelles `startDate` et `endDate`.

---

### 2.2 PERT (pert.service.ts)

- **Rôle** : graphe logique (ordre des tâches), temps attendu **te** par tâche, et **chemin critique**.
- **Endpoint** : `GET /planning/projects/:projectId/pert`
- **Formule** : **te = (optimisticDays + 4×probableDays + pessimisticDays) / 6** (en jours). Si une des trois valeurs manque, `expectedDays` est `null` pour cette tâche.
- **Fonctionnement** :
  1. Vérification d’accès au projet.
  2. Récupération des tâches racine + dépendances (`blockedBy` = tâches qui bloquent).
  3. Pour chaque tâche : calcul de `expectedDays` (te).
  4. Construction des **arêtes** : `from` = tâche bloquante, `to` = tâche bloquée.
  5. **Chemin critique** : plus long chemin (somme des te) dans le graphe. Algorithme : pour chaque tâche, `L[i] = max(L[j] pour j prédécesseur) + te(i)` ; le chemin est reconstruit à partir du nœud qui a la plus grande `L[i]` en remontant les prédécesseurs.
- **Réponse** : `{ nodes, edges, criticalPath }`. Le front peut dessiner un réseau (bulles + flèches) et mettre en évidence les tâches du `criticalPath`.

---

### 2.3 Dashboard (dashboard.service.ts)

#### Donut des statuts

- **Endpoint** : `GET /planning/projects/:projectId/dashboard/status-donut`
- **Rôle** : répartition des tâches en « À faire », « En cours », « Terminé ».
- **Fonctionnement** : comptage des tâches racine par `status` (TODO, DOING, DONE). Retourne `labels`, `values`, `total` pour un donut ou un graphique en secteurs.

#### Matrice d’Eisenhower

- **Endpoint** : `GET /planning/projects/:projectId/dashboard/eisenhower`
- **Rôle** : classer les tâches en 4 quadrants (Urgent/Important, Urgent/Pas important, Pas urgent/Important, Pas urgent/Pas important).
- **Règles** :
  - **Urgent** : `deadline` dans les 7 prochains jours (ou déjà dépassée).
  - **Important** : `priority === 'HIGH'`.
- **Réponse** : 4 tableaux `urgentImportant`, `urgentNotImportant`, `notUrgentImportant`, `notUrgentNotImportant`, chacun contenant des objets `{ id, title, status, deadline }`.

---

### 2.4 Burndown (burndown.service.ts)

- **Rôle** : travail restant dans le temps (idéal vs réel) pour un sprint ou une période.
- **Endpoint** : `GET /planning/projects/:projectId/burndown?startDate=...&endDate=...`
- **Fonctionnement** :
  1. Plage de dates : si `startDate`/`endDate` sont fournis en query, ils sont utilisés ; sinon dates du projet.
  2. **Travail** : si au moins une tâche a des `storyPoints` > 0, le travail = somme des story points ; sinon travail = nombre de tâches.
  3. Pour chaque jour entre start et end :
     - **idéal** : ligne droite de `totalWork` à 0 (répartition linéaire).
     - **réel** : travail restant à cette date = tâches non encore DONE à cette date (en fonction de `updatedAt` ou du statut à la date considérée ; ici on considère qu’une tâche DONE « enlève » son travail au moment de son passage en DONE).
- **Réponse** : `dates`, `ideal`, `actual`, `totalWork`, `useStoryPoints`. Le front trace deux courbes ; si la courbe réelle est au-dessus de l’idéale, le sprint est en retard.

---

### 2.5 Workload (workload.service.ts)

- **Rôle** : histogramme de charge = heures par employé par jour (ou par semaine).
- **Endpoint** : `GET /planning/workload?startDate=...&endDate=...&projectId=...&groupBy=day|week`
- **Fonctionnement** :
  1. Filtrage des **TimeEntry** avec `endTime` dans la plage `[startDate, endDate]`, et optionnellement par `projectId` (tâches du projet).
  2. Agrégation par utilisateur : pour chaque jour (ou semaine si `groupBy=week`), somme des `duration` (minutes).
  3. Seuil **40 h/semaine** : si `groupBy=week`, chaque utilisateur a un flag `isOverloaded` si au moins une semaine dépasse 40 h.
- **Réponse** : `byUser` (liste d’utilisateurs avec `byDay` ou `byWeek`, `totalMinutes`, `isOverloaded`), `overloadThresholdMinutes`. Le front peut afficher des barres par jour/semaine et passer en rouge au-dessus du seuil.

---

## 3. Résumé des flux

1. **Gantt** : `GET .../gantt` → affichage des barres ; drag → `PATCH /tache/:id` avec `startDate` et `endDate`.
2. **PERT** : `GET .../pert` → affichage du graphe + chemin critique ; les estimations viennent des champs `optimisticDays`, `probableDays`, `pessimisticDays` (création/mise à jour de tâche).
3. **Donut** : `GET .../status-donut` → affichage des proportions TODO/DOING/DONE.
4. **Eisenhower** : `GET .../eisenhower` → affichage des 4 quadrants.
5. **Burndown** : `GET .../burndown?startDate=&endDate=` → affichage idéal vs réel ; les tâches peuvent avoir des `storyPoints` pour un burndown en points.
6. **Workload** : `GET .../workload?startDate=&endDate=&projectId=&groupBy=week` → affichage des heures par personne, avec alerte si > 40 h/semaine.

---

## 4. Migration Prisma

Les champs `startDate`, `endDate`, `optimisticDays`, `probableDays`, `pessimisticDays`, `storyPoints` ont été ajoutés au modèle `Task`. Pour les avoir en base :

1. Appliquer la migration : `npx prisma migrate dev`
2. Régénérer le client si besoin : `npx prisma generate`

Si le client Prisma n’est pas à jour, le code utilise un cast `as any` pour la création de tâche afin que la compilation passe ; une fois `prisma generate` exécuté correctement, tu pourras retirer ce cast si tu le souhaites.

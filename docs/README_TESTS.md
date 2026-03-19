# Guide de tests des modules API

Base URL par défaut : **`http://localhost:4000`** (ou la valeur de `PORT` dans `.env`).

## Prérequis globaux

- Serveur démarré : `npm run start:dev`
- Pour les routes protégées : récupérer un **JWT** via `POST /auth/login`, puis envoyer l’en-tête :
  ```http
  Authorization: Bearer <votre_token>
  ```
- Swagger disponible : **`http://localhost:4000/swagger`**

## Documents par module

| #   | Module                | Fichier                                                                | Description                                                                |
| --- | --------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Auth                  | [tests/01-auth.md](tests/01-auth.md)                                   | Inscription, connexion, profil, reset password, liste utilisateurs (admin) |
| 2   | Projets               | [tests/02-projects.md](tests/02-projects.md)                           | CRUD projets, membres, code d’invitation, token                            |
| 3   | Tâches                | [tests/03-taches.md](tests/03-taches.md)                               | CRUD tâches, statut, assignations, dépendances, commentaires               |
| 4   | Chat                  | [tests/04-chat.md](tests/04-chat.md)                                   | Chat par projet (envoyer message, récupérer conversation)                  |
| 5   | Planning              | [tests/05-planning.md](tests/05-planning.md)                           | Gantt, PERT, dashboard, burndown, charge                                   |
| 6   | IA                    | [tests/06-ai.md](tests/06-ai.md)                                       | Interprétation, exécution, act, analyse Gantt/PERT, prévision retards      |
| 7   | Documents             | [tests/07-documents.md](tests/07-documents.md)                         | Documents projet, versions, commentaires                                   |
| 8   | Messages              | [tests/08-messages.md](tests/08-messages.md)                           | Messages projet (ancien canal)                                             |
| 9   | Notifications         | [tests/09-notifications.md](tests/09-notifications.md)                 | Création, liste, marquer lu                                                |
| 10  | Time entries          | [tests/10-time-entries.md](tests/10-time-entries.md)                   | Timer, saisie manuelle, stats                                              |
| 11  | Company settings      | [tests/11-company-settings.md](tests/11-company-settings.md)           | Paramètres entreprise (lecture / mise à jour)                              |
| 12  | Notification settings | [tests/12-notification-settings.md](tests/12-notification-settings.md) | Préférences notifications utilisateur                                      |

---

Pour tester un module, ouvrir le fichier correspondant et suivre les exemples (curl ou Swagger).

# Module Messages – Tests

Messages projet (ancien canal de communication par projet, distinct du Chat Conversation/ChatMessage).

---

## Prérequis

- **JWT** pour toutes les routes.
- Utilisateur **membre du projet** pour accéder aux messages du projet.

---

## Endpoints

### 1. Envoyer un message sur un projet

| Élément | Valeur                         |
| ------- | ------------------------------ |
| Méthode | `POST`                         |
| URL     | `/messages/project/:projectId` |
| Auth    | Oui                            |

**Body (JSON)** : selon le DTO (ex. `content`, éventuellement `mentions[]`). Vérifier `CreateMessageDto`.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/messages/project/PROJECT_ID \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"content": "Annonce : réunion demain 10h"}'
```

**À vérifier :** Message créé avec id, content, userId, projectId, createdAt.

---

### 2. Messages d’un projet

| Élément | Valeur                         |
| ------- | ------------------------------ |
| Méthode | `GET`                          |
| URL     | `/messages/project/:projectId` |
| Auth    | Oui                            |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/messages/project/PROJECT_ID" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Liste des messages du projet (ordre selon l’API).

---

### 3. Détail d’un message

| Élément | Valeur          |
| ------- | --------------- |
| Méthode | `GET`           |
| URL     | `/messages/:id` |
| Auth    | Oui             |

**Exemple curl :**

```bash
curl -s http://localhost:4000/messages/MESSAGE_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Détails du message (avec auteur si inclus).

---

### 4. Supprimer un message

| Élément | Valeur          |
| ------- | --------------- |
| Méthode | `DELETE`        |
| URL     | `/messages/:id` |
| Auth    | Oui             |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/messages/MESSAGE_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Message supprimé (droits à vérifier dans l’API : auteur ou admin).

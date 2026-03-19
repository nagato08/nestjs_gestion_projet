# Module Chat – Tests

Chat **par projet** : un canal de discussion par projet. Envoyer un message et récupérer l’historique.

---

## Prérequis

- **JWT** pour toutes les routes.
- Utilisateur **membre du projet** pour accéder au chat de ce projet.

---

## Endpoints

### 1. Envoyer un message dans le chat du projet

| Élément | Valeur                     |
| ------- | -------------------------- |
| Méthode | `POST`                     |
| URL     | `/chat/project/:projectId` |
| Auth    | Oui (membre du projet)     |

**Body (JSON)** : `content` (texte du message, min. 1 caractère).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/chat/project/PROJECT_ID \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"content": "Bonjour, point sur les livrables ?"}'
```

**À vérifier :** Réponse avec `message: 'Message envoyé.'` et `data` (dernier message avec id, content, createdAt, sender). Les clients connectés en WebSocket dans la room `project:PROJECT_ID` reçoivent l’événement `project-chat-message`.

---

### 2. Récupérer la conversation du projet

| Élément | Valeur                     |
| ------- | -------------------------- |
| Méthode | `GET`                      |
| URL     | `/chat/project/:projectId` |
| Auth    | Oui (membre du projet)     |

**Exemple curl :**

```bash
curl -s http://localhost:4000/chat/project/PROJECT_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Objet avec `id`, `projectId`, `messages[]` (ordre chronologique, chaque message avec sender). Si aucun canal : `messages: []`.

---

## WebSocket (optionnel)

- **Rejoindre la room projet** : envoyer l’événement `join-project-room` avec `{ projectId, userId }`. Le serveur renvoie l’historique via `project-chat-history` et les nouveaux messages via `project-chat-message`.
- **Typing** : `typing-start` / `typing-stop` avec `projectId`, `userId`, `userName` pour notifier les autres membres.

# Module Notifications – Tests

Création, liste, compteur non lues, marquer comme lu.

---

## Prérequis

- **JWT** pour toutes les routes.
- Les notifications sont généralement liées à l’utilisateur connecté (liste et marquer lu).

---

## Endpoints

### 1. Créer une notification

| Élément | Valeur                                               |
| ------- | ---------------------------------------------------- |
| Méthode | `POST`                                               |
| URL     | `/notifications` (vérifier le préfixe du controller) |
| Auth    | Oui                                                  |

**Body (JSON)** : selon `CreateNotificationDto` (ex. `type`, `content`, `userId`). Souvent utilisé en interne ou par un admin.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/notifications \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"type": "TASK_ASSIGNED", "content": "Vous avez été assigné à la tâche X", "userId": "USER_ID"}'
```

**À vérifier :** Notification créée. Vérifier dans l’API qui peut créer des notifications (tous les utilisateurs ou seulement certains rôles).

---

### 2. Liste des notifications (utilisateur connecté)

| Élément | Valeur           |
| ------- | ---------------- |
| Méthode | `GET`            |
| URL     | `/notifications` |
| Auth    | Oui              |

**Exemple curl :**

```bash
curl -s http://localhost:4000/notifications \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Liste des notifications de l’utilisateur (avec isRead, type, content).

---

### 3. Nombre de notifications non lues

| Élément | Valeur                        |
| ------- | ----------------------------- |
| Méthode | `GET`                         |
| URL     | `/notifications/unread-count` |
| Auth    | Oui                           |

**Exemple curl :**

```bash
curl -s http://localhost:4000/notifications/unread-count \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Objet avec un compteur (ex. `count` ou `unreadCount`).

---

### 4. Marquer une notification comme lue

| Élément | Valeur                    |
| ------- | ------------------------- |
| Méthode | `PATCH`                   |
| URL     | `/notifications/:id/read` |
| Auth    | Oui                       |

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/notifications/NOTIF_ID/read \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Notification mise à jour (isRead: true). 403 si la notification n’appartient pas à l’utilisateur.

---

### 5. Marquer toutes comme lues

| Élément | Valeur                    |
| ------- | ------------------------- |
| Méthode | `PATCH`                   |
| URL     | `/notifications/read-all` |
| Auth    | Oui                       |

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/notifications/read-all \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Toutes les notifications de l’utilisateur passent en lues.

---

### 6. Supprimer une notification

| Élément | Valeur               |
| ------- | -------------------- |
| Méthode | `DELETE`             |
| URL     | `/notifications/:id` |
| Auth    | Oui                  |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/notifications/NOTIF_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Notification supprimée. 403 si elle n’appartient pas à l’utilisateur.

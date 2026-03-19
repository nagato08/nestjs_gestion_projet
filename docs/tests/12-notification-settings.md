# Module Notification settings – Tests

Préférences de notification de l’utilisateur (email, temps réel).

---

## Prérequis

- **JWT** pour toutes les routes.
- Chaque utilisateur accède à ses propres préférences (ou un admin à celles d’un utilisateur si l’API l’expose).

---

## Endpoints

### 1. Récupérer mes préférences

| Élément | Valeur                                         |
| ------- | ---------------------------------------------- |
| Méthode | `GET`                                          |
| URL     | `/notification-settings` (vérifier le préfixe) |
| Auth    | Oui                                            |

**Exemple curl :**

```bash
curl -s http://localhost:4000/notification-settings \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Objet avec email, realtime (booléens). Création par défaut si première visite selon l’API.

---

### 2. Mettre à jour mes préférences

| Élément | Valeur                   |
| ------- | ------------------------ |
| Méthode | `PATCH`                  |
| URL     | `/notification-settings` |
| Auth    | Oui                      |

**Body (JSON)** : `email` (boolean), `realtime` (boolean). Vérifier `UpdateNotificationSettingsDto`.

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/notification-settings \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"email": true, "realtime": true}'
```

**À vérifier :** Préférences mises à jour.

---

### 3. Préférences d’un utilisateur (admin)

| Élément | Valeur                           |
| ------- | -------------------------------- |
| Méthode | `GET`                            |
| URL     | `/notification-settings/:userId` |
| Auth    | Oui (souvent ADMIN)              |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/notification-settings/USER_ID" \
  -H "Authorization: Bearer JWT_ADMIN"
```

**À vérifier :** Préférences de l’utilisateur cible. 403 si non-admin.

# Module Auth – Tests

Authentification, inscription, profil, réinitialisation mot de passe, liste utilisateurs (admin).

---

## Prérequis

- Aucun pour `register` et `login`.
- **JWT** requis pour `profile`, `users`, `delete`.
- **Rôle ADMIN** pour `GET /auth/users` et `DELETE /auth/:id`.

---

## Endpoints

### 1. Inscription

| Élément | Valeur           |
| ------- | ---------------- |
| Méthode | `POST`           |
| URL     | `/auth/register` |
| Auth    | Non              |

**Body (JSON)** : `firstName`, `lastName`, `email`, `password` (min. 8 caractères), `role` (ADMIN | PROJECT_MANAGER | EMPLOYEE), `department` (IT | HR | FINANCE | MARKETING | SALES | OPERATIONS | ADMINISTRATION), optionnel : `jobTitle`, `avatar`.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Marie",
    "lastName": "Dupont",
    "email": "marie@example.com",
    "password": "MotDePasse123",
    "role": "EMPLOYEE",
    "department": "IT",
    "jobTitle": "Développeuse"
  }'
```

**À vérifier :** Statut 201, objet utilisateur (sans mot de passe) ou message de succès.

---

### 2. Connexion

| Élément | Valeur        |
| ------- | ------------- |
| Méthode | `POST`        |
| URL     | `/auth/login` |
| Auth    | Non           |

**Body (JSON)** : `email`, `password`.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "marie@example.com", "password": "MotDePasse123"}'
```

**À vérifier :** Statut 201, réponse avec `access_token` (JWT). À réutiliser dans `Authorization: Bearer <access_token>`.

---

### 3. Profil (utilisateur connecté)

| Élément | Valeur          |
| ------- | --------------- |
| Méthode | `GET`           |
| URL     | `/auth/profile` |
| Auth    | Oui (Bearer)    |

**Exemple curl :**

```bash
curl -s http://localhost:4000/auth/profile \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Profil complet de l’utilisateur (id, email, rôle, etc.).

---

### 4. Liste des utilisateurs (admin uniquement)

| Élément | Valeur                        |
| ------- | ----------------------------- |
| Méthode | `GET`                         |
| URL     | `/auth/users`                 |
| Auth    | Oui (Bearer) + rôle **ADMIN** |

**Exemple curl :**

```bash
curl -s http://localhost:4000/auth/users \
  -H "Authorization: Bearer JWT_ADMIN"
```

**À vérifier :** Tableau d’utilisateurs. Si non-admin : 403.

---

### 5. Supprimer un utilisateur (admin)

| Élément | Valeur                        |
| ------- | ----------------------------- |
| Méthode | `DELETE`                      |
| URL     | `/auth/:id`                   |
| Auth    | Oui (Bearer) + rôle **ADMIN** |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/auth/cuid_utilisateur \
  -H "Authorization: Bearer JWT_ADMIN"
```

**À vérifier :** 200/204 ou message de succès. 403 si non-admin.

---

### 6. Demande de réinitialisation mot de passe

| Élément | Valeur                         |
| ------- | ------------------------------ |
| Méthode | `POST`                         |
| URL     | `/auth/request-reset-password` |
| Auth    | Non                            |

**Body (JSON)** : `email` (string).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/auth/request-reset-password \
  -H "Content-Type: application/json" \
  -d '{"email": "marie@example.com"}'
```

**À vérifier :** Message indiquant qu’un email a été envoyé (si le service mail est configuré).

---

### 7. Vérifier le token de reset

| Élément | Valeur                                        |
| ------- | --------------------------------------------- |
| Méthode | `GET`                                         |
| URL     | `/auth/verify-reset-password-token?token=XXX` |
| Auth    | Non                                           |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/auth/verify-reset-password-token?token=VOTRE_TOKEN"
```

**À vérifier :** Message de validité du token ou erreur.

---

### 8. Réinitialiser le mot de passe

| Élément | Valeur                 |
| ------- | ---------------------- |
| Méthode | `POST`                 |
| URL     | `/auth/reset-password` |
| Auth    | Non                    |

**Body (JSON)** : `token`, `password` (nouveau mot de passe).

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token": "TOKEN_RECU", "password": "NouveauMotDePasse123"}'
```

**À vérifier :** Message de succès. Ensuite connexion possible avec le nouveau mot de passe.

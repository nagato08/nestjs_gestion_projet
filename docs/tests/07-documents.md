# Module Documents – Tests

Documents liés aux projets : création, versions, liste, commentaires.

---

## Prérequis

- **JWT** pour toutes les routes.
- **Membre du projet** pour accéder aux documents du projet.

---

## Endpoints

### 1. Créer un document

| Élément | Valeur       |
| ------- | ------------ |
| Méthode | `POST`       |
| URL     | `/documents` |
| Auth    | Oui          |

**Body (JSON)** : `name`, `projectId`, éventuellement métadonnées. (Upload de fichier : vérifier si multipart/form-data est utilisé.)

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/documents \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "Cahier des charges", "projectId": "PROJECT_ID"}'
```

**À vérifier :** Document créé avec `id`. Selon l’implémentation, une première version peut être créée via une autre route.

---

### 2. Ajouter une version à un document (Cloudinary)

| Élément | Valeur                    |
| ------- | ------------------------- |
| Méthode | `POST`                    |
| URL     | `/documents/:id/versions` |
| Auth    | Oui                       |

- **Content-Type** : `multipart/form-data`
- Champ de fichier : **`file`** (géré par `FileInterceptor('file', { storage: memoryStorage() })`)

**Exemple curl (upload vers Cloudinary via l’API) :**

```bash
curl -s -X POST http://localhost:4000/documents/DOC_ID/versions \
  -H "Authorization: Bearer VOTRE_JWT" \
  -F "file=@/chemin/vers/mon-fichier.pdf"
```

**À vérifier :**

- Réponse contenant une nouvelle `DocumentVersion` avec :
  - `version` (1, 2, 3, …),
  - `fileUrl` pointant vers une URL **Cloudinary** (`https://res.cloudinary.com/...`),
  - `document` (id, name).
- En appelant ensuite `GET /documents/DOC_ID/versions`, la dernière version doit apparaître avec ce `fileUrl`.

---

### 3. Documents d’un projet

| Élément | Valeur                          |
| ------- | ------------------------------- |
| Méthode | `GET`                           |
| URL     | `/documents/project/:projectId` |
| Auth    | Oui                             |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/documents/project/PROJECT_ID" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Liste des documents du projet.

---

### 4. Mes documents

| Élément | Valeur                    |
| ------- | ------------------------- |
| Méthode | `GET`                     |
| URL     | `/documents/my-documents` |
| Auth    | Oui                       |

**Exemple curl :**

```bash
curl -s http://localhost:4000/documents/my-documents \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Documents uploadés par l’utilisateur (ou auxquels il a accès).

---

### 5. Détail d’un document

| Élément | Valeur           |
| ------- | ---------------- |
| Méthode | `GET`            |
| URL     | `/documents/:id` |
| Auth    | Oui              |

**Exemple curl :**

```bash
curl -s http://localhost:4000/documents/DOC_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Détails du document. 403 si non membre du projet.

---

### 6. Mettre à jour un document

| Élément | Valeur           |
| ------- | ---------------- |
| Méthode | `PATCH`          |
| URL     | `/documents/:id` |
| Auth    | Oui              |

**Body (JSON)** : champs à modifier (ex. `name`).

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/documents/DOC_ID \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"name": "CDC v2"}'
```

**À vérifier :** Document mis à jour.

---

### 7. Supprimer un document

| Élément | Valeur           |
| ------- | ---------------- |
| Méthode | `DELETE`         |
| URL     | `/documents/:id` |
| Auth    | Oui              |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/documents/DOC_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Document supprimé.

---

### 8. Liste des versions d’un document

| Élément | Valeur                    |
| ------- | ------------------------- |
| Méthode | `GET`                     |
| URL     | `/documents/:id/versions` |
| Auth    | Oui                       |

**Exemple curl :**

```bash
curl -s http://localhost:4000/documents/DOC_ID/versions \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Tableau de versions (version, fileUrl, createdAt).

---

### 9. Détail d’une version

| Élément | Valeur                             |
| ------- | ---------------------------------- |
| Méthode | `GET`                              |
| URL     | `/documents/:id/versions/:version` |
| Auth    | Oui                                |

**Exemple curl :**

```bash
curl -s "http://localhost:4000/documents/DOC_ID/versions/1" \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Détails de la version.

---

### 10. Ajouter un commentaire sur un document

| Élément | Valeur                    |
| ------- | ------------------------- |
| Méthode | `POST`                    |
| URL     | `/documents/:id/comments` |
| Auth    | Oui                       |

**Body (JSON)** : `content`.

**Exemple curl :**

```bash
curl -s -X POST http://localhost:4000/documents/DOC_ID/comments \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"content": "À valider par le client"}'
```

**À vérifier :** Commentaire créé.

---

### 11. Supprimer un commentaire

| Élément | Valeur                           |
| ------- | -------------------------------- |
| Méthode | `DELETE`                         |
| URL     | `/documents/comments/:commentId` |
| Auth    | Oui                              |

**Exemple curl :**

```bash
curl -s -X DELETE http://localhost:4000/documents/comments/COMMENT_ID \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Commentaire supprimé.

# Module Company settings – Tests

Paramètres globaux de l’entreprise (mono-tenant) : nom, logo, couleur.

---

## Prérequis

- **JWT** pour les routes (vérifier dans le controller : lecture/écriture restreinte ou ouverte).
- Souvent réservé aux **ADMIN** pour la modification.

---

## Endpoints

### 1. Récupérer les paramètres

| Élément | Valeur                                          |
| ------- | ----------------------------------------------- |
| Méthode | `GET`                                           |
| URL     | `/company-settings` (vérifier le préfixe exact) |
| Auth    | Selon l’API (souvent oui)                       |

**Exemple curl :**

```bash
curl -s http://localhost:4000/company-settings \
  -H "Authorization: Bearer VOTRE_JWT"
```

**À vérifier :** Objet avec companyName, logoUrl, primaryColor, etc. (id souvent "global").

---

### 2. Mettre à jour les paramètres

| Élément | Valeur              |
| ------- | ------------------- |
| Méthode | `PATCH`             |
| URL     | `/company-settings` |
| Auth    | Oui (souvent ADMIN) |

**Body (JSON)** : champs à modifier (companyName, logoUrl, primaryColor). Vérifier `UpdateCompanySettingsDto`.

**Exemple curl :**

```bash
curl -s -X PATCH http://localhost:4000/company-settings \
  -H "Authorization: Bearer VOTRE_JWT" \
  -H "Content-Type: application/json" \
  -d '{"companyName": "Ma Société", "primaryColor": "#1976d2"}'
```

**À vérifier :** Paramètres mis à jour. 403 si rôle insuffisant.

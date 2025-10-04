# Guide d'utilisation de XIVAPI v2

> Cette documentation est basée sur les informations publiques de XIVAPI v2.
> Elle couvre les bases, les endpoints, les options de requête, les bonnes pratiques, les limitations, et des exemples.

---

## Table des matières

1. Introduction
2. Concepts clés

   * Sheets / contenu de jeu
   * Endpoints « runtime » (personnages, free companies, etc.)
   * Paramètres globaux
3. Endpoints principaux

   * /content (sheets)
   * /search
   * /lore
   * /character, /freecompany, /linkshell, /pvp_team
   * /servers
   * /patchlist
4. Paramètres et filtres utiles

   * `language`, `columns`, `snake_case`, `pretty`
   * Pagination
   * Filtres / opérateurs
   * Recherche avancée (Elasticsearch)
5. Gestion des erreurs
6. Limitations et notes importantes
7. Bonnes pratiques / recommandations
8. Exemples par langage

   * JavaScript / fetch
   * Python
   * PHP
9. Migration depuis v1
10. Ressources & liens utiles

---

## 1. Introduction

XIVAPI est une API REST qui expose les **données du client de jeu** de FFXIV (feuilles de données, « sheets ») et, en complément, des endpoints connectés au Lodestone pour les personnages, Free Companies, etc.

L'API est ouverte et accessible via HTTPS, sans authentification obligatoire. Elle permet d'accéder aux données du jeu et de construire des outils, overlays, ou bots autour de FFXIV.

---

## 2. Concepts clés

### Sheets / contenu de jeu

* Les «sheets» sont des tables extraites des fichiers du jeu (items, actions, quêtes, etc.).
* Chaque sheet contient des lignes identifiées par un ID et des champs (`Name_en`, `Icon`, `LevelItem`, etc.).
* Tu peux limiter les colonnes retournées via le paramètre `columns`.

### Endpoints runtime / Lodestone

* Utilisent les données du site Lodestone (personnages, free companies, etc.).
* Certains endpoints sont instables ou désactivés car ils reposent sur du scraping.

### Paramètres globaux

| Paramètre     | Description                                                                      |
| ------------- | -------------------------------------------------------------------------------- |
| `language`    | Langue de la réponse (`fr`, `en`, `ja`, `de`).                                   |
| `columns`     | Champs à inclure. Supporte la notation par points (ex: `ClassJobCategory.Name`). |
| `snake_case`  | Convertit les noms de champs en minuscules avec underscore.                      |
| `pretty`      | Formate le JSON pour le débogage.                                                |
| `private_key` | Clé API facultative.                                                             |

---

## 3. Endpoints principaux

### /content

* `GET /content` — liste les sheets disponibles.
* `GET /content/{sheetName}` — liste paginée des entrées.
* `GET /content/{sheetName}/{id}` — détails d'une entrée spécifique.

Exemple : `https://xivapi.com/item/1675?columns=Name,Icon&language=fr`

### /search

Permet de chercher à travers plusieurs sheets.

Paramètres :

* `string` : texte à chercher.
* `indexes` : ex. `Item,Action,Quest`.
* `filters` : ex. `LevelItem>=50`.
* `page`, `limit`, `sort_field`, `sort_order`.

### /lore

Recherche dans le contenu narratif (dialogues, descriptions). Fonctionne comme `/search`.

### /character, /freecompany, /linkshell, /pvp_team

Endpoints Lodestone : personnages, guildes, équipes PvP.
⚠️ Certains peuvent être inactifs en v2.

### /servers

* `GET /servers` — liste des serveurs.
* `GET /servers/dc` — data centers et régions.

### /patchlist

Liste des patchs de jeu et versions.
⚠️ Non toujours fiable.

---

## 4. Paramètres et filtres utiles

### Pagination

* `page` — numéro de page.
* `limit` — nombre d'éléments (max ~3000).
* Les réponses contiennent `page_next`, `page_prev`, `results_total`.

### Filtres / opérateurs

Syntaxe : `FieldName[op]Value` (ex: `LevelItem>=50`).

Opérateurs : `=`, `>`, `>=`, `<`, `<=`, `|=` (IN), `!` (existe), `!!` (n'existe pas).

### Recherche avancée (Elasticsearch)

Tu peux envoyer une requête JSON :

```json
{
  "indexes": "item,achievement",
  "body": {
    "query": {
      "bool": {
        "must": [ { "wildcard": { "NameCombined_en": "*aiming*" } } ],
        "filter": [ { "range": { "LevelItem": { "gte": "100" } } } ]
      }
    },
    "from": 0,
    "size": 10,
    "sort": [ { "LevelItem": "desc" } ]
  }
}
```

### Colonnes

Limiter les champs avec `columns=ID,Name,Icon` pour réduire la taille des réponses.

---

## 5. Gestion des erreurs

Format d'erreur :

```json
{
  "Error": true,
  "Subject": "XIVAPI Service Error",
  "Message": "...",
  "Hash": "...",
  "Ex": "ExceptionName"
}
```

Codes HTTP standard : 400, 404, 500, etc.

---

## 6. Limitations

* Endpoints Lodestone parfois désactivés.
* Rate limit par IP. Clé API conseillée.
* Données issues des fichiers de jeu : changement de structure possible à chaque patch.
* Patchlist non fiable.

---

## 7. Bonnes pratiques

* **Cache** les données statiques (items, actions...).
* Utilise `columns` pour limiter la taille des réponses.
* Gère le **rate limit** avec un système de retry.
* Protège ta clé API.
* Ne compte pas sur les endpoints Lodestone pour des besoins critiques.

---

## 8. Exemples

### JavaScript

```js
const BASE = 'https://xivapi.com';

async function getItem(itemId) {
  const url = `${BASE}/item/${itemId}?columns=ID,Name,Icon&language=fr`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.Error) throw new Error(data.Message);
  return data;
}

getItem(1675).then(console.log);
```

### Python

```py
import requests

BASE = 'https://xivapi.com'

def get_item(item_id, lang='fr'):
    params = {'columns': 'ID,Name,Icon', 'language': lang}
    data = requests.get(f'{BASE}/item/{item_id}', params=params).json()
    if data.get('Error'):
        raise Exception(data['Message'])
    return data

print(get_item(1675))
```

### PHP

```php
<?php
$base = 'https://xivapi.com';
function getItem($id, $lang='fr') {
  global $base;
  $json = file_get_contents("$base/item/$id?columns=ID,Name,Icon&language=$lang");
  $data = json_decode($json, true);
  if (!empty($data['Error'])) throw new Exception($data['Message']);
  return $data;
}
var_dump(getItem(1675));
?>
```

---

## 9. Migration depuis v1

* v2 n'est **pas compatible** avec v1.
* Plus de `GameContentLinks`.
* Nouvelle syntaxe pour `columns`.
* Endpoints Lodestone plus limités.

---

## 10. Ressources utiles

* Docs : [https://v2.xivapi.com/docs](https://v2.xivapi.com/docs)
* GitHub : [https://github.com/xivapi](https://github.com/xivapi)
* Discord communauté XIVAPI
* Librairies clientes : PHP, JS, Python, Ruby

---

## Migration effectuée dans ce projet

### Changements apportés :
- **API remplacée** : `cafemaker.wakingsands.com` → `https://xivapi.com`
- **Endpoints adaptés** : `/Quest` → `/quest` (minuscules)
- **Paramètres optimisés** : Utilisation de `columns` pour limiter les données
- **Support multilingue** : `language=fr` natif

### Compatibilité :
- Structure des données préservée (ID, Name, JournalGenre, etc.)
- Identification MSQ inchangée (basée sur JournalGenre.Name_en)
- Cache LevelDB vidé pour forcer rechargement avec nouvelles données

### Tests effectués :
- Récupération paginée des quêtes ✅
- Récupération détail quête spécifique ✅
- Structure JSON compatible ✅

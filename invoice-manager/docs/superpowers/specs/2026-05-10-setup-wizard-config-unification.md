# Plan — Setup Wizard & Unification config → DB

## Context

Actuellement, les données utilisateur (identité, profil fiscal, enseignes connues) sont stockées dans `config.toml`. La DB SQLite contient uniquement les factures. Résultat : double source de vérité, setup manuel du fichier TOML, pas d'interface pour gérer les enseignes.

Objectif : déplacer toutes les données utilisateur dans la DB, réduire `config.toml` aux seuls paramètres techniques (chemins, OCR), et ajouter :
- Un wizard de setup pas-à-pas bloquant (dashboard uniquement)
- Une page `/settings` avec 3 sections

## Décisions

| Sujet | Décision |
|---|---|
| Utilisateurs | Mono-utilisateur |
| Déclenchement wizard | Dashboard uniquement — premier lancement sur DB sans profil |
| Champs obligatoires wizard | SIREN + profil fiscal (minimum pour débloquer) |
| Champs optionnels | Nom, TVA intracom, cadence → accessibles dans /settings après |
| Bannière post-wizard | Oui — persistante jusqu'à profil complet |
| Settings UI | Page dédiée `/settings` avec sidebar 3 sections |
| known_emitters | Table DB + CRUD dans /settings |
| CLI sans profil | Exit 1 + message "Lance le dashboard d'abord" |
| config.toml | Garde uniquement : [extraction], [paths] |

## Ce qui migre

| Donnée | Avant | Après |
|---|---|---|
| identity.nom, siren, tva_intracom | config.toml | DB → table `user_profile` |
| fiscal.default_profile, cadence | config.toml | DB → table `user_profile` |
| known_emitters | config.toml | DB → table `known_emitters` |
| extraction.* (OCR, backend, seuil) | config.toml | reste config.toml |
| paths.* | config.toml | reste config.toml |

## Schéma DB (nouvelles tables)

```sql
-- Une seule ligne possible (contrainte id = 1)
CREATE TABLE IF NOT EXISTS user_profile (
    id                INTEGER PRIMARY KEY CHECK (id = 1),
    nom               TEXT DEFAULT '',
    siren             TEXT DEFAULT '',
    tva_intracom      TEXT DEFAULT '',
    fiscal_profile    TEXT DEFAULT 'auto-entrepreneur',
    cadence           TEXT DEFAULT '',
    setup_complete    INTEGER DEFAULT 0  -- 0 = wizard pas terminé
);

CREATE TABLE IF NOT EXISTS known_emitters (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword  TEXT UNIQUE NOT NULL,
    nom      TEXT NOT NULL
);
```

## Étapes d'implémentation

### 1. db.py — Schéma + helper
- Ajouter `user_profile` et `known_emitters` à `SCHEMA`
- Ajouter les migrations correspondantes dans `open_db()`
- Ajouter deux fonctions helpers :
  - `get_user_profile(conn) -> dict | None` — retourne la ligne ou None si absente / setup_complete=0
  - `get_known_emitters(conn) -> dict[str, str]` — retourne `{keyword: nom}`

### 2. config.py — Nettoyage
- Retirer `identity`, `fiscal`, `known_emitters` de `DEFAULT_CONFIG`
- Garder uniquement `extraction` et `paths`
- Mettre à jour `config.toml.example` en conséquence

### 3. extract.py — Lecture profil depuis DB
- Dans `run_extraction()` (actuellement ligne ~349) :
  - Ouvrir la DB avant de lire le profil
  - Appeler `get_user_profile(conn)` → si None : `print("Profil non configuré. Lance le dashboard : python dashboard.py")` + `sys.exit(1)`
  - Récupérer `siren` et `fiscal_profile` depuis le profil DB (au lieu de `cfg["identity"]["siren"]` et `cfg["fiscal"]["default_profile"]`)
  - Récupérer `known_emitters` via `get_known_emitters(conn)`

### 4. export.py — Lecture profil depuis DB
- Même pattern : ouvrir DB → `get_user_profile()` → exit 1 si absent
- Remplacer `cfg["fiscal"]["default_profile"]` par `profile["fiscal_profile"]`

### 5. run.py — Lecture profil depuis DB
- Idem : vérifier le profil avant de chaîner les étapes

### 6. dashboard.py — Wizard + Settings

#### a. Chargement profil
- Remplacer `cfg["identity"]` et `cfg["fiscal"]["default_profile"]` par une lecture DB au démarrage
- Passer `profile` (dict depuis `get_user_profile()`) aux templates

#### b. Middleware before_request
```python
@app.before_request
def require_setup():
    if request.endpoint in ("setup", "static"):
        return
    profile = get_user_profile(conn)
    if profile is None:
        return redirect(url_for("setup"))
```

#### c. Route `/setup` (GET + POST)
- GET : affiche l'étape courante du wizard (stockée en session Flask)
- POST : valide le champ, avance à l'étape suivante
- Étapes :
  1. SIREN (required, regex 9 chiffres)
  2. Profil fiscal (radio : auto-entrepreneur | SASU | SARL | salarié)
  - → `INSERT INTO user_profile (id, siren, fiscal_profile, setup_complete) VALUES (1, ?, ?, 1)`
- Après complétion : redirect `/`

#### d. Route `/settings` (GET)
- Sidebar avec 3 onglets : `profil` | `enseignes` | `app`
- Onglet `profil` : formulaire complet (nom, siren, tva_intracom, fiscal_profile, cadence)
- Onglet `enseignes` : table CRUD des known_emitters
- Onglet `app` : affichage read-only des paramètres config.toml (extraction.*)

#### e. Routes settings CRUD
- `POST /settings/profil` — UPDATE user_profile WHERE id=1
- `POST /settings/enseignes/add` — INSERT INTO known_emitters
- `POST /settings/enseignes/<id>/delete` — DELETE FROM known_emitters
- `POST /settings/enseignes/<id>/edit` — UPDATE known_emitters

#### f. Header dashboard.html
- L'entity badge (top-right) devient un lien `<a href="/settings">` avec icône ⚙

#### g. Bannière profil incomplet
- Si `profile["nom"] == '' or profile["tva_intracom"] == ''` → bannière top-of-page avec lien `/settings`

### 7. Templates
- `templates/setup.html` — wizard step-by-step (explication contextuelle sous chaque champ)
- `templates/settings.html` — page /settings avec sidebar 3 sections
- `templates/dashboard.html` — mettre à jour entity badge (lien settings) + bannière

### 8. Tests
- Mettre à jour `tests/conftest.py` : `tmp_db` doit avoir les nouvelles tables
- Mettre à jour les tests qui passaient `cfg["identity"]["siren"]` directement
- Ajouter tests pour `get_user_profile()` et `get_known_emitters()`

## Fichiers critiques

| Fichier | Modification |
|---|---|
| `db.py` | Schéma + migrations + helpers |
| `config.py` | Retirer identity/fiscal/known_emitters |
| `extract.py` | Lire profil depuis DB, exit 1 si absent |
| `export.py` | Lire fiscal_profile depuis DB |
| `run.py` | Vérifier profil avant pipeline |
| `dashboard.py` | Wizard + /settings + before_request |
| `templates/dashboard.html` | Entity badge + bannière |
| `templates/setup.html` | Nouveau — wizard |
| `templates/settings.html` | Nouveau — settings page |
| `config.toml.example` | Retirer identity/fiscal/known_emitters |
| `tests/conftest.py` | Mettre à jour fixtures |

## Fonctions existantes à réutiliser

- `open_db(path)` — `db.py:70` — à étendre, pas à remplacer
- `load_config(path)` — `config.py:52` — garde son rôle pour extraction/paths
- `CADENCE_DEFAULTS` — `config.py:41` — réutilisé dans le wizard pour suggestion auto
- `_confidence_score()` — `extract.py` — inchangée
- Middleware pattern Flask existant dans `create_app()` — `dashboard.py:175`

## Hors scope (cette itération)

- Migration automatique config.toml → DB (l'utilisateur re-saisit via le wizard)
- Multi-utilisateurs
- Édition des paramètres OCR depuis le dashboard (read-only dans /settings)

## Vérification

1. **DB vierge** : `python dashboard.py` → redirige vers `/setup` → wizard en 2 étapes → accès dashboard
2. **Bannière** : après wizard minimal, bannière visible, disparaît après complétion du profil dans /settings
3. **Settings** : modifier nom/TVA intracom depuis /settings → persisté en DB → visible dans le header
4. **Enseignes** : ajouter/supprimer une enseigne depuis /settings → `get_known_emitters()` retourne le bon dict
5. **CLI sans profil** : `python run.py` sur DB vierge → exit 1 + message lisible
6. **CLI avec profil** : pipeline tourne normalement, lit SIREN depuis DB
7. **Tests** : `python -m pytest tests/ -v` — tous verts

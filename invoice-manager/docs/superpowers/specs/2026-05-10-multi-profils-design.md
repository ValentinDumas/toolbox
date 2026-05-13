# Plan — Multi-profils & upload UI

> **Note (2026-05-13)** : les sections mentionnant `data/profiles.json`
> (registre JSON `PROFILES_FILE`, `save_profiles()`, etc.) sont **obsolètes**.
> Le registre a été supprimé en faveur d'une lecture 100% SQLite : `nom` et
> `created_at` vivent dans `user_profile` de chaque DB de profil, la liste
> des profils est dérivée du scan de `data/profiles/*/`. Voir
> `profiles.py:load_profiles` et `migrate_legacy_profiles_json`.

## Context

L'app gère aujourd'hui une seule entité légale (SIREN unique, `user_profile WHERE id=1`, `data/invoices.db` fixe). L'utilisateur veut gérer N entités légales (SASU, micro-entreprise, etc.) depuis la même installation, avec isolation complète des données. L'ajout de documents se fait actuellement en déposant des fichiers dans `input/` puis en lançant `run.py` en CLI. L'objectif est de remplacer ce flux par un bouton upload dans le dashboard, multi-fichiers, déclenché par l'utilisateur actif.

Décisions architecturales validées lors du brainstorming :
- **Option A** : une DB SQLite par profil (`data/profiles/{slug}/invoices.db`)
- Profil actif stocké en session Flask (`session["active_profile"]`)
- Upload dans le header (action primaire visible)
- Sélecteur de profil dans le header avec dropdown + "＋ Nouveau profil"

---

## Architecture cible

```
data/
  profiles.json              ← registre {slug, name, created_at}[]
  profiles/
    sasu-dupont/
      invoices.db
      processed/
      errors/
      output/
    micro-perso/
      invoices.db
      processed/
      errors/
      output/
```

Pas de DB globale. `data/invoices.db` existant → migré vers `data/profiles/{slug}/` au premier démarrage.

---

## Fichiers critiques à modifier

| Fichier | Rôle des modifications |
|---------|----------------------|
| `profiles.py` (nouveau) | Registre JSON : CRUD profils, resolve_paths(slug) |
| `config.py` | Supprimer chemins hardcodés ; déléguer à profiles.py |
| `dashboard.py` | Session active_profile, routes /profiles, /upload, open_db dynamique |
| `templates/dashboard.html` | Header : profile switcher + bouton upload |
| `templates/dashboard.html` | Modal création de profil (inline, pas de page séparée) |
| `run.py` | Arg `--profile` pour CLI |
| `extract.py` | Arg `--profile` pour CLI |

---

## Étapes d'implémentation

### 1. `profiles.py` — Registre des profils (nouveau fichier)

```python
# profiles.py
PROFILES_FILE = Path("data/profiles.json")

def load_profiles() -> list[dict]        # [{slug, name, created_at}]
def save_profiles(profiles: list[dict])
def get_profile(slug: str) -> dict|None
def create_profile(name: str) -> dict    # génère slug, crée répertoire, retourne profil
def resolve_paths(slug: str) -> dict     # retourne dict paths (db, processed, errors, output)
```

`resolve_paths(slug)` retourne :
```python
{
    "db":        Path(f"data/profiles/{slug}/invoices.db"),
    "input":     Path(f"data/profiles/{slug}/input/"),      # upload dépose ici
    "processed": Path(f"data/profiles/{slug}/processed/"),  # extract.py déplace ici
    "errors":    Path(f"data/profiles/{slug}/errors/"),
    "output":    Path(f"data/profiles/{slug}/output/"),
}
```

### 2. `dashboard.py` — Adaptations session & routes

**a) Session active_profile**

Remplacer le `db_path` fixe (actuellement résolu depuis `config.toml`) par une fonction :

```python
def _active_slug() -> str | None:
    return session.get("active_profile")

def _active_paths() -> dict | None:
    slug = _active_slug()
    if not slug:
        return None
    return resolve_paths(slug)   # from profiles.py
```

`_get_profile()` et tous les `open_db(db_path)` deviennent `open_db(paths["db"])`.

**b) `require_setup()` étendu**

```python
@app.before_request
def require_setup():
    exempt = ("setup", "static", "profiles_create", "profiles_switch", "profiles_list")
    if request.endpoint in exempt:
        return
    if not _active_slug() or not load_profiles():
        return redirect(url_for("profiles_list"))   # page d'accueil si aucun profil
    if _get_profile() is None:
        return redirect(url_for("setup"))           # setup wizard pour ce profil
```

**c) Nouvelles routes**

```
GET  /profiles             → liste des profils (ou redirect si 1 seul existe)
POST /profiles/create      → crée un profil (name → slug), bascule session, redirect setup
POST /profiles/switch/<slug> → change session["active_profile"], redirect /
GET  /upload               → page upload (ou modal)
POST /upload               → reçoit N fichiers, sauvegarde dans processed/, lance extraction
```

**d) Route `/run` adaptée**

Passer le slug en argument au subprocess :
```python
subprocess.run(["python", "run.py", "--profile", slug, ...])
```

**e) Route `/upload` (nouvelle)**

```python
@app.route("/upload", methods=["POST"])
def upload():
    slug = _active_slug()
    paths = resolve_paths(slug)
    paths["processed"].mkdir(parents=True, exist_ok=True)
    files = request.files.getlist("files")
    saved = []
    for f in files:
        dest = paths["input"] / f.filename
        f.save(dest)
        saved.append(f.filename)
    # Lancer extraction en arrière-plan (thread) : lit input/, déplace vers processed/
    threading.Thread(target=_run_extraction, args=(slug,), daemon=True).start()
    return jsonify({"status": "ok", "files": saved, "count": len(saved)})
```

### 3. `templates/dashboard.html` — Header

Ajouter dans le header (à droite, avant le filtre année) :

```html
<!-- Sélecteur de profil -->
<div class="profile-switcher">
  <button id="profile-btn" aria-haspopup="true" aria-expanded="false">
    <span class="dot active"></span>
    {{ active_profile.nom }}
    <span aria-hidden="true">▾</span>
  </button>
  <ul role="menu" id="profile-menu" hidden>
    {% for p in all_profiles %}
    <li role="menuitem">
      <form method="post" action="/profiles/switch/{{ p.slug }}">
        <button type="submit" {% if p.slug == active_slug %}aria-current="true"{% endif %}>
          {{ p.name }}
        </button>
      </form>
    </li>
    {% endfor %}
    <li role="separator"></li>
    <li role="menuitem">
      <button type="button" onclick="openCreateProfileModal()">＋ Nouveau profil</button>
    </li>
  </ul>
</div>

<!-- Bouton upload -->
<button type="button" onclick="openUploadModal()" aria-label="Importer des fichiers">
  <svg><!-- upload icon --></svg> Importer
</button>
```

Modal upload : `<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg">` + barre de progression JS (fetch POST vers `/upload`).

Modal création profil : formulaire inline (nom + SIREN + profil fiscal) POST vers `/profiles/create`.

### 4. Migration de l'existant

Script de migration exécuté au démarrage de `dashboard.py` :

```python
def _maybe_migrate_legacy_db():
    legacy = Path("data/invoices.db")
    profiles_file = Path("data/profiles.json")
    if legacy.exists() and not profiles_file.exists():
        # Afficher page de migration : "Nommez votre première entité"
        # Ou : créer un profil "Par défaut" automatiquement
        default_slug = "entreprise-principale"
        dest_dir = Path(f"data/profiles/{default_slug}")
        dest_dir.mkdir(parents=True, exist_ok=True)
        shutil.move(str(legacy), str(dest_dir / "invoices.db"))
        save_profiles([{"slug": default_slug, "name": "Entreprise principale", "created_at": ...}])
```

Migration automatique silencieuse (pas d'écran intermédiaire, profil nommé "Entreprise principale" — renommable dans /settings).

### 5. CLI — `run.py` et `extract.py`

Ajouter `--profile slug` :
```python
parser.add_argument("--profile", type=str, default=None, help="Slug du profil")
```

Si `--profile` fourni : `cfg["paths"] = resolve_paths(slug)` depuis `profiles.py`.
Si absent : comportement actuel (rétrocompatible).

---

## Fonctions existantes réutilisées sans changement

- `db.open_db(path)` — aucun changement, juste un chemin différent
- `db.get_user_profile(conn)` — aucun changement (`id=1` reste valide par DB)
- `db.get_extraction_cfg(conn)` — idem
- `config.load_config()` — conservé pour les options OCR/extraction (non liées aux paths)
- Setup wizard (`/setup`, `templates/setup.html`) — réutilisé tel quel pour chaque nouveau profil

---

## Vérification end-to-end

1. `python dashboard.py` → si `data/invoices.db` existe : migré automatiquement, session active sur "Entreprise principale"
2. Ouvrir `http://localhost:7800` → header affiche le nom de l'entité active avec dropdown
3. Dropdown → "＋ Nouveau profil" → modal → saisir nom + SIREN + fiscal → POST → setup wizard → retour dashboard avec nouveau profil actif
4. Header → "⬆ Importer" → sélectionner 3 PDF → upload → barre de progression → extraction → tableau mis à jour
5. Dropdown → changer de profil → données du dashboard changent (différent `invoices.db`)
6. `python run.py --profile sasu-dupont` → pipeline CLI sur ce profil
7. `python -m pytest tests/ -v` → tests existants passent (rétrocompatibilité assurée par `--profile` optionnel)

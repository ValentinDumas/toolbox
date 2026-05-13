"""
profiles.py — Registre multi-profils (entités légales distinctes).

Chaque profil = un répertoire autonome sous data/profiles/{slug}/ avec
sa propre invoices.db. La liste des profils se déduit par scan du
système de fichiers ; les métadonnées (`nom`, `created_at`) sont
portées par la table `user_profile` de chaque DB.
"""
import re
import shutil
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
PROFILES_DIR = HERE / "data" / "profiles"
LEGACY_DB = HERE / "data" / "invoices.db"


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    for src, dst in [("àáâãäå", "a"), ("èéêë", "e"), ("ìíîï", "i"),
                     ("òóôõö", "o"), ("ùúûü", "u"), ("ç", "c"), ("ñ", "n")]:
        for ch in src:
            slug = slug.replace(ch, dst)
    slug = re.sub(r"[^a-z0-9]+", "-", slug).strip("-")
    return slug or "profil"


def _read_profile_meta(slug: str, db_path: Path) -> dict | None:
    """Ouvre la DB d'un profil et lit (nom, created_at). Retourne None si
    illisible. Tolère l'absence de la ligne `user_profile.id=1` (profil en
    cours d'onboarding) en retombant sur le slug pour le nom."""
    if not db_path.is_file():
        return None
    try:
        # Connexion read-only pour éviter de déclencher des migrations sur un
        # simple scan de découverte. Si la DB est trop ancienne (colonne
        # `created_at` absente), on retombe sur des valeurs par défaut.
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
        try:
            row = conn.execute(
                "SELECT nom, created_at FROM user_profile WHERE id=1"
            ).fetchone()
        except sqlite3.OperationalError:
            row = None
        conn.close()
    except sqlite3.DatabaseError:
        return None
    name = (row["nom"] if row and row["nom"] else "").strip() or slug
    created_at = (row["created_at"] if row and "created_at" in row.keys() else None) or ""
    return {"slug": slug, "name": name, "created_at": created_at}


def _scan_profiles() -> list[dict]:
    if not PROFILES_DIR.exists():
        return []
    found: list[dict] = []
    for entry in PROFILES_DIR.iterdir():
        if not entry.is_dir():
            continue
        meta = _read_profile_meta(entry.name, entry / "invoices.db")
        if meta is None:
            continue
        found.append(meta)
    # Tri stable : created_at ASC (vides en queue), puis slug pour la stabilité.
    found.sort(key=lambda p: (p["created_at"] == "", p["created_at"], p["slug"]))
    return found


def load_profiles() -> list[dict]:
    """Découvre les profils via le filesystem. Cache par requête Flask si
    un contexte est actif, lecture directe sinon (CLI)."""
    try:
        from flask import g, has_app_context
    except ImportError:
        return _scan_profiles()
    if has_app_context():
        cache = getattr(g, "_profiles_cache", None)
        if cache is None:
            cache = _scan_profiles()
            g._profiles_cache = cache
        return list(cache)
    return _scan_profiles()


def _invalidate_cache() -> None:
    """À appeler après toute mutation (create_profile, migration)."""
    try:
        from flask import g, has_app_context
        if has_app_context() and hasattr(g, "_profiles_cache"):
            del g._profiles_cache
    except ImportError:
        pass


def get_profile_meta(slug: str) -> dict | None:
    return next((p for p in load_profiles() if p["slug"] == slug), None)


def create_profile(name: str) -> dict:
    """Crée un nouveau profil : répertoire + sous-dossiers + initialisation
    de la DB avec `user_profile.nom` et `user_profile.created_at` peuplés."""
    from db import open_db

    existing = {p["slug"] for p in _scan_profiles()}
    base_slug = _slugify(name)
    slug = base_slug
    counter = 2
    while slug in existing or (PROFILES_DIR / slug).exists():
        slug = f"{base_slug}-{counter}"
        counter += 1

    profile_dir = PROFILES_DIR / slug
    for subdir in ("input", "processed", "errors", "duplicates", "output", "review"):
        (profile_dir / subdir).mkdir(parents=True, exist_ok=True)

    created_at = datetime.now(timezone.utc).isoformat()
    conn = open_db(profile_dir / "invoices.db")
    conn.execute(
        "INSERT INTO user_profile (id, nom, created_at) VALUES (1, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET "
        "nom=excluded.nom, created_at=excluded.created_at",
        (name, created_at),
    )
    conn.commit()
    conn.close()

    _invalidate_cache()
    return {"slug": slug, "name": name, "created_at": created_at}


def maybe_migrate_legacy() -> str | None:
    """Migre l'ancienne DB mono-profil `data/invoices.db` vers un profil
    « Entreprise principale ». No-op si aucun héritage à migrer."""
    if not LEGACY_DB.exists():
        return None
    if PROFILES_DIR.exists() and any(PROFILES_DIR.iterdir()):
        return None
    entry = create_profile("Entreprise principale")
    dest = PROFILES_DIR / entry["slug"] / "invoices.db"
    # Le `create_profile` a déjà créé une DB vide ; on remplace par la legacy.
    dest.unlink(missing_ok=True)
    shutil.move(str(LEGACY_DB), str(dest))
    # Réinjecte le nom + created_at dans la DB déplacée (la legacy n'a pas
    # encore ces métadonnées).
    from db import open_db
    conn = open_db(dest)
    conn.execute(
        "INSERT INTO user_profile (id, nom, created_at) VALUES (1, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET "
        "nom=COALESCE(NULLIF(user_profile.nom,''), excluded.nom), "
        "created_at=COALESCE(user_profile.created_at, excluded.created_at)",
        (entry["name"], entry["created_at"]),
    )
    conn.commit()
    conn.close()
    migrate_legacy_files(entry["slug"])
    _invalidate_cache()
    return entry["slug"]


def resolve_paths(slug: str) -> dict[str, Path]:
    """Retourne les chemins absolus pour un profil donné."""
    base = PROFILES_DIR / slug
    return {
        "db":         base / "invoices.db",
        "input":      base / "input",
        "processed":  base / "processed",
        "errors":     base / "errors",
        "duplicates": base / "duplicates",
        "output":     base / "output",
        "review":     base / "review",
    }


def migrate_legacy_files(slug: str) -> dict[str, int]:
    """
    Déplace les fichiers des dossiers legacy (processed/, errors/, input/) vers
    le dossier du profil. Idempotent — ignore les fichiers déjà présents.
    Retourne le nombre de fichiers déplacés par dossier.
    """
    counts: dict[str, int] = {}
    for subdir in ("processed", "errors", "input"):
        src_dir = HERE / subdir
        dst_dir = PROFILES_DIR / slug / subdir
        if not src_dir.exists():
            continue
        dst_dir.mkdir(parents=True, exist_ok=True)
        moved = 0
        for f in src_dir.iterdir():
            if not f.is_file():
                continue
            dst = dst_dir / f.name
            if dst.exists():
                continue
            shutil.move(str(f), dst)
            moved += 1
        counts[subdir] = moved
    return counts

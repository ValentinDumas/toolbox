"""
profiles.py — Registre multi-profils (entités légales distinctes).

Chaque profil = un répertoire autonome sous data/profiles/{slug}/ avec
sa propre invoices.db. Le registre est un fichier JSON léger.
"""
import json
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).parent
PROFILES_FILE = HERE / "data" / "profiles.json"
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


def load_profiles() -> list[dict]:
    if not PROFILES_FILE.exists():
        return []
    try:
        return json.loads(PROFILES_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def save_profiles(profiles: list[dict]) -> None:
    PROFILES_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROFILES_FILE.write_text(
        json.dumps(profiles, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def get_profile_meta(slug: str) -> dict | None:
    return next((p for p in load_profiles() if p["slug"] == slug), None)


def create_profile(name: str) -> dict:
    """Crée un nouveau profil : répertoire + sous-dossiers + entrée dans le registre."""
    profiles = load_profiles()
    base_slug = _slugify(name)
    slug = base_slug
    existing = {p["slug"] for p in profiles}
    counter = 2
    while slug in existing:
        slug = f"{base_slug}-{counter}"
        counter += 1

    profile_dir = PROFILES_DIR / slug
    for subdir in ("input", "processed", "errors", "output", "review"):
        (profile_dir / subdir).mkdir(parents=True, exist_ok=True)

    entry = {
        "slug": slug,
        "name": name,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    profiles.append(entry)
    save_profiles(profiles)
    return entry


def resolve_paths(slug: str) -> dict[str, Path]:
    """Retourne les chemins absolus pour un profil donné."""
    base = PROFILES_DIR / slug
    return {
        "db":        base / "invoices.db",
        "input":     base / "input",
        "processed": base / "processed",
        "errors":    base / "errors",
        "output":    base / "output",
        "review":    base / "review",
    }


def maybe_migrate_legacy() -> str | None:
    """
    Si data/invoices.db existe et aucun profil n'est créé, migre automatiquement
    vers un profil 'Entreprise principale'. Retourne le slug créé, ou None.
    """
    if PROFILES_FILE.exists() or not LEGACY_DB.exists():
        return None
    entry = create_profile("Entreprise principale")
    dest = PROFILES_DIR / entry["slug"] / "invoices.db"
    shutil.move(str(LEGACY_DB), str(dest))
    return entry["slug"]

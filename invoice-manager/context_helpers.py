"""
context_helpers.py — Helpers de contexte de requête partagés par tous les blueprints.

Lit le profil actif depuis la session Flask et résout les chemins/DB associés.
"""
from pathlib import Path

from flask import session

from db import get_user_profile, open_db
from profiles import get_profile_meta, resolve_paths


def active_slug() -> str | None:
    return session.get("active_profile")


def active_paths() -> dict | None:
    slug = active_slug()
    return resolve_paths(slug) if slug else None


def active_db() -> Path | None:
    paths = active_paths()
    return paths["db"] if paths else None


def get_profile() -> dict | None:
    db = active_db()
    if db is None:
        return None
    conn = open_db(db)
    profile = get_user_profile(conn)
    conn.close()
    return profile

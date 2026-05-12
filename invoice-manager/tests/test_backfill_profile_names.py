"""
Tests BDD — Migration idempotente du nom d'entité (#67).

Les profils créés avant le correctif b072529 (#63) ont `user_profile.nom`
vide dans leur DB, alors que le registre `data/profiles.json` porte la
bonne valeur. Le boot du dashboard doit reconstituer le nom depuis le
registre, sans jamais écraser une saisie utilisateur.
"""
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from db import open_db


def _seed_profil_legacy(tmp_path, monkeypatch, *, slug: str, registry_name: str,
                       db_nom: str | None) -> Path:
    """
    Met en place un faux workspace : registre profiles.json + DB de profil.
    `db_nom=None` simule l'état legacy (colonne `nom` vide).
    """
    profiles_file = tmp_path / "data" / "profiles.json"
    profiles_dir = tmp_path / "data" / "profiles"
    profiles_file.parent.mkdir(parents=True, exist_ok=True)

    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "PROFILES_FILE", profiles_file)
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", profiles_dir)

    profiles_file.write_text(
        json.dumps([{"slug": slug, "name": registry_name,
                     "created_at": "2026-01-01T00:00:00+00:00"}]),
        encoding="utf-8",
    )

    db_path = profiles_dir / slug / "invoices.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = open_db(db_path)
    if db_nom is None:
        # État legacy reproduit : ligne user_profile inexistante.
        pass
    else:
        conn.execute(
            "INSERT INTO user_profile (id, nom) VALUES (1, ?) "
            "ON CONFLICT(id) DO UPDATE SET nom=excluded.nom",
            (db_nom,),
        )
        conn.commit()
    conn.close()
    return db_path


def _lire_nom(db_path: Path) -> str:
    conn = open_db(db_path)
    row = conn.execute("SELECT nom FROM user_profile WHERE id=1").fetchone()
    conn.close()
    return (row["nom"] if row and row["nom"] is not None else "")


def test_profil_legacy_sans_nom_recupere_le_nom_du_registre(tmp_path, monkeypatch):
    # Given un profil créé avant #63 : registre porte le nom, DB a `nom` vide
    db_path = _seed_profil_legacy(
        tmp_path, monkeypatch,
        slug="entreprise-principale",
        registry_name="Shodo Studio",
        db_nom=None,
    )
    assert _lire_nom(db_path) == ""

    # When le boot lance la migration idempotente
    from profiles import backfill_profile_names_from_registry
    updated = backfill_profile_names_from_registry()

    # Then la DB du profil porte désormais le nom du registre
    assert updated == {"entreprise-principale": "Shodo Studio"}
    assert _lire_nom(db_path) == "Shodo Studio"


def test_profil_avec_nom_saisi_manuellement_n_est_pas_ecrase(tmp_path, monkeypatch):
    # Given un profil dont l'utilisateur a déjà saisi un nom dans Paramètres
    db_path = _seed_profil_legacy(
        tmp_path, monkeypatch,
        slug="acme",
        registry_name="Ancien nom registre",
        db_nom="Nom choisi par l'utilisateur",
    )

    # When la migration tourne (par exemple à un boot ultérieur)
    from profiles import backfill_profile_names_from_registry
    updated = backfill_profile_names_from_registry()

    # Then le nom saisi est préservé, aucune écriture n'est faite
    assert updated == {}
    assert _lire_nom(db_path) == "Nom choisi par l'utilisateur"


def test_migration_est_idempotente_sur_deux_boots_successifs(tmp_path, monkeypatch):
    # Given un profil legacy
    db_path = _seed_profil_legacy(
        tmp_path, monkeypatch,
        slug="entreprise-principale",
        registry_name="Shodo Studio",
        db_nom=None,
    )

    # When la migration tourne deux fois (deux boots du dashboard)
    from profiles import backfill_profile_names_from_registry
    first = backfill_profile_names_from_registry()
    second = backfill_profile_names_from_registry()

    # Then seul le premier boot écrit ; le second est un no-op
    assert first == {"entreprise-principale": "Shodo Studio"}
    assert second == {}
    assert _lire_nom(db_path) == "Shodo Studio"

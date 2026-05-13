"""
Tests BDD — Découverte des profils par scan du système de fichiers.

À partir de 2026-05-13, la liste des profils est dérivée des dossiers
sous `data/profiles/`, avec `nom` et `created_at` lus dans la table
`user_profile` de chaque DB. Aucun registre JSON n'est consulté.
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db import open_db


def _seed_profile(profiles_dir: Path, slug: str, *,
                  nom: str = "", created_at: str | None = None) -> Path:
    """Crée le dossier d'un profil + sa DB avec une ligne `user_profile`."""
    db_path = profiles_dir / slug / "invoices.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = open_db(db_path)
    conn.execute(
        "INSERT INTO user_profile (id, nom, created_at) VALUES (1, ?, ?) "
        "ON CONFLICT(id) DO UPDATE SET "
        "nom=excluded.nom, created_at=excluded.created_at",
        (nom, created_at),
    )
    conn.commit()
    conn.close()
    return db_path


def test_load_profiles_découvre_les_profils_via_le_filesystem(
    tmp_path, monkeypatch,
):
    # Given deux dossiers de profil avec leur DB initialisée
    profiles_dir = tmp_path / "data" / "profiles"
    _seed_profile(profiles_dir, "acme",
                  nom="ACME SARL", created_at="2026-01-15T00:00:00+00:00")
    _seed_profile(profiles_dir, "shodo",
                  nom="Shodo Studio", created_at="2026-02-01T00:00:00+00:00")

    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", profiles_dir)
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY",
                        tmp_path / "data" / "profiles.json")

    # When on liste les profils
    found = profiles_mod.load_profiles()

    # Then les deux profils remontent avec leurs métadonnées (tri created_at ASC)
    assert [p["slug"] for p in found] == ["acme", "shodo"]
    assert [p["name"] for p in found] == ["ACME SARL", "Shodo Studio"]
    assert found[0]["created_at"] == "2026-01-15T00:00:00+00:00"


def test_load_profiles_sans_dossier_retourne_vide(tmp_path, monkeypatch):
    # Given un workspace sans dossier `data/profiles`
    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR",
                        tmp_path / "data" / "profiles")
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY",
                        tmp_path / "data" / "profiles.json")

    # When on liste les profils
    found = profiles_mod.load_profiles()

    # Then la liste est vide (cas installation neuve, déclenche le wizard)
    assert found == []


def test_profil_avec_db_sans_nom_retombe_sur_le_slug(tmp_path, monkeypatch):
    # Given un profil dont la DB n'a pas encore `nom` renseigné
    profiles_dir = tmp_path / "data" / "profiles"
    _seed_profile(profiles_dir, "premier-profil", nom="")

    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", profiles_dir)
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY",
                        tmp_path / "data" / "profiles.json")

    # When on lit la métadonnée
    meta = profiles_mod.get_profile_meta("premier-profil")

    # Then le nom fallback est le slug (jamais de string vide affichée
    # dans le sélecteur de profils)
    assert meta is not None
    assert meta["name"] == "premier-profil"


def test_create_profile_persiste_nom_et_created_at_en_db(tmp_path, monkeypatch):
    # Given un workspace vide
    profiles_dir = tmp_path / "data" / "profiles"

    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", profiles_dir)
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY",
                        tmp_path / "data" / "profiles.json")

    # When on crée un profil
    entry = profiles_mod.create_profile("SASU Dupont")

    # Then les métadonnées sont écrites en DB, pas en JSON
    assert entry["slug"] == "sasu-dupont"
    assert entry["name"] == "SASU Dupont"
    assert entry["created_at"]  # ISO 8601 non vide

    db_path = profiles_dir / "sasu-dupont" / "invoices.db"
    assert db_path.exists()

    conn = open_db(db_path)
    row = conn.execute(
        "SELECT nom, created_at FROM user_profile WHERE id=1"
    ).fetchone()
    conn.close()
    assert row["nom"] == "SASU Dupont"
    assert row["created_at"] == entry["created_at"]

    # Aucun registre JSON n'a été créé
    assert not (tmp_path / "data" / "profiles.json").exists()


def test_create_profile_evite_les_collisions_de_slug(tmp_path, monkeypatch):
    # Given un profil existant dont le slug serait pris par défaut
    profiles_dir = tmp_path / "data" / "profiles"

    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", profiles_dir)
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY",
                        tmp_path / "data" / "profiles.json")

    profiles_mod.create_profile("Acme")

    # When on en crée un second avec le même nom
    second = profiles_mod.create_profile("Acme")

    # Then le second reçoit un slug numéroté pour éviter l'écrasement
    assert second["slug"] == "acme-2"

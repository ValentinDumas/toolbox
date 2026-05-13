"""
Tests BDD — Migration du registre legacy `data/profiles.json` vers la DB.

À partir de 2026-05-13 le registre JSON est supprimé : `nom` et
`created_at` vivent désormais dans `user_profile`. Le boot migre une
seule fois le contenu du JSON, sans jamais écraser un nom déjà saisi,
puis renomme le fichier en `.bak` (rollback possible).
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db import open_db


def _seed_profil_legacy(tmp_path, monkeypatch, *, slug: str,
                        registry_name: str, db_nom: str | None,
                        registry_created_at: str = "2026-01-01T00:00:00+00:00",
                        db_created_at: str | None = None) -> Path:
    """Met en place un faux workspace : registre profiles.json + DB de profil.

    `db_nom=None` simule l'état legacy (ligne `user_profile` inexistante).
    """
    legacy_registry = tmp_path / "data" / "profiles.json"
    profiles_dir = tmp_path / "data" / "profiles"
    legacy_registry.parent.mkdir(parents=True, exist_ok=True)

    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY", legacy_registry)
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", profiles_dir)

    legacy_registry.write_text(
        json.dumps([{"slug": slug, "name": registry_name,
                     "created_at": registry_created_at}]),
        encoding="utf-8",
    )

    db_path = profiles_dir / slug / "invoices.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = open_db(db_path)
    if db_nom is not None or db_created_at is not None:
        conn.execute(
            "INSERT INTO user_profile (id, nom, created_at) VALUES (1, ?, ?) "
            "ON CONFLICT(id) DO UPDATE SET "
            "nom=excluded.nom, created_at=excluded.created_at",
            (db_nom or "", db_created_at),
        )
        conn.commit()
    conn.close()
    return db_path


def _lire_nom(db_path: Path) -> str:
    conn = open_db(db_path)
    row = conn.execute("SELECT nom FROM user_profile WHERE id=1").fetchone()
    conn.close()
    return (row["nom"] if row and row["nom"] is not None else "")


def _lire_created_at(db_path: Path) -> str:
    conn = open_db(db_path)
    row = conn.execute(
        "SELECT created_at FROM user_profile WHERE id=1"
    ).fetchone()
    conn.close()
    return (row["created_at"] if row and row["created_at"] is not None else "")


def test_profil_legacy_sans_nom_recupere_le_nom_du_registre(tmp_path, monkeypatch):
    # Given un profil dont la DB n'a pas encore de nom, mais que le registre
    # JSON portait depuis le précédent multi-profil
    db_path = _seed_profil_legacy(
        tmp_path, monkeypatch,
        slug="entreprise-principale",
        registry_name="Shodo Studio",
        db_nom=None,
    )
    assert _lire_nom(db_path) == ""

    # When le boot lance la migration JSON → DB
    from profiles import migrate_legacy_profiles_json
    updated = migrate_legacy_profiles_json()

    # Then la DB porte désormais le nom et la date de création du registre
    assert updated == {"entreprise-principale": "Shodo Studio"}
    assert _lire_nom(db_path) == "Shodo Studio"
    assert _lire_created_at(db_path) == "2026-01-01T00:00:00+00:00"


def test_profil_avec_nom_saisi_manuellement_n_est_pas_ecrase(tmp_path, monkeypatch):
    # Given un profil dont l'utilisateur a déjà saisi un nom dans Paramètres
    db_path = _seed_profil_legacy(
        tmp_path, monkeypatch,
        slug="acme",
        registry_name="Ancien nom registre",
        db_nom="Nom choisi par l'utilisateur",
    )

    # When la migration tourne
    from profiles import migrate_legacy_profiles_json
    updated = migrate_legacy_profiles_json()

    # Then le nom saisi est préservé ; aucune mise à jour de nom n'est signalée
    assert updated == {}
    assert _lire_nom(db_path) == "Nom choisi par l'utilisateur"


def test_migration_renomme_le_json_pour_ne_plus_tourner(tmp_path, monkeypatch):
    # Given un profil legacy avec un registre présent
    _seed_profil_legacy(
        tmp_path, monkeypatch,
        slug="entreprise-principale",
        registry_name="Shodo Studio",
        db_nom=None,
    )

    # When la migration tourne deux fois (deux boots du dashboard)
    import profiles as profiles_mod
    first = profiles_mod.migrate_legacy_profiles_json()
    second = profiles_mod.migrate_legacy_profiles_json()

    # Then le premier boot importe, le second voit le JSON renommé en .bak
    # et devient un no-op : pas d'écriture, pas d'effet de bord.
    assert first == {"entreprise-principale": "Shodo Studio"}
    assert second == {}
    assert not profiles_mod.LEGACY_REGISTRY.exists()
    # La sauvegarde `.bak` est conservée pour rollback éventuel.
    backups = list(profiles_mod.LEGACY_REGISTRY.parent.glob("profiles.json.migrated-*.bak"))
    assert len(backups) == 1


def test_registre_absent_est_un_noop(tmp_path, monkeypatch):
    # Given un workspace sans registre legacy (cas nominal après migration,
    # ou installation neuve)
    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY", tmp_path / "data" / "profiles.json")
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", tmp_path / "data" / "profiles")

    # When la migration tourne
    from profiles import migrate_legacy_profiles_json
    updated = migrate_legacy_profiles_json()

    # Then aucune action, retour vide
    assert updated == {}


def test_profil_orphelin_dans_le_registre_est_ignoré(tmp_path, monkeypatch):
    # Given un registre qui référence un slug sans dossier associé sur disque
    legacy_registry = tmp_path / "data" / "profiles.json"
    profiles_dir = tmp_path / "data" / "profiles"
    legacy_registry.parent.mkdir(parents=True, exist_ok=True)
    profiles_dir.mkdir(parents=True, exist_ok=True)
    legacy_registry.write_text(
        json.dumps([{"slug": "fantome", "name": "Ghost",
                     "created_at": "2026-01-01T00:00:00+00:00"}]),
        encoding="utf-8",
    )
    import profiles as profiles_mod
    monkeypatch.setattr(profiles_mod, "LEGACY_REGISTRY", legacy_registry)
    monkeypatch.setattr(profiles_mod, "PROFILES_DIR", profiles_dir)

    # When la migration tourne
    from profiles import migrate_legacy_profiles_json
    updated = migrate_legacy_profiles_json()

    # Then le slug orphelin est sauté sans erreur (la migration est
    # toujours « complète » et renomme le JSON)
    assert updated == {}

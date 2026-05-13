"""Tests BDD du runner de migrations fichier-par-version (#146).

Couvre le contrat de `migrations/runner.py` :
- application séquentielle des fichiers `NNNN_*.sql`,
- skip des versions déjà appliquées (idempotence),
- atomicité par migration (échec → rollback, user_version inchangé),
- rejet d'un numéro de version dupliqué.
"""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from migrations.runner import apply_pending


@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    c.row_factory = sqlite3.Row
    yield c
    c.close()


def _write(path: Path, version: int, slug: str, sql: str) -> Path:
    f = path / f"{version:04d}_{slug}.sql"
    f.write_text(sql, encoding="utf-8")
    return f


# ── Application séquentielle ──────────────────────────────────────────────────

def test_dossier_vide_n_applique_rien_et_ne_leve_pas(conn, tmp_path):
    # Given un dossier de migrations vide
    # When on demande d'appliquer les migrations pendantes
    applied = apply_pending(conn, tmp_path)

    # Then aucune migration n'est appliquée et la version reste à 0
    assert applied == []
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 0


def test_dossier_inexistant_n_applique_rien(conn, tmp_path):
    # ACL : un chemin invalide ne doit pas faire planter le boot du dashboard.
    applied = apply_pending(conn, tmp_path / "n_existe_pas")
    assert applied == []


def test_migrations_appliquees_dans_l_ordre_des_numeros(conn, tmp_path):
    # Given deux migrations 11 et 12 dans le dossier (créées dans le désordre)
    _write(tmp_path, 12, "ajout_table_b", "CREATE TABLE b (id INTEGER);")
    _write(tmp_path, 11, "ajout_table_a", "CREATE TABLE a (id INTEGER);")

    # When on applique
    applied = apply_pending(conn, tmp_path)

    # Then elles tournent dans l'ordre 11 puis 12, et user_version finit à 12
    assert applied == [11, 12]
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 12
    assert conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).fetchall()[0]["name"] == "a"


# ── Idempotence ───────────────────────────────────────────────────────────────

def test_les_migrations_deja_appliquees_sont_skip(conn, tmp_path):
    # Given une migration 11 déjà appliquée (user_version = 11)
    _write(tmp_path, 11, "init", "CREATE TABLE a (id INTEGER);")
    apply_pending(conn, tmp_path)

    # When on relance le runner
    applied = apply_pending(conn, tmp_path)

    # Then aucune migration n'est rejouée
    assert applied == []
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 11


def test_seules_les_migrations_posterieures_a_user_version_sont_appliquees(conn, tmp_path):
    # Given un user_version à 11 simulant un état d'une DB déjà migrée
    conn.execute("PRAGMA user_version = 11")
    _write(tmp_path, 11, "deja_appliquee", "CREATE TABLE skip_me (id INTEGER);")
    _write(tmp_path, 12, "nouvelle",      "CREATE TABLE b (id INTEGER);")

    # When on applique
    applied = apply_pending(conn, tmp_path)

    # Then seule la 12 tourne, la 11 est ignorée (la table `skip_me` n'existe pas)
    assert applied == [12]
    tables = {r["name"] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert "skip_me" not in tables
    assert "b" in tables


# ── Atomicité ─────────────────────────────────────────────────────────────────

def test_migration_qui_echoue_ne_bumpe_pas_user_version(conn, tmp_path):
    """Si une migration échoue à mi-script, la transaction est annulée
    et user_version reste à la valeur antérieure — relance possible après
    correction du fichier."""
    # Given une migration 11 qui crée une table puis exécute une erreur SQL
    _write(tmp_path, 11, "buggee",
           "CREATE TABLE a (id INTEGER); SYNTAXE INVALIDE;")

    # When on l'applique
    # Then une exception remonte et user_version reste à 0
    with pytest.raises(sqlite3.OperationalError):
        apply_pending(conn, tmp_path)
    assert conn.execute("PRAGMA user_version").fetchone()[0] == 0
    # La table créée avant l'erreur a été annulée
    tables = {r["name"] for r in conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table'"
    ).fetchall()}
    assert "a" not in tables


# ── ACL : nommage ─────────────────────────────────────────────────────────────

def test_deux_fichiers_au_meme_numero_rejetes(conn, tmp_path):
    _write(tmp_path, 11, "feature_a", "CREATE TABLE a (id INTEGER);")
    _write(tmp_path, 11, "feature_b", "CREATE TABLE b (id INTEGER);")
    with pytest.raises(ValueError, match="double pour la version 11"):
        apply_pending(conn, tmp_path)


def test_fichiers_ne_matchant_pas_le_pattern_sont_ignores(conn, tmp_path):
    # Given un README et un fichier .DS_Store dans le dossier
    (tmp_path / "README.md").write_text("# Migrations\n")
    (tmp_path / ".DS_Store").write_bytes(b"\x00")
    _write(tmp_path, 11, "ok", "CREATE TABLE a (id INTEGER);")

    # When on applique
    applied = apply_pending(conn, tmp_path)

    # Then seule la migration au bon format est exécutée
    assert applied == [11]

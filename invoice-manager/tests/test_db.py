"""Tests for open_db migration guard (PRAGMA user_version)."""

import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from db import SCHEMA_VERSION, _run_migrations, open_db


def test_user_version_set_after_first_open(tmp_path):
    db_path = tmp_path / "test.db"
    conn = open_db(db_path)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    conn.close()
    assert version == SCHEMA_VERSION


def test_migrate_not_called_on_subsequent_open(tmp_path):
    db_path = tmp_path / "test.db"
    # First open: runs migration
    conn = open_db(db_path)
    conn.close()

    # Second open: _migrate must NOT be called
    with patch("db._run_migrations") as mock_migrate:
        conn = open_db(db_path)
        conn.close()
    mock_migrate.assert_not_called()


def test_no_table_info_on_second_open(tmp_path):
    db_path = tmp_path / "test.db"
    conn = open_db(db_path)
    conn.close()

    # Second open: collect all SQL via trace callback
    executed = []
    _real_connect = sqlite3.connect

    def patched_connect(path, **kwargs):
        c = _real_connect(path, **kwargs)
        c.set_trace_callback(lambda sql: executed.append(sql.strip().lower()))
        return c

    with patch("sqlite3.connect", side_effect=patched_connect):
        conn = open_db(db_path)
        conn.close()

    assert not any("table_info" in sql for sql in executed), (
        f"PRAGMA table_info should not run on already-migrated DB, got: {executed}"
    )


def test_legacy_db_migrates_on_first_open(tmp_path):
    db_path = tmp_path / "legacy.db"
    # Create a DB without user_version (simulates pre-fix DB)
    conn = sqlite3.connect(db_path)
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            statut_révision TEXT DEFAULT 'validé'
        );
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1)
        );
    """)
    conn.commit()
    conn.close()

    # open_db should migrate it
    conn = open_db(db_path)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    cols = {row[1] for row in conn.execute("PRAGMA table_info(invoices)")}
    conn.close()

    assert version == SCHEMA_VERSION
    assert "texte_brut" in cols
    assert "deleted_at" in cols


# ── Migration v6 : taux_tva pourcentage → fraction ────────────────────────────

class TestMigrationTauxTvaEnFraction:
    def _legacy_db_with_percent_rates(self, path):
        """Construit une DB pré-migration v6 : taux_tva en pourcentage (0..100)."""
        conn = sqlite3.connect(path)
        # On laisse open_db poser le schéma à jour la prochaine fois ; pour le moment
        # on stocke des taux en pourcentage afin de vérifier la conversion.
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS invoices (
                id        TEXT PRIMARY KEY,
                taux_tva  REAL,
                statut_révision TEXT DEFAULT 'validé'
            );
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1)
            );
        """)
        conn.executemany(
            "INSERT INTO invoices (id, taux_tva) VALUES (?, ?)",
            [("a", 20.0), ("b", 5.5), ("c", 2.1), ("d", 0.0), ("e", None)],
        )
        conn.commit()
        conn.close()

    def test_taux_en_pourcentage_devient_fraction_à_l_ouverture(self, tmp_path):
        # Given une DB d'avant la v6 où les taux sont en pourcentage
        db_path = tmp_path / "legacy.db"
        self._legacy_db_with_percent_rates(db_path)

        # When on l'ouvre via open_db (déclenche les migrations)
        conn = open_db(db_path)

        # Then chaque taux a été divisé par 100, arrondi à 4 décimales
        rows = {r[0]: r[1] for r in conn.execute(
            "SELECT id, taux_tva FROM invoices ORDER BY id"
        )}
        conn.close()
        assert rows["a"] == 0.20
        assert rows["b"] == 0.055
        assert rows["c"] == 0.021
        assert rows["d"] == 0.0
        assert rows["e"] is None

    def test_migration_taux_tva_est_idempotente(self, tmp_path):
        # Given une DB déjà migrée (tous les taux sont des fractions ≤ 1)
        db_path = tmp_path / "already.db"
        self._legacy_db_with_percent_rates(db_path)
        conn = open_db(db_path); conn.close()  # première migration

        # When on rouvre la DB (la migration tournerait à nouveau si non-idempotente)
        conn = open_db(db_path)
        rows_avant = dict(conn.execute("SELECT id, taux_tva FROM invoices"))
        # Force le rejeu manuel des migrations pour vérifier l'idempotence
        from db import _run_migrations
        _run_migrations(conn)
        rows_apres = dict(conn.execute("SELECT id, taux_tva FROM invoices"))
        conn.close()

        # Then les valeurs n'ont pas changé
        assert rows_avant == rows_apres


# ── Migration v7 : catégorie en minuscules + table category_tva_rates ─────────

class TestMigrationV7Categories:
    def test_categorie_mixed_case_est_minusculisée(self, tmp_path):
        # Given une DB avec des catégories mixed-case
        db_path = tmp_path / "mixed.db"
        conn = sqlite3.connect(db_path)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                catégorie TEXT,
                statut_révision TEXT DEFAULT 'validé'
            );
            CREATE TABLE IF NOT EXISTS user_profile (
                id INTEGER PRIMARY KEY CHECK (id = 1)
            );
        """)
        conn.executemany(
            "INSERT INTO invoices (id, catégorie) VALUES (?, ?)",
            [("a", "Transport"), ("b", "LOGICIEL"), ("c", "repas"), ("d", None)],
        )
        conn.commit()
        conn.close()

        # When on ouvre via open_db (déclenche la migration v7)
        conn = open_db(db_path)

        # Then toutes les catégories sont en minuscules
        rows = dict(conn.execute("SELECT id, catégorie FROM invoices"))
        conn.close()
        assert rows["a"] == "transport"
        assert rows["b"] == "logiciel"
        assert rows["c"] == "repas"
        assert rows["d"] is None

    def test_migration_categorie_est_idempotente(self, tmp_path):
        db_path = tmp_path / "idem.db"
        conn = sqlite3.connect(db_path)
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS invoices (
                id TEXT PRIMARY KEY,
                catégorie TEXT
            );
        """)
        conn.execute("INSERT INTO invoices (id, catégorie) VALUES ('x', 'TRANSPORT')")
        conn.commit()
        conn.close()
        # Première ouverture : migre
        conn = open_db(db_path); conn.close()
        # Deuxième ouverture : touche zéro ligne (test via rejeu manuel)
        conn = open_db(db_path)
        before = dict(conn.execute("SELECT id, catégorie FROM invoices"))
        _run_migrations(conn)
        after = dict(conn.execute("SELECT id, catégorie FROM invoices"))
        conn.close()
        assert before == after == {"x": "transport"}

    def test_seed_category_tva_rates_contient_les_categories_par_defaut(self, tmp_path):
        db_path = tmp_path / "seed.db"
        conn = open_db(db_path)
        rows = dict(conn.execute(
            "SELECT catégorie, taux_tva FROM category_tva_rates"
        ).fetchall())
        conn.close()
        # Catégories canoniques (cf. _DEFAULT_CATEGORY_TVA_RATES)
        assert "transport" in rows
        assert "logiciel" in rows
        assert 0.0 <= rows["transport"] <= 1.0
        # Toutes les valeurs sont des fractions
        for taux in rows.values():
            assert 0.0 <= taux <= 1.0

    def test_seed_idempotent_ne_overwrite_pas_modifications_utilisateur(self, tmp_path):
        db_path = tmp_path / "userset.db"
        conn = open_db(db_path)
        # L'utilisateur change le taux transport
        conn.execute(
            "UPDATE category_tva_rates SET taux_tva = 0.05 WHERE catégorie = 'transport'"
        )
        conn.commit()
        # Rejeu manuel de _run_migrations : l'INSERT OR IGNORE doit no-op
        _run_migrations(conn)
        taux = conn.execute(
            "SELECT taux_tva FROM category_tva_rates WHERE catégorie = 'transport'"
        ).fetchone()[0]
        conn.close()
        assert taux == 0.05


class TestGetCategoryTvaRates:
    def test_retourne_un_dict_categorie_vers_taux(self, tmp_path):
        from db import get_category_tva_rates
        db_path = tmp_path / "q.db"
        conn = open_db(db_path)
        rates = get_category_tva_rates(conn)
        conn.close()
        assert isinstance(rates, dict)
        assert "transport" in rates
        assert isinstance(rates["transport"], float)

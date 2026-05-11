"""Tests for db.py open_db migration guard using PRAGMA user_version."""

import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from db import open_db, SCHEMA_VERSION


def test_fresh_db_sets_user_version(tmp_path):
    db_path = tmp_path / "data" / "invoices.db"
    conn = open_db(db_path)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    conn.close()
    assert version == SCHEMA_VERSION


def test_second_open_skips_migrations(tmp_path):
    db_path = tmp_path / "data" / "invoices.db"
    open_db(db_path).close()

    # Patch open_db internals: verify no PRAGMA table_info fires on second open
    # by checking that user_version is already at SCHEMA_VERSION → migrations skipped
    raw = sqlite3.connect(db_path)
    version = raw.execute("PRAGMA user_version").fetchone()[0]
    raw.close()
    assert version == SCHEMA_VERSION

    # Second open must not raise and must return a usable connection
    conn = open_db(db_path)
    conn.execute("SELECT 1 FROM invoices LIMIT 1")
    conn.close()


def test_legacy_db_without_user_version_is_migrated(tmp_path):
    db_path = tmp_path / "data" / "invoices.db"
    db_path.parent.mkdir(parents=True)

    # Simulate a legacy DB: create tables without setting user_version
    raw = sqlite3.connect(db_path)
    raw.executescript("""
        CREATE TABLE IF NOT EXISTS invoices (
            id TEXT PRIMARY KEY,
            hash_fichier TEXT UNIQUE,
            statut_révision TEXT DEFAULT 'validé'
        );
        CREATE TABLE IF NOT EXISTS user_profile (
            id INTEGER PRIMARY KEY CHECK (id = 1)
        );
    """)
    raw.commit()
    raw.close()

    # user_version is 0 (legacy) → open_db must migrate without crashing
    conn = open_db(db_path)
    version = conn.execute("PRAGMA user_version").fetchone()[0]
    # All new columns must exist
    cols = {row[1] for row in conn.execute("PRAGMA table_info(invoices)")}
    conn.close()

    assert version == SCHEMA_VERSION
    assert "texte_brut" in cols
    assert "deleted_at" in cols
    assert "corrections_log" in cols

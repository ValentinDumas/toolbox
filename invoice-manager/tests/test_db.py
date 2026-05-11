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

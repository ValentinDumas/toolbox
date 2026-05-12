"""Tests de validation du nom d'entité lors de la création de profil (#93, #94)."""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))


def _make_empty_app(tmp_path, monkeypatch):
    """App Flask sans profil existant — fait apparaître la page de bienvenue."""
    import app as _app
    import blueprints.profils as _bp_profils

    monkeypatch.setattr(_app, "load_profiles", lambda: [])
    monkeypatch.setattr(_bp_profils, "load_profiles", lambda: [])
    # Empêche la persistance réelle quand un nom valide est soumis.
    created = {}

    def _fake_create_profile(name):
        created["name"] = name
        return {"slug": "fake-slug", "name": name, "created_at": "2026-01-01T00:00:00+00:00"}

    monkeypatch.setattr(_bp_profils, "create_profile", _fake_create_profile)
    # Court-circuite la mise à jour DB qui suit create_profile dans le POST.
    import sqlite3

    def _fake_open_db(_path):
        return sqlite3.connect(":memory:")

    monkeypatch.setattr(_bp_profils, "open_db", _fake_open_db)
    monkeypatch.setattr(_bp_profils, "active_db", lambda: ":memory:")
    # La table user_profile n'existe pas dans la DB :memory: ; on patche execute.
    # Plus simple : remplace l'appel INSERT par un no-op via une vraie DB éphémère.
    db_file = tmp_path / "tmp.db"
    from db import open_db as real_open_db
    real_open_db(db_file).close()
    monkeypatch.setattr(_bp_profils, "open_db", lambda _p: real_open_db(db_file))
    monkeypatch.setattr(_bp_profils, "active_db", lambda: db_file)

    app = _app.create_app()
    app.config["TESTING"] = True
    return app, created


def test_profils_creer_empty_name_renders_error(tmp_path, monkeypatch):
    app, created = _make_empty_app(tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/profils", data={"name": "   "})
    assert resp.status_code == 200
    assert b"obligatoire" in resp.data
    assert "name" not in created


def test_profils_creer_path_traversal_renders_error(tmp_path, monkeypatch):
    app, created = _make_empty_app(tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/profils", data={"name": "../etc/passwd"})
    assert resp.status_code == 200
    assert b"/" in resp.data  # le message mentionne les séparateurs
    assert "name" not in created


def test_profils_creer_control_chars_renders_error(tmp_path, monkeypatch):
    app, created = _make_empty_app(tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/profils", data={"name": "SASU\x00Dupont"})
    assert resp.status_code == 200
    assert "imprimables".encode("utf-8") in resp.data
    assert "name" not in created


def test_profils_creer_too_long_renders_error(tmp_path, monkeypatch):
    app, created = _make_empty_app(tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/profils", data={"name": "A" * 81})
    assert resp.status_code == 200
    assert b"80" in resp.data
    assert "name" not in created


def test_profils_creer_only_punctuation_renders_error(tmp_path, monkeypatch):
    """Un nom 100% ponctuation produit un slug vide — doit être refusé."""
    app, created = _make_empty_app(tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/profils", data={"name": "---"})
    assert resp.status_code == 200
    assert b"lettre" in resp.data
    assert "name" not in created


def test_profils_creer_valid_name_redirects(tmp_path, monkeypatch):
    app, created = _make_empty_app(tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/profils", data={"name": "SASU Dupont"})
    assert resp.status_code == 302
    assert "/configuration" in resp.headers["Location"]
    assert created["name"] == "SASU Dupont"

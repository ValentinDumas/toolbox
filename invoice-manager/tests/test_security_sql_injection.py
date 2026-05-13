"""Tests de sécurité : injections SQL sur les routes acceptant du form/query.

VISION.md §4 exige des sondes d'injection SQL sur **chaque route** dont
une entrée utilisateur se retrouve dans une requête. Ce module probe
trois surfaces représentatives :

- PATCH /factures/<id>       — id contrôlé par l'URL
- POST  /parametres/profil   — champs form (nom, siren)
- GET   /?year=...           — query string consommée par les agrégations

Pour chaque sonde : on insère 3 factures, on envoie le payload, on vérifie
que la table `invoices` existe encore avec ses 3 lignes, et que la réponse
n'expose pas de stack trace SQLite (signal d'erreur non rattrapée).
"""
from __future__ import annotations

import sqlite3 as _sq
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db


# ── Helpers ──────────────────────────────────────────────────────────────────

def _insert_invoice(conn, **kwargs):
    defaults = {
        "id": "seed-id",
        "type_document": "facture_reçue",
        "montant_ht": 100.0,
        "montant_tva": 20.0,
        "montant_ttc": 120.0,
        "taux_tva": 0.20,
        "confiance": 0.9,
        "statut_révision": "validé",
        "exercice_fiscal": 2026,
        "émetteur_nom": "ACME",
        "date_document": "2026-03-01",
    }
    row = {**defaults, **kwargs}
    cols = ", ".join(f'"{k}"' for k in row)
    placeholders = ", ".join("?" for _ in row)
    conn.execute(
        f"INSERT INTO invoices ({cols}) VALUES ({placeholders})",
        list(row.values()),
    )
    conn.commit()


def _make_app(tmp_path, monkeypatch):
    """Crée une app Flask isolée + seed 3 factures validées dans la DB."""
    import app as _app
    import context_helpers as _ctx
    import blueprints.pipeline as _bp_pipeline
    import blueprints.profils as _bp_profils

    slug = "test-profile"
    profile_dir = tmp_path / "data" / "profiles" / slug
    db_file = profile_dir / "invoices.db"
    for d in ("input", "processed", "errors", "output", "review"):
        (profile_dir / d).mkdir(parents=True, exist_ok=True)

    conn = open_db(db_file)
    conn.execute(
        "INSERT OR REPLACE INTO user_profile "
        "(id, nom, siren, fiscal_profile, setup_complete) "
        "VALUES (1, 'Seed', '123456789', 'auto-entrepreneur', 1)"
    )
    for idx in range(3):
        _insert_invoice(conn, id=f"seed-{idx}")
    conn.commit()
    conn.close()

    test_profiles = [{"slug": slug, "name": "Test",
                      "created_at": "2025-01-01T00:00:00+00:00"}]
    test_paths = {
        "db":        db_file,
        "input":     profile_dir / "input",
        "processed": profile_dir / "processed",
        "errors":    profile_dir / "errors",
        "output":    profile_dir / "output",
        "review":    profile_dir / "review",
    }

    monkeypatch.setattr(_app, "load_profiles", lambda: test_profiles)
    monkeypatch.setattr(_app, "get_profile_meta",
                        lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_ctx, "resolve_paths", lambda s: test_paths)
    monkeypatch.setattr(_ctx, "get_profile_meta",
                        lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_bp_pipeline, "resolve_paths", lambda s: test_paths)
    monkeypatch.setattr(_bp_profils, "get_profile_meta",
                        lambda s: test_profiles[0] if s == slug else None)

    from app import create_app
    app = create_app()
    app.config["TESTING"] = True

    def _inject_session():
        from flask import session
        session["active_profile"] = slug

    app.before_request_funcs.setdefault(None, []).insert(0, _inject_session)
    return app, db_file


def _table_invoices_intacte(db_file: Path, attendu: int = 3) -> tuple[bool, int]:
    """Retourne (table_existe, nb_lignes_visibles). Soft-delete inclus."""
    conn = _sq.connect(str(db_file))
    try:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='invoices'"
        ).fetchone()
        if not row:
            return (False, 0)
        n = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        return (True, n)
    finally:
        conn.close()


# Signaux d'erreur SQLite remontant dans le HTML / JSON exposé au client.
SQL_ERROR_SIGNALS = (
    b"sqlite3.OperationalError",
    b"sqlite3.DatabaseError",
    b"sqlite3.IntegrityError",
    b"unrecognized token",
    b"no such table",
    b"syntax error",
    b"Traceback (most recent call last)",
)


def _aucune_stack_trace_sql(body: bytes):
    for needle in SQL_ERROR_SIGNALS:
        assert needle not in body, (
            f"Stack trace ou erreur SQLite exposée : {needle!r}"
        )


# ── Sondes d'injection ───────────────────────────────────────────────────────

def test_patch_facture_avec_id_malicieux_ne_drop_pas_la_table(tmp_path, monkeypatch):
    # Given 3 factures en base et un id de facture contenant une injection
    app, db_file = _make_app(tmp_path, monkeypatch)
    payload_id = "seed-0'; DROP TABLE invoices; --"

    # When on envoie un PATCH avec cet id dans l'URL
    with app.test_client() as client:
        resp = client.patch(
            f"/factures/{payload_id}",
            data={"montant_ttc": "999"},
        )

    # Then la table invoices existe toujours et garde ses 3 lignes
    existe, nb = _table_invoices_intacte(db_file)
    assert existe, "La table invoices a été DROP — injection SQL effective"
    assert nb == 3, f"Le nombre de factures a changé ({nb} ≠ 3)"
    # Et aucune stack trace SQLite ne fuit dans la réponse
    _aucune_stack_trace_sql(resp.get_data(as_text=False))


@pytest.mark.parametrize("champ, payload", [
    ("nom",   "' OR 1=1 --"),
    ("siren", "' UNION SELECT * FROM invoices --"),
])
def test_post_parametres_profil_refuse_les_injections(
    champ, payload, tmp_path, monkeypatch
):
    # Given 3 factures en base et un profil paramétré
    app, db_file = _make_app(tmp_path, monkeypatch)

    # When on soumet le formulaire profil avec un champ vérolé
    form = {
        "nom": "Valentin",
        "siren": "123456789",
        "tva_intracom": "",
        "fiscal_profile": "auto-entrepreneur",
        "cadence": "trimestrielle",
    }
    form[champ] = payload

    with app.test_client() as client:
        resp = client.post("/parametres/profil", data=form)

    # Then la table invoices reste intacte (pas d'effet de bord)
    existe, nb = _table_invoices_intacte(db_file)
    assert existe
    assert nb == 3
    _aucune_stack_trace_sql(resp.get_data(as_text=False))


def test_get_root_avec_year_malicieux_ne_drop_pas_la_table(tmp_path, monkeypatch):
    # Given 3 factures en base
    app, db_file = _make_app(tmp_path, monkeypatch)

    # When on demande la racine avec un ?year= injectant du SQL
    payload = "2026' UNION SELECT 1--"
    with app.test_client() as client:
        resp = client.get(f"/?year={payload}")

    # Then la requête est traitée (la valeur invalide tombe sur le défaut
    # via Flask `type=int`) et la table reste intacte
    existe, nb = _table_invoices_intacte(db_file)
    assert existe
    assert nb == 3
    assert resp.status_code in (200, 302)
    _aucune_stack_trace_sql(resp.get_data(as_text=False))

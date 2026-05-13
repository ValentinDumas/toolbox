"""Tests E2E « golden path » auto-entrepreneur (#145).

Deux scénarios qui parcourent les flux métier critiques d'un AE :

1. Déclaration URSSAF trimestrielle (consulter l'agenda, exporter le récap,
   marquer la période déclarée).
2. Émission d'une facture en franchise de TVA (création via formulaire,
   persistance + génération du HTML conforme art. 293 B CGI).

Les tests utilisent `app.test_client()` sur une base SQLite copiée dans un
profil temporaire — même pattern que `tests/test_dashboard.py::_make_app`.
"""
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


def _make_app(mem_db, tmp_path, monkeypatch):
    """Réplique le helper de `test_dashboard.py` : copie mem_db dans un profil
    temporaire, patche `resolve_paths` / `get_profile_meta`, retourne l'app."""
    import app as _app
    import context_helpers as _ctx
    import blueprints.pipeline as _bp_pipeline
    import blueprints.profils as _bp_profils

    slug = "test-ae"
    profile_dir = tmp_path / "data" / "profiles" / slug
    db_file = profile_dir / "invoices.db"
    for d in ("input", "processed", "errors", "output", "review"):
        (profile_dir / d).mkdir(parents=True, exist_ok=True)

    file_conn = sqlite3.connect(str(db_file))
    mem_db.backup(file_conn)
    file_conn.execute(
        "INSERT OR REPLACE INTO user_profile "
        "(id, nom, siren, fiscal_profile, cadence, activite_principale, setup_complete) "
        "VALUES (1, 'Valentin Dumas', '123456789', 'auto-entrepreneur', "
        "'trimestrielle', 'service_bic', 1)"
    )
    file_conn.commit()
    file_conn.close()

    test_profiles = [{"slug": slug, "name": "Test AE",
                      "created_at": "2026-01-01T00:00:00+00:00"}]
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


def _insert_facture_emise_payee(conn, *, id_, montant_ttc, date_paiement):
    """Insère une facture émise validée + encaissée (= contribue au CA URSSAF)."""
    conn.execute(
        "INSERT INTO invoices (id, type_document, numéro_facture, date_document, "
        "date_paiement, émetteur_nom, émetteur_siren, destinataire_nom, "
        "montant_ht, montant_tva, montant_ttc, taux_tva, devise, "
        "statut_révision, exercice_fiscal, confiance) "
        "VALUES (?, 'facture_émise', ?, ?, ?, 'Valentin Dumas', '123456789', "
        "'Client', ?, 0.0, ?, 0.0, 'EUR', 'validé', 2026, 1.0)",
        (id_, id_, date_paiement, date_paiement, montant_ttc, montant_ttc),
    )
    conn.commit()


# ── Scénario 1 — Déclaration URSSAF trimestrielle ─────────────────────────────

def test_golden_path_declaration_urssaf_trimestrielle(mem_db, tmp_path, monkeypatch):
    # Given un AE en cadence trimestrielle (service BIC) avec 3 factures
    # émises encaissées en mars 2026 → T1 2026, CA = 1 800 €.
    _insert_facture_emise_payee(mem_db, id_="f1", montant_ttc=1000.0,
                                date_paiement="2026-03-05")
    _insert_facture_emise_payee(mem_db, id_="f2", montant_ttc=500.0,
                                date_paiement="2026-03-15")
    _insert_facture_emise_payee(mem_db, id_="f3", montant_ttc=300.0,
                                date_paiement="2026-03-28")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    with app.test_client() as client:
        # When on consulte l'agenda URSSAF de l'année 2026
        resp = client.get("/urssaf/agenda?year=2026")

        # Then la page mentionne T1 2026 et le CA encaissé 1 800,00 €
        assert resp.status_code == 200
        html = resp.data.decode()
        assert "T1 2026" in html
        assert "1 800,00 €" in html

        # When on exporte le récap CSV de T1 2026
        resp_csv = client.get("/urssaf/declarations/2026-T1/exporter")

        # Then le CSV contient le libellé et la valeur attendus
        assert resp_csv.status_code == 200
        csv_body = resp_csv.data.decode("utf-8-sig")
        assert "CA encaissé sur la période" in csv_body
        assert "1800,00" in csv_body

        # When on marque T1 2026 comme déclarée
        resp_mark = client.post(
            "/urssaf/declarations/2026-T1/marquer-declaree",
            data={"year": "2026"},
        )

        # Then redirection vers l'agenda
        assert resp_mark.status_code == 302
        assert "/urssaf/agenda" in resp_mark.headers["Location"]

        # Then l'agenda affiche le badge « Déclarée » pour T1
        resp2 = client.get("/urssaf/agenda?year=2026")
        assert resp2.status_code == 200
        html2 = resp2.data.decode()
        # Le badge se lit « Déclarée le YYYY-MM-DD »
        assert "Déclarée" in html2


# ── Scénario 2 — Émission de facture en franchise de TVA ──────────────────────

def test_golden_path_emission_facture_franchise(mem_db, tmp_path, monkeypatch):
    # Given un AE en franchise (fiscal_profile=auto-entrepreneur)
    app, db_file = _make_app(mem_db, tmp_path, monkeypatch)

    with app.test_client() as client:
        # When on poste une nouvelle facture avec une ligne à 500 €
        resp = client.post(
            "/facturation/nouvelle",
            data={
                "client_nom": "Client SARL",
                "designation_0": "Audit",
                "quantite_0": "1",
                "pu_0": "500",
            },
        )

        # Then redirection vers le tableau de bord
        assert resp.status_code == 302

    # Then la DB contient une facture émise conforme franchise
    conn = sqlite3.connect(str(db_file))
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT numéro_facture, montant_ttc, montant_tva, statut_révision, "
        "fichier_source FROM invoices WHERE type_document='facture_émise'"
    ).fetchone()
    conn.close()

    assert row is not None
    assert row["numéro_facture"].startswith("2026-")
    assert len(row["numéro_facture"]) == len("2026-0001")
    assert row["montant_ttc"] == 500.0
    assert row["montant_tva"] == 0.0
    assert row["statut_révision"] == "validé"

    # Then le fichier HTML produit existe et porte la mention art. 293 B CGI
    html_path = Path(row["fichier_source"])
    assert html_path.exists()
    contenu = html_path.read_text(encoding="utf-8")
    assert "TVA non applicable, art. 293 B du CGI" in contenu

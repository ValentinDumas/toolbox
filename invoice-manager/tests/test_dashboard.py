"""Tests du dashboard Flask."""
import sqlite3
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db


def _insert_invoice(conn, **kwargs):
    defaults = {
        "id": "test-id",
        "type_document": "facture_reçue",
        "montant_ht": 100.0,
        "montant_tva": 20.0,
        "montant_ttc": 120.0,
        "exercice_fiscal": 2025,
        "statut_révision": "auto_validé",
        "émetteur_nom": "OVH SAS",
        "destinataire_nom": "Jean Dupont",
        "date_document": "2025-03-01",
    }
    row = {**defaults, **kwargs}
    cols = ", ".join(f'"{k}"' for k in row)
    placeholders = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({placeholders})", list(row.values()))
    conn.commit()


@pytest.fixture
def mem_db():
    conn = open_db(Path(":memory:"))
    yield conn
    conn.close()


# ── Data queries ──────────────────────────────────────────────────────────────

def test_fiscal_summary_empty(mem_db):
    from dashboard import query_fiscal_summary
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 0.0
    assert s["tva_collectee"] == 0.0
    assert s["tva_deductible"] == 0.0
    assert s["tva_a_reverser"] == 0.0
    assert s["total_charges"] == 0.0


def test_fiscal_summary_populated(mem_db):
    from dashboard import query_fiscal_summary
    _insert_invoice(mem_db, id="e1", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="r1", type_document="facture_reçue",
                    montant_ht=400.0, montant_tva=80.0, exercice_fiscal=2025)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 1000.0
    assert s["tva_collectee"] == 200.0
    assert s["tva_deductible"] == 80.0
    assert abs(s["tva_a_reverser"] - 120.0) < 0.01
    assert s["total_charges"] == 400.0


def test_fiscal_summary_charges_excludes_a_reviser(mem_db):
    from dashboard import query_fiscal_summary
    _insert_invoice(mem_db, id="v1", type_document="facture_reçue",
                    montant_ht=300.0, statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="av1", type_document="facture_reçue",
                    montant_ht=100.0, statut_révision="auto_validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="r1", type_document="facture_reçue",
                    montant_ht=50.0, statut_révision="à_réviser", exercice_fiscal=2025)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["total_charges"] == 400.0
    assert s["total_charges_revision"] == 50.0
    assert s["nb_charges_revision"] == 1


def test_fiscal_summary_year_filter(mem_db):
    from dashboard import query_fiscal_summary
    _insert_invoice(mem_db, id="e2025", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="e2024", type_document="facture_émise",
                    montant_ht=200.0, montant_tva=40.0, exercice_fiscal=2024)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 500.0


def test_ledger_pagination(mem_db):
    from dashboard import query_ledger
    for i in range(55):
        _insert_invoice(mem_db, id=f"row-{i}", type_document="facture_reçue",
                        montant_ht=10.0, montant_tva=2.0, exercice_fiscal=2025)
    page1 = query_ledger(mem_db, 2025, page=1)
    assert len(page1["rows"]) == 50
    assert page1["total_count"] == 55
    assert page1["total_pages"] == 2
    page2 = query_ledger(mem_db, 2025, page=2)
    assert len(page2["rows"]) == 5


def test_ledger_totals(mem_db):
    from dashboard import query_ledger
    _insert_invoice(mem_db, id="inc", type_document="facture_émise",
                    montant_ht=300.0, montant_tva=60.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="exp", type_document="facture_reçue",
                    montant_ht=150.0, montant_tva=30.0, exercice_fiscal=2025)
    result = query_ledger(mem_db, 2025)
    assert result["total_credit"] == 300.0
    assert result["total_debit"] == 150.0


def test_ledger_validé_edit_row_markup(mem_db, tmp_path, monkeypatch):
    """L'item validé doit rendre un <tr class='edit-row'> inline et un <button aria-controls>."""
    _insert_invoice(mem_db, id="v1", statut_révision="validé",
                    type_document="facture_reçue", montant_ht=200.0,
                    montant_tva=40.0, exercice_fiscal=2025,
                    date_document="2025-06-01", émetteur_nom="ACME")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    html = resp.data.decode()
    assert 'aria-controls="edit-row-v1"' in html
    assert 'id="edit-row-v1"' in html
    assert 'class="edit-row"' in html
    assert 'href="#review-v1"' not in html
    assert 'review-item-hidden' not in html


def test_ledger_no_legacy_validés_block(mem_db, tmp_path, monkeypatch):
    """Le bloc review-item-hidden hors-tableau ne doit plus exister."""
    _insert_invoice(mem_db, id="v2", statut_révision="validé",
                    type_document="facture_reçue", montant_ht=100.0,
                    exercice_fiscal=2025, date_document="2025-07-01")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    html = resp.data.decode()
    assert 'review-item-hidden' not in html
    assert 'Validé — correction tracée' not in html


def test_health_counts(mem_db, tmp_path):
    from dashboard import query_health
    (tmp_path / "input").mkdir()
    (tmp_path / "errors").mkdir()
    (tmp_path / "input" / "facture.pdf").touch()
    (tmp_path / "errors" / "broken.pdf").touch()
    _insert_invoice(mem_db, id="rev", statut_révision="à_réviser", exercice_fiscal=2025)
    cfg = {"paths": {"input": str(tmp_path / "input"), "errors": str(tmp_path / "errors")}}
    h = query_health(mem_db, cfg)
    assert h["pending_files"] == 1
    assert h["items_a_reviser"] == 1
    assert h["error_files"] == 1


# ── Flask routes ──────────────────────────────────────────────────────────────

def _make_app(mem_db, tmp_path, monkeypatch):
    """Helper : copie mem_db dans un fichier temporaire et crée l'app Flask."""
    db_file = tmp_path / "data" / "invoices.db"
    db_file.parent.mkdir(exist_ok=True)

    # Copie des données depuis la connexion en mémoire vers un fichier
    import sqlite3 as _sq
    file_conn = _sq.connect(str(db_file))
    mem_db.backup(file_conn)
    file_conn.close()

    for d in ("input", "errors", "review"):
        (tmp_path / d).mkdir(exist_ok=True)

    cfg = {
        "paths": {
            "input": str(tmp_path / "input"),
            "errors": str(tmp_path / "errors"),
            "review": str(tmp_path / "review"),
            "db": str(db_file),
        }
    }
    from dashboard import create_app
    app = create_app(cfg, db_file)
    app.config["TESTING"] = True
    return app, db_file


def test_get_root_empty_db(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert resp.status_code == 200
    assert b"ProLedger" in resp.data


def test_get_root_populated(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="e1", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    assert resp.status_code == 200
    assert b"1" in resp.data


def test_year_filter(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="e2025", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="e2024", type_document="facture_émise",
                    montant_ht=999.0, montant_tva=199.0, exercice_fiscal=2024)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    assert "999,00" not in resp.data.decode()


def test_post_run_calls_subprocess(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("dashboard.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="")
        with app.test_client() as client:
            resp = client.post("/run")
    assert resp.status_code in (302, 200)
    mock_run.assert_called_once()
    called_cmd = mock_run.call_args[0][0]
    assert "run.py" in called_cmd[-1]


def test_post_run_error_shows_in_redirect(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("dashboard.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stderr="ERREUR GRAVE")
        with app.test_client() as client:
            resp = client.post("/run")
    assert resp.status_code == 302
    assert "run_error" in resp.headers["Location"]


def test_post_open_review_no_items_redirects(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("dashboard.subprocess.Popen") as mock_popen:
        with app.test_client() as client:
            resp = client.post("/open-review")
    assert resp.status_code == 302
    mock_popen.assert_not_called()


def test_post_open_review_with_items_opens_file(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)  # crée review/ en premier
    (tmp_path / "review" / "review.csv").touch()
    with patch("dashboard.subprocess.Popen") as mock_popen:
        with app.test_client() as client:
            resp = client.post("/open-review")
    assert resp.status_code == 302
    mock_popen.assert_called_once()


# ── Review inline ─────────────────────────────────────────────────────────────

def test_query_items_a_reviser_empty(mem_db):
    from dashboard import query_items_a_reviser
    assert query_items_a_reviser(mem_db) == []


def test_query_items_a_reviser_populated(mem_db):
    from dashboard import query_items_a_reviser
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="ok1", statut_révision="auto_validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="done1", statut_révision="validé", exercice_fiscal=2025)
    items = query_items_a_reviser(mem_db)
    ids = [i["id"] for i in items]
    assert "rev1" in ids
    assert "ok1" in ids
    assert "done1" not in ids


def test_post_review_save_validates_item(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/rev1/save", data={
            "type_document": "facture_reçue",
            "montant_ht": "100.0",
            "montant_tva": "20.0",
            "date_document": "2025-03-01",
            "émetteur_nom": "OVH SAS",
            "numéro_facture": "FR001",
            "catégorie": "hébergement",
            "notes_correction": "",
        })
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT statut_révision FROM invoices WHERE id='rev1'").fetchone()
    check.close()
    assert row["statut_révision"] == "validé"


def test_post_review_save_updates_fields(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev2", statut_révision="à_réviser",
                    émetteur_nom="Ancien Nom", montant_ht=50.0, exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        client.post("/review/rev2/save", data={
            "type_document": "facture_reçue",
            "montant_ht": "99.0",
            "montant_tva": "19.8",
            "date_document": "2025-04-01",
            "émetteur_nom": "Nouveau Nom",
            "numéro_facture": "",
            "catégorie": "",
            "notes_correction": "corrigé manuellement",
        })
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT émetteur_nom, montant_ht, notes_correction FROM invoices WHERE id='rev2'"
    ).fetchone()
    check.close()
    assert row["émetteur_nom"] == "Nouveau Nom"
    assert abs(row["montant_ht"] - 99.0) < 0.01
    assert row["notes_correction"] == "corrigé manuellement"


def test_post_review_save_unknown_id(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/nonexistent/save", data={
            "type_document": "facture_reçue", "montant_ht": "10",
            "montant_tva": "2", "date_document": "", "émetteur_nom": "",
            "numéro_facture": "", "catégorie": "", "notes_correction": "",
        })
    assert resp.status_code == 302


def test_post_review_delete(mem_db, tmp_path, monkeypatch):
    """Delete must soft-delete (set deleted_at), not remove the row."""
    _insert_invoice(mem_db, id="del1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/del1/delete")
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT deleted_at, deleted_by FROM invoices WHERE id='del1'").fetchone()
    check.close()
    assert row is not None, "Row must still exist after soft delete"
    assert row["deleted_at"] is not None
    assert row["deleted_by"] == "user"


def test_soft_deleted_excluded_from_fiscal_summary(mem_db):
    from dashboard import query_fiscal_summary
    _insert_invoice(mem_db, id="alive", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 1000.0


def test_soft_deleted_excluded_from_ledger(mem_db):
    from dashboard import query_ledger
    _insert_invoice(mem_db, id="alive", type_document="facture_reçue",
                    montant_ht=100.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", type_document="facture_reçue",
                    montant_ht=100.0, exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    result = query_ledger(mem_db, 2025)
    assert result["total_count"] == 1
    ids = [r["id"] for r in result["rows"]]
    assert "dead" not in ids


def test_soft_deleted_excluded_from_items_a_reviser(mem_db):
    from dashboard import query_items_a_reviser
    _insert_invoice(mem_db, id="alive", statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", statut_révision="à_réviser", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    items = query_items_a_reviser(mem_db)
    ids = [i["id"] for i in items]
    assert "alive" in ids
    assert "dead" not in ids


def test_query_corbeille_returns_deleted_rows(mem_db):
    from dashboard import query_corbeille
    _insert_invoice(mem_db, id="alive", statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", statut_révision="à_réviser", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    rows = query_corbeille(mem_db)
    ids = [r["id"] for r in rows]
    assert "dead" in ids
    assert "alive" not in ids


def test_post_review_restore(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="dead1", statut_révision="validé", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/review/dead1/restore")
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT deleted_at, statut_révision FROM invoices WHERE id='dead1'"
    ).fetchone()
    check.close()
    assert row["deleted_at"] is None
    assert row["statut_révision"] == "à_réviser"


def test_get_root_shows_review_section(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev3", statut_révision="à_réviser", exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert b'id="reviser"' in resp.data


def test_get_root_no_review_section(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert b'id="reviser"' not in resp.data

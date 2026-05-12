"""Tests du dashboard Flask."""
import sqlite3
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from extract import open_db
from services.revision import (
    _build_corrections_log,
    _parse_review_fields,
    _persist_invoice,
    _recompute_confidence,
    _validate_review_fields,
)


def _insert_invoice(conn, **kwargs):
    defaults = {
        "id": "test-id",
        "type_document": "facture_reçue",
        "montant_ht": 100.0,
        "montant_tva": 20.0,
        "montant_ttc": 120.0,
        "exercice_fiscal": 2025,
        "statut_révision": "validé",
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
    from queries import query_fiscal_summary
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 0.0
    assert s["tva_collectee"] == 0.0
    assert s["tva_deductible"] == 0.0
    assert s["tva_a_reverser"] == 0.0
    assert s["total_charges"] == 0.0


def test_fiscal_summary_populated(mem_db):
    from queries import query_fiscal_summary
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
    from queries import query_fiscal_summary
    _insert_invoice(mem_db, id="v1", type_document="facture_reçue",
                    montant_ht=300.0, statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="r1", type_document="facture_reçue",
                    montant_ht=50.0, statut_révision="à_réviser", exercice_fiscal=2025)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["total_charges"] == 300.0
    assert s["total_charges_revision"] == 50.0
    assert s["nb_charges_revision"] == 1


def test_fiscal_summary_tva_excludes_a_reviser(mem_db):
    from queries import query_fiscal_summary
    _insert_invoice(mem_db, id="ev", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0,
                    statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="rv", type_document="facture_reçue",
                    montant_ht=400.0, montant_tva=80.0,
                    statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="ea", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0,
                    statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="ra", type_document="facture_reçue",
                    montant_ht=200.0, montant_tva=40.0,
                    statut_révision="à_réviser", exercice_fiscal=2025)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["tva_collectee"] == 200.0
    assert s["tva_deductible"] == 80.0
    assert abs(s["tva_a_reverser"] - 120.0) < 0.01


def test_fiscal_summary_exposes_tva_revision(mem_db):
    from queries import query_fiscal_summary
    _insert_invoice(mem_db, id="ea", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0,
                    statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="ra", type_document="facture_reçue",
                    montant_ht=200.0, montant_tva=40.0,
                    statut_révision="à_réviser", exercice_fiscal=2025)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["nb_tva_revision"] == 2
    assert abs(s["tva_revision_a_reverser"] - 60.0) < 0.01


def test_fiscal_summary_year_filter(mem_db):
    from queries import query_fiscal_summary
    _insert_invoice(mem_db, id="e2025", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="e2024", type_document="facture_émise",
                    montant_ht=200.0, montant_tva=40.0, exercice_fiscal=2024)
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 500.0


def test_ledger_pagination(mem_db):
    from queries import query_ledger
    for i in range(55):
        _insert_invoice(mem_db, id=f"row-{i}", type_document="facture_reçue",
                        montant_ht=10.0, montant_tva=2.0, exercice_fiscal=2025)
    page1 = query_ledger(mem_db, 2025, page=1)
    assert len(page1["rows"]) == 50
    assert page1["total_count"] == 55
    assert page1["total_pages"] == 2
    page2 = query_ledger(mem_db, 2025, page=2)
    assert len(page2["rows"]) == 5


def test_ledger_excludes_a_reviser(mem_db):
    """Le ledger ne doit pas inclure les items à_réviser (#78)."""
    from queries import query_ledger
    _insert_invoice(mem_db, id="v", statut_révision="validé",
                    type_document="facture_reçue", montant_ht=100.0,
                    exercice_fiscal=2025)
    _insert_invoice(mem_db, id="r", statut_révision="à_réviser",
                    type_document="facture_reçue", montant_ht=50.0,
                    exercice_fiscal=2025)
    result = query_ledger(mem_db, 2025)
    assert result["total_count"] == 1
    assert all(row["statut_révision"] != "à_réviser" for row in result["rows"])
    assert result["total_debit"] == 100.0


def test_ledger_totals(mem_db):
    from queries import query_ledger
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
    from queries import query_health
    (tmp_path / "input").mkdir()
    (tmp_path / "errors").mkdir()
    (tmp_path / "input" / "facture.pdf").touch()
    (tmp_path / "errors" / "broken.pdf").touch()
    _insert_invoice(mem_db, id="rev", statut_révision="à_réviser", exercice_fiscal=2025)
    paths = {"input": tmp_path / "input", "errors": tmp_path / "errors"}
    h = query_health(mem_db, paths)
    assert h["pending_files"] == 1
    assert h["items_a_reviser"] == 1
    assert h["error_files"] == 1


def test_query_error_files_empty(tmp_path):
    from queries import query_error_files
    paths = {"errors": tmp_path / "nonexistent"}
    assert query_error_files(paths) == []


def test_query_error_files_lists_files(tmp_path):
    from queries import query_error_files
    errors_dir = tmp_path / "errors"
    errors_dir.mkdir()
    (errors_dir / "broken.pdf").write_bytes(b"x" * 2048)
    (errors_dir / ".hidden").touch()
    paths = {"errors": errors_dir}
    result = query_error_files(paths)
    assert len(result) == 1
    assert result[0]["name"] == "broken.pdf"
    assert result[0]["size_kb"] == 2.0
    assert "mtime" in result[0]


# ── Flask routes ──────────────────────────────────────────────────────────────

def _make_app(mem_db, tmp_path, monkeypatch):
    """Helper : copie mem_db dans un profil temporaire et crée l'app Flask."""
    import sqlite3 as _sq
    import app as _app
    import context_helpers as _ctx
    import blueprints.pipeline as _bp_pipeline
    import blueprints.profils as _bp_profils

    slug = "test-profile"
    profile_dir = tmp_path / "data" / "profiles" / slug
    db_file = profile_dir / "invoices.db"
    for d in ("input", "processed", "errors", "output", "review"):
        (profile_dir / d).mkdir(parents=True, exist_ok=True)

    file_conn = _sq.connect(str(db_file))
    mem_db.backup(file_conn)
    file_conn.execute(
        "INSERT OR REPLACE INTO user_profile "
        "(id, siren, fiscal_profile, setup_complete) VALUES (1, '123456789', 'auto-entrepreneur', 1)"
    )
    file_conn.commit()
    file_conn.close()

    test_profiles = [{"slug": slug, "name": "Test", "created_at": "2025-01-01T00:00:00+00:00"}]
    test_paths = {
        "db":        db_file,
        "input":     profile_dir / "input",
        "processed": profile_dir / "processed",
        "errors":    profile_dir / "errors",
        "output":    profile_dir / "output",
        "review":    profile_dir / "review",
    }

    # Patch the names as imported in app.py and the modules used by blueprints
    monkeypatch.setattr(_app,        "load_profiles",        lambda: test_profiles)
    monkeypatch.setattr(_app,        "get_profile_meta",     lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_ctx,        "resolve_paths",        lambda s: test_paths)
    monkeypatch.setattr(_ctx,        "get_profile_meta",     lambda s: test_profiles[0] if s == slug else None)
    monkeypatch.setattr(_bp_pipeline, "resolve_paths",       lambda s: test_paths)
    monkeypatch.setattr(_bp_profils,  "get_profile_meta",    lambda s: test_profiles[0] if s == slug else None)

    from app import create_app
    app = create_app()
    app.config["TESTING"] = True

    # Inject active_profile before require_setup runs (must be first in the list)
    def _inject_session():
        from flask import session
        session["active_profile"] = slug

    app.before_request_funcs.setdefault(None, []).insert(0, _inject_session)

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


def test_profile_complete_without_tva_intracom_hides_banner(mem_db, tmp_path, monkeypatch):
    """Issue #107 — un profil avec nom + SIREN renseignés est complet,
    même sans numéro de TVA intracommunautaire (cas auto-entrepreneur
    en franchise en base : la TVA intracom est explicitement optionnelle)."""
    import sqlite3 as _sq
    app, db_file = _make_app(mem_db, tmp_path, monkeypatch)
    conn = _sq.connect(str(db_file))
    conn.execute(
        "UPDATE user_profile SET nom=?, siren=?, tva_intracom=? WHERE id=1",
        ("Valentin Dumas", "123456789", ""),
    )
    conn.commit()
    conn.close()
    with app.test_client() as client:
        resp = client.get("/")
    assert resp.status_code == 200
    assert "Profil incomplet" not in resp.data.decode()


def test_profile_missing_siren_shows_banner(mem_db, tmp_path, monkeypatch):
    """Issue #107 — le bandeau apparaît bien quand un champ requis manque."""
    import sqlite3 as _sq
    app, db_file = _make_app(mem_db, tmp_path, monkeypatch)
    conn = _sq.connect(str(db_file))
    conn.execute(
        "UPDATE user_profile SET nom=?, siren=? WHERE id=1",
        ("Valentin Dumas", ""),
    )
    conn.commit()
    conn.close()
    with app.test_client() as client:
        resp = client.get("/")
    assert resp.status_code == 200
    assert "Profil incomplet" in resp.data.decode()


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
    with patch("blueprints.pipeline.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stderr="")
        with app.test_client() as client:
            resp = client.post("/pipeline/lancer")
    assert resp.status_code in (302, 200)
    mock_run.assert_called_once()
    called_cmd = mock_run.call_args[0][0]
    assert any("run.py" in str(arg) for arg in called_cmd)


def test_post_run_error_shows_in_redirect(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("blueprints.pipeline.subprocess.run") as mock_run:
        mock_run.return_value = MagicMock(returncode=1, stderr="ERREUR GRAVE")
        with app.test_client() as client:
            resp = client.post("/pipeline/lancer")
    assert resp.status_code == 302
    assert "run_error" in resp.headers["Location"]


def test_post_open_review_no_items_redirects(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with patch("blueprints.factures.subprocess.Popen") as mock_popen:
        with app.test_client() as client:
            resp = client.post("/factures/ouvrir-revision")
    assert resp.status_code == 302
    mock_popen.assert_not_called()


def test_post_open_review_with_items_opens_file(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    (tmp_path / "data" / "profiles" / "test-profile" / "review" / "review.csv").touch()
    with patch("blueprints.factures.subprocess.Popen") as mock_popen:
        with app.test_client() as client:
            resp = client.post("/factures/ouvrir-revision")
    assert resp.status_code == 302
    mock_popen.assert_called_once()


# ── Review inline ─────────────────────────────────────────────────────────────

def test_query_items_a_reviser_empty(mem_db):
    from queries import query_items_a_reviser
    assert query_items_a_reviser(mem_db, 2025) == []


def test_query_items_a_reviser_populated(mem_db):
    from queries import query_items_a_reviser
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="done1", statut_révision="validé", exercice_fiscal=2025)
    items = query_items_a_reviser(mem_db, 2025)
    ids = [i["id"] for i in items]
    assert "rev1" in ids
    assert "done1" not in ids


def test_query_items_a_reviser_includes_null_exercice(mem_db):
    """Les items à réviser sans exercice_fiscal (date non extraite) doivent
    rester visibles — c'est précisément ce que l'utilisateur doit revoir."""
    from queries import query_items_a_reviser
    _insert_invoice(mem_db, id="rev_null", statut_révision="à_réviser",
                    exercice_fiscal=None, date_document=None)
    _insert_invoice(mem_db, id="rev_2025", statut_révision="à_réviser",
                    exercice_fiscal=2025)
    items = query_items_a_reviser(mem_db, 2026)
    ids = [i["id"] for i in items]
    assert "rev_null" in ids
    assert "rev_2025" in ids


def test_onglet_a_reviser_trie_par_confiance_decroissante(mem_db):
    """L'onglet « À réviser » classe les factures de la plus confiante à la
    moins confiante, pour que l'humain commence par les cas évidents et
    finisse par les plus douteux (issue #115)."""
    from queries import query_items_a_reviser

    # Given trois factures à réviser avec des niveaux de confiance distincts
    _insert_invoice(mem_db, id="fact_douteuse", statut_révision="à_réviser",
                    confiance=0.30, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="fact_confiante", statut_révision="à_réviser",
                    confiance=0.78, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="fact_intermédiaire", statut_révision="à_réviser",
                    confiance=0.55, exercice_fiscal=2025)

    # When on demande la liste des items à réviser
    items = query_items_a_reviser(mem_db, 2025)

    # Then l'ordre va du plus confiant au moins confiant
    assert [i["id"] for i in items] == [
        "fact_confiante",
        "fact_intermédiaire",
        "fact_douteuse",
    ]


def test_onglet_a_reviser_place_les_confiances_inconnues_en_dernier(mem_db):
    """Une facture sans confiance calculée (NULL) ne doit pas masquer les
    cas notés : on la place après les factures dont la confiance est connue."""
    from queries import query_items_a_reviser

    # Given une facture sans confiance et une facture peu confiante
    _insert_invoice(mem_db, id="fact_sans_score", statut_révision="à_réviser",
                    confiance=None, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="fact_peu_confiante", statut_révision="à_réviser",
                    confiance=0.10, exercice_fiscal=2025)

    # When on liste les items à réviser
    items = query_items_a_reviser(mem_db, 2025)

    # Then la facture sans score est reléguée en fin de liste
    assert [i["id"] for i in items] == ["fact_peu_confiante", "fact_sans_score"]


def test_index_year_choices_exclude_null_exercice(mem_db, tmp_path, monkeypatch):
    """La liste déroulante des années ne doit jamais contenir 'None'."""
    _insert_invoice(mem_db, id="dated", statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="undated", statut_révision="à_réviser",
                    exercice_fiscal=None, date_document=None)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert resp.status_code == 200
    body = resp.get_data(as_text=True)
    # Le <select name="year"> ne doit pas exposer d'option "None".
    assert '<option value="None"' not in body
    assert ">None<" not in body or "Aucune facture" in body  # sanité minimale


def test_post_review_save_validates_item(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.patch("/factures/rev1", data={
            "type_document": "facture_reçue",
            "montant_ht": "100.0",
            "montant_tva": "20.0",
            "date_document": "2025-03-01",
            "émetteur_nom": "OVH SAS",
            "numéro_facture": "FR001",
            "catégorie": "hébergement",
            "notes_correction": "",
        })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ok"] is True
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
        client.patch("/factures/rev2", data={
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
        resp = client.patch("/factures/nonexistent", data={
            "type_document": "facture_reçue", "montant_ht": "10",
            "montant_tva": "2", "date_document": "", "émetteur_nom": "",
            "numéro_facture": "", "catégorie": "", "notes_correction": "",
        })
    assert resp.status_code == 404
    assert resp.get_json()["ok"] is False


def test_post_review_save_rejects_non_iso_date(mem_db, tmp_path, monkeypatch):
    """PATCH /factures/<id> doit refuser une date qui n'est pas au format YYYY-MM-DD
    pour préserver l'invariant 'exercice_fiscal = date_document[:4]' (issue #122)."""
    _insert_invoice(mem_db, id="rev-date", statut_révision="à_réviser",
                    date_document="2025-03-01", émetteur_nom="ACME",
                    montant_ttc=100.0, exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.patch("/factures/rev-date", data={
            "montant_ttc": "99.99",
            "date_document": "BAD_DATE_FORMAT",
        })
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ok"] is False
    assert "date_document" in data["errors"]
    assert "YYYY-MM-DD" in data["errors"]["date_document"]
    # La DB ne doit PAS contenir la date corrompue.
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT date_document, statut_révision FROM invoices WHERE id='rev-date'"
    ).fetchone()
    check.close()
    assert row["date_document"] == "2025-03-01"
    assert row["statut_révision"] == "à_réviser"


def test_delete_unknown_id_returns_404(mem_db, tmp_path, monkeypatch):
    """DELETE /factures/<id> on unknown id must return 404, not silent 200."""
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.delete("/factures/nonexistent")
    assert resp.status_code == 404
    data = resp.get_json()
    assert data["ok"] is False
    assert "introuvable" in data["error"].lower()


def test_supprimer_form_unknown_id_redirects_with_flash(mem_db, tmp_path, monkeypatch):
    """POST /factures/<id>/supprimer on unknown id flashes error and redirects."""
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/nonexistent/supprimer", data={"year": "2025"})
    assert resp.status_code == 302
    assert "/?year=2025" in resp.headers["Location"]


def test_valider_unknown_id_redirects_with_flash(mem_db, tmp_path, monkeypatch):
    """POST /factures/<id>/valider on unknown id flashes error and redirects."""
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/nonexistent/valider", data={"year": "2025"})
    assert resp.status_code == 302
    assert "/?year=2025" in resp.headers["Location"]


def test_restaurer_unknown_id_redirects_with_flash(mem_db, tmp_path, monkeypatch):
    """POST /factures/<id>/restaurer on unknown id flashes error and redirects."""
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/nonexistent/restaurer", data={"year": "2025"})
    assert resp.status_code == 302
    assert "/?year=2025" in resp.headers["Location"]


def test_restaurer_on_active_facture_redirects_with_flash(mem_db, tmp_path, monkeypatch):
    """POST /factures/<id>/restaurer on a non-deleted row must flash and redirect."""
    _insert_invoice(mem_db, id="alive-rest", statut_révision="validé", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/alive-rest/restaurer", data={"year": "2025"})
    assert resp.status_code == 302
    # Row must remain validé (untouched)
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT statut_révision FROM invoices WHERE id='alive-rest'").fetchone()
    check.close()
    assert row["statut_révision"] == "validé"


def test_reinitialiser_unknown_id_redirects_with_flash(mem_db, tmp_path, monkeypatch):
    """POST /factures/<id>/reinitialiser on unknown id flashes error and redirects."""
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/nonexistent/reinitialiser", data={"year": "2025"})
    assert resp.status_code == 302
    assert "/?year=2025" in resp.headers["Location"]


def test_post_review_save_invalid_amount_returns_errors(mem_db, tmp_path, monkeypatch):
    """Non-numeric montant → ok=False with per-field errors dict, no DB write."""
    _insert_invoice(mem_db, id="rev-amt", statut_révision="à_réviser", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.patch("/factures/rev-amt", data={
            "montant_ht": "abc",
            "montant_tva": "not-a-number",
            "date_document": "2025-03-01",
        })
    data = resp.get_json()
    assert data["ok"] is False
    assert "montant_ht" in data["errors"] or "montant_tva" in data["errors"]
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT statut_révision FROM invoices WHERE id='rev-amt'").fetchone()
    check.close()
    assert row["statut_révision"] == "à_réviser"


def test_post_review_save_missing_date_returns_error(mem_db, tmp_path, monkeypatch):
    """No date in form and no date in DB → error on date_document field."""
    _insert_invoice(mem_db, id="rev-date", statut_révision="à_réviser",
                    exercice_fiscal=2025, date_document=None,
                    montant_ht=100.0, montant_ttc=120.0)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.patch("/factures/rev-date", data={
            "montant_ht": "100.0",
            "date_document": "",
        })
    data = resp.get_json()
    assert data["ok"] is False
    assert "date_document" in data["errors"]


def test_post_review_save_validated_low_confidence_demotes(mem_db, tmp_path, monkeypatch):
    """Validated item corrected to confidence < 0.8 must be demoted back to à_réviser."""
    # Insert with statut_révision=validé and minimal DB data (no fiscal_id, no invoice_num)
    # so that posting date+ht only yields 2/5 fields → confidence 0.4 < 0.8
    _insert_invoice(mem_db, id="rev-dem", statut_révision="validé",
                    exercice_fiscal=2025, date_document="2025-03-01",
                    montant_ht=100.0, montant_ttc=None, montant_tva=None)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.patch("/factures/rev-dem", data={
            "date_document": "2025-03-01",
            "montant_ht": "100.0",
            # no numéro_facture, no montant_ttc, no émetteur_siren in DB → 2/5 = 0.4
        })
    data = resp.get_json()
    assert data["ok"] is True
    assert data["warning"] is not None
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT statut_révision, confiance FROM invoices WHERE id='rev-dem'").fetchone()
    check.close()
    assert row["statut_révision"] == "à_réviser"
    assert row["confiance"] < 0.8


def test_post_review_save_facture_validée_sasu_au_dessus_150_sans_taux_est_rétrogradée(
    mem_db, tmp_path, monkeypatch,
):
    """Given une facture validée à 200 € TTC sans taux TVA, sur un profil SASU,
    When un humain sauvegarde sans renseigner le taux,
    Then la facture repasse en « à réviser » avec un warning citant le seuil."""
    # Given : profil SASU + facture validée à 200 € TTC, taux et HT/TVA NULL
    # pour qu'aucune inférence ne reconstruise un taux à partir des montants.
    # On garde un SIREN émetteur pour que la confiance reste ≥ 0.8 (4/5
    # champs : date, ttc, num, fiscal_id) et que la démotion observée soit
    # bien attribuable à la règle "TTC ≥ 150 € sans taux", pas à la confiance.
    _insert_invoice(mem_db, id="taux-dem", statut_révision="validé",
                    exercice_fiscal=2025, date_document="2025-03-01",
                    émetteur_nom="ACME", émetteur_siren="123456789",
                    numéro_facture="F001",
                    montant_ht=None, montant_ttc=200.0, montant_tva=None,
                    taux_tva=None)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    import sqlite3 as _sq
    conn = _sq.connect(str(db_path))
    conn.execute("UPDATE user_profile SET fiscal_profile='SASU' WHERE id=1")
    conn.commit()
    conn.close()

    # When : on sauvegarde sans renseigner taux_tva (ni HT ni TVA)
    with app.test_client() as client:
        resp = client.patch("/factures/taux-dem", data={
            "date_document": "2025-03-01",
            "montant_ttc": "200.0",
            "numéro_facture": "F001",
            "émetteur_nom": "ACME",
            # taux_tva, montant_ht, montant_tva absents du form
        })

    # Then : démotion + warning explicite sur le seuil
    data = resp.get_json()
    assert data["ok"] is True
    assert data["warning"] is not None
    assert "150" in data["warning"]
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT statut_révision FROM invoices WHERE id='taux-dem'"
    ).fetchone()
    check.close()
    assert row["statut_révision"] == "à_réviser"


def test_post_review_save_corrections_log_appended_on_post_validation_edit(mem_db, tmp_path, monkeypatch):
    """Editing an already-validated item appends a diff entry to corrections_log."""
    import json as _json
    _insert_invoice(mem_db, id="rev-log", statut_révision="validé",
                    exercice_fiscal=2025, émetteur_nom="Ancien Nom",
                    date_document="2025-03-01", montant_ht=100.0,
                    montant_ttc=120.0, numéro_facture="FR001")
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.patch("/factures/rev-log", data={
            "date_document": "2025-03-01",
            "montant_ht": "100.0",
            "montant_ttc": "120.0",
            "numéro_facture": "FR001",
            "émetteur_nom": "Nouveau Nom",
        })
    assert resp.get_json()["ok"] is True
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT corrections_log FROM invoices WHERE id='rev-log'").fetchone()
    check.close()
    log = _json.loads(row["corrections_log"])
    assert len(log) >= 1
    champs = [entry["champ"] for entry in log]
    assert "émetteur_nom" in champs
    nom_entry = next(e for e in log if e["champ"] == "émetteur_nom")
    assert nom_entry["avant"] == "Ancien Nom"
    assert nom_entry["après"] == "Nouveau Nom"


# ── Catégorie : selectbox depuis le référentiel Paramètres ────────────────────

def test_save_facture_avec_catégorie_enregistrée_est_acceptée(mem_db, tmp_path, monkeypatch):
    """Given une facture à réviser et une catégorie présente dans le référentiel,
    When on enregistre la facture avec cette catégorie,
    Then la sauvegarde réussit et la catégorie est persistée."""
    # Given
    _insert_invoice(mem_db, id="cat-ok", statut_révision="à_réviser",
                    exercice_fiscal=2025, montant_ttc=120.0,
                    date_document="2025-03-01", émetteur_nom="ACME")
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

    # When : 'transport' fait partie du seed _DEFAULT_CATEGORY_TVA_RATES
    with app.test_client() as client:
        resp = client.patch("/factures/cat-ok", data={
            "montant_ttc": "120.0",
            "date_document": "2025-03-01",
            "émetteur_nom": "ACME",
            "catégorie": "transport",
        })

    # Then
    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT catégorie FROM invoices WHERE id='cat-ok'").fetchone()
    check.close()
    assert row["catégorie"] == "transport"


def test_save_facture_avec_catégorie_inconnue_est_rejetée(mem_db, tmp_path, monkeypatch):
    """Given une facture et une catégorie absente du référentiel,
    When on tente d'enregistrer avec cette catégorie,
    Then la requête échoue avec une erreur de champ et la DB n'est pas modifiée."""
    # Given
    _insert_invoice(mem_db, id="cat-ko", statut_révision="à_réviser",
                    exercice_fiscal=2025, montant_ttc=120.0,
                    date_document="2025-03-01", émetteur_nom="ACME",
                    catégorie=None)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.patch("/factures/cat-ko", data={
            "montant_ttc": "120.0",
            "date_document": "2025-03-01",
            "émetteur_nom": "ACME",
            "catégorie": "catégorie_qui_n_existe_pas",
        })

    # Then
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ok"] is False
    assert "catégorie" in data["errors"]
    assert "inconnue" in data["errors"]["catégorie"].lower()
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT catégorie, statut_révision FROM invoices WHERE id='cat-ko'").fetchone()
    check.close()
    assert row["catégorie"] is None
    assert row["statut_révision"] == "à_réviser"


def test_save_facture_avec_catégorie_vide_efface_la_valeur(mem_db, tmp_path, monkeypatch):
    """Given une facture déjà catégorisée,
    When l'utilisateur enregistre avec '(aucune)' (chaîne vide),
    Then la catégorie est effacée en base."""
    # Given
    _insert_invoice(mem_db, id="cat-clear", statut_révision="à_réviser",
                    exercice_fiscal=2025, montant_ttc=120.0,
                    date_document="2025-03-01", émetteur_nom="ACME",
                    catégorie="transport")
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.patch("/factures/cat-clear", data={
            "montant_ttc": "120.0",
            "date_document": "2025-03-01",
            "émetteur_nom": "ACME",
            "catégorie": "",
        })

    # Then : '(aucune)' = chaîne vide = effacement explicite → NULL
    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT catégorie FROM invoices WHERE id='cat-clear'").fetchone()
    check.close()
    assert row["catégorie"] is None


def test_carte_affiche_select_avec_catégories_enregistrées(mem_db, tmp_path, monkeypatch):
    """Given un référentiel de catégories TVA seedé au boot,
    When l'utilisateur charge le dashboard avec une facture à réviser,
    Then la carte expose un <select name='catégorie'> contenant les catégories du référentiel."""
    # Given
    _insert_invoice(mem_db, id="ui-cat", statut_révision="à_réviser",
                    exercice_fiscal=2025, montant_ttc=120.0,
                    date_document="2025-03-01", émetteur_nom="ACME",
                    catégorie="transport")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.get("/?year=2025")

    # Then
    assert resp.status_code == 200
    html = resp.data.decode("utf-8")
    # Le <select> est rendu (au moins une fois pour la carte items_a_reviser)
    assert 'name="catégorie"' in html
    assert '<select class="review-select"' in html
    # Les catégories seedées apparaissent comme <option>
    assert '<option value="transport"' in html
    assert '<option value="hébergement"' in html
    # L'option (aucune) est présente
    assert '(aucune)</option>' in html
    # 'transport' est pré-sélectionnée pour cette facture
    assert 'value="transport" selected' in html


def test_carte_signale_catégorie_legacy_avec_mention_non_enregistrée(mem_db, tmp_path, monkeypatch):
    """Given une facture dont la catégorie n'est plus dans le référentiel,
    When l'utilisateur charge le dashboard,
    Then la valeur orpheline est préservée et signalée '(non enregistrée)'."""
    # Given : 'catégorie_legacy_obsolete' n'est pas dans _DEFAULT_CATEGORY_TVA_RATES
    _insert_invoice(mem_db, id="ui-legacy", statut_révision="à_réviser",
                    exercice_fiscal=2025, montant_ttc=120.0,
                    date_document="2025-03-01", émetteur_nom="ACME",
                    catégorie="catégorie_legacy_obsolete")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.get("/?year=2025")

    # Then
    assert resp.status_code == 200
    html = resp.data.decode("utf-8")
    assert "catégorie_legacy_obsolete (non enregistrée)" in html
    assert 'value="catégorie_legacy_obsolete" selected' in html


# ── Formulaire de révision : champs visibles selon le profil fiscal ───────────

def test_formulaire_revision_pour_auto_entrepreneur_n_affiche_qu_un_champ_montant(
    mem_db, tmp_path, monkeypatch,
):
    """Given un AE en franchise et un item à réviser,
    When on rend le dashboard,
    Then le formulaire expose un seul input « Montant » (name='montant_ttc')
    et aucun input HT / TVA / Taux."""
    # Given : _make_app insère par défaut un profil 'auto-entrepreneur'.
    _insert_invoice(mem_db, id="ae-rev", statut_révision="à_réviser",
                    exercice_fiscal=2025, montant_ttc=120.0,
                    date_document="2025-03-01", émetteur_nom="ACME")
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.get("/?year=2025")

    # Then
    assert resp.status_code == 200
    html = resp.data.decode("utf-8")
    assert 'name="montant_ttc"' in html
    assert 'name="montant_ht"' not in html
    assert 'name="montant_tva"' not in html
    assert 'name="taux_tva"' not in html


def test_formulaire_revision_pour_sasu_affiche_les_quatre_champs_montant(
    mem_db, tmp_path, monkeypatch,
):
    """Given un profil SASU et un item à réviser,
    When on rend le dashboard,
    Then les inputs HT, TVA, Taux et TTC sont tous présents."""
    # Given : on insère l'item, on construit l'app, puis on bascule le profil
    # en SASU avant de servir la page (cf. test_post_review_save_facture_validée_sasu_*).
    _insert_invoice(mem_db, id="sasu-rev", statut_révision="à_réviser",
                    exercice_fiscal=2025, montant_ht=100.0, montant_tva=20.0,
                    montant_ttc=120.0, taux_tva=0.20,
                    date_document="2025-03-01", émetteur_nom="ACME")
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    import sqlite3 as _sq
    conn = _sq.connect(str(db_path))
    conn.execute("UPDATE user_profile SET fiscal_profile='SASU' WHERE id=1")
    conn.commit()
    conn.close()

    # When
    with app.test_client() as client:
        resp = client.get("/?year=2025")

    # Then
    assert resp.status_code == 200
    html = resp.data.decode("utf-8")
    assert 'name="montant_ht"' in html
    assert 'name="montant_tva"' in html
    assert 'name="taux_tva"' in html
    assert 'name="montant_ttc"' in html


# ── Numéro de facture : requis pour les pièces émises uniquement ──────────────

def test_facture_emise_sans_numero_est_refusee(mem_db, tmp_path, monkeypatch):
    """Given une facture émise sans numéro,
    When on PATCH /factures/<id> sans numéro_facture,
    Then errors['numéro_facture'] est renvoyé et le statut DB reste à_réviser."""
    # Given
    _insert_invoice(mem_db, id="emise-sans-num", statut_révision="à_réviser",
                    type_document="facture_émise", exercice_fiscal=2025,
                    montant_ttc=120.0, date_document="2025-03-01",
                    destinataire_nom="Client SARL", émetteur_nom="Moi SAS",
                    numéro_facture=None)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.patch("/factures/emise-sans-num", data={
            "type_document": "facture_émise",
            "montant_ttc": "120.0",
            "date_document": "2025-03-01",
            "émetteur_nom": "Moi SAS",
            "numéro_facture": "",
        })

    # Then
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["ok"] is False
    assert "numéro_facture" in data["errors"]
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT statut_révision FROM invoices WHERE id='emise-sans-num'"
    ).fetchone()
    check.close()
    assert row["statut_révision"] == "à_réviser"


def test_facture_recue_sans_numero_est_acceptee(mem_db, tmp_path, monkeypatch):
    """Given une facture reçue (charge) sans numéro,
    When on PATCH /factures/<id> sans numéro_facture,
    Then ok=True : le numéro reste optionnel sur les pièces reçues."""
    # Given
    _insert_invoice(mem_db, id="recue-sans-num", statut_révision="à_réviser",
                    type_document="facture_reçue", exercice_fiscal=2025,
                    montant_ttc=39.99, date_document="2025-03-01",
                    émetteur_nom="OVH SAS", numéro_facture=None)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.patch("/factures/recue-sans-num", data={
            "type_document": "facture_reçue",
            "montant_ttc": "39.99",
            "date_document": "2025-03-01",
            "émetteur_nom": "OVH SAS",
            "numéro_facture": "",
        })

    # Then
    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True


def test_save_piece_recue_ae_avec_ttc_seul_n_ecrase_pas_les_ht_tva_ocr(
    mem_db, tmp_path, monkeypatch,
):
    """Given un AE et une pièce reçue dont l'OCR a extrait HT=33.33, TVA=6.66, TTC=39.99,
    When l'utilisateur PATCH avec uniquement montant_ttc=39.99,
    Then la DB conserve HT=33.33, TVA=6.66 et TTC=39.99 — la TVA fournisseur
    extraite par l'OCR ne doit pas être effacée par la simplification UI."""
    # Given
    _insert_invoice(mem_db, id="ae-recue", statut_révision="à_réviser",
                    type_document="facture_reçue", exercice_fiscal=2025,
                    montant_ht=33.33, montant_tva=6.66, montant_ttc=39.99,
                    taux_tva=0.20, date_document="2025-03-01",
                    émetteur_nom="OVH SAS")
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

    # When : formulaire AE simplifié — n'envoie que montant_ttc.
    with app.test_client() as client:
        resp = client.patch("/factures/ae-recue", data={
            "type_document": "facture_reçue",
            "montant_ttc": "39.99",
            "date_document": "2025-03-01",
            "émetteur_nom": "OVH SAS",
        })

    # Then : la sauvegarde réussit et les montants OCR sont préservés.
    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT montant_ht, montant_tva, montant_ttc FROM invoices WHERE id='ae-recue'"
    ).fetchone()
    check.close()
    assert abs(row["montant_ht"] - 33.33) < 0.01
    assert abs(row["montant_tva"] - 6.66) < 0.01
    assert abs(row["montant_ttc"] - 39.99) < 0.01


def test_post_review_delete(mem_db, tmp_path, monkeypatch):
    """Delete must soft-delete (set deleted_at), not remove the row."""
    _insert_invoice(mem_db, id="del1", statut_révision="à_réviser", exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/del1/supprimer")
    assert resp.status_code == 302
    # Issues #110 #111 : on revient sur l'onglet Corbeille pour confirmer
    # visuellement où l'item a atterri — pas sur Ledger (défaut sans fragment).
    assert resp.headers["Location"].endswith("#corbeille")
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute("SELECT deleted_at, deleted_by FROM invoices WHERE id='del1'").fetchone()
    check.close()
    assert row is not None, "Row must still exist after soft delete"
    assert row["deleted_at"] is not None
    assert row["deleted_by"] == "user"


def test_soft_deleted_excluded_from_fiscal_summary(mem_db):
    from queries import query_fiscal_summary
    _insert_invoice(mem_db, id="alive", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", type_document="facture_émise",
                    montant_ht=500.0, montant_tva=100.0, exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    s = query_fiscal_summary(mem_db, 2025)
    assert s["ca_ht"] == 1000.0


def test_soft_deleted_excluded_from_ledger(mem_db):
    from queries import query_ledger
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
    from queries import query_items_a_reviser
    _insert_invoice(mem_db, id="alive", statut_révision="à_réviser", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", statut_révision="à_réviser", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    items = query_items_a_reviser(mem_db, 2025)
    ids = [i["id"] for i in items]
    assert "alive" in ids
    assert "dead" not in ids


def test_query_corbeille_returns_deleted_rows(mem_db):
    from queries import query_corbeille
    _insert_invoice(mem_db, id="alive", statut_révision="validé", exercice_fiscal=2025)
    _insert_invoice(mem_db, id="dead", statut_révision="à_réviser", exercice_fiscal=2025,
                    deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user")
    rows = query_corbeille(mem_db, 2025)
    ids = [r["id"] for r in rows]
    assert "dead" in ids
    assert "alive" not in ids


def test_post_review_restore_preserves_validated_status(mem_db, tmp_path, monkeypatch):
    """Restaurer une facture supprimée alors qu'elle était `validé` doit la
    rendre `validé` à nouveau, sans repasser par « à réviser » (sinon la
    validation humaine effectuée avant suppression est perdue)."""
    _insert_invoice(
        mem_db, id="dead1", statut_révision="validé", exercice_fiscal=2025,
        révisé_par="user", date_révision="2026-05-09T00:00:00+00:00",
        validé_le="2026-05-09T00:00:00+00:00",
        deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user",
    )
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/dead1/restaurer")
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT deleted_at, statut_révision, révisé_par, validé_le "
        "FROM invoices WHERE id='dead1'"
    ).fetchone()
    check.close()
    assert row["deleted_at"] is None
    assert row["statut_révision"] == "validé"
    assert row["révisé_par"] == "user"
    assert row["validé_le"] == "2026-05-09T00:00:00+00:00"


def test_post_review_restore_preserves_a_reviser_status(mem_db, tmp_path, monkeypatch):
    """Cas symétrique : une facture supprimée alors qu'elle était `à_réviser`
    doit revenir `à_réviser`."""
    _insert_invoice(
        mem_db, id="dead2", statut_révision="à_réviser", exercice_fiscal=2025,
        deleted_at="2026-05-10T00:00:00+00:00", deleted_by="user",
    )
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/factures/dead2/restaurer")
    assert resp.status_code == 302
    import sqlite3 as _sq
    check = _sq.connect(str(db_path))
    check.row_factory = _sq.Row
    row = check.execute(
        "SELECT deleted_at, statut_révision FROM invoices WHERE id='dead2'"
    ).fetchone()
    check.close()
    assert row["deleted_at"] is None
    assert row["statut_révision"] == "à_réviser"


def test_get_root_shows_review_section(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="rev3", statut_révision="à_réviser", exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert b'id="tab-reviser"' in resp.data


def test_get_root_no_review_section(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/")
    assert b'id="tab-reviser"' in resp.data
    assert b'aria-disabled="true"' in resp.data


# ── /errors routes ────────────────────────────────────────────────────────────

def test_errors_retry_moves_file(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    profile_dir = tmp_path / "data" / "profiles" / "test-profile"
    errors_dir  = profile_dir / "errors"
    input_dir   = profile_dir / "input"
    f = errors_dir / "broken.pdf"
    f.write_bytes(b"fake pdf")

    import blueprints.pipeline as _bp_pipeline
    monkeypatch.setattr(_bp_pipeline.threading, "Thread", MagicMock)

    with app.test_client() as client:
        resp = client.post("/pipeline/erreurs/broken.pdf/reessayer")

    assert resp.status_code == 200
    assert resp.get_json()["ok"] is True
    assert not f.exists()
    assert (input_dir / "broken.pdf").exists()


def test_errors_retry_404_if_missing(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/pipeline/erreurs/nonexistent.pdf/reessayer")
    assert resp.status_code == 404


def test_errors_delete_removes_file(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    profile_dir = tmp_path / "data" / "profiles" / "test-profile"
    errors_dir  = profile_dir / "errors"
    f = errors_dir / "broken.pdf"
    f.write_bytes(b"fake pdf")

    with app.test_client() as client:
        resp = client.post("/pipeline/erreurs/broken.pdf", data={"year": "2025"})

    assert resp.status_code == 302
    assert not f.exists()


def test_errors_delete_404_if_missing(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/pipeline/erreurs/nonexistent.pdf", data={"year": "2025"})
    assert resp.status_code == 404


def test_errors_delete_rejects_path_traversal(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post("/pipeline/erreurs/../../etc/passwd", data={"year": "2025"})
    assert resp.status_code == 404


def test_errors_list_in_template(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    profile_dir = tmp_path / "data" / "profiles" / "test-profile"
    (profile_dir / "errors" / "broken.pdf").write_bytes(b"x")

    with app.test_client() as client:
        resp = client.get("/?year=2025", follow_redirects=True)

    assert b"broken.pdf" in resp.data
    assert "Erreurs (1)".encode() in resp.data

# ── Unit tests for helper functions (#28) ─────────────────────────────────────

def test_parse_review_fields_valid():
    
    form = {"montant_ht": "100.5", "montant_tva": "20.1", "date_document": "2025-03-01",
            "émetteur_nom": "ACME", "numéro_facture": "FR001", "catégorie": "logiciel", "notes_correction": ""}
    fields, errors = _parse_review_fields(form)
    assert errors == {}
    assert abs(fields["montant_ht"] - 100.5) < 0.001
    assert abs(fields["montant_tva"] - 20.1) < 0.001
    assert fields["date_document"] == "2025-03-01"

def test_parse_review_fields_comma_decimal():
    
    form = {"montant_ht": "99,90", "montant_ttc": "119,88"}
    fields, errors = _parse_review_fields(form)
    assert errors == {}
    assert abs(fields["montant_ht"] - 99.90) < 0.001

def test_parse_review_fields_invalid_float():
    
    form = {"montant_ht": "not-a-number", "montant_tva": "abc"}
    fields, errors = _parse_review_fields(form)
    assert "montant_ht" in errors
    assert "montant_tva" in errors
    assert "montant_ht" not in fields

def test_parse_review_fields_empty_strings_ignored():
    
    form = {"montant_ht": "", "émetteur_nom": "", "date_document": ""}
    fields, errors = _parse_review_fields(form)
    assert errors == {}
    assert "montant_ht" not in fields
    assert "émetteur_nom" not in fields

def test_validate_review_fields_missing_date(mem_db):
    
    mem_db.execute(
        'INSERT INTO invoices (id, date_document) VALUES (?, NULL)',
        ("no-date-item",)
    )
    mem_db.commit()
    fields = {"montant_ht": 100.0}
    errors = _validate_review_fields(fields, {}, mem_db, "no-date-item")
    assert "date_document" in errors

def test_validate_review_fields_missing_amounts(mem_db):
    
    mem_db.execute(
        'INSERT INTO invoices (id, montant_ht, montant_ttc) VALUES (?, NULL, NULL)',
        ("no-amt-item",)
    )
    mem_db.commit()
    fields = {}
    current = {"montant_ht": None, "montant_ttc": None}
    errors = _validate_review_fields(fields, current, mem_db, "no-amt-item")
    assert "montant_ht" in errors

def test_validate_review_fields_missing_emitter(mem_db):
    """Émetteur vide en formulaire ET en base → erreur dédiée (fix #70)."""
    mem_db.execute(
        'INSERT INTO invoices (id, date_document, montant_ht, émetteur_nom) VALUES (?, ?, ?, NULL)',
        ("no-emitter", "2025-03-01", 100.0)
    )
    mem_db.commit()
    fields = {"date_document": "2025-03-01", "montant_ht": 100.0}
    current = {"émetteur_nom": None, "montant_ht": 100.0, "montant_ttc": None}
    errors = _validate_review_fields(fields, current, mem_db, "no-emitter")
    assert "émetteur_nom" in errors


def test_validate_review_fields_zero_ht_is_valid(mem_db):
    
    mem_db.execute(
        'INSERT INTO invoices (id, date_document, montant_ht) VALUES (?, ?, ?)',
        ("zero-ht-item", "2025-03-01", 0.0)
    )
    mem_db.commit()
    fields = {"montant_ht": 0.0, "date_document": "2025-03-01"}
    current = {"montant_ht": 0.0, "montant_ttc": None}
    errors = _validate_review_fields(fields, current, mem_db, "zero-ht-item")
    assert "montant_ht" not in errors

def test_recompute_confidence_high():
    
    fields = {"date_document": "2025-03-01", "montant_ttc": 120.0, "montant_ht": 100.0, "numéro_facture": "FR001"}
    current = {"statut_révision": "à_réviser", "émetteur_siren": "123456789", "émetteur_tva_intracom": None}
    confidence, warning = _recompute_confidence(fields, current)
    assert confidence == 1.0
    assert warning is None

def test_recompute_confidence_low_warns_when_validated():
    
    fields = {"date_document": "2025-03-01", "montant_ht": 100.0}
    current = {
        "statut_révision": "validé",
        "montant_ttc": None, "numéro_facture": None,
        "émetteur_siren": None, "émetteur_tva_intracom": None,
    }
    confidence, warning = _recompute_confidence(fields, current)
    assert confidence < 0.8
    assert warning is not None
    assert "À réviser" in warning or "réviser" in warning.lower()

def test_recompute_confidence_no_warning_when_a_reviser():
    
    fields = {"montant_ht": 50.0}
    current = {
        "statut_révision": "à_réviser",
        "date_document": None, "montant_ttc": None,
        "numéro_facture": None, "émetteur_siren": None, "émetteur_tva_intracom": None,
    }
    _, warning = _recompute_confidence(fields, current)
    assert warning is None

def test_build_corrections_log_new_item():
    import json as _json
    
    fields = {"montant_ht": 100.0, "date_document": "2025-03-01"}
    current = {"statut_révision": "à_réviser", "corrections_log": "[]",
               "montant_ht": None, "date_document": None, "montant_ttc": None}
    result = _build_corrections_log(fields, current, "2025-03-01T10:00:00+00:00", None)
    assert result["statut_révision"] == "validé"
    assert result["révisé_par"] == "user"

def test_build_corrections_log_validated_item_logs_diff():
    import json as _json
    
    current = {
        "statut_révision": "validé",
        "corrections_log": "[]",
        "émetteur_nom": "Ancien Nom",
        "montant_ht": 100.0,
        "montant_ttc": None,
    }
    fields = {"émetteur_nom": "Nouveau Nom"}
    result = _build_corrections_log(fields, current, "2025-03-01T10:00:00+00:00", None)
    log = _json.loads(result["corrections_log"])
    assert len(log) >= 1
    entry = next((e for e in log if e["champ"] == "émetteur_nom"), None)
    assert entry is not None
    assert entry["avant"] == "Ancien Nom"
    assert entry["après"] == "Nouveau Nom"

def test_build_corrections_log_warning_demotes():

    current = {"statut_révision": "validé", "corrections_log": "[]",
               "montant_ht": 100.0, "montant_ttc": None}
    fields = {}
    result = _build_corrections_log(fields, current, "2025-03-01T10:00:00+00:00", "Confiance basse")
    assert result["statut_révision"] == "à_réviser"


# ── Règle fiscale art. 242 nonies A : TTC ≥ 150 € sans taux TVA ───────────────

def test_facture_sasu_au_dessus_150_sans_taux_génère_un_warning():
    """Given une facture SASU à 200 € TTC sans taux TVA,
    When on applique la règle des tickets simplifiés,
    Then un warning est retourné pour rétrograder la facture."""
    from services.revision import _check_taux_manquant_si_grand_montant
    # Given
    fields = {"montant_ttc": 200.0}
    current = {"taux_tva": None, "montant_ttc": None}
    # When
    warning = _check_taux_manquant_si_grand_montant(fields, current, "SASU")
    # Then
    assert warning is not None
    assert "150" in warning


def test_facture_sasu_en_dessous_150_sans_taux_reste_sans_warning():
    """Ticket simplifié (TTC < 150 €) : la mention TVA n'est pas légalement
    requise, donc pas de démotion automatique même sans taux renseigné."""
    from services.revision import _check_taux_manquant_si_grand_montant
    fields = {"montant_ttc": 100.0}
    current = {"taux_tva": None, "montant_ttc": None}
    assert _check_taux_manquant_si_grand_montant(fields, current, "SASU") is None


def test_facture_auto_entrepreneur_au_dessus_150_sans_taux_reste_sans_warning():
    """Le profil auto-entrepreneur (franchise en base) ne déduit pas la TVA :
    la règle ne s'applique pas, peu importe le montant."""
    from services.revision import _check_taux_manquant_si_grand_montant
    fields = {"montant_ttc": 500.0}
    current = {"taux_tva": None, "montant_ttc": None}
    assert _check_taux_manquant_si_grand_montant(
        fields, current, "auto-entrepreneur"
    ) is None


def test_facture_sasu_au_dessus_150_avec_taux_renseigné_ne_génère_pas_de_warning():
    """Si le taux est renseigné, la facture est fiscalement saine."""
    from services.revision import _check_taux_manquant_si_grand_montant
    fields = {"montant_ttc": 200.0, "taux_tva": 0.20}
    current = {"taux_tva": None, "montant_ttc": None}
    assert _check_taux_manquant_si_grand_montant(fields, current, "SASU") is None


def test_warning_démotion_taux_manquant_est_loggué_dans_corrections_log():
    """La démotion motivée par un taux manquant doit laisser une trace
    auditable dans corrections_log via le mécanisme _build_corrections_log."""
    import json as _json
    current = {
        "statut_révision": "validé",
        "corrections_log": "[]",
        "montant_ttc": 200.0,
        "taux_tva": None,
    }
    fields = {}
    warning = (
        "TTC ≥ 150 € sans taux TVA — TVA non déductible sans mention explicite, "
        "item retourné en « À réviser »."
    )
    result = _build_corrections_log(
        fields, current, "2025-03-01T10:00:00+00:00", warning,
    )
    assert result["statut_révision"] == "à_réviser"


# ── Franchise en base art. 293 B CGI : neutralisation TVA pour AE ─────────────

def test_facture_emise_auto_entrepreneur_taux_tva_est_neutralisé():
    """Given une facture *émise* par un auto-entrepreneur avec un taux TVA
    parasite captée par l'OCR (20 %),
    When on applique la règle de franchise en base,
    Then la TVA est neutralisée : taux=None, montant_tva=0, TTC=HT."""
    from services.montants import normaliser_tva_selon_profil
    # Given — auto-entrepreneur émet une facture, OCR a piégé un faux 20 %
    fields = {
        "montant_ht": 100.0,
        "taux_tva": 0.20,
        "montant_tva": 20.0,
        "montant_ttc": 120.0,
    }
    # When
    normaliser_tva_selon_profil(fields, "facture_émise", "auto-entrepreneur")
    # Then — invariant franchise en base : HT = TTC, pas de TVA
    assert fields["taux_tva"] is None
    assert fields["montant_tva"] == 0.0
    assert fields["montant_ttc"] == 100.0
    assert fields["montant_ht"] == 100.0


def test_facture_recue_auto_entrepreneur_conserve_tva_fournisseur():
    """Given une facture *reçue* par un auto-entrepreneur (le fournisseur,
    lui, facture sa TVA),
    When on applique la règle de franchise en base,
    Then la TVA fournisseur est conservée — sa non-déductibilité est
    gouvernée par le drapeau `déductible`, pas par ce normaliseur."""
    from services.montants import normaliser_tva_selon_profil
    # Given — facture reçue d'un fournisseur SASU à 20 %
    fields = {
        "montant_ht": 100.0,
        "taux_tva": 0.20,
        "montant_tva": 20.0,
        "montant_ttc": 120.0,
    }
    # When
    normaliser_tva_selon_profil(fields, "facture_reçue", "auto-entrepreneur")
    # Then — donnée fournisseur intacte
    assert fields["taux_tva"] == 0.20
    assert fields["montant_tva"] == 20.0
    assert fields["montant_ttc"] == 120.0
    assert fields["montant_ht"] == 100.0


def test_facture_emise_sasu_conserve_la_tva():
    """Profil assujetti (SASU) : la règle ne s'applique pas, TVA inchangée."""
    from services.montants import normaliser_tva_selon_profil
    fields = {
        "montant_ht": 100.0,
        "taux_tva": 0.20,
        "montant_tva": 20.0,
        "montant_ttc": 120.0,
    }
    normaliser_tva_selon_profil(fields, "facture_émise", "SASU")
    assert fields["taux_tva"] == 0.20
    assert fields["montant_tva"] == 20.0
    assert fields["montant_ttc"] == 120.0


# ── Endpoints d'import et fragments ──────────────────────────────────────────

def _semer_lignes_job(db_path, job_id, files):
    """Helper : insère des lignes d'agrégat import_jobs comme le ferait /pipeline/depot."""
    from datetime import datetime, timezone
    from db import open_db
    now = datetime.now(timezone.utc).isoformat()
    conn = open_db(db_path)
    for filename, statut in files:
        conn.execute(
            "INSERT INTO import_jobs (job_id, filename, statut, créé_le, mis_à_jour_le) "
            "VALUES (?, ?, ?, ?, ?)",
            (job_id, filename, statut, now, now),
        )
    conn.commit()
    conn.close()


def test_pipeline_jobs_renvoie_statut_par_fichier(mem_db, tmp_path, monkeypatch):
    app, db_file = _make_app(mem_db, tmp_path, monkeypatch)
    _semer_lignes_job(db_file, "JOBX", [
        ("a.pdf", "terminé"),
        ("b.pdf", "en_extraction"),
    ])
    with app.test_client() as client:
        resp = client.get("/pipeline/jobs/JOBX")
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["summary"]["total"] == 2
    assert body["summary"]["terminé"] == 1
    assert body["summary"]["en_extraction"] == 1
    assert body["finished"] is False


def test_pipeline_jobs_finished_quand_tout_terminal(mem_db, tmp_path, monkeypatch):
    app, db_file = _make_app(mem_db, tmp_path, monkeypatch)
    _semer_lignes_job(db_file, "JOBY", [
        ("a.pdf", "terminé"),
        ("b.pdf", "erreur"),
        ("c.pdf", "doublon"),
    ])
    with app.test_client() as client:
        body = client.get("/pipeline/jobs/JOBY").get_json()
    assert body["finished"] is True


def test_fragment_sante_renvoie_uniquement_la_section(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/fragments/sante?year=2025")
    assert resp.status_code == 200
    body = resp.data.decode()
    assert "<html" not in body.lower()
    assert "health-grid" in body
    assert "Santé" in body


def test_fragment_synthese_fiscale_renvoie_les_kpis(mem_db, tmp_path, monkeypatch):
    _insert_invoice(mem_db, id="x1", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/fragments/synthese-fiscale?year=2025")
    assert resp.status_code == 200
    body = resp.data.decode()
    assert "<html" not in body.lower()
    assert "kpi-grid" in body
    assert "Synthèse fiscale" in body


def test_synthese_fiscale_pour_auto_entrepreneur_masque_la_carte_tva(mem_db, tmp_path, monkeypatch):
    # Given un profil auto-entrepreneur (profil par défaut de la fixture)
    _insert_invoice(mem_db, id="ae1", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When on rend le fragment synthèse fiscale
    with app.test_client() as client:
        resp = client.get("/fragments/synthese-fiscale?year=2025")

    # Then la carte « TVA à reverser » est absente, « Résultat brut » est présente
    assert resp.status_code == 200
    body = resp.data.decode()
    assert "Résultat brut" in body
    assert "TVA à reverser" not in body


def test_synthese_fiscale_pour_sasu_affiche_la_carte_tva(mem_db, tmp_path, monkeypatch):
    # Given un profil SASU
    import sqlite3 as _sq
    _insert_invoice(mem_db, id="sasu1", type_document="facture_émise",
                    montant_ht=1000.0, montant_tva=200.0, exercice_fiscal=2025)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    conn = _sq.connect(str(db_path))
    conn.execute("UPDATE user_profile SET fiscal_profile='SASU' WHERE id=1")
    conn.commit()
    conn.close()

    # When on rend le fragment synthèse fiscale
    with app.test_client() as client:
        resp = client.get("/fragments/synthese-fiscale?year=2025")

    # Then la carte « TVA à reverser » est présente
    assert resp.status_code == 200
    body = resp.data.decode()
    assert "TVA à reverser" in body


def test_synthese_fiscale_pour_ae_mentionne_la_franchise(mem_db, tmp_path, monkeypatch):
    # Given un profil auto-entrepreneur (profil par défaut de la fixture)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When on rend le fragment synthèse fiscale
    with app.test_client() as client:
        resp = client.get("/fragments/synthese-fiscale?year=2025")

    # Then un libellé mentionne « franchise en base » et l'article 293 B
    assert resp.status_code == 200
    body = resp.data.decode()
    assert "franchise en base" in body
    assert "293 B" in body


def test_pipeline_jobs_renvoie_404_pour_job_inconnu(mem_db, tmp_path, monkeypatch):
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.get("/pipeline/jobs/JOB_INEXISTANT")
    # Sans 404 le client polle indéfiniment un id erroné.
    assert resp.status_code == 404


def test_depot_renvoie_job_id_et_seme_lignes_en_attente(mem_db, tmp_path, monkeypatch):
    # On bloque le lancement du subprocess pour isoler la création du job.
    import blueprints.pipeline as _bp
    monkeypatch.setattr(_bp, "_trigger_pipeline", lambda slug, job_id=None: None)

    app, db_file = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post(
            "/pipeline/depot",
            data={"files": (__import__("io").BytesIO(b"%PDF-1.4\n%fake pdf body"), "test.pdf")},
            content_type="multipart/form-data",
        )
    body = resp.get_json()
    assert resp.status_code == 200
    assert body["ok"] is True
    assert "job_id" in body and len(body["job_id"]) > 0

    import sqlite3 as _sql
    conn = _sql.connect(db_file)
    row = conn.execute(
        "SELECT filename, statut FROM import_jobs WHERE job_id=?",
        (body["job_id"],),
    ).fetchone()
    conn.close()
    assert row == ("test.pdf", "en_attente")


def test_depot_rejette_exe_via_magic_bytes(mem_db, tmp_path, monkeypatch):
    """Un .exe (header MZ) doit être rejeté avant écriture disque.

    Depuis l'issue #108, c'est la whitelist d'extensions qui filtre en
    premier (l'extension .exe ne fait pas partie des types attendus). Le
    sniff magic bytes reste une deuxième ligne de défense pour les
    binaires renommés avec une extension autorisée.
    """
    import blueprints.pipeline as _bp
    monkeypatch.setattr(_bp, "_trigger_pipeline", lambda slug, job_id=None: None)

    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post(
            "/pipeline/depot",
            data={"files": (__import__("io").BytesIO(b"MZ\x90\x00" + b"\x00" * 60), "evil.exe")},
            content_type="multipart/form-data",
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["failed"], "le tableau failed doit contenir le fichier rejeté"
    assert body["failed"][0]["filename"] == "evil.exe"
    assert "Extension de fichier non autorisée" in body["failed"][0]["reason"]


def test_depot_rejette_binaire_renomme_pdf(mem_db, tmp_path, monkeypatch):
    """Un binaire avec extension autorisée mais magic bytes invalides doit
    être rejeté par la deuxième ligne de défense (sniff)."""
    import blueprints.pipeline as _bp
    monkeypatch.setattr(_bp, "_trigger_pipeline", lambda slug, job_id=None: None)

    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post(
            "/pipeline/depot",
            data={"files": (__import__("io").BytesIO(b"MZ\x90\x00" + b"\x00" * 60), "evil.pdf")},
            content_type="multipart/form-data",
        )
    body = resp.get_json()
    assert body["failed"][0]["filename"] == "evil.pdf"
    assert body["failed"][0]["reason"] == "type non supporté"

    # Le fichier ne doit PAS atterrir dans input/.
    input_dir = _bp.resolve_paths("test-profile")["input"]
    assert not (input_dir / "evil.exe").exists()


def test_depot_rejette_fichier_deja_importe(mem_db, tmp_path, monkeypatch):
    """Issue #109 : un fichier dont le hash existe déjà en base est rejeté
    à l'upload — sinon il atterrit dans input/, n'est pas réingéré, mais
    bloque la carte 'Fichiers en attente'."""
    import hashlib as _hash
    import blueprints.pipeline as _bp
    monkeypatch.setattr(_bp, "_trigger_pipeline", lambda slug, job_id=None: None)

    body = b"%PDF-1.7\n%body original"
    file_hash = _hash.sha256(body).hexdigest()

    app, db_file = _make_app(mem_db, tmp_path, monkeypatch)
    # Sème une facture portant le même hash.
    import sqlite3 as _sql
    conn = _sql.connect(db_file)
    conn.execute(
        "INSERT INTO invoices (id, hash_fichier, type_document, exercice_fiscal) "
        "VALUES (?, ?, 'facture_reçue', 2025)",
        ("INV-EXIST", file_hash),
    )
    conn.commit()
    conn.close()

    with app.test_client() as client:
        resp = client.post(
            "/pipeline/depot",
            data={"files": (__import__("io").BytesIO(body), "deja-vu.pdf")},
            content_type="multipart/form-data",
        )
    assert resp.status_code == 200
    payload = resp.get_json()
    assert payload["ok"] is False  # aucun fichier accepté
    assert payload["files"] == []
    assert payload["failed"][0]["filename"] == "deja-vu.pdf"
    assert payload["failed"][0]["reason"] == "déjà importé"
    assert payload["failed"][0]["invoice_id"] == "INV-EXIST"

    # Le fichier ne doit PAS atterrir dans input/.
    input_dir = _bp.resolve_paths("test-profile")["input"]
    assert not (input_dir / "deja-vu.pdf").exists()


def test_depot_accepte_pdf_valide(mem_db, tmp_path, monkeypatch):
    """Un PDF avec magic bytes %PDF- est accepté et atterrit dans input/."""
    import blueprints.pipeline as _bp
    monkeypatch.setattr(_bp, "_trigger_pipeline", lambda slug, job_id=None: None)

    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    with app.test_client() as client:
        resp = client.post(
            "/pipeline/depot",
            data={"files": (__import__("io").BytesIO(b"%PDF-1.7\n%body"), "real.pdf")},
            content_type="multipart/form-data",
        )
    assert resp.status_code == 200
    body = resp.get_json()
    assert body["ok"] is True
    assert body["files"] == ["real.pdf"]
    assert body["failed"] == []

    input_dir = _bp.resolve_paths("test-profile")["input"]
    assert (input_dir / "real.pdf").exists()


def test_depot_rejette_extensions_non_autorisees(mem_db, tmp_path, monkeypatch):
    """Issue #108 : .exe / .sh / .js / .zip sont rejetés par la whitelist."""
    import blueprints.pipeline as _bp
    monkeypatch.setattr(_bp, "_trigger_pipeline", lambda slug, job_id=None: None)

    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    payloads = [
        ("evil.exe", b"MZ\x90\x00" + b"\x00" * 60),
        ("script.sh", b"#!/bin/sh\necho pwned\n"),
        ("payload.js", b"alert('xss')\n"),
        ("archive.zip", b"PK\x03\x04" + b"\x00" * 60),
    ]
    with app.test_client() as client:
        resp = client.post(
            "/pipeline/depot",
            data={
                "files": [
                    (__import__("io").BytesIO(body), name)
                    for name, body in payloads
                ],
            },
            content_type="multipart/form-data",
        )

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["ok"] is False
    rejected = {f["filename"]: f["reason"] for f in body["failed"]}
    assert set(rejected) == {"evil.exe", "script.sh", "payload.js", "archive.zip"}
    for name, reason in rejected.items():
        assert reason.startswith("Extension de fichier non autorisée"), (name, reason)

    # Aucun fichier ne doit atterrir sur disque.
    input_dir = _bp.resolve_paths("test-profile")["input"]
    for name, _ in payloads:
        assert not (input_dir / name).exists()


def test_depot_accepte_extensions_autorisees(mem_db, tmp_path, monkeypatch):
    """Issue #108 : .pdf et .png avec magic bytes valides traversent le filtre."""
    import blueprints.pipeline as _bp
    monkeypatch.setattr(_bp, "_trigger_pipeline", lambda slug, job_id=None: None)

    app, _ = _make_app(mem_db, tmp_path, monkeypatch)
    png_header = b"\x89PNG\r\n\x1a\n" + b"\x00" * 24
    with app.test_client() as client:
        resp = client.post(
            "/pipeline/depot",
            data={
                "files": [
                    (__import__("io").BytesIO(b"%PDF-1.7\n%body"), "ok.pdf"),
                    (__import__("io").BytesIO(png_header), "ok.png"),
                ],
            },
            content_type="multipart/form-data",
        )

    assert resp.status_code == 200
    body = resp.get_json()
    assert body["ok"] is True
    assert set(body["files"]) == {"ok.pdf", "ok.png"}
    assert body["failed"] == []


# ── #120 — alignement URL ?year=YYYY ≡ contenu rendu ──────────────────────────

def test_annee_demandee_avec_donnees_rend_directement_le_tableau(mem_db, tmp_path, monkeypatch):
    # Given une base avec des factures sur l'exercice 2025
    _insert_invoice(mem_db, id="e2025", type_document="facture_émise",
                    montant_ht=500.0, exercice_fiscal=2025)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When l'utilisateur visite /?year=2025
    with app.test_client() as client:
        resp = client.get("/?year=2025")

    # Then le tableau est rendu sans redirection
    assert resp.status_code == 200


def test_annee_valide_sans_donnees_redirige_vers_annee_par_defaut(mem_db, tmp_path, monkeypatch):
    # Given une base qui ne contient que des factures 2026
    _insert_invoice(mem_db, id="e2026", type_document="facture_émise",
                    montant_ht=500.0, exercice_fiscal=2026)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When l'utilisateur visite /?year=2024 (entier valide, aucune donnée)
    with app.test_client() as client:
        resp = client.get("/?year=2024")

    # Then il est redirigé en 302 vers l'année par défaut (2026)
    assert resp.status_code == 302
    assert "year=2026" in resp.headers["Location"]


def test_annee_non_entiere_redirige_vers_annee_par_defaut(mem_db, tmp_path, monkeypatch):
    # Given une base avec des factures 2026
    _insert_invoice(mem_db, id="e2026", type_document="facture_émise",
                    montant_ht=500.0, exercice_fiscal=2026)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When l'utilisateur visite /?year=abc (valeur non entière)
    with app.test_client() as client:
        resp = client.get("/?year=abc")

    # Then il est redirigé en 302 vers l'année par défaut, sans toucher au SQL
    assert resp.status_code == 302
    assert "year=2026" in resp.headers["Location"]


def test_annee_hors_plage_redirige_vers_annee_par_defaut(mem_db, tmp_path, monkeypatch):
    # Given une base avec des factures 2026
    _insert_invoice(mem_db, id="e2026", type_document="facture_émise",
                    montant_ht=500.0, exercice_fiscal=2026)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When l'utilisateur visite /?year=1500 (hors plage acceptée 2000..2100)
    with app.test_client() as client:
        resp = client.get("/?year=1500")

    # Then il est redirigé vers l'année par défaut
    assert resp.status_code == 302
    assert "year=2026" in resp.headers["Location"]


def test_parametre_year_absent_rend_directement_sans_redirection(mem_db, tmp_path, monkeypatch):
    # Given une base avec des factures 2026
    _insert_invoice(mem_db, id="e2026", type_document="facture_émise",
                    montant_ht=500.0, exercice_fiscal=2026)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When l'utilisateur visite / sans paramètre year
    with app.test_client() as client:
        resp = client.get("/")

    # Then le tableau est rendu directement (pas de redirection)
    assert resp.status_code == 200


# ── BDD : complétion des montants à la sauvegarde (issue HT/TVA/TTC + taux) ───
#
# Style BDD : chaque test décrit une règle métier comptable observable depuis
# l'extérieur — état DB, statut, valeurs persistées. Aucune assertion sur le
# détail d'implémentation (pas de mocks sur les helpers privés).

class TestComplétionMontantsÀLaSauvegarde:
    def test_édition_avec_ht_et_taux_complète_tva_et_ttc(self, mem_db, tmp_path, monkeypatch):
        # Given une facture à réviser sans montants
        _insert_invoice(
            mem_db, id="comp1", statut_révision="à_réviser",
            montant_ht=None, montant_tva=None, montant_ttc=None,
            taux_tva=None, exercice_fiscal=2025,
        )
        app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

        # When un humain saisit HT=100 et choisit le taux à 20 %
        with app.test_client() as client:
            resp = client.patch("/factures/comp1", data={
                "type_document": "facture_reçue",
                "montant_ht":  "100.00",
                "montant_tva": "",
                "montant_ttc": "",
                "taux_tva":    "0.20",
                "date_document": "2025-04-01",
                "émetteur_nom": "Fournisseur SAS",
            })

        # Then TVA et TTC sont calculés et la facture est validée
        assert resp.status_code == 200
        assert resp.get_json()["ok"] is True

        check = sqlite3.connect(str(db_path)); check.row_factory = sqlite3.Row
        row = check.execute(
            "SELECT montant_ht, montant_tva, montant_ttc, taux_tva, statut_révision "
            "FROM invoices WHERE id='comp1'"
        ).fetchone()
        check.close()

        assert row["montant_ht"]  == 100.00
        assert row["montant_tva"] == 20.00
        assert row["montant_ttc"] == 120.00
        assert row["taux_tva"]    == 0.20
        assert row["statut_révision"] == "validé"

    def test_édition_avec_deux_montants_complète_le_troisième(self, mem_db, tmp_path, monkeypatch):
        # Given une facture à réviser avec HT et TTC seulement
        _insert_invoice(
            mem_db, id="comp2", statut_révision="à_réviser",
            montant_ht=None, montant_tva=None, montant_ttc=None,
            exercice_fiscal=2025,
        )
        app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

        # When l'humain saisit HT + TTC (sans TVA)
        with app.test_client() as client:
            client.patch("/factures/comp2", data={
                "type_document": "facture_reçue",
                "montant_ht":  "100.00",
                "montant_ttc": "120.00",
                "date_document": "2025-04-01",
                "émetteur_nom": "Fournisseur SAS",
            })

        # Then TVA est dérivée
        check = sqlite3.connect(str(db_path)); check.row_factory = sqlite3.Row
        row = check.execute(
            "SELECT montant_tva, taux_tva FROM invoices WHERE id='comp2'"
        ).fetchone()
        check.close()
        assert row["montant_tva"] == 20.00
        assert row["taux_tva"] == 0.20

    def test_édition_avec_montants_incohérents_reste_validée_avec_avertissement(
        self, mem_db, tmp_path, monkeypatch
    ):
        # Given une facture validée, avec tous les champs renseignés pour que
        # la confiance reste à 1,0 même après l'édition (on isole ainsi le
        # warning mismatch des autres motifs de démotion possibles).
        _insert_invoice(
            mem_db, id="mismatch", statut_révision="validé",
            montant_ht=100.0, montant_tva=20.0, montant_ttc=120.0,
            exercice_fiscal=2025, numéro_facture="F-001",
            émetteur_siren="123456789",
        )
        app, db_path = _make_app(mem_db, tmp_path, monkeypatch)

        # When l'humain saisit trois valeurs incohérentes (HT+TVA ≠ TTC à 5 €)
        with app.test_client() as client:
            resp = client.patch("/factures/mismatch", data={
                "type_document": "facture_reçue",
                "montant_ht":  "100.00",
                "montant_tva": "15.00",
                "montant_ttc": "120.00",
                "date_document": "2025-04-01",
                "émetteur_nom": "Fournisseur SAS",
                "numéro_facture": "F-001",
            })

        # Then la facture reste validée mais l'incohérence est signalée à l'écran
        data = resp.get_json()
        assert data["ok"] is True
        assert "TVA incohérente" in (data.get("warning") or "")

        check = sqlite3.connect(str(db_path)); check.row_factory = sqlite3.Row
        row = check.execute(
            "SELECT statut_révision, montant_ht, montant_tva, montant_ttc "
            "FROM invoices WHERE id='mismatch'"
        ).fetchone()
        check.close()
        assert row["statut_révision"] == "validé"
        # Les valeurs saisies sont conservées telles quelles — pas d'écrasement
        assert row["montant_ht"]  == 100.00
        assert row["montant_tva"] == 15.00
        assert row["montant_ttc"] == 120.00

    def test_taux_hors_intervalle_est_rejeté(self, mem_db, tmp_path, monkeypatch):
        # Given une facture à réviser
        _insert_invoice(mem_db, id="bad-rate", statut_révision="à_réviser",
                        exercice_fiscal=2025)
        app, _ = _make_app(mem_db, tmp_path, monkeypatch)

        # When l'humain envoie un taux > 1 (oubli de la convention fraction)
        with app.test_client() as client:
            resp = client.patch("/factures/bad-rate", data={
                "type_document": "facture_reçue",
                "montant_ht":  "100.00",
                "taux_tva":    "20",   # 20 et non 0.20
                "date_document": "2025-04-01",
                "émetteur_nom": "X",
            })

        # Then la saisie est rejetée à la frontière (ACL)
        data = resp.get_json()
        assert data["ok"] is False
        assert "taux_tva" in data["errors"]


# ── Journal : colonnes selon visibilité TVA du profil ────────────────────────

def test_journal_pour_auto_entrepreneur_n_affiche_pas_les_colonnes_tva(
    mem_db, tmp_path, monkeypatch,
):
    """Given un AE en franchise et une facture validée,
    When on rend le dashboard,
    Then les colonnes TVA / TTC séparées disparaissent du <thead>
    And les colonnes Débit / Crédit (sans suffixe HT) sont présentes."""
    # Given : profil AE par défaut + 1 facture validée
    _insert_invoice(mem_db, id="ae-row", statut_révision="validé",
                    exercice_fiscal=2025, type_document="facture_reçue",
                    montant_ht=33.33, montant_tva=6.66, montant_ttc=39.99)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    html = resp.data.decode("utf-8")

    # Then : les <th> spécifiques TVA sont absents du thead du journal
    panel = html.split('id="panel-ledger"', 1)[1].split("</section>", 1)[0]
    assert ">Débit HT<" not in panel
    assert ">Crédit HT<" not in panel
    # En-têtes TVA et TTC séparés ne doivent pas apparaître dans le thead.
    thead = panel.split("<thead>", 1)[1].split("</thead>", 1)[0]
    assert ">TVA<" not in thead
    assert ">TTC<" not in thead
    # Et les <th> Débit / Crédit (mode AE) sont bien là
    assert ">Débit<" in thead
    assert ">Crédit<" in thead


def test_journal_pour_sasu_affiche_les_colonnes_tva(
    mem_db, tmp_path, monkeypatch,
):
    """Given un profil SASU,
    When on rend le dashboard,
    Then les colonnes Débit HT / Crédit HT / TVA / TTC sont présentes
    (régression sentinel : pas de masquage pour les profils TVA-visible)."""
    # Given : bascule le profil créé par _make_app en SASU
    _insert_invoice(mem_db, id="sasu-row", statut_révision="validé",
                    exercice_fiscal=2025, type_document="facture_reçue",
                    montant_ht=100.0, montant_tva=20.0, montant_ttc=120.0)
    app, db_path = _make_app(mem_db, tmp_path, monkeypatch)
    import sqlite3 as _sq
    conn = _sq.connect(str(db_path))
    conn.execute("UPDATE user_profile SET fiscal_profile='SASU' WHERE id=1")
    conn.commit()
    conn.close()

    # When
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    html = resp.data.decode("utf-8")

    # Then : 4 en-têtes montants présents dans le thead du journal
    panel = html.split('id="panel-ledger"', 1)[1].split("</section>", 1)[0]
    thead = panel.split("<thead>", 1)[1].split("</thead>", 1)[0]
    assert ">Débit HT<" in thead
    assert ">Crédit HT<" in thead
    assert ">TVA<" in thead
    assert ">TTC<" in thead


def test_journal_ae_montre_le_ttc_dans_la_colonne_debit_pour_une_charge(
    mem_db, tmp_path, monkeypatch,
):
    """Given un AE et un reçu (facture_reçue) à 39,99 € TTC validé,
    When on rend le dashboard,
    Then la valeur 39,99 € apparaît dans une cellule color-negative
    (= colonne Débit, signe « charge » en mode AE simplifié)."""
    # Given
    _insert_invoice(mem_db, id="ae-charge", statut_révision="validé",
                    exercice_fiscal=2025, type_document="facture_reçue",
                    montant_ht=33.33, montant_tva=6.66, montant_ttc=39.99)
    app, _ = _make_app(mem_db, tmp_path, monkeypatch)

    # When
    with app.test_client() as client:
        resp = client.get("/?year=2025")
    html = resp.data.decode("utf-8")

    # Then : on isole la ligne de la pièce et on vérifie qu'une cellule
    # color-negative porte bien le TTC formaté.
    panel = html.split('id="panel-ledger"', 1)[1].split("</section>", 1)[0]
    tbody = panel.split("<tbody>", 1)[1].split("</tbody>", 1)[0]
    # 39,99 € (séparateur FR + espace insécable géré par fr_currency)
    assert "color-negative" in tbody
    # Le montant TTC doit apparaître ; on tolère les variantes d'espacement
    # potentielles du filtre fr_currency.
    assert "39,99" in tbody

"""Tests for review.py — batch review workflow."""

import csv
import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
import extract as ex
import review as rv
from tests.conftest import OVH_TEXT


def _insert_row(conn, overrides=None):
    """Insert a synthetic invoice row into DB."""
    row = ex.parse_invoice(OVH_TEXT, "test.pdf", "auto-entrepreneur")
    row["hash_fichier"] = "abc123"
    if overrides:
        row.update(overrides)
    ex.insert(conn, row)
    return row["id"]


# ── Export ────────────────────────────────────────────────────────────────────

class TestExportReview:
    def test_exports_items_to_reviser(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert_row(conn, {"statut_révision": "à_réviser", "hash_fichier": "h1"})
        conn.close()
        review_dir = tmp_project / "review"
        conn2 = rv.open_db(db_path)
        rv.export_review(conn2, review_dir)
        conn2.close()
        assert (review_dir / "review.csv").exists()
        rows = list(csv.DictReader(open(review_dir / "review.csv")))
        assert len(rows) == 1
        assert rows[0]["action"] == "garder"

    def test_no_items_no_file(self, tmp_project, monkeypatch, capsys):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert_row(conn, {"statut_révision": "auto_validé", "hash_fichier": "h1"})
        conn.close()
        conn2 = rv.open_db(db_path)
        result = rv.export_review(conn2, tmp_project / "review")
        conn2.close()
        assert result is None
        out = capsys.readouterr().out
        assert "Aucun" in out

    def test_only_à_réviser_exported(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert_row(conn, {"statut_révision": "auto_validé", "hash_fichier": "h1"})
        _insert_row(conn, {"statut_révision": "à_réviser", "hash_fichier": "h2"})
        _insert_row(conn, {"statut_révision": "révisé", "hash_fichier": "h3"})
        conn.close()
        conn2 = rv.open_db(db_path)
        rv.export_review(conn2, tmp_project / "review")
        conn2.close()
        rows = list(csv.DictReader(open(tmp_project / "review" / "review.csv")))
        assert len(rows) == 1

    def test_missing_db(self, tmp_project, monkeypatch, capsys):
        monkeypatch.chdir(tmp_project)
        import sys as _sys
        _sys.argv = ["review.py", "--config", str(tmp_project / "config.toml")]
        rv.main()
        out = capsys.readouterr().out
        assert "introuvable" in out


# ── Import ────────────────────────────────────────────────────────────────────

class TestImportReview:
    def _setup(self, tmp_project, overrides=None):
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        rid = _insert_row(conn, {"statut_révision": "à_réviser", "hash_fichier": "h1", **(overrides or {})})
        conn.close()
        return db_path, rid

    def _write_review_csv(self, tmp_project, action, extra_fields=None):
        review_dir = tmp_project / "review"
        review_dir.mkdir(exist_ok=True)
        db_path = tmp_project / "data" / "invoices.db"
        conn = rv.open_db(db_path)
        rv.export_review(conn, review_dir)
        conn.close()
        # Patch action
        rows = list(csv.DictReader(open(review_dir / "review.csv")))
        for r in rows:
            r["action"] = action
            if extra_fields:
                r.update(extra_fields)
        with open(review_dir / "review.csv", "w", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)

    def test_garder_marks_révisé(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path, rid = self._setup(tmp_project)
        self._write_review_csv(tmp_project, "garder")
        conn = rv.open_db(db_path)
        rv.import_review(conn, tmp_project / "review")
        conn.close()
        conn2 = sqlite3.connect(db_path)
        row = conn2.execute("SELECT statut_révision, révisé_par FROM invoices WHERE id=?", (rid,)).fetchone()
        assert row[0] == "révisé"
        assert row[1] == "user"

    def test_corriger_updates_fields(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path, rid = self._setup(tmp_project)
        self._write_review_csv(tmp_project, "corriger", {"montant_ttc": "999.99", "catégorie": "matériel"})
        conn = rv.open_db(db_path)
        rv.import_review(conn, tmp_project / "review")
        conn.close()
        conn2 = sqlite3.connect(db_path)
        row = conn2.execute("SELECT montant_ttc, catégorie, statut_révision FROM invoices WHERE id=?", (rid,)).fetchone()
        assert float(row[0]) == pytest.approx(999.99)
        assert row[1] == "matériel"
        assert row[2] == "révisé"

    def test_supprimer_deletes_row(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path, rid = self._setup(tmp_project)
        self._write_review_csv(tmp_project, "supprimer")
        conn = rv.open_db(db_path)
        rv.import_review(conn, tmp_project / "review")
        conn.close()
        conn2 = sqlite3.connect(db_path)
        row = conn2.execute("SELECT * FROM invoices WHERE id=?", (rid,)).fetchone()
        assert row is None

    def test_import_missing_csv(self, tmp_project, monkeypatch, capsys):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        ex.open_db(db_path).close()
        conn = rv.open_db(db_path)
        rv.import_review(conn, tmp_project / "review")
        conn.close()
        out = capsys.readouterr().out
        assert "introuvable" in out

    def test_import_missing_db(self, tmp_project, monkeypatch, capsys):
        monkeypatch.chdir(tmp_project)
        import sys as _sys
        _sys.argv = ["review.py", "--import", "--config", str(tmp_project / "config.toml")]
        rv.main()
        out = capsys.readouterr().out
        assert "introuvable" in out


# ── Reclassify ────────────────────────────────────────────────────────────────

class TestReclassify:
    def _insert_validated(self, conn, overrides=None):
        import extract as ex
        from tests.conftest import OVH_TEXT
        row = ex.parse_invoice(OVH_TEXT, "test.pdf", "auto-entrepreneur")
        row["hash_fichier"] = "rh_" + str(hash(str(overrides)))
        row["statut_révision"] = "auto_validé"
        row["type_document"] = "facture_reçue"
        if overrides:
            row.update(overrides)
        ex.insert(conn, row)
        return row

    def test_export_reclassify_creates_csv(self, tmp_db, tmp_path):
        import extract as ex
        conn, db_path = tmp_db
        self._insert_validated(conn)
        conn.close()
        conn2 = ex.open_db(db_path)
        rv.export_reclassify(conn2, tmp_path)
        conn2.close()
        assert (tmp_path / "reclassify.csv").exists()

    def test_export_reclassify_excludes_à_réviser(self, tmp_db, tmp_path):
        import extract as ex
        conn, db_path = tmp_db
        self._insert_validated(conn, {"statut_révision": "à_réviser", "hash_fichier": "rh_rev"})
        conn.close()
        conn2 = ex.open_db(db_path)
        rv.export_reclassify(conn2, tmp_path)
        conn2.close()
        assert not (tmp_path / "reclassify.csv").exists()

    def test_import_reclassify_updates_type(self, tmp_db, tmp_path):
        import extract as ex
        conn, db_path = tmp_db
        row = self._insert_validated(conn)
        conn.close()

        (tmp_path / "reclassify.csv").write_text(
            f"id,type_document\n{row['id']},note_de_frais\n", encoding="utf-8"
        )
        conn2 = ex.open_db(db_path)
        rv.import_reclassify(conn2, tmp_path)
        updated = conn2.execute("SELECT type_document FROM invoices WHERE id = ?", (row["id"],)).fetchone()[0]
        conn2.close()
        assert updated == "note_de_frais"

    def test_auto_reclassify_uses_texte_brut(self, tmp_db):
        import extract as ex
        conn, db_path = tmp_db
        row = self._insert_validated(conn, {"texte_brut": "avoir remboursement fournisseur 50 euros"})
        conn.close()
        conn2 = ex.open_db(db_path)
        rv.auto_reclassify(conn2, "")
        updated = conn2.execute("SELECT type_document FROM invoices WHERE id = ?", (row["id"],)).fetchone()[0]
        conn2.close()
        assert updated == "avoir_reçu"

    def test_auto_reclassify_skips_null_texte_brut(self, tmp_db):
        import extract as ex
        conn, db_path = tmp_db
        row = self._insert_validated(conn, {"texte_brut": None})
        conn.close()
        conn2 = ex.open_db(db_path)
        rv.auto_reclassify(conn2, "")
        unchanged = conn2.execute("SELECT type_document FROM invoices WHERE id = ?", (row["id"],)).fetchone()[0]
        conn2.close()
        assert unchanged == "facture_reçue"

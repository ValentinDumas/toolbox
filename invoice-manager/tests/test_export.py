"""Tests for export.py — CSV + XLSX generation."""

import csv
import sqlite3
import sys
from pathlib import Path

import pytest
import openpyxl

sys.path.insert(0, str(Path(__file__).parent.parent))
import extract as ex
import export as exp
from tests.conftest import OVH_TEXT


def _insert(conn, overrides=None):
    base = ex.parse_invoice(OVH_TEXT, "test.pdf", "auto-entrepreneur")
    base["hash_fichier"] = "h_" + str(hash(str(overrides)))
    if overrides:
        base.update(overrides)
    ex.insert(conn, base)
    return base


# ── CSV ───────────────────────────────────────────────────────────────────────

class TestCSVExport:
    def test_csv_created(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert(conn)
        conn.close()
        conn2 = exp.open_db(db_path)
        rows = exp.fetch_rows(conn2, year=2026, statut="auto-entrepreneur")
        conn2.close()
        out = tmp_project / "output" / "ledger-2026.csv"
        exp.write_csv(rows, out)
        assert out.exists()

    def test_csv_has_expected_columns(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert(conn)
        conn.close()
        conn2 = exp.open_db(db_path)
        rows = exp.fetch_rows(conn2, year=None, statut=None)
        conn2.close()
        out = tmp_project / "output" / "ledger.csv"
        exp.write_csv(rows, out)
        reader = csv.DictReader(open(out))
        cols = reader.fieldnames
        for expected in ["date_document", "montant_ttc", "catégorie", "déductible", "fichier_source"]:
            assert expected in cols

    def test_csv_correct_values(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert(conn)
        conn.close()
        conn2 = exp.open_db(db_path)
        rows = exp.fetch_rows(conn2, year=None, statut=None)
        conn2.close()
        out = tmp_project / "output" / "ledger.csv"
        exp.write_csv(rows, out)
        row = list(csv.DictReader(open(out)))[0]
        assert float(row["montant_ttc"]) == 129.46
        assert row["catégorie"] == "hébergement"


# ── Year filter ───────────────────────────────────────────────────────────────

class TestYearFilter:
    def test_filter_by_year(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert(conn, {"exercice_fiscal": 2025, "hash_fichier": "h1"})
        _insert(conn, {"exercice_fiscal": 2026, "hash_fichier": "h2"})
        conn.close()
        conn2 = exp.open_db(db_path)
        rows_2025 = exp.fetch_rows(conn2, year=2025, statut=None)
        rows_2026 = exp.fetch_rows(conn2, year=2026, statut=None)
        rows_all = exp.fetch_rows(conn2, year=None, statut=None)
        conn2.close()
        assert len(rows_2025) == 1
        assert len(rows_2026) == 1
        assert len(rows_all) == 2

    def test_excludes_à_réviser(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert(conn, {"statut_révision": "auto_validé", "hash_fichier": "h1"})
        _insert(conn, {"statut_révision": "à_réviser", "hash_fichier": "h2"})
        conn.close()
        conn2 = exp.open_db(db_path)
        rows = exp.fetch_rows(conn2, year=None, statut=None)
        conn2.close()
        assert len(rows) == 1

    def test_empty_db_returns_empty(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        ex.open_db(db_path).close()
        conn = exp.open_db(db_path)
        rows = exp.fetch_rows(conn, year=None, statut=None)
        conn.close()
        assert rows == []


# ── XLSX ──────────────────────────────────────────────────────────────────────

class TestXLSXExport:
    def _make_xlsx(self, tmp_project, n=2):
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        for i in range(n):
            _insert(conn, {"hash_fichier": f"h{i}", "exercice_fiscal": 2026})
        conn.close()
        conn2 = exp.open_db(db_path)
        rows = exp.fetch_rows(conn2, year=2026, statut="auto-entrepreneur")
        conn2.close()
        out = tmp_project / "output" / "ledger-2026.xlsx"
        exp.write_xlsx(rows, out, 2026, "auto-entrepreneur")
        return out

    def test_xlsx_created(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        out = self._make_xlsx(tmp_project)
        assert out.exists()

    def test_xlsx_four_sheets(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        out = self._make_xlsx(tmp_project)
        wb = openpyxl.load_workbook(out)
        assert set(wb.sheetnames) == {"Journal", "Récapitulatif", "Déclaration", "Statistiques"}

    def test_journal_has_data_rows(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        out = self._make_xlsx(tmp_project, n=3)
        wb = openpyxl.load_workbook(out)
        ws = wb["Journal"]
        # Row 1 = header, rows 2+ = data
        data_rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if any(v for v in r)]
        assert len(data_rows) == 3

    def test_recap_total_ttc(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        out = self._make_xlsx(tmp_project, n=2)
        wb = openpyxl.load_workbook(out)
        ws = wb["Récapitulatif"]
        values = {r[0]: r[1] for r in ws.iter_rows(values_only=True) if r[0] and r[1]}
        # 2 invoices × 129.46 TTC
        assert values.get("Total TTC dépenses") == pytest.approx(258.92, abs=0.01)

    def test_declaration_sheet_has_categories(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        out = self._make_xlsx(tmp_project, n=1)
        wb = openpyxl.load_workbook(out)
        ws = wb["Déclaration"]
        col_a = [ws.cell(row=r, column=1).value for r in range(1, ws.max_row + 1)]
        assert "hébergement" in col_a


# ── CLI main ──────────────────────────────────────────────────────────────────

def _patch_profile(monkeypatch, tmp_project):
    """Monkeypatch resolve_paths to point at tmp_project dirs."""
    import profiles as _profiles
    monkeypatch.setattr(_profiles, "resolve_paths", lambda slug: {
        "db":     tmp_project / "data" / "invoices.db",
        "output": tmp_project / "output",
    })


class TestExportCLI:
    def test_missing_db_prints_message(self, tmp_project, monkeypatch, capsys):
        _patch_profile(monkeypatch, tmp_project)
        (tmp_project / "data" / "invoices.db").unlink()
        import sys as _sys
        _sys.argv = ["export.py", "--profile", "test", "--year", "2025"]
        exp.main()
        out = capsys.readouterr().out
        assert "introuvable" in out

    def test_no_data_prints_message(self, tmp_project, monkeypatch, capsys):
        _patch_profile(monkeypatch, tmp_project)
        import sys as _sys
        _sys.argv = ["export.py", "--profile", "test", "--year", "2099"]
        exp.main()
        out = capsys.readouterr().out
        assert "Aucune" in out

    def test_generates_both_files(self, tmp_project, monkeypatch):
        _patch_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert(conn, {"exercice_fiscal": 2026})
        conn.close()
        import sys as _sys
        _sys.argv = ["export.py", "--profile", "test", "--year", "2026"]
        exp.main()
        assert (tmp_project / "output" / "ledger-2026.csv").exists()
        assert (tmp_project / "output" / "ledger-2026.xlsx").exists()

    def test_idempotent_double_run(self, tmp_project, monkeypatch):
        _patch_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        _insert(conn, {"exercice_fiscal": 2026})
        conn.close()
        import sys as _sys
        _sys.argv = ["export.py", "--profile", "test", "--year", "2026"]
        exp.main()
        csv1 = (tmp_project / "output" / "ledger-2026.csv").read_bytes()
        exp.main()
        csv2 = (tmp_project / "output" / "ledger-2026.csv").read_bytes()
        assert csv1 == csv2


# ── Stats sheet ───────────────────────────────────────────────────────────────

class TestStatsSheet:
    def _make_xlsx_with_rows(self, tmp_project, rows_overrides):
        db_path = tmp_project / "data" / "invoices.db"
        conn = ex.open_db(db_path)
        for i, ov in enumerate(rows_overrides):
            _insert(conn, {"hash_fichier": f"hstat{i}", **ov})
        conn.close()
        conn2 = exp.open_db(db_path)
        rows = exp.fetch_rows(conn2, year=None, statut=None)
        conn2.close()
        out = tmp_project / "output" / "ledger.xlsx"
        exp.write_xlsx(rows, out, None, "auto-entrepreneur", "trimestrielle")
        return out

    def test_stats_sheet_exists(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        out = self._make_xlsx_with_rows(tmp_project, [{"exercice_fiscal": 2025, "date_document": "2025-03-15"}])
        wb = openpyxl.load_workbook(out)
        assert "Statistiques" in wb.sheetnames

    def test_stats_has_deadline_bloc(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        out = self._make_xlsx_with_rows(tmp_project, [{"exercice_fiscal": 2025, "date_document": "2025-03-15"}])
        wb = openpyxl.load_workbook(out)
        ws = wb["Statistiques"]
        all_vals = [ws.cell(row=r, column=1).value for r in range(1, ws.max_row + 1)]
        assert any("DÉCLARATION" in str(v) for v in all_vals if v)

    def test_deadline_trimestrielle_q1(self):
        from export import _deadline_trimestrielle
        from datetime import date
        assert _deadline_trimestrielle(1, 2025) == date(2025, 4, 30)

    def test_deadline_trimestrielle_q4(self):
        from export import _deadline_trimestrielle
        from datetime import date
        assert _deadline_trimestrielle(4, 2025) == date(2026, 1, 31)

    def test_deadline_tva_mensuelle(self):
        from export import _deadline_tva_mensuelle
        from datetime import date
        assert _deadline_tva_mensuelle(1, 2025) == date(2025, 2, 19)
        assert _deadline_tva_mensuelle(12, 2025) == date(2026, 1, 19)

    def test_deadline_annuelle(self):
        from export import _deadline_annuelle
        from datetime import date
        assert _deadline_annuelle(2025) == date(2026, 5, 31)

"""Tests for extract.py — parsers, pipeline, edge cases."""

import hashlib
import os
import shutil
import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))
import extract as ex
from tests.conftest import (
    OVH_TEXT, RECEIPT_TEXT, MINIMAL_TEXT,
    make_pdf, make_heic_like,
)


# ── _parse_date ───────────────────────────────────────────────────────────────

class TestParseDate:
    def test_dd_mm_yyyy_slash(self):
        assert ex._parse_date("Date: 28/02/2025") == "2025-02-28"

    def test_dd_mm_yyyy_dot(self):
        assert ex._parse_date("Date: 01.03.2026") == "2026-03-01"

    def test_yyyy_mm_dd(self):
        assert ex._parse_date("2025-06-15 facture") == "2025-06-15"

    def test_french_month(self):
        assert ex._parse_date("01 Mars 2026") == "2026-03-01"

    def test_french_month_case_insensitive(self):
        assert ex._parse_date("15 JANVIER 2025") == "2025-01-15"

    def test_date_range_no_false_positive(self):
        # "2026-28/02" must not be matched as 2026-28-02
        result = ex._parse_date("(01/03/2026-28/02/2027)")
        assert result == "2026-03-01"

    def test_invalid_month_skipped(self):
        # 32/13/2025 → invalid, should return None
        assert ex._parse_date("32/13/2025 blah") is None

    def test_no_date(self):
        assert ex._parse_date("aucune date ici") is None

    def test_year_boundary(self):
        assert ex._parse_date("31/12/2024") == "2024-12-31"


# ── _parse_amount ─────────────────────────────────────────────────────────────

class TestParseAmount:
    def test_ttc_keyword(self):
        assert ex._parse_amount("Total TTC 129,46 EUR", ["TTC"]) == 129.46

    def test_ht_keyword(self):
        assert ex._parse_amount("Total HT 107,88", ["HT", "total ht"]) == 107.88

    def test_dot_decimal(self):
        assert ex._parse_amount("Amount due 50.00", ["amount due"]) == 50.00

    def test_missing_keyword(self):
        assert ex._parse_amount("Prix 99,00", ["TTC"]) is None

    def test_carte_bancaire(self):
        assert ex._parse_amount("Carte bancaire -61,54 EUR", ["carte bancaire", "cb"]) == 61.54

    def test_space_in_amount(self):
        assert ex._parse_amount("Total TTC 1 234,56", ["TTC"]) == 1234.56


# ── _parse_siren / _parse_siret / _parse_tva_intracom ─────────────────────────

class TestParseFiscal:
    def test_siren(self):
        assert ex._parse_siren("SIREN : 424 761 419") == "424761419"

    def test_siret(self):
        assert ex._parse_siret("SIRET 42476141900045") == "42476141900045"

    def test_tva_intracom(self):
        assert ex._parse_tva_intracom("N TVA FR22424761419") == "FR22424761419"

    def test_email(self):
        assert ex._parse_email("contact: billing@ovh.com pour info") == "billing@ovh.com"

    def test_no_siren(self):
        assert ex._parse_siren("pas de siren ici") is None


# ── _guess_category ───────────────────────────────────────────────────────────

class TestGuessCategory:
    def test_hebergement_ovh(self):
        assert ex._guess_category("OVH serveur hébergement") == "hébergement"

    def test_transport_sncf(self):
        assert ex._guess_category("billet SNCF Paris Lyon") == "transport"

    def test_repas(self):
        assert ex._guess_category("restaurant le bistrot diner") == "repas"

    def test_logiciel(self):
        assert ex._guess_category("abonnement GitHub Teams") == "logiciel"

    def test_domaine(self):
        assert ex._guess_category("nom de domaine .fr renouvellement") == "domaine"

    def test_fallback_autres(self):
        assert ex._guess_category("achat mystère inconnu") == "autres"


# ── parse_invoice ─────────────────────────────────────────────────────────────

class TestParseInvoice:
    def test_ovh_invoice_fields(self):
        row = ex.parse_invoice(OVH_TEXT, "test.pdf", "auto-entrepreneur")
        assert row["numéro_facture"] == "FR76061464"
        assert row["date_document"] == "2026-03-01"
        assert row["montant_ht"] == 107.88
        assert row["montant_tva"] == 21.58
        assert row["montant_ttc"] == 129.46
        assert row["taux_tva"] == 20.0
        assert row["émetteur_siren"] == "424761419"
        assert row["émetteur_tva_intracom"] == "FR22424761419"
        assert row["catégorie"] == "hébergement"
        assert row["déductible"] == 1
        assert row["mode_paiement"] == "prélèvement"
        assert row["confiance"] == 1.0
        assert row["statut_révision"] == "auto_validé"

    def test_receipt_amounts(self):
        row = ex.parse_invoice(RECEIPT_TEXT, "ticket.heic", "auto-entrepreneur")
        assert row["montant_ttc"] == 61.54
        assert row["montant_ht"] == 51.28
        assert row["montant_tva"] == 10.26
        assert row["taux_tva"] == 20.0
        assert row["mode_paiement"] == "CB"
        assert row["statut_révision"] == "à_réviser"  # confiance < 0.8

    def test_minimal_invoice_partial(self):
        row = ex.parse_invoice(MINIMAL_TEXT, "min.pdf", "SASU")
        assert row["date_document"] == "2025-06-15"
        assert row["montant_ttc"] == 50.0
        assert row["statut_fiscal_profil"] == "SASU"

    def test_empty_text_low_confidence(self):
        row = ex.parse_invoice("", "empty.pdf", "auto-entrepreneur")
        assert row["confiance"] == 0.0
        assert row["statut_révision"] == "à_réviser"

    def test_exercice_trimestre(self):
        row = ex.parse_invoice(OVH_TEXT, "t.pdf", "auto-entrepreneur")
        assert row["exercice_fiscal"] == 2026
        assert row["trimestre"] == 1

    def test_deductibilite_repas_50pct(self):
        text = "restaurant le repas Total TTC 40,00 EUR Date: 01/06/2025"
        row = ex.parse_invoice(text, "repas.pdf", "auto-entrepreneur")
        assert row["catégorie"] == "repas"
        assert row["taux_déductibilité"] == 0.5

    def test_non_deductible(self):
        text = "achat mystere Total TTC 100,00 EUR Date: 01/06/2025"
        row = ex.parse_invoice(text, "misc.pdf", "auto-entrepreneur")
        assert row["déductible"] == 0


# ── Pipeline end-to-end ───────────────────────────────────────────────────────

class TestPipeline:
    def _run(self, tmp_project, monkeypatch, text: str, filename: str):
        """Helper: put a PDF in input/, run extraction, return DB rows."""
        monkeypatch.chdir(tmp_project)
        pdf = make_pdf(text, tmp_project / "input" / filename)
        with patch("extract.extract_text", return_value=text):
            ex.main.__wrapped__ = None  # reset any state
            import sys as _sys
            _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
            ex.main()
        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM invoices").fetchall()
        conn.close()
        return rows

    def test_successful_pdf_extraction(self, tmp_project, monkeypatch):
        rows = self._run(tmp_project, monkeypatch, OVH_TEXT, "ovh.pdf")
        assert len(rows) == 1
        assert rows[0]["montant_ttc"] == 129.46

    def test_file_moved_to_processed(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
            ex.main()
        assert not (tmp_project / "input" / "ovh.pdf").exists()
        assert (tmp_project / "processed" / "ovh.pdf").exists()

    def test_deduplication(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        # First pass
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
            ex.main()
        # Second pass: copy same content back to input
        shutil.copy(tmp_project / "processed" / "ovh.pdf", tmp_project / "input" / "ovh.pdf")
        with patch("extract.extract_text", return_value=OVH_TEXT):
            ex.main()
        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        conn.close()
        assert count == 1

    def test_corrupt_file_goes_to_errors(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        bad = tmp_project / "input" / "bad.pdf"
        bad.write_bytes(b"not a pdf at all")
        import sys as _sys
        _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
        ex.main()
        assert (tmp_project / "errors" / "bad.pdf").exists()

    def test_unsupported_format_ignored(self, tmp_project, monkeypatch, capsys):
        monkeypatch.chdir(tmp_project)
        docx = tmp_project / "input" / "doc.docx"
        docx.write_bytes(b"PK fake docx")
        import sys as _sys
        _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
        ex.main()
        assert docx.exists()
        assert "Aucun fichier" in capsys.readouterr().out

    def test_no_files_in_input(self, tmp_project, monkeypatch, capsys):
        monkeypatch.chdir(tmp_project)
        import sys as _sys
        _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
        ex.main()
        out = capsys.readouterr().out
        assert "Aucun fichier" in out

    def test_magic_byte_detection_pdf(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        # File without extension that is a valid PDF
        src = make_pdf(OVH_TEXT, tmp_project / "input" / "facture_sans_ext")
        # Rename to remove extension
        no_ext = tmp_project / "input" / "facture_sans_ext"
        src.rename(no_ext)
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
            ex.main()
        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        conn.close()
        assert count == 1

    def test_magic_byte_detection_heic(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        heic = make_heic_like(tmp_project / "input" / "photo_no_ext")
        # Rename to no extension
        no_ext = tmp_project / "input" / "photo_no_ext"
        # detect_extension should return .heic
        detected = ex.detect_extension(no_ext)
        assert detected == ".heic"

    def test_multiple_files_all_processed(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        for i in range(3):
            make_pdf(OVH_TEXT.replace("FR76061464", f"FR{i:08d}"), tmp_project / "input" / f"inv{i}.pdf")
        with patch("extract.extract_text", side_effect=[
            OVH_TEXT.replace("FR76061464", "FR00000000"),
            OVH_TEXT.replace("FR76061464", "FR00000001"),
            OVH_TEXT.replace("FR76061464", "FR00000002"),
        ]):
            import sys as _sys
            _sys.argv = ["extract.py", "--config", str(tmp_project / "config.toml")]
            ex.main()
        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        conn.close()
        assert count == 3


# ── _guess_doc_type ───────────────────────────────────────────────────────────

class TestGuessDocType:
    def test_default_facture_recue(self):
        assert ex._guess_doc_type("Facture n° INV-2025-001 TTC 500.00", "", 500.0) == "facture_reçue"

    def test_avoir_recu(self):
        assert ex._guess_doc_type("avoir remboursement fournisseur", "", 50.0) == "avoir_reçu"

    def test_avoir_emis_with_user_siren(self):
        assert ex._guess_doc_type("avoir 123456789 émetteur", "123456789", 50.0) == "avoir_émis"

    def test_note_de_frais(self):
        assert ex._guess_doc_type("note de frais déplacement Paris", "", 80.0) == "note_de_frais"

    def test_devis(self):
        assert ex._guess_doc_type("devis n° D-2025-042 valable 30 jours", "", 1200.0) == "devis"

    def test_releve_bancaire(self):
        assert ex._guess_doc_type("relevé de compte janvier 2025", "", None) == "relevé_bancaire"

    def test_facture_emise_by_siren(self):
        assert ex._guess_doc_type("Facture émetteur 123456789 client dupont", "123456789", 300.0) == "facture_émise"

    def test_recu_no_invoice_small_amount(self):
        assert ex._guess_doc_type("Merci de votre achat TTC 12.50", "", 12.50) == "reçu"

    def test_recu_threshold_above_200(self):
        # No invoice number but amount >= 200 → not a reçu → falls back to facture_reçue
        assert ex._guess_doc_type("achat matériel TTC 250.00", "", 250.0) == "facture_reçue"

    def test_avoir_priority_over_user_siren(self):
        # avoir keyword takes priority before user_siren check
        text = "credit note remboursement 123456789"
        assert ex._guess_doc_type(text, "123456789", 30.0) == "avoir_émis"

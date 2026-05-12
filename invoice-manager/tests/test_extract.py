"""Tests for extract.py — parsers, pipeline, edge cases."""

import hashlib
import os
import shutil
import sqlite3
import sys
from pathlib import Path
from unittest.mock import patch, MagicMock

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


class TestParseAmounts:
    def test_ticket_sans_ventilation_laisse_ht_et_tva_a_none(self):
        # Ticket sans ventilation HT/TVA : on consigne NULL pour distinguer
        # « absent du document » de « zéro réel ». La dérivation se fera à
        # l'affichage seulement si deux valeurs sont connues.
        ht, tva, ttc, taux = ex._parse_amounts("Boulanger\nTotal à payer 44,99 EUR")
        assert ttc == 44.99
        assert ht is None
        assert tva is None
        assert taux is None

    def test_ventilation_complete_inchangee(self):
        ht, tva, ttc, taux = ex._parse_amounts(
            "Total HT 100,00\nTVA 20,00\nTotal TTC 120,00"
        )
        assert ht == 100.0
        assert tva == 20.0
        assert ttc == 120.0
        assert taux == 20.0

    def test_pas_de_derivation_a_l_extraction(self):
        # Avant : HT + TTC suffisaient à dériver TVA. Maintenant : extraction
        # stricte — TVA reste None tant qu'elle n'est pas écrite sur le document.
        ht, tva, ttc, taux = ex._parse_amounts(
            "Total HT 100,00\nTotal TTC 120,00"
        )
        assert ht == 100.0
        assert ttc == 120.0
        assert tva is None
        assert taux is None


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
        assert row["statut_révision"] == "validé"

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
        assert row["montant_ht"] is None
        assert row["montant_tva"] is None
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

def _patch_extract_profile(monkeypatch, tmp_project):
    import profiles as _profiles
    monkeypatch.setattr(_profiles, "resolve_paths", lambda slug: {
        "db":        tmp_project / "data" / "invoices.db",
        "input":     tmp_project / "input",
        "processed": tmp_project / "processed",
        "errors":    tmp_project / "errors",
    })


class TestPipeline:
    def _run(self, tmp_project, monkeypatch, text: str, filename: str):
        """Helper: put a PDF in input/, run extraction, return DB rows."""
        _patch_extract_profile(monkeypatch, tmp_project)
        make_pdf(text, tmp_project / "input" / filename)
        with patch("extract.extract_text", return_value=text):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test"]
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
        _patch_extract_profile(monkeypatch, tmp_project)
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test"]
            ex.main()
        assert not (tmp_project / "input" / "ovh.pdf").exists()
        assert (tmp_project / "processed" / "ovh.pdf").exists()

    def test_deduplication(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test"]
            ex.main()
        shutil.copy(
            next((tmp_project / "processed").glob("ovh*")),
            tmp_project / "input" / "ovh.pdf"
        )
        with patch("extract.extract_text", return_value=OVH_TEXT):
            ex.main()
        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        conn.close()
        assert count == 1

    def test_corrupt_file_goes_to_errors(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        bad = tmp_project / "input" / "bad.pdf"
        bad.write_bytes(b"not a pdf at all")
        import sys as _sys
        _sys.argv = ["extract.py", "--profile", "test"]
        ex.main()
        assert (tmp_project / "errors" / "bad.pdf").exists()

    def test_unsupported_format_ignored(self, tmp_project, monkeypatch, capsys):
        _patch_extract_profile(monkeypatch, tmp_project)
        docx = tmp_project / "input" / "doc.docx"
        docx.write_bytes(b"PK fake docx")
        import sys as _sys
        _sys.argv = ["extract.py", "--profile", "test"]
        ex.main()
        assert docx.exists()
        assert "Aucun fichier" in capsys.readouterr().out

    def test_no_files_in_input(self, tmp_project, monkeypatch, capsys):
        _patch_extract_profile(monkeypatch, tmp_project)
        import sys as _sys
        _sys.argv = ["extract.py", "--profile", "test"]
        ex.main()
        out = capsys.readouterr().out
        assert "Aucun fichier" in out

    def test_magic_byte_detection_pdf(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        src = make_pdf(OVH_TEXT, tmp_project / "input" / "facture_sans_ext")
        no_ext = tmp_project / "input" / "facture_sans_ext"
        src.rename(no_ext)
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test"]
            ex.main()
        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        conn.close()
        assert count == 1

    def test_magic_byte_detection_heic(self, tmp_project, monkeypatch):
        monkeypatch.chdir(tmp_project)
        heic = make_heic_like(tmp_project / "input" / "photo_no_ext")
        no_ext = tmp_project / "input" / "photo_no_ext"
        detected = ex.detect_extension(no_ext)
        assert detected == ".heic"

    def test_multiple_files_all_processed(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        for i in range(3):
            make_pdf(OVH_TEXT.replace("FR76061464", f"FR{i:08d}"), tmp_project / "input" / f"inv{i}.pdf")
        with patch("extract.extract_text", side_effect=[
            OVH_TEXT.replace("FR76061464", "FR00000000"),
            OVH_TEXT.replace("FR76061464", "FR00000001"),
            OVH_TEXT.replace("FR76061464", "FR00000002"),
        ]):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test"]
            ex.main()
        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
        conn.close()
        assert count == 3


# ── _correct_perspective + _preprocess_image ─────────────────────────────────

class TestCorrectPerspective:
    def _blank_bgr(self, h=200, w=100):
        import numpy as np
        return np.ones((h, w, 3), dtype=np.uint8) * 200

    def test_returns_array_no_contour(self):
        import numpy as np
        arr = self._blank_bgr()
        result = ex._correct_perspective(arr)
        assert isinstance(result, np.ndarray)
        assert result.shape[2] == 3

    def test_no_crash_on_tiny_image(self):
        import numpy as np
        arr = np.zeros((10, 10, 3), dtype=np.uint8)
        result = ex._correct_perspective(arr)
        assert result.shape == arr.shape


class TestPreprocessImage:
    def _white_pil(self, w=80, h=120):
        from PIL import Image
        return Image.new("RGB", (w, h), color=(240, 240, 240))

    def test_returns_pil_image(self):
        from PIL import Image
        img = self._white_pil()
        result = ex._preprocess_image(img)
        assert isinstance(result, Image.Image)

    def test_does_not_crash_on_small_image(self):
        from PIL import Image
        img = Image.new("RGB", (20, 20), color=(200, 200, 200))
        result = ex._preprocess_image(img)
        assert isinstance(result, Image.Image)

    def test_output_size_reasonable(self):
        img = self._white_pil(80, 120)
        result = ex._preprocess_image(img)
        assert result.width > 0 and result.height > 0


# ── _tesseract_confidence ─────────────────────────────────────────────────────

class TestTesseractConfidence:
    def test_empty_string_returns_zero(self):
        assert ex._tesseract_confidence("") == 0.0

    def test_all_alphanum(self):
        assert ex._tesseract_confidence("abc123") == 1.0

    def test_mixed(self):
        result = ex._tesseract_confidence("abc!!!")
        assert abs(result - 0.5) < 0.001

    def test_only_noise(self):
        assert ex._tesseract_confidence("~~~|||") == 0.0

    def test_realistic_good_text(self):
        t = "Total TTC 129,46 EUR Facture FR76061464"
        assert ex._tesseract_confidence(t) > 0.5

    def test_realistic_noisy_text(self):
        t = "||~~ !!@# $%^ &*()"
        assert ex._tesseract_confidence(t) < 0.3


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


# ── EasyOCR fallback ──────────────────────────────────────────────────────────

class TestEasyOCRFallback:
    def test_tesseract_confidence_above_threshold_no_easyocr(self, tmp_path):
        """EasyOCR must NOT be called when Tesseract confidence is sufficient."""
        img_path = tmp_path / "test.png"
        from PIL import Image
        Image.new("RGB", (100, 50), "white").save(img_path)

        with patch("pytesseract.image_to_string", return_value="Total TTC 50,00 EUR Facture"), \
             patch("extract._get_easyocr_reader") as mock_get:
            result = ex.extract_text_image(
                img_path, "fra", 300,
                preprocess=False,
                easyocr_fallback=True,
                easyocr_threshold=0.4,
            )
        assert "Total" in result
        mock_get.assert_not_called()

    def test_low_confidence_triggers_easyocr(self, tmp_path):
        """EasyOCR is called and its result used when Tesseract confidence < threshold."""
        img_path = tmp_path / "test.png"
        from PIL import Image
        Image.new("RGB", (100, 50), "white").save(img_path)

        mock_reader = MagicMock()
        mock_reader.readtext.return_value = ["Total TTC", "129,46 EUR", "Facture OVH"]

        with patch("pytesseract.image_to_string", return_value="~~||~~"), \
             patch("extract._get_easyocr_reader", return_value=mock_reader):
            result = ex.extract_text_image(
                img_path, "fra", 300,
                preprocess=False,
                easyocr_fallback=True,
                easyocr_threshold=0.4,
            )
        assert "Total TTC" in result

    def test_easyocr_disabled_by_default(self, tmp_path):
        """With easyocr_fallback=False (default), EasyOCR is never invoked."""
        img_path = tmp_path / "test.png"
        from PIL import Image
        Image.new("RGB", (100, 50), "white").save(img_path)

        with patch("pytesseract.image_to_string", return_value="~~||~~"), \
             patch("extract._get_easyocr_reader") as mock_get:
            ex.extract_text_image(img_path, "fra", 300, preprocess=False)
            mock_get.assert_not_called()


# ── _match_known_emitter + known_emitters ─────────────────────────────────────

# 8 lignes de bruit OCR pur — ne passent pas le filtre alpha de _parse_emetteur_fallback
_GARBLED_HEADER = "!!! ##\n" * 8


class TestMatchKnownEmitter:
    def test_exact_match(self):
        assert ex._match_known_emitter("boulanger paris", {"boulanger": "Boulanger"}) == "Boulanger"

    def test_fuzzy_match_truncated(self):
        # "boulange" manque le 'r' final — cas ticket froissé
        assert ex._match_known_emitter("BOULANGE ENTIN", {"boulanger": "Boulanger"}) == "Boulanger"

    def test_fuzzy_match_middle_missing(self):
        # "bouanger" manque le 'l' — corruption OCR
        assert ex._match_known_emitter("bouanger ref", {"boulanger": "Boulanger"}) == "Boulanger"

    def test_no_match_unrelated_text(self):
        assert ex._match_known_emitter("Total TTC 50,00 EUR", {"boulanger": "Boulanger"}) is None

    def test_returns_none_on_empty_dict(self):
        assert ex._match_known_emitter("boulanger", {}) is None

class TestKnownEmitters:
    def test_known_emitter_matched_when_header_unreadable(self):
        # Header illisible + "boulanger" dans le corps du ticket
        text = _GARBLED_HEADER + "Total TTC: 249,99 EUR\nDate: 01/05/2026\nSIRET: 12345678900012\nboulanger ref 42"
        row = ex.parse_invoice(text, "boulanger.jpg", "auto-entrepreneur",
                               known_emitters={"boulanger": "Boulanger"})
        assert row["émetteur_nom"] == "Boulanger"

    def test_known_emitter_keyword_case_insensitive(self):
        # Clé en minuscule dans config, texte en majuscules dans le ticket
        text = _GARBLED_HEADER + "Total TTC: 99,00 EUR\nBOULANGER ref produit"
        row = ex.parse_invoice(text, "b.jpg", "auto-entrepreneur",
                               known_emitters={"boulanger": "Boulanger"})
        assert row["émetteur_nom"] == "Boulanger"

    def test_known_emitter_not_overrides_existing(self):
        # _parse_emetteur_fallback trouve un nom → known_emitters ne doit PAS l'écraser
        text = "Fnac\nTotal TTC 49,99 EUR\nDate: 01/05/2026\nboulanger quelque chose"
        row = ex.parse_invoice(text, "fnac.jpg", "auto-entrepreneur",
                               known_emitters={"boulanger": "Boulanger"})
        assert row["émetteur_nom"] == "Fnac"

    def test_no_match_returns_none(self):
        text = _GARBLED_HEADER + "Total TTC: 249,99 EUR"
        row = ex.parse_invoice(text, "b.jpg", "auto-entrepreneur", known_emitters={})
        assert row["émetteur_nom"] is None

    def test_default_no_known_emitters(self):
        text = _GARBLED_HEADER + "Total TTC: 249,99 EUR"
        row = ex.parse_invoice(text, "b.jpg", "auto-entrepreneur")
        assert row["émetteur_nom"] is None


# ── import_jobs : suivi par fichier pendant l'extraction ─────────────────────

def _semer_job(db_path, job_id, filenames):
    """Helper : crée une ligne `en_attente` par fichier (comme le ferait /pipeline/depot)."""
    from datetime import datetime, timezone
    from db import open_db
    now = datetime.now(timezone.utc).isoformat()
    conn = open_db(db_path)
    conn.executemany(
        "INSERT INTO import_jobs (job_id, filename, statut, créé_le, mis_à_jour_le) "
        "VALUES (?, ?, 'en_attente', ?, ?)",
        [(job_id, name, now, now) for name in filenames],
    )
    conn.commit()
    conn.close()


def _statuts_job(db_path, job_id):
    """Helper : {filename: statut} pour un job donné."""
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT filename, statut FROM import_jobs WHERE job_id=?",
        (job_id,),
    ).fetchall()
    conn.close()
    return {r[0]: r[1] for r in rows}


class TestImportJobsLifecycle:
    def test_fichier_traité_passe_à_terminé(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        _semer_job(db_path, "JOB1", ["ovh.pdf"])
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")

        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test", "--job-id", "JOB1"]
            ex.main()

        assert _statuts_job(db_path, "JOB1") == {"ovh.pdf": "terminé"}

    def test_fichier_corrompu_passe_à_erreur(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        _semer_job(db_path, "JOB2", ["bad.pdf"])
        (tmp_project / "input" / "bad.pdf").write_bytes(b"not a pdf at all")

        import sys as _sys
        _sys.argv = ["extract.py", "--profile", "test", "--job-id", "JOB2"]
        ex.main()

        statuts = _statuts_job(db_path, "JOB2")
        assert statuts == {"bad.pdf": "erreur"}

    def test_message_erreur_persisté(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        _semer_job(db_path, "JOB3", ["bad.pdf"])
        (tmp_project / "input" / "bad.pdf").write_bytes(b"not a pdf at all")

        import sys as _sys
        _sys.argv = ["extract.py", "--profile", "test", "--job-id", "JOB3"]
        ex.main()

        conn = sqlite3.connect(db_path)
        msg = conn.execute(
            "SELECT message_erreur FROM import_jobs WHERE job_id=?", ("JOB3",)
        ).fetchone()[0]
        conn.close()
        assert msg and len(msg) > 0

    def test_invoice_id_rattaché_quand_terminé(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        _semer_job(db_path, "JOB4", ["ovh.pdf"])
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")

        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test", "--job-id", "JOB4"]
            ex.main()

        conn = sqlite3.connect(db_path)
        invoice_id = conn.execute(
            "SELECT invoice_id FROM import_jobs WHERE job_id=?", ("JOB4",)
        ).fetchone()[0]
        nb = conn.execute(
            "SELECT COUNT(*) FROM invoices WHERE id=?", (invoice_id,)
        ).fetchone()[0]
        conn.close()
        assert nb == 1

    def test_doublon_marqué_comme_tel(self, tmp_project, monkeypatch):
        _patch_extract_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        # 1er import : facture entre en base
        _semer_job(db_path, "JOB5a", ["ovh.pdf"])
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test", "--job-id", "JOB5a"]
            ex.main()
        # 2e import du même fichier → hash déjà en base → doublon
        shutil.copy(
            next((tmp_project / "processed").glob("ovh*")),
            tmp_project / "input" / "ovh.pdf",
        )
        _semer_job(db_path, "JOB5b", ["ovh.pdf"])
        with patch("extract.extract_text", return_value=OVH_TEXT):
            _sys.argv = ["extract.py", "--profile", "test", "--job-id", "JOB5b"]
            ex.main()

        assert _statuts_job(db_path, "JOB5b") == {"ovh.pdf": "doublon"}

    def test_fichier_disparu_clôturé_en_doublon(self, tmp_project, monkeypatch):
        # Simule le cas où la dedup amont a supprimé le fichier avant extract.
        _patch_extract_profile(monkeypatch, tmp_project)
        db_path = tmp_project / "data" / "invoices.db"
        _semer_job(db_path, "JOB6", ["disparu.pdf"])
        # On ne crée rien dans input/

        import sys as _sys
        _sys.argv = ["extract.py", "--profile", "test", "--job-id", "JOB6"]
        ex.main()

        assert _statuts_job(db_path, "JOB6") == {"disparu.pdf": "doublon"}

    def test_sans_job_id_pas_de_lignes_créées(self, tmp_project, monkeypatch):
        # Régression CLI : `extract.py` sans --job-id ne doit toucher à rien.
        _patch_extract_profile(monkeypatch, tmp_project)
        make_pdf(OVH_TEXT, tmp_project / "input" / "ovh.pdf")
        with patch("extract.extract_text", return_value=OVH_TEXT):
            import sys as _sys
            _sys.argv = ["extract.py", "--profile", "test"]
            ex.main()

        conn = sqlite3.connect(tmp_project / "data" / "invoices.db")
        nb = conn.execute("SELECT COUNT(*) FROM import_jobs").fetchone()[0]
        conn.close()
        assert nb == 0

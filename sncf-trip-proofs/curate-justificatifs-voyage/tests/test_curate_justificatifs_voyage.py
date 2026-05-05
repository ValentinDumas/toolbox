"""
Tests métier — curate-justificatifs-voyage

Approche : les fonctions de parsing reçoivent du texte brut (comme si extrait du PDF).
Aucun vrai PDF requis — les dépendances PDF (pdfplumber, tesseract) ne sont pas utilisées.
"""
import importlib.util
import sys
import time
from pathlib import Path

import pytest

_spec = importlib.util.spec_from_file_location(
    "curate_justificatifs_voyage",
    Path(__file__).parent.parent / "curate-justificatifs-voyage.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

Fields = _mod.Fields
_parse_date = _mod._parse_date
_parse_amount = _mod._parse_amount
_parse_ref = _mod._parse_ref
_parse_tcn = _mod._parse_tcn
deduplicate_sources = _mod.deduplicate_sources
resolve_conflicts = _mod.resolve_conflicts
load_config = _mod.load_config


# ── 1. Date ───────────────────────────────────────────────────────────────────

class TestParseDate:
    def test_structure_a_voyage_du_numerique(self):
        assert _parse_date("voyage du 16-03-2026") == "20260316"

    def test_structure_a_aller_le_numerique(self):
        assert _parse_date("aller le 16/03/2026") == "20260316"

    def test_structure_b_voyage_du_lettres(self):
        assert _parse_date("voyage du 26 mars 2026") == "20260326"

    def test_fallback_mois_en_lettres(self):
        assert _parse_date("Paris, 30 mars 2026") == "20260330"

    def test_fallback_date_numerique(self):
        assert _parse_date("30/03/2026") == "20260330"

    def test_aucune_date(self):
        assert _parse_date("Aucune information de date ici.") is None

    def test_priorite_voyage_du_sur_autres_dates(self):
        # "Paris, le 01/01/2026" ne doit pas écraser "voyage du 16/03/2026"
        text = "Paris, le 01/01/2026\nvoyage du 16/03/2026"
        assert _parse_date(text) == "20260316"


# ── 2. Montant ────────────────────────────────────────────────────────────────

class TestParseAmount:
    def test_structure_a_montant_total(self):
        assert _parse_amount("Montant TOTAL de la commande 15,60 €") == "15-60TTC"

    def test_structure_b_montant_du_voyage(self):
        assert _parse_amount("Montant du voyage 10,00 €") == "10-00TTC"

    def test_montant_entier_EUR(self):
        assert _parse_amount("18 EUR") == "18-00TTC"

    def test_montant_decimal_euro_apres(self):
        assert _parse_amount("18,50 €") == "18-50TTC"

    def test_aucun_montant(self):
        assert _parse_amount("Aucun montant dans ce texte.") is None


# ── 3. Référence ──────────────────────────────────────────────────────────────

class TestParseRef:
    def test_structure_a_reference_directe(self):
        assert _parse_ref("Référence D56QEJ") == "D56QEJ"

    def test_structure_b_reference_de_commande(self):
        assert _parse_ref("Référence de commande M56QD3") == "M56QD3"

    def test_abreviation_ref(self):
        assert _parse_ref("Réf D56QEJ") == "D56QEJ"

    def test_aucune_reference(self):
        assert _parse_ref("Aucune référence dans ce texte.") is None


# ── 4. TCN (optionnel) ────────────────────────────────────────────────────────

class TestParseTcn:
    def test_tcn_present(self):
        assert _parse_tcn("TCN 016404373") == "016404373"

    def test_tcn_absent(self):
        assert _parse_tcn("Aucun TCN dans ce texte.") is None


# ── 5. Nom de fichier ─────────────────────────────────────────────────────────

class TestFieldsFilename:
    def test_sans_tcn(self):
        f = Fields(date="20260316", amount="15-60TTC", ref="D56QEJ", tcn=None)
        assert f.filename == "justificatif-voyage-20260316-15-60ttc-d56qej.pdf"

    def test_avec_tcn(self):
        f = Fields(date="20260326", amount="10-00TTC", ref="M56QD3", tcn="016404373")
        assert f.filename == "justificatif-voyage-20260326-10-00ttc-m56qd3-016404373.pdf"

    def test_date_manquante(self):
        f = Fields(date=None, amount="15-60TTC", ref="D56QEJ", tcn=None)
        assert "date-inconnue" in f.filename

    def test_montant_manquant(self):
        f = Fields(date="20260316", amount=None, ref="D56QEJ", tcn=None)
        assert "prix-inconnu" in f.filename

    def test_reference_manquante(self):
        f = Fields(date="20260316", amount="15-60TTC", ref=None, tcn=None)
        assert "ref-inconnue" in f.filename

    def test_avec_suffixe_conflit(self):
        f = Fields(date="20260416", amount="18-50TTC", ref="N4M4XX", tcn="016733616", counter=1)
        assert f.filename == "justificatif-voyage-20260416-18-50ttc-n4m4xx-016733616-1.pdf"

    def test_champs_manquants_listes(self):
        f = Fields(date=None, amount=None, ref="D56QEJ", tcn=None)
        assert set(f.missing) == {"date", "montant"}

    def test_aucun_champ_manquant(self):
        f = Fields(date="20260316", amount="15-60TTC", ref="D56QEJ", tcn=None)
        assert f.missing == []


# ── 6 & 7. Déduplication ─────────────────────────────────────────────────────

class TestDeduplication:
    def _make_file(self, path: Path, content: bytes, mtime: float) -> Path:
        path.write_bytes(content)
        import os
        os.utime(path, (mtime, mtime))
        return path

    def test_deux_fichiers_identiques_garde_le_plus_ancien(self, tmp_path):
        t = time.time()
        old = self._make_file(tmp_path / "old.pdf", b"contenu", t - 100)
        new = self._make_file(tmp_path / "new.pdf", b"contenu", t)
        assert deduplicate_sources([old, new]) == [old]

    def test_fichiers_distincts_tous_gardes(self, tmp_path):
        t = time.time()
        a = self._make_file(tmp_path / "a.pdf", b"aaa", t)
        b = self._make_file(tmp_path / "b.pdf", b"bbb", t + 1)
        assert set(deduplicate_sources([a, b])) == {a, b}

    def _fields(self, ref="REF"):
        return Fields(date="20260316", amount="15-60TTC", ref=ref, tcn=None)

    def test_conflit_contenu_identique_doublon_ignore(self, tmp_path):
        a = tmp_path / "a.pdf"; a.write_bytes(b"meme")
        b = tmp_path / "b.pdf"; b.write_bytes(b"meme")
        result = resolve_conflicts([(a, self._fields()), (b, self._fields())])
        assert len(result) == 1

    def test_conflit_contenu_different_numerotation(self, tmp_path):
        t = time.time()
        a = tmp_path / "a.pdf"; a.write_bytes(b"contenu_a")
        b = tmp_path / "b.pdf"; b.write_bytes(b"contenu_b")
        import os
        os.utime(a, (t - 10, t - 10))
        os.utime(b, (t, t))
        result = resolve_conflicts([(a, self._fields()), (b, self._fields())])
        counters = sorted(f.counter for _, f in result if f is not None)
        assert counters == [1, 2]


# ── 6. Config ─────────────────────────────────────────────────────────────────

class TestLoadConfig:
    def test_missing_config(self, tmp_path):
        in_p, out_p = load_config(tmp_path / "config.json")
        assert in_p is None
        assert out_p is None

    def test_both_paths_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"in": "/a/inbox", "out": "/a/output"}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/a/inbox")
        assert out_p == Path("/a/output")

    def test_in_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"in": "/a/inbox", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p == Path("/a/inbox")
        assert out_p is None

    def test_out_only_configured(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"out": "/a/output"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p == Path("/a/output")

    def test_malformed_json(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text("not valid json{{{")
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_missing_script_section(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"other-script": {"in": "/x", "out": "/y"}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

    def test_empty_paths_treated_as_none(self, tmp_path):
        cfg = tmp_path / "config.json"
        cfg.write_text('{"curate-justificatifs-voyage": {"in": "", "out": ""}}')
        in_p, out_p = load_config(cfg)
        assert in_p is None
        assert out_p is None

"""
Tests métier — curate-justificatifs-achat

Approche : les fonctions de parsing reçoivent du texte brut (comme si extrait du PDF).
Aucun vrai PDF requis — les dépendances PDF (pdfplumber, tesseract) ne sont pas utilisées.
"""
import hashlib
import sys
import time
from pathlib import Path

import importlib.util

import pytest

_spec = importlib.util.spec_from_file_location(
    "curate_justificatifs_achat",
    Path(__file__).parent.parent / "curate-justificatifs-achat.py",
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

Fields = _mod.Fields
_parse_amount = _mod._parse_amount
_parse_date = _mod._parse_date
_parse_ref = _mod._parse_ref
deduplicate_sources = _mod.deduplicate_sources
resolve_conflicts = _mod.resolve_conflicts


# ── 1. Date ───────────────────────────────────────────────────────────────────

class TestParseDate:
    def test_ticket_aller_un_jour(self):
        assert _parse_date("Aller 02/04/2026 Paris → Lyon") == "20260402"

    def test_ticket_aller_retour_deux_jours(self):
        text = "Aller 23/04/2026 Paris\nRetour 24/04/2026 Lyon"
        assert _parse_date(text) == "20260423-20260424"

    def test_tickets_non_tries_dans_pdf(self):
        # Retour listé avant Aller dans le document — doit être trié
        text = "Retour 24/04/2026 Lyon\nAller 23/04/2026 Paris"
        assert _parse_date(text) == "20260423-20260424"

    def test_etiquettes_anglaises(self):
        text = "Departure 02/04/2026 Paris\nReturn 03/04/2026 Lyon"
        assert _parse_date(text) == "20260402-20260403"

    def test_date_numerique_avec_contexte_du(self):
        assert _parse_date("Facture du 30/03/2026") == "20260330"

    def test_date_numerique_avec_contexte_le(self):
        assert _parse_date("émise le 30-03-2026") == "20260330"

    def test_date_lettres_avec_contexte(self):
        assert _parse_date("le 30 mars 2026") == "20260330"

    def test_date_lettres_sans_contexte(self):
        assert _parse_date("Paris, 30 mars 2026") == "20260330"

    def test_date_numerique_seule(self):
        assert _parse_date("Référence : 30/03/2026") == "20260330"

    def test_fallback_sur_reference(self):
        assert _parse_date("N°2668453920-20260330") == "20260330"

    def test_aucune_date(self):
        assert _parse_date("Aucune information de date ici.") is None

    def test_jour_sur_deux_chiffres(self):
        assert _parse_date("Aller 02/04/2026") == "20260402"

    def test_jour_sur_un_chiffre(self):
        assert _parse_date("du 5/03/2026") == "20260305"


# ── 2. Montant ────────────────────────────────────────────────────────────────

class TestParseAmount:
    def test_euro_avant_decimal(self):
        assert _parse_amount("€18,50") == "18-50TTC"

    def test_euro_avant_entier(self):
        assert _parse_amount("€5") == "5-00TTC"

    def test_euro_avant_avec_espace(self):
        assert _parse_amount("€ 18,50") == "18-50TTC"

    def test_euro_apres_decimal(self):
        assert _parse_amount("18,50 €") == "18-50TTC"

    def test_euro_apres_avec_EUR(self):
        assert _parse_amount("18,50 EUR") == "18-50TTC"

    def test_ligne_total(self):
        assert _parse_amount("Total 57,00 €") == "57-00TTC"

    def test_ligne_montant(self):
        assert _parse_amount("Montant : 12,00 €") == "12-00TTC"

    def test_aucun_montant(self):
        assert _parse_amount("Aucun montant dans ce texte.") is None


# ── 3. Référence ──────────────────────────────────────────────────────────────

class TestParseRef:
    def test_format_standard_sncf(self):
        assert _parse_ref("N°2668453920-20260330") == "2668453920-20260330"

    def test_format_numerique_long(self):
        assert _parse_ref("N°123456789") == "123456789"

    def test_aucune_reference(self):
        assert _parse_ref("Aucune référence dans ce texte.") is None


# ── 4. Nom de fichier ─────────────────────────────────────────────────────────

class TestFieldsFilename:
    def test_tous_champs_presents(self):
        f = Fields(date="20260402", amount="18-50TTC", ref="2668453920-20260330")
        assert f.filename == "justificatif-achat-20260402-18-50ttc-2668453920-20260330.pdf"

    def test_date_manquante(self):
        f = Fields(date=None, amount="18-50TTC", ref="2668453920-20260330")
        assert "date-inconnue" in f.filename

    def test_montant_manquant(self):
        f = Fields(date="20260402", amount=None, ref="2668453920-20260330")
        assert "prix-inconnu" in f.filename

    def test_reference_manquante(self):
        f = Fields(date="20260402", amount="18-50TTC", ref=None)
        assert "ref-inconnue" in f.filename

    def test_avec_suffixe_conflit(self):
        f = Fields(date="20260402", amount="18-50TTC", ref="REF", counter=1)
        assert f.filename.endswith("-1.pdf")

    def test_champs_manquants_listes(self):
        f = Fields(date=None, amount=None, ref="REF")
        assert set(f.missing) == {"date", "montant"}


# ── 5. Déduplication passe 1 — sources identiques ────────────────────────────

class TestDeduplicateSources:
    def _make_file(self, path: Path, content: bytes, mtime: float) -> Path:
        path.write_bytes(content)
        import os
        os.utime(path, (mtime, mtime))
        return path

    def test_deux_fichiers_identiques_garde_le_plus_ancien(self, tmp_path):
        t_old = time.time() - 100
        t_new = time.time()
        old = self._make_file(tmp_path / "old.pdf", b"contenu", t_old)
        new = self._make_file(tmp_path / "new.pdf", b"contenu", t_new)
        result = deduplicate_sources([old, new])
        assert result == [old]

    def test_fichiers_distincts_tous_gardes(self, tmp_path):
        a = self._make_file(tmp_path / "a.pdf", b"contenu_a", time.time())
        b = self._make_file(tmp_path / "b.pdf", b"contenu_b", time.time() + 1)
        result = deduplicate_sources([a, b])
        assert set(result) == {a, b}

    def test_trois_fichiers_deux_identiques(self, tmp_path):
        t = time.time()
        a = self._make_file(tmp_path / "a.pdf", b"identique", t - 10)
        b = self._make_file(tmp_path / "b.pdf", b"identique", t)
        c = self._make_file(tmp_path / "c.pdf", b"different", t)
        result = deduplicate_sources([a, b, c])
        assert a in result
        assert b not in result
        assert c in result


# ── 6. Déduplication passe 2 — conflits de noms cibles ───────────────────────

class TestResolveConflicts:
    def _fields(self, **kw):
        return Fields(
            date=kw.get("date", "20260402"),
            amount=kw.get("amount", "18-50TTC"),
            ref=kw.get("ref", "REF"),
        )

    def test_pas_de_conflit(self, tmp_path):
        a = tmp_path / "a.pdf"; a.write_bytes(b"x")
        b = tmp_path / "b.pdf"; b.write_bytes(b"y")
        parsed = [(a, self._fields(ref="REF1")), (b, self._fields(ref="REF2"))]
        result = resolve_conflicts(parsed)
        assert len(result) == 2

    def test_conflit_contenu_identique_doublon_ignore(self, tmp_path):
        a = tmp_path / "a.pdf"; a.write_bytes(b"meme")
        b = tmp_path / "b.pdf"; b.write_bytes(b"meme")
        parsed = [(a, self._fields()), (b, self._fields())]
        result = resolve_conflicts(parsed)
        paths = [p for p, _ in result]
        assert len(paths) == 1

    def test_conflit_contenu_different_numerotation(self, tmp_path):
        t = time.time()
        a = tmp_path / "a.pdf"; a.write_bytes(b"contenu_a")
        b = tmp_path / "b.pdf"; b.write_bytes(b"contenu_b")
        import os
        os.utime(a, (t - 10, t - 10))
        os.utime(b, (t, t))
        parsed = [(a, self._fields()), (b, self._fields())]
        result = resolve_conflicts(parsed)
        counters = [f.counter for _, f in result if f is not None]
        assert sorted(counters) == [1, 2]

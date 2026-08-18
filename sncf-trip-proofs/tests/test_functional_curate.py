"""
Tests fonctionnels — chaîne complète curate-* (inbox → output).

Les PDFs ne sont pas lus : `extract_text` est remplacé par un texte de
justificatif. Ce qui est testé ici, c'est le comportement fichiers —
copie, dédoublonnage, conflits, contenu de output/ après un --real.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import sncf_common as common

def _load(name: str):
    spec = importlib.util.spec_from_file_location(name.replace("-", "_"), ROOT / name / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod

achat = _load("curate-justificatifs-achat")
voyage = _load("curate-justificatifs-voyage")

TEXTE_ACHAT = "Justificatif d'achat N°1917346212-20260504\nAller 02/04/2026 Paris Lyon\nTotal : 18,50 €"
TEXTE_VOYAGE = "Justificatif de voyage du 03/04/2026\nRéférence commande NE3ERM\nTCN 016487606\nMontant total 22,00 €"

def _pdf(directory: Path, name: str, content: bytes) -> Path:
    directory.mkdir(parents=True, exist_ok=True)
    p = directory / name
    p.write_bytes(content)
    return p

def _run(mod, monkeypatch, texte, in_dir: Path, out_dir: Path, argv=("--real",)):
    monkeypatch.setattr(mod, "load_config", lambda *a, **k: (in_dir, out_dir))
    monkeypatch.setattr(common, "extract_text", lambda path: texte)
    monkeypatch.setattr(sys, "argv", ["script", *argv])
    mod.main()

class TestChaineAchat:
    def test_real_copie_le_fichier_renomme(self, tmp_path, monkeypatch):
        inbox, out = tmp_path / "inbox", tmp_path / "out"
        source = _pdf(inbox, "JustificatifAchat_SNCFCONNECT.pdf", b"%PDF-a")

        _run(achat, monkeypatch, TEXTE_ACHAT, inbox, out)

        assert [p.name for p in out.glob("*.pdf")] == [
            "justificatif-achat-20260402-18-50ttc-1917346212-20260504.pdf"
        ]
        assert source.exists(), "la source ne doit jamais être supprimée"

    def test_dry_run_necrit_rien(self, tmp_path, monkeypatch):
        inbox, out = tmp_path / "inbox", tmp_path / "out"
        _pdf(inbox, "JustificatifAchat_SNCFCONNECT.pdf", b"%PDF-a")

        _run(achat, monkeypatch, TEXTE_ACHAT, inbox, out, argv=())

        assert not out.exists()

    def test_sources_identiques_dedoublonnees(self, tmp_path, monkeypatch):
        inbox, out = tmp_path / "inbox", tmp_path / "out"
        _pdf(inbox, "a.pdf", b"%PDF-identique")
        _pdf(inbox, "b.pdf", b"%PDF-identique")

        _run(achat, monkeypatch, TEXTE_ACHAT, inbox, out)

        assert len(list(out.glob("*.pdf"))) == 1

    def test_meme_nom_cible_contenus_differents_numerotes(self, tmp_path, monkeypatch):
        inbox, out = tmp_path / "inbox", tmp_path / "out"
        _pdf(inbox, "a.pdf", b"%PDF-un")
        _pdf(inbox, "b.pdf", b"%PDF-deux")

        _run(achat, monkeypatch, TEXTE_ACHAT, inbox, out)

        noms = sorted(p.name for p in out.glob("*.pdf"))
        assert len(noms) == 2
        assert all(n.endswith(("-1.pdf", "-2.pdf")) for n in noms), noms

class TestChaineVoyage:
    def test_real_copie_le_fichier_renomme_avec_tcn(self, tmp_path, monkeypatch):
        inbox, out = tmp_path / "inbox", tmp_path / "out"
        _pdf(inbox, "justificatif-voyage-brut.pdf", b"%PDF-v")

        _run(voyage, monkeypatch, TEXTE_VOYAGE, inbox, out)

        assert [p.name for p in out.glob("*.pdf")] == [
            "justificatif-voyage-20260403-22-00ttc-ne3erm-016487606.pdf"
        ]

class TestSortiePartagee:
    """Dans le workflow cloud documenté, achat et voyage écrivent tous deux
    dans curated/. Chaque script ne doit toucher qu'à ses propres fichiers."""

    def test_voyage_neffece_pas_la_sortie_dachat(self, tmp_path, monkeypatch):
        inbox_a, inbox_v = tmp_path / "inbox-a", tmp_path / "inbox-v"
        curated = tmp_path / "curated"
        _pdf(inbox_a, "achat.pdf", b"%PDF-a")
        _pdf(inbox_v, "voyage.pdf", b"%PDF-v")
        monkeypatch.setattr("builtins.input", lambda *a: "o")

        _run(achat, monkeypatch, TEXTE_ACHAT, inbox_a, curated)
        _run(voyage, monkeypatch, TEXTE_VOYAGE, inbox_v, curated)

        noms = sorted(p.name for p in curated.glob("*.pdf"))
        assert noms == [
            "justificatif-achat-20260402-18-50ttc-1917346212-20260504.pdf",
            "justificatif-voyage-20260403-22-00ttc-ne3erm-016487606.pdf",
        ], noms

    def test_relance_remplace_ses_propres_fichiers(self, tmp_path, monkeypatch):
        inbox, curated = tmp_path / "inbox", tmp_path / "curated"
        _pdf(inbox, "achat.pdf", b"%PDF-a")
        perime = _pdf(curated, "justificatif-achat-20250101-10-00ttc-vieux.pdf", b"%PDF-old")
        monkeypatch.setattr("builtins.input", lambda *a: "o")

        _run(achat, monkeypatch, TEXTE_ACHAT, inbox, curated)

        assert not perime.exists(), "un ancien fichier du même script doit être regénéré"
        assert len(list(curated.glob("*.pdf"))) == 1

    def test_fichier_etranger_preserve(self, tmp_path, monkeypatch):
        inbox, curated = tmp_path / "inbox", tmp_path / "curated"
        _pdf(inbox, "achat.pdf", b"%PDF-a")
        bilan = curated / "bilan-depenses-train-2026.md"
        curated.mkdir(parents=True, exist_ok=True)
        bilan.write_text("bilan")
        monkeypatch.setattr("builtins.input", lambda *a: "o")

        _run(achat, monkeypatch, TEXTE_ACHAT, inbox, curated)

        assert bilan.exists(), "un fichier non produit par ce script doit survivre"

    def test_sortie_egale_a_lentree_refusee(self, tmp_path, monkeypatch):
        inbox = tmp_path / "inbox"
        source = _pdf(inbox, "achat.pdf", b"%PDF-a")

        with pytest.raises(SystemExit):
            _run(achat, monkeypatch, TEXTE_ACHAT, inbox, inbox)

        assert source.exists()

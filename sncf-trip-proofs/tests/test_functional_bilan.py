"""
Tests fonctionnels — draw-bilan-depenses-train (dossier de justificatifs → bilans .md).

Les fichiers déposés sont des .pdf factices : leur nom porte déjà date, montant
et référence, la lecture PDF échoue silencieusement et le parsing retombe sur le
nom — le chemin nominal en production quand les curate-* ont fait leur travail.
"""
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

_spec = importlib.util.spec_from_file_location(
    "draw_bilan_depenses_train",
    ROOT / "draw-bilan-depenses-train" / "draw-bilan-depenses-train.py",
)
bilan = importlib.util.module_from_spec(_spec)
sys.modules[_spec.name] = bilan
_spec.loader.exec_module(bilan)

def _deposer(directory: Path, *noms: str) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for n in noms:
        (directory / n).write_bytes(b"pas-un-vrai-pdf")

def _run(monkeypatch, in_dir: Path, out_dir: Path) -> None:
    monkeypatch.setattr(sys, "argv", ["script", str(in_dir), str(out_dir)])
    bilan.main()

class TestBilanMonoAnnee:
    def test_totaux_et_fichier_genere(self, tmp_path, monkeypatch):
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated,
                 "justificatif-voyage-20260316-15-60ttc-d56qej.pdf",
                 "justificatif-voyage-20260402-18-50ttc-ne3erm-016487606.pdf")

        _run(monkeypatch, curated, out)

        rapport = (out / "bilan-depenses-train-2026.md").read_text()
        assert "34,10 €" in rapport
        assert "2 trajet(s) depuis 2 ticket(s) analysé(s) sur 2" in rapport

class TestBilanMultiAnnees:
    def test_un_fichier_par_annee(self, tmp_path, monkeypatch):
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated,
                 "justificatif-voyage-20250612-10-00ttc-aaaaaa.pdf",
                 "justificatif-voyage-20260316-15-60ttc-d56qej.pdf",
                 "justificatif-voyage-20260402-18-50ttc-ne3erm-016487606.pdf")

        _run(monkeypatch, curated, out)

        assert (out / "bilan-depenses-train-2025.md").exists()
        assert (out / "bilan-depenses-train-2026.md").exists()

    def test_chaque_bilan_ne_compte_que_ses_propres_tickets(self, tmp_path, monkeypatch):
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated,
                 "justificatif-voyage-20250612-10-00ttc-aaaaaa.pdf",
                 "justificatif-voyage-20260316-15-60ttc-d56qej.pdf",
                 "justificatif-voyage-20260402-18-50ttc-ne3erm-016487606.pdf")

        _run(monkeypatch, curated, out)

        r2025 = (out / "bilan-depenses-train-2025.md").read_text()
        r2026 = (out / "bilan-depenses-train-2026.md").read_text()
        assert "1 trajet(s) depuis 1 ticket(s) analysé(s) sur 1" in r2025
        assert "10,00 €" in r2025
        assert "2 trajet(s) depuis 2 ticket(s) analysé(s) sur 2" in r2026
        assert "34,10 €" in r2026

class TestDateImpossible:
    def test_31_fevrier_listee_en_erreur(self, tmp_path, monkeypatch):
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated,
                 "justificatif-voyage-20260231-12-00ttc-bbbbbb.pdf",
                 "justificatif-voyage-20260316-15-60ttc-d56qej.pdf")

        _run(monkeypatch, curated, out)

        rapport = (out / "bilan-depenses-train-2026.md").read_text()
        assert "Fichiers non traités (1)" in rapport
        assert "justificatif-voyage-20260231-12-00ttc-bbbbbb.pdf" in rapport
        assert "15,60 €" in rapport

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

def _run(monkeypatch, in_dir: Path, out_dir: Path, source: str = "voyage") -> None:
    monkeypatch.setattr(sys, "argv", ["script", str(in_dir), str(out_dir), "--source", source])
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

class TestSourceUnique:
    """Un même trajet a souvent un justificatif d'achat ET un de voyage, aux
    références disjointes : les compter tous les deux double la dépense."""

    FICHIERS = (
        "justificatif-achat-20260402-18-50ttc-1917346212-20260504.pdf",
        "justificatif-voyage-20260402-18-50ttc-ne3erm-016487606.pdf",
    )

    def test_le_voyage_rattache_a_son_achat_n_est_pas_recompte(self, tmp_path, monkeypatch):
        """Mode auto (défaut) : même date, même montant → une seule dépense."""
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated, *self.FICHIERS)

        monkeypatch.setattr(sys, "argv", ["script", str(curated), str(out)])
        bilan.main()

        rapport = (out / "bilan-depenses-train-2026.md").read_text()
        assert "18,50 €" in rapport
        assert "37,00 €" not in rapport
        assert "| Rattaché à un achat déjà compté (date + montant) | 1 |" in rapport

    def test_voyage_orphelin_compte_comme_trajet(self, tmp_path, monkeypatch):
        """Un trajet dont le justificatif d'achat n'a jamais été téléchargé — le
        cas du délai de 60 jours — doit rester dans le total."""
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated,
                 "justificatif-achat-20260402-18-50ttc-1917346212-20260504.pdf",
                 "justificatif-voyage-20260510-42-00ttc-ab12cd-016400111.pdf")

        monkeypatch.setattr(sys, "argv", ["script", str(curated), str(out)])
        bilan.main()

        rapport = (out / "bilan-depenses-train-2026.md").read_text()
        assert "60,50 €" in rapport
        assert "| Compté comme trajet, aucun achat ne le couvre    | 1 |" in rapport

    def test_source_achat_ecarte_le_voyage(self, tmp_path, monkeypatch):
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated, *self.FICHIERS)

        _run(monkeypatch, curated, out, source="achat")

        rapport = (out / "bilan-depenses-train-2026.md").read_text()
        assert "18,50 €" in rapport
        assert "| Écartés — autre type        | 1 |" in rapport

    def test_source_tous_compte_les_deux(self, tmp_path, monkeypatch):
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated, *self.FICHIERS)

        _run(monkeypatch, curated, out, source="tous")

        assert "37,00 €" in (out / "bilan-depenses-train-2026.md").read_text()

    def test_rapprochement_par_date_signale_quand_le_montant_vient_d_un_split(self, tmp_path, monkeypatch):
        """Un achat multi-trajets réparti à parts égales n'a aucun montant
        comparable : la machine rapproche sur la date et le dit."""
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated,
                 "justificatif-achat-20260402-20260404-57-00ttc-1917346212-20260504.pdf",
                 "justificatif-voyage-20260402-30-00ttc-ne3erm-016487606.pdf")
        texte = "Aller 02/04/2026 Paris → Lyon\nRetour 04/04/2026 Lyon → Paris"
        monkeypatch.setattr(bilan, "_read_pdf_text",
                            lambda path: texte if "achat" in path.name else None)

        monkeypatch.setattr(sys, "argv", ["script", str(curated), str(out)])
        bilan.main()

        rapport = (out / "bilan-depenses-train-2026.md").read_text()
        assert "57,00 €" in rapport
        assert "| Rattaché par date seule, montant non vérifié     | 1 |" in rapport
        assert "justificatif-voyage-20260402-30-00ttc-ne3erm-016487606.pdf" in rapport

    def test_reconciliation_compte_tous_les_pdf_deposes(self, tmp_path, monkeypatch):
        curated, out = tmp_path / "curated", tmp_path / "bilans"
        _deposer(curated, *self.FICHIERS)

        _run(monkeypatch, curated, out, source="achat")

        rapport = (out / "bilan-depenses-train-2026.md").read_text()
        assert "| PDF trouvés dans le dossier | 2 |" in rapport
        assert "| Retenus (tickets analysés)  | 1 |" in rapport

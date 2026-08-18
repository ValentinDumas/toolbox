"""
Tests d'idempotence — la chaîne complète, sources → curated/ → bilans/.

Deux propriétés, et rien d'autre ne les remplace :
  1. rejouer la chaîne ne change rien   (run ; run  → même état)
  2. les sorties sont reconstructibles  (rm -rf curated bilans ; run → même état)

Elles n'ont de sens que si les sources restent dans le domaine : le cycle
simulé ici déplace inbox/ vers archive/YYYY-MM entre deux runs, exactement ce
que fait sncf-run.sh.
"""
import hashlib
import importlib.util
import shutil
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
bilan = _load("draw-bilan-depenses-train")

TEXTES = {
    "achat.pdf": "Justificatif d'achat N°1917346212-20260504\nAller 02/04/2026\nRetour 04/04/2026\nTotal : 57,00 €",
    "voyage-2026.pdf": "Justificatif de voyage du 16/03/2026\nRéférence commande D56QEJ\nTCN 016487606\nMontant total 15,60 €",
    "voyage-2025.pdf": "Justificatif de voyage du 12/12/2025\nRéférence commande AB12CD\nTCN 016400111\nMontant total 42,00 €",
}

@pytest.fixture
def drive(tmp_path):
    inbox = tmp_path / "inbox"
    inbox.mkdir()
    for i, nom in enumerate(TEXTES):
        (inbox / nom).write_bytes(f"%PDF-{i}".encode())
    return tmp_path

def _run_chaine(monkeypatch, drive: Path) -> None:
    """achat, voyage, bilan — avec inbox/ ET archive/ comme corpus."""
    sources = [drive / "inbox", drive / "archive"]
    curated, bilans = drive / "curated", drive / "bilans"
    monkeypatch.setattr(common, "extract_text", lambda path: TEXTES[path.name])

    for mod in (achat, voyage):
        monkeypatch.setattr(mod, "load_config", lambda *a, **k: (sources, curated))
        monkeypatch.setattr(sys, "argv", ["script", "--real", "--yes"])
        mod.main()

    monkeypatch.setattr(sys, "argv", ["script", str(curated), str(bilans)])
    bilan.main()

def _archiver(drive: Path) -> None:
    """Ce que fait sncf-run.sh après un run : ranger les sources, sans les perdre."""
    archive = drive / "archive" / "2026-08"
    archive.mkdir(parents=True, exist_ok=True)
    for pdf in (drive / "inbox").glob("*.pdf"):
        shutil.move(str(pdf), archive / pdf.name)

def _etat(drive: Path) -> dict[str, str]:
    """Empreinte des artefacts dérivés — le cache de texte en est exclu : il est
    dérivé lui aussi, et son absence ne doit rien changer au résultat."""
    etat = {}
    for dossier in ("curated", "bilans"):
        for f in sorted((drive / dossier).rglob("*")):
            if f.is_file() and f.name != common.TEXT_CACHE:
                etat[f"{dossier}/{f.name}"] = hashlib.sha256(f.read_bytes()).hexdigest()
    return etat

class TestIdempotence:
    def test_rejouer_la_chaine_ne_change_rien(self, drive, monkeypatch):
        _run_chaine(monkeypatch, drive)
        premier = _etat(drive)
        assert premier, "le premier run doit produire des artefacts"

        _archiver(drive)
        _run_chaine(monkeypatch, drive)

        assert _etat(drive) == premier

    def test_sorties_reconstructibles_apres_suppression(self, drive, monkeypatch):
        _run_chaine(monkeypatch, drive)
        reference = _etat(drive)

        _archiver(drive)
        shutil.rmtree(drive / "curated")
        shutil.rmtree(drive / "bilans")
        _run_chaine(monkeypatch, drive)

        assert _etat(drive) == reference

    def test_le_corpus_couvre_les_deux_annees(self, drive, monkeypatch):
        _run_chaine(monkeypatch, drive)
        _archiver(drive)
        _run_chaine(monkeypatch, drive)

        curated = sorted(p.name for p in (drive / "curated").glob("*.pdf"))
        assert len(curated) == 3, curated
        assert (drive / "bilans" / "bilan-depenses-train-2025.md").exists()
        assert "57,00 €" in (drive / "bilans" / "bilan-depenses-train-2026.md").read_text()

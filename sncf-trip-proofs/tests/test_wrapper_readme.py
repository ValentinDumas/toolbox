"""
Tests du wrapper sncf-run.sh — extrait du README et exécuté tel quel.

Le wrapper est livré par la documentation : c'est le code que l'utilisateur
colle. Deux bugs y sont déjà passés (mapfile absent en bash 3.2, sortie
anticipée sur inbox vide), tous deux invisibles pour les tests Python.
"""
import hashlib
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
BASH = "/bin/bash"

pytestmark = pytest.mark.skipif(
    not (Path(BASH).exists() and shutil.which("shasum")),
    reason="wrapper testé sous /bin/bash avec shasum",
)

def _pdf(path: Path, lines: list[str]) -> None:
    content = "BT /F1 12 Tf 50 750 Td 14 TL\n" + "".join(f"({l}) Tj T*\n" for l in lines) + "ET"
    objs = ["<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R "
            "/Resources << /Font << /F1 5 0 R >> >> >>",
            f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"]
    out, offsets = "%PDF-1.4\n", []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{obj}\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs)+1}\n0000000000 65535 f \n"
    out += "".join(f"{o:010d} 00000 n \n" for o in offsets)
    out += f"trailer\n<< /Size {len(objs)+1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n"
    path.write_bytes(out.encode("cp1252"))

@pytest.fixture
def drive(tmp_path):
    import json
    d = tmp_path / "Justificatifs SNCF"
    (d / "inbox").mkdir(parents=True)
    _pdf(d / "inbox" / "JustificatifAchat_SNCFCONNECT.pdf",
         ["Justificatif d'achat", "N°1917346212-20260504",
          "Aller 02/04/2026 Paris - Lyon 28,50 €", "Retour 04/04/2026 Lyon - Paris 28,50 €",
          "Total : 57,00 €"])
    _pdf(d / "inbox" / "justificatif-voyage.pdf",
         ["Justificatif de voyage du 16/03/2026", "Référence de commande D56QEJ",
          "TCN 016487606", "Montant total 15,60 €"])
    cfg = {
        "curate-justificatifs-achat":  {"in": [f"{d}/inbox", f"{d}/archive"], "out": f"{d}/curated"},
        "curate-justificatifs-voyage": {"in": [f"{d}/inbox", f"{d}/archive"], "out": f"{d}/curated"},
        "draw-bilan-depenses-train":   {"in": f"{d}/curated", "out": f"{d}/bilans"},
    }
    (tmp_path / "config.json").write_text(json.dumps(cfg))
    return d

@pytest.fixture
def wrapper(tmp_path, drive):
    """Le script du README, REPO/DRIVE substitués, config.json isolé."""
    bloc = re.search(r"```bash\n(#!/usr/bin/env bash\n# ~/\.local/bin/sncf-run\.sh.*?)```",
                     (ROOT / "README.md").read_text(), re.S).group(1)
    repo = tmp_path / "repo"
    shutil.copytree(ROOT, repo, ignore=shutil.ignore_patterns(".venv", "__pycache__", ".pytest_cache"))
    shutil.copy(tmp_path / "config.json", repo / "config.json")
    bloc = bloc.replace('REPO="$HOME/Projects/toolbox/sncf-trip-proofs"', f'REPO="{repo}"')
    bloc = bloc.replace(
        'DRIVE="${SNCF_DRIVE:-$HOME/Library/CloudStorage/GoogleDrive-<email>/Mon Drive/Justificatifs SNCF}"',
        f'DRIVE="{drive}"')
    path = tmp_path / "sncf-run.sh"
    path.write_text(bloc)
    path.chmod(0o755)
    return path

def _lancer(wrapper: Path, tmp_path: Path) -> subprocess.CompletedProcess:
    env = dict(os.environ, TMPDIR=str(tmp_path), PATH=f"{Path(sys.executable).parent}:{os.environ['PATH']}")
    (tmp_path / "sncf-run.lock").unlink(missing_ok=True)
    return subprocess.run([BASH, str(wrapper)], capture_output=True, text=True, env=env)

def _etat(drive: Path) -> dict[str, str]:
    etat = {}
    for dossier in ("curated", "bilans"):
        for f in sorted((drive / dossier).rglob("*")):
            if f.is_file() and not f.name.startswith("."):
                etat[f"{dossier}/{f.name}"] = hashlib.sha256(f.read_bytes()).hexdigest()
    return etat

class TestWrapper:
    def test_run_complet_puis_archivage(self, wrapper, drive, tmp_path):
        r = _lancer(wrapper, tmp_path)
        assert r.returncode == 0, r.stdout + r.stderr
        assert not list((drive / "inbox").glob("*.pdf")), "les sources traitées sont rangées"
        assert len(list((drive / "archive").rglob("*.pdf"))) == 2
        assert len(list((drive / "curated").glob("*.pdf"))) == 2
        assert (drive / "bilans" / "bilan-depenses-train-2026.md").exists()

    def test_rejouer_ne_change_rien(self, wrapper, drive, tmp_path):
        _lancer(wrapper, tmp_path)
        premier = _etat(drive)
        r = _lancer(wrapper, tmp_path)
        assert r.returncode == 0, r.stdout + r.stderr
        assert _etat(drive) == premier

    def test_sorties_reconstruites_inbox_vide(self, wrapper, drive, tmp_path):
        _lancer(wrapper, tmp_path)
        reference = _etat(drive)
        shutil.rmtree(drive / "curated")
        shutil.rmtree(drive / "bilans")

        r = _lancer(wrapper, tmp_path)  # inbox vide : tout vient d'archive/

        assert r.returncode == 0, r.stdout + r.stderr
        assert _etat(drive) == reference

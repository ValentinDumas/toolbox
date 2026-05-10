"""Shared fixtures for all tests."""

import sqlite3
import sys
import tomllib
from pathlib import Path

import pytest
from fpdf import FPDF

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))


# ── PDF helpers ───────────────────────────────────────────────────────────────

def make_pdf(text: str, path: Path) -> Path:
    """Create a real PDF containing the given text."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", size=10)
    from fpdf.enums import XPos, YPos
    for line in text.split("\n"):
        pdf.cell(0, 5, line, new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.output(str(path))
    return path


def make_heic_like(path: Path) -> Path:
    """Create a minimal file with HEIC magic bytes (not a real image — for format detection only)."""
    # Real HEIC magic: offset 4 = ftyp
    data = b"\x00\x00\x00\x18ftypheic" + b"\x00" * 100
    path.write_bytes(data)
    return path


# ── Config fixture ────────────────────────────────────────────────────────────

DEFAULT_CONFIG = {
    "paths": {
        "input": "input/", "processed": "processed/", "errors": "errors/",
        "db": "data/invoices.db", "output": "output/", "review": "review/",
    },
}


@pytest.fixture
def tmp_project(tmp_path):
    """Isolated project directory with all subdirs and config.toml."""
    for d in ("input", "processed", "errors", "data", "output", "review"):
        (tmp_path / d).mkdir()
    cfg_text = """
[paths]
input = "input/"
processed = "processed/"
errors = "errors/"
db = "data/invoices.db"
output = "output/"
review = "review/"
"""
    (tmp_path / "config.toml").write_text(cfg_text.strip())

    # Pre-populate user profile so CLI scripts don't exit on missing profile
    from db import open_db
    db_path = tmp_path / "data" / "invoices.db"
    conn = open_db(db_path)
    conn.execute(
        "INSERT INTO user_profile (id, nom, siren, tva_intracom, fiscal_profile, cadence, setup_complete) "
        "VALUES (1, 'Test User', '123456789', '', 'auto-entrepreneur', '', 1)"
    )
    conn.commit()
    conn.close()

    return tmp_path


@pytest.fixture
def tmp_db(tmp_project):
    """Initialized SQLite DB with a complete user profile for tests."""
    from db import open_db
    db_path = tmp_project / "data" / "invoices.db"
    conn = open_db(db_path)
    conn.execute(
        "INSERT OR REPLACE INTO user_profile (id, nom, siren, tva_intracom, fiscal_profile, cadence, setup_complete) "
        "VALUES (1, 'Test User', '123456789', '', 'auto-entrepreneur', '', 1)"
    )
    conn.commit()
    yield conn, db_path
    conn.close()


# ── Synthetic invoice texts ───────────────────────────────────────────────────

OVH_TEXT = """\
Valentin Dumas
Reference de la facture : FR76061464
Date d emission : 01 Mars 2026
Total de la facture HT 107,88 EUR
TVA (20%) 21,58 EUR
Total de la facture TTC 129,46 EUR
SIREN : 424 761 419
N TVA FR22424761419
OVH SAS au capital de 10 174 560,00 EUR
Paiement par prelevement
"""

RECEIPT_TEXT = """\
BRICO DEPOT
ROUEN
QTE DESCRIPTION PRIX MONTANT
1 PEINTURE BLANCHE 22,90
1 BALAYETTE 2,90
TOTAL
Carte bancaire -61,54 EUR
ETAT TVA
TVA 20,00% 10,26 51,28 HT
"""

MINIMAL_TEXT = """\
Facture 2025-001
Date: 15/06/2025
Montant TTC: 50,00 EUR
"""

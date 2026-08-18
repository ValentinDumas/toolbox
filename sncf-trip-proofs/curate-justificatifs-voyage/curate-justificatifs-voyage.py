"""
curate-justificatifs-voyage.py — Organise les justificatifs de voyage PDF.

Usage:
    python3 curate-justificatifs-voyage.py [--dry-run | --real] [fichier.pdf]

Structure attendue :
    inbox/   ← déposer les PDFs bruts ici
    output/  ← fichiers organisés générés ici (vidé puis recréé à chaque --real)
"""

import re
import sys
from pathlib import Path
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import sncf_common as common
from sncf_common import MOIS, MOIS_ALT, deduplicate_sources, resolve_conflicts, extract_text, process_file

SECTION = "curate-justificatifs-voyage"

def load_config(config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    return common.load_config(SECTION, config_path)

@dataclass
class Fields:
    date: str | None
    amount: str | None
    ref: str | None
    tcn: str | None
    counter: int | None = None
    missing: list[str] = field(init=False)

    def __post_init__(self):
        self.missing = [k for k, v in {"date": self.date, "montant": self.amount, "référence": self.ref}.items() if v is None]

    @property
    def filename(self) -> str:
        tcn_part = f"-{self.tcn}" if self.tcn else ""
        counter_part = f"-{self.counter}" if self.counter is not None else ""
        amount = (self.amount or "prix-inconnu").lower()
        return (
            f"justificatif-voyage"
            f"-{self.date or 'date-inconnue'}"
            f"-{amount}"
            f"-{(self.ref or 'ref-inconnue').lower()}"
            f"{tcn_part}{counter_part}.pdf"
        )

def parse_fields(text: str) -> Fields:
    return Fields(
        date=_parse_date(text),
        amount=_parse_amount(text),
        ref=_parse_ref(text),
        tcn=_parse_tcn(text),
    )

def _parse_date(text: str) -> str | None:
    m = re.compile(
        r"(?:voyage\s+du|aller\s+le|retour\s+le)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})",
        re.IGNORECASE,
    ).search(text)
    if m:
        return f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"

    m = re.compile(
        rf"(?:voyage\s+du|aller\s+le|retour\s+le)\s+(\d{{1,2}})\s+({MOIS_ALT})\s+(\d{{4}})",
        re.IGNORECASE,
    ).search(text)
    if m:
        return f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"

    m = re.compile(rf"\b(\d{{1,2}})\s+({MOIS_ALT})\s+(\d{{4}})\b", re.IGNORECASE).search(text)
    if m:
        return f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"

    m = re.compile(r"\b(\d{2})[/\-\.](\d{2})[/\-\.](\d{4})\b").search(text)
    if m:
        return f"{m.group(3)}{m.group(2)}{m.group(1)}"

    return None

def _parse_amount(text: str) -> str | None:
    m = re.compile(
        r"(?:total|montant)[^\n]*?(\d{1,4})[,\.](\d{2})\s*(?:€|EUR|euros?)(?:\s|$|[,;])",
        re.IGNORECASE,
    ).search(text)
    if m:
        return f"{m.group(1)}-{m.group(2)}TTC"

    m = re.compile(
        r"(?<!\d)(\d{1,4})[,\.](\d{2})\s*(?:€|EUR|euros?)(?=\s|$|[,;])"
        r"|(?<!\d)(\d{1,4})\s*(?:€|EUR|euros?)(?=\s|$|[,;])",
        re.IGNORECASE,
    ).search(text)
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}TTC" if m.group(1) else f"{m.group(3)}-00TTC"

def _parse_ref(text: str) -> str | None:
    m = re.compile(
        r"(?:référence|réf)[^\n]*?commande\s+([A-Z0-9]{5,10})\b",
        re.IGNORECASE,
    ).search(text)
    if m:
        return m.group(1).upper()
    m = re.compile(
        r"(?:référence|réf)\s+([A-Z0-9]{5,10})\b",
        re.IGNORECASE,
    ).search(text)
    return m.group(1).upper() if m else None

def _parse_tcn(text: str) -> str | None:
    m = re.search(r"\bTCN\s+(\d{6,12})\b", text, re.IGNORECASE)
    return m.group(1) if m else None

def main():
    config_in, config_out = load_config()
    common.run_curate(
        description="Organise les justificatifs de voyage PDF",
        config_in=config_in,
        config_out=config_out,
        parse_fields=parse_fields,
        extra_lines=lambda f: [f"  TCN       : {f.tcn or '—'}"],
    )

if __name__ == "__main__":
    main()

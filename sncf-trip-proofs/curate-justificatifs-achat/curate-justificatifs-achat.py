"""
curate-justificatifs-achat.py — Organise les justificatifs d'achat PDF.

Usage:
    python3 curate-justificatifs-achat.py [--dry-run | --real] [fichier.pdf]

Structure attendue :
    inbox/   ← déposer les PDFs bruts ici
    output/  ← fichiers organisés générés ici (`justificatif-achat-*` regénérés à chaque --real)
"""

import re
import sys
from pathlib import Path
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import sncf_common as common
from sncf_common import MOIS, deduplicate_sources, resolve_conflicts, extract_text, process_file

SECTION = "curate-justificatifs-achat"

def load_config(config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    return common.load_config(SECTION, config_path)

@dataclass
class Fields:
    date: str | None
    amount: str | None
    ref: str | None
    counter: int | None = None
    missing: list[str] = field(init=False)

    def __post_init__(self):
        self.missing = [k for k, v in {"date": self.date, "montant": self.amount, "référence": self.ref}.items() if v is None]

    @property
    def filename(self) -> str:
        suffix = f"-{self.counter}" if self.counter is not None else ""
        amount = (self.amount or "prix-inconnu").lower()
        return (
            f"justificatif-achat"
            f"-{self.date or 'date-inconnue'}"
            f"-{amount}"
            f"-{self.ref or 'ref-inconnue'}"
            f"{suffix}.pdf"
        )

def parse_fields(text: str) -> Fields:
    return Fields(
        date=_parse_date(text),
        amount=_parse_amount(text),
        ref=_parse_ref(text),
    )

RE_TICKET_DATE = re.compile(
    r"(?:Aller|Retour|Departure|Return)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})",
    re.IGNORECASE,
)

def _parse_date(text: str) -> str | None:
    """Un justificatif d'achat couvre plusieurs trajets : on encode la plage."""
    ticket_dates = sorted({
        f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"
        for m in RE_TICKET_DATE.finditer(text)
    })
    if ticket_dates:
        return ticket_dates[0] if len(ticket_dates) == 1 else f"{ticket_dates[0]}-{ticket_dates[-1]}"
    return common.parse_date(text)

def _parse_amount(text: str) -> str | None:
    amount = common.parse_amount(text)
    return f"{amount}TTC" if amount else None

def _parse_ref(text: str) -> str | None:
    m = re.compile(r"N°([\w]+-\d{8})\b").search(text)
    if m:
        return m.group(1)

    m = re.compile(r"N°(\d{8,})\b").search(text)
    if m:
        return m.group(1)

    return None

def main():
    config_in, config_out = load_config()
    common.run_curate(
        description="Organise les justificatifs d'achat PDF",
        config_in=config_in,
        config_out=config_out,
        parse_fields=parse_fields,
        prefix="justificatif-achat-",
    )

if __name__ == "__main__":
    main()

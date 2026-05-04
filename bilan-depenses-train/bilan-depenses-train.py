#!/usr/bin/env python3
"""
bilan-depenses-train.py — Génère un bilan de dépenses train à partir des justificatifs d'achat.

Usage:
    python3 bilan-depenses-train.py [IN] [OUT]

    Aucun argument  → IN = OUT = répertoire courant
    IN seul         → OUT = IN
    IN + OUT        → IN distinct de OUT
"""

import re
import sys
import logging
import warnings
import argparse
from pathlib import Path
from datetime import date
from collections import defaultdict
from dataclasses import dataclass

MOIS_FR = {
    1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
    5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
    9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
}

RE_RENAMED = re.compile(
    r"justificatif_achat_(\d{8})_(\d{1,4}-\d{2})TTC_(.+)\.pdf",
    re.IGNORECASE,
)


@dataclass
class Entry:
    filename: str
    amount: float
    year: int
    month: int


@dataclass
class ErrorEntry:
    filename: str
    reason: str


def parse_renamed_filename(name: str) -> tuple[str, float] | None:
    """Extrait (date_str, amount) depuis un nom renommé. Retourne None si non reconnu."""
    m = RE_RENAMED.match(name)
    if not m:
        return None
    date_str = m.group(1)
    try:
        amount = float(m.group(2).replace("-", "."))
    except ValueError:
        return None
    return date_str, amount


def _read_pdf_text(path: Path) -> str | None:
    """Ouvre un PDF et retourne son texte brut, ou None en cas d'échec."""
    try:
        import pdfplumber
    except ImportError:
        return None
    try:
        logging.disable(logging.CRITICAL)
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            with pdfplumber.open(path) as pdf:
                return "\n".join(p.extract_text() or "" for p in pdf.pages).strip()
    except Exception:
        return None
    finally:
        logging.disable(logging.NOTSET)


def parse_via_pdf(path: Path) -> tuple[str, float] | None:
    """Fallback : extraction via pdfplumber avec les mêmes patterns que le script de renommage."""
    text = _read_pdf_text(path)
    if not text or len(text) < 20:
        return None
    date_str = _pdf_parse_date(text)
    amount = _pdf_parse_amount(text)
    if date_str and amount is not None:
        return date_str, amount
    return None


def _pdf_parse_date(text: str) -> str | None:
    MOIS_MAP = {
        "janvier": "01", "février": "02", "fevrier": "02",
        "mars": "03", "avril": "04", "mai": "05", "juin": "06",
        "juillet": "07", "août": "08", "aout": "08",
        "septembre": "09", "octobre": "10", "novembre": "11",
        "décembre": "12", "decembre": "12",
    }
    mois_alt = "|".join(MOIS_MAP)

    patterns = [
        (re.compile(r"(?:Aller|Retour|Departure|Return)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})", re.IGNORECASE),
         lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
        (re.compile(r"(?:du|le|date)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})", re.IGNORECASE),
         lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
        (re.compile(rf"(?:du|le|date)\s+(\d{{1,2}})\s+({mois_alt})\s+(\d{{4}})", re.IGNORECASE),
         lambda m: f"{m.group(3)}{MOIS_MAP[m.group(2).lower()]}{int(m.group(1)):02d}"),
        (re.compile(rf"\b(\d{{1,2}})\s+({mois_alt})\s+(\d{{4}})\b", re.IGNORECASE),
         lambda m: f"{m.group(3)}{MOIS_MAP[m.group(2).lower()]}{int(m.group(1)):02d}"),
        (re.compile(r"\b(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})\b"),
         lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
        (re.compile(r"N°[\w]+-(\d{4})(\d{2})(\d{2})\b"),
         lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}"),
    ]

    for pattern, extractor in patterns:
        match = pattern.search(text)
        if match:
            return extractor(match)
    return None


def _pdf_parse_amount(text: str) -> float | None:
    m = re.search(r"€\s*(\d{1,4})[,\.](\d{2})\b", text)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")

    m = re.search(r"€\s*(\d{1,4})\b", text)
    if m:
        return float(m.group(1))

    m = re.search(r"(?:total|montant)[^\n]*?(\d{1,4})[,\.](\d{2})\s*(?:€|EUR)", text, re.IGNORECASE)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")

    m = re.search(r"(?<!\d)(\d{1,4})[,\.](\d{2})\s*(?:€|EUR|euros?)(?=\s|$|[,;])", text, re.IGNORECASE)
    if m:
        return float(f"{m.group(1)}.{m.group(2)}")

    return None


def parse_date_str(date_str: str) -> tuple[int, int] | None:
    """Retourne (year, month) depuis YYYYMMDD, ou None si invalide."""
    if len(date_str) != 8 or not date_str.isdigit():
        return None
    y, m = int(date_str[:4]), int(date_str[4:6])
    if not (1 <= m <= 12 and 2000 <= y <= 2100):
        return None
    return y, m


def scan(in_dir: Path) -> tuple[list[Entry], list[ErrorEntry]]:
    pdfs = sorted(in_dir.glob("*.pdf"))
    if not pdfs:
        return [], []

    entries: list[Entry] = []
    errors: list[ErrorEntry] = []

    for pdf in pdfs:
        result = parse_renamed_filename(pdf.name)

        if result is None:
            print(f"  [FALLBACK PDF] {pdf.name}")
            result = parse_via_pdf(pdf)

        if result is None:
            reason = "Nom non reconnu et lecture PDF échouée"
            print(f"  ✗ {pdf.name} → {reason}")
            errors.append(ErrorEntry(filename=pdf.name, reason=reason))
            continue

        date_str, amount = result
        ym = parse_date_str(date_str)
        if ym is None:
            reason = f"Date invalide : {date_str}"
            print(f"  ✗ {pdf.name} → {reason}")
            errors.append(ErrorEntry(filename=pdf.name, reason=reason))
            continue

        year, month = ym
        entries.append(Entry(filename=pdf.name, amount=amount, year=year, month=month))

    return entries, errors


def fmt_eur(amount: float) -> str:
    return f"{amount:,.2f} €".replace(",", " ").replace(".", ",")


def generate_report(entries: list[Entry], errors: list[ErrorEntry], year: int) -> str:
    year_entries = [e for e in entries if e.year == year]
    total = sum(e.amount for e in year_entries)
    n = len(year_entries)
    avg = total / n if n else 0.0

    months_present = sorted({e.month for e in year_entries})
    if months_present:
        first = f"{MOIS_FR[months_present[0]]} {year}"
        last = f"{MOIS_FR[months_present[-1]]} {year}"
        period = first if first == last else f"{first} → {last}"
    else:
        period = "—"

    total_files = n + len(errors)
    generated_on = date.today().isoformat()

    by_month: dict[int, list[Entry]] = defaultdict(list)
    for e in year_entries:
        by_month[e.month].append(e)

    month_col_w = max((len(f"{MOIS_FR[m]} {year}") for m in by_month), default=14)
    month_col_w = max(month_col_w, 14)

    lines = [
        f"# Bilan dépenses train — {year}",
        "",
        f"Généré le {generated_on} | {n} justificatif(s) traité(s) sur {total_files} | {len(errors)} erreur(s)",
        "",
        "---",
        "",
        "## Récapitulatif global",
        "",
        "| Métrique              | Valeur        |",
        "|-----------------------|---------------|",
        f"| **Total TTC**         | **{fmt_eur(total)}** |",
        f"| Nombre de trajets     | {n}           |",
        f"| Coût moyen / trajet   | {fmt_eur(avg)} |",
        f"| Période couverte      | {period}      |",
        "",
        "---",
        "",
        "## Détail par mois",
        "",
        f"| {'Mois':<{month_col_w}} | Trajets | Total TTC     |",
        f"|{'-'*(month_col_w+2)}|---------|---------------|",
    ]

    for m in sorted(by_month):
        month_entries = by_month[m]
        month_total = sum(e.amount for e in month_entries)
        label = f"{MOIS_FR[m]} {year}"
        lines.append(f"| {label:<{month_col_w}} | {len(month_entries):>7} | {fmt_eur(month_total):>13} |")

    if errors:
        lines += [
            "",
            "---",
            "",
            f"## Fichiers non traités ({len(errors)})",
            "",
            "| Fichier | Raison |",
            "|---------|--------|",
        ]
        for err in errors:
            lines.append(f"| `{err.filename}` | {err.reason} |")

    lines.append("")
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Génère un bilan de dépenses train depuis les justificatifs d'achat PDF.",
        usage="%(prog)s [IN] [OUT]",
    )
    parser.add_argument("paths", nargs="*", metavar="PATH")
    args = parser.parse_args()

    match len(args.paths):
        case 0:
            in_dir = out_dir = Path.cwd()
        case 1:
            in_dir = out_dir = Path(args.paths[0])
        case 2:
            in_dir, out_dir = Path(args.paths[0]), Path(args.paths[1])
        case _:
            parser.error("Maximum 2 arguments : IN et OUT.")

    if not in_dir.exists() or not in_dir.is_dir():
        print(f"Erreur : dossier IN introuvable : {in_dir}")
        sys.exit(1)

    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Lecture de : {in_dir.resolve()}")
    pdfs = list(in_dir.glob("*.pdf"))
    print(f"{len(pdfs)} fichier(s) PDF trouvé(s)\n")

    if not pdfs:
        print("Rien à traiter.")
        sys.exit(0)

    entries, errors = scan(in_dir)

    years: dict[int, list[Entry]] = defaultdict(list)
    for e in entries:
        years[e.year].append(e)

    if not years and not errors:
        print("\nAucune donnée exploitable.")
        sys.exit(0)

    dominant_year = max(years, key=lambda y: len(years[y])) if years else date.today().year

    print(f"\n✓ {len(entries)} traité(s) avec succès")
    if errors:
        print(f"✗ {len(errors)} erreur(s) :")
        for err in errors:
            print(f"  - {err.filename} → {err.reason}")

    generated = []
    for year in sorted(years):
        report = generate_report(entries, errors if year == dominant_year else [], year)
        out_file = out_dir / f"bilan-depenses-train-{year}.md"
        out_file.write_text(report, encoding="utf-8")
        generated.append(out_file)

    print()
    for f in generated:
        print(f"✓ Bilan généré : {f.name}")
        print(f"  → {f.resolve()}")


if __name__ == "__main__":
    main()

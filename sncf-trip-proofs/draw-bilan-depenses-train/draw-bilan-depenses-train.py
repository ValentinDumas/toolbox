#!/usr/bin/env python3
"""
draw-bilan-depenses-train.py — Génère un bilan de dépenses train à partir des justificatifs d'achat.

Usage:
    python3 draw-bilan-depenses-train.py [IN] [OUT]

    Aucun argument  → IN = OUT = répertoire courant
    IN seul         → OUT = IN
    IN + OUT        → IN distinct de OUT
"""

import re
import sys
import json
import logging
import warnings
import argparse
from pathlib import Path
from datetime import date
from collections import defaultdict
from dataclasses import dataclass, field

MOIS_FR = {
    1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
    5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
    9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
}


def load_config(config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    if config_path is None:
        config_path = Path(__file__).parent.parent / "config.json"
    if not config_path.exists():
        return None, None
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        section = cfg.get("draw-bilan-depenses-train", {})
        in_path = Path(section["in"]) if section.get("in") else None
        out_path = Path(section["out"]) if section.get("out") else None
        return in_path, out_path
    except (json.JSONDecodeError, KeyError, TypeError):
        return None, None

RE_RENAMED_ACHAT = re.compile(
    r"justificatif-achat-(\d{8}(?:-\d{8})?)-(\d{1,4}-\d{2})ttc-(.+)\.pdf",
    re.IGNORECASE,
)

RE_RENAMED_VOYAGE = re.compile(
    r"justificatif-voyage-(\d{8})-(\d{1,4}-\d{2})ttc-([a-z0-9]+(?:-\d{6,12})?)(?:-\d{1,3})?\.pdf",
    re.IGNORECASE,
)

RE_LEG_WITH_PRICE = re.compile(
    r"(?:Aller|Retour|Departure|Return)"
    r"\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})"
    r"[^\n]*?(\d{1,4})[,\.](\d{2})\s*€",
    re.IGNORECASE,
)

RE_LEG_DATE_ONLY = re.compile(
    r"(?:Aller|Retour|Departure|Return)"
    r"\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})",
    re.IGNORECASE,
)

_RE_REF_BASE = re.compile(r"^(\d{6,})-\d{8}$")


@dataclass
class Trip:
    filename: str
    amount: float
    year: int
    month: int
    day: int
    from_pdf: bool = field(default=False)


@dataclass
class ErrorEntry:
    filename: str
    reason: str


def extract_ref_base(ref: str) -> str:
    m = _RE_REF_BASE.match(ref)
    return m.group(1) if m else ref


def parse_renamed_filename(name: str) -> tuple[str, float, str] | None:
    for pattern in (RE_RENAMED_ACHAT, RE_RENAMED_VOYAGE):
        m = pattern.match(name)
        if not m:
            continue
        date_part = m.group(1)
        try:
            amount = float(m.group(2).replace("-", "."))
        except ValueError:
            return None
        ref = m.group(3)
        return date_part, amount, ref
    return None


def _read_pdf_text(path: Path) -> str | None:
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


def parse_date_str(date_str: str) -> tuple[int, int, int] | None:
    if len(date_str) != 8 or not date_str.isdigit():
        return None
    y, m, d = int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8])
    if not (1 <= m <= 12 and 1 <= d <= 31 and 2000 <= y <= 2100):
        return None
    return y, m, d


def extract_trips_from_pdf(path: Path, total_amount: float, filename: str) -> list[Trip]:
    text = _read_pdf_text(path)
    if not text:
        return []

    # Tentative 1 : prix individuel par leg sur la même ligne
    trips: list[Trip] = []
    for m in RE_LEG_WITH_PRICE.finditer(text):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        amount = float(f"{m.group(4)}.{m.group(5)}")
        if parse_date_str(f"{y:04d}{mo:02d}{d:02d}") is None:
            continue
        trips.append(Trip(filename=filename, amount=amount, year=y, month=mo, day=d, from_pdf=True))
    if trips:
        return trips

    # Tentative 2 : legs sans prix → split égal
    legs = list(RE_LEG_DATE_ONLY.finditer(text))
    if not legs:
        return []
    per_leg = round(total_amount / len(legs), 2)
    for m in legs:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if parse_date_str(f"{y:04d}{mo:02d}{d:02d}") is None:
            continue
        trips.append(Trip(filename=filename, amount=per_leg, year=y, month=mo, day=d, from_pdf=False))
    return trips


def scan(in_dir: Path) -> tuple[list[Trip], list[ErrorEntry], int]:
    pdfs = sorted(in_dir.glob("*.pdf"))
    if not pdfs:
        return [], [], 0

    # Passe 1 : parse noms / fallback PDF
    raw: list[tuple[Path, str, float, str]] = []
    errors: list[ErrorEntry] = []

    for pdf in pdfs:
        result = parse_renamed_filename(pdf.name)
        if result is not None:
            date_part, amount, ref = result
            date_str = date_part[:8]
            raw.append((pdf, date_str, amount, ref))
            continue

        print(f"  [FALLBACK PDF] {pdf.name}")
        fallback = parse_via_pdf(pdf)
        if fallback is None:
            reason = "Nom non reconnu et lecture PDF échouée"
            print(f"  ✗ {pdf.name} → {reason}")
            errors.append(ErrorEntry(filename=pdf.name, reason=reason))
            continue

        date_str, amount = fallback
        raw.append((pdf, date_str, amount, "unknown"))

    # Passe 2 : déduplication par ref_base
    seen_refs: dict[str, str] = {}
    deduped: list[tuple[Path, str, float, str]] = []

    for pdf, date_str, amount, ref in raw:
        ref_base = extract_ref_base(ref)
        if ref_base != "unknown" and ref_base in seen_refs:
            print(f"  [DOUBLON] {pdf.name} → même commande que {seen_refs[ref_base]}")
            continue
        if ref_base != "unknown":
            seen_refs[ref_base] = pdf.name
        deduped.append((pdf, date_str, amount, ref))

    ticket_count = len(deduped)

    # Passe 3 : extraction des Trip individuels
    trips: list[Trip] = []

    for pdf, date_str, amount, ref in deduped:
        extracted = extract_trips_from_pdf(pdf, amount, pdf.name)
        if extracted:
            trips.extend(extracted)
            continue

        ymd = parse_date_str(date_str)
        if ymd is None:
            reason = f"Date invalide : {date_str}"
            print(f"  ✗ {pdf.name} → {reason}")
            errors.append(ErrorEntry(filename=pdf.name, reason=reason))
            continue
        y, mo, d = ymd
        trips.append(Trip(filename=pdf.name, amount=amount, year=y, month=mo, day=d, from_pdf=False))

    return trips, errors, ticket_count


def fmt_eur(amount: float) -> str:
    return f"{amount:,.2f} €".replace(",", " ").replace(".", ",")


def print_debug(trips: list[Trip]) -> None:
    by_date: dict[tuple[int, int, int], list[Trip]] = defaultdict(list)
    for t in trips:
        by_date[(t.year, t.month, t.day)].append(t)

    print("\n── Détail des trajets ──────────────────────────────")
    for (y, m, d) in sorted(by_date):
        day_trips = by_date[(y, m, d)]
        label = f"{d:02d}/{m:02d}/{y}"
        total_day = sum(t.amount for t in day_trips)
        print(f"\n  {label}  ({len(day_trips)} trajet(s) — {fmt_eur(total_day)})")
        for t in day_trips:
            marker = "PDF " if t.from_pdf else "calc"
            print(f"    • [{marker}] {fmt_eur(t.amount)}  ←  {t.filename}")
    print()


def generate_report(trips: list[Trip], errors: list[ErrorEntry], year: int, ticket_count: int) -> str:
    year_trips = [t for t in trips if t.year == year]
    total = sum(t.amount for t in year_trips)
    n = len(year_trips)
    avg = total / n if n else 0.0

    months_present = sorted({t.month for t in year_trips})
    if months_present:
        first = f"{MOIS_FR[months_present[0]]} {year}"
        last = f"{MOIS_FR[months_present[-1]]} {year}"
        period = first if first == last else f"{first} → {last}"
    else:
        period = "—"

    total_files = ticket_count + len(errors)
    generated_on = date.today().isoformat()

    by_month: dict[int, list[Trip]] = defaultdict(list)
    for t in year_trips:
        by_month[t.month].append(t)

    month_col_w = max((len(f"{MOIS_FR[m]} {year}") for m in by_month), default=14)
    month_col_w = max(month_col_w, 14)

    lines = [
        f"# Bilan dépenses train — {year}",
        "",
        f"Généré le {generated_on} | {n} trajet(s) depuis {ticket_count} ticket(s) analysé(s) sur {total_files} | {len(errors)} erreur(s)",
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
        "## Total annuel",
        "",
        "| Année | Trajets | Total TTC     |",
        "|-------|---------|---------------|",
        f"| {year}  | {n:>7} | {fmt_eur(total):>13} |",
        "",
        "---",
        "",
        "## Détail par mois",
        "",
        f"| {'Mois':<{month_col_w}} | Trajets | Total TTC     |",
        f"|{'-'*(month_col_w+2)}|---------|---------------|",
    ]

    for m in sorted(by_month):
        month_trips = by_month[m]
        month_total = sum(t.amount for t in month_trips)
        label = f"{MOIS_FR[m]} {year}"
        lines.append(f"| {label:<{month_col_w}} | {len(month_trips):>7} | {fmt_eur(month_total):>13} |")

    lines += ["", "---", "", "## Voyages par mois", ""]

    for m in sorted(by_month):
        month_trips = sorted(by_month[m], key=lambda t: t.day)
        month_total = sum(t.amount for t in month_trips)
        lines.append(f"### {MOIS_FR[m]} {year} — {len(month_trips)} trajet(s) — {fmt_eur(month_total)}")
        lines.append("")
        lines.append("| Date       | Prix      | Fichier source |")
        lines.append("|------------|-----------|----------------|")
        for t in month_trips:
            date_label = f"{t.day:02d}/{m:02d}/{year}"
            fname = t.filename if len(t.filename) <= 55 else t.filename[:52] + "…"
            lines.append(f"| {date_label} | {fmt_eur(t.amount):>9} | `{fname}` |")
        lines.append("")

    if errors:
        lines += [
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
            config_in, config_out = load_config()
            in_dir = config_in if config_in else Path.cwd()
            out_dir = config_out if config_out else Path.cwd()
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

    trips, errors, ticket_count = scan(in_dir)

    years: dict[int, list[Trip]] = defaultdict(list)
    for t in trips:
        years[t.year].append(t)

    if not years and not errors:
        print("\nAucune donnée exploitable.")
        sys.exit(0)

    dominant_year = max(years, key=lambda y: len(years[y])) if years else date.today().year

    print(f"\n✓ {len(trips)} trajet(s) extrait(s) depuis {ticket_count} ticket(s)")
    if errors:
        print(f"✗ {len(errors)} erreur(s) :")
        for err in errors:
            print(f"  - {err.filename} → {err.reason}")

    print_debug(trips)

    generated = []
    for year in sorted(years):
        report = generate_report(trips, errors if year == dominant_year else [], year, ticket_count)
        out_file = out_dir / f"bilan-depenses-train-{year}.md"
        out_file.write_text(report, encoding="utf-8")
        generated.append(out_file)

    print()
    for f in generated:
        print(f"✓ Bilan généré : {f.name}")
        print(f"  → {f.resolve()}")


if __name__ == "__main__":
    main()

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
import logging
import warnings
import argparse
from pathlib import Path
from datetime import date
from collections import defaultdict
from dataclasses import dataclass, field

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import sncf_common as common

MOIS_FR = {
    1: "Janvier", 2: "Février", 3: "Mars", 4: "Avril",
    5: "Mai", 6: "Juin", 7: "Juillet", 8: "Août",
    9: "Septembre", 10: "Octobre", 11: "Novembre", 12: "Décembre",
}


SECTION = "draw-bilan-depenses-train"

def load_config(config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    return common.load_config(SECTION, config_path)

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
    # Montant issu d'une répartition à parts égales, donc jamais celui qu'affiche
    # un justificatif de voyage : le rapprochement doit s'y faire sur la date.
    split: bool = field(default=False)


@dataclass
class ErrorEntry:
    filename: str
    reason: str

@dataclass
class Reconciliation:
    """De combien de PDFs déposés partent les trajets du bilan, et où sont passés
    les autres. Sans ce compte, un justificatif écarté ne se voit nulle part et
    le total déclaré est muet sur ce qu'il ne couvre pas."""
    found: int = 0
    kept: int = 0
    other_type: list[str] = field(default_factory=list)
    duplicates: list[str] = field(default_factory=list)
    # Mode auto : ce qu'est devenu chaque justificatif de voyage.
    attached: list[str] = field(default_factory=list)
    attached_by_date: list[str] = field(default_factory=list)
    promoted: list[str] = field(default_factory=list)


def extract_ref_base(ref: str) -> str:
    m = _RE_REF_BASE.match(ref)
    return m.group(1) if m else ref


def parse_renamed_filename(name: str) -> tuple[str, float, str, str] | None:
    """(dates, montant, référence, type de document) ou None si le nom n'est pas
    celui produit par un curate-*."""
    for doc_type, pattern in (("achat", RE_RENAMED_ACHAT), ("voyage", RE_RENAMED_VOYAGE)):
        m = pattern.match(name)
        if not m:
            continue
        date_part = m.group(1)
        try:
            amount = float(m.group(2).replace("-", "."))
        except ValueError:
            return None
        ref = m.group(3)
        return date_part, amount, ref, doc_type
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
    return common.parse_date(text)

def _pdf_parse_amount(text: str) -> float | None:
    amount = common.parse_amount(text)
    return float(amount.replace("-", ".")) if amount else None

def parse_date_str(date_str: str) -> tuple[int, int, int] | None:
    """YYYYMMDD → (année, mois, jour). None si la date n'existe pas au calendrier."""
    if len(date_str) != 8 or not date_str.isdigit():
        return None
    y, m, d = int(date_str[:4]), int(date_str[4:6]), int(date_str[6:8])
    if not 2000 <= y <= 2100:
        return None
    try:
        date(y, m, d)
    except ValueError:
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
    # Le reste de la division va au premier leg : sans ça, 10,00 € sur 3 trajets
    # totalisent 9,99 € et le bilan ne rend plus le montant du justificatif.
    per_leg, extra = divmod(round(total_amount * 100), len(legs))
    for i, m in enumerate(legs):
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if parse_date_str(f"{y:04d}{mo:02d}{d:02d}") is None:
            continue
        amount = (per_leg + (extra if i == 0 else 0)) / 100
        trips.append(Trip(filename=filename, amount=amount, year=y, month=mo, day=d,
                          from_pdf=False, split=True))
    return trips


Entry = tuple[Path, str, float, str]

def _deduplicate(entries: list[Entry], recon: "Reconciliation") -> list[Entry]:
    """Une même commande re-téléchargée ne doit compter qu'une fois."""
    seen_refs: dict[str, str] = {}
    deduped: list[Entry] = []
    for pdf, date_str, amount, ref in entries:
        ref_base = extract_ref_base(ref)
        if ref_base != "unknown" and ref_base in seen_refs:
            print(f"  [DOUBLON] {pdf.name} → même commande que {seen_refs[ref_base]}")
            recon.duplicates.append(pdf.name)
            continue
        if ref_base != "unknown":
            seen_refs[ref_base] = pdf.name
        deduped.append((pdf, date_str, amount, ref))
    return deduped

def _to_trips(entries: list[Entry], errors: list[ErrorEntry],
              tickets_by_year: dict[int, int]) -> list[Trip]:
    trips: list[Trip] = []
    for pdf, date_str, amount, _ref in entries:
        extracted = extract_trips_from_pdf(pdf, amount, pdf.name)
        if extracted:
            trips.extend(extracted)
            tickets_by_year[min(t.year for t in extracted)] += 1
            continue

        ymd = parse_date_str(date_str)
        if ymd is None:
            reason = f"Date invalide : {date_str}"
            print(f"  ✗ {pdf.name} → {reason}")
            errors.append(ErrorEntry(filename=pdf.name, reason=reason))
            continue
        y, mo, d = ymd
        trips.append(Trip(filename=pdf.name, amount=amount, year=y, month=mo, day=d, from_pdf=False))
        tickets_by_year[y] += 1
    return trips

def _match_voyages(voyages: list[Entry], trips: list[Trip],
                   recon: "Reconciliation") -> list[Entry]:
    """Rattache chaque justificatif de voyage au trajet d'achat qui porte déjà la
    même dépense, et renvoie ceux qui n'ont rien trouvé. Les références des deux
    documents appartiennent à des espaces disjoints : le rapprochement ne peut se
    faire que sur les valeurs, et un trajet n'absorbe qu'un justificatif."""
    consumed: set[int] = set()
    orphans: list[Entry] = []

    for entry in voyages:
        pdf, date_str, amount, _ref = entry
        ymd = parse_date_str(date_str)
        if ymd is None:
            orphans.append(entry)
            continue
        jour = ymd

        exact = next((i for i, t in enumerate(trips)
                      if i not in consumed and (t.year, t.month, t.day) == jour
                      and abs(t.amount - amount) < 0.005), None)
        if exact is not None:
            consumed.add(exact)
            recon.attached.append(pdf.name)
            print(f"  [RAPPROCHÉ] {pdf.name} → {trips[exact].filename}")
            continue

        # Le montant d'un trajet issu d'une répartition à parts égales ne
        # correspond à aucun montant imprimé : la date seule peut rapprocher,
        # et la ligne est signalée pour que l'arbitrage reste humain.
        par_date = next((i for i, t in enumerate(trips)
                         if i not in consumed and (t.year, t.month, t.day) == jour
                         and t.split), None)
        if par_date is not None:
            consumed.add(par_date)
            recon.attached_by_date.append(pdf.name)
            print(f"  [RAPPROCHÉ PAR DATE] {pdf.name} → {trips[par_date].filename} "
                  f"(montant non vérifié)")
            continue

        recon.promoted.append(pdf.name)
        print(f"  [VOYAGE ORPHELIN] {pdf.name} → compté comme trajet à part entière")
        orphans.append(entry)

    return orphans

def scan(in_dir: Path, source: str = "auto") -> tuple[list[Trip], list[ErrorEntry], dict[int, int], "Reconciliation"]:
    """Renvoie les trajets, les fichiers en erreur, le nombre de tickets rattaché
    à chaque année — un bilan annuel ne doit compter que les siens — et le compte
    de réconciliation entre PDFs déposés et trajets retenus."""
    pdfs = sorted(in_dir.glob("*.pdf"))
    recon = Reconciliation(found=len(pdfs))
    if not pdfs:
        return [], [], {}, recon

    # Passe 1 : parse noms / fallback PDF
    achats: list[Entry] = []
    voyages: list[Entry] = []
    errors: list[ErrorEntry] = []

    for pdf in pdfs:
        result = parse_renamed_filename(pdf.name)
        if result is not None:
            date_part, amount, ref, doc_type = result
            # Un même trajet a souvent un justificatif d'achat ET un justificatif
            # de voyage, aux références disjointes : les compter tous les deux
            # double la dépense déclarée.
            if source in ("achat", "voyage") and doc_type != source:
                recon.other_type.append(pdf.name)
                continue
            entry = (pdf, date_part[:8], amount, ref)
            (voyages if source == "auto" and doc_type == "voyage" else achats).append(entry)
            continue

        print(f"  [FALLBACK PDF] {pdf.name}")
        fallback = parse_via_pdf(pdf)
        if fallback is None:
            reason = "Nom non reconnu et lecture PDF échouée"
            print(f"  ✗ {pdf.name} → {reason}")
            errors.append(ErrorEntry(filename=pdf.name, reason=reason))
            continue

        date_str, amount = fallback
        achats.append((pdf, date_str, amount, "unknown"))

    # Passe 2 : déduplication par ref_base, puis extraction des Trip
    tickets_by_year: dict[int, int] = defaultdict(int)
    trips = _to_trips(_deduplicate(achats, recon), errors, tickets_by_year)

    # Passe 3 (mode auto) : le justificatif de voyage vaut preuve d'un trajet
    # déjà compté, ou trajet à lui seul si aucun achat ne le couvre — c'est le
    # cas des trajets dont le justificatif d'achat n'a jamais été téléchargé.
    if voyages:
        orphans = _match_voyages(_deduplicate(voyages, recon), trips, recon)
        trips.extend(_to_trips(orphans, errors, tickets_by_year))

    recon.kept = sum(tickets_by_year.values())
    return trips, errors, dict(tickets_by_year), recon


def _libelle_source(source: str) -> str:
    return {
        "auto": "Source retenue : **justificatifs d'achat**, complétés par les "
                "justificatifs de voyage qu'aucun achat ne couvre.",
        "achat": "Source retenue : **justificatifs d'achat**.",
        "voyage": "Source retenue : **justificatifs de voyage**.",
        "tous": "Source retenue : **tous types de justificatifs**, sans rapprochement.",
    }[source]

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


def generate_report(trips: list[Trip], errors: list[ErrorEntry], year: int, ticket_count: int,
                    recon: Reconciliation | None = None, source: str = "achat") -> str:
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

    if recon is not None:
        lines += [
            "---",
            "",
            "## Réconciliation",
            "",
            _libelle_source(source),
            "",
            "| Fichiers | Nombre |",
            "|----------|--------|",
            f"| PDF trouvés dans le dossier | {recon.found} |",
            f"| Retenus (tickets analysés)  | {recon.kept} |",
            f"| Écartés — autre type        | {len(recon.other_type)} |",
            f"| Écartés — commande en double| {len(recon.duplicates)} |",
            f"| Écartés — erreur de lecture | {len(errors)} |",
            "",
        ]

        if source == "auto":
            lines += [
                "### Justificatifs de voyage",
                "",
                "| Devenu | Nombre |",
                "|--------|--------|",
                f"| Rattaché à un achat déjà compté (date + montant) | {len(recon.attached)} |",
                f"| Rattaché par date seule, montant non vérifié     | {len(recon.attached_by_date)} |",
                f"| Compté comme trajet, aucun achat ne le couvre    | {len(recon.promoted)} |",
                "",
            ]
            if recon.attached_by_date:
                lines += [
                    "Rapprochements à vérifier à la main — le trajet d'achat correspondant "
                    "a un montant réparti à parts égales, donc non comparable :",
                    "",
                ]
                lines += [f"- `{name}`" for name in recon.attached_by_date] + [""]

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
        usage="%(prog)s [IN] [OUT] [--source achat|voyage|tous]",
    )
    parser.add_argument("paths", nargs="*", metavar="PATH")
    parser.add_argument("--source", choices=("auto", "achat", "voyage", "tous"), default="auto",
                        help="Quels justificatifs comptent (défaut : auto — les achats "
                             "font foi, un justificatif de voyage rattaché à un achat "
                             "n'est pas recompté, un voyage orphelin devient un trajet). "
                             "'tous' compte les deux sans rapprochement, donc double les "
                             "trajets couverts par les deux documents.")
    args = parser.parse_args()

    match len(args.paths):
        case 0:
            config_in, config_out = load_config()
            in_dir = config_in[0] if config_in else Path.cwd()
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

    trips, errors, tickets_by_year, recon = scan(in_dir, args.source)

    years: dict[int, list[Trip]] = defaultdict(list)
    for t in trips:
        years[t.year].append(t)

    if not years and not errors:
        print("\nAucune donnée exploitable.")
        sys.exit(0)

    dominant_year = max(years, key=lambda y: len(years[y])) if years else date.today().year

    print(f"\n✓ {len(trips)} trajet(s) extrait(s) depuis {sum(tickets_by_year.values())} ticket(s)")
    print(f"  source '{args.source}' : {recon.found} PDF trouvé(s), {recon.kept} retenu(s), "
          f"{len(recon.other_type)} d'un autre type, {len(recon.duplicates)} en double, "
          f"{len(errors)} en erreur")
    if args.source == "auto":
        print(f"  justificatifs de voyage : {len(recon.attached)} rattaché(s) à un achat, "
              f"{len(recon.attached_by_date)} rattaché(s) par date seule, "
              f"{len(recon.promoted)} compté(s) comme trajet")
    for name in recon.other_type:
        print(f"  [AUTRE TYPE] {name}")
    if errors:
        print(f"✗ {len(errors)} erreur(s) :")
        for err in errors:
            print(f"  - {err.filename} → {err.reason}")

    print_debug(trips)

    generated = []
    for year in sorted(years):
        report = generate_report(trips, errors if year == dominant_year else [], year,
                                 tickets_by_year.get(year, 0),
                                 recon if year == dominant_year else None, args.source)
        out_file = out_dir / f"bilan-depenses-train-{year}.md"
        out_file.write_text(report, encoding="utf-8")
        generated.append(out_file)

    print()
    for f in generated:
        print(f"✓ Bilan généré : {f.name}")
        print(f"  → {f.resolve()}")


if __name__ == "__main__":
    main()

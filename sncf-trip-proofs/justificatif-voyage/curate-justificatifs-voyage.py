#!/usr/bin/env python3
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
import hashlib
import shutil
import argparse
from pathlib import Path
from dataclasses import dataclass, field

MOIS = {
    "janvier": "01", "février": "02", "fevrier": "02",
    "mars": "03", "avril": "04", "mai": "05", "juin": "06",
    "juillet": "07", "août": "08", "aout": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12", "decembre": "12",
}

INBOX = Path("inbox")
OUTPUT = Path("output")


# ── Modèle ────────────────────────────────────────────────────────────────────

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
        tcn_part = f"_{self.tcn}" if self.tcn else ""
        counter_part = f"_{self.counter}" if self.counter is not None else ""
        return (
            f"JustificatifVoyage"
            f"_{self.date or 'DATE_INCONNUE'}"
            f"_{self.amount or 'PRIX_INCONNU'}"
            f"_{self.ref or 'REF_INCONNUE'}"
            f"{tcn_part}{counter_part}.pdf"
        )


# ── Extraction ────────────────────────────────────────────────────────────────

def extract_text(path: Path) -> str:
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages).strip()
    if len(text) > 50:
        return text
    print("  [OCR] texte natif insuffisant, passage en OCR…")
    from pdf2image import convert_from_bytes
    import pytesseract
    images = convert_from_bytes(path.read_bytes(), dpi=300)
    return "\n".join(pytesseract.image_to_string(img, lang="fra+eng") for img in images).strip()


# ── Parsers ───────────────────────────────────────────────────────────────────

def parse_fields(text: str) -> Fields:
    return Fields(
        date=_parse_date(text),
        amount=_parse_amount(text),
        ref=_parse_ref(text),
        tcn=_parse_tcn(text),
    )


def _parse_date(text: str) -> str | None:
    # Priorité max : date après "voyage du / aller le / retour le" — évite "Paris, le DD/MM/YYYY"
    m = re.compile(
        r"(?:voyage\s+du|aller\s+le|retour\s+le)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})",
        re.IGNORECASE,
    ).search(text)
    if m:
        return f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"

    mois_alt = "|".join(MOIS)

    # "voyage du 26 mars 2026"
    m = re.compile(
        rf"(?:voyage\s+du|aller\s+le|retour\s+le)\s+(\d{{1,2}})\s+({mois_alt})\s+(\d{{4}})",
        re.IGNORECASE,
    ).search(text)
    if m:
        return f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"

    # Fallback : premier mois en lettres dans le texte
    m = re.compile(rf"\b(\d{{1,2}})\s+({mois_alt})\s+(\d{{4}})\b", re.IGNORECASE).search(text)
    if m:
        return f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"

    # Fallback : première date numérique
    m = re.compile(r"\b(\d{2})[/\-\.](\d{2})[/\-\.](\d{4})\b").search(text)
    if m:
        return f"{m.group(3)}{m.group(2)}{m.group(1)}"

    return None


def _parse_amount(text: str) -> str | None:
    # Priorité : ligne "TOTAL" ou "Montant" avec € après
    m = re.compile(
        r"(?:total|montant)[^\n]*?(\d{1,4})[,\.](\d{2})\s*(?:€|EUR|euros?)(?:\s|$|[,;])",
        re.IGNORECASE,
    ).search(text)
    if m:
        return f"{m.group(1)}-{m.group(2)}TTC"

    # Fallback : montant décimal ou entier avec € après
    # Note: \b ne fonctionne pas après € (non-word char) → lookahead
    # Protection capital social : limité à ≤4 chiffres entiers
    m = re.compile(
        r"(?<!\d)(\d{1,4})[,\.](\d{2})\s*(?:€|EUR|euros?)(?=\s|$|[,;])"
        r"|(?<!\d)(\d{1,4})\s*(?:€|EUR|euros?)(?=\s|$|[,;])",
        re.IGNORECASE,
    ).search(text)
    if not m:
        return None
    return f"{m.group(1)}-{m.group(2)}TTC" if m.group(1) else f"{m.group(3)}-00TTC"


def _parse_ref(text: str) -> str | None:
    # "Référence de commande NE3ERM" — after "commande" keyword
    m = re.compile(
        r"(?:référence|réf)[^\n]*?commande\s+([A-Z0-9]{5,10})\b",
        re.IGNORECASE,
    ).search(text)
    if m:
        return m.group(1).upper()
    # "Référence D56QEJ" — ref directly after keyword (no intermediate words)
    m = re.compile(
        r"(?:référence|réf)\s+([A-Z0-9]{5,10})\b",
        re.IGNORECASE,
    ).search(text)
    return m.group(1).upper() if m else None


def _parse_tcn(text: str) -> str | None:
    m = re.search(r"\bTCN\s+(\d{6,12})\b", text, re.IGNORECASE)
    return m.group(1) if m else None


# ── Déduplication ─────────────────────────────────────────────────────────────

def _checksum(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()


def _birth_time(path: Path) -> tuple[float, float]:
    st = path.stat()
    return (getattr(st, "st_birthtime", st.st_mtime), st.st_mtime)


def deduplicate_sources(files: list[Path]) -> list[Path]:
    """Passe 1 — supprime les sources au contenu identique avant extraction.
    Garde le plus ancien de chaque groupe, informe l'utilisateur."""
    checksums: dict[str, list[Path]] = {}
    for p in files:
        checksums.setdefault(_checksum(p), []).append(p)

    result: list[Path] = []
    for cs, group in checksums.items():
        if len(group) == 1:
            result.append(group[0])
            continue
        sorted_group = sorted(group, key=_birth_time)
        keeper = sorted_group[0]
        result.append(keeper)
        print(f"\n[DOUBLON SOURCE] {len(group)} fichiers au contenu identique :")
        for p in sorted_group:
            print(f"  {'[conservé]' if p == keeper else '[ignoré]  '} {p.name}")

    kept = set(result)
    return [p for p in files if p in kept]


def resolve_conflicts(parsed: list[tuple[Path, "Fields | None"]]) -> list[tuple[Path, "Fields | None"]]:
    """Passe 2 — noms cibles identiques : checksum puis numérotation par date de création."""
    groups: dict[str, list[tuple[Path, Fields]]] = {}
    for path, fields in parsed:
        if fields and not fields.missing:
            groups.setdefault(fields.filename, []).append((path, fields))

    skip: set[Path] = set()

    for name, group in groups.items():
        if len(group) <= 1:
            continue

        print(f"\n[CONFLIT NOM] {len(group)} fichiers seraient renommés en '{name}'")
        checksums = {p: _checksum(p) for p, _ in group}
        unique = set(checksums.values())

        if len(unique) == 1:
            for path, _ in group[1:]:
                print(f"  → doublon identique ignoré : {path.name}")
                skip.add(path)
        else:
            print(f"  → checksums différents : numérotation par date de création")
            sorted_group = sorted(group, key=lambda x: _birth_time(x[0]))
            for i, (path, fields) in enumerate(sorted_group, start=1):
                fields.counter = i
                print(f"  [{i}] {path.name} → {fields.filename}")

    return [(p, f) for p, f in parsed if p not in skip]


# ── Output ────────────────────────────────────────────────────────────────────

def wipe_output(output_dir: Path) -> None:
    """Vide output/ après confirmation. Quitte si refusé."""
    if output_dir.exists():
        n = sum(1 for _ in output_dir.iterdir())
        if n > 0:
            print(f"\n[OUTPUT] '{output_dir}' sera vidé ({n} fichier(s)) avant regénération.")
            answer = input("  Confirmer la suppression ? [o/N] ").strip().lower()
            if answer not in ("o", "oui", "y", "yes"):
                print("  → annulé")
                sys.exit(0)
            shutil.rmtree(output_dir)
    output_dir.mkdir(exist_ok=True)


# ── Traitement ────────────────────────────────────────────────────────────────

def process_file(path: Path, fields: Fields, output_dir: Path, dry_run: bool) -> bool:
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}→ {path.name}")
    print(f"  date      : {fields.date or 'DATE_INCONNUE'}")
    print(f"  montant   : {fields.amount or 'PRIX_INCONNU'}")
    print(f"  référence : {fields.ref or 'REF_INCONNUE'}")
    print(f"  TCN       : {fields.tcn or '—'}")

    if fields.missing:
        print(f"  [MANQUANT] champs non extraits : {', '.join(fields.missing)}")
        if not dry_run:
            print("  → fichier non traité")
            return False

    new_path = output_dir / fields.filename
    print(f"  → {new_path.name}")

    if not dry_run:
        shutil.copy2(path, new_path)
        print("  ✓ copié dans output/")

    return not fields.missing


def main():
    parser = argparse.ArgumentParser(description="Organise les justificatifs de voyage PDF")
    parser.add_argument("fichier", nargs="?", help="PDF à traiter (optionnel, sinon inbox/)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True,
                      help="Affiche les noms générés sans toucher aux fichiers (défaut)")
    mode.add_argument("--real", action="store_true", default=False,
                      help="Vide output/ puis copie les fichiers organisés")
    args = parser.parse_args()

    dry_run = not args.real

    if args.fichier:
        files = [Path(args.fichier)]
        output_dir = Path(args.fichier).parent
    else:
        if not INBOX.exists():
            print(f"Dossier '{INBOX}' introuvable. Créez-le et déposez vos PDFs dedans.")
            sys.exit(1)
        files = sorted(INBOX.glob("*.pdf"))
        output_dir = OUTPUT

    if not files:
        print(f"Aucun fichier PDF trouvé dans '{INBOX}'.")
        sys.exit(0)

    if not dry_run and output_dir == OUTPUT:
        wipe_output(output_dir)

    files = deduplicate_sources(files)

    print(f"Mode    : {'DRY-RUN (simulation)' if dry_run else 'RÉEL (output/ régénéré)'}")
    print(f"Source  : {args.fichier or INBOX}")
    print(f"Sortie  : {output_dir}")
    print(f"Fichiers: {len(files)}")

    parsed: list[tuple[Path, Fields | None]] = []
    for path in files:
        try:
            parsed.append((path, parse_fields(extract_text(path))))
        except Exception as e:
            print(f"\n[ERREUR] {path.name} : lecture impossible : {e}")
            parsed.append((path, None))

    parsed = resolve_conflicts(parsed)

    ok = sum(
        process_file(path, f, output_dir, dry_run)
        if f is not None else False
        for path, f in parsed
    )
    print(f"\n{'─'*40}")
    print(f"Résultat : {ok}/{len(files)} fichier(s) traité(s) avec succès")
    if dry_run:
        print("\nPour appliquer, relancez avec --real")


if __name__ == "__main__":
    main()

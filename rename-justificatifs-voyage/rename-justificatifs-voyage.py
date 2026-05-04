#!/usr/bin/env python3
"""
rename-justificatifs-voyage.py — Renomme les justificatifs de voyage PDF.

Usage:
    python3 rename-justificatifs-voyage.py [--dry-run | --real] [fichier.pdf]

Structure attendue :
    inbox/   ← déposer les PDFs bruts ici
    output/  ← fichiers renommés générés ici (créé automatiquement)
"""

import re
import sys
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
    missing: list[str] = field(init=False)

    def __post_init__(self):
        self.missing = [k for k, v in {"date": self.date, "montant": self.amount, "référence": self.ref}.items() if v is None]

    @property
    def filename(self) -> str:
        suffix = f"_{self.tcn}" if self.tcn else ""
        return (
            f"JustificatifVoyage"
            f"_{self.date or 'DATE_INCONNUE'}"
            f"_{self.amount or 'PRIX_INCONNU'}"
            f"_{self.ref or 'REF_INCONNUE'}"
            f"{suffix}.pdf"
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
    prefixed_num = re.compile(
        r"(?:voyage\s+du|aller\s+le|retour\s+le)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})",
        re.IGNORECASE,
    )
    m = prefixed_num.search(text)
    if m:
        return f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"

    mois_alt = "|".join(MOIS)
    prefixed_fr = re.compile(
        rf"(?:voyage\s+du|aller\s+le|retour\s+le)\s+(\d{{1,2}})\s+({mois_alt})\s+(\d{{4}})",
        re.IGNORECASE,
    )
    m = prefixed_fr.search(text)
    if m:
        return f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"

    bare_fr = re.compile(rf"\b(\d{{1,2}})\s+({mois_alt})\s+(\d{{4}})\b", re.IGNORECASE)
    m = bare_fr.search(text)
    if m:
        return f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"

    bare_num = re.compile(r"\b(\d{2})[/\-\.](\d{2})[/\-\.](\d{4})\b")
    m = bare_num.search(text)
    if m:
        return f"{m.group(3)}{m.group(2)}{m.group(1)}"

    return None


def _parse_amount(text: str) -> str | None:
    m = re.compile(
        r"(?:total|montant\s+total)[^\n]*?(\d{1,4})[,\.](\d{2})\s*(?:€|EUR|euros?)(?:\s|$|[,;])",
        re.IGNORECASE,
    ).search(text)
    if m:
        return f"{m.group(1)}-{m.group(2)}TTC"

    # Note: pas de \b après € (non-word char), on utilise un lookahead
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
        r"(?:référence|ref\.?|réf\.?|commande|booking|dossier)[^\w]*([A-Z0-9]{5,10})\b",
        re.IGNORECASE,
    ).search(text)
    if m:
        return m.group(1).upper()
    m = re.compile(r"\b([A-Z]{1,4}\d{3,6}[A-Z]{0,2})\b").search(text)
    return m.group(1).upper() if m else None


def _parse_tcn(text: str) -> str | None:
    m = re.search(r"\bTCN\s+(\d{6,12})\b", text, re.IGNORECASE)
    return m.group(1) if m else None


# ── Traitement ────────────────────────────────────────────────────────────────

def process_file(path: Path, fields: Fields, output_dir: Path, dry_run: bool, accept_all: bool) -> bool:
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
    print(f"  → {new_path}")

    if not dry_run:
        if new_path.exists():
            if accept_all:
                print("  [CONFLIT] remplacement automatique (accept all).")
            else:
                answer = input(f"  [CONFLIT] '{new_path.name}' existe déjà. Remplacer ? [o/N] ").strip().lower()
                if answer not in ("o", "oui", "y", "yes"):
                    print("  → annulé")
                    return False
            new_path.unlink()
        shutil.copy2(path, new_path)
        print("  ✓ copié dans output/")

    return not fields.missing


def main():
    parser = argparse.ArgumentParser(description="Renomme les justificatifs de voyage PDF")
    parser.add_argument("fichier", nargs="?", help="PDF à traiter (optionnel, sinon inbox/)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True,
                      help="Affiche les renommages sans toucher aux fichiers (défaut)")
    mode.add_argument("--real", action="store_true", default=False,
                      help="Effectue les renommages")
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
        output_dir.mkdir(exist_ok=True)

    print(f"Mode    : {'DRY-RUN (simulation)' if dry_run else 'RÉEL (copie vers output/)'}")
    print(f"Source  : {args.fichier or INBOX}")
    print(f"Sortie  : {output_dir}")
    print(f"Fichiers: {len(files)}")

    # Extraction unique — évite une double lecture en cas de scan des conflits
    parsed: list[tuple[Path, Fields | None]] = []
    for path in files:
        try:
            parsed.append((path, parse_fields(extract_text(path))))
        except Exception as e:
            print(f"\n[ERREUR] {path.name} : lecture impossible : {e}")
            parsed.append((path, None))

    accept_all = False
    if not dry_run:
        n_conflicts = sum(
            1 for _, f in parsed
            if f and not f.missing and (output_dir / f.filename).exists()
        )
        if n_conflicts > 3:
            print(f"\n[CONFLITS] {n_conflicts} fichiers existent déjà dans output/.")
            answer = input("  Remplacer tous les doublons ? [o/N] ").strip().lower()
            accept_all = answer in ("o", "oui", "y", "yes")

    ok = sum(
        process_file(path, f, output_dir, dry_run, accept_all)
        if f is not None else False
        for path, f in parsed
    )
    print(f"\n{'─'*40}")
    print(f"Résultat : {ok}/{len(files)} fichier(s) traité(s) avec succès")
    if dry_run:
        print("\nPour appliquer, relancez avec --real")


if __name__ == "__main__":
    main()

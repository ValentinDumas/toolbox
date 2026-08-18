"""
sncf_common.py — Socle partagé par les scripts sncf-trip-proofs.

Regroupe ce qui était dupliqué entre curate-justificatifs-achat,
curate-justificatifs-voyage et draw-bilan-depenses-train : lecture de config,
extraction de texte PDF, parseurs date/montant génériques, dédoublonnage,
résolution de conflits de noms et boucle CLI des scripts curate-*.
"""

import re
import sys
import json
import hashlib
import shutil
import argparse
from pathlib import Path
from typing import Callable, Protocol

MOIS = {
    "janvier": "01", "février": "02", "fevrier": "02",
    "mars": "03", "avril": "04", "mai": "05", "juin": "06",
    "juillet": "07", "août": "08", "aout": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12", "decembre": "12",
}

MOIS_ALT = "|".join(MOIS)

INBOX = Path("inbox")
OUTPUT = Path("output")

def load_config(section: str, config_path: Path | None = None) -> tuple[Path | None, Path | None]:
    if config_path is None:
        config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        return None, None
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        conf = cfg.get(section, {})
        in_path = Path(conf["in"]) if conf.get("in") else None
        out_path = Path(conf["out"]) if conf.get("out") else None
        return in_path, out_path
    except (json.JSONDecodeError, KeyError, TypeError):
        return None, None

# ── Extraction PDF ────────────────────────────────────────────────────────────

def extract_text(path: Path) -> str:
    """Texte natif du PDF, avec bascule OCR si le PDF est un scan."""
    import logging
    import pdfplumber
    logging.getLogger("pdfminer").setLevel(logging.ERROR)
    with pdfplumber.open(path) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages).strip()
    if len(text) > 50:
        return text
    print("  [OCR] texte natif insuffisant, passage en OCR…")
    from pdf2image import convert_from_bytes
    import pytesseract
    images = convert_from_bytes(path.read_bytes(), dpi=300)
    return "\n".join(pytesseract.image_to_string(img, lang="fra+eng") for img in images).strip()

# ── Parseurs génériques (justificatifs d'achat et fallback bilan) ─────────────

_DATE_PATTERNS: list[tuple[re.Pattern, Callable[[re.Match], str]]] = [
    (re.compile(r"(?:Aller|Retour|Departure|Return)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})", re.IGNORECASE),
     lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
    (re.compile(r"(?:du|le|date)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})", re.IGNORECASE),
     lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
    (re.compile(rf"(?:du|le|date)\s+(\d{{1,2}})\s+({MOIS_ALT})\s+(\d{{4}})", re.IGNORECASE),
     lambda m: f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"),
    (re.compile(rf"\b(\d{{1,2}})\s+({MOIS_ALT})\s+(\d{{4}})\b", re.IGNORECASE),
     lambda m: f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"),
    (re.compile(r"\b(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})\b"),
     lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
    (re.compile(r"N°[\w]+-(\d{4})(\d{2})(\d{2})\b"),
     lambda m: f"{m.group(1)}{m.group(2)}{m.group(3)}"),
]

def parse_date(text: str) -> str | None:
    """Première date trouvée, au format YYYYMMDD."""
    for pattern, extract in _DATE_PATTERNS:
        m = pattern.search(text)
        if m:
            return extract(m)
    return None

_AMOUNT_PATTERNS = [
    re.compile(r"€\s*(\d{1,4})[,\.](\d{2})\b"),
    re.compile(r"€\s*(\d{1,4})\b"),
    re.compile(r"(?:total|montant)[^\n]*?(\d{1,4})[,\.](\d{2})\s*(?:€|EUR)", re.IGNORECASE),
    re.compile(r"(?<!\d)(\d{1,4})[,\.](\d{2})\s*(?:€|EUR|euros?)(?=\s|$|[,;])", re.IGNORECASE),
]

def parse_amount(text: str) -> str | None:
    """Montant trouvé, au format 'EUROS-CENTIMES' (ex. '18-50')."""
    for pattern in _AMOUNT_PATTERNS:
        m = pattern.search(text)
        if m:
            cents = m.group(2) if m.lastindex and m.lastindex >= 2 else "00"
            return f"{m.group(1)}-{cents}"
    return None

# ── Dédoublonnage et conflits de noms ────────────────────────────────────────

class HasFilename(Protocol):
    filename: str
    missing: list[str]
    counter: int | None

def checksum(path: Path) -> str:
    return hashlib.md5(path.read_bytes()).hexdigest()

def birth_time(path: Path) -> tuple[float, float]:
    st = path.stat()
    return (getattr(st, "st_birthtime", st.st_mtime), st.st_mtime)

def deduplicate_sources(files: list[Path]) -> list[Path]:
    """Passe 1 — supprime les sources au contenu identique avant extraction.
    Garde le plus ancien de chaque groupe, informe l'utilisateur."""
    checksums: dict[str, list[Path]] = {}
    for p in files:
        checksums.setdefault(checksum(p), []).append(p)

    result: list[Path] = []
    for group in checksums.values():
        if len(group) == 1:
            result.append(group[0])
            continue
        sorted_group = sorted(group, key=birth_time)
        keeper = sorted_group[0]
        result.append(keeper)
        print(f"\n[DOUBLON SOURCE] {len(group)} fichiers au contenu identique :")
        for p in sorted_group:
            print(f"  {'[conservé]' if p == keeper else '[ignoré]  '} {p.name}")

    kept = set(result)
    return [p for p in files if p in kept]

def resolve_conflicts(parsed: list[tuple[Path, "HasFilename | None"]]) -> list[tuple[Path, "HasFilename | None"]]:
    """Passe 2 — noms cibles identiques : checksum puis numérotation par date de création."""
    groups: dict[str, list[tuple[Path, HasFilename]]] = {}
    for path, fields in parsed:
        if fields and not fields.missing:
            groups.setdefault(fields.filename, []).append((path, fields))

    skip: set[Path] = set()

    for name, group in groups.items():
        if len(group) <= 1:
            continue

        print(f"\n[CONFLIT NOM] {len(group)} fichiers seraient renommés en '{name}'")
        unique = {checksum(p) for p, _ in group}

        if len(unique) == 1:
            for path, _ in group[1:]:
                print(f"  → doublon identique ignoré : {path.name}")
                skip.add(path)
        else:
            print("  → checksums différents : numérotation par date de création")
            sorted_group = sorted(group, key=lambda x: birth_time(x[0]))
            for i, (path, fields) in enumerate(sorted_group, start=1):
                fields.counter = i
                print(f"  [{i}] {path.name} → {fields.filename}")

    return [(p, f) for p, f in parsed if p not in skip]

# ── Sortie ───────────────────────────────────────────────────────────────────

def clear_output(output_dir: Path, prefix: str, in_dir: Path) -> None:
    """Supprime, après confirmation, les seuls fichiers déjà produits par ce
    script (préfixe `prefix`). Les fichiers d'un autre script — l'autre
    curate-*, les bilans — restent intacts."""
    if output_dir.resolve() == in_dir.resolve():
        print(f"\n[REFUS] dossier de sortie identique au dossier source : {output_dir}")
        print("  → corrigez 'out' dans config.json, les sources seraient écrasées.")
        sys.exit(1)

    obsoletes = sorted(output_dir.glob(f"{prefix}*.pdf")) if output_dir.exists() else []
    if obsoletes:
        print(f"\n[OUTPUT] {len(obsoletes)} fichier(s) '{prefix}*' de '{output_dir}' seront regénérés.")
        answer = input("  Confirmer la suppression ? [o/N] ").strip().lower()
        if answer not in ("o", "oui", "y", "yes"):
            print("  → annulé")
            sys.exit(0)
        for f in obsoletes:
            f.unlink()
    output_dir.mkdir(parents=True, exist_ok=True)

def process_file(path: Path, fields: "HasFilename", output_dir: Path, dry_run: bool,
                 extra_lines: list[str] | None = None) -> bool:
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}→ {path.name}")
    print(f"  date      : {fields.date or 'DATE_INCONNUE'}")
    print(f"  montant   : {fields.amount or 'PRIX_INCONNU'}")
    print(f"  référence : {fields.ref or 'REF_INCONNUE'}")
    for line in extra_lines or []:
        print(line)

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

# ── Boucle CLI des scripts curate-* ──────────────────────────────────────────

def run_curate(
    description: str,
    config_in: Path | None,
    config_out: Path | None,
    parse_fields: Callable[[str], "HasFilename"],
    prefix: str,
    extra_lines: Callable[["HasFilename"], list[str]] | None = None,
) -> None:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("fichier", nargs="?", help="PDF à traiter (optionnel, sinon inbox/)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True,
                      help="Affiche les noms générés sans toucher aux fichiers (défaut)")
    mode.add_argument("--real", action="store_true", default=False,
                      help="Regénère les fichiers de ce script dans output/")
    args = parser.parse_args()

    dry_run = not args.real

    if args.fichier:
        inbox = Path(args.fichier).parent
        output_dir = inbox
        files = [Path(args.fichier)]
    else:
        inbox = config_in if config_in else INBOX
        output_dir = config_out if config_out else OUTPUT
        if not inbox.exists():
            print(f"Dossier '{inbox}' introuvable. Créez-le et déposez vos PDFs dedans.")
            sys.exit(1)
        files = sorted(inbox.glob("*.pdf"))

    if not files:
        print(f"Aucun fichier PDF trouvé dans '{inbox}'.")
        sys.exit(0)

    if not dry_run and not args.fichier:
        clear_output(output_dir, prefix, inbox)

    files = deduplicate_sources(files)

    print(f"Mode    : {'DRY-RUN (simulation)' if dry_run else 'RÉEL (fichiers regénérés)'}")
    print(f"Source  : {inbox}")
    print(f"Sortie  : {output_dir}")
    print(f"Fichiers: {len(files)}")

    parsed: list[tuple[Path, HasFilename | None]] = []
    for path in files:
        try:
            parsed.append((path, parse_fields(extract_text(path))))
        except Exception as e:
            print(f"\n[ERREUR] {path.name} : lecture impossible : {e}")
            parsed.append((path, None))

    parsed = resolve_conflicts(parsed)

    ok = sum(
        process_file(path, f, output_dir, dry_run, extra_lines(f) if extra_lines else None)
        if f is not None else False
        for path, f in parsed
    )
    print(f"\n{'─'*40}")
    print(f"Résultat : {ok}/{len(files)} fichier(s) traité(s) avec succès")
    if dry_run:
        print("\nPour appliquer, relancez avec --real")

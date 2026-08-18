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

def load_config(section: str, config_path: Path | None = None) -> tuple[list[Path], Path | None]:
    """Renvoie (chemins sources, chemin de sortie). "in" accepte un chemin ou une
    liste : le corpus d'un script curate-* couvre inbox/ ET archive/, sans quoi
    archiver une source la retirerait du domaine et la sortie ne serait plus
    reconstructible."""
    if config_path is None:
        config_path = Path(__file__).parent / "config.json"
    if not config_path.exists():
        return [], None
    try:
        cfg = json.loads(config_path.read_text(encoding="utf-8"))
        conf = cfg.get(section, {})
        raw_in = conf.get("in")
        if isinstance(raw_in, str):
            in_paths = [Path(raw_in)] if raw_in else []
        elif isinstance(raw_in, list):
            in_paths = [Path(p) for p in raw_in if p]
        else:
            in_paths = []
        out_path = Path(conf["out"]) if conf.get("out") else None
        return in_paths, out_path
    except (json.JSONDecodeError, KeyError, TypeError):
        return [], None

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

TEXT_CACHE = ".sncf-text-cache.json"

def load_text_cache(out_dir: Path) -> dict[str, str]:
    """Texte déjà extrait, indexé par checksum du PDF. Purement dérivé : le
    supprimer ne change que le temps du prochain run (OCR à refaire)."""
    try:
        return json.loads((out_dir / TEXT_CACHE).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

def save_text_cache(out_dir: Path, cache: dict[str, str]) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / TEXT_CACHE).write_text(json.dumps(cache), encoding="utf-8")

# ── Parseurs génériques (justificatifs d'achat et fallback bilan) ─────────────

# Du plus contextuel au plus permissif : une date qualifiée (Aller, "du…") prime
# sur une date isolée, qui peut être celle d'émission du document.
_DATE_PATTERNS: list[tuple[re.Pattern, Callable[[re.Match], str]]] = [
    # Ligne de trajet (ex: "Aller 30/03/2026")
    (re.compile(r"(?:Aller|Retour|Departure|Return)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})", re.IGNORECASE),
     lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
    # Date numérique avec contexte (ex: "du 30/03/2026", "le 30-03-2026")
    (re.compile(r"(?:du|le|date)\s+(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})", re.IGNORECASE),
     lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
    # Date en lettres avec contexte (ex: "le 30 mars 2026")
    (re.compile(rf"(?:du|le|date)\s+(\d{{1,2}})\s+({MOIS_ALT})\s+(\d{{4}})", re.IGNORECASE),
     lambda m: f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"),
    # Date en lettres sans contexte (ex: "30 mars 2026")
    (re.compile(rf"\b(\d{{1,2}})\s+({MOIS_ALT})\s+(\d{{4}})\b", re.IGNORECASE),
     lambda m: f"{m.group(3)}{MOIS[m.group(2).lower()]}{int(m.group(1)):02d}"),
    # Date numérique seule (ex: "30/03/2026")
    (re.compile(r"\b(\d{1,2})[/\-\.](\d{2})[/\-\.](\d{4})\b"),
     lambda m: f"{m.group(3)}{m.group(2)}{int(m.group(1)):02d}"),
    # Date ISO dans la référence (ex: N°2668453920-20260330)
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
    # Symbole € AVANT le montant (ex: €18,50 ou € 18,50)
    re.compile(r"€\s*(\d{1,4})[,\.](\d{2})\b"),
    # € avant montant entier (ex: €18)
    re.compile(r"€\s*(\d{1,4})\b"),
    # Fallback : symbole € APRÈS, ligne total/montant
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

def collect_sources(source_dirs: list[Path], output_dir: Path) -> list[Path]:
    """Tous les PDFs du corpus, récursivement — inbox/ et archive/YYYY-MM/ pour un
    même justificatif déplacé entre deux runs. La sortie est exclue : elle est
    dérivée, jamais source."""
    out = output_dir.resolve()
    seen: set[Path] = set()
    files: list[Path] = []
    for directory in source_dirs:
        for path in sorted(directory.rglob("*.pdf")):
            resolved = path.resolve()
            if resolved in seen or out == resolved.parent or out in resolved.parents:
                continue
            seen.add(resolved)
            files.append(path)
    return files

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

def clear_output(output_dir: Path, prefix: str, source_dirs: list[Path], assume_yes: bool = False) -> None:
    """Supprime, après confirmation, les seuls fichiers déjà produits par ce
    script (préfixe `prefix`). Les fichiers d'un autre script — l'autre
    curate-*, les bilans — restent intacts."""
    out = output_dir.resolve()
    for directory in source_dirs:
        source = directory.resolve()
        if out == source or out in source.parents or source in out.parents:
            print(f"\n[REFUS] sortie et source imbriquées : {output_dir} / {directory}")
            print("  → corrigez 'in'/'out' dans config.json, les sources seraient écrasées.")
            sys.exit(1)

    obsoletes = sorted(output_dir.glob(f"{prefix}*.pdf")) if output_dir.exists() else []
    if obsoletes:
        print(f"\n[OUTPUT] {len(obsoletes)} fichier(s) '{prefix}*' de '{output_dir}' seront regénérés.")
        if not assume_yes:
            if not sys.stdin.isatty():
                print("  [REFUS] pas de terminal pour confirmer : relancez avec --yes.")
                sys.exit(1)
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
    config_in: list[Path],
    config_out: Path | None,
    parse_fields: Callable[[str], "HasFilename"],
    prefix: str,
    extra_lines: Callable[["HasFilename"], list[str]] | None = None,
) -> None:
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument("fichier", nargs="?", help="PDF à traiter (optionnel, sinon le corpus)")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true", default=True,
                      help="Affiche les noms générés sans toucher aux fichiers (défaut)")
    mode.add_argument("--real", action="store_true", default=False,
                      help="Regénère les fichiers de ce script dans output/")
    parser.add_argument("--yes", action="store_true", default=False,
                        help="Confirme la regénération sans prompt (cron, launchd, wrapper)")
    args = parser.parse_args()

    dry_run = not args.real

    if args.fichier:
        source_dirs = [Path(args.fichier).parent]
        output_dir = source_dirs[0]
        files = [Path(args.fichier)]
    else:
        source_dirs = config_in or [INBOX]
        output_dir = config_out if config_out else OUTPUT
        existing = [d for d in source_dirs if d.exists()]
        if not existing:
            print(f"Dossier '{source_dirs[0]}' introuvable. Créez-le et déposez vos PDFs dedans.")
            sys.exit(1)
        source_dirs = existing
        files = collect_sources(source_dirs, output_dir)

    if not files:
        print(f"Aucun fichier PDF trouvé dans {', '.join(str(d) for d in source_dirs)}.")
        sys.exit(0)

    if not dry_run and not args.fichier:
        clear_output(output_dir, prefix, source_dirs, assume_yes=args.yes)

    files = deduplicate_sources(files)

    print(f"Mode    : {'DRY-RUN (simulation)' if dry_run else 'RÉEL (fichiers regénérés)'}")
    print(f"Source  : {', '.join(str(d) for d in source_dirs)}")
    print(f"Sortie  : {output_dir}")
    print(f"Fichiers: {len(files)}")

    cache = load_text_cache(output_dir)
    parsed: list[tuple[Path, HasFilename | None]] = []
    for path in files:
        try:
            key = checksum(path)
            text = cache.get(key)
            if text is None:
                text = extract_text(path)
                cache[key] = text
            parsed.append((path, parse_fields(text)))
        except Exception as e:
            print(f"\n[ERREUR] {path.name} : lecture impossible : {e}")
            parsed.append((path, None))
    if not dry_run:
        save_text_cache(output_dir, cache)

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

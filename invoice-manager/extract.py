"""
extract.py — Extraction de factures/reçus vers SQLite
Usage: python extract.py [--input DIR] [--config FILE]
"""

import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

from config import load_config

# ── DB ────────────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS invoices (
    id                      TEXT PRIMARY KEY,
    type_document           TEXT,
    numéro_facture          TEXT,
    date_document           TEXT,
    date_échéance           TEXT,
    date_paiement           TEXT,
    émetteur_nom            TEXT,
    émetteur_siren          TEXT,
    émetteur_siret          TEXT,
    émetteur_tva_intracom   TEXT,
    émetteur_adresse        TEXT,
    émetteur_email          TEXT,
    destinataire_nom        TEXT,
    destinataire_siren      TEXT,
    destinataire_siret      TEXT,
    destinataire_tva_intracom TEXT,
    destinataire_adresse    TEXT,
    montant_ht              REAL,
    taux_tva                REAL,
    montant_tva             REAL,
    montant_ttc             REAL,
    devise                  TEXT DEFAULT 'EUR',
    montant_eur             REAL,
    taux_change             REAL,
    description_prestation  TEXT,
    lignes_détail           TEXT,
    catégorie               TEXT,
    sous_catégorie          TEXT,
    déductible              INTEGER,
    taux_déductibilité      REAL,
    centre_de_coût          TEXT,
    mode_paiement           TEXT,
    référence_paiement      TEXT,
    statut_paiement         TEXT,
    exercice_fiscal         INTEGER,
    trimestre               INTEGER,
    régime_tva              TEXT,
    nature_charge           TEXT,
    statut_fiscal_profil    TEXT,
    fichier_source          TEXT,
    hash_fichier            TEXT UNIQUE,
    confiance               REAL,
    statut_révision         TEXT DEFAULT 'auto_validé',
    révisé_par              TEXT DEFAULT 'auto',
    date_révision           TEXT,
    notes_correction        TEXT,
    date_extraction         TEXT,
    texte_brut              TEXT
)
"""

def open_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    # Non-destructive migration for existing DBs without texte_brut
    existing = {row[1] for row in conn.execute("PRAGMA table_info(invoices)")}
    if "texte_brut" not in existing:
        conn.execute("ALTER TABLE invoices ADD COLUMN texte_brut TEXT")
    conn.commit()
    return conn

def hash_exists(conn: sqlite3.Connection, h: str) -> bool:
    return conn.execute("SELECT 1 FROM invoices WHERE hash_fichier = ?", (h,)).fetchone() is not None

def insert(conn: sqlite3.Connection, row: dict) -> None:
    cols = ", ".join(f'"{k}"' for k in row)
    placeholders = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({placeholders})", list(row.values()))
    conn.commit()

# ── Text extraction ───────────────────────────────────────────────────────────

def extract_text_pdf(path: Path, ocr_lang: str, ocr_dpi: int) -> str:
    import pdfplumber
    with pdfplumber.open(path) as pdf:
        text = "\n".join(p.extract_text() or "" for p in pdf.pages).strip()
    if len(text) > 50:
        return text
    print("    [OCR] texte natif insuffisant, passage en OCR…")
    from pdf2image import convert_from_bytes
    import pytesseract
    images = convert_from_bytes(path.read_bytes(), dpi=ocr_dpi)
    return "\n".join(pytesseract.image_to_string(img, lang=ocr_lang) for img in images).strip()

def extract_text_image(path: Path, ocr_lang: str, ocr_dpi: int) -> str:
    import pytesseract
    from PIL import Image
    if path.suffix.lower() in {".heic", ".heif"}:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    img = Image.open(path).convert("RGB")
    return pytesseract.image_to_string(img, lang=ocr_lang).strip()

def extract_text(path: Path, cfg: dict) -> str:
    lang = cfg["extraction"]["ocr_lang"]
    dpi = cfg["extraction"]["ocr_dpi"]
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_text_pdf(path, lang, dpi)
    if suffix in {".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp", ".heic", ".heif"}:
        return extract_text_image(path, lang, dpi)
    raise ValueError(f"Format non supporté : {suffix}")

# ── Parsers ───────────────────────────────────────────────────────────────────

_MONTHS_FR = {
    "janvier": "01", "février": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "août": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12",
}

def _parse_date(text: str) -> str | None:
    from datetime import date as _date

    def _valid(y: int, m: int, d: int) -> str | None:
        try:
            _date(y, m, d)
            return f"{y:04d}-{m:02d}-{d:02d}"
        except ValueError:
            return None

    for m in re.finditer(r"(\d{4})[\/\-](\d{2})[\/\-](\d{2})", text):
        result = _valid(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if result:
            return result

    for m in re.finditer(r"(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})", text):
        result = _valid(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        if result:
            return result

    for m in re.finditer(r"(\d{1,2})\s+(" + "|".join(_MONTHS_FR) + r")\s+(\d{4})", text, re.I):
        month_num = int(_MONTHS_FR.get(m.group(2).lower(), "0"))
        result = _valid(int(m.group(3)), month_num, int(m.group(1)))
        if result:
            return result

    return None

def _parse_amount(text: str, keywords: list[str]) -> float | None:
    pattern = "(?:" + "|".join(re.escape(k) for k in keywords) + r")[^\d]*(\d[\d\s]*[\.,]\d{2})"
    m = re.search(pattern, text, re.I)
    if m:
        return float(m.group(1).replace(" ", "").replace(",", "."))
    return None

def _parse_amounts(text: str) -> tuple[float | None, float | None, float | None, float | None]:
    """Returns (ht, tva, ttc, taux_tva)."""
    ttc = _parse_amount(text, ["TTC", "total ttc", "total à payer", "amount due", "montant total", "total eur", "carte bancaire", "carte ba", "cb"])
    ht  = _parse_amount(text, ["total ht", "sous-total", "subtotal", "montant ht"])

    # Ticket caisse format: "TVA XX% <tva_amount> <ht_amount> HT"
    tva_line = re.search(r"TVA\s+[\d,\.\s]+%?\s+(\d+[,\.]\d{2})\s+(\d+[,\.]\d{2})\s+HT", text, re.I)
    if tva_line:
        tva = float(tva_line.group(1).replace(",", "."))
        if not ht:
            ht = float(tva_line.group(2).replace(",", "."))
    else:
        tva = _parse_amount(text, ["TVA", "tax", "vat"])

    if not ht:
        ht = _parse_amount(text, ["HT"])

    if ttc and ht and not tva:
        tva = round(ttc - ht, 2)
    elif ttc and tva and not ht:
        ht = round(ttc - tva, 2)
    elif ht and tva and not ttc:
        ttc = round(ht + tva, 2)

    taux_tva = round((tva / ht) * 100, 1) if ht and tva and ht > 0 else None
    return ht, tva, ttc, taux_tva

def _parse_siren(text: str) -> str | None:
    m = re.search(r"\b(\d{3}\s?\d{3}\s?\d{3})\b", text)
    return m.group(1).replace(" ", "") if m else None

def _parse_siret(text: str) -> str | None:
    m = re.search(r"\b(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b", text)
    return m.group(1).replace(" ", "") if m else None

def _parse_tva_intracom(text: str) -> str | None:
    m = re.search(r"\b(FR\s*\d{2}\s*\d{9})\b", text, re.I)
    return m.group(1).replace(" ", "").upper() if m else None

def _parse_invoice_number(text: str) -> str | None:
    m = re.search(r"\b(?:facture|invoice|n°|ref|référence)\b[^\w]*([A-Z0-9][A-Z0-9\-_/]{3,})", text, re.I)
    return m.group(1) if m else None

def _parse_email(text: str) -> str | None:
    m = re.search(r"[\w.+-]+@[\w-]+\.[a-z]{2,}", text, re.I)
    return m.group(0) if m else None

def _confidence_score(date: str | None, ttc, ht, invoice_num: str | None, fiscal_id: str | None) -> float:
    fields = [date, ttc, ht, invoice_num, fiscal_id]
    return sum(1 for f in fields if f is not None) / len(fields)

# ── Category & deductibility ──────────────────────────────────────────────────

_CATEGORIES = {
    "hébergement":  ["hébergement", "hôtel", "hotel", "airbnb", "ovh", "serveur", "server", "hosting"],
    "transport":    ["sncf", "ratp", "train", "taxi", "uber", "vol", "billet", "transport"],
    "repas":        ["restaurant", "repas", "déjeuner", "dîner", "café", "brasserie"],
    "matériel":     ["ordinateur", "clavier", "souris", "écran", "hardware", "matériel"],
    "téléphonie":   ["orange", "sfr", "bouygues", "free mobile", "téléphone", "mobile", "forfait"],
    "logiciel":     ["adobe", "microsoft", "slack", "notion", "github", "saas", "logiciel", "licence", "abonnement"],
    "formation":    ["formation", "cours", "udemy", "coursera", "conférence", "séminaire"],
    "assurance":    ["assurance", "maif", "axa", "allianz", "mutuelle"],
    "loyer":        ["loyer", "bail", "location bureau"],
    "publicité":    ["google ads", "meta ads", "facebook ads", "publicité", "marketing"],
    "domaine":      ["nom de domaine", "domain", "dns"],
    "comptabilité": ["expert-comptable", "comptable", "comptabilité"],
}

_DEDUCTIBILITY = {
    "hébergement": 1.0, "transport": 1.0, "matériel": 1.0, "téléphonie": 1.0,
    "logiciel": 1.0, "formation": 1.0, "assurance": 1.0, "loyer": 1.0,
    "publicité": 1.0, "domaine": 1.0, "comptabilité": 1.0,
    "repas": 0.5,
    "autres": 0.0,
}

def _guess_category(text: str) -> str:
    text_l = text.lower()
    for cat, keywords in _CATEGORIES.items():
        if any(k in text_l for k in keywords):
            return cat
    return "autres"

def _guess_payment_mode(text: str) -> str | None:
    text_l = text.lower()
    if any(k in text_l for k in ["virement", "transfer"]):
        return "virement"
    if any(k in text_l for k in ["carte", "cb", "visa", "mastercard"]):
        return "CB"
    if "chèque" in text_l or "cheque" in text_l:
        return "chèque"
    if "prélèvement" in text_l or "prelevement" in text_l or "sepa" in text_l:
        return "prélèvement"
    if "espèce" in text_l or "cash" in text_l:
        return "espèces"
    return None

def _guess_doc_type(text: str, user_siren: str, montant_ttc: float | None) -> str:
    t = text.lower()
    is_avoir = any(k in t for k in ["avoir", "credit note", "note de crédit"])
    user_is_emitter = bool(user_siren and user_siren in text)

    if is_avoir:
        return "avoir_émis" if user_is_emitter else "avoir_reçu"
    if any(k in t for k in ["note de frais", "remboursement de frais"]):
        return "note_de_frais"
    if any(k in t for k in ["devis", "cotation", "quote"]):
        return "devis"
    if any(k in t for k in ["relevé de compte", "extrait de compte"]):
        return "relevé_bancaire"
    if user_is_emitter:
        return "facture_émise"
    if not _parse_invoice_number(text) and (montant_ttc or 0) < 200:
        return "reçu"
    return "facture_reçue"

# ── Invoice assembly ──────────────────────────────────────────────────────────

def parse_invoice(text: str, fichier_source: str, profil: str, user_siren: str = "") -> dict:
    date_str  = _parse_date(text)
    date_obj  = datetime.fromisoformat(date_str) if date_str else None
    ht, tva, ttc, taux_tva = _parse_amounts(text)
    invoice_num  = _parse_invoice_number(text)
    siren        = _parse_siren(text)
    siret        = _parse_siret(text)
    tva_intracom = _parse_tva_intracom(text)
    catégorie    = _guess_category(text)
    taux_ded     = _DEDUCTIBILITY.get(catégorie, 0.0)
    confiance    = _confidence_score(date_str, ttc, ht, invoice_num, siren or tva_intracom)
    doc_type     = _guess_doc_type(text, user_siren, ttc)

    return {
        "id":                       str(uuid.uuid4()),
        "type_document":            doc_type,
        "numéro_facture":           invoice_num,
        "date_document":            date_str,
        "date_échéance":            None,
        "date_paiement":            None,
        "émetteur_nom":             None,
        "émetteur_siren":           siren,
        "émetteur_siret":           siret,
        "émetteur_tva_intracom":    tva_intracom,
        "émetteur_adresse":         None,
        "émetteur_email":           _parse_email(text),
        "destinataire_nom":         None,
        "destinataire_siren":       None,
        "destinataire_siret":       None,
        "destinataire_tva_intracom": None,
        "destinataire_adresse":     None,
        "montant_ht":               ht,
        "taux_tva":                 taux_tva,
        "montant_tva":              tva,
        "montant_ttc":              ttc,
        "devise":                   "EUR",
        "montant_eur":              ttc,
        "taux_change":              None,
        "description_prestation":   None,
        "lignes_détail":            None,
        "catégorie":                catégorie,
        "sous_catégorie":           None,
        "déductible":               1 if taux_ded > 0 else 0,
        "taux_déductibilité":       taux_ded,
        "centre_de_coût":           None,
        "mode_paiement":            _guess_payment_mode(text),
        "référence_paiement":       None,
        "statut_paiement":          "payé",
        "exercice_fiscal":          date_obj.year if date_obj else None,
        "trimestre":                ((date_obj.month - 1) // 3 + 1) if date_obj else None,
        "régime_tva":               None,
        "nature_charge":            "BIC",
        "statut_fiscal_profil":     profil,
        "fichier_source":           fichier_source,
        "hash_fichier":             None,
        "confiance":                round(confiance, 2),
        "statut_révision":          "auto_validé" if confiance >= 0.8 else "à_réviser",
        "révisé_par":               "auto",
        "date_révision":            datetime.now(timezone.utc).isoformat(),
        "notes_correction":         None,
        "date_extraction":          datetime.now(timezone.utc).isoformat(),
        "texte_brut":               text,
    }

# ── File handling ─────────────────────────────────────────────────────────────

SUPPORTED = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp", ".heic", ".heif"}

def detect_extension(path: Path) -> str | None:
    header = path.read_bytes()[:16]
    if header[:4] == b"%PDF":
        return ".pdf"
    if header[:2] == b"\xff\xd8":
        return ".jpg"
    if header[:8] == b"\x89PNG\r\n\x1a\n":
        return ".png"
    if header[4:8] in (b"ftyp", b"heic", b"heis", b"mif1", b"msf1"):
        return ".heic"
    if header[:4] in (b"II*\x00", b"MM\x00*"):
        return ".tiff"
    return None

def _collect_files(input_dir: Path) -> list[Path]:
    files = []
    for f in input_dir.rglob("*"):
        if not f.is_file():
            continue
        if f.suffix.lower() in SUPPORTED:
            files.append(f)
        elif not f.suffix:
            ext = detect_extension(f)
            if ext:
                new_path = f.with_suffix(ext)
                f.rename(new_path)
                files.append(new_path)
    return files

def _move_safely(src: Path, dest_dir: Path, suffix: str = "") -> None:
    dest = dest_dir / src.name
    if dest.exists():
        dest = dest_dir / f"{src.stem}{suffix}{src.suffix}"
    shutil.move(str(src), dest)

# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Extrait les données des factures vers SQLite")
    parser.add_argument("--input", type=Path, help="Dossier d'entrée (défaut: config)")
    parser.add_argument("--config", type=Path, default=Path("config.toml"))
    args = parser.parse_args()

    cfg = load_config(args.config)
    root = Path(".")
    input_dir     = args.input or root / cfg["paths"]["input"]
    processed_dir = root / cfg["paths"]["processed"]
    errors_dir    = root / cfg["paths"]["errors"]
    db_path       = root / cfg["paths"]["db"]
    threshold     = cfg["extraction"]["confidence_threshold"]
    profil        = cfg["fiscal"]["default_profile"]
    user_siren    = cfg["identity"]["siren"]

    for d in (input_dir, processed_dir, errors_dir):
        d.mkdir(parents=True, exist_ok=True)

    files = _collect_files(input_dir)
    if not files:
        print("Aucun fichier à traiter dans", input_dir)
        return

    conn = open_db(db_path)
    traités = erreurs = à_réviser = doublons = 0

    for f in files:
        print(f"→ {f.name}")
        h = hashlib.sha256(f.read_bytes()).hexdigest()

        if hash_exists(conn, h):
            print("  [SKIP] déjà en base")
            doublons += 1
            continue

        try:
            text = extract_text(f, cfg)
            if not text.strip():
                raise ValueError("Texte vide après extraction")
            row = parse_invoice(text, str(f), profil, user_siren)
            row["hash_fichier"] = h
            insert(conn, row)
            _move_safely(f, processed_dir, f"_{row['id'][:8]}")
            traités += 1
            flag = f"  [OK] confiance={row['confiance']:.0%}"
            if row["statut_révision"] == "à_réviser":
                flag += " ⚠ à réviser"
                à_réviser += 1
            print(flag)
        except Exception as e:
            print(f"  [ERREUR] {e}")
            shutil.move(str(f), errors_dir / f.name)
            erreurs += 1

    conn.close()
    print(f"\nRésultat : {traités} traités, {erreurs} erreurs, {à_réviser} à réviser, {doublons} doublons ignorés")

if __name__ == "__main__":
    main()

"""
extract.py — Extraction de factures/reçus vers SQLite
Usage: python extract.py --profile SLUG [--input DIR]
"""

import argparse
import hashlib
import re
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from constants import (
    CONFIDENCE_THRESHOLD,
    IMPORT_DOUBLON,
    IMPORT_EN_ATTENTE,
    IMPORT_EN_EXTRACTION,
    IMPORT_ERREUR,
    IMPORT_TERMINE,
    STATUT_A_REVISER,
    STATUT_VALIDE,
)
from db import get_extraction_cfg, get_known_emitters, get_user_profile, open_db
from parsers import (
    _confidence_score,
    _guess_category,
    _guess_doc_type,
    _guess_payment_mode,
    _match_known_emitter,
    _parse_amount,
    _parse_amounts,
    _parse_date,
    _parse_email,
    _parse_emetteur_fallback,
    _parse_invoice_number,
    _parse_siren,
    _parse_siret,
    _parse_tva_intracom,
    get_deductibility,
)

HERE = Path(__file__).parent

# ── Supported file extensions ─────────────────────────────────────────────────

SUPPORTED = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp", ".heic", ".heif"}

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


def _order_points(pts):
    import numpy as np
    rect = np.zeros((4, 2), dtype=np.float32)
    corner_sums = pts.sum(axis=1)
    rect[0] = pts[np.argmin(corner_sums)]    # top-left
    rect[2] = pts[np.argmax(corner_sums)]    # bottom-right
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # top-right
    rect[3] = pts[np.argmax(diff)] # bottom-left
    return rect


def _correct_perspective(arr):
    import cv2
    import numpy as np
    h, w = arr.shape[:2]
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges = cv2.Canny(blurred, 75, 200)
    contours, _ = cv2.findContours(edges, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        return arr
    for cnt in sorted(contours, key=cv2.contourArea, reverse=True)[:5]:
        peri = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)
        if len(approx) != 4:
            continue
        if cv2.contourArea(approx) < 0.2 * h * w:
            continue
        pts = approx.reshape(4, 2).astype(np.float32)
        rect = _order_points(pts)
        widthA  = np.linalg.norm(rect[2] - rect[3])
        widthB  = np.linalg.norm(rect[1] - rect[0])
        heightA = np.linalg.norm(rect[1] - rect[2])
        heightB = np.linalg.norm(rect[0] - rect[3])
        maxW = max(int(widthA), int(widthB), 1)
        maxH = max(int(heightA), int(heightB), 1)
        dst = np.array([[0, 0], [maxW - 1, 0], [maxW - 1, maxH - 1], [0, maxH - 1]], dtype=np.float32)
        M = cv2.getPerspectiveTransform(rect, dst)
        return cv2.warpPerspective(arr, M, (maxW, maxH))
    return arr


def _deskew(arr):
    import cv2
    import numpy as np
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    coords = np.column_stack(np.where(thresh > 0))
    if len(coords) < 10:
        return arr
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.5:
        return arr
    h, w = arr.shape[:2]
    M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(arr, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def _preprocess_image(img):
    import cv2
    import numpy as np
    from PIL import ImageOps
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    try:
        arr = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
        # Step 1: bilateral denoise — removes grain without blurring text edges
        arr = cv2.bilateralFilter(arr, d=9, sigmaColor=75, sigmaSpace=75)
        # Step 2: perspective correction (skips gracefully if no document quad found)
        arr = _correct_perspective(arr)
        # Step 3: adaptive binarization — handles uneven lighting and shadows
        gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
        gray = cv2.adaptiveThreshold(
            gray, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            blockSize=25, C=11,
        )
        arr = cv2.cvtColor(gray, cv2.COLOR_GRAY2BGR)
        # Step 4: deskew
        arr = _deskew(arr)
        img = __import__("PIL.Image", fromlist=["Image"]).Image.fromarray(
            cv2.cvtColor(arr, cv2.COLOR_BGR2RGB)
        )
    except Exception:
        pass
    return img


_easyocr_reader = None

def _get_easyocr_reader():
    global _easyocr_reader
    if _easyocr_reader is None:
        import easyocr
        _easyocr_reader = easyocr.Reader(["fr", "en"], gpu=False)
    return _easyocr_reader


def _tesseract_confidence(text: str) -> float:
    if not text:
        return 0.0
    alphanum = sum(c.isalnum() for c in text)
    return alphanum / len(text)


def extract_text_image(
    path: Path,
    ocr_lang: str,
    ocr_dpi: int,
    preprocess: bool = True,
    easyocr_fallback: bool = False,
    easyocr_threshold: float = 0.4,
) -> str:
    import pytesseract
    from PIL import Image
    if path.suffix.lower() in {".heic", ".heif"}:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    img = Image.open(path).convert("RGB")
    if preprocess:
        img = _preprocess_image(img)
    text = pytesseract.image_to_string(img, lang=ocr_lang, config="--psm 3")
    if not _parse_date(text):
        text_psm6 = pytesseract.image_to_string(img, lang=ocr_lang, config="--psm 6")
        text = text + "\n" + text_psm6
    if easyocr_fallback and _tesseract_confidence(text) < easyocr_threshold:
        import numpy as np
        reader = _get_easyocr_reader()
        easy_lines = reader.readtext(np.array(img), detail=0)
        text_easy = "\n".join(easy_lines)
        if len(text_easy) > len(text):
            text = text_easy
    return text.strip()

def extract_text(path: Path, cfg: dict) -> str:
    lang = cfg["extraction"]["ocr_lang"]
    dpi = cfg["extraction"]["ocr_dpi"]
    suffix = path.suffix.lower()
    if suffix == ".pdf":
        return extract_text_pdf(path, lang, dpi)
    if suffix in {".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp", ".heic", ".heif"}:
        preprocess = cfg["extraction"].get("ocr_preprocess", True)
        easyocr_fallback = cfg["extraction"].get("ocr_easyocr_fallback", False)
        easyocr_threshold = cfg["extraction"].get("ocr_easyocr_threshold", 0.4)
        return extract_text_image(
            path, lang, dpi,
            preprocess=preprocess,
            easyocr_fallback=easyocr_fallback,
            easyocr_threshold=easyocr_threshold,
        )
    raise ValueError(f"Format non supporté : {suffix}")

# ── DB helpers (kept here for backward compat — delegates to db.py) ───────────

def hash_exists(conn, h: str) -> bool:
    return conn.execute("SELECT 1 FROM invoices WHERE hash_fichier = ?", (h,)).fetchone() is not None


def find_invoice_id_by_hash(conn, h: str) -> str | None:
    """Retourne l'id de la facture déjà ingérée pour ce hash, ou None.

    Sert à tracer dans `import_jobs` la facture source quand un doublon est
    rejeté — l'UI peut alors proposer un lien vers l'enregistrement existant.
    """
    row = conn.execute(
        "SELECT id FROM invoices WHERE hash_fichier = ? LIMIT 1", (h,)
    ).fetchone()
    return row[0] if row else None

def insert(conn, row: dict) -> None:
    cols = ", ".join(f'"{k}"' for k in row)
    placeholders = ", ".join("?" for _ in row)
    conn.execute(f"INSERT INTO invoices ({cols}) VALUES ({placeholders})", list(row.values()))
    conn.commit()

# ── Invoice assembly ──────────────────────────────────────────────────────────

def parse_invoice(text: str, fichier_source: str, profil: str, user_siren: str = "", known_emitters: dict | None = None) -> dict:
    date_str  = _parse_date(text)
    date_obj  = datetime.fromisoformat(date_str) if date_str else None
    ht, tva, ttc, taux_tva = _parse_amounts(text)
    invoice_num  = _parse_invoice_number(text)
    siren        = _parse_siren(text)
    siret        = _parse_siret(text)
    tva_intracom = _parse_tva_intracom(text)
    catégorie    = _guess_category(text)
    taux_ded     = get_deductibility(catégorie)
    confiance    = _confidence_score(date_str, ttc, ht, invoice_num, siren or tva_intracom)
    doc_type     = _guess_doc_type(text, user_siren, ttc)

    émetteur_nom = _parse_emetteur_fallback(text)
    if not émetteur_nom and known_emitters:
        émetteur_nom = _match_known_emitter(text, known_emitters)

    return {
        "id":                       str(uuid.uuid4()),
        "type_document":            doc_type,
        "numéro_facture":           invoice_num,
        "date_document":            date_str,
        "date_échéance":            None,
        "date_paiement":            None,
        "émetteur_nom":             émetteur_nom,
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
        "statut_révision":          STATUT_VALIDE if confiance >= CONFIDENCE_THRESHOLD else STATUT_A_REVISER,
        "révisé_par":               "auto",
        "date_révision":            datetime.now(timezone.utc).isoformat(),
        "notes_correction":         None,
        "validé_le":                None,
        "corrections_log":          "[]",
        "date_extraction":          datetime.now(timezone.utc).isoformat(),
        "texte_brut":               text,
    }

# ── File handling ─────────────────────────────────────────────────────────────

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

def _move_safely(src: Path, dest_dir: Path, suffix: str = "") -> Path:
    dest = dest_dir / src.name
    if dest.exists():
        dest = dest_dir / f"{src.stem}{suffix}{src.suffix}"
    shutil.move(str(src), dest)
    return dest

# ── Suivi des jobs d'import ───────────────────────────────────────────────────

def _mettre_a_jour_statut_import(conn, job_id: str | None, filename: str,
                                  statut: str,
                                  invoice_id: str | None = None,
                                  message_erreur: str | None = None) -> None:
    """Met à jour le statut d'un fichier dans l'agrégat import_jobs.
    No-op si job_id est None (utilisation CLI hors dashboard)."""
    if not job_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE import_jobs SET statut=?, invoice_id=?, message_erreur=?, "
        "mis_à_jour_le=? WHERE job_id=? AND filename=?",
        (statut, invoice_id, message_erreur, now, job_id, filename),
    )
    conn.commit()


def _cloturer_job(conn, job_id: str | None) -> None:
    """Tout fichier resté `en_attente` (supprimé par la dedup amont) → `doublon`."""
    if not job_id:
        return
    now = datetime.now(timezone.utc).isoformat()
    conn.execute(
        "UPDATE import_jobs SET statut=?, mis_à_jour_le=? "
        "WHERE job_id=? AND statut=?",
        (IMPORT_DOUBLON, now, job_id, IMPORT_EN_ATTENTE),
    )
    conn.commit()


def _marquer_non_terminaux_en_erreur(db_path, job_id: str | None,
                                      raison: str) -> None:
    """Filet de sécurité : si le process plante avant la fin, on flippe les lignes
    `en_attente` et `en_extraction` du job en `erreur` pour libérer le client.
    Ouvre sa propre connexion car appelé depuis un finally — `conn` peut être
    inutilisable."""
    if not job_id:
        return
    try:
        conn = open_db(db_path)
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            "UPDATE import_jobs SET statut=?, message_erreur=?, mis_à_jour_le=? "
            "WHERE job_id=? AND statut IN (?, ?)",
            (IMPORT_ERREUR, raison, now, job_id,
             IMPORT_EN_ATTENTE, IMPORT_EN_EXTRACTION),
        )
        conn.commit()
        conn.close()
    except Exception:
        # Le finally ne doit jamais masquer l'exception d'origine.
        pass


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Extrait les données des factures vers SQLite")
    parser.add_argument("--input", type=Path, help="Dossier d'entrée (override)")
    parser.add_argument("--profile", type=str, required=True, help="Slug du profil")
    parser.add_argument("--job-id", type=str, default=None,
                        help="Job d'import à mettre à jour ligne par ligne")
    args = parser.parse_args()
    job_id = args.job_id

    from profiles import resolve_paths
    paths = resolve_paths(args.profile)
    input_dir      = args.input or paths["input"]
    processed_dir  = paths["processed"]
    errors_dir     = paths["errors"]
    duplicates_dir = paths["duplicates"]
    db_path        = paths["db"]

    for d in (input_dir, processed_dir, errors_dir, duplicates_dir):
        d.mkdir(parents=True, exist_ok=True)

    conn = open_db(db_path)

    profile = get_user_profile(conn)
    if profile is None:
        print("Profil non configuré. Lance le dashboard d'abord : python dashboard.py")
        sys.exit(1)

    profil         = profile["fiscal_profile"]
    user_siren     = profile["siren"]
    known_emitters = get_known_emitters(conn)
    cfg = {"extraction": get_extraction_cfg(conn)}

    files = _collect_files(input_dir)
    if not files:
        print("Aucun fichier à traiter dans", input_dir)
        _cloturer_job(conn, job_id)
        conn.close()
        return
    traités = erreurs = à_réviser = doublons = 0

    try:
        for f in files:
            print(f"→ {f.name}")
            _mettre_a_jour_statut_import(conn, job_id, f.name,
                                          IMPORT_EN_EXTRACTION)
            file_hash = hashlib.sha256(f.read_bytes()).hexdigest()

            existing_id = find_invoice_id_by_hash(conn, file_hash)
            if existing_id is not None:
                # Le fichier doit quitter input/ : sinon il y reste indéfiniment,
                # gonfle `health.pending_files` et rend "↻ Mettre à jour"
                # silencieux côté UI (issue #109).
                _move_safely(f, duplicates_dir)
                print(f"  [SKIP] déjà en base → déplacé dans duplicates/")
                _mettre_a_jour_statut_import(conn, job_id, f.name,
                                              IMPORT_DOUBLON,
                                              invoice_id=existing_id)
                doublons += 1
                continue

            try:
                text = extract_text(f, cfg)
                if not text.strip():
                    raise ValueError("Texte vide après extraction")
                row = parse_invoice(text, str(f), profil, user_siren, known_emitters)
                row["hash_fichier"] = file_hash
                insert(conn, row)
                dest = _move_safely(f, processed_dir, f"_{row['id'][:8]}")
                conn.execute(
                    "UPDATE invoices SET fichier_source=? WHERE id=?",
                    (str(dest.resolve()), row["id"]),
                )
                conn.commit()
                _mettre_a_jour_statut_import(conn, job_id, f.name,
                                              IMPORT_TERMINE,
                                              invoice_id=row["id"])
                traités += 1
                flag = f"  [OK] confiance={row['confiance']:.0%}"
                if row["statut_révision"] == STATUT_A_REVISER:
                    flag += " ⚠ à réviser"
                    à_réviser += 1
                print(flag)
            except Exception as e:
                print(f"  [ERREUR] {e}")
                shutil.move(str(f), errors_dir / f.name)
                _mettre_a_jour_statut_import(conn, job_id, f.name,
                                              IMPORT_ERREUR,
                                              message_erreur=str(e))
                erreurs += 1

        _cloturer_job(conn, job_id)
        conn.close()
    finally:
        # Filet de sécurité : si un crash sort de la boucle sans passer par
        # `_cloturer_job`, on libère le client en marquant les lignes pendantes
        # comme `erreur`. Ouvre sa propre connexion : la précédente peut être
        # dans un état inutilisable.
        _marquer_non_terminaux_en_erreur(
            db_path, job_id,
            raison="Pipeline interrompu — relancer l'import",
        )
    print(f"\nRésultat : {traités} traités, {erreurs} erreurs, {à_réviser} à réviser, {doublons} doublons ignorés")

if __name__ == "__main__":
    main()

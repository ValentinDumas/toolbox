"""
db.py — Accès SQLite partagé : ouverture, schéma, migrations, insertion.
"""

import sqlite3
from pathlib import Path

from constants import STATUT_A_REVISER, STATUT_AUTO_VALIDE, STATUT_REVISE, STATUT_PRET, STATUT_VALIDE

SCHEMA = """
CREATE TABLE IF NOT EXISTS user_profile (
    id                       INTEGER PRIMARY KEY CHECK (id = 1),
    nom                      TEXT    DEFAULT '',
    siren                    TEXT    DEFAULT '',
    tva_intracom             TEXT    DEFAULT '',
    fiscal_profile           TEXT    DEFAULT 'auto-entrepreneur',
    cadence                  TEXT    DEFAULT '',
    setup_complete           INTEGER DEFAULT 0,
    ocr_backend              TEXT    DEFAULT 'local',
    ocr_confidence_threshold REAL    DEFAULT 0.8,
    ocr_lang                 TEXT    DEFAULT 'fra+eng',
    ocr_dpi                  INTEGER DEFAULT 300,
    ocr_preprocess           INTEGER DEFAULT 1,
    ocr_easyocr_fallback     INTEGER DEFAULT 0,
    ocr_easyocr_threshold    REAL    DEFAULT 0.4
);

CREATE TABLE IF NOT EXISTS known_emitters (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword  TEXT UNIQUE NOT NULL,
    nom      TEXT NOT NULL
);

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
    statut_révision         TEXT DEFAULT 'validé',
    révisé_par              TEXT DEFAULT 'auto',
    date_révision           TEXT,
    notes_correction        TEXT,
    validé_le               TEXT,
    corrections_log         TEXT DEFAULT '[]',
    date_extraction         TEXT,
    texte_brut              TEXT,
    deleted_at              TEXT,
    deleted_by              TEXT
)
"""

SCHEMA_VERSION = 3


def _run_migrations(conn: sqlite3.Connection) -> None:
    conn.executescript(SCHEMA)

    for sql in [
        "ALTER TABLE invoices ADD COLUMN texte_brut TEXT",
        "ALTER TABLE invoices ADD COLUMN validé_le TEXT",
        "ALTER TABLE invoices ADD COLUMN corrections_log TEXT DEFAULT '[]'",
        "ALTER TABLE invoices ADD COLUMN deleted_at TEXT",
        "ALTER TABLE invoices ADD COLUMN deleted_by TEXT",
        "ALTER TABLE user_profile ADD COLUMN ocr_backend TEXT DEFAULT 'local'",
        "ALTER TABLE user_profile ADD COLUMN ocr_confidence_threshold REAL DEFAULT 0.8",
        "ALTER TABLE user_profile ADD COLUMN ocr_lang TEXT DEFAULT 'fra+eng'",
        "ALTER TABLE user_profile ADD COLUMN ocr_dpi INTEGER DEFAULT 300",
        "ALTER TABLE user_profile ADD COLUMN ocr_preprocess INTEGER DEFAULT 1",
        "ALTER TABLE user_profile ADD COLUMN ocr_easyocr_fallback INTEGER DEFAULT 0",
        "ALTER TABLE user_profile ADD COLUMN ocr_easyocr_threshold REAL DEFAULT 0.4",
    ]:
        try:
            conn.execute(sql)
        except sqlite3.OperationalError:
            pass

    conn.execute(
        "UPDATE invoices SET statut_révision=? WHERE statut_révision IN (?,?,?)",
        (STATUT_VALIDE, STATUT_PRET, STATUT_AUTO_VALIDE, STATUT_REVISE),
    )
    conn.execute(f"PRAGMA user_version = {SCHEMA_VERSION}")
    conn.commit()


def open_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row

    current_version = conn.execute("PRAGMA user_version").fetchone()[0]
    if current_version < SCHEMA_VERSION:
        _run_migrations(conn)

    return conn


def get_user_profile(conn: sqlite3.Connection) -> dict | None:
    """Return the user profile row, or None if setup is not complete."""
    row = conn.execute("SELECT * FROM user_profile WHERE id=1").fetchone()
    if row is None or not row["setup_complete"]:
        return None
    return dict(row)


def get_known_emitters(conn: sqlite3.Connection) -> dict[str, str]:
    """Return {keyword: nom} from the known_emitters table."""
    rows = conn.execute("SELECT keyword, nom FROM known_emitters").fetchall()
    return {row["keyword"]: row["nom"] for row in rows}


_EXTRACTION_DEFAULTS = {
    "backend": "local",
    "confidence_threshold": 0.8,
    "ocr_lang": "fra+eng",
    "ocr_dpi": 300,
    "ocr_preprocess": True,
    "ocr_easyocr_fallback": False,
    "ocr_easyocr_threshold": 0.4,
}


def get_extraction_cfg(conn: sqlite3.Connection) -> dict:
    """Return extraction config from user_profile, falling back to hardcoded defaults."""
    row = conn.execute("SELECT * FROM user_profile WHERE id=1").fetchone()
    if row is None:
        return dict(_EXTRACTION_DEFAULTS)
    return {
        "backend":              row["ocr_backend"] or "local",
        "confidence_threshold": row["ocr_confidence_threshold"] if row["ocr_confidence_threshold"] is not None else 0.8,
        "ocr_lang":             row["ocr_lang"] or "fra+eng",
        "ocr_dpi":              row["ocr_dpi"] or 300,
        "ocr_preprocess":       bool(row["ocr_preprocess"]) if row["ocr_preprocess"] is not None else True,
        "ocr_easyocr_fallback": bool(row["ocr_easyocr_fallback"]) if row["ocr_easyocr_fallback"] is not None else False,
        "ocr_easyocr_threshold": row["ocr_easyocr_threshold"] if row["ocr_easyocr_threshold"] is not None else 0.4,
    }

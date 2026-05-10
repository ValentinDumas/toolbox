"""
db.py — Accès SQLite partagé : ouverture, schéma, migrations, insertion.
"""

import sqlite3
from pathlib import Path

from constants import STATUT_A_REVISER, STATUT_AUTO_VALIDE, STATUT_REVISE, STATUT_PRET, STATUT_VALIDE

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

_LEGACY_STATUSES = f"'{STATUT_PRET}', '{STATUT_AUTO_VALIDE}', '{STATUT_REVISE}'"


def open_db(path: Path) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute(SCHEMA)
    existing = {row[1] for row in conn.execute("PRAGMA table_info(invoices)")}
    migrations = [
        ("texte_brut",      "ALTER TABLE invoices ADD COLUMN texte_brut TEXT"),
        ("validé_le",       "ALTER TABLE invoices ADD COLUMN validé_le TEXT"),
        ("corrections_log", "ALTER TABLE invoices ADD COLUMN corrections_log TEXT DEFAULT '[]'"),
        ("deleted_at",      "ALTER TABLE invoices ADD COLUMN deleted_at TEXT"),
        ("deleted_by",      "ALTER TABLE invoices ADD COLUMN deleted_by TEXT"),
    ]
    for col, sql in migrations:
        if col not in existing:
            conn.execute(sql)
    # Rename legacy statuses
    conn.execute(
        f"UPDATE invoices SET statut_révision='{STATUT_VALIDE}' "
        f"WHERE statut_révision IN ({_LEGACY_STATUSES})"
    )
    conn.commit()
    return conn

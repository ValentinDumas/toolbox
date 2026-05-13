"""
db.py — Accès SQLite partagé : ouverture, schéma, migrations, insertion.
"""

import sqlite3
from pathlib import Path


HERE = Path(__file__).parent

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

CREATE TABLE IF NOT EXISTS category_tva_rates (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    catégorie TEXT UNIQUE NOT NULL,
    taux_tva  REAL NOT NULL
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
);

CREATE TABLE IF NOT EXISTS import_jobs (
    job_id        TEXT NOT NULL,
    filename      TEXT NOT NULL,
    statut        TEXT NOT NULL CHECK (statut IN
                    ('en_attente','en_extraction','terminé','erreur','doublon')),
    invoice_id    TEXT,
    message_erreur TEXT,
    créé_le       TEXT NOT NULL,
    mis_à_jour_le TEXT NOT NULL,
    PRIMARY KEY (job_id, filename)
);

CREATE INDEX IF NOT EXISTS idx_import_jobs_job ON import_jobs(job_id);

CREATE TABLE IF NOT EXISTS urssaf_declarations (
    period_key   TEXT PRIMARY KEY,
    marked_at    TEXT NOT NULL,
    marked_by    TEXT NOT NULL DEFAULT 'user'
);
"""

SCHEMA_VERSION = 8

# Catégories par défaut + taux de TVA. Seedées au premier lancement, modifiables
# via le tab "Catégories TVA" des paramètres. Source : les clés de `_CATEGORIES`
# dans parsers.py, au taux légal standard français (20 %).
_DEFAULT_CATEGORY_TVA_RATES = {
    "hébergement":   0.20,
    "transport":     0.10,
    "repas":         0.10,
    "matériel":      0.20,
    "téléphonie":    0.20,
    "logiciel":      0.20,
    "formation":     0.20,
    "assurance":     0.00,
    "loyer":         0.20,
    "publicité":     0.20,
    "domaine":       0.20,
    "comptabilité":  0.20,
    "autres":        0.20,
}


def _run_migrations(conn: sqlite3.Connection, config_path: Path | None = None) -> None:
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
        "ALTER TABLE user_profile ADD COLUMN avatar_data TEXT",
        # AE — activité principale (vente, service_bic, service_bnc_ssi,
        # service_bnc_cipav, meuble_tourisme_classe). Détermine les taux
        # de cotisations URSSAF appliqués (cf. AUTO_ENTREPRENEUR_RULES.md §4.1).
        "ALTER TABLE user_profile ADD COLUMN activite_principale TEXT",
        # AE — option versement libératoire de l'IR (#137) et ACRE (#138).
        # Conservés ici pour traçabilité ; usage côté services/urssaf.py.
        "ALTER TABLE user_profile ADD COLUMN versement_liberatoire INTEGER DEFAULT 0",
        "ALTER TABLE user_profile ADD COLUMN acre_actif INTEGER DEFAULT 0",
        "ALTER TABLE user_profile ADD COLUMN acre_date_fin TEXT",
        # Année (entière) pour laquelle l'utilisateur a masqué la bannière
        # de rappel CFE (#139). NULL = jamais masquée. La bannière réapparaît
        # automatiquement chaque novembre nouvelle année.
        "ALTER TABLE user_profile ADD COLUMN cfe_dismissed_year INTEGER",
        # Mentions obligatoires §7.2 sur les factures émises (#140) :
        # code APE/NAF, adresse professionnelle, conditions de règlement.
        "ALTER TABLE user_profile ADD COLUMN code_ape TEXT",
        "ALTER TABLE user_profile ADD COLUMN adresse TEXT",
        "ALTER TABLE user_profile ADD COLUMN conditions_reglement TEXT",
    ]:
        try:
            conn.execute(sql)
        except sqlite3.OperationalError as e:
            if "duplicate column name" not in str(e) and "already exists" not in str(e):
                raise

    # Migration v6 — `taux_tva` passe d'un pourcentage (0..100) à une fraction
    # (0..1, 4 décimales). Le filtre `taux_tva > 1` rend l'opération idempotente :
    # une ligne déjà migrée (≤ 1) n'est jamais touchée. Les taux légaux
    # 2,1 % / 5,5 % / 10 % / 20 % deviennent 0.0210 / 0.0550 / 0.1000 / 0.2000
    # — sans perte de précision.
    # Try/except : certaines DBs légataires (tests minimaux) n'ont pas encore
    # la colonne `taux_tva`. Dans ce cas la migration est sans objet.
    try:
        conn.execute(
            "UPDATE invoices "
            "SET taux_tva = ROUND(taux_tva / 100.0, 4) "
            "WHERE taux_tva IS NOT NULL AND taux_tva > 1"
        )
    except sqlite3.OperationalError as e:
        if "no such column" not in str(e):
            raise

    # Migration v7 — `invoices.catégorie` est désormais toujours stocké en
    # minuscules. L'opération est idempotente : la condition `catégorie !=
    # LOWER(catégorie)` exclut les lignes déjà normalisées.
    try:
        conn.execute(
            "UPDATE invoices SET catégorie = LOWER(catégorie) "
            "WHERE catégorie IS NOT NULL AND catégorie != LOWER(catégorie)"
        )
    except sqlite3.OperationalError as e:
        if "no such column" not in str(e):
            raise

    # Seed des taux de TVA par catégorie au premier passage. INSERT OR IGNORE
    # garantit que les modifications utilisateur ne sont jamais écrasées.
    for cat, taux in _DEFAULT_CATEGORY_TVA_RATES.items():
        conn.execute(
            "INSERT OR IGNORE INTO category_tva_rates (catégorie, taux_tva) "
            "VALUES (?, ?)",
            (cat, taux),
        )

    # Migrate [known_emitters] from config.toml if present and not yet in DB
    toml_path = config_path or HERE / "config.toml"
    if toml_path.is_file():
        try:
            import tomllib  # Python 3.11+
        except ImportError:
            try:
                import tomli as tomllib  # type: ignore[no-redef]
            except ImportError:
                tomllib = None  # type: ignore[assignment]
        if tomllib is not None:
            try:
                data = tomllib.loads(toml_path.read_text(encoding="utf-8"))
                for keyword, nom in data.get("known_emitters", {}).items():
                    conn.execute(
                        "INSERT OR IGNORE INTO known_emitters (keyword, nom) VALUES (?, ?)",
                        (str(keyword).lower(), str(nom)),
                    )
            except Exception:
                pass

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


def get_category_tva_rates(conn: sqlite3.Connection) -> dict[str, float]:
    """Return {catégorie: taux_tva} from the category_tva_rates table."""
    rows = conn.execute(
        "SELECT catégorie, taux_tva FROM category_tva_rates"
    ).fetchall()
    return {row["catégorie"]: row["taux_tva"] for row in rows}


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
    """Return extraction config from user_profile, falling back to _EXTRACTION_DEFAULTS."""
    row = conn.execute("SELECT * FROM user_profile WHERE id=1").fetchone()
    if row is None:
        return dict(_EXTRACTION_DEFAULTS)
    d = _EXTRACTION_DEFAULTS
    return {
        "backend":               row["ocr_backend"] or d["backend"],
        "confidence_threshold":  row["ocr_confidence_threshold"] if row["ocr_confidence_threshold"] is not None else d["confidence_threshold"],
        "ocr_lang":              row["ocr_lang"] or d["ocr_lang"],
        "ocr_dpi":               row["ocr_dpi"] or d["ocr_dpi"],
        "ocr_preprocess":        bool(row["ocr_preprocess"]) if row["ocr_preprocess"] is not None else d["ocr_preprocess"],
        "ocr_easyocr_fallback":  bool(row["ocr_easyocr_fallback"]) if row["ocr_easyocr_fallback"] is not None else d["ocr_easyocr_fallback"],
        "ocr_easyocr_threshold": row["ocr_easyocr_threshold"] if row["ocr_easyocr_threshold"] is not None else d["ocr_easyocr_threshold"],
    }

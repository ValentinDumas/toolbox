"""
queries.py — Fonctions de lecture pures sur la base SQLite.

Aucune dépendance Flask. Utilisable par tous les blueprints.
"""
import sqlite3
from datetime import datetime
from pathlib import Path

from constants import (
    CONTRA_EXPENSE_TYPES,
    CONTRA_INCOME_TYPES,
    EXPENSE_TYPES,
    INCOME_TYPES,
    STATUT_A_REVISER,
    STATUT_VALIDE,
    VALIDATED_STATUSES,
)


def query_ca_encaisse(
    conn: sqlite3.Connection, period_start: str, period_end: str,
) -> dict:
    """Retourne le CA encaissé d'un auto-entrepreneur sur une période.

    Règle métier AUTO_ENTREPRENEUR_RULES.md §4.2 + §8 : l'agrégat URSSAF
    s'appuie sur la **date d'encaissement** (= `date_paiement` d'une pièce
    émise), pas la date d'émission. Les pièces à réviser sont exclues — le
    montant n'est pas encore fiable. Les avoirs émis sont déduits (ils
    annulent un encaissement antérieur, art. 271 CGI).

    Arguments :
        period_start / period_end : bornes ISO YYYY-MM-DD incluses.

    Retour : {
        "ca_ttc": float,          # CA total encaissé sur la période (= HT en franchise)
        "count": int,             # nombre de pièces dans l'agrégat
        "facture_ids": list[str], # ids contributifs (pour audit / export)
    }
    """
    ph_valid = ",".join("?" * len(VALIDATED_STATUSES))
    rows = conn.execute(
        f"SELECT id, type_document, montant_ttc FROM invoices "
        f"WHERE type_document IN (?, ?) "
        f"AND date_paiement IS NOT NULL "
        f"AND date_paiement BETWEEN ? AND ? "
        f"AND statut_révision IN ({ph_valid}) "
        f"AND deleted_at IS NULL",
        ("facture_émise", "avoir_émis", period_start, period_end, *VALIDATED_STATUSES),
    ).fetchall()

    ca_ttc = 0.0
    for row in rows:
        montant = row["montant_ttc"] or 0.0
        if row["type_document"] == "avoir_émis":
            ca_ttc -= montant
        else:
            ca_ttc += montant

    return {
        "ca_ttc": round(ca_ttc, 2),
        "count": len(rows),
        "facture_ids": [row["id"] for row in rows],
    }


def query_fiscal_summary(conn: sqlite3.Connection, year: int, tva_visible: bool = True) -> dict:
    """Retourne les KPI fiscaux pour une année.

    `tva_visible` reflète `services.profil.tva_visible_pour(profile)` :
    pour un profil qui déduit la TVA (SASU, SARL) on raisonne en HT ;
    pour un profil en franchise (auto-entrepreneur, salarié) on raisonne
    en TTC car la TVA payée aux fournisseurs n'est pas récupérable et
    fait donc partie de la charge réelle (cf. VISION.md > Priorité
    auto-entrepreneur, AUTO_ENTREPRENEUR_RULES.md art. 293 B CGI).
    """
    def scalar(sql, *args):
        return conn.execute(sql, args).fetchone()[0] or 0.0

    ph_expense = ",".join("?" * len(EXPENSE_TYPES))
    ph_validated = ",".join("?" * len(VALIDATED_STATUSES))
    charges_col = "montant_ht" if tva_visible else "montant_ttc"

    ca_ht = scalar(
        "SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document=? AND deleted_at IS NULL",
        year, "facture_émise",
    )
    tva_collectee = conn.execute(
        f"SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document=? AND statut_révision IN ({ph_validated}) AND deleted_at IS NULL",
        (year, "facture_émise", *VALIDATED_STATUSES),
    ).fetchone()[0] or 0.0
    tva_deductible = conn.execute(
        f"SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_expense}) AND statut_révision IN ({ph_validated}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES, *VALIDATED_STATUSES),
    ).fetchone()[0] or 0.0

    total_charges = conn.execute(
        f"SELECT COALESCE(SUM({charges_col}),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_expense}) AND statut_révision IN ({ph_validated}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES, *VALIDATED_STATUSES),
    ).fetchone()[0] or 0.0
    row_revision = conn.execute(
        f"SELECT COUNT(*), COALESCE(SUM({charges_col}),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_expense}) AND statut_révision=? AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES, STATUT_A_REVISER),
    ).fetchone()
    nb_charges_revision = row_revision[0] or 0
    total_charges_revision = row_revision[1] or 0.0

    tva_collectee_revision = conn.execute(
        "SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document=? AND statut_révision=? AND deleted_at IS NULL",
        (year, "facture_émise", STATUT_A_REVISER),
    ).fetchone()[0] or 0.0
    tva_deductible_revision = conn.execute(
        f"SELECT COALESCE(SUM(montant_tva),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_expense}) AND statut_révision=? AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES, STATUT_A_REVISER),
    ).fetchone()[0] or 0.0
    nb_tva_revision = conn.execute(
        f"SELECT COUNT(*) FROM invoices WHERE exercice_fiscal=? AND type_document IN (?, {ph_expense}) AND statut_révision=? AND COALESCE(montant_tva,0) <> 0 AND deleted_at IS NULL",
        (year, "facture_émise", *EXPENSE_TYPES, STATUT_A_REVISER),
    ).fetchone()[0] or 0

    return {
        "ca_ht": ca_ht,
        "tva_collectee": tva_collectee,
        "tva_deductible": tva_deductible,
        "tva_a_reverser": tva_collectee - tva_deductible,
        "total_charges": total_charges,
        "total_charges_revision": total_charges_revision,
        "nb_charges_revision": nb_charges_revision,
        "tva_revision_a_reverser": tva_collectee_revision - tva_deductible_revision,
        "nb_tva_revision": nb_tva_revision,
    }


def query_ledger(conn: sqlite3.Connection, year: int, page: int = 1, per_page: int = 50,
                 tva_visible: bool = True) -> dict:
    """Retourne une page du ledger pour une année.

    Les totaux du pied de tableau sont alignés sur la même base que les
    lignes affichées (cf. `templates/dashboard.html` qui montre TTC pour
    les profils non-déductibles et HT pour les autres) :
    `tva_visible` vrai → SUM(montant_ht) ; faux → SUM(montant_ttc).
    """
    offset = (page - 1) * per_page
    rows = conn.execute(
        "SELECT * FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL "
        "AND statut_révision != ? ORDER BY date_document DESC LIMIT ? OFFSET ?",
        (year, STATUT_A_REVISER, per_page, offset),
    ).fetchall()
    total_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL "
        "AND statut_révision != ?",
        (year, STATUT_A_REVISER),
    ).fetchone()[0]

    # Convention PCG : produits + avoirs reçus au crédit, charges + avoirs émis au débit.
    # Cohérent avec `services/comptabilite.sens_comptable`.
    credit_types = INCOME_TYPES + CONTRA_EXPENSE_TYPES
    debit_types  = EXPENSE_TYPES + CONTRA_INCOME_TYPES
    ph_cr = ",".join("?" * len(credit_types))
    ph_db = ",".join("?" * len(debit_types))
    amount_col = "montant_ht" if tva_visible else "montant_ttc"
    total_credit = conn.execute(
        f"SELECT COALESCE(SUM({amount_col}),0) FROM invoices WHERE exercice_fiscal=? "
        f"AND type_document IN ({ph_cr}) AND deleted_at IS NULL AND statut_révision != ?",
        (year, *credit_types, STATUT_A_REVISER),
    ).fetchone()[0] or 0.0
    total_debit = conn.execute(
        f"SELECT COALESCE(SUM({amount_col}),0) FROM invoices WHERE exercice_fiscal=? "
        f"AND type_document IN ({ph_db}) AND deleted_at IS NULL AND statut_révision != ?",
        (year, *debit_types, STATUT_A_REVISER),
    ).fetchone()[0] or 0.0

    return {
        "rows": [dict(r) for r in rows],
        "total_count": total_count,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total_count + per_page - 1) // per_page),
        "total_credit": total_credit,
        "total_debit": total_debit,
    }


def query_health(conn: sqlite3.Connection, paths: dict) -> dict:
    """Retourne les indicateurs de santé du workspace."""
    def count_files(key):
        dir_path = paths[key]
        if not dir_path.exists():
            return 0
        return sum(1 for f in dir_path.iterdir() if f.is_file() and not f.name.startswith("."))

    items_a_reviser = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision=? AND deleted_at IS NULL",
        (STATUT_A_REVISER,),
    ).fetchone()[0]
    validés_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision=? AND deleted_at IS NULL",
        (STATUT_VALIDE,),
    ).fetchone()[0]

    rows = conn.execute(
        "SELECT fichier_source FROM invoices "
        "WHERE fichier_source IS NOT NULL AND TRIM(fichier_source) <> '' "
        "AND deleted_at IS NULL"
    ).fetchall()
    dead_links = sum(
        1 for row in rows
        if not any(
            (paths[d] / Path(row["fichier_source"]).name).is_file()
            for d in ("processed", "errors", "input")
            if paths[d].exists()
        )
    )

    return {
        "pending_files": count_files("input"),
        "items_a_reviser": items_a_reviser,
        "validés_count": validés_count,
        "error_files": count_files("errors"),
        "dead_links": dead_links,
    }


def query_error_files(paths: dict) -> list[dict]:
    errors_dir = paths["errors"]
    if not errors_dir.exists():
        return []
    files = []
    for f in sorted(errors_dir.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file() and not f.name.startswith("."):
            stat = f.stat()
            files.append({
                "name": f.name,
                "size_kb": round(stat.st_size / 1024, 1),
                "mtime": datetime.fromtimestamp(stat.st_mtime).strftime("%d/%m/%Y %H:%M"),
            })
    return files


def query_items_a_reviser(conn: sqlite3.Connection, year: int | None = None) -> list:
    """Retourne tous les items à réviser, indépendamment de l'exercice fiscal.

    Les items à réviser ont souvent un `exercice_fiscal` NULL (date encore non
    extraite). Les filtrer par année les rendrait invisibles — or réviser
    précisément ces items est l'objet de la vue. Une fois validés, leur
    `date_document` (et donc l'exercice fiscal) sera renseigné et ils
    rejoindront le ledger filtré par année.

    Le paramètre `year` est conservé pour compatibilité d'appel mais ignoré.
    """
    rows = conn.execute(
        "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
        "date_document, date_paiement, émetteur_nom, numéro_facture, catégorie, "
        "notes_correction, confiance, fichier_source, texte_brut, statut_révision "
        "FROM invoices WHERE statut_révision=? AND deleted_at IS NULL "
        "ORDER BY (confiance IS NULL), confiance DESC, date_document DESC, id DESC",
        (STATUT_A_REVISER,),
    ).fetchall()
    return [dict(r) for r in rows]


def query_corbeille(conn: sqlite3.Connection, year: int) -> list:
    """Retourne les items soft-deleted pour l'année donnée."""
    rows = conn.execute(
        "SELECT id, fichier_source, émetteur_nom, montant_ttc, type_document, "
        "date_document, deleted_at "
        "FROM invoices WHERE deleted_at IS NOT NULL AND exercice_fiscal=? "
        "ORDER BY deleted_at DESC",
        (year,),
    ).fetchall()
    return [dict(r) for r in rows]

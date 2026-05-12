"""
queries.py — Fonctions de lecture pures sur la base SQLite.

Aucune dépendance Flask. Utilisable par tous les blueprints.
"""
import sqlite3
from datetime import datetime
from pathlib import Path

from constants import (
    EXPENSE_TYPES,
    INCOME_TYPES,
    STATUT_A_REVISER,
    STATUT_VALIDE,
    VALIDATED_STATUSES,
)


def query_fiscal_summary(conn: sqlite3.Connection, year: int) -> dict:
    """Retourne les KPI fiscaux pour une année."""
    def scalar(sql, *args):
        return conn.execute(sql, args).fetchone()[0] or 0.0

    ph_expense = ",".join("?" * len(EXPENSE_TYPES))
    ph_validated = ",".join("?" * len(VALIDATED_STATUSES))

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
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_expense}) AND statut_révision IN ({ph_validated}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES, *VALIDATED_STATUSES),
    ).fetchone()[0] or 0.0
    row_revision = conn.execute(
        f"SELECT COUNT(*), COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_expense}) AND statut_révision=? AND deleted_at IS NULL",
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


def query_ledger(conn: sqlite3.Connection, year: int, page: int = 1, per_page: int = 50) -> dict:
    """Retourne une page du ledger pour une année."""
    offset = (page - 1) * per_page
    rows = conn.execute(
        "SELECT * FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL ORDER BY date_document DESC LIMIT ? OFFSET ?",
        (year, per_page, offset),
    ).fetchall()
    total_count = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE exercice_fiscal=? AND deleted_at IS NULL", (year,)
    ).fetchone()[0]

    ph_in = ",".join("?" * len(INCOME_TYPES))
    ph_ex = ",".join("?" * len(EXPENSE_TYPES))
    total_credit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_in}) AND deleted_at IS NULL",
        (year, *INCOME_TYPES),
    ).fetchone()[0] or 0.0
    total_debit = conn.execute(
        f"SELECT COALESCE(SUM(montant_ht),0) FROM invoices WHERE exercice_fiscal=? AND type_document IN ({ph_ex}) AND deleted_at IS NULL",
        (year, *EXPENSE_TYPES),
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
        "SELECT fichier_source FROM invoices WHERE fichier_source IS NOT NULL"
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


def query_items_a_reviser(conn: sqlite3.Connection, year: int) -> list:
    """Retourne les items à réviser pour l'année donnée."""
    rows = conn.execute(
        "SELECT id, type_document, montant_ht, montant_tva, montant_ttc, "
        "date_document, émetteur_nom, numéro_facture, catégorie, notes_correction, "
        "confiance, fichier_source, texte_brut, statut_révision "
        "FROM invoices WHERE statut_révision=? AND deleted_at IS NULL "
        "AND exercice_fiscal=? "
        "ORDER BY date_document",
        (STATUT_A_REVISER, year),
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

"""
blueprints/factures.py — Routes REST de l'agrégat Facture.

Verbes HTTP corrects (PATCH/DELETE pour les opérations CRUD) et URLs
orientées ressource. Délègue la logique métier à services.revision.
"""
import platform
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from flask import Blueprint, flash, jsonify, redirect, request

from constants import STATUT_A_REVISER, STATUT_VALIDE
from context_helpers import active_db, active_paths, get_profile
from db import open_db
from services.montants import normaliser_tva_selon_profil
from services.revision import (
    _build_corrections_log,
    _check_taux_manquant_si_grand_montant,
    _complete_montants,
    _parse_review_fields,
    _persist_invoice,
    _propager_édition_partielle,
    _recompute_confidence,
    _validate_review_fields,
)

bp_factures = Blueprint("factures", __name__)


def _facture_exists(conn, item_id: str, *, deleted: bool = False) -> bool:
    """Vérifie qu'une facture existe dans le scope demandé.

    `deleted=False` → la facture doit être active (non supprimée).
    `deleted=True`  → la facture doit être dans la corbeille (soft-deleted).
    """
    if deleted:
        sql = "SELECT 1 FROM invoices WHERE id=? AND deleted_at IS NOT NULL"
    else:
        sql = "SELECT 1 FROM invoices WHERE id=? AND deleted_at IS NULL"
    return conn.execute(sql, (item_id,)).fetchone() is not None


@bp_factures.route("/factures/<item_id>", methods=["PATCH"])
def facture_save(item_id):
    """PATCH /factures/<id> — Met à jour une facture après révision."""
    now = datetime.now(timezone.utc).isoformat()
    warning = None
    try:
        conn = open_db(active_db())
        row = conn.execute(
            "SELECT * FROM invoices WHERE id=? AND deleted_at IS NULL",
            (item_id,),
        ).fetchone()
        if not row:
            conn.close()
            return jsonify({"ok": False, "error": "Facture introuvable"}), 404

        current = dict(row)
        fields, errors = _parse_review_fields(request.form)
        if errors:
            conn.close()
            return jsonify({"ok": False, "errors": errors})

        errors = _validate_review_fields(fields, current, conn, item_id)
        if errors:
            conn.close()
            return jsonify({"ok": False, "errors": errors})

        # Édition partielle d'un seul montant : on propage la nouvelle valeur
        # vers HT/TVA/TTC via le taux TVA. Sans cela, éditer le seul TTC
        # laisse `montant_ht` figé et désynchronise les totaux du ledger.
        _propager_édition_partielle(fields, current, set(request.form.keys()))

        # Règle franchise en base (art. 293 B CGI) : avant toute inférence
        # arithmétique, on neutralise la TVA pour les pièces émises par un
        # profil non assujetti. Sinon `_complete_montants` ré-introduirait
        # une TVA fantôme depuis un taux parasite.
        profil_fiscal = (get_profile() or {}).get("fiscal_profile")
        type_doc = fields.get("type_document") or current.get("type_document")
        normaliser_tva_selon_profil(fields, type_doc, profil_fiscal)

        mismatch_warning = _complete_montants(fields, current)

        confidence, confidence_warning = _recompute_confidence(fields, current)
        fields["confiance"] = confidence
        # Règle fiscale art. 242 nonies A : au-dessus du seuil simplifié, la
        # TVA doit être détaillée pour être déductible. Pas applicable aux
        # profils non assujettis à la déduction (auto-entrepreneur, salarié).
        taux_warning = _check_taux_manquant_si_grand_montant(
            fields, current, profil_fiscal,
        )
        # Une incohérence HT/TVA/TTC est informative — la facture reste
        # validée tant que la confiance se maintient. Seules une baisse de
        # confiance et un taux manquant au-dessus du seuil démotent.
        demotion_warning = confidence_warning or taux_warning
        display_warning = demotion_warning or mismatch_warning
        fields = _build_corrections_log(fields, current, now, demotion_warning)
        _persist_invoice(conn, item_id, fields)
        conn.close()
    except sqlite3.DatabaseError as e:
        return jsonify({"ok": False, "errors": {"_base": f"Erreur base de données : {e}"}})
    return jsonify({"ok": True, "warning": display_warning})


def _soft_delete_invoice(item_id: str) -> None:
    now = datetime.now(timezone.utc).isoformat()
    try:
        conn = open_db(active_db())
        conn.execute(
            "UPDATE invoices SET deleted_at=?, deleted_by='user' WHERE id=?",
            (now, item_id),
        )
        conn.commit()
        conn.close()
    except sqlite3.DatabaseError:
        pass


@bp_factures.route("/factures/<item_id>", methods=["DELETE"])
def facture_supprimer(item_id):
    """DELETE /factures/<id> — Soft-delete (API JSON)."""
    conn = open_db(active_db())
    exists = _facture_exists(conn, item_id, deleted=False)
    conn.close()
    if not exists:
        return jsonify({"ok": False, "error": "Facture introuvable"}), 404
    _soft_delete_invoice(item_id)
    return jsonify({"ok": True})


@bp_factures.route("/factures/<item_id>/supprimer", methods=["POST"])
def facture_supprimer_form(item_id):
    """POST /factures/<id>/supprimer — Soft-delete depuis un formulaire HTML.

    Route dédiée pour éviter la collision avec PATCH /factures/<id> (save) :
    un submit POST mal acheminé soft-supprimait silencieusement la facture.
    """
    year = request.form.get("year", datetime.now().year)
    conn = open_db(active_db())
    exists = _facture_exists(conn, item_id, deleted=False)
    conn.close()
    if not exists:
        flash("Facture introuvable", "error")
        return redirect(f"/?year={year}")
    _soft_delete_invoice(item_id)
    # Bascule sur l'onglet Corbeille pour que l'utilisateur voie où l'item a
    # atterri (issues #110 #111 : sans fragment, la page rechargeait sur
    # Ledger et l'item « semblait disparaître »).
    return redirect(f"/?year={year}#corbeille")


@bp_factures.route("/factures/<item_id>/valider", methods=["POST"])
def facture_valider(item_id):
    """POST /factures/<id>/valider — Valide une facture."""
    now = datetime.now(timezone.utc).isoformat()
    year = request.form.get("year", datetime.now().year)
    try:
        conn = open_db(active_db())
        if not _facture_exists(conn, item_id, deleted=False):
            conn.close()
            flash("Facture introuvable", "error")
            return redirect(f"/?year={year}")
        conn.execute(
            "UPDATE invoices SET statut_révision=?, révisé_par='user', "
            "date_révision=?, validé_le=? WHERE id=? AND statut_révision=?",
            (STATUT_VALIDE, now, now, item_id, STATUT_A_REVISER),
        )
        conn.commit()
        conn.close()
    except sqlite3.DatabaseError:
        pass
    return redirect(f"/?year={year}")


@bp_factures.route("/factures/<item_id>/restaurer", methods=["POST"])
def facture_restaurer(item_id):
    """POST /factures/<id>/restaurer — Restaure une facture depuis la corbeille.

    Préserve le statut de révision tel qu'il était au moment de la suppression :
    une facture supprimée alors qu'elle était `validé` revient `validé`. Pour
    repasser explicitement en « à réviser », utiliser `facture_reinitialiser`.
    """
    year = request.form.get("year", datetime.now().year)
    try:
        conn = open_db(active_db())
        if not _facture_exists(conn, item_id, deleted=True):
            conn.close()
            flash("Facture introuvable", "error")
            return redirect(f"/?year={year}")
        conn.execute(
            "UPDATE invoices SET deleted_at=NULL, deleted_by=NULL WHERE id=?",
            (item_id,),
        )
        conn.commit()
        conn.close()
    except sqlite3.DatabaseError:
        pass
    return redirect(f"/?year={year}")


@bp_factures.route("/factures/<item_id>/reinitialiser", methods=["POST"])
def facture_reinitialiser(item_id):
    """POST /factures/<id>/reinitialiser — Repasse une facture en « à réviser »."""
    year = request.form.get("year", datetime.now().year)
    conn = open_db(active_db())
    if not _facture_exists(conn, item_id, deleted=False):
        conn.close()
        flash("Facture introuvable", "error")
        return redirect(f"/?year={year}")
    conn.execute(
        "UPDATE invoices SET statut_révision=?, révisé_par=NULL, "
        "date_révision=NULL, validé_le=NULL "
        "WHERE id=?",
        (STATUT_A_REVISER, item_id),
    )
    conn.commit()
    conn.close()
    return redirect(f"/?year={year}")


@bp_factures.route("/factures/reinitialiser-revisions", methods=["POST"])
def factures_reinitialiser_revisions():
    """POST /factures/reinitialiser-revisions — Repasse toutes les factures validées en « à réviser »."""
    year = request.form.get("year", datetime.now().year)
    conn = open_db(active_db())
    conn.execute(
        "UPDATE invoices SET statut_révision=?, révisé_par=NULL, "
        "date_révision=NULL, validé_le=NULL "
        "WHERE statut_révision=?",
        (STATUT_A_REVISER, STATUT_VALIDE),
    )
    conn.commit()
    conn.close()
    return redirect(f"/?year={year}")


@bp_factures.route("/factures/ouvrir-revision", methods=["POST"])
def factures_ouvrir_revision():
    """POST /factures/ouvrir-revision — Ouvre le fichier CSV de révision dans l'éditeur système."""
    year = request.form.get("year", datetime.now().year)
    try:
        conn = open_db(active_db())
        count = conn.execute(
            "SELECT COUNT(*) FROM invoices WHERE statut_révision=?",
            (STATUT_A_REVISER,),
        ).fetchone()[0]
        conn.close()
    except sqlite3.DatabaseError:
        return redirect(f"/?year={year}")

    if count == 0:
        return redirect(f"/?year={year}")

    paths = active_paths()
    review_dir = paths["review"].resolve()
    review_csv = (review_dir / "review.csv").resolve()
    if not review_csv.is_relative_to(review_dir):
        return redirect(f"/?year={year}")
    cmd = "open" if platform.system() == "Darwin" else "xdg-open"
    subprocess.Popen([cmd, str(review_csv)])
    return redirect(f"/?year={year}")

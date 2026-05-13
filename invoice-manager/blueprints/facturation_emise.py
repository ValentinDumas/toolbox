"""
blueprints/facturation_emise.py — Émission de factures (auto-entrepreneur).

Bounded context « Facturation émise » : routes pour créer une facture
conforme §7.2 (mentions obligatoires, numérotation séquentielle). Le HTML
généré sert de gabarit imprimable ; l'utilisateur peut l'imprimer en PDF
depuis son navigateur (Cmd-P) en attendant l'installation de weasyprint.
"""
from flask import (
    Blueprint, abort, flash, redirect, render_template, request, url_for,
)

from context_helpers import active_db, active_paths
from db import get_user_profile, open_db
from services.facturation_emise import creer_facture_emise

bp_facturation_emise = Blueprint("facturation_emise", __name__)


@bp_facturation_emise.route("/facturation/nouvelle", methods=["GET"])
def nouvelle_facture():
    """GET /facturation/nouvelle — Formulaire d'émission."""
    conn = open_db(active_db())
    profile = get_user_profile(conn) or {}
    conn.close()
    en_franchise = (profile.get("fiscal_profile") == "auto-entrepreneur")
    return render_template(
        "facture_emise_form.html", profile=profile, en_franchise=en_franchise,
    )


@bp_facturation_emise.route("/facturation/nouvelle", methods=["POST"])
def creer_facture():
    """POST /facturation/nouvelle — Crée la facture, retourne vers le ledger."""
    form = request.form
    client_nom = (form.get("client_nom") or "").strip()
    if not client_nom:
        abort(400, "Nom du client requis")

    # Lignes : nom_0/qte_0/pu_0, nom_1/qte_1/pu_1, … (max 20 — borne ACL).
    lignes = []
    for i in range(20):
        designation = (form.get(f"designation_{i}") or "").strip()
        if not designation:
            continue
        try:
            quantite = float((form.get(f"quantite_{i}") or "0").replace(",", "."))
            pu = float((form.get(f"pu_{i}") or "0").replace(",", "."))
        except ValueError:
            abort(400, f"Quantité/prix invalide sur la ligne {i + 1}")
        lignes.append({"désignation": designation, "quantite": quantite,
                       "prix_unitaire_ht": pu})

    if not lignes:
        abort(400, "Au moins une ligne de prestation est requise")

    conn = open_db(active_db())
    profile = get_user_profile(conn) or {}
    en_franchise = profile.get("fiscal_profile") == "auto-entrepreneur"

    facture = creer_facture_emise(
        conn, profile,
        {
            "client_nom": client_nom,
            "client_adresse": (form.get("client_adresse") or "").strip(),
            "date_emission": (form.get("date_emission") or "").strip() or None,
            "date_prestation": (form.get("date_prestation") or "").strip() or None,
            "lignes": lignes,
            "mode_paiement": (form.get("mode_paiement") or "").strip() or None,
            "conditions": (form.get("conditions") or "").strip() or None,
        },
        active_paths()["output"] / "factures-emises",
        en_franchise=en_franchise,
    )
    conn.close()
    return redirect(url_for("index"))

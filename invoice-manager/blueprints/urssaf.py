"""
blueprints/urssaf.py — Agenda des déclarations URSSAF (auto-entrepreneur).

Bounded context « Déclarations sociales » : routes de consultation et de
transition d'état (marquer une période déclarée / annuler). Les calculs
métier (CA encaissé, cotisations) sont délégués à `services/urssaf.py` et
`queries.query_ca_encaisse` — ce blueprint reste fin.
"""
from datetime import datetime

from flask import Blueprint, jsonify, redirect, render_template, request, url_for

from context_helpers import active_db
from db import get_user_profile, open_db
from queries import query_ca_encaisse
from services.urssaf import (
    CADENCE_MENSUELLE,
    CADENCE_TRIMESTRIELLE,
    STATUT_PERIODE_A_DECLARER,
    STATUT_PERIODE_DECLAREE,
    compute_cotisations,
    generate_periods,
    get_declared_periods,
    mark_period_declared,
    unmark_period_declared,
)

bp_urssaf = Blueprint("urssaf", __name__)


def _resolve_cadence(profile: dict) -> str:
    """Retourne la cadence URSSAF du profil, mensuelle par défaut.

    Le champ `cadence` du profil peut contenir une cadence non-URSSAF
    (TVA, IS) selon le statut fiscal. Pour l'agenda URSSAF on retombe
    sur mensuelle si la valeur n'est pas reconnue, conformément au
    défaut AUTO_ENTREPRENEUR_RULES.md §4.2.
    """
    raw = (profile.get("cadence") or "").strip().lower()
    if raw in (CADENCE_MENSUELLE, CADENCE_TRIMESTRIELLE):
        return raw
    return CADENCE_MENSUELLE


@bp_urssaf.route("/urssaf/agenda")
def urssaf_agenda():
    """GET /urssaf/agenda?year=YYYY — Liste des périodes URSSAF avec CA encaissé,
    cotisations calculées et statut (à_déclarer / déclarée)."""
    year = request.args.get("year", datetime.now().year, type=int)
    conn = open_db(active_db())
    profile = get_user_profile(conn) or {}
    cadence = _resolve_cadence(profile)
    activite = (profile.get("activite_principale") or "").strip() or None

    declared = get_declared_periods(conn)
    periods = generate_periods(year, cadence)

    rows = []
    for p in periods:
        ca = query_ca_encaisse(conn, p["start"], p["end"])
        # Tant que l'activité n'est pas renseignée, on n'affiche que le CA brut.
        # Les calculs cotisations sont activés dès que `activite_principale`
        # est saisie en paramètres (cf. #137 / #138).
        cotisations = (
            compute_cotisations(ca["ca_ttc"], activite) if activite else None
        )
        rows.append({
            **p,
            "ca_ttc": ca["ca_ttc"],
            "count": ca["count"],
            "cotisations": cotisations,
            "statut": (
                STATUT_PERIODE_DECLAREE if p["period_key"] in declared
                else STATUT_PERIODE_A_DECLARER
            ),
            "marked_at": declared.get(p["period_key"]),
        })
    conn.close()

    return render_template(
        "urssaf_agenda.html",
        year=year, cadence=cadence, activite=activite, rows=rows,
        statut_declaree=STATUT_PERIODE_DECLAREE,
    )


@bp_urssaf.route("/urssaf/declarations/<period_key>/marquer-declaree", methods=["POST"])
def urssaf_marquer_declaree(period_key: str):
    """Transition d'état : marque la période comme déclarée."""
    conn = open_db(active_db())
    mark_period_declared(conn, period_key)
    conn.close()
    return redirect(url_for("urssaf.urssaf_agenda", year=request.form.get("year")))


@bp_urssaf.route("/urssaf/declarations/<period_key>/annuler", methods=["POST"])
def urssaf_annuler_declaration(period_key: str):
    """Annule la déclaration d'une période (correction d'erreur)."""
    conn = open_db(active_db())
    unmark_period_declared(conn, period_key)
    conn.close()
    return redirect(url_for("urssaf.urssaf_agenda", year=request.form.get("year")))

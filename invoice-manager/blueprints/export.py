"""
blueprints/export.py — Téléchargement du ledger depuis le dashboard.

Routes GET en lecture seule : exposent les artefacts produits par `export.py`
(XLSX 4 feuilles + CSV) en flux mémoire, sans écriture disque côté serveur.
Aligne l'UI sur le critère de succès de VISION : « obtenir un ledger-YYYY.xlsx
sans retomber sur le CLI ».
"""
from flask import Blueprint, Response, abort

from config import CADENCE_DEFAULTS
from context_helpers import active_db, get_profile
from db import open_db
from export import csv_text, fetch_rows, xlsx_bytes

bp_export = Blueprint("export", __name__)

YEAR_MIN = 2000
YEAR_MAX = 2100


def _resolve_export_context(year_str: str):
    """Valide l'année, charge profil/cadence/statut, retourne les rows.

    Retourne (rows, year, statut, cadence) ou lève abort(400/404).
    """
    try:
        year = int(year_str)
    except (TypeError, ValueError):
        abort(400, description="Année invalide")
    if year < YEAR_MIN or year > YEAR_MAX:
        abort(400, description="Année hors plage")

    profile = get_profile()
    if profile is None:
        abort(404, description="Profil non configuré")

    statut = profile.get("fiscal_profile")
    cadence = profile.get("cadence") or CADENCE_DEFAULTS.get(statut, "trimestrielle")

    conn = open_db(active_db())
    rows = fetch_rows(conn, year, statut)
    conn.close()
    return rows, year, statut, cadence


@bp_export.route("/export/ledger.xlsx")
def export_ledger_xlsx():
    """GET /export/ledger.xlsx?year=YYYY — Télécharge le ledger XLSX 4 feuilles."""
    from flask import request
    year_str = request.args.get("year", "")
    rows, year, statut, cadence = _resolve_export_context(year_str)
    payload = xlsx_bytes(rows, year, statut, cadence)
    return Response(
        payload,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="ledger-{year}.xlsx"'},
    )


@bp_export.route("/export/ledger.csv")
def export_ledger_csv():
    """GET /export/ledger.csv?year=YYYY — Télécharge le ledger CSV (feuille Journal)."""
    from flask import request
    year_str = request.args.get("year", "")
    rows, year, _statut, _cadence = _resolve_export_context(year_str)
    return Response(
        csv_text(rows),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="ledger-{year}.csv"'},
    )

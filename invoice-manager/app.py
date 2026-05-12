"""
app.py — Application factory Flask.

Construit l'application en agrégeant les blueprints du domaine (factures, profils,
parametres, pipeline) et expose la vue tableau de bord (route racine).
"""
import os
import sqlite3
from datetime import datetime
from pathlib import Path

from flask import (
    Flask, Response, redirect, render_template, request, session, url_for,
)

from constants import EXPENSE_TYPES, INCOME_TYPES
from context_helpers import active_db, active_paths, get_profile
from db import get_user_profile, open_db
from profiles import get_profile_meta, load_profiles
from queries import (
    query_corbeille, query_error_files, query_fiscal_summary,
    query_health, query_items_a_reviser, query_ledger,
)
from services.montants import derive_amounts

HERE = Path(__file__).resolve().parent

_PROFILE_EXEMPT = {
    "static",
    "favicon",
    "profils.profils_liste",
    "profils.profils_creer",
    "profils.profils_activer",
    "profils.configuration",
    "pipeline.pipeline_depot",
}


def _fr_currency(value) -> str:
    """Formate un float en monnaie française : 1 234,56 €. Négatif → (1 234,56 €)."""
    if value is None:
        value = 0.0
    neg = value < 0
    formatted = f"{abs(value):,.2f}"
    formatted = formatted.replace(",", "X").replace(".", ",").replace("X", " ")
    formatted += " €"
    return f"({formatted})" if neg else formatted


def _truncate_filename(name: str, max_stem: int = 16) -> str:
    p = Path(name)
    stem, suffix = p.stem, p.suffix
    if len(stem) > max_stem:
        stem = stem[:max_stem] + "…"
    return stem + suffix


def create_app() -> Flask:
    app = Flask(__name__, template_folder=str(HERE / "templates"))
    app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(24)
    app.jinja_env.filters["fr_currency"] = _fr_currency
    app.jinja_env.filters["basename"] = lambda p: os.path.basename(p) if p else ""
    app.jinja_env.filters["truncate_filename"] = _truncate_filename
    app.jinja_env.globals["derive_amounts"] = derive_amounts

    from blueprints.factures import bp_factures
    from blueprints.parametres import bp_parametres
    from blueprints.pipeline import bp_pipeline
    from blueprints.profils import bp_profils
    app.register_blueprint(bp_factures)
    app.register_blueprint(bp_parametres)
    app.register_blueprint(bp_pipeline)
    app.register_blueprint(bp_profils)

    @app.context_processor
    def inject_profile_context():
        return {
            "all_profiles": load_profiles(),
            "active_slug": session.get("active_profile"),
        }

    @app.before_request
    def require_setup():
        if request.endpoint in _PROFILE_EXEMPT:
            return
        profiles = load_profiles()
        if not profiles:
            return redirect(url_for("profils.profils_liste"))
        slug = session.get("active_profile")
        if not slug or not get_profile_meta(slug):
            session["active_profile"] = profiles[0]["slug"]
        if get_profile() is None:
            return redirect(url_for("profils.configuration"))

    @app.route("/favicon.ico")
    def favicon():
        return Response(status=204)

    @app.route("/fragments/synthese-fiscale")
    def fragment_synthese_fiscale():
        """GET /fragments/synthese-fiscale?year=YYYY — Cartes CA / TVA / résultat (HTML partiel).
        Vit ici (et non dans pipeline.py) car c'est une vue du tableau de bord :
        l'Ingestion n'a pas à connaître la synthèse fiscale."""
        year = request.args.get("year", datetime.now().year, type=int)
        conn = open_db(active_db())
        summary = query_fiscal_summary(conn, year)
        conn.close()
        return render_template("fragments/synthese_fiscale.html",
                               summary=summary, year=year)

    @app.route("/fragments/sante")
    def fragment_sante():
        """GET /fragments/sante?year=YYYY — Carte santé du workspace (HTML partiel)."""
        year = request.args.get("year", datetime.now().year, type=int)
        paths = active_paths()
        conn = open_db(paths["db"])
        health = query_health(conn, paths)
        conn.close()
        return render_template("fragments/sante.html", health=health, year=year)

    @app.route("/")
    def index():
        year = request.args.get("year", datetime.now().year, type=int)
        page = request.args.get("page", 1, type=int)
        run_error = request.args.get("run_error")
        review_error = request.args.get("review_error")
        try:
            paths = active_paths()
            conn = open_db(active_db())
            summary = query_fiscal_summary(conn, year)
            ledger = query_ledger(conn, year, page=page)
            health = query_health(conn, paths)
            items_a_reviser_list = query_items_a_reviser(conn, year)
            corbeille_list = query_corbeille(conn, year)
            errors_list = query_error_files(paths)
            years = [r[0] for r in conn.execute(
                "SELECT DISTINCT exercice_fiscal FROM invoices ORDER BY exercice_fiscal DESC"
            ).fetchall()] or [datetime.now().year]
            profile = get_user_profile(conn) or {}
            conn.close()
        except sqlite3.DatabaseError as exc:
            return render_template("error.html", message=str(exc), hint="python run.py"), 500

        profile_incomplete = not (profile.get("nom") and profile.get("tva_intracom"))

        return render_template(
            "dashboard.html",
            year=year,
            years=years,
            summary=summary,
            ledger=ledger,
            health=health,
            items_a_reviser_list=items_a_reviser_list,
            corbeille_list=corbeille_list,
            errors_list=errors_list,
            run_error=run_error,
            review_error=review_error,
            expense_types=EXPENSE_TYPES,
            doc_types=INCOME_TYPES + EXPENSE_TYPES + ("avoir", "devis"),
            profile=profile,
            profile_incomplete=profile_incomplete,
        )

    return app

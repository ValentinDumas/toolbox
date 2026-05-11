"""
blueprints/profils.py — Contexte identité : gestion des profils + assistant de configuration.

Routes RESTful : /profils pour le CRUD de profils, /configuration pour l'onboarding.
"""
from flask import (
    Blueprint, redirect, render_template, request, session, url_for,
)

from constants import FISCAL_RULES
from context_helpers import active_db
from db import open_db
from profiles import create_profile, get_profile_meta, load_profiles

bp_profils = Blueprint("profils", __name__)


@bp_profils.route("/profils")
def profils_liste():
    """GET /profils — Liste les profils ou affiche la page de bienvenue si aucun."""
    profiles = load_profiles()
    if profiles:
        if not session.get("active_profile"):
            session["active_profile"] = profiles[0]["slug"]
        return redirect(url_for("index"))
    return render_template("profils/premiere_page.html")


@bp_profils.route("/profils", methods=["POST"])
def profils_creer():
    """POST /profils — Crée un nouveau profil."""
    name = request.form.get("name", "").strip()
    if not name:
        return redirect(url_for("profils.profils_liste"))
    entry = create_profile(name)
    session["active_profile"] = entry["slug"]
    return redirect(url_for("profils.configuration"))


@bp_profils.route("/profils/<slug>/activer", methods=["POST"])
def profils_activer(slug):
    """POST /profils/<slug>/activer — Active un profil existant."""
    if get_profile_meta(slug):
        session["active_profile"] = slug
    return redirect(url_for("index"))


@bp_profils.route("/configuration", methods=["GET", "POST"])
def configuration():
    """GET/POST /configuration — Assistant de configuration multi-étapes (SIREN, profil fiscal)."""
    conn = open_db(active_db())
    error = None
    step = request.args.get("step", "siren")

    if request.method == "POST":
        step = request.form.get("step", "siren")
        if step == "siren":
            siren = request.form.get("siren", "").strip().replace(" ", "")
            if not siren or not siren.isdigit() or len(siren) != 9:
                error = "SIREN invalide — 9 chiffres requis."
            else:
                conn.execute(
                    "INSERT INTO user_profile (id, siren) VALUES (1, ?) "
                    "ON CONFLICT(id) DO UPDATE SET siren=excluded.siren",
                    (siren,),
                )
                conn.commit()
                conn.close()
                return redirect(url_for("profils.configuration", step="fiscal"))
        elif step == "fiscal":
            fiscal = request.form.get("fiscal_profile", "").strip()
            if fiscal not in FISCAL_RULES:
                error = "Profil fiscal invalide."
            else:
                conn.execute(
                    "INSERT INTO user_profile (id, fiscal_profile, setup_complete) VALUES (1, ?, 1) "
                    "ON CONFLICT(id) DO UPDATE SET fiscal_profile=excluded.fiscal_profile, setup_complete=1",
                    (fiscal,),
                )
                conn.commit()
                conn.close()
                return redirect(url_for("index"))

    existing = conn.execute("SELECT * FROM user_profile WHERE id=1").fetchone()
    conn.close()
    return render_template("setup.html", step=step, error=error, existing=existing)

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
import re

from profiles import create_profile, get_profile_meta, load_profiles

bp_profils = Blueprint("profils", __name__)

# Bornes du nom d'entité légale : assez pour des raisons sociales longues,
# sans permettre d'inputs abusifs.
NOM_ENTITE_MIN = 1
NOM_ENTITE_MAX = 80


def _valider_nom_entite(raw: str) -> tuple[str | None, str | None]:
    """ACL : convertit un nom HTTP brut en nom domaine validé.

    Retourne (nom, erreur) — exactement un des deux est None.
    """
    if raw is None:
        return None, "Le nom de l'entité est obligatoire."
    name = raw.strip()
    if not name:
        return None, "Le nom de l'entité est obligatoire."
    if len(name) > NOM_ENTITE_MAX:
        return None, f"Le nom ne doit pas dépasser {NOM_ENTITE_MAX} caractères."
    # Caractères de contrôle (y compris \n, \r, \t, \0…) — refusés.
    if any(ord(c) < 32 or ord(c) == 127 for c in name):
        return None, "Le nom contient des caractères non imprimables."
    # Séparateurs de chemin et traversée — refusés pour préserver le sandbox profil.
    if "/" in name or "\\" in name or ".." in name:
        return None, "Le nom ne peut pas contenir / \\ ou .."
    # Le slugify de profiles.py retombe sur "profil" par défaut ; on veut
    # s'assurer qu'on a au moins un caractère alphanumérique dans le nom brut.
    if not re.search(r"[A-Za-zÀ-ÖØ-öø-ÿ0-9]", name):
        return None, "Le nom doit contenir au moins une lettre ou un chiffre."
    return name, None


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
    """POST /profils — Crée un nouveau profil et persiste le nom d'entité."""
    name, error = _valider_nom_entite(request.form.get("name", ""))
    if error:
        # Re-render plutôt que redirect : un redirect vers /profils
        # rebondit en boucle quand aucun profil n'existe encore (#93).
        return render_template("profils/premiere_page.html", error=error), 200
    entry = create_profile(name)
    session["active_profile"] = entry["slug"]
    # `create_profile` peuple déjà `user_profile.nom` + `created_at` dans la DB
    # du profil. Plus besoin de double-écriture ici.
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

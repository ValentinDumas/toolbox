"""
blueprints/notifications.py — Bannières saisonnières et rappels.

Pour l'instant : bannière CFE (#139). À étendre avec les autres bannières
(plafonds CA, franchise TVA) une fois qu'elles auront leur propre
politique de dismiss.
"""
from datetime import date

from flask import Blueprint, redirect, request, url_for

from context_helpers import active_db
from db import open_db

bp_notifications = Blueprint("notifications", __name__)


@bp_notifications.route("/notifications/cfe/dismiss", methods=["POST"])
def cfe_dismiss():
    """Masque la bannière CFE pour l'année courante (#139).

    Le masquage est par-année : la bannière réapparaît automatiquement
    en novembre de l'année suivante (ce n'est pas un opt-out permanent).
    """
    year = date.today().year
    conn = open_db(active_db())
    conn.execute(
        "UPDATE user_profile SET cfe_dismissed_year = ? WHERE id = 1", (year,),
    )
    conn.commit()
    conn.close()
    return redirect(request.referrer or url_for("index"))

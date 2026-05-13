"""
services/cfe.py — Rappel saisonnier CFE (Cotisation Foncière des Entreprises).

La CFE n'est pas calculée automatiquement (montant communal, dépendant de
la base locative). Le logiciel se contente de **rappeler** à l'utilisateur
de consulter son avis et de payer avant l'échéance — cf.
AUTO_ENTREPRENEUR_RULES.md §6.
"""
from __future__ import annotations

from datetime import date

# Période d'affichage : du 1er novembre au 31 décembre inclus.
# L'avis CFE est mis en ligne mi-novembre, échéance officielle 15 décembre.
CFE_AFFICHAGE_MOIS_DEBUT = 11
CFE_AFFICHAGE_MOIS_FIN   = 12


def should_show_cfe_banner(profile: dict, today: date | None = None) -> bool:
    """Décide si la bannière CFE doit s'afficher aujourd'hui pour ce profil.

    Règles :
    - on est en novembre ou décembre,
    - la bannière n'a pas été masquée pour l'année courante.

    `today` est paramétrable pour faciliter les tests BDD. En production,
    appeler sans argument → utilise la date du jour.
    """
    today = today or date.today()
    if not (CFE_AFFICHAGE_MOIS_DEBUT <= today.month <= CFE_AFFICHAGE_MOIS_FIN):
        return False
    dismissed_year = profile.get("cfe_dismissed_year")
    return dismissed_year != today.year

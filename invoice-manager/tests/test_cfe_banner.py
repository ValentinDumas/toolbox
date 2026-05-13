"""Tests BDD du rappel saisonnier CFE (#139).

Couvre AUTO_ENTREPRENEUR_RULES.md §6 : la CFE doit être rappelée à
l'utilisateur entre novembre et décembre, dismissable par année.
"""
import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.cfe import should_show_cfe_banner


def test_banniere_visible_en_novembre():
    # Given un profil sans dismiss et une visite le 5 novembre 2026
    profile = {"cfe_dismissed_year": None}

    # When on évalue l'affichage
    # Then la bannière s'affiche
    assert should_show_cfe_banner(profile, today=date(2026, 11, 5)) is True


def test_banniere_visible_en_decembre():
    profile = {"cfe_dismissed_year": None}
    assert should_show_cfe_banner(profile, today=date(2026, 12, 14)) is True


def test_banniere_invisible_avant_novembre():
    """Pas de bruit avant l'ouverture de la campagne — l'avis CFE n'est
    pas encore disponible sur impots.gouv.fr."""
    profile = {"cfe_dismissed_year": None}
    assert should_show_cfe_banner(profile, today=date(2026, 10, 31)) is False


def test_banniere_invisible_apres_decembre():
    """Après le 31/12 la déclaration est soit faite soit en retard — le
    rappel n'a plus de valeur ajoutée et serait du bruit."""
    profile = {"cfe_dismissed_year": None}
    assert should_show_cfe_banner(profile, today=date(2027, 1, 2)) is False


def test_dismiss_de_l_annee_courante_masque_la_banniere():
    # Given un profil qui a masqué la bannière pour 2026
    profile = {"cfe_dismissed_year": 2026}

    # When on visite le dashboard en novembre 2026
    # Then la bannière n'apparaît pas
    assert should_show_cfe_banner(profile, today=date(2026, 11, 5)) is False


def test_dismiss_d_une_annee_anterieure_n_affecte_pas_l_annee_courante():
    """Le dismiss est par-année. Avoir masqué la bannière en 2025 ne
    doit pas la cacher en 2026 — c'est une obligation annuelle."""
    profile = {"cfe_dismissed_year": 2025}
    assert should_show_cfe_banner(profile, today=date(2026, 11, 5)) is True

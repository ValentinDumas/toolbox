"""Tests BDD du flag ACRE temporel (#138).

Couvre AUTO_ENTREPRENEUR_RULES.md §4.3 :
- ACRE actif jusqu'à `acre_date_fin` : taux divisés (facteur 0,5 ou 0,75)
- au-delà de date_fin : taux normaux
- ACRE inactif : taux normaux
- facteur 0,5 si création avant 01/07/2026, 0,75 sinon
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.urssaf import acre_factor_for


def test_acre_inactif_renvoie_taux_normal():
    # Given un profil sans ACRE
    profile = {"acre_actif": 0, "acre_date_fin": None}
    # Then facteur 1.0 quelle que soit la période
    assert acre_factor_for(profile, "2026-03-31") == 1.0


def test_acre_actif_avant_juillet_2026_renvoie_0_5():
    """ACRE qui se termine au 30/06/2027 → création au 30/06/2026 → factor 0,5."""
    # Given un profil ACRE actif jusqu'au 30 juin 2027
    profile = {"acre_actif": 1, "acre_date_fin": "2027-06-30"}
    # When on évalue une période de mars 2026 (dans la fenêtre)
    # Then facteur 0.5 (exonération 50 %)
    assert acre_factor_for(profile, "2026-03-31") == 0.5


def test_acre_actif_apres_juillet_2026_renvoie_0_75():
    """Création au 01/07/2026 → date_fin 30/06/2027 + 1 jour. Test avec
    une date_fin clairement après le 30/06/2027 (creation après le palier)."""
    # Given un profil ACRE actif jusqu'au 31/12/2027 (création vers janvier 2027)
    profile = {"acre_actif": 1, "acre_date_fin": "2027-12-31"}
    # When on évalue une période d'avril 2027
    # Then facteur 0.75 (exonération 25 %, réforme post-01/07/2026)
    assert acre_factor_for(profile, "2027-04-30") == 0.75


def test_periode_apres_acre_date_fin_renvoie_taux_normal():
    """ACRE expire le 30/06/2027 → mars 2028 = taux normaux."""
    profile = {"acre_actif": 1, "acre_date_fin": "2027-06-30"}
    assert acre_factor_for(profile, "2028-03-31") == 1.0


def test_acre_actif_sans_date_fin_renvoie_taux_normal():
    """Si l'utilisateur coche ACRE mais ne saisit pas la date de fin, on ne
    peut pas appliquer l'allègement sans risque — taux normal par sécurité."""
    profile = {"acre_actif": 1, "acre_date_fin": None}
    assert acre_factor_for(profile, "2026-03-31") == 1.0


def test_dates_corrompues_renvoient_taux_normal():
    """Robustesse ACL : une date_fin mal saisie ne doit pas faire planter
    l'agenda. Taux normal par défaut, l'erreur de saisie est signalée
    ailleurs (parametres)."""
    profile = {"acre_actif": 1, "acre_date_fin": "pas-une-date"}
    assert acre_factor_for(profile, "2026-03-31") == 1.0

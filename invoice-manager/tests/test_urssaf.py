"""Tests BDD du calcul des cotisations URSSAF auto-entrepreneur (#132).

Couvre AUTO_ENTREPRENEUR_RULES.md §4.1 (taux 2026 par activité) et §4.3
(allègement ACRE sur les cotisations sociales, pas sur la CFP).
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.urssaf import compute_cotisations


@pytest.mark.parametrize("activite, taux_cot, taux_cfp", [
    ("vente",                  0.123, 0.001),
    ("service_bic",            0.212, 0.003),
    ("service_bnc_ssi",        0.256, 0.002),
    ("service_bnc_cipav",      0.232, 0.002),
    ("meuble_tourisme_classe", 0.060, 0.001),
])
def test_cotisations_pour_chaque_activite_appliquent_le_taux_2026(activite, taux_cot, taux_cfp):
    """Chaque ligne du tableau §4.1 est une règle métier indépendante.
    Le paramétrage `@parametrize` est la version Python d'une table d'exemples
    Gherkin (BDD §7)."""
    # Given un AE qui a encaissé 10 000 € sur la période
    ca = 10_000.0

    # When on calcule les cotisations
    result = compute_cotisations(ca, activite)

    # Then les montants reflètent les taux 2026 de l'activité
    assert result["cotisations_sociales"] == round(ca * taux_cot, 2)
    assert result["cfp"] == round(ca * taux_cfp, 2)
    assert result["total"] == round(result["cotisations_sociales"] + result["cfp"], 2)
    assert result["taux_cotisations_applique"] == taux_cot
    assert result["taux_cfp_applique"] == taux_cfp


def test_ca_nul_produit_des_cotisations_nulles():
    """§4.4 : un AE doit déclarer même si le CA = 0 € — la fonction doit
    retourner 0 € sans erreur (et non lever, ni omettre la ligne)."""
    result = compute_cotisations(0.0, "service_bic")
    assert result["cotisations_sociales"] == 0.0
    assert result["cfp"] == 0.0
    assert result["total"] == 0.0


def test_acre_divise_par_deux_les_cotisations_sociales_avant_juillet_2026():
    """§4.3 : création avant le 1er juillet 2026 → exonération 50 %.
    Côté logiciel, l'appelant passe acre_factor=0.5 pendant les 12 premiers
    mois (cf. #138 qui décidera de la date)."""
    # Given un AE en service BIC ayant encaissé 10 000 € sous ACRE 50 %
    # When on calcule les cotisations
    result = compute_cotisations(10_000.0, "service_bic", acre_factor=0.5)

    # Then le taux cotisations est divisé par 2 (21,2 % → 10,6 %)
    assert result["cotisations_sociales"] == 1060.0
    assert result["taux_cotisations_applique"] == pytest.approx(0.106)


def test_acre_reduit_de_25_pour_cent_apres_juillet_2026():
    """§4.3 : création à partir du 1er juillet 2026 → exonération 25 %
    (acre_factor = 0,75)."""
    result = compute_cotisations(10_000.0, "service_bic", acre_factor=0.75)
    assert result["cotisations_sociales"] == 1590.0
    assert result["taux_cotisations_applique"] == pytest.approx(0.159)


def test_acre_ne_reduit_pas_la_cfp():
    """L'allègement ACRE cible les cotisations sociales contributives ; la
    contribution formation professionnelle est due au taux plein, qu'on
    soit sous ACRE ou pas."""
    # Given un AE service BIC sous ACRE 50 %
    sans_acre = compute_cotisations(10_000.0, "service_bic")
    avec_acre = compute_cotisations(10_000.0, "service_bic", acre_factor=0.5)

    # Then la CFP est identique dans les deux cas
    assert avec_acre["cfp"] == sans_acre["cfp"]
    # mais les cotisations sociales sont divisées par 2
    assert avec_acre["cotisations_sociales"] == sans_acre["cotisations_sociales"] / 2


def test_activite_inconnue_leve_une_erreur_explicite():
    """ACL : la couche appelante doit valider l'activité contre
    `ACTIVITES_AE` avant d'invoquer le calcul. Un mauvais paramètre est
    une faute de programmation, pas un cas métier — KeyError est légitime."""
    with pytest.raises(KeyError):
        compute_cotisations(1000.0, "activite_inexistante")

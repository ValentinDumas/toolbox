"""Tests BDD — abattement forfaitaire IR de l'auto-entrepreneur (§3.1).

Le bénéfice imposable IR d'un AE sans VFL = CA encaissé moins l'abattement
forfaitaire fonction de l'activité. Le minimum forfaitaire de 305 €
plafonne l'abattement quand le CA est très faible.
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.urssaf import compute_beneficie_imposable


@pytest.mark.parametrize("activite, taux_attendu, abattement_attendu, benefice_attendu", [
    ("vente",                  0.71, 7100.00, 2900.00),
    ("service_bic",            0.50, 5000.00, 5000.00),
    ("service_bnc_ssi",        0.34, 3400.00, 6600.00),
    ("service_bnc_cipav",      0.34, 3400.00, 6600.00),
    ("meuble_tourisme_classe", 0.71, 7100.00, 2900.00),
])
def test_abattement_applique_le_taux_de_l_activite_sur_un_ca_standard(
    activite, taux_attendu, abattement_attendu, benefice_attendu,
):
    # Given un AE déclarant 10 000 € de CA encaissé pour une activité donnée
    ca = 10000.0

    # When on calcule le bénéfice imposable
    result = compute_beneficie_imposable(ca, activite)

    # Then le taux, l'abattement et le bénéfice correspondent au barème §3.1
    assert result["abattement_taux"] == taux_attendu
    assert result["abattement_montant"] == abattement_attendu
    assert result["beneficie_imposable"] == benefice_attendu


def test_ca_tres_bas_declenche_le_minimum_forfaitaire_de_305_euros():
    # Given un AE service BIC avec 500 € de CA (abattement théorique = 250 €)
    # Le min forfaitaire impose un bénéfice imposable d'au moins 305 €.
    ca = 500.0

    # When on calcule le bénéfice imposable
    result = compute_beneficie_imposable(ca, "service_bic")

    # Then l'abattement est plafonné à CA - 305 € = 195 € et le bénéfice = 305 €
    assert result["abattement_montant"] == 195.00
    assert result["beneficie_imposable"] == 305.00


def test_ca_nul_donne_abattement_nul_et_benefice_nul_sans_valeur_negative():
    # Given un AE sans encaissement sur la période
    ca = 0.0

    # When on calcule le bénéfice imposable
    result = compute_beneficie_imposable(ca, "service_bic")

    # Then aucun abattement n'est appliqué et le bénéfice reste à 0
    assert result["abattement_montant"] == 0.0
    assert result["beneficie_imposable"] == 0.0


def test_activite_inconnue_leve_key_error():
    # Given une activité inexistante au barème
    # When on appelle le calcul
    # Then une KeyError est levée — cohérent avec compute_cotisations
    with pytest.raises(KeyError):
        compute_beneficie_imposable(10000.0, "activite_bidon")

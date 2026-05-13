"""Tests BDD des seuils AE — plafonds micro (#135) + franchise TVA (#136).

Couvre AUTO_ENTREPRENEUR_RULES.md §2 (plafonds CA) et §5.2 (franchise TVA).
"""
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from services.seuils import (
    STATUT_PLAFOND_ALERTE,
    STATUT_PLAFOND_DEPASSEMENT,
    STATUT_PLAFOND_OK,
    STATUT_TVA_FRANCHISE_OK,
    STATUT_TVA_SEUIL_FRANCHI,
    STATUT_TVA_SEUIL_MAJORE_FRANCHI,
    STATUT_TVA_SORTIE_RECOMMANDEE,
    evaluer_franchise_tva,
    evaluer_plafond_ca,
)


# ── #135 — Plafonds micro-entreprise ──────────────────────────────────────────

def test_plafond_ok_quand_ca_inferieur_a_80_pourcent():
    # Given un AE service BIC à 60 000 € (72 % du plafond 83 600 €)
    result = evaluer_plafond_ca(ca_services=60_000.0, activite="service_bic")

    # Then statut OK
    assert result["statut"] == STATUT_PLAFOND_OK


def test_plafond_alerte_a_partir_de_80_pourcent():
    # Given un AE service BIC à 70 000 € (~84 % du plafond)
    result = evaluer_plafond_ca(ca_services=70_000.0, activite="service_bic")

    # Then statut alerte
    assert result["statut"] == STATUT_PLAFOND_ALERTE


def test_plafond_depassement_au_dela_de_100_pourcent():
    # Given un AE vente à 250 000 €
    result = evaluer_plafond_ca(ca_vente=250_000.0, activite="vente")

    # Then statut dépassement et plafond 203 100 € (2026) dans les détails
    assert result["statut"] == STATUT_PLAFOND_DEPASSEMENT
    assert result["details"][0]["plafond"] == 203_100.0


def test_activite_mixte_evalue_global_ET_sous_plafond_services():
    """§2 : activité mixte = plafond global vente (203 100 €) **dont** maximum
    83 600 € de services. Le statut retourné est le pire des deux."""
    # Given un AE mixte : 100 000 € vente + 80 000 € service (= 96 % du
    # sous-plafond services → alerte)
    result = evaluer_plafond_ca(
        ca_vente=100_000.0, ca_services=80_000.0, activite="mixte",
    )

    # Then statut alerte (déclenché par le sous-plafond services)
    assert result["statut"] == STATUT_PLAFOND_ALERTE
    libelles = [d["libellé"] for d in result["details"]]
    assert "sous-plafond services" in libelles


def test_mixte_depassement_du_sous_plafond_services_pris_en_compte():
    """Un AE peut respecter le plafond global mais dépasser le sous-plafond
    services — c'est un cas piège que §2 cible explicitement."""
    # Given 50 000 € vente + 90 000 € services (services > 83 600 €)
    result = evaluer_plafond_ca(
        ca_vente=50_000.0, ca_services=90_000.0, activite="mixte",
    )

    # Then dépassement (services dépassent leur sous-plafond)
    assert result["statut"] == STATUT_PLAFOND_DEPASSEMENT


# ── #136 — Franchise TVA ──────────────────────────────────────────────────────

def test_franchise_tva_ok_sous_le_seuil():
    historique = {2025: 30_000.0}
    result = evaluer_franchise_tva(historique, "service_bic")
    assert result["statut"] == STATUT_TVA_FRANCHISE_OK


def test_seuil_franchi_premiere_annee_renvoie_attention():
    """§5.2 : franchir le seuil simple une fois → avertissement. La franchise
    n'est pas perdue immédiatement, mais à surveiller."""
    # Given un AE service BIC à 38 000 € en 2025, sans antécédent
    historique = {2025: 38_000.0}
    result = evaluer_franchise_tva(historique, "service_bic")
    assert result["statut"] == STATUT_TVA_SEUIL_FRANCHI


def test_seuil_majore_franchi_renvoie_sortie_immediate():
    """§5.2 : franchir le seuil majoré (41 250 € services) → bascule TVA
    dès le mois du dépassement."""
    historique = {2025: 42_000.0}
    result = evaluer_franchise_tva(historique, "service_bic")
    assert result["statut"] == STATUT_TVA_SEUIL_MAJORE_FRANCHI


def test_deux_annees_consecutives_au_dessus_du_seuil_recommandent_sortie():
    """§5.2 : deux années consécutives > seuil simple → bascule au 1er janvier
    de l'année suivante."""
    historique = {2024: 38_000.0, 2025: 38_500.0}
    result = evaluer_franchise_tva(historique, "service_bic")
    assert result["statut"] == STATUT_TVA_SORTIE_RECOMMANDEE


def test_historique_vide_renvoie_ok():
    """Un AE en début d'activité n'a pas d'historique — c'est franchise OK
    par défaut, pas une erreur."""
    result = evaluer_franchise_tva({}, "service_bic")
    assert result["statut"] == STATUT_TVA_FRANCHISE_OK

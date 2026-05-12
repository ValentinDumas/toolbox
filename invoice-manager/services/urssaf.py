"""
services/urssaf.py — Calculs URSSAF auto-entrepreneur.

Service de domaine pur : pas de DB, pas de Flask. Convertit un CA encaissé
et une activité en cotisations sociales + CFP, conformément à
AUTO_ENTREPRENEUR_RULES.md §4.1 + §4.3.

Le module ne gère ni la persistance des déclarations (cf. #133) ni
l'export du récapitulatif (cf. #134) — uniquement les règles de calcul,
testables en isolation.
"""
from __future__ import annotations

from constants import TAUX_URSSAF_AE_2026


def compute_cotisations(
    ca: float,
    activite: str,
    *,
    acre_factor: float = 1.0,
) -> dict:
    """Calcule les cotisations URSSAF d'un auto-entrepreneur pour une période.

    Règle métier AUTO_ENTREPRENEUR_RULES.md §4.1 + §4.3 :
    - cotisations sociales = CA encaissé × taux activité
    - CFP                  = CA encaissé × taux CFP activité
    - ACRE                 = multiplie le taux cotisations sociales par
                             `acre_factor` (0,5 avant 01/07/2026, 0,75 après,
                             1,0 hors ACRE). Cf. §4.3.

    La CFP n'est **pas** réduite par l'ACRE — l'allègement vise les cotisations
    sociales contributives, pas la contribution formation professionnelle.

    Arguments :
        ca           : CA encaissé sur la période (≥ 0).
        activite     : clé de `TAUX_URSSAF_AE_2026` ("vente", "service_bic",
                       "service_bnc_ssi", "service_bnc_cipav",
                       "meuble_tourisme_classe").
        acre_factor  : multiplicateur du taux cotisations sociales (1.0 = hors
                       ACRE, 0.5 = exonération 50 %, 0.75 = exonération 25 %).

    Retour : {
        "cotisations_sociales": float,
        "cfp":                  float,
        "total":                float,
        "taux_cotisations_applique": float,
        "taux_cfp_applique":         float,
    }

    Lève KeyError si `activite` est inconnue — c'est intentionnel : le caller
    doit avoir validé la valeur depuis `ACTIVITES_AE` au préalable.
    """
    taux = TAUX_URSSAF_AE_2026[activite]
    taux_cot = taux["taux_cotisations"] * acre_factor
    taux_cfp = taux["taux_cfp"]

    cotisations = round(ca * taux_cot, 2)
    cfp = round(ca * taux_cfp, 2)

    return {
        "cotisations_sociales": cotisations,
        "cfp": cfp,
        "total": round(cotisations + cfp, 2),
        "taux_cotisations_applique": taux_cot,
        "taux_cfp_applique": taux_cfp,
    }

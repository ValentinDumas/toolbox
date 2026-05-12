"""services/profil.py — Règles dérivées du profil fiscal actif.

Pure domaine : pas de Flask, pas de DB. Utilisé par les templates pour
décider quels champs/colonnes afficher selon la raison sociale.
"""
from __future__ import annotations

from constants import FISCAL_RULES


def tva_visible_pour(profile: dict | None) -> bool:
    """Vrai si l'UI doit montrer les colonnes et inputs TVA pour ce profil.

    Règle actuelle : visible ssi le profil peut déduire la TVA
    (`FISCAL_RULES[fiscal_profile].tva_déductible`). En particulier
    l'auto-entrepreneur (franchise en base, art. 293 B CGI) et le salarié
    sont masqués.

    Porte de sortie : pour modéliser un AE assujetti à la TVA (option ou
    dépassement de seuil), on pourra ajouter un drapeau `franchise_tva`
    sur `user_profile` et le lire ici en priorité sur la table fiscale.
    """
    if not profile:
        return False
    rules = FISCAL_RULES.get(profile.get("fiscal_profile"), {})
    return rules.get("tva_déductible", False)

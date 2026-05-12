"""
services/montants.py — Dérivation des montants HT/TVA/TTC au moment du rendu.

Pure domaine : ne touche pas à la DB. La règle métier : l'extraction OCR
stocke uniquement les valeurs trouvées sur le document. Si un montant manque
mais peut être déduit des deux autres, on le calcule à l'affichage et on
marque explicitement qu'il s'agit d'un calcul logiciel — pas d'une extraction.
"""


def derive_amounts(ht, tva, ttc):
    """Retourne (ht, tva, ttc, derived).

    `derived` est un ensemble contenant les noms ('ht'|'tva'|'ttc') des
    champs CALCULÉS — par opposition à ceux extraits par l'OCR.
    Si aucune dérivation n'est possible (0 ou 1 valeur connue), les
    montants manquants restent à None.
    """
    derived: set[str] = set()
    if ht is None and tva is not None and ttc is not None:
        ht = ttc - tva
        derived.add("ht")
    elif tva is None and ht is not None and ttc is not None:
        tva = ttc - ht
        derived.add("tva")
    elif ttc is None and ht is not None and tva is not None:
        ttc = ht + tva
        derived.add("ttc")
    return ht, tva, ttc, derived

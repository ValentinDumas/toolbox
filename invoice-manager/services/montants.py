"""
services/montants.py — Recalcul HT / TVA / TTC et `taux_tva`.

Pure domaine : ne touche pas à la DB. Utilisé par l'extraction (`parsers.py`),
la sauvegarde (`services/revision.py`) et le rendu (templates Jinja).

Invariants comptables :
- L'arithmétique est : HT + TVA = TTC.
- `taux_tva` est une **fraction** (0..1, 4 décimales) ; jamais un pourcentage.
- Une valeur lue sur le document n'est jamais réécrite par calcul — on remplit
  seulement les trous, on signale les incohérences.
"""
from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from typing import NamedTuple

from constants import EMITTED_DOC_TYPES, FISCAL_RULES, LEGAL_RATES, RATE_SNAP_TOLERANCE

# Avertissements émis par `complete_amounts`. Les appelants traduisent en
# transitions métier (statut, message UI).
WARN_TVA_MISMATCH = "tva_mismatch"
WARN_RATE_UNUSUAL = "rate_unusual"

AMOUNT_TOLERANCE = Decimal("0.01")  # 1 centime — couvre les arrondis multi-lignes
_CENT = Decimal("0.01")
_RATE_QUANT = Decimal("0.0001")


class Amounts(NamedTuple):
    ht:   float | None
    tva:  float | None
    ttc:  float | None
    taux: float | None
    derived: frozenset[str]
    warnings: tuple[str, ...]


def complete_amounts(
    ht:   float | None,
    tva:  float | None,
    ttc:  float | None,
    taux: float | None = None,
    *,
    infer_amounts: bool = True,
    infer_from_rate: bool = False,
) -> Amounts:
    """Complète montants et taux à partir des valeurs connues.

    Trois modes selon l'appelant :

    | Appelant   | infer_amounts | infer_from_rate | Effet                       |
    |------------|---------------|-----------------|-----------------------------|
    | extraction | False         | False           | Strict — normalise le taux  |
    | rendu      | True          | False           | Complète 2-of-3 → 3e        |
    | édition    | True          | True            | + déduit depuis le taux     |

    Règles, appliquées dans l'ordre :
    1. Si `infer_amounts` et deux montants sur trois sont connus →
       le troisième est calculé.
    2. Si `infer_from_rate` et qu'un seul montant + le taux sont connus →
       les deux autres montants sont calculés.
    3. Si les trois montants sont connus et `|HT + TVA − TTC| > 0,01` →
       warning `tva_mismatch` ; les valeurs sont conservées telles quelles.
    4. Si le taux est inconnu mais HT et TVA sont connus → taux = TVA/HT,
       snappé sur le taux légal le plus proche si distance ≤ 0,002,
       sinon conservé brut avec warning `rate_unusual`.
    5. Montants arrondis à 2 décimales (ROUND_HALF_UP, arrondi commercial).
       Taux arrondi à 4 décimales.

    `derived` contient les noms ('ht'|'tva'|'ttc'|'taux') des champs calculés.
    """
    ht_d   = _to_decimal(ht)
    tva_d  = _to_decimal(tva)
    ttc_d  = _to_decimal(ttc)
    taux_d = _to_decimal(taux)
    derived: set[str] = set()
    warnings: list[str] = []

    if _all_known(ht_d, tva_d, ttc_d):
        if abs(ht_d + tva_d - ttc_d) > AMOUNT_TOLERANCE:
            warnings.append(WARN_TVA_MISMATCH)
    elif infer_amounts and _two_of_three_known(ht_d, tva_d, ttc_d):
        if ht_d is None:
            ht_d = ttc_d - tva_d
            derived.add("ht")
        elif tva_d is None:
            tva_d = ttc_d - ht_d
            derived.add("tva")
        else:
            ttc_d = ht_d + tva_d
            derived.add("ttc")
    elif infer_from_rate and taux_d is not None:
        if ht_d is not None and tva_d is None and ttc_d is None:
            tva_d = ht_d * taux_d
            ttc_d = ht_d + tva_d
            derived.update({"tva", "ttc"})
        elif ttc_d is not None and ht_d is None and tva_d is None:
            ht_d = ttc_d / (Decimal(1) + taux_d)
            tva_d = ttc_d - ht_d
            derived.update({"ht", "tva"})

    if taux_d is None and ht_d is not None and tva_d is not None and ht_d > 0:
        raw = tva_d / ht_d
        snapped, snapped_ok = _snap_to_legal_rate(raw)
        taux_d = snapped
        derived.add("taux")
        if not snapped_ok:
            warnings.append(WARN_RATE_UNUSUAL)

    return Amounts(
        ht=_round_amount(ht_d),
        tva=_round_amount(tva_d),
        ttc=_round_amount(ttc_d),
        taux=_round_rate(taux_d),
        derived=frozenset(derived),
        warnings=tuple(warnings),
    )


def normaliser_tva_selon_profil(
    fields: dict, type_document: str | None, profil_fiscal: str | None,
) -> None:
    """Neutralise la TVA sur une pièce **émise** par un profil sans TVA.

    Règle (art. 293 B CGI pour l'auto-entrepreneur, équivalent pour salarié) :
    un profil dont `tva_déductible == False` ne facture pas de TVA sur ses
    propres pièces. On force donc `taux_tva=None`, `montant_tva=0` et
    `montant_ttc=montant_ht` *avant* toute inférence arithmétique.

    Pièces **reçues** : non touchées — la TVA portée par le fournisseur est
    conservée telle quelle ; sa non-déductibilité est portée par le drapeau
    `déductible` au niveau de l'item, pas par ce normaliseur.

    Mutation in-place de `fields`.
    """
    if FISCAL_RULES.get(profil_fiscal, {}).get("tva_déductible", False):
        return
    if type_document not in EMITTED_DOC_TYPES:
        return
    fields["taux_tva"] = None
    fields["montant_tva"] = 0.0
    if fields.get("montant_ht") is not None:
        fields["montant_ttc"] = fields["montant_ht"]
    elif fields.get("montant_ttc") is not None:
        fields["montant_ht"] = fields["montant_ttc"]


def derive_amounts(ht, tva, ttc):
    """Façade historique pour le rendu — signature inchangée.

    `derived` est un ensemble ('ht'|'tva'|'ttc') des champs calculés.
    Le taux n'est pas pris en compte ici (le rendu n'infère pas depuis
    le taux ; il afficherait des valeurs absentes du document).
    """
    result = complete_amounts(ht, tva, ttc, taux=None, infer_from_rate=False)
    return (
        result.ht,
        result.tva,
        result.ttc,
        {d for d in result.derived if d in ("ht", "tva", "ttc")},
    )


# ── Helpers internes ──────────────────────────────────────────────────────────

def _to_decimal(value) -> Decimal | None:
    if value is None:
        return None
    return Decimal(str(value))


def _all_known(*values) -> bool:
    return all(v is not None for v in values)


def _two_of_three_known(ht, tva, ttc) -> bool:
    return sum(v is not None for v in (ht, tva, ttc)) == 2


def _snap_to_legal_rate(raw: Decimal) -> tuple[Decimal, bool]:
    """Retourne (taux, snappé_sur_un_taux_légal)."""
    tolerance = Decimal(str(RATE_SNAP_TOLERANCE))
    closest = min(LEGAL_RATES, key=lambda r: abs(raw - Decimal(str(r))))
    if abs(raw - Decimal(str(closest))) <= tolerance:
        return Decimal(str(closest)), True
    return raw, False


def _round_amount(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(_CENT, rounding=ROUND_HALF_UP))


def _round_rate(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value.quantize(_RATE_QUANT, rounding=ROUND_HALF_UP))

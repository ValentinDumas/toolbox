"""
services/comptabilite.py — Projection comptable (livre-journal) d'une pièce.

Service de domaine pur : pas de DB, pas de Flask. Convertit un `type_document`
en sens comptable (débit/crédit/off-ledger) et un montant en paire débit/crédit.

Convention PCG : charges au débit, produits au crédit. Les avoirs sont des
contre-passations (sens inversé).

Point d'extension : le jour où une table `ecritures` séparée sera introduite
(multi-lignes par pièce, OD, FEC complet), c'est ce module qui décidera comment
remplir les lignes — son API publique ne changera pas.
"""
from __future__ import annotations

from constants import (
    CONTRA_EXPENSE_TYPES,
    CONTRA_INCOME_TYPES,
    EMITTED_DOC_TYPES,
    EXPENSE_TYPES,
    INCOME_TYPES,
    OFF_LEDGER_TYPES,
)

SENS_DEBIT  = "débit"
SENS_CREDIT = "crédit"
SENS_NONE   = ""


def sens_comptable(type_document: str | None) -> str:
    """Retourne le sens comptable d'une pièce.

    `débit`   : charges (facture reçue, reçu, note de frais) + avoirs émis.
    `crédit`  : produits (facture émise) + avoirs reçus.
    `""`      : off-ledger (relevé bancaire, devis) ou type inconnu / None.
    """
    if type_document in EXPENSE_TYPES or type_document in CONTRA_INCOME_TYPES:
        return SENS_DEBIT
    if type_document in INCOME_TYPES or type_document in CONTRA_EXPENSE_TYPES:
        return SENS_CREDIT
    return SENS_NONE


def split_debit_credit(
    montant: float | None,
    sens: str,
) -> tuple[float | None, float | None]:
    """Sépare un montant en (débit, crédit) selon le sens.

    Cellule vide (None) si le montant est absent ou si la pièce est off-ledger,
    pour ne pas créer de zéros parasites dans l'export.
    """
    if montant is None or sens == SENS_NONE:
        return (None, None)
    if sens == SENS_DEBIT:
        return (montant, None)
    return (None, montant)


def to_journal_row(row: dict) -> dict:
    """Projette une ligne `invoices` vers une ligne de livre-journal.

    Conserve les champs descriptifs (date, n° pièce, émetteur…) et ajoute
    six champs débit/crédit (HT, TVA, TTC). Une pièce off-ledger renvoie None
    pour les six champs monétaires — l'appelant filtre.
    """
    sens = sens_comptable(row.get("type_document"))
    debit_ht,  credit_ht  = split_debit_credit(row.get("montant_ht"),  sens)
    debit_tva, credit_tva = split_debit_credit(row.get("montant_tva"), sens)
    debit_ttc, credit_ttc = split_debit_credit(row.get("montant_ttc"), sens)

    return {
        "date_document":  row.get("date_document"),
        "numéro_facture": row.get("numéro_facture"),
        "émetteur_nom":   row.get("émetteur_nom"),
        "émetteur_siren": row.get("émetteur_siren"),
        "type_document":  row.get("type_document"),
        "libellé":        row.get("description_prestation") or row.get("catégorie") or "",
        "débit_ht":       debit_ht,
        "crédit_ht":      credit_ht,
        "débit_tva":      debit_tva,
        "crédit_tva":     credit_tva,
        "débit_ttc":      debit_ttc,
        "crédit_ttc":     credit_ttc,
        "catégorie":      row.get("catégorie"),
        "statut_paiement": row.get("statut_paiement"),
        "fichier_source": row.get("fichier_source"),
        "sens":           sens,
    }


def is_off_ledger(type_document: str | None) -> bool:
    """Vrai si la pièce n'a pas sa place dans le livre-journal."""
    return type_document in OFF_LEDGER_TYPES or sens_comptable(type_document) == SENS_NONE


def date_encaissement(row: dict) -> str | None:
    """Date à laquelle l'argent est entré sur le compte du profil.

    Seules les pièces émises (facture_émise, avoir_émis) ont une date
    d'encaissement au sens AE : c'est la date à laquelle le client a payé,
    socle du calcul URSSAF (cf. AUTO_ENTREPRENEUR_RULES.md §4.2 + §8 + §9).

    Pour une pièce reçue, la date_paiement existe aussi mais désigne le
    règlement du fournisseur (sortie de trésorerie) — ce n'est pas un
    encaissement.
    """
    if row.get("type_document") not in EMITTED_DOC_TYPES:
        return None
    return row.get("date_paiement")

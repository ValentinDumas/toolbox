"""
constants.py — Constantes partagées entre les modules du projet.
"""

# ── Statuts de révision ───────────────────────────────────────────────────────

STATUT_A_REVISER = "à_réviser"
STATUT_VALIDE    = "validé"
STATUT_PRET      = "prêt_à_valider"

VALIDATED_STATUSES = (STATUT_VALIDE,)

# ── Types de documents ────────────────────────────────────────────────────────

INCOME_TYPES  = ("facture_émise",)
EXPENSE_TYPES = ("facture_reçue", "reçu", "note_de_frais")

# ── Mois français ─────────────────────────────────────────────────────────────

# Utilisé pour le parsing de dates en texte long ("15 janvier 2025")
MONTHS_FR_LONG = {
    "janvier": "01", "février": "02", "mars": "03", "avril": "04",
    "mai": "05", "juin": "06", "juillet": "07", "août": "08",
    "septembre": "09", "octobre": "10", "novembre": "11", "décembre": "12",
}

# Utilisé pour l'affichage court (export, stats)
MONTHS_FR_SHORT = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
                   "Juil", "Août", "Sep", "Oct", "Nov", "Déc"]

# ── Seuil de confiance ────────────────────────────────────────────────────────

CONFIDENCE_THRESHOLD = 0.8

# ── Encodage fichiers de révision ─────────────────────────────────────────────

REVIEW_ENCODING = "utf-8-sig"

# ── Règles fiscales par profil ────────────────────────────────────────────────

FISCAL_RULES = {
    "auto-entrepreneur": {"tva_déductible": False, "regime": "micro"},
    "SASU":              {"tva_déductible": True,  "regime": "réel"},
    "SARL":              {"tva_déductible": True,  "regime": "réel"},
    "salarié":           {"tva_déductible": False, "regime": "frais_pro"},
}

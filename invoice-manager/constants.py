"""
constants.py — Constantes partagées entre les modules du projet.
"""

# ── Statuts de révision ───────────────────────────────────────────────────────

STATUT_A_REVISER = "à_réviser"
STATUT_VALIDE    = "validé"

VALIDATED_STATUSES = (STATUT_VALIDE,)

# ── Statuts d'import (agrégat import_jobs) ───────────────────────────────────

IMPORT_EN_ATTENTE   = "en_attente"
IMPORT_EN_EXTRACTION = "en_extraction"
IMPORT_TERMINE      = "terminé"
IMPORT_ERREUR       = "erreur"
IMPORT_DOUBLON      = "doublon"

IMPORT_STATUTS_TERMINAUX = (IMPORT_TERMINE, IMPORT_ERREUR, IMPORT_DOUBLON)

# ── Types de documents ────────────────────────────────────────────────────────

INCOME_TYPES  = ("facture_émise",)
EXPENSE_TYPES = ("facture_reçue", "reçu", "note_de_frais")

# Contre-passations : un avoir reçu annule une charge (donc se lit au crédit),
# un avoir émis annule un produit (donc se lit au débit). Convention PCG.
CONTRA_INCOME_TYPES  = ("avoir_émis",)
CONTRA_EXPENSE_TYPES = ("avoir_reçu",)

# Pièces *émises* par l'utilisateur (donc soumises à ses propres règles de
# facturation TVA). Un auto-entrepreneur en franchise (art. 293 B CGI) ne
# peut pas facturer de TVA sur ces pièces.
EMITTED_DOC_TYPES = INCOME_TYPES + CONTRA_INCOME_TYPES

# Types présents dans la DB mais qui n'apparaissent pas au livre-journal.
OFF_LEDGER_TYPES = ("relevé_bancaire", "devis")

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

# ── Taux de TVA légaux (France) ───────────────────────────────────────────────
#
# Stockés en fractions (0..1) avec 4 décimales pour conserver sans perte les
# taux réduit et super-réduit (2,1 % et 5,5 %). Tout calcul interne utilise
# cette représentation ; seul l'export humain (XLSX, CSV de déclaration)
# multiplie par 100 pour l'affichage.
LEGAL_RATES = (0.0, 0.021, 0.055, 0.10, 0.20)

# Tolérance pour snapper un taux observé sur le taux légal le plus proche.
# 0.002 = 0.2 point de pourcentage — couvre les arrondis OCR et multi-lignes
# sans confondre 5,5 % et 7 %.
RATE_SNAP_TOLERANCE = 0.002

# Seuil légal des « tickets simplifiés » (art. 242 nonies A ann. II CGI).
# Au-dessus de 150 € TTC, la TVA doit être détaillée (taux + montant) sur la
# facture pour être déductible. Une facture validée au-dessus du seuil sans
# taux renseigné est donc fiscalement suspecte et retournée en « à réviser ».
SEUIL_TVA_SIMPLIFIEE_EUR = 150.0

# ── Encodage fichiers de révision ─────────────────────────────────────────────

REVIEW_ENCODING = "utf-8-sig"

# ── Règles fiscales par profil ────────────────────────────────────────────────

FISCAL_RULES = {
    "auto-entrepreneur": {"tva_déductible": False, "regime": "micro"},
    "SASU":              {"tva_déductible": True,  "regime": "réel"},
    "SARL":              {"tva_déductible": True,  "regime": "réel"},
    "salarié":           {"tva_déductible": False, "regime": "frais_pro"},
}

# ── Taux URSSAF auto-entrepreneur (en vigueur au 01/01/2026) ─────────────────
#
# Source : AUTO_ENTREPRENEUR_RULES.md §4.1. À revérifier chaque 1er janvier.
# Stockés en fractions (0..1). `taux_cotisations` couvre les cotisations
# sociales (maladie, retraite, CSG/CRDS) ; `taux_cfp` couvre la contribution
# à la formation professionnelle prélevée en même temps. Les contributions
# CCI / CMA (variables et minimes) ne sont pas modélisées ici.
TAUX_URSSAF_AE_2026 = {
    "vente":                  {"taux_cotisations": 0.123, "taux_cfp": 0.001},
    "service_bic":            {"taux_cotisations": 0.212, "taux_cfp": 0.003},
    "service_bnc_ssi":        {"taux_cotisations": 0.256, "taux_cfp": 0.002},
    "service_bnc_cipav":      {"taux_cotisations": 0.232, "taux_cfp": 0.002},
    "meuble_tourisme_classe": {"taux_cotisations": 0.060, "taux_cfp": 0.001},
}

ACTIVITES_AE = tuple(TAUX_URSSAF_AE_2026.keys())

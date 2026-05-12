"""
config.py — Constantes de configuration partagées.
"""

# Cadence de déclaration par défaut par statut fiscal.
# Vérifié 2026-05-05 — sources : URSSAF.fr / DGFiP / impots.gouv.fr
CADENCE_DEFAULTS: dict[str, str] = {
    "auto-entrepreneur": "trimestrielle",
    "SASU":              "mensuelle",
    "SARL":              "mensuelle",
    "salarié":           "annuelle",
}

# Cadences valides par statut fiscal. Le défaut (CADENCE_DEFAULTS) doit
# toujours appartenir à cette liste. Sources : régimes réel/simplifié CA3
# (mensuel/trimestriel selon CA), franchise en base (annuelle), micro-BIC
# (trimestrielle par défaut, mensuelle possible).
CADENCE_OPTIONS: dict[str, list[str]] = {
    "auto-entrepreneur": ["mensuelle", "trimestrielle"],
    "SASU":              ["mensuelle", "trimestrielle"],
    "SARL":              ["mensuelle", "trimestrielle"],
    "salarié":           ["annuelle"],
}

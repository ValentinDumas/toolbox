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

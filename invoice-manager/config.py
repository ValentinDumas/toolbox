"""
config.py — Chargement de configuration avec fallback sur les valeurs par défaut.

Priorité : CLI args > config.toml > DEFAULT_CONFIG
"""

import copy
import tomllib
from pathlib import Path

DEFAULT_CONFIG: dict = {
    "paths": {
        "input": "input/",
        "processed": "processed/",
        "errors": "errors/",
        "db": "data/invoices.db",
        "output": "output/",
        "review": "review/",
    },
}

# Cadence de déclaration par défaut par statut fiscal.
# Vérifié 2026-05-05 — sources : URSSAF.fr / DGFiP / impots.gouv.fr
CADENCE_DEFAULTS: dict[str, str] = {
    "auto-entrepreneur": "trimestrielle",
    "SASU":              "mensuelle",
    "SARL":              "mensuelle",
    "salarié":           "annuelle",
}


def _deep_merge(base: dict, override: dict) -> None:
    """Merge override into base in-place, recursively for nested dicts."""
    for key, value in override.items():
        if key in base and isinstance(base[key], dict) and isinstance(value, dict):
            _deep_merge(base[key], value)
        else:
            base[key] = value


def load_config(path: Path) -> dict:
    """
    Load TOML config from path, merged on top of DEFAULT_CONFIG.
    Falls back silently to defaults if file is missing, unreadable, or malformed.
    """
    cfg = copy.deepcopy(DEFAULT_CONFIG)
    try:
        with open(path, "rb") as f:
            _deep_merge(cfg, tomllib.load(f))
    except (FileNotFoundError, OSError, tomllib.TOMLDecodeError):
        pass
    return cfg

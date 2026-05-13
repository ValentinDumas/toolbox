"""
migrations/runner.py — Application séquentielle des migrations SQL versionnées.

Service pur (pas de Flask, pas de chemin DB en dur). Le caller fournit la
connexion ouverte et le dossier des migrations.
"""
from __future__ import annotations

import re
import sqlite3
from pathlib import Path

# `NNNN_libellé.sql` — au moins 4 chiffres, suivi d'un underscore et d'un
# slug libre. Le numéro est la version cible appliquée par la migration.
_FILENAME_RE = re.compile(r"^(\d{4,})_[^.]+\.sql$")


def _migration_files(migrations_dir: Path) -> list[tuple[int, Path]]:
    """Liste les migrations triées par version croissante.

    Ignore tout fichier ne matchant pas le pattern (README.md, .DS_Store…).
    Rejette explicitement deux fichiers déclarant le même numéro de version
    (signal d'une faute de frappe ou d'un conflit de branches).
    """
    found: dict[int, Path] = {}
    if not migrations_dir.is_dir():
        return []
    for f in sorted(migrations_dir.iterdir()):
        m = _FILENAME_RE.match(f.name)
        if not m:
            continue
        version = int(m.group(1))
        if version in found:
            raise ValueError(
                f"Migrations en double pour la version {version}: "
                f"{found[version].name} et {f.name}"
            )
        found[version] = f
    return sorted(found.items())


def apply_pending(
    conn: sqlite3.Connection, migrations_dir: Path,
) -> list[int]:
    """Applique toutes les migrations dont la version > PRAGMA user_version.

    Chaque migration s'exécute dans **sa propre transaction** :
    - réussite → COMMIT + bump `user_version` à la version appliquée
    - échec   → ROLLBACK, l'exception remonte, `user_version` inchangé

    Retourne la liste ordonnée des versions effectivement appliquées
    (vide si la DB est déjà à jour).
    """
    current = conn.execute("PRAGMA user_version").fetchone()[0]
    applied: list[int] = []
    for version, path in _migration_files(migrations_dir):
        if version <= current:
            continue
        sql = path.read_text(encoding="utf-8")
        # `executescript` commit implicitement avant de tourner — on ne peut
        # donc pas l'envelopper dans une transaction. À la place on exécute
        # statement par statement (split sur `;` final) sous un BEGIN explicite
        # pour préserver l'atomicité (DDL + bump user_version).
        statements = [s.strip() for s in sql.split(";") if s.strip()]
        try:
            conn.execute("BEGIN")
            for stmt in statements:
                conn.execute(stmt)
            conn.execute(f"PRAGMA user_version = {version}")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        applied.append(version)
    return applied

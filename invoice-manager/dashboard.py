"""
dashboard.py — Point d'entrée CLI du dashboard Flask.

Lance le serveur de développement Flask. La logique applicative se trouve dans
`app.py` (factory) et les blueprints du répertoire `blueprints/`.

Usage: python dashboard.py [--port PORT]
"""
import argparse
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

from app import create_app
from profiles import backfill_profile_names_from_registry, maybe_migrate_legacy


def main() -> None:
    parser = argparse.ArgumentParser(description="Dashboard local invoice-manager")
    parser.add_argument("--port", type=int, default=7800)
    args = parser.parse_args()

    migrated = maybe_migrate_legacy()
    if migrated:
        print(f"  [migration] data/invoices.db → profil '{migrated}'")

    # Issue #67 — profils créés avant b072529 ont user_profile.nom vide.
    # Rétablit le nom depuis le registre, sans jamais écraser un nom existant.
    backfilled = backfill_profile_names_from_registry()
    if backfilled:
        print(f"  [migration] nom d'entité restauré pour {len(backfilled)} profil(s) : "
              f"{', '.join(backfilled)}")

    app = create_app()
    print(f"  Dashboard : http://localhost:{args.port}")
    print("  Ctrl+C pour arrêter.")
    app.run(port=args.port, debug=os.getenv("FLASK_DEBUG", "0") == "1")


if __name__ == "__main__":
    main()

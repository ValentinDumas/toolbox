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
from profiles import maybe_migrate_legacy, migrate_legacy_profiles_json


def main() -> None:
    parser = argparse.ArgumentParser(description="Dashboard local invoice-manager")
    parser.add_argument("--port", type=int, default=7800)
    args = parser.parse_args()

    migrated = maybe_migrate_legacy()
    if migrated:
        print(f"  [migration] data/invoices.db → profil '{migrated}'")

    # Suppression du registre JSON `data/profiles.json` — son contenu est
    # reporté dans `user_profile.{nom, created_at}` de chaque DB.
    # Idempotent : no-op après le premier boot post-migration.
    backfilled = migrate_legacy_profiles_json()
    if backfilled:
        print(f"  [migration] data/profiles.json → user_profile pour "
              f"{len(backfilled)} profil(s) : {', '.join(backfilled)}")

    app = create_app()
    print(f"  Dashboard : http://localhost:{args.port}")
    print("  Ctrl+C pour arrêter.")
    app.run(port=args.port, debug=os.getenv("FLASK_DEBUG", "0") == "1")


if __name__ == "__main__":
    main()

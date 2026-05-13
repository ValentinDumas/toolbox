"""
init_workspace.py — Scaffold a new invoice workspace folder.
Usage: python3 init_workspace.py ~/Documents/compta-sasu
"""

import argparse
from pathlib import Path

HERE = Path(__file__).parent
SUBDIRS = ["input", "data", "output", "processed", "errors", "review"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Créer un nouveau dossier de travail")
    parser.add_argument("path", type=Path, help="Chemin du dossier à créer")
    args = parser.parse_args()

    target = args.path.expanduser().resolve()
    target.mkdir(parents=True, exist_ok=True)

    for d in SUBDIRS:
        (target / d).mkdir(exist_ok=True)

    run = HERE / "run.py"
    print(f"Dossier prêt : {target}")
    print(f"\nLance le dashboard pour finaliser la configuration via le wizard :")
    print(f"  python3 {HERE / 'dashboard.py'}")
    print(f"\nOu, en CLI :")
    print(f"  cd {target}")
    print(f"  python3 {run}")


if __name__ == "__main__":
    main()

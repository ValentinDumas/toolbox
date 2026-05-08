"""
init_workspace.py — Scaffold a new invoice workspace folder.
Usage: python3 init_workspace.py ~/Documents/compta-sasu
"""

import argparse
import platform
import shutil
import subprocess
import sys
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

    config = target / "config.toml"
    if not config.exists():
        shutil.copy(HERE / "config.toml.example", config)
        print(f"config.toml copié → {config}")
        _open(config)
    else:
        print(f"config.toml déjà présent — non écrasé")

    run = HERE / "run.py"
    print(f"\nDossier prêt : {target}")
    print(f"\nPour mettre à jour le ledger :")
    print(f"  cd {target}")
    print(f"  python3 {run}")


def _open(path: Path) -> None:
    if platform.system() == "Darwin":
        subprocess.run(["open", str(path)])
    elif platform.system() == "Windows":
        import os; os.startfile(str(path))
    else:
        import os
        subprocess.run([os.environ.get("EDITOR", "nano"), str(path)])


if __name__ == "__main__":
    main()

"""
run.py — Met à jour le ledger en une commande.
Usage: python run.py [--year YEAR] [--config FILE]
"""

import argparse
import hashlib
import platform
import sqlite3
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).parent

from config import load_config


def _dedup_input(input_dir: Path) -> int:
    groups: dict[str, list[Path]] = defaultdict(list)
    for f in input_dir.iterdir():
        if f.is_file():
            groups[hashlib.sha256(f.read_bytes()).hexdigest()].append(f)

    removed = 0
    for files in groups.values():
        if len(files) < 2:
            continue
        keep = min(files, key=lambda f: (len(f.name), f.stat().st_mtime))
        for f in files:
            if f != keep:
                f.unlink()
                print(f"  [DEDUP] {f.name} → doublon de {keep.name}, supprimé")
                removed += 1
    return removed


def _count_pending_review(db_path: Path) -> int:
    if not db_path.exists():
        return 0
    conn = sqlite3.connect(db_path)
    n = conn.execute(
        "SELECT COUNT(*) FROM invoices WHERE statut_révision = 'à_réviser'"
    ).fetchone()[0]
    conn.close()
    return n


def _open_file(path: Path) -> None:
    if platform.system() == "Darwin":
        subprocess.run(["open", str(path)])
    elif platform.system() == "Windows":
        import os; os.startfile(str(path))
    else:
        import os
        subprocess.run([os.environ.get("EDITOR", "nano"), str(path)])


def main() -> None:
    parser = argparse.ArgumentParser(description="Met à jour le ledger en une commande")
    parser.add_argument("--year", type=int, help="Année fiscale (défaut: année en cours)")
    parser.add_argument("--config", type=Path, default=Path("config.toml"))
    args = parser.parse_args()

    cfg = load_config(args.config)
    db_path = Path(cfg["paths"]["db"])
    review_dir = Path(cfg["paths"]["review"])
    review_csv = review_dir / "review.csv"

    py = sys.executable
    cfg_args = ["--config", str(args.config)]

    # 1. Déduplication inbox
    input_dir = Path(cfg["paths"]["input"])
    print("── Déduplication inbox ─────────────────────────")
    n_dedup = _dedup_input(input_dir)
    if n_dedup == 0:
        print("  Aucun doublon.")

    # 2. Extraction
    print("\n── Extraction ──────────────────────────────────")
    subprocess.run([py, str(HERE / "extract.py")] + cfg_args, check=True)

    # 3. Révision si nécessaire
    n = _count_pending_review(db_path)
    if n > 0:
        print(f"\n── Révision ({n} item{'s' if n > 1 else ''} à corriger) ──────────")
        subprocess.run([py, str(HERE / "review.py")] + cfg_args, check=True)
        print(f"\n  Fichier ouvert : {review_csv}")
        print("  Corrige, sauvegarde, puis appuie sur Entrée.")
        _open_file(review_csv)
        input("\n  [Entrée pour continuer…] ")
        subprocess.run([py, str(HERE / "review.py"), "--import"] + cfg_args, check=True)

    # 4. Export
    print("\n── Export ───────────────────────────────────────")
    export_args = [py, str(HERE / "export.py")] + cfg_args
    if args.year:
        export_args += ["--year", str(args.year)]
    subprocess.run(export_args, check=True)


if __name__ == "__main__":
    main()

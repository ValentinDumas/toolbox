"""
run.py — Met à jour le ledger en une commande.
Usage: python run.py --profile SLUG [--year YEAR]
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

from db import get_user_profile, open_db


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
    parser.add_argument("--profile", type=str, required=True, help="Slug du profil")
    parser.add_argument("--job-id", type=str, default=None,
                        help="ID d'un job d'import (transmis à extract.py)")
    args = parser.parse_args()

    from profiles import resolve_paths
    paths = resolve_paths(args.profile)
    db_path   = paths["db"]
    input_dir = paths["input"]
    profile_args = ["--profile", args.profile]

    conn = open_db(db_path)
    profile = get_user_profile(conn)
    conn.close()
    if profile is None:
        print("Profil non configuré. Lance le dashboard d'abord : python dashboard.py")
        sys.exit(1)

    py = sys.executable

    # 1. Déduplication inbox
    print("── Déduplication inbox ─────────────────────────")
    n_dedup = _dedup_input(input_dir)
    if n_dedup == 0:
        print("  Aucun doublon.")

    # 2. Extraction
    print("\n── Extraction ──────────────────────────────────")
    extract_args = [py, str(HERE / "extract.py")] + profile_args
    if args.job_id:
        extract_args += ["--job-id", args.job_id]
    subprocess.run(extract_args, check=True)

    # 3. Export
    print("\n── Export ───────────────────────────────────────")
    export_args = [py, str(HERE / "export.py")] + profile_args
    if args.year:
        export_args += ["--year", str(args.year)]
    subprocess.run(export_args, check=True)


if __name__ == "__main__":
    main()

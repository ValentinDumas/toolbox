"""
review.py — Révision batch des extractions incertaines
Usage:
  python review.py --profile SLUG
  python review.py --profile SLUG --import
  python review.py --profile SLUG --reclassify [--auto|--import]
"""

import argparse
import csv
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from constants import REVIEW_ENCODING, STATUT_A_REVISER, STATUT_VALIDE
from db import get_user_profile, open_db
from parsers import _guess_doc_type
ACTION_KEEP    = "garder"
ACTION_CORRECT = "corriger"
ACTION_DELETE  = "supprimer"

REVIEW_COLS = [
    "id", "action",
    "type_document", "numéro_facture", "date_document", "date_échéance", "date_paiement",
    "émetteur_nom", "émetteur_siren", "émetteur_siret", "émetteur_tva_intracom",
    "émetteur_adresse", "émetteur_email",
    "destinataire_nom", "destinataire_siren", "destinataire_siret",
    "destinataire_tva_intracom", "destinataire_adresse",
    "montant_ht", "taux_tva", "montant_tva", "montant_ttc",
    "devise", "montant_eur", "taux_change",
    "description_prestation", "lignes_détail",
    "catégorie", "sous_catégorie", "déductible", "taux_déductibilité", "centre_de_coût",
    "mode_paiement", "référence_paiement", "statut_paiement",
    "exercice_fiscal", "trimestre", "régime_tva", "nature_charge", "statut_fiscal_profil",
    "fichier_source", "confiance", "notes_correction",
]


def export_review(conn: sqlite3.Connection, review_dir: Path) -> Path:
    rows = conn.execute(
        "SELECT * FROM invoices WHERE statut_révision = ? ORDER BY date_document",
        (STATUT_A_REVISER,),
    ).fetchall()

    if not rows:
        print("Aucun item à réviser.")
        return None

    review_dir.mkdir(parents=True, exist_ok=True)
    out = review_dir / "review.csv"

    with open(out, "w", newline="", encoding=REVIEW_ENCODING) as f:
        writer = csv.DictWriter(f, fieldnames=REVIEW_COLS, extrasaction="ignore",
                                lineterminator="\n")
        writer.writeheader()
        for r in rows:
            row = dict(r)
            row["action"] = ACTION_KEEP
            writer.writerow(row)

    print(f"{len(rows)} item(s) exportés → {out}")
    print("Instructions : ouvre review.csv, corrige les valeurs, change 'action' si besoin :")
    print(f"  {ACTION_KEEP}    → valide l'extraction telle quelle")
    print(f"  {ACTION_CORRECT}  → applique tes modifications")
    print(f"  {ACTION_DELETE} → supprime l'entrée de la base")
    print("Puis relance : python review.py --import")
    return out

def import_review(conn: sqlite3.Connection, review_dir: Path) -> None:
    review_file = review_dir / "review.csv"
    if not review_file.exists():
        print(f"Fichier introuvable : {review_file}")
        return

    now = datetime.now(timezone.utc).isoformat()
    updated = deleted = skipped = 0

    with open(review_file, newline="", encoding=REVIEW_ENCODING) as f:
        reader = csv.DictReader(f)
        for row in reader:
            action = row.get("action", ACTION_KEEP).strip().lower()
            rid = row["id"]

            if action == ACTION_DELETE:
                conn.execute("DELETE FROM invoices WHERE id = ?", (rid,))
                deleted += 1

            elif action == ACTION_CORRECT:
                updatable = {k: v for k, v in row.items()
                             if k not in ("id", "action") and k in REVIEW_COLS}
                updatable["statut_révision"] = STATUT_VALIDE
                updatable["révisé_par"] = "user"
                updatable["date_révision"] = now
                set_clause = ", ".join(f'"{k}" = ?' for k in updatable)
                conn.execute(
                    f"UPDATE invoices SET {set_clause} WHERE id = ?",
                    list(updatable.values()) + [rid]
                )
                updated += 1

            elif action == ACTION_KEEP:
                conn.execute(
                    "UPDATE invoices SET statut_révision = ?, révisé_par = 'user', "
                    "date_révision = ?, validé_le = ? WHERE id = ?",
                    (STATUT_VALIDE, now, now, rid)
                )
                skipped += 1

    conn.commit()
    print(f"Import terminé : {updated} corrigés, {deleted} supprimés, {skipped} gardés tels quels")

RECLASSIFY_COLS = ["id", "type_document", "date_document", "émetteur_nom",
                   "montant_ttc", "catégorie", "fichier_source"]

def export_reclassify(conn: sqlite3.Connection, review_dir: Path) -> None:
    rows = conn.execute(
        "SELECT * FROM invoices WHERE type_document = 'facture_reçue' AND statut_révision != ?",
        (STATUT_A_REVISER,),
    ).fetchall()

    if not rows:
        print("Aucun document avec type par défaut à reclassifier.")
        return

    review_dir.mkdir(parents=True, exist_ok=True)
    out = review_dir / "reclassify.csv"
    with open(out, "w", newline="", encoding=REVIEW_ENCODING) as f:
        writer = csv.DictWriter(f, fieldnames=RECLASSIFY_COLS, extrasaction="ignore",
                                lineterminator="\n")
        writer.writeheader()
        writer.writerows(dict(r) for r in rows)

    print(f"{len(rows)} document(s) exportés → {out}")
    print("Corrige la colonne 'type_document', puis relance : python review.py --reclassify --import")

def auto_reclassify(conn: sqlite3.Connection, user_siren: str) -> None:
    rows = conn.execute(
        "SELECT id, texte_brut, montant_ttc FROM invoices "
        "WHERE type_document = 'facture_reçue' AND statut_révision != ?",
        (STATUT_A_REVISER,),
    ).fetchall()

    auto_done = manual_needed = 0
    for r in rows:
        if r["texte_brut"]:
            new_type = _guess_doc_type(r["texte_brut"], user_siren, r["montant_ttc"])
            conn.execute("UPDATE invoices SET type_document = ? WHERE id = ?", (new_type, r["id"]))
            auto_done += 1
        else:
            manual_needed += 1

    conn.commit()
    print(f"Reclassification auto : {auto_done} mis à jour, {manual_needed} sans texte_brut → export manuel requis")
    if manual_needed:
        print("Lance : python review.py --reclassify  pour exporter les entrées à corriger manuellement")

def import_reclassify(conn: sqlite3.Connection, review_dir: Path) -> None:
    reclassify_path = review_dir / "reclassify.csv"
    if not reclassify_path.exists():
        print(f"Fichier introuvable : {reclassify_path}")
        return

    updated = 0
    with open(reclassify_path, newline="", encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            conn.execute("UPDATE invoices SET type_document = ? WHERE id = ?",
                         (row["type_document"].strip(), row["id"]))
            updated += 1

    conn.commit()
    print(f"{updated} type(s) mis à jour.")

def main() -> None:
    parser = argparse.ArgumentParser(description="Révision batch des extractions incertaines")
    parser.add_argument("--import", dest="do_import", action="store_true",
                        help="Re-importe les corrections depuis review.csv")
    parser.add_argument("--reclassify", action="store_true",
                        help="Mode reclassification du type de document")
    parser.add_argument("--auto", action="store_true",
                        help="Avec --reclassify : détection automatique via texte_brut")
    parser.add_argument("--profile", type=str, required=True, help="Slug du profil")
    args = parser.parse_args()

    from profiles import resolve_paths
    paths = resolve_paths(args.profile)
    db_path = paths["db"]
    review_dir = paths["review"]

    if not db_path.exists():
        print(f"Base introuvable : {db_path} — lance d'abord extract.py")
        return

    conn = open_db(db_path)

    profile = get_user_profile(conn)
    user_siren = profile["siren"] if profile else ""

    if args.reclassify:
        if args.auto:
            auto_reclassify(conn, user_siren)
        elif args.do_import:
            import_reclassify(conn, review_dir)
        else:
            export_reclassify(conn, review_dir)
    elif args.do_import:
        import_review(conn, review_dir)
    else:
        export_review(conn, review_dir)

    conn.close()

if __name__ == "__main__":
    main()

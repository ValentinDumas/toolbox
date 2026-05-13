"""
services/urssaf_export.py — Génération du récapitulatif de déclaration URSSAF.

Service de domaine pur : prend une connexion DB, un profil et une période,
écrit un fichier CSV récapitulatif prêt à recopier dans le formulaire
URSSAF (autoentrepreneur.urssaf.fr). Format CSV plutôt que PDF tant que
weasyprint/reportlab ne sont pas installés (cf. agent.md > External Tool
Preference) — le format reste lisible et copiable.

Inclut, pour la période :
- entête (profil, activité, période, échéance)
- montant agrégé : CA encaissé sur la période
- ventilation : cotisations sociales + CFP (+ ACRE si applicable)
- liste des factures sources, pour audit / preuve archivage 10 ans
"""
from __future__ import annotations

import csv
import sqlite3
from pathlib import Path

from queries import query_ca_encaisse
from services.urssaf import compute_beneficie_imposable, compute_cotisations, compute_vfl


def export_declaration_csv(
    conn: sqlite3.Connection,
    profile: dict,
    period: dict,
    output_dir: Path,
    *,
    acre_factor: float = 1.0,
) -> Path:
    """Génère le récap CSV d'une période URSSAF et retourne le chemin du fichier.

    `period` : dict produit par `services.urssaf.generate_periods` (contient
    period_key, label, start, end, deadline).
    `profile` : ligne user_profile (au moins `nom`, `siren`, `activite_principale`).
    `acre_factor` : taux ACRE appliqué (1.0 par défaut).

    Le fichier est écrasé s'il existe (déclaration ré-éditée après correction).
    Nommage : `output_dir/urssaf-AAAA-XX.csv` (XX = M01..M12 ou T1..T4).
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    out = output_dir / f"urssaf-{period['period_key']}.csv"

    ca = query_ca_encaisse(conn, period["start"], period["end"])
    activite = (profile.get("activite_principale") or "").strip()
    cot = compute_cotisations(ca["ca_ttc"], activite, acre_factor=acre_factor) if activite else None
    vfl = (
        compute_vfl(ca["ca_ttc"], activite)
        if activite and profile.get("versement_liberatoire") else None
    )

    # Récupère la liste des pièces sources pour traçabilité (cf. VISION.md §
    # Sécurité — toute valeur du déclaratif doit être traçable au fichier source).
    sources = []
    if ca["facture_ids"]:
        ph = ",".join("?" * len(ca["facture_ids"]))
        sources = conn.execute(
            f"SELECT id, date_paiement, numéro_facture, destinataire_nom, montant_ttc "
            f"FROM invoices WHERE id IN ({ph}) ORDER BY date_paiement",
            ca["facture_ids"],
        ).fetchall()

    with out.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(["Récapitulatif URSSAF auto-entrepreneur"])
        w.writerow(["Profil",      profile.get("nom") or ""])
        w.writerow(["SIREN",       profile.get("siren") or ""])
        w.writerow(["Activité",    activite or "non renseignée"])
        w.writerow(["Période",     period["label"]])
        w.writerow(["Du",          period["start"]])
        w.writerow(["Au",          period["end"]])
        w.writerow(["Échéance",    period["deadline"]])
        w.writerow([])
        w.writerow(["CA encaissé sur la période (€)", f"{ca['ca_ttc']:.2f}".replace(".", ",")])
        if cot:
            w.writerow([
                f"Cotisations sociales (taux {cot['taux_cotisations_applique']*100:.2f} %)",
                f"{cot['cotisations_sociales']:.2f}".replace(".", ","),
            ])
            w.writerow([
                f"CFP (taux {cot['taux_cfp_applique']*100:.2f} %)",
                f"{cot['cfp']:.2f}".replace(".", ","),
            ])
            total_du = cot["total"] + (vfl["vfl"] if vfl else 0.0)
            if vfl:
                w.writerow([
                    f"Versement libératoire IR (taux {vfl['taux_applique']*100:.2f} %)",
                    f"{vfl['vfl']:.2f}".replace(".", ","),
                ])
            w.writerow(["Total à payer URSSAF", f"{total_du:.2f}".replace(".", ",")])
        else:
            w.writerow(["Cotisations — non calculées",
                        "Renseignez « Activité principale » dans Paramètres."])
        if acre_factor != 1.0:
            w.writerow(["ACRE appliqué (facteur)", f"{acre_factor:.2f}".replace(".", ",")])
        # §3.1 : base imposable IR sur 2042-C-PRO, uniquement hors VFL.
        if activite and not profile.get("versement_liberatoire"):
            benef = compute_beneficie_imposable(ca["ca_ttc"], activite)
            w.writerow([])
            w.writerow(["Base IR — 2042-C-PRO (sans VFL)"])
            w.writerow([
                f"Abattement forfaitaire (taux {benef['abattement_taux']*100:.0f} %)",
                f"{benef['abattement_montant']:.2f}".replace(".", ","),
            ])
            w.writerow(["Bénéfice imposable IR", f"{benef['beneficie_imposable']:.2f}".replace(".", ",")])
        # §4.4 : déclaration obligatoire même si CA = 0 € — la trace reste utile.
        if ca["ca_ttc"] == 0:
            w.writerow(["Note", "CA nul — déclaration obligatoire (§4.4)."])

        w.writerow([])
        w.writerow(["Pièces sources (encaissements)"])
        w.writerow(["id", "date_paiement", "numéro_facture", "destinataire", "montant_ttc"])
        for s in sources:
            w.writerow([
                s["id"], s["date_paiement"], s["numéro_facture"] or "",
                s["destinataire_nom"] or "",
                f"{(s['montant_ttc'] or 0):.2f}".replace(".", ","),
            ])

    return out

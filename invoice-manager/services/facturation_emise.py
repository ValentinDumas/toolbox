"""
services/facturation_emise.py — Émission de factures auto-entrepreneur.

Couvre AUTO_ENTREPRENEUR_RULES.md §7.2 :
- numérotation séquentielle sans rupture (par profil et par année)
- mentions obligatoires (SIREN, code APE, dates, désignation, « TVA non
  applicable, art. 293 B du CGI » en franchise)
- insertion immédiate de la pièce en DB comme facture_émise validée
- génération d'un fichier HTML imprimable (PDF via Cmd-P du navigateur,
  en attendant l'installation de weasyprint)

Service pur : pas de Flask. Le blueprint orchestre, ce module fait.
"""
from __future__ import annotations

import hashlib
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path

from constants import STATUT_VALIDE


def next_numero_facture(conn: sqlite3.Connection, year: int) -> str:
    """Calcule le prochain numéro de facture séquentiel de l'année.

    Format : `AAAA-NNNN` (NNNN à 4 chiffres, démarrage à 0001). La recherche
    ne considère que les factures émises de la même année (préfixe), pour
    permettre un reset annuel naturel (norme française).

    Garantie de continuité §7.2 : ne pas combler les trous laissés par des
    factures supprimées — la corbeille (soft-delete) conserve les numéros.
    Une facture annulée doit donner lieu à un avoir, pas à une réutilisation.
    """
    prefix = f"{year:04d}-"
    rows = conn.execute(
        "SELECT numéro_facture FROM invoices "
        "WHERE type_document='facture_émise' AND numéro_facture LIKE ?",
        (f"{prefix}%",),
    ).fetchall()
    max_seq = 0
    for row in rows:
        num = row["numéro_facture"] or ""
        suffix = num[len(prefix):]
        try:
            max_seq = max(max_seq, int(suffix))
        except ValueError:
            continue
    return f"{prefix}{max_seq + 1:04d}"


def render_facture_html(profile: dict, data: dict) -> str:
    """Génère le HTML d'une facture émise avec toutes les mentions §7.2.

    `data` doit contenir : numero_facture, date_emission (ISO), date_prestation
    (ISO), client_nom, client_adresse, lignes (liste de
    {désignation, quantite, prix_unitaire_ht}), montant_ht, montant_tva
    (= 0 si franchise), montant_ttc, mode_paiement, conditions, en_franchise.
    """
    lignes_html = "".join(
        f"<tr><td>{ligne['désignation']}</td>"
        f"<td class='r'>{ligne['quantite']}</td>"
        f"<td class='r'>{ligne['prix_unitaire_ht']:.2f} €</td>"
        f"<td class='r'>{ligne['quantite'] * ligne['prix_unitaire_ht']:.2f} €</td></tr>"
        for ligne in data["lignes"]
    )

    mention_tva = (
        '<p class="mention-legale"><strong>TVA non applicable, art. 293 B du CGI.</strong></p>'
        if data.get("en_franchise") else
        '<p>TVA appliquée selon le régime de droit commun.</p>'
    )
    code_ape = profile.get("code_ape") or ""
    adresse_pro = profile.get("adresse") or ""

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Facture {data['numero_facture']}</title>
  <style>
    body {{ font-family: Helvetica, Arial, sans-serif; max-width: 800px; margin: 32px auto; color: #1a1a1a; }}
    h1 {{ margin: 0 0 4px 0; }}
    .emetteur, .destinataire {{ margin: 24px 0; }}
    .destinataire {{ text-align: right; }}
    table {{ width: 100%; border-collapse: collapse; margin: 16px 0; }}
    th, td {{ padding: 8px; border-bottom: 1px solid #ddd; text-align: left; }}
    .r {{ text-align: right; }}
    .totaux {{ margin-top: 16px; }}
    .totaux td {{ border: none; padding: 4px 8px; }}
    .mention-legale {{ background: #FEF3C7; padding: 12px; border-left: 4px solid #D97706; }}
    footer {{ margin-top: 32px; font-size: 12px; color: #555; border-top: 1px solid #ddd; padding-top: 12px; }}
  </style>
</head>
<body>
  <header>
    <h1>Facture n° {data['numero_facture']}</h1>
    <p>Émise le {data['date_emission']} — Prestation/livraison du {data['date_prestation']}</p>
  </header>

  <section class="emetteur">
    <strong>{profile.get('nom') or ''}</strong><br>
    {adresse_pro}<br>
    SIREN : {profile.get('siren') or '—'}{f" · APE : {code_ape}" if code_ape else ''}<br>
    {f"TVA intracommunautaire : {profile.get('tva_intracom')}" if profile.get('tva_intracom') else ''}
  </section>

  <section class="destinataire">
    <strong>Facturé à</strong><br>
    {data['client_nom']}<br>
    {data.get('client_adresse', '')}
  </section>

  <table>
    <thead>
      <tr><th>Désignation</th><th class="r">Qté</th><th class="r">PU HT</th><th class="r">Total HT</th></tr>
    </thead>
    <tbody>{lignes_html}</tbody>
  </table>

  <table class="totaux">
    <tr><td class="r"><strong>Total HT</strong></td><td class="r">{data['montant_ht']:.2f} €</td></tr>
    <tr><td class="r">TVA</td><td class="r">{data['montant_tva']:.2f} €</td></tr>
    <tr><td class="r"><strong>Total TTC</strong></td><td class="r"><strong>{data['montant_ttc']:.2f} €</strong></td></tr>
  </table>

  {mention_tva}

  <footer>
    <p><strong>Conditions de règlement :</strong> {data.get('conditions') or profile.get('conditions_reglement') or 'À réception.'}</p>
    <p>Mode de paiement : {data.get('mode_paiement') or 'Virement bancaire'}</p>
    <p>En cas de retard de paiement, des pénalités au taux de la BCE majoré de 10 points seront exigibles,
       ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 Code de commerce).</p>
  </footer>
</body>
</html>
"""


def creer_facture_emise(
    conn: sqlite3.Connection, profile: dict, data: dict, output_dir: Path,
    *, year: int | None = None, en_franchise: bool = True,
) -> dict:
    """Crée une facture émise : numérote, génère le HTML, insère en DB.

    Retourne le dict de la pièce insérée (id, numéro_facture, chemin du
    fichier HTML produit).
    """
    today = datetime.now()
    year = year or today.year
    date_emission = data.get("date_emission") or today.date().isoformat()
    date_prestation = data.get("date_prestation") or date_emission

    numero_facture = next_numero_facture(conn, year)
    total_ht = sum(l["quantite"] * l["prix_unitaire_ht"] for l in data["lignes"])
    montant_tva = 0.0 if en_franchise else round(total_ht * data.get("taux_tva", 0.20), 2)
    montant_ttc = round(total_ht + montant_tva, 2)

    facture = {
        "numero_facture": numero_facture,
        "date_emission": date_emission,
        "date_prestation": date_prestation,
        "client_nom": data["client_nom"],
        "client_adresse": data.get("client_adresse", ""),
        "lignes": data["lignes"],
        "montant_ht": round(total_ht, 2),
        "montant_tva": montant_tva,
        "montant_ttc": montant_ttc,
        "en_franchise": en_franchise,
        "mode_paiement": data.get("mode_paiement"),
        "conditions": data.get("conditions"),
    }

    output_dir.mkdir(parents=True, exist_ok=True)
    html_path = output_dir / f"facture-{numero_facture}.html"
    html_path.write_text(render_facture_html(profile, facture), encoding="utf-8")

    # Hash du fichier pour respecter l'invariant `hash_fichier UNIQUE`.
    hash_fichier = hashlib.sha256(html_path.read_bytes()).hexdigest()
    item_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO invoices (id, type_document, numéro_facture, date_document, "
        "émetteur_nom, émetteur_siren, destinataire_nom, destinataire_adresse, "
        "montant_ht, montant_tva, montant_ttc, taux_tva, devise, "
        "fichier_source, hash_fichier, statut_révision, révisé_par, "
        "validé_le, date_extraction, exercice_fiscal, confiance) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EUR', ?, ?, ?, 'user', ?, ?, ?, 1.0)",
        (
            item_id, "facture_émise", numero_facture, date_emission,
            profile.get("nom") or "", profile.get("siren") or "",
            data["client_nom"], data.get("client_adresse", ""),
            round(total_ht, 2), montant_tva, montant_ttc,
            0.0 if en_franchise else data.get("taux_tva", 0.20),
            str(html_path), hash_fichier, STATUT_VALIDE,
            today.isoformat(timespec="seconds"),
            today.isoformat(timespec="seconds"), year,
        ),
    )
    conn.commit()

    return {
        "id": item_id, "numero_facture": numero_facture, "fichier": html_path,
        "montant_ttc": montant_ttc,
    }

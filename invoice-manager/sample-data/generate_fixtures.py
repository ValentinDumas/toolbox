"""
sample-data/generate_fixtures.py — Generate realistic static PDF fixtures.
Run once from project root: python3 sample-data/generate_fixtures.py
"""

import io
from pathlib import Path

from fpdf import FPDF
from fpdf.enums import XPos, YPos

TESTING2 = Path(__file__).parent


_REPLACEMENTS = str.maketrans({
    "–": "-",   # en dash
    "—": "-",   # em dash
    "’": "'",   # right single quote
    "‘": "'",   # left single quote
    "é": "e",   # é
    "è": "e",   # è
    "ê": "e",   # ê
    "à": "a",   # à
    "â": "a",   # â
    "ô": "o",   # ô
    "û": "u",   # û
    "î": "i",   # î
    "ç": "c",   # ç
    "ù": "u",   # ù
    "ü": "u",   # ü
    "ï": "i",   # ï
    "ë": "e",   # ë
    "æ": "ae",  # æ
    "œ": "oe",  # œ
    "É": "E",   # É
    "À": "A",   # À
    "Ç": "C",   # Ç
})


def _ascii(text: str) -> str:
    return text.translate(_REPLACEMENTS)


def pdf(blocks: list[tuple[str, int, bool]]) -> bytes:
    """blocks = list of (text, size, bold)"""
    p = FPDF()
    p.add_page()
    for text, size, bold in blocks:
        p.set_font("Helvetica", style="B" if bold else "", size=size)
        p.cell(0, 6, _ascii(text), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    buf = io.BytesIO()
    p.output(buf)
    return buf.getvalue()


def sep() -> tuple[str, int, bool]:
    return ("-" * 72, 8, False)


# ── Fixtures per profile ──────────────────────────────────────────────────────

FIXTURES: dict[str, list[tuple[str, list]]] = {

    "auto-entrepreneur": [

        ("facture-recue-ovh-ae.pdf", [
            ("OVH SAS", 14, True),
            ("2 Rue Kellermann – 59100 Roubaix", 9, False),
            ("SIREN : 424 761 419    N° TVA : FR22424761419", 9, False),
            sep(),
            ("FACTURE", 13, True),
            ("N° de facture : AE-2025-0042", 10, False),
            ("Date d'émission : 15 janvier 2025", 10, False),
            ("Date d'échéance : 15 février 2025", 10, False),
            sep(),
            ("Destinataire", 10, True),
            ("Jean Dupont – Auto-entrepreneur", 10, False),
            ("SIREN : 111 111 111", 10, False),
            sep(),
            ("Description", 10, True),
            ("Hébergement serveur dédié – abonnement 12 mois", 10, False),
            ("Référence : SRV-DEDI-2025", 10, False),
            sep(),
            ("Montant HT     :  107,88 EUR", 10, False),
            ("TVA 20 %       :   21,58 EUR", 10, False),
            ("TOTAL TTC      :  129,46 EUR", 11, True),
            sep(),
            ("Mode de paiement : Prélèvement automatique SEPA", 10, False),
            ("Référence mandat : OVH-111111111", 10, False),
        ]),

        ("facture-recue-adobe-ae.pdf", [
            ("Adobe Systems France", 14, True),
            ("4 Rue du Docteur Lancereaux – 75008 Paris", 9, False),
            ("SIREN : 987 654 321    N° TVA : FR98987654321", 9, False),
            sep(),
            ("FACTURE", 13, True),
            ("N° de facture : ADO-2025-1187", 10, False),
            ("Date d'émission : 1 mars 2025", 10, False),
            sep(),
            ("Destinataire", 10, True),
            ("Jean Dupont – Auto-entrepreneur", 10, False),
            ("SIREN : 111 111 111", 10, False),
            sep(),
            ("Adobe Creative Cloud – abonnement annuel", 10, False),
            ("Photoshop + Illustrator + Acrobat Pro", 10, False),
            sep(),
            ("Montant HT     :  499,00 EUR", 10, False),
            ("TVA 20 %       :   99,80 EUR", 10, False),
            ("TOTAL TTC      :  598,80 EUR", 11, True),
            sep(),
            ("Mode de paiement : Carte bancaire", 10, False),
        ]),

        ("avoir-recu-ovh-ae.pdf", [
            ("OVH SAS", 14, True),
            ("SIREN : 424 761 419    N° TVA : FR22424761419", 9, False),
            sep(),
            ("AVOIR / NOTE DE CRÉDIT", 13, True),
            ("N° avoir : AV-2025-0011", 10, False),
            ("Référence facture : AE-2025-0038", 10, False),
            ("Date : 20 juin 2025", 10, False),
            sep(),
            ("Motif : Remboursement suite résiliation anticipée", 10, False),
            sep(),
            ("Montant HT     :  -50,00 EUR", 10, False),
            ("TVA 20 %       :  -10,00 EUR", 10, False),
            ("TOTAL TTC      :  -60,00 EUR", 11, True),
            sep(),
            ("Remboursement par virement sous 5 jours ouvrés", 10, False),
        ]),

        ("recu-fnac-ae.pdf", [
            ("FNAC PARIS FORUM DES HALLES", 14, True),
            ("1-7 Rue Pierre Lescot – 75001 Paris", 9, False),
            sep(),
            ("REÇU DE CAISSE", 13, True),
            ("Date : 10 septembre 2025    Heure : 14h32", 10, False),
            ("N° ticket : 20250910-7891", 10, False),
            sep(),
            ("Souris sans fil Logitech MX Master 3", 10, False),
            ("Réf : LOG-MX3-GR", 10, False),
            sep(),
            ("HT             :   24,99 EUR", 10, False),
            ("TVA 20 %       :    5,00 EUR", 10, False),
            ("TOTAL TTC      :   29,99 EUR", 11, True),
            sep(),
            ("Paiement : Carte bancaire – Visa ****4521", 10, False),
            ("Retour possible sous 30 jours sur présentation du ticket", 9, False),
        ]),

    ],

    "sasu": [

        ("facture-emise-sasu-dev.pdf", [
            ("Tech Solutions SASU", 14, True),
            ("12 Avenue de l'Innovation – 69007 Lyon", 9, False),
            ("SIREN : 222 222 222    N° TVA : FR22222222222", 9, False),
            sep(),
            ("FACTURE CLIENT", 13, True),
            ("N° de facture : SASU-2025-0021", 10, False),
            ("Date d'émission : 28 février 2025", 10, False),
            ("Date d'échéance : 30 mars 2025", 10, False),
            sep(),
            ("Client", 10, True),
            ("Dupont SAS – SIREN 333 333 333", 10, False),
            ("15 Rue de la Paix – 75001 Paris", 10, False),
            sep(),
            ("Prestation : Développement application web – sprint #3", 10, False),
            ("10 jours × 500 EUR/jour", 10, False),
            sep(),
            ("Montant HT     : 5 000,00 EUR", 10, False),
            ("TVA 20 %       : 1 000,00 EUR", 10, False),
            ("TOTAL TTC      : 6 000,00 EUR", 11, True),
            sep(),
            ("Mode de paiement : Virement bancaire", 10, False),
            ("IBAN : FR76 3000 6000 0112 3456 7890 189", 10, False),
        ]),

        ("facture-recue-loyer-sasu.pdf", [
            ("Foncière Immo SARL", 14, True),
            ("47 Boulevard Haussmann – 75009 Paris", 9, False),
            ("SIREN : 333 444 555    N° TVA : FR33333444555", 9, False),
            sep(),
            ("FACTURE – LOYER BUREAU", 13, True),
            ("N° : LOY-2025-Q1-001", 10, False),
            ("Période : janvier – mars 2025", 10, False),
            ("Date d'émission : 2 janvier 2025", 10, False),
            sep(),
            ("Locataire", 10, True),
            ("Tech Solutions SASU – SIREN 222 222 222", 10, False),
            sep(),
            ("Loyer bureau 45 m² – 3 mois", 10, False),
            ("500 EUR/mois HT × 3", 10, False),
            sep(),
            ("Montant HT     : 1 500,00 EUR", 10, False),
            ("TVA 20 %       :   300,00 EUR", 10, False),
            ("TOTAL TTC      : 1 800,00 EUR", 11, True),
            sep(),
            ("Mode de paiement : Prélèvement mensuel", 10, False),
        ]),

        ("note-de-frais-sasu.pdf", [
            ("NOTE DE FRAIS", 14, True),
            ("Tech Solutions SASU – SIREN 222 222 222", 10, False),
            sep(),
            ("Salarié : Martin Dupont", 10, False),
            ("Date déplacement : 28 mars 2025", 10, False),
            ("Motif : Réunion client Lyon – Paris", 10, False),
            sep(),
            ("Détail des frais", 10, True),
            ("TGV Lyon – Paris A/R (2ème classe)", 10, False),
            ("Billet : 87,00 EUR TTC", 10, False),
            sep(),
            ("HT             :   79,09 EUR", 10, False),
            ("TVA 10 %       :    7,91 EUR", 10, False),
            ("TOTAL TTC      :   87,00 EUR", 11, True),
            sep(),
            ("Paiement : Carte bancaire personnelle", 10, False),
            ("Remboursement sur salaire de mars 2025", 10, False),
        ]),

        ("avoir-client-sasu.pdf", [
            ("Tech Solutions SASU", 14, True),
            ("SIREN : 222 222 222    N° TVA : FR22222222222", 9, False),
            sep(),
            ("AVOIR CLIENT / CREDIT NOTE", 13, True),
            ("N° avoir : AV-SASU-2025-0003", 10, False),
            ("Réf. facture annulée : SASU-2025-0015", 10, False),
            ("Date : 15 avril 2025", 10, False),
            sep(),
            ("Client", 10, True),
            ("Dupont SAS – SIREN 333 333 333", 10, False),
            sep(),
            ("Motif : Prestation annulée – accord contractuel", 10, False),
            sep(),
            ("Montant HT     :  -500,00 EUR", 10, False),
            ("TVA 20 %       :  -100,00 EUR", 10, False),
            ("TOTAL TTC      :  -600,00 EUR", 11, True),
            sep(),
            ("Remboursement par virement sous 10 jours ouvrés", 10, False),
        ]),

    ],

    "sarl": [

        ("facture-emise-sarl-btp.pdf", [
            ("BTP Solutions SARL", 14, True),
            ("8 Rue des Artisans – 69003 Lyon", 9, False),
            ("SIREN : 444 444 444    N° TVA : FR44444444444", 9, False),
            sep(),
            ("FACTURE", 13, True),
            ("N° de facture : SARL-2025-0056", 10, False),
            ("Date d'émission : 10 mars 2025", 10, False),
            ("Date d'échéance : 10 avril 2025", 10, False),
            sep(),
            ("Client", 10, True),
            ("Mairie de Lyon – SIRET 213 100 030 00015", 10, False),
            ("Place de la Comédie – 69001 Lyon", 10, False),
            sep(),
            ("Travaux de rénovation bâtiment municipal", 10, False),
            ("Devis accepté n° DEV-2025-0043", 10, False),
            sep(),
            ("Montant HT     : 12 000,00 EUR", 10, False),
            ("TVA 20 %       :  2 400,00 EUR", 10, False),
            ("TOTAL TTC      : 14 400,00 EUR", 11, True),
            sep(),
            ("Mode de paiement : Virement bancaire (30 jours fin de mois)", 10, False),
        ]),

        ("facture-recue-leroy-sarl.pdf", [
            ("Leroy Merlin France", 14, True),
            ("Siège social : Lezennes – SIREN : 555 555 555", 9, False),
            ("N° TVA : FR55555555555", 9, False),
            sep(),
            ("FACTURE", 13, True),
            ("N° : LM-2025-452187", 10, False),
            ("Date d'émission : 22 février 2025", 10, False),
            sep(),
            ("Client", 10, True),
            ("BTP Solutions SARL – SIREN 444 444 444", 10, False),
            sep(),
            ("Outillage professionnel – commande B2B", 10, False),
            ("Perceuse Bosch Professional GBH 2-26", 10, False),
            ("Scie circulaire + accessoires", 10, False),
            sep(),
            ("Montant HT     :   850,00 EUR", 10, False),
            ("TVA 20 %       :   170,00 EUR", 10, False),
            ("TOTAL TTC      : 1 020,00 EUR", 11, True),
            sep(),
            ("Mode de paiement : Chèque professionnel", 10, False),
        ]),

        ("avoir-fournisseur-sarl.pdf", [
            ("Leroy Merlin France", 14, True),
            ("SIREN : 555 555 555    N° TVA : FR55555555555", 9, False),
            sep(),
            ("AVOIR / NOTE DE CRÉDIT", 13, True),
            ("N° avoir : AV-LM-2025-00891", 10, False),
            ("Référence facture : LM-2025-452187", 10, False),
            ("Date : 5 mars 2025", 10, False),
            sep(),
            ("Motif : Retour marchandise défectueuse", 10, False),
            sep(),
            ("Montant HT     :  -200,00 EUR", 10, False),
            ("TVA 20 %       :   -40,00 EUR", 10, False),
            ("TOTAL TTC      :  -240,00 EUR", 11, True),
            sep(),
            ("Remboursement par avoir sur prochaine commande", 10, False),
        ]),

        ("note-de-frais-sarl.pdf", [
            ("NOTE DE FRAIS", 14, True),
            ("BTP Solutions SARL – SIREN 444 444 444", 10, False),
            sep(),
            ("Employé : Sophie Martin", 10, False),
            ("Date : 18 avril 2025", 10, False),
            ("Motif : Repas client – affaires", 10, False),
            sep(),
            ("Restaurant Le Bouchon Lyonnais", 10, False),
            ("2 couverts – déjeuner de travail", 10, False),
            sep(),
            ("HT             :   86,36 EUR", 10, False),
            ("TVA 10 %       :    8,64 EUR", 10, False),
            ("TOTAL TTC      :   95,00 EUR", 11, True),
            sep(),
            ("Paiement : Carte bancaire personnelle", 10, False),
            ("Remboursement sur fiche de paie avril 2025", 10, False),
        ]),

    ],

    "salarie": [

        ("note-de-frais-salarie-transport.pdf", [
            ("NOTE DE FRAIS", 14, True),
            ("Grande Entreprise SA – SIREN 666 666 666", 10, False),
            sep(),
            ("Salarié : Pierre Durand  –  Matricule : GE-1042", 10, False),
            ("Date : 12 janvier 2025", 10, False),
            ("Motif : Déplacement professionnel Paris – Bordeaux", 10, False),
            sep(),
            ("Transport TGV Paris-Montparnasse – Bordeaux A/R", 10, False),
            sep(),
            ("HT             :  109,09 EUR", 10, False),
            ("TVA 10 %       :   10,91 EUR", 10, False),
            ("TOTAL TTC      :  120,00 EUR", 11, True),
            sep(),
            ("Paiement : Carte bancaire personnelle", 10, False),
            ("Remboursement sur salaire de janvier 2025", 10, False),
        ]),

        ("facture-formation-salarie.pdf", [
            ("OpenClassrooms SAS", 14, True),
            ("10 Quai de la Seine – 75019 Paris", 9, False),
            ("SIREN : 666 777 888    N° TVA : FR66666777888", 9, False),
            sep(),
            ("FACTURE – FORMATION CPF", 13, True),
            ("N° : OC-2025-00412", 10, False),
            ("Date d'émission : 3 février 2025", 10, False),
            sep(),
            ("Stagiaire", 10, True),
            ("Pierre Durand – CPF n° 1234567890", 10, False),
            sep(),
            ("Formation : Python avancé & Data Science", 10, False),
            ("Durée : 60 heures  –  Organisme certifié Qualiopi", 10, False),
            sep(),
            ("Montant HT     : 1 500,00 EUR", 10, False),
            ("TVA 20 %       :   300,00 EUR", 10, False),
            ("TOTAL TTC      : 1 800,00 EUR", 11, True),
            sep(),
            ("Paiement : Virement OPCO Atlas (prise en charge totale)", 10, False),
        ]),

        ("recu-navigo-salarie.pdf", [
            ("RATP – Régie Autonome des Transports Parisiens", 14, True),
            ("54 Quai de la Rapée – 75012 Paris", 9, False),
            sep(),
            ("REÇU – PASS NAVIGO", 13, True),
            ("Date : 1 mars 2025", 10, False),
            ("N° carte Navigo : 0123456789", 10, False),
            sep(),
            ("Pass Navigo toutes zones – mars 2025", 10, False),
            sep(),
            ("TOTAL      :   86,40 EUR", 11, True),
            ("(Tarif mensuel – zones 1 à 5)", 9, False),
            sep(),
            ("Paiement : Carte bancaire Visa ****7821", 10, False),
            ("50 % remboursé par l'employeur (obligation légale)", 9, False),
        ]),

    ],
}

def main() -> None:
    total = 0
    for name, fixtures in FIXTURES.items():
        profile_dir = TESTING2 / name
        input_dir = profile_dir / "input"
        input_dir.mkdir(parents=True, exist_ok=True)

        for filename, blocks in fixtures:
            (input_dir / filename).write_bytes(pdf(blocks))
            print(f"  {name}/{filename}")
            total += 1

    print(f"\n{total} PDF fixtures générés dans sample-data/")


if __name__ == "__main__":
    main()

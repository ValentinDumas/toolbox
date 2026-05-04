# sncf-trip-proofs

Outils pour déclarer les frais de train au réel, à partir des justificatifs SNCF Connect.

---

## Utilisation rapide

```bash
# 1. Poser les PDFs bruts dans le bon inbox
cp ~/Downloads/*.pdf justificatif-achat/inbox/
# ou
cp ~/Downloads/*.pdf justificatif-voyage/inbox/

# 2. Organiser (dry-run d'abord, puis --real)
cd justificatif-achat/ && python3 curate-justificatifs-achat.py --real
# ou
cd justificatif-voyage/ && python3 curate-justificatifs-voyage.py --real

# 3. Générer le bilan
python3 bilan-depenses-train.py justificatif-achat/output
# ou
python3 bilan-depenses-train.py justificatif-voyage/output
```

Le bilan `bilan-depenses-train-YYYY.md` est généré dans le dossier `output/`.

---

Workflow en deux étapes : **organiser** les PDFs bruts pour les normaliser, puis **générer un bilan** chiffré par mois et par an.

---

## Structure du projet

```
sncf-trip-proofs/
├── justificatif-achat/
│   ├── inbox/                          ← PDFs bruts d'achat
│   ├── output/                         ← PDFs organisés (vidé/recréé à chaque --real)
│   ├── curate-justificatifs-achat.py
│   └── README.md
├── justificatif-voyage/
│   ├── inbox/                          ← PDFs bruts de voyage
│   ├── output/                         ← PDFs organisés (vidé/recréé à chaque --real)
│   ├── curate-justificatifs-voyage.py
│   └── README.md
├── bilan-depenses-train.py             ← génère le bilan
├── plan-bilan-depenses-train.md
└── README.md
```

---

## Prérequis (une seule fois)

```bash
brew install tesseract tesseract-lang poppler
pip3 install pdfplumber pdf2image pytesseract Pillow
```

---

## Étape 1 — Organiser les justificatifs

### Justificatifs d'achat

Format de sortie : `justificatif_achat_<DATES>_<PRIX>_<REF>[_N].pdf`

```
20260402_0701_JustificatifAchat_SNCFCONNECT.pdf
    → justificatif_achat_20260402_18-50TTC_1917346212-20260504.pdf

20260423_JustificatifAchat_SNCFCONNECT.pdf   (4 tickets, 2 jours)
    → justificatif_achat_20260423-20260424_57-00TTC_1480540391-20260504.pdf
```

```bash
cd justificatif-achat/
python3 curate-justificatifs-achat.py            # dry-run (défaut)
python3 curate-justificatifs-achat.py --real     # copie dans output/
```

### Justificatifs de voyage

Format de sortie : `JustificatifVoyage_<DATE>_<PRIX>_<REF>[_<TCN>][_N].pdf`

```
JustificatifVoyage_brut.pdf
    → JustificatifVoyage_20260402_18-50TTC_NE3ERM_016487606.pdf
```

```bash
cd justificatif-voyage/
python3 curate-justificatifs-voyage.py           # dry-run (défaut)
python3 curate-justificatifs-voyage.py --real    # copie dans output/
```

Les fichiers sources dans `inbox/` ne sont **jamais modifiés**.

---

## Étape 2 — Générer le bilan

Lit les justificatifs organisés (achat ou voyage) et génère `bilan-depenses-train-YYYY.md`.

Les deux formats de noms sont reconnus directement depuis le nom de fichier — aucune relecture PDF nécessaire.

```bash
# Justificatifs d'achat
python3 bilan-depenses-train.py justificatif-achat/output

# Justificatifs de voyage
python3 bilan-depenses-train.py justificatif-voyage/output

# IN et OUT distincts
python3 bilan-depenses-train.py justificatif-achat/output ./bilans/
```

### Sortie console (exemple)

```
Lecture de : /…/justificatif-voyage/output
22 fichier(s) PDF trouvé(s)

✓ 22 trajet(s) extrait(s) depuis 22 ticket(s)

── Détail des trajets ──────────────────────────────

  16/03/2026  (1 trajet(s) — 15,60 €)
    • [calc] 15,60 €  ←  JustificatifVoyage_20260316_15-60TTC_D56QEJ.pdf

  02/04/2026  (2 trajet(s) — 37,00 €)
    • [calc] 18,50 €  ←  JustificatifVoyage_20260402_18-50TTC_NE3ERM_016487606.pdf
    • [calc] 18,50 €  ←  JustificatifVoyage_20260402_18-50TTC_NE3T6X_016487554.pdf
  …

✓ Bilan généré : bilan-depenses-train-2026.md
  → /…/justificatif-voyage/output/bilan-depenses-train-2026.md
```

`[PDF]` = prix extrait du PDF (multi-tickets achat). `[calc]` = montant du nom de fichier.

### Fichier généré (extrait)

```markdown
# Bilan dépenses train — 2026

Généré le 2026-05-04 | 22 trajet(s) depuis 22 ticket(s) analysé(s) sur 22 | 0 erreur(s)

## Récapitulatif global

| Métrique              | Valeur        |
|-----------------------|---------------|
| **Total TTC**         | **346,10 €**  |
| Nombre de trajets     | 22            |
| Coût moyen / trajet   | 15,73 €       |
| Période couverte      | Mars 2026 → Avril 2026 |

## Détail par mois

| Mois        | Trajets | Total TTC |
|-------------|---------|-----------|
| Mars 2026   |       3 |   44,10 € |
| Avril 2026  |      19 |  302,00 € |
```

---

## Cas particuliers

| Situation | Comportement |
|---|---|
| PDF illisible (corrompu) | Erreur en console + listé dans le bilan |
| Nom non reconnu | Tentative fallback lecture PDF |
| Champ manquant après fallback | Erreur en console + listé dans le bilan |
| Dossier IN vide | Message "Rien à traiter", pas de fichier généré |
| Plusieurs années mélangées | Un fichier bilan par année |
| Fichiers non-PDF dans IN | Ignorés silencieusement |
| Deux sources au contenu identique | `[DOUBLON SOURCE]` — seul le plus ancien est gardé |
| Deux fichiers → même nom cible | `[CONFLIT NOM]` — checksum puis numérotation `_1`, `_2`, … |
| Même commande achat re-téléchargée | `[DOUBLON]` dans le bilan — second fichier ignoré |

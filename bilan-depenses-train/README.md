# sncf-trip-proofs

Outils pour déclarer les frais de train au réel, à partir des justificatifs d'achat SNCF Connect.

Le workflow en deux étapes : **renommer** les PDFs bruts pour les normaliser, puis **générer un bilan** chiffré par mois et par an.

---

## Structure du projet

```
sncf-trip-proofs/
├── justificatif-achat/
│   ├── inbox/                       ← déposer les PDFs bruts ici
│   ├── output/                      ← PDFs renommés (créé automatiquement)
│   ├── rename-justificatifs-achat.py
│   └── README.md
├── bilan-depenses-train.py          ← génère le bilan
└── README.md
```

---

## Prérequis (une seule fois)

```bash
brew install tesseract tesseract-lang poppler
pip3 install pdfplumber pdf2image pytesseract Pillow
```

---

## Étape 1 — Renommer les justificatifs

Les PDFs téléchargés depuis SNCF Connect ont des noms génériques. Ce script les renomme en extrayant automatiquement la date, le montant et la référence depuis le contenu du PDF.

**Format de sortie :**
```
justificatif_achat_YYYYMMDD_PP-PPTTC_REF.pdf
```

**Exemples :**
```
20260402_0701_JustificatifAchat_SNCFCONNECT.pdf
    → justificatif_achat_20260402_18-50TTC_1917346212-20260504.pdf

20260403_1749_JustificatifAchat_SNCFCONNECT.pdf
    → justificatif_achat_20260403_67-50TTC_307895633-20260504.pdf
```

### Utilisation

```bash
cd justificatif-achat/

# 1. Déposer les PDFs bruts dans inbox/

# 2. Simuler — voir les noms générés sans rien modifier
python3 rename-justificatifs-achat.py --dry-run

# 3. Appliquer — copie les fichiers renommés dans output/
python3 rename-justificatifs-achat.py --real
```

Les fichiers sources dans `inbox/` ne sont **jamais modifiés**.

### Sortie console (exemple)

```
Mode    : RÉEL (copie vers output/)
Source  : inbox
Sortie  : output
Fichiers: 3

→ 20260402_0701_JustificatifAchat_SNCFCONNECT.pdf
  date      : 20260402
  montant   : 18-50TTC
  référence : 1917346212-20260504
  → output/justificatif_achat_20260402_18-50TTC_1917346212-20260504.pdf
  ✓ copié dans output/

→ 20260403_1749_JustificatifAchat_SNCFCONNECT.pdf
  date      : 20260403
  montant   : 67-50TTC
  référence : 307895633-20260504
  → output/justificatif_achat_20260403_67-50TTC_307895633-20260504.pdf
  ✓ copié dans output/

→ facture_incomprehensible.pdf
  [MANQUANT] champs non extraits : montant
  → fichier non traité

────────────────────────────────────────
Résultat : 2/3 fichier(s) traité(s) avec succès
```

---

## Étape 2 — Générer le bilan

Lit les justificatifs renommés dans un dossier et génère un fichier `bilan-depenses-train-YYYY.md` avec les totaux par mois et par an.

### Utilisation

```bash
# Cas standard : IN = output/ des justificatifs renommés, OUT = même dossier
python3 bilan-depenses-train.py justificatif-achat/output

# IN et OUT distincts (ex : centraliser les bilans ailleurs)
python3 bilan-depenses-train.py justificatif-achat/output ./bilans/

# Sans argument : IN = OUT = répertoire courant
cd justificatif-achat/output
python3 ../../bilan-depenses-train.py
```

> Impossible de spécifier uniquement le OUT. Un seul argument = c'est le IN.

### Sortie console (exemple)

```
Lecture de : /…/justificatif-achat/output
19 fichier(s) PDF trouvé(s)

✓ 19 traité(s) avec succès

✓ Bilan généré : bilan-depenses-train-2026.md
  → /…/justificatif-achat/output/bilan-depenses-train-2026.md
```

Si des fichiers posent problème (fallback PDF tenté, puis erreur) :
```
Lecture de : /…/justificatif-achat/output
21 fichier(s) PDF trouvé(s)

  [FALLBACK PDF] facture_modifiee.pdf
  ✗ document_inconnu.pdf → Nom non reconnu et lecture PDF échouée

✓ 19 traité(s) avec succès
✗ 2 erreur(s) :
  - facture_modifiee.pdf → Date invalide : 00000000
  - document_inconnu.pdf → Nom non reconnu et lecture PDF échouée

✓ Bilan généré : bilan-depenses-train-2026.md
  → /…/justificatif-achat/output/bilan-depenses-train-2026.md
```

> Les warnings internes de pdfplumber (`FontBBox`, etc.) sont supprimés automatiquement — la sortie reste propre.

### Fichier généré (exemple réel)

```markdown
# Bilan dépenses train — 2026

Généré le 2026-05-04 | 19 justificatif(s) traité(s) sur 19 | 0 erreur(s)

---

## Récapitulatif global

| Métrique              | Valeur        |
|-----------------------|---------------|
| **Total TTC**         | **432,10 €**  |
| Nombre de trajets     | 19            |
| Coût moyen / trajet   | 22,74 €       |
| Période couverte      | Mars 2026 → Avril 2026 |

---

## Détail par mois

| Mois           | Trajets | Total TTC     |
|----------------|---------|---------------|
| Mars 2026      |       6 |       82,60 € |
| Avril 2026     |      13 |      349,50 € |
```

Si des erreurs sont présentes, une section supplémentaire liste les fichiers non traités et la raison.

Si les justificatifs couvrent **plusieurs années**, un fichier par année est généré (`bilan-depenses-train-2025.md`, `bilan-depenses-train-2026.md`, etc.).

---

## Cas particuliers

| Situation | Comportement |
|---|---|
| PDF illisible (corrompu) | Erreur en console + listé dans le bilan |
| Nom de fichier non reconnu | Tentative de lecture PDF en fallback |
| Champ manquant après fallback | Erreur en console + listé dans le bilan |
| Dossier IN vide | Message "Rien à traiter", pas de fichier généré |
| Plusieurs années mélangées | Un fichier bilan par année |
| Fichiers non-PDF dans IN | Ignorés silencieusement |

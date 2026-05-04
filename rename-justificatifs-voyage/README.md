# rename-justificatifs-voyage

Renomme automatiquement les justificatifs de voyage SNCF Connect au format :

```
JustificatifVoyage_<DATE>_<PRIX>_<REFERENCE>[_<TCN>].pdf
```

Exemples :
- `JustificatifVoyage_20260316_15-60TTC_D56QEJ.pdf` (pas de TCN)
- `JustificatifVoyage_20260326_10-00TTC_M56QD3_016404373.pdf` (avec TCN)

---

## Structure des dossiers

```
justificatif-voyage/
├── inbox/                          ← déposer les PDFs bruts ici
├── output/                         ← fichiers renommés (créé automatiquement)
├── rename-justificatifs-voyage.py
└── README.md
```

---

## Prérequis

### Système (une seule fois)

```bash
brew install tesseract tesseract-lang poppler
```

### Python (une seule fois)

```bash
pip3 install pdfplumber pdf2image pytesseract Pillow
```

---

## Utilisation

### Workflow standard

1. Déposer les PDFs dans `inbox/`
2. Simuler pour vérifier les noms générés :

```bash
python3 rename-justificatifs-voyage.py
python3 rename-justificatifs-voyage.py --dry-run
```

3. Appliquer — les fichiers renommés sont copiés dans `output/` :

```bash
python3 rename-justificatifs-voyage.py --real
```

Les fichiers sources dans `inbox/` ne sont pas modifiés.

### Un seul fichier

```bash
python3 rename-justificatifs-voyage.py mon_justificatif.pdf --dry-run
python3 rename-justificatifs-voyage.py mon_justificatif.pdf --real
```

---

## Comportement

| Cas | `--dry-run` | `--real` |
|---|---|---|
| Tous les champs extraits | Affiche le nouveau nom | Copie dans `output/` |
| Champ(s) manquant(s) | Affiche `[MANQUANT] champs non extraits : …`, continue les autres fichiers | Affiche `[MANQUANT]` + `→ fichier non traité`, ne copie pas |
| PDF illisible (natif + OCR) | Affiche `[ERREUR] lecture impossible`, continue | idem |
| PDF illisible en natif uniquement | Bascule OCR automatiquement (`[OCR]`) | idem |
| Fichier cible déjà existant dans `output/` | — | Demande confirmation interactive (o/N) par fichier ; si >3 conflits détectés, propose d'abord « Remplacer tous les doublons ? [o/N] » |

En fin d'exécution, le script affiche toujours `Résultat : X/Y fichier(s) traité(s) avec succès` — les fichiers avec champs manquants ou illisibles ne sont pas comptés dans X.

---

## Formats reconnus

Deux structures de justificatif SNCF Connect sont gérées :

**Structure A** — date numérique, libellé `Montant TOTAL de la commande`
```
voyage du 16-03-2026
Montant TOTAL de la commande 15,60 €
Référence D56QEJ
```

**Structure B** — date en lettres, libellé `Montant du voyage`, référence sur deux mots, TCN présent
```
voyage du 26 mars 2026
Montant du voyage 10,00 €
Référence de commande M56QD3
TCN 016404373
```

---

## Comment fonctionne l'extraction

1. **Texte natif** (`pdfplumber`) — lit le texte embarqué. Rapide, précis pour les PDFs numériques.
2. **OCR local** (`pdf2image` + `pytesseract`) — fallback si le texte est absent/illisible. 100% local, sans réseau.

### Champs extraits

| Champ | Formats reconnus | Sortie | Obligatoire |
|---|---|---|---|
| Date | `voyage du 16-03-2026`, `voyage du 26 mars 2026`, `26/03/2026` | `20260316` | oui |
| Montant | `15,60 €`, `10,00 €`, `18 EUR` | `15-60TTC` | oui |
| Référence | `Référence D56QEJ`, `Référence de commande M56QD3` | `D56QEJ` | oui |
| TCN | `TCN 016404373` | `016404373` | non (omis si absent) |

---

## Dépannage

**Tesseract non trouvé**
```bash
brew install tesseract tesseract-lang
```

**Module Python manquant**
```bash
pip3 install pdfplumber pdf2image pytesseract Pillow
```

**Champ non détecté** — lancer en `--dry-run` pour voir `[MANQUANT]` et identifier le champ problématique.

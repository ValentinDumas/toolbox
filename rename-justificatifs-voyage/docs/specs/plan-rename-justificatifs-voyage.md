# Plan — rename_justificatifs

## Objectif

Renommer automatiquement des PDFs de justificatifs de transport SNCF au format :
`JustificatifVoyage_<DATE>_<PRIX>_<REFERENCE>[_<TCN>].pdf`

Exemples :
- `JustificatifVoyage_20260316_15-60TTC_D56QEJ.pdf` (Structure A — pas de TCN)
- `JustificatifVoyage_20260326_10-00TTC_M56QD3_016404373.pdf` (Structure B — avec TCN)

---

## Structure des dossiers

```
justificatif-voyage/
├── inbox/    ← PDFs bruts déposés ici (non modifiés)
├── output/   ← PDFs renommés générés ici (créé automatiquement par --real)
├── rename-justificatifs-voyage.py
└── README.md
```

**Principe** : le script lit `inbox/`, écrit dans `output/` via `shutil.copy2`. Les sources ne sont jamais modifiées.

---

## Modes d'exécution

| Mode | Comportement |
|---|---|
| `--dry-run` (défaut) | Affiche les renommages prévus, ne touche rien |
| `--real` | Copie les fichiers renommés dans `output/` |

---

## Utilisation

```bash
# Traite tous les PDFs de inbox/
python3 rename_justificatifs.py --dry-run
python3 rename_justificatifs.py --real

# Traite un seul fichier (glisser-déposer)
python3 rename_justificatifs.py fichier.pdf --dry-run
python3 rename_justificatifs.py fichier.pdf --real
```

---

## Extraction du texte PDF

### Stratégie (fiable, gratuite, sans API)

1. **Tentative 1 — texte natif** : `pdfplumber` lit le texte embarqué dans le PDF (rapide, précis).
2. **Tentative 2 — OCR en RAM** : si le texte extrait est vide ou illisible, convertir les pages en images en mémoire (`pdf2image` + `Pillow`) puis passer `pytesseract` (Tesseract local, gratuit).

Les deux méthodes fonctionnent 100% localement, sans payer, sans réseau.

### Dépendances Python

```
pdfplumber       # extraction texte natif
pdf2image        # conversion PDF → images en RAM (fallback OCR)
pytesseract      # OCR local via Tesseract
Pillow           # manipulation images
```

### Dépendances système

```
tesseract      # moteur OCR (brew install tesseract)
tesseract-lang # langue française (brew install tesseract-lang)
poppler        # requis par pdf2image (brew install poppler)
```

---

## Structures de PDF reconnues

Deux formats SNCF Connect observés, tous deux gérés :

### Structure A — référence courte, date numérique

```
JUSTIFICATIF DE VOYAGE
Paris, le 30.03.2026
...voyage du 16-03-2026.
ALLER le 16-03-2026 de PARIS ST LAZARE à ROUEN RIVE DROITE Seconde classe
VALENTIN DUMAS 15,60 €
Montant TOTAL de la commande 15,60 €
Référence D56QEJ
```

### Structure B — référence avec libellé, date en lettres

```
JUSTIFICATIF DE VOYAGE
Paris, le 30 mars 2026
...voyage du 26 mars 2026...
Aller le 26/03/2026 2nde Classe
Montant du voyage 10,00 €
Référence de commande M56QD3
```

---

## Données à extraire

### 1. Date du voyage

Priorité décroissante :
1. Pattern numérique après `voyage du` / `ALLER le` / `Retour le` → `16-03-2026` → `20260316`
2. Pattern mois en lettres FR après `voyage du` → `26 mars 2026` → `20260326`
3. Fallback : premier mois en lettres FR trouvé dans le texte
4. Fallback : première date numérique trouvée

**Piège évité** : la date d'édition de la lettre (`Paris, le 30.03.2026`) apparaît avant la date du voyage — la priorité sur le contexte `voyage du` / `ALLER le` permet de l'ignorer.

### 2. Montant TTC

Priorité décroissante :
1. Montant sur la ligne contenant `TOTAL` ou `Montant TOTAL` → `15,60 €` → `15-60TTC`
2. Fallback : premier montant ≤4 chiffres entiers avec séparateur décimal → `10,00 €` → `10-00TTC`

**Piège évité** : le pied de page contient `157 789 960 euros` (capital social). Limiter à ≤4 chiffres entiers et prioriser la ligne `TOTAL` évite ce faux positif.

**Note technique** : `€` est un caractère non-word (`\W`), donc `\b` après `€` ne matche pas en fin de ligne. Remplacement par lookahead `(?=\s|$|[,;])`.

### 3. Référence commande

1. Cherche un code alphanumérique 5-10 chars après mot-clé `référence`, `commande`, `booking`, `dossier`
2. Fallback : pattern standalone lettres+chiffres isolé

### 4. TCN (Transaction Control Number)

- Pattern : `TCN <6-12 chiffres>` (insensible à la casse)
- Présent sur Structure B, absent sur Structure A
- **Optionnel** : inclus en suffixe quand présent, omis sinon
- Rôle : différencier des voyages avec la même référence commande

---

## Structure du script

```
rename_justificatifs.py
│
├── extract_text(path)     → str
│   ├── extract_text_native()   pdfplumber
│   └── extract_text_ocr()      pdf2image + pytesseract (fallback)
├── parse_date(text)       → "20260316" | None
├── parse_amount(text)     → "15-60TTC" | None
├── parse_reference(text)  → "D56QEJ" | None
├── parse_tcn(text)        → "016404373" | None
└── process_file(path, output_dir, dry_run)  → copie ou simule
```

---

## Comportement en cas d'échec d'extraction

| Situation | `--dry-run` | `--real` |
|---|---|---|
| Champ manquant | Affiche `[MANQUANT]`, continue | Ne copie pas, erreur explicite |
| Fichier cible déjà existant dans `output/` | — | Demande confirmation à l'utilisateur (o/N) |
| Utilisateur refuse le remplacement | — | Annule ce fichier, passe au suivant |
| PDF illisible en natif | Bascule OCR automatiquement | idem |

---

## État d'implémentation

- [x] Dépendances installées (`pdfplumber`, `pdf2image`, `pytesseract`, `Pillow`, `tesseract`, `poppler`)
- [x] `extract_text()` avec fallback OCR
- [x] `parse_date()` — priorité contexte voyage, fallback lettres FR puis numérique
- [x] `parse_amount()` — priorité ligne TOTAL, fix `\b`/`€`, protection capital social
- [x] `parse_reference()` — priorité mot-clé, fallback standalone
- [x] `parse_tcn()` — pattern `TCN <6-12 chiffres>`, optionnel (absent → omis du nom)
- [x] `process_file()` — dry-run vs réel, lecture `inbox/`, écriture `output/`
- [x] Testé sur Structure A (`D56QEJ`, `15-60TTC`, `20260316`, pas de TCN) ✓
- [x] Testé sur Structure B (`M56QD3`, `10-00TTC`, `20260326`, TCN `016404373`) ✓
- [x] Structure inbox/output mise en place ✓

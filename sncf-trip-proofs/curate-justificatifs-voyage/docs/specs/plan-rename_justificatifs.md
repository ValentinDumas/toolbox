# Plan — curate-justificatifs-voyage

## Objectif

Organiser automatiquement des PDFs de justificatifs de transport SNCF au format :
`JustificatifVoyage_<DATE>_<PRIX>_<REFERENCE>[_<TCN>][_<N>].pdf`

Exemples :
- `JustificatifVoyage_20260316_15-60TTC_D56QEJ.pdf` (Structure A — pas de TCN)
- `JustificatifVoyage_20260326_10-00TTC_M56QD3_016404373.pdf` (Structure B — avec TCN)

---

## Structure des dossiers

```
curate-justificatifs-voyage/
├── inbox/    ← PDFs bruts déposés ici (non modifiés)
├── output/   ← PDFs organisés (vidé et recréé à chaque --real)
├── curate-justificatifs-voyage.py
└── README.md
```

**Principe** : `inbox/` est la source de vérité. `output/` est une zone de sortie pure — vidée puis régénérée intégralement à chaque `--real`. Les sources ne sont jamais modifiées.

---

## Modes d'exécution

| Mode | Comportement |
|---|---|
| `--dry-run` (défaut) | Affiche les noms générés, ne touche rien |
| `--real` | Vide `output/` (confirmation utilisateur), puis copie les fichiers organisés |

---

## Utilisation

```bash
# Traite tous les PDFs de inbox/
python3 curate-justificatifs-voyage.py --dry-run
python3 curate-justificatifs-voyage.py --real

# Traite un seul fichier (glisser-déposer — pas de wipe output/)
python3 curate-justificatifs-voyage.py fichier.pdf --dry-run
python3 curate-justificatifs-voyage.py fichier.pdf --real
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

1. Pattern `commande\s+<CODE>` après mot-clé `référence` — `Référence de commande NE3ERM` → `NE3ERM`
2. Pattern `référence\s+<CODE>` direct — `Référence D56QEJ` → `D56QEJ`

**Piège évité** : `[^\n]*?([A-Z0-9]{5,10})` capture le premier token 5-10 chars sur la ligne, soit "COMMANDE" lui-même. Fix : deux patterns distincts — d'abord avec "commande" comme pivot, puis directement après "référence".

### 4. TCN (Transaction Control Number)

- Pattern : `TCN <6-12 chiffres>` (insensible à la casse)
- Présent sur Structure B, absent sur Structure A
- **Optionnel** : inclus en suffixe quand présent, omis sinon
- Rôle : différencier des voyages avec la même référence commande

---

## Structure du script

```
curate-justificatifs-voyage.py
│
├── deduplicate_sources(files)  → list[Path]   [passe 1 — avant extraction]
├── extract_text(path)          → str
│   ├── pdfplumber (texte natif)
│   └── pdf2image + pytesseract (fallback OCR)
├── parse_fields(text)          → Fields
│   ├── _parse_date(text)       → "20260316" | None
│   ├── _parse_amount(text)     → "15-60TTC" | None
│   ├── _parse_ref(text)        → "D56QEJ" | None
│   └── _parse_tcn(text)        → "016404373" | None
├── resolve_conflicts(parsed)   → list          [passe 2 — après extraction]
├── wipe_output(output_dir)     → None          [--real uniquement]
└── process_file(...)           → copie ou simule
```

---

## Comportement en cas d'échec d'extraction

| Situation | `--dry-run` | `--real` |
|---|---|---|
| Champ manquant | Affiche `[MANQUANT]`, continue | Ne copie pas, erreur explicite |
| PDF illisible en natif | Bascule OCR automatiquement | idem |

---

## Déduplication — deux passes

### Passe 1 — sources identiques (`deduplicate_sources`)

Appelée **avant l'extraction PDF**, sur la liste des fichiers sources.

**Algorithme** :
1. Calculer le checksum MD5 de chaque fichier source
2. Grouper par checksum
3. Pour chaque groupe de taille > 1 : afficher `[DOUBLON SOURCE]`, garder le plus ancien (tri primaire : `st_birthtime`, tri secondaire : `st_mtime`), ignorer les autres

**Avantage performance** : les doublons sont éliminés avant l'extraction (pdfplumber / OCR), donc aucune lecture inutile.

### Passe 2 — noms cibles identiques (`resolve_conflicts`)

Appelée **après extraction**, sur la liste des `(path, fields)`.

**Algorithme** :
1. Grouper les fichiers valides par nom cible calculé
2. Pour chaque groupe de taille > 1 :
   - Calculer le checksum MD5
   - **Identiques** → doublon résiduel, garder le premier, ignorer les autres
   - **Différents** → trier par date de création, numéroter `_1`, `_2`, … en suffixe

**Format résultant avec compteur** :
- `JustificatifVoyage_20260416_18-50TTC_N4M4XX_016733616_1.pdf`
- `JustificatifVoyage_20260416_18-50TTC_N4M4XX_016733616_2.pdf`

---

## Gestion de output/

`wipe_output()` est appelée en début de `--real` (uniquement quand `output_dir == OUTPUT`, pas en mode fichier unique) :
1. Compte les fichiers existants
2. Affiche `[OUTPUT] 'output/' sera vidé (N fichier(s)) avant regénération.`
3. Demande confirmation `[o/N]` — quitte si refusé
4. `shutil.rmtree` + `mkdir`

**Résultat** : `output/` est toujours en sync exact avec `inbox/`. Aucun fichier mort possible.

---

## État d'implémentation

- [x] Script `curate-justificatifs-voyage.py` créé (renommé depuis `rename-`)
- [x] Dépendances installées (`pdfplumber`, `pdf2image`, `pytesseract`, `Pillow`, `tesseract`, `poppler`)
- [x] `extract_text()` avec fallback OCR
- [x] `_parse_date()` — priorité contexte voyage, fallback lettres FR puis numérique
- [x] `_parse_amount()` — priorité ligne TOTAL, fix `\b`/`€`, protection capital social
- [x] `_parse_ref()` — priorité mot-clé, fallback standalone
- [x] `_parse_tcn()` — pattern `TCN <6-12 chiffres>`, optionnel (absent → omis du nom)
- [x] `deduplicate_sources()` — passe 1 : élimination des sources identiques (MD5) avant extraction
- [x] `resolve_conflicts()` — passe 2 : noms cibles identiques → checksum + numérotation par date de création
- [x] `wipe_output()` — vidage de output/ avec confirmation avant regénération
- [x] `process_file()` — dry-run vs réel, simplifié (pas de gestion de conflits output)
- [x] Testé sur Structure A (`D56QEJ`, `15-60TTC`, `20260316`, pas de TCN) ✓
- [x] Testé sur Structure B (`M56QD3`, `10-00TTC`, `20260326`, TCN `016404373`) ✓
- [x] Testé sur 22 fichiers réels (22/22 dry-run et --real) ✓
- [x] Structure inbox/output mise en place ✓

# curate-justificatifs-voyage

Organise automatiquement les justificatifs de voyage SNCF Connect au format :

```
justificatif-voyage-<DATE>-<PRIX>-<REFERENCE>[-<TCN>][-<N>].pdf
```

Exemples :
- `justificatif-voyage-20260316-15-60ttc-D56qej.pdf` (pas de TCN)
- `justificatif-voyage-20260326-10-00ttc-M56qd3-016404373.pdf` (avec TCN)
- `justificatif-voyage-20260416-18-50ttc-N4M4xx-016733616-1.pdf` (conflit résolu — voir ci-dessous)

---

## Structure des dossiers

```
curate-justificatifs-voyage/
├── inbox/                          ← déposer les PDFs bruts ici
├── output/                         ← fichiers organisés (vidé et recréé à chaque --real)
├── curate-justificatifs-voyage.py
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
python3 curate-justificatifs-voyage.py
python3 curate-justificatifs-voyage.py --dry-run
```

3. Appliquer — les fichiers renommés sont copiés dans `output/` :

```bash
python3 curate-justificatifs-voyage.py --real
```

Les fichiers sources dans `inbox/` ne sont pas modifiés.

### Un seul fichier

```bash
python3 curate-justificatifs-voyage.py mon_justificatif.pdf --dry-run
python3 curate-justificatifs-voyage.py mon_justificatif.pdf --real
```

### Via config.json (optionnel)

Si `sncf-trip-proofs/config.json` contient des chemins non-vides pour `curate-justificatifs-voyage`, le script les utilise sans argument :

```json
{
  "curate-justificatifs-voyage": {
    "in": "/Users/alice/sncf/inbox-voyage",
    "out": "/Users/alice/sncf/output-voyage"
  }
}
```

```bash
python3 curate-justificatifs-voyage.py          # lit in/out depuis config.json
python3 curate-justificatifs-voyage.py --real
```

Priorité : argument CLI fichier > `config.json` > `inbox/` et `output/` locaux.

---

## Comportement

| Cas | `--dry-run` | `--real` |
|---|---|---|
| Tous les champs extraits | Affiche le nouveau nom | Copie dans `output/` |
| Champ(s) manquant(s) | Affiche `[MANQUANT] champs non extraits : …`, continue les autres fichiers | Affiche `[MANQUANT]` + `→ fichier non traité`, ne copie pas |
| PDF illisible (natif + OCR) | Affiche `[ERREUR] lecture impossible`, continue | idem |
| PDF illisible en natif uniquement | Bascule OCR automatiquement (`[OCR]`) | idem |
| Fichier cible déjà existant dans `output/` | — | Demande confirmation interactive (o/N) par fichier ; si >3 conflits détectés, propose d'abord « Remplacer tous les doublons ? [o/N] » |
| Deux sources au contenu identique | Affiche `[DOUBLON SOURCE]` + ignoré | idem |
| Deux sources → même nom cible, contenu identique | Affiche `[CONFLIT NOM]` + doublon ignoré | idem |
| Deux sources → même nom cible, contenu différent | Affiche `[CONFLIT NOM]` + numérotation `_1`, `_2`, … | idem |

En fin d'exécution, le script affiche toujours `Résultat : X/Y fichier(s) traité(s) avec succès` — les fichiers avec champs manquants ou illisibles ne sont pas comptés dans X.

### Déduplication en deux passes

**Passe 1 — avant extraction** (`[DOUBLON SOURCE]`) : le script calcule le checksum MD5 de chaque fichier source. Si deux fichiers ont le même contenu, seul le plus ancien est gardé — les autres sont ignorés et signalés. Cette passe évite de lancer inutilement l'extraction PDF sur des doublons.

**Passe 2 — après extraction** (`[CONFLIT NOM]`) : si deux fichiers distincts produisent le même nom cible (mêmes date, montant, référence), le script vérifie leurs checksums :
- **Identiques** → doublon résiduel, ignoré.
- **Différents** → le plus ancien reçoit le suffixe `_1`, le suivant `_2`, etc.

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

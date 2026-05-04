# rename-justificatifs-achat

Renomme automatiquement les justificatifs d'achat PDF au format :

```
justificatif_achat_<DATE>_<PRIX>_<REF>.pdf
```

Exemples :
- `justificatif_achat_20260330_18-50TTC_2668453920-20260330.pdf`
- `justificatif_achat_20260401_5-00TTC_1234567890-20260401.pdf`

---

## Structure des dossiers

```
justificatif-achat/
├── inbox/                           ← déposer les PDFs bruts ici
├── output/                          ← fichiers renommés (créé automatiquement)
├── rename-justificatifs-achat.py
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
python3 rename-justificatifs-achat.py
python3 rename-justificatifs-achat.py --dry-run
```

3. Appliquer — les fichiers renommés sont copiés dans `output/` :

```bash
python3 rename-justificatifs-achat.py --real
```

Les fichiers sources dans `inbox/` ne sont pas modifiés.

### Un seul fichier

```bash
python3 rename-justificatifs-achat.py mon_justificatif.pdf --dry-run
python3 rename-justificatifs-achat.py mon_justificatif.pdf --real
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

En fin d'exécution, le script affiche toujours `Résultat : X/Y fichier(s) traité(s) avec succès`.

---

## Formats reconnus

**Référence** — format `N°XXXXXXXXXX-YYYYMMDD` :
```
N°2668453920-20260330
```
→ `2668453920-20260330` (le préfixe `N°` est retiré)

**Montant** — symbole `€` avant le chiffre :
```
€18,50    →  18-50TTC
€5        →  5-00TTC
```
Fallback si `€` est après : `18,50 €`, `18,50 EUR`.

**Date** — plusieurs formats acceptés, du plus précis au moins précis :

| Format dans le document | Exemple | Priorité |
|---|---|---|
| Date de voyage (ligne Aller/Departure) | `Aller 02/04/2026`, `Departure 16/03/2026` | 0 (priorité max) |
| Numérique avec contexte | `du 30/03/2026`, `le 30-03-2026` | 1 |
| Lettres avec contexte | `le 30 mars 2026` | 2 |
| Lettres sans contexte | `30 mars 2026` | 3 |
| Numérique seul | `30/03/2026` | 4 |
| Extrait de la référence | `N°2668453920-20260330` → `20260330` | 5 (fallback) |

---

## Comment fonctionne l'extraction

1. **Texte natif** (`pdfplumber`) — lit le texte embarqué. Rapide, précis pour les PDFs numériques.
2. **OCR local** (`pdf2image` + `pytesseract`) — fallback si le texte est absent/illisible. 100% local, sans réseau.

### Champs extraits

| Champ | Formats reconnus | Sortie | Obligatoire |
|---|---|---|---|
| Date | `30/03/2026`, `30 mars 2026`, date dans la REF | `20260330` | oui |
| Montant | `€18,50`, `€5`, `18,50 €` | `18-50TTC` | oui |
| Référence | `N°2668453920-20260330` | `2668453920-20260330` | oui |

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

**Message `Could not get FontBBox from font descriptor`** — avertissement inoffensif de `pdfminer` sur des PDFs avec des métadonnées de police incomplètes. L'extraction de texte fonctionne normalement. Le script supprime automatiquement ce message.

# curate-justificatifs-achat

Organise automatiquement les justificatifs d'achat PDF au format :

```
justificatif_achat_<DATES>_<PRIX>_<REF>[_<N>].pdf
```

1 PDF = 1 commande. `<DATES>` reflète la période réelle couverte par tous les tickets de la commande.

Exemples :
- `justificatif_achat_20260316_10-00TTC_2012890177-20260315.pdf` (1 ticket, 1 jour)
- `justificatif_achat_20260423-20260424_57-00TTC_1480540391-20260504.pdf` (4 tickets, 2 jours)
- `justificatif_achat_20260327_18-50TTC_2668453920-20260330_1.pdf` (conflit résolu — voir ci-dessous)

---

## Structure des dossiers

```
curate-justificatifs-achat/
├── inbox/                           ← déposer les PDFs bruts ici
├── output/                          ← fichiers organisés (vidé et recréé à chaque --real)
├── curate-justificatifs-achat.py
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
python3 curate-justificatifs-achat.py
python3 curate-justificatifs-achat.py --dry-run
```

3. Appliquer — les fichiers renommés sont copiés dans `output/` :

```bash
python3 curate-justificatifs-achat.py --real
```

Les fichiers sources dans `inbox/` ne sont pas modifiés.

### Un seul fichier

```bash
python3 curate-justificatifs-achat.py mon_justificatif.pdf --dry-run
python3 curate-justificatifs-achat.py mon_justificatif.pdf --real
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
| Deux sources au contenu identique | Affiche `[DOUBLON SOURCE]` + ignoré | idem |
| Deux sources → même nom cible, contenu identique | Affiche `[CONFLIT NOM]` + doublon ignoré | idem |
| Deux sources → même nom cible, contenu différent | Affiche `[CONFLIT NOM]` + numérotation `_1`, `_2`, … | idem |

En fin d'exécution, le script affiche toujours `Résultat : X/Y fichier(s) traité(s) avec succès`.

### Déduplication en deux passes

**Passe 1 — avant extraction** (`[DOUBLON SOURCE]`) : le script calcule le checksum MD5 de chaque fichier source. Si deux fichiers ont le même contenu, seul le plus ancien est gardé — les autres sont ignorés et signalés. Cette passe évite de lancer inutilement l'extraction PDF sur des doublons.

**Passe 2 — après extraction** (`[CONFLIT NOM]`) : si deux fichiers distincts produisent le même nom cible (mêmes date, montant, référence), le script vérifie leurs checksums :
- **Identiques** → doublon résiduel, ignoré.
- **Différents** → le plus ancien reçoit le suffixe `_1`, le suivant `_2`, etc.

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

**Dates de la commande** — le script collecte toutes les dates de tickets (`Aller`/`Retour`/`Departure`/`Return`) et construit la période :

| Cas | Résultat |
|---|---|
| 1 seul jour | `20260423` |
| Plusieurs jours | `20260423-20260424` (premier–dernier, trié) |

Si aucun ticket trouvé, fallback par priorité décroissante :

| Format dans le document | Exemple | Priorité |
|---|---|---|
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

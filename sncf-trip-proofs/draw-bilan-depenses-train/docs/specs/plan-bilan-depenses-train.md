# Plan — draw-bilan-depenses-train.py

Script qui lit les justificatifs renommés (achat et voyage) et génère un bilan de dépenses.

---

## Contexte

Deux types de justificatifs renommés sont supportés :

**Justificatif d'achat** (`curate-justificatifs-achat.py`) :
```
justificatif_achat_YYYYMMDD_PP-PPTTC_XXXXXXXXXX-YYYYMMDD.pdf
```
Exemple : `justificatif_achat_20260330_18-50TTC_2668453920-20260330.pdf`

**Justificatif de voyage** (`curate-justificatifs-voyage.py`) :
```
JustificatifVoyage_YYYYMMDD_PP-PPTTC_REF[_TCN][_N].pdf
```
Exemple : `JustificatifVoyage_20260402_18-50TTC_NE3ERM_016487606.pdf`

Le script source le dossier IN (typiquement `curate-justificatifs-achat/output/` ou `curate-justificatifs-voyage/output/`) et génère un fichier `bilan-depenses-train-YYYY.md` dans OUT.

---

## Interface CLI

```
python3 draw-bilan-depenses-train.py [IN] [OUT]
```

| Cas | Comportement |
|---|---|
| Aucun argument | IN = OUT = répertoire courant |
| `python3 draw-bilan-depenses-train.py ./curate-justificatifs-achat/output` | IN = chemin fourni, OUT = même dossier |
| `python3 draw-bilan-depenses-train.py ./in ./out` | IN et OUT distincts |
| Spécifier OUT sans IN | Erreur explicite, usage affiché |

---

## Fichier généré

**Nom :** `bilan-depenses-train-YYYY.md`
- `YYYY` = année dominante dans les justificatifs (si plusieurs années, un fichier par année)
- Si mélange multi-années : `bilan-depenses-train-2026-2027.md`

**Format :** Markdown — lisible directement, collable dans Notion, imprimable.

---

## Contenu du fichier

### En-tête
```
# Bilan dépenses train — 2026
Généré le 2026-05-04 | 24 trajet(s) depuis 18 ticket(s) analysé(s) sur 19 | 0 erreur(s)
```

### Récapitulatif global
```
| Métrique               | Valeur     |
|------------------------|------------|
| Total TTC              | 364,60 €   |
| Nombre de trajets      | 24         |
| Coût moyen par trajet  | 15,19 €    |
| Période couverte       | Mars 2026 → Avril 2026 |
```

### Total annuel
```
| Année | Trajets | Total TTC  |
|-------|---------|------------|
| 2026  |      24 | 364,60 €   |
```

### Détail par mois
```
| Mois        | Trajets | Total TTC  |
|-------------|---------|------------|
| Mars 2026   |       5 |  64,10 €   |
| Avril 2026  |      19 | 300,50 €   |
```

### Voyages par mois (détail par jour)
```
#### Mars 2026 — 5 trajet(s) — 64,10 €
| Date       | Prix      | Fichier source |
|------------|-----------|----------------|
| 16/03/2026 |   10,00 € | justificatif_achat_20260316_10-00TTC_….pdf |
| …          |           |                |
```

### Erreurs (si applicable)
```
## Fichiers non traités (3)

| Fichier                          | Raison                        |
|----------------------------------|-------------------------------|
| justificatif_achat_20260401_...  | Montant non parseable         |
| rapport_2026.pdf                 | Nom de fichier non reconnu    |
| fichier_corrompu.pdf             | PDF illisible                 |
```
Si aucune erreur : section absente.

---

## Logique d'extraction

### Source principale : nom de fichier
Le nom renommé contient déjà date(s) + montant + référence.
Parsing regex prioritaire — rapide, sans dépendance PDF.

**Achat** :
```
justificatif_achat_(\d{8}(?:-\d{8})?)_(\d{1,4}-\d{2})TTC_(.+)\.pdf
→ date=20260409-20260410, amount=65-50, ref=2468110157-20260504
```
La regex capture les dates mono-jour ET les plages multi-jours (aller-retour).

**Voyage** :
```
JustificatifVoyage_(\d{8})_(\d{1,4}-\d{2})TTC_([A-Z0-9]+(?:_\d{6,12})?)(?:_\d{1,3})?\.pdf
→ date=20260402, amount=18-50, ref=NE3ERM_016487606
```
Le TCN (6-12 chiffres) est inclus dans la ref capturée pour rendre chaque ticket unique lors de la déduplication — deux tickets de la même commande (même ref courte) ne sont pas considérés comme doublons.

### Extraction des trajets individuels depuis le PDF
Pour chaque ticket, `pdfplumber` lit le texte et `finditer()` détecte **tous** les legs `Aller/Retour` :
- Si les prix par leg sont sur la même ligne → utilisés directement (`[PDF]`)
- Sinon → montant total divisé également par le nombre de legs (`[calc]`)
- Si aucun leg trouvé → 1 trajet fallback avec la date du nom de fichier

### Déduplication par référence de commande
La ref `2668453920-20260330` et `2668453920-20260504` partagent la même base `2668453920` → le doublon est détecté et ignoré (`[DOUBLON]` en console).

### Fallback : lecture PDF complète
Si le nom ne correspond pas au format attendu (fichier renommé manuellement, ancien format…), tenter extraction texte via `pdfplumber` avec les mêmes patterns que le script de renommage.

### Fichiers ignorés silencieusement
- Fichiers non-PDF dans le dossier IN (`.DS_Store`, `.md`, etc.)

### Fichiers en erreur (remontés)
- PDF dont le nom ne correspond pas ET dont le texte ne permet pas d'extraire les champs obligatoires
- PDF corrompu (exception à la lecture)
- Champ montant non parseable (ex : `PRIX_INCONNU` dans le nom)

---

## Dépendances

| Lib | Usage | Obligatoire |
|---|---|---|
| `pdfplumber` | Fallback lecture PDF | Non (optionnel, graceful degradation) |
| `re`, `pathlib`, `argparse`, `datetime` | Standard library | Oui |

Le script doit fonctionner **sans `pdfplumber`** si tous les fichiers sont nommés correctement (log warning si lib absente et fallback nécessaire).

---

## Comportement console (stdout)

```
Lecture de : /…/curate-justificatifs-achat/output
19 fichier(s) PDF trouvé(s)

  [DOUBLON] justificatif_achat_20260327_…-20260504.pdf → même commande que …-20260330.pdf

✓ 24 trajet(s) extrait(s) depuis 18 ticket(s)

── Détail des trajets ──────────────────────────────

  16/03/2026  (2 trajet(s) — 25,60 €)
    • [calc] 10,00 €  ←  justificatif_achat_20260316_10-00TTC_….pdf
    • [calc] 15,60 €  ←  justificatif_achat_20260316_15-60TTC_….pdf

  23/04/2026  (2 trajet(s) — 28,50 €)
    • [PDF ] 10,00 €  ←  justificatif_achat_20260423-20260424_57-00TTC_….pdf
    • [PDF ] 18,50 €  ←  justificatif_achat_20260423-20260424_57-00TTC_….pdf
  …

✓ Bilan généré : bilan-depenses-train-2026.md
  → /…/curate-justificatifs-achat/output/bilan-depenses-train-2026.md
```

---

## Plan d'implémentation

1. **CLI + validation** — argparse, règle IN/OUT, vérification dossier IN existant
2. **Scan en 3 passes** :
   - Passe 1 : regex sur nom (`RE_RENAMED` avec plages de dates) → fallback pdfplumber → erreur
   - Passe 2 : déduplication par `ref_base` (même commande re-téléchargée)
   - Passe 3 : extraction des `Trip` individuels via `finditer()` sur `Aller/Retour`
3. **Agrégation** — grouper par jour/mois/an, calculer totaux
4. **Rendu Markdown** — Récapitulatif global, Total annuel, Détail par mois, Voyages par mois (détail jour)
5. **Console output** — doublons, trajets extraits, détail par jour

---

## Statut

**Implémenté, testé et refactorisé — 2026-05-04**

- [x] `draw-bilan-depenses-train.py` — script fonctionnel
- [x] Testé sur 19 justificatifs d'achat réels (`curate-justificatifs-achat/output/`)
- [x] 0 erreur, total 432,10 € TTC (mars + avril 2026)
- [x] Cas limites validés : 0 arg, 1 arg, 2 args, dossier vide
- [x] Fallback PDF validé sur `inbox/` (19/19 extraits)
- [x] `README.md` créé à la racine du projet (how-to complet avec exemples)
- [x] Support justificatifs de voyage (2026-05-04) :
  - `RE_RENAMED_VOYAGE` : `JustificatifVoyage_YYYYMMDD_AMOUNT_REF[_TCN][_N].pdf`
  - TCN inclus dans ref capturée → déduplication correcte entre tickets d'une même commande
  - Testé : 22 justificatifs voyage → 22/22 trajets, 0 erreur, 0 fallback PDF
- [x] Refacto KISS/SOLID appliqué :
  - `_read_pdf_text` extrait de `parse_via_pdf` (SRP)
  - `Entry.date_str` supprimé (dead field)
  - `parse_date_str` : `try/except` mort supprimé
  - `year_errors` alias trompeur supprimé
  - Warnings pdfplumber (`FontBBox`) supprimés via `logging.disable` + `warnings.catch_warnings`
- [x] Refacto majeur extraction trajets individuels (2026-05-04) :
  - `Entry` remplacé par `Trip` (1 trajet = 1 leg Aller ou Retour)
  - `RE_RENAMED_ACHAT` étendu aux plages de dates (`20260409-20260410`)
  - `extract_trips_from_pdf` : `finditer()` → prix par leg ou split égal
  - Déduplication par `ref_base` (même commande re-téléchargée → `[DOUBLON]`)
  - `scan` en 3 passes : parse → dédup → extract trips
  - Rapport MD : Total annuel + "Voyages par mois" (détail par jour avec prix)
  - Testé : 19 fichiers → 1 doublon → 18 tickets → 24 trajets, 0 erreur

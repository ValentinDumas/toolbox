# Plan — bilan-depenses-train.py

Script qui lit les justificatifs d'achat renommés et génère un bilan de dépenses.

---

## Contexte

Les justificatifs sont déjà renommés par `rename-justificatifs-achat.py` au format :
```
justificatif_achat_YYYYMMDD_PP-PPTTC_XXXXXXXXXX-YYYYMMDD.pdf
```
Exemple : `justificatif_achat_20260330_18-50TTC_2668453920-20260330.pdf`

Le script source le dossier IN (typiquement `justificatif-achat/output/`) et génère un fichier `bilan-depenses-train-YYYY.md` dans OUT.

---

## Interface CLI

```
python3 bilan-depenses-train.py [IN] [OUT]
```

| Cas | Comportement |
|---|---|
| Aucun argument | IN = OUT = répertoire courant |
| `python3 bilan-depenses-train.py ./justificatif-achat/output` | IN = chemin fourni, OUT = même dossier |
| `python3 bilan-depenses-train.py ./in ./out` | IN et OUT distincts |
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
Généré le 2026-05-04 | 42 justificatif(s) traité(s) | 3 erreur(s)
```

### Récapitulatif global
```
| Métrique               | Valeur     |
|------------------------|------------|
| Total TTC              | 412,50 €   |
| Nombre de trajets      | 42         |
| Coût moyen par trajet  | 9,82 €     |
| Période couverte       | mars 2026 → avril 2026 |
```

### Détail par mois
```
| Mois        | Trajets | Total TTC |
|-------------|---------|-----------|
| Mars 2026   | 18      | 178,00 €  |
| Avril 2026  | 21      | 198,50 €  |
| Mai 2026    | 3       | 36,00 €   |
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
Le nom renommé contient déjà date + montant + référence.
Parsing regex prioritaire — rapide, sans dépendance PDF.

```
justificatif_achat_(\d{8})_([\d]+-[\d]+)TTC_([\w-]+)\.pdf
→ date=20260330, amount=18-50, ref=2668453920-20260330
```

### Fallback : lecture PDF
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
Lecture de : /Users/valentinshodo/ideas/sncf-trip-proofs/justificatif-achat/output
42 fichier(s) PDF trouvé(s)

✓ 39 traité(s) avec succès
✗ 3 erreur(s) :
  - justificatif_achat_20260401_PRIX_INCONNU_... → Montant non parseable
  - rapport_2026.pdf → Nom non reconnu, lecture PDF échouée
  - fichier_corrompu.pdf → PDF illisible

✓ Bilan généré : bilan-depenses-train-2026.md
  → /Users/valentinshodo/ideas/sncf-trip-proofs/justificatif-achat/output/bilan-depenses-train-2026.md
```

---

## Plan d'implémentation

1. **CLI + validation** — argparse, règle IN/OUT, vérification dossier IN existant
2. **Scan** — lister tous les `.pdf` dans IN (non récursif)
3. **Parser** — pour chaque fichier : regex sur nom → si échec → fallback pdfplumber → si échec → erreur
4. **Agrégation** — grouper par mois, calculer totaux, trier par date
5. **Rendu Markdown** — générer le fichier bilan
6. **Console output** — résumé final avec erreurs

---

## Statut

**Implémenté, testé et refactorisé — 2026-05-04**

- [x] `bilan-depenses-train.py` — script fonctionnel
- [x] Testé sur 19 justificatifs réels (`justificatif-achat/output/`)
- [x] 0 erreur, total 432,10 € TTC (mars + avril 2026)
- [x] Cas limites validés : 0 arg, 1 arg, 2 args, dossier vide
- [x] Fallback PDF validé sur `inbox/` (19/19 extraits)
- [x] `README.md` créé à la racine du projet (how-to complet avec exemples)
- [x] Refacto KISS/SOLID appliqué :
  - `_read_pdf_text` extrait de `parse_via_pdf` (SRP)
  - `Entry.date_str` supprimé (dead field)
  - `parse_date_str` : `try/except` mort supprimé
  - `year_errors` alias trompeur supprimé
  - Warnings pdfplumber (`FontBBox`) supprimés via `logging.disable` + `warnings.catch_warnings`

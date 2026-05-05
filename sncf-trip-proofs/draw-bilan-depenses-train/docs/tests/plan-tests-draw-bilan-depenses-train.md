# Plan de tests — draw-bilan-depenses-train

## Objectif

Vérifier que le script lit correctement les justificatifs renommés et produit un bilan fidèle à la réalité des dépenses.

---

## Cas métier

### 1. Reconnaissance des noms de fichiers

| # | Situation | Nom de fichier | Résultat attendu |
|---|---|---|---|
| 1.1 | Justificatif d'achat simple | `justificatif-achat-20260402-18-50ttc-2668453920-20260330.pdf` | date=`20260402`, montant=`18.50`, ref=`2668453920-20260330` |
| 1.2 | Justificatif d'achat multi-dates | `justificatif-achat-20260423-20260424-57-00ttc-1480540391-20260504.pdf` | date=`20260423` (première date), montant=`57.00` |
| 1.3 | Justificatif de voyage sans TCN | `justificatif-voyage-20260316-15-60ttc-D56qej.pdf` | date=`20260316`, montant=`15.60`, ref=`D56QEJ` |
| 1.4 | Justificatif de voyage avec TCN | `justificatif-voyage-20260326-10-00ttc-M56qd3-016404373.pdf` | date=`20260326`, montant=`10.00` |
| 1.5 | Justificatif de voyage avec suffixe conflit | `justificatif-voyage-20260416-18-50ttc-N4M4xx-016733616-1.pdf` | date=`20260416`, montant=`18.50` |
| 1.6 | Nom non reconnu | `facture_sncf.pdf` | `None` (non reconnu) |

### 2. Validation de date

| # | Situation | Date | Résultat attendu |
|---|---|---|---|
| 2.1 | Date valide | `20260402` | `(2026, 4, 2)` |
| 2.2 | Mois invalide | `20261302` | `None` |
| 2.3 | Jour invalide | `20260400` | `None` |
| 2.4 | Année hors plage | `19991231` | `None` |
| 2.5 | Format incorrect (trop court) | `2026042` | `None` |
| 2.6 | Format incorrect (non numérique) | `2026040X` | `None` |

### 3. Déduplication par référence de commande

| # | Situation | Comportement attendu |
|---|---|---|
| 3.1 | Même commande, deux téléchargements (achat + achat) | Le second fichier est ignoré (`[DOUBLON]`) |
| 3.2 | Deux commandes différentes | Les deux sont comptabilisées |
| 3.3 | Fichier de voyage (ref sans format numérique) | Traité normalement, pas de déduplication erronée |

### 4. Extraction de la référence de base

| # | Situation | Référence | Résultat attendu |
|---|---|---|---|
| 4.1 | Format achat `XXXXXXXXXX-YYYYMMDD` | `2668453920-20260330` | `2668453920` |
| 4.2 | Référence courte (voyage) | `D56QEJ` | `D56QEJ` (inchangée) |

### 5. Formatage des montants

| # | Montant | Résultat attendu |
|---|---|---|
| 5.1 | `57.0` | `57,00 €` |
| 5.2 | `15.6` | `15,60 €` |
| 5.3 | `1234.56` | `1 234,56 €` |

### 6. Bilan généré (structure et contenu)

| # | Situation | Comportement attendu |
|---|---|---|
| 6.1 | Un seul trajet | Bilan avec 1 mois, 1 ligne de détail |
| 6.2 | Plusieurs trajets sur la même année | Totaux par mois corrects, total annuel = somme des mois |
| 6.3 | Trajets sur deux années | Un fichier bilan par année |
| 6.4 | Fichier avec erreur | Section "Fichiers non traités" présente dans le bilan |
| 6.5 | Cohérence total | `total annuel` = somme de tous les `totaux mensuels` |

---

## Implémentation

Tests dans : `tests/test_draw_bilan_depenses_train.py`
Runner : `pytest`
Approche : tests unitaires sur les fonctions de parsing et de génération. Le bilan est testé en vérifiant la structure Markdown produite (présence des sections, cohérence des totaux).

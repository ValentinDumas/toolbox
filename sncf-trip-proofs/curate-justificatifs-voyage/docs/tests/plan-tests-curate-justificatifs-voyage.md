# Plan de tests — curate-justificatifs-voyage

## Objectif

Vérifier que le script renomme correctement les justificatifs de voyage SNCF Connect dans tous les cas rencontrés en pratique, y compris les cas limite.

---

## Cas métier

### 1. Extraction de la date

| # | Situation | Texte dans le PDF | Résultat attendu |
|---|---|---|---|
| 1.1 | Structure A — date numérique après "voyage du" | `voyage du 16-03-2026` | `20260316` |
| 1.2 | Structure A — date numérique après "aller le" | `aller le 16/03/2026` | `20260316` |
| 1.3 | Structure B — date en lettres après "voyage du" | `voyage du 26 mars 2026` | `20260326` |
| 1.4 | Fallback — premier mois en lettres dans le texte | `Paris, 30 mars 2026` | `20260330` |
| 1.5 | Fallback — première date numérique dans le texte | `30/03/2026` | `20260330` |
| 1.6 | Aucune date extractible | _(aucune date)_ | `None` |

### 2. Extraction du montant

| # | Situation | Texte dans le PDF | Résultat attendu |
|---|---|---|---|
| 2.1 | Structure A — montant sur ligne "Montant TOTAL" | `Montant TOTAL de la commande 15,60 €` | `15-60TTC` |
| 2.2 | Structure B — montant sur ligne "Montant du voyage" | `Montant du voyage 10,00 €` | `10-00TTC` |
| 2.3 | Montant entier sans centimes | `18 EUR` | `18-00TTC` |
| 2.4 | Aucun montant extractible | _(aucun montant)_ | `None` |

### 3. Extraction de la référence

| # | Situation | Texte dans le PDF | Résultat attendu |
|---|---|---|---|
| 3.1 | Structure A — référence directe | `Référence D56QEJ` | `D56QEJ` |
| 3.2 | Structure B — référence de commande | `Référence de commande M56QD3` | `M56QD3` |
| 3.3 | Abréviation "Réf" | `Réf D56QEJ` | `D56QEJ` |
| 3.4 | Aucune référence | _(aucune référence)_ | `None` |

### 4. Extraction du TCN (optionnel)

| # | Situation | Texte dans le PDF | Résultat attendu |
|---|---|---|---|
| 4.1 | TCN présent | `TCN 016404373` | `016404373` |
| 4.2 | TCN absent | _(aucun TCN)_ | `None` |

### 5. Nom de fichier généré

| # | Situation | Résultat attendu |
|---|---|---|
| 5.1 | Tous champs, sans TCN | `JustificatifVoyage_20260316_15-60TTC_D56QEJ.pdf` |
| 5.2 | Tous champs, avec TCN | `JustificatifVoyage_20260326_10-00TTC_M56QD3_016404373.pdf` |
| 5.3 | Date manquante | `JustificatifVoyage_DATE_INCONNUE_15-60TTC_D56QEJ.pdf` |
| 5.4 | Montant manquant | `JustificatifVoyage_20260316_PRIX_INCONNU_D56QEJ.pdf` |
| 5.5 | Référence manquante | `JustificatifVoyage_20260316_15-60TTC_REF_INCONNUE.pdf` |
| 5.6 | Conflit résolu — avec suffixe numérique | `JustificatifVoyage_20260416_18-50TTC_N4M4XX_016733616_1.pdf` |

### 6. Déduplication — Passe 1 (sources identiques)

| # | Situation | Comportement attendu |
|---|---|---|
| 6.1 | 2 fichiers au contenu identique | Le plus ancien est conservé, le second ignoré |
| 6.2 | Tous les fichiers distincts | Aucun n'est ignoré |

### 7. Déduplication — Passe 2 (conflit de nom cible)

| # | Situation | Comportement attendu |
|---|---|---|
| 7.1 | 2 fichiers différents → même nom cible, même contenu | Le second est ignoré |
| 7.2 | 2 fichiers différents → même nom cible, contenu différent | Numérotation `_1`, `_2` |

### 8. Champs manquants

| # | Situation | Comportement attendu |
|---|---|---|
| 8.1 | Un ou plusieurs champs manquants | `f.missing` liste les champs absents |
| 8.2 | Aucun champ manquant | `f.missing` est vide |

---

## Implémentation

Tests dans : `tests/test_curate_justificatifs_voyage.py`
Runner : `pytest`
Approche : tests unitaires sur les fonctions de parsing (pas de vrais PDFs — le texte extrait est passé directement).

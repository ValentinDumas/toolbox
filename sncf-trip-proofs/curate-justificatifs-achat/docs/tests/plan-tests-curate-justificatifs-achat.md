# Plan de tests — curate-justificatifs-achat

## Objectif

Vérifier que le script renomme correctement les justificatifs d'achat SNCF Connect dans tous les cas rencontrés en pratique, y compris les cas limite.

---

## Cas métier

### 1. Extraction de la date

| # | Situation | Texte dans le PDF | Résultat attendu |
|---|---|---|---|
| 1.1 | Commande simple — 1 ticket, 1 jour | `Aller 02/04/2026` | `20260402` |
| 1.2 | Commande multi-tickets — 2 jours consécutifs | `Aller 23/04/2026` + `Retour 24/04/2026` | `20260423-20260424` |
| 1.3 | Commande multi-tickets — jours non triés dans le PDF | `Retour 24/04/2026` avant `Aller 23/04/2026` | `20260423-20260424` (trié) |
| 1.4 | Pas de ticket — date numérique avec contexte | `du 30/03/2026` | `20260330` |
| 1.5 | Pas de ticket — date en lettres avec contexte | `le 30 mars 2026` | `20260330` |
| 1.6 | Pas de ticket — date en lettres sans contexte | `30 mars 2026` | `20260330` |
| 1.7 | Pas de ticket — date numérique seule | `30/03/2026` | `20260330` |
| 1.8 | Aucune date dans le texte — fallback sur la référence | `N°2668453920-20260330` | `20260330` |
| 1.9 | Aucune date extractible | _(aucune date)_ | `None` |
| 1.10 | Tickets avec étiquettes anglaises (Departure/Return) | `Departure 02/04/2026` | `20260402` |

### 2. Extraction du montant

| # | Situation | Texte dans le PDF | Résultat attendu |
|---|---|---|---|
| 2.1 | Montant décimal, € avant | `€18,50` | `18-50TTC` |
| 2.2 | Montant entier, € avant | `€5` | `5-00TTC` |
| 2.3 | Montant décimal, € après | `18,50 €` | `18-50TTC` |
| 2.4 | Montant sur ligne total/montant | `Total 57,00 €` | `57-00TTC` |
| 2.5 | Montant avec EUR | `18,50 EUR` | `18-50TTC` |
| 2.6 | Aucun montant extractible | _(aucun montant)_ | `None` |

### 3. Extraction de la référence

| # | Situation | Texte dans le PDF | Résultat attendu |
|---|---|---|---|
| 3.1 | Format standard SNCF (numérique + date) | `N°2668453920-20260330` | `2668453920-20260330` |
| 3.2 | Format numérique long seul | `N°123456789` | `123456789` |
| 3.3 | Aucune référence | _(aucune référence)_ | `None` |

### 4. Nom de fichier généré

| # | Situation | Résultat attendu |
|---|---|---|
| 4.1 | Tous les champs présents | `justificatif-achat-20260402-18-50ttc-2668453920-20260330.pdf` |
| 4.2 | Date manquante | `justificatif-achat-date-inconnue-18-50ttc-2668453920-20260330.pdf` |
| 4.3 | Montant manquant | `justificatif-achat-20260402-prix-inconnu-2668453920-20260330.pdf` |
| 4.4 | Référence manquante | `justificatif-achat-20260402-18-50ttc-ref-inconnue.pdf` |
| 4.5 | Conflit résolu — avec suffixe numérique | `justificatif-achat-20260402-18-50ttc-ref-1.pdf` (counter=1) |

### 5. Déduplication — Passe 1 (sources identiques)

| # | Situation | Comportement attendu |
|---|---|---|
| 5.1 | 2 fichiers au contenu identique | Le plus ancien est conservé, le second ignoré |
| 5.2 | 3 fichiers, 2 identiques + 1 différent | 1 des 2 doublons ignoré, les 2 autres traités |
| 5.3 | Tous les fichiers distincts | Aucun n'est ignoré |

### 6. Déduplication — Passe 2 (conflit de nom cible)

| # | Situation | Comportement attendu |
|---|---|---|
| 6.1 | 2 fichiers différents → même nom cible, même contenu | Le second est ignoré (doublon résiduel) |
| 6.2 | 2 fichiers différents → même nom cible, contenu différent | Numérotation `_1`, `_2` par date de création |

### 7. Cas d'erreur et cas limites

| # | Situation | Comportement attendu |
|---|---|---|
| 7.1 | Champ(s) manquant(s) — mode dry-run | Affiche `[MANQUANT]`, continue les autres fichiers |
| 7.2 | Champ(s) manquant(s) — mode real | Affiche `[MANQUANT]`, ne copie pas le fichier |
| 7.3 | Un champ manquant parmi plusieurs fichiers | Les autres fichiers sont quand même traités |

---

## Implémentation

Tests dans : `tests/test_curate_justificatifs_achat.py`
Runner : `pytest`
Approche : tests unitaires sur les fonctions de parsing (pas de vrais PDFs — le texte extrait est passé directement).

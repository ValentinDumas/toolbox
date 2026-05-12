# Spec — Journal au format Débit/Crédit (livre-journal PCG)

**Date :** 2026-05-12
**Statut :** Implémenté

## Contexte

Le Journal exporté dans `output/ledger-YYYY.xlsx` utilisait une seule colonne de montant par triplet (HT / TVA / TTC). Le sens de l'écriture (charge vs produit) était implicite, déduit de `type_document`. Un expert-comptable ouvrant ce livrable attend un format livre-journal conforme PCG avec colonnes **Débit** / **Crédit** séparées (convention française, FEC art. A47 A-1 LPF, alignée Sage / EBP / Pennylane).

VISION.md exige que `ledger-YYYY.xlsx` soit « ready for the user's accountant » → le Journal devient le livre-journal, sans dédoublement.

## Décisions

1. **Source de vérité inchangée.** Pas de migration SQLite. `invoices.montant_*` reste non signé. Le sens est dérivé à l'export par un service pur.
2. **Journal XLSX remplacé** (pas de double journal). 6 colonnes Débit/Crédit (HT, TVA, TTC) + ligne de totaux.
3. **CSV `ledger-YYYY.csv`** : ajout d'une seule colonne `sens_comptable` (`débit` / `crédit` / `""`). Pas de paires débit/crédit (redondance avec montants déjà présents).
4. **`services/comptabilite.py`** : règle pure `type_document → sens`, testable en isolation. Point d'extension pour une future table `ecritures` (FEC complet, multi-lignes, OD).
5. **Avoirs en contre-passation** : `avoir_reçu` → crédit, `avoir_émis` → débit.
6. **Off-ledger** : `relevé_bancaire`, `devis` exclus du Journal XLSX (mais présents dans le CSV avec `sens_comptable = ""`).

## Étude d'impact

### Schéma SQLite
Pas de modification. La règle `type_document → sens` est totale et déterministe ; stocker le sens en colonne dédiée serait une dénormalisation (2 sources pour une même information). Aucun cas métier identifié ne nécessite la migration.

### CSV `ledger-YYYY.csv`
N'est pas ré-importé (`review.py` utilise un fichier distinct `review.csv` avec ses propres `REVIEW_COLS`). 1 colonne ajoutée en fin de `CSV_COLS`. Les consommateurs `DictReader` ne sont pas affectés ; les lecteurs par index conservent les indices 0..22.

## Fichiers modifiés

| Fichier | Rôle |
|---|---|
| `services/comptabilite.py` | **Nouveau.** `sens_comptable()`, `split_debit_credit()`, `to_journal_row()`, `is_off_ledger()`. |
| `constants.py` | Ajout de `CONTRA_INCOME_TYPES`, `CONTRA_EXPENSE_TYPES`, `OFF_LEDGER_TYPES`. |
| `export.py` | `_write_journal()` refondu (Débit/Crédit + totaux) ; `CSV_COLS` étendu ; `_to_display_row()` enrichi avec `sens_comptable`. |
| `queries.py` | `query_ledger` : totaux crédit/débit incluent désormais les avoirs. |
| `tests/test_comptabilite.py` | **Nouveau.** 17 tests BDD du service pur. |
| `tests/test_export.py` | `TestJournalDebitCredit` (8 tests) + `TestCSVSensComptable` (4 tests) ; ajustement `test_journal_has_data_rows` pour ignorer la ligne TOTAUX. |
| `docs/types-pieces.md` | Colonne « Sens comptable PCG » dans le tableau des types. |
| `README.md` | Section « Output XLSX » mise à jour. |

## Hors périmètre

- Table `ecritures` séparée (multi-lignes par pièce, OD, FEC complet) — spec ultérieur. `services/comptabilite.py` est conçu pour y être branché sans changer son API publique.
- Numéros de compte PCG (`606`, `707`, `4456`…).
- Lettrage / rapprochement bancaire.

## Vérification

```bash
python3 -m pytest tests/ -v   # 319 tests passent
python3 export.py --year 2025 # vérification visuelle XLSX
```

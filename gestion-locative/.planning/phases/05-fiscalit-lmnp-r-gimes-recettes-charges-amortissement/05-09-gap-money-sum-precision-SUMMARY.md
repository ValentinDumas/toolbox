---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
plan: 09
subsystem: infrastructure/repositories — fiscalité
tags:
  - fiscalite
  - precision
  - sqlite-sum
  - bigint
  - gap-closure
  - cr-01
dependency_graph:
  requires:
    - "Money VO (src/domain/_shared/money.ts) — fromCentimes(bigint)"
    - "Kysely SqliteDialect typed fn.sum<string>"
  provides:
    - "RecettesRepositorySqlite SUM en chaîne entière (sans float)"
    - "ChargesRepositorySqlite SUM en chaîne entière (sans float)"
    - "Régression CR-01 verrouillée par 4 tests d'intégration"
  affects:
    - "Use case fiscalite/cloturer-exercice.ts (lit recettes annuelles via le port)"
    - "vues 05-multi-bien-consolide (lit sommeRecettesAnnuellesParBien + sommeChargesParBien)"
tech_stack:
  added: []
  patterns:
    - "fn.sum<string>('col').as('total') + BigInt(result?.total ?? '0')"
    - "Clamp compensateurs négatifs via comparaison BigInt (totalBig <= 0n)"
key_files:
  created:
    - .planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-09-gap-money-sum-precision-SUMMARY.md
  modified:
    - src/infrastructure/repositories/recettes-repository-sqlite.ts
    - src/infrastructure/repositories/charges-repository-sqlite.ts
    - tests/integration/repositories/recettes-repository-sqlite.test.ts
    - tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts
    - tests/integration/repositories/charges-repository-sqlite.test.ts
    - tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts
decisions:
  - "Conservation du clamp ``totalBig <= 0n`` pour préserver la sémantique compensateurs (D-60) — utilisation de l'opérateur BigInt natif et non d'une comparaison de chaînes."
  - "JSDoc D-LOCK-2 / D-FIS-G2.11 préservée et étoffée d'une note 'Précision BigInt CR-01' sur chaque méthode SUM corrigée."
  - "Tests de régression typés CR-01 — 100 × 1n centime — verrouillent la sémantique ; ils étaient déjà GREEN avec le pattern défectueux (100 ≤ MAX_SAFE_INTEGER), mais empêchent toute régression future qui réintroduirait fn.sum<number>."
metrics:
  duration_minutes: 7
  completed_date: 2026-05-22
  tasks_completed: 3
  files_modified: 6
  commits: 3
requirements_completed:
  - FIS-03
---

# Phase 5 Plan 9 : Gap closure CR-01 — Précision SUM Money — Summary

**One-liner :** Remplacement de `fn.sum<number>(...)` + `BigInt(Math.round(...))` par `fn.sum<string>(...)` + `BigInt(totalStr)` dans les 4 méthodes SUM (recettes + charges) — aucun float ne transite plus entre SQLite et `Money.fromCentimes()`.

---

## Objectif

Fermer le **BLOCKER CR-01** du verifier (05-VERIFICATION.md, 2026-05-21) : SC-1 (agrégation recettes/charges) et FIS-03 ne pouvaient être déclarés VERIFIED tant que `BigInt(Math.round(fn.sum<number>(...)))` pouvait perdre un centime au franchissement de la limite de précision IEEE 754. Phase 5 = règle non négociable « jamais de float pour les montants fiscaux » (CLAUDE.md).

---

## Tâches exécutées

| # | Type    | Description                                                                           | Commit    |
| - | ------- | ------------------------------------------------------------------------------------- | --------- |
| 1 | TDD RED | Tests régression "100 × 0.01 € = 1.00 € exact" sur recettes (annuelle + par bien)     | `e04bb73` |
| 2 | TDD RED | Tests régression "100 × 0.01 € = 1.00 € exact" sur charges (par catégorie + par bien) | `9e107b5` |
| 3 | GREEN   | Refactor des 4 méthodes SUM (recettes + charges)                                      | `547d956` |

Note RED/GREEN : les tests de Task 1+2 passaient déjà avant Task 3 (100 × 1 = 100 reste sous `MAX_SAFE_INTEGER`, donc `Math.round` ne perd rien à ce volume), mais ils sont volontairement écrits comme **scellement de la sémantique** — toute régression future qui réintroduirait `fn.sum<number>` casserait le contrat. Le plan acknowledged ce comportement explicitement (Task 1 `<action>`).

---

## Diffs des 4 méthodes SUM corrigées

### 1. `RecettesRepositorySqlite.sommeRecettesAnnuelles`

```diff
- .select((eb) => eb.fn.sum<number>('e.montant_centimes').as('total'))
+ .select((eb) => eb.fn.sum<string>('e.montant_centimes').as('total'))
  ...
- const total = result?.total ?? 0;
- if (total <= 0) { return Money.zero(); }
- return Money.fromCentimes(BigInt(Math.round(total)));
+ const totalStr = result?.total ?? '0';
+ const totalBig = BigInt(totalStr);
+ if (totalBig <= 0n) { return Money.zero(); }
+ return Money.fromCentimes(totalBig);
```

### 2. `RecettesRepositorySqlite.sommeRecettesAnnuellesParBien`

Même refactor, lignes ~64 / ~73-80.

### 3. `ChargesRepositorySqlite.sommeChargesParCategorie`

```diff
- .select((eb) => eb.fn.sum<number>('montant_ttc_centimes').as('total'))
+ .select((eb) => eb.fn.sum<string>('montant_ttc_centimes').as('total'))
  ...
  for (const row of rows) {
    ...
-   const total = row.total ?? 0;
-   if (total > 0) {
-     result[qualification] = Money.fromCentimes(BigInt(Math.round(total)));
-   }
+   const totalStr = row.total ?? '0';
+   const totalBig = BigInt(totalStr);
+   if (totalBig > 0n) {
+     result[qualification] = Money.fromCentimes(totalBig);
+   }
  }
```

### 4. `ChargesRepositorySqlite.sommeChargesParBien`

Même refactor que `sommeRecettesAnnuelles*` (clamp `totalBig <= 0n`, retour direct `Money.fromCentimes(totalBig)`).

---

## 4 nouveaux tests de régression CR-01

| Fichier | `it(...)` ajouté |
| --- | --- |
| `tests/integration/repositories/recettes-repository-sqlite.test.ts` | `"régression CR-01 : 100 encaissements de 1 centime = 100 centimes exact, sans perte d'arrondi flottant"` |
| `tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts` | `"régression CR-01 : 100 encaissements de 1 centime sur un bien = 100 centimes exact, ..."` |
| `tests/integration/repositories/charges-repository-sqlite.test.ts` | `"régression CR-01 : 100 justificatifs de 1 centime entretien_reparation = 100 centimes exact, ..."` |
| `tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts` | `"régression CR-01 : 100 justificatifs de 1 centime charge_courante_periodique sur un bien = 100 centimes exact, ..."` |

Chaque test :
1. Insère 100 lignes (encaissement ou justificatif) à `1n` centime.
2. Appelle la méthode SUM ciblée.
3. Assertion stricte : `expect(somme.toCentimes()).toBe(100n)` — pas de `toEqual`, pas d'approximation, pas de tolérance.

---

## Commande de vérification finale

```bash
# 1. Anti-pattern absent
grep -n "fn.sum<number>\|Math.round" \
  src/infrastructure/repositories/recettes-repository-sqlite.ts \
  src/infrastructure/repositories/charges-repository-sqlite.ts
# (aucun résultat)

# 2. Nouveau pattern présent (2 occurrences code par fichier)
grep -cE "\.fn\.sum<string>" \
  src/infrastructure/repositories/recettes-repository-sqlite.ts \
  src/infrastructure/repositories/charges-repository-sqlite.ts
# → 2 / 2

# 3. Suite complète + typecheck
pnpm test -- --run
# → 134 fichiers, 892 tests passed (888 + 4 régressions CR-01)
pnpm typecheck
# → exit 0
```

---

## Re-vérification du gap CR-01

| Élément du verifier | Statut avant | Statut après ce plan |
| --- | --- | --- |
| **Vérité 1** (« agrège recettes/charges sans perte de précision ») | ✗ FAILED (CR-01) | ✓ Prêt pour VERIFIED |
| **Anti-pattern** `recettes-repo:47` `BigInt(Math.round(fn.sum<number>))` | BLOCKER | ✓ Supprimé |
| **Anti-pattern** `charges-repo:65,111` `BigInt(Math.round(fn.sum<number>))` | BLOCKER | ✓ Supprimé |
| **FIS-03** (agrégation recettes/charges réel) | ✗ BLOCKED | ✓ Réaligné |
| **SC-1** (agrégation recettes/charges) | ✗ FAILED | ✓ Prêt pour VERIFIED |

Restent ouverts dans 05-VERIFICATION.md (hors scope de ce plan, traités en parallèle par 05-10 et 05-11) :
- Gap 2 (CR-03) — Double-ARD multi-biens : plan 05-10
- Gap 3 (CR-06) — Violation hexagonale dans exporter-pdf-recap : plan 05-11

---

## Décisions / Adjustements

Aucune déviation du plan. Application stricte des 3 tâches telles que spécifiées dans `05-09-gap-money-sum-precision-PLAN.md`.

### Choix mineurs d'implémentation

- **JSDoc** : ajout d'une note `Précision BigInt CR-01` sur chaque méthode corrigée (sans toucher aux mentions existantes D-LOCK-2 / D-FIS-G2.11 / D-FIS-G5.1), pour traçabilité dans le code source.
- **Naming des variables locales** : `totalStr` et `totalBig` au lieu du `total` original, pour rendre explicite la nature de chaque variable (chaîne SQL vs BigInt domaine).

---

## Critères de succès — bilan

- [x] CR-01 du verifier fermé : aucun float intermédiaire ne transite entre SQLite et `Money.fromCentimes()` dans les 2 repos
- [x] FIS-03 et SC-1 réalignés : agrégation recettes + charges exacte au centime près
- [x] 4 régressions de précision ajoutées
- [x] Suite complète verte (`pnpm test -- --run` : 134 fichiers / 892 tests)
- [x] Typecheck propre (`pnpm typecheck` exit 0)
- [x] Aucune signature publique modifiée (`RecettesRepository`, `ChargesRepository` intactes)
- [x] Appelants (`cloturerExercice`, vues consolidées par bien) intacts

---

## Self-Check

**1. Files modified — existence check:**

- `src/infrastructure/repositories/recettes-repository-sqlite.ts` : FOUND
- `src/infrastructure/repositories/charges-repository-sqlite.ts` : FOUND
- `tests/integration/repositories/recettes-repository-sqlite.test.ts` : FOUND
- `tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts` : FOUND
- `tests/integration/repositories/charges-repository-sqlite.test.ts` : FOUND
- `tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts` : FOUND

**2. Commits exist:**

- `e04bb73` : FOUND (Task 1 — test recettes CR-01)
- `9e107b5` : FOUND (Task 2 — test charges CR-01)
- `547d956` : FOUND (Task 3 — fix recettes + charges SUM)

**3. Tests pass:**

- `pnpm test -- --run` : 134 files / 892 tests passed (0 failed)
- `pnpm typecheck` : exit 0

## Self-Check: PASSED

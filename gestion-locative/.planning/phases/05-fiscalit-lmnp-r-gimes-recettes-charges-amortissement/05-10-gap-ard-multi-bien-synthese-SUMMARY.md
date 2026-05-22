---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
plan: 10
subsystem: fiscalite
tags: [ard, multi-bien, mono-bailleur, bigint-sum, cgi-39-b, synthese-bien, d-lock-2]

requires:
  - phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
    provides: cloturer-exercice, tableau-amortissement-repository-sqlite, recap-fiscal-doc-def

provides:
  - "Une seule ligne SYNTHESE_BIEN par exercice quel que soit le nombre de biens (V1 D-LOCK-2 mono-bailleur)"
  - "dernierArdCumuleBailleur lit le SUM SQLite via fn.sum<string> + BigInt(string) (zéro float)"
  - "PDF récap fiscal affiche un libellé bailleur agrégé pour la table d'amortissement"
  - "Test unitaire + intégration + BDD multi-bien anti-régression CR-03"

affects: [phase-06-liasse-2031, fiscalite-multi-bailleur-v1.1, recap-pdf-export]

tech-stack:
  added: []
  patterns:
    - "biensIds[0]! bien sentinelle V1 (porteur unique de la SYNTHESE_BIEN bailleur-level)"
    - "fn.sum<string> + BigInt(string) — précision fiscale stricte sur les agrégats SQLite"

key-files:
  created: []
  modified:
    - src/application/fiscalite/cloturer-exercice.ts
    - src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts
    - src/infrastructure/pdf/recap-fiscal-doc-def.ts
    - tests/unit/fiscalite/cloturer-exercice.test.ts
    - tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts
    - tests/bdd/features/fiscalite-ard-multi-exercice.feature
    - tests/bdd/step_definitions/fiscalite-cloture.steps.ts

key-decisions:
  - "1 SYNTHESE_BIEN par exercice portée par biensIds[0]! (porteur sentinelle V1) au lieu de N lignes — l'ARD est bailleur-level en V1 D-LOCK-2, pas bien-level"
  - "fn.sum<string> + BigInt(row.total_centimes ?? '0') — supprime définitivement Number() et le clamp redondant ; aligne CR-01 (recettes/charges) avec CR-01 derive (tableau-amortissement)"
  - "Libellé table d'amortissement PDF en V1 : 'Bailleur — exercice {N}' au lieu du bienId brut — semantique mono-bailleur D-LOCK-2 ; le bienId stocké en base reste un porteur technique sentinelle, sans signification métier"
  - "Le test repo 'mécanique SUM repo (2 lignes)' est conservé comme test de mécanique BigInt (anti-régression), même si le flux nominal V1 post-fix n'en génère qu'une seule"

patterns-established:
  - "BDD outside-in pour gap closure : RED test au niveau use-case (Task 1) précède le fix (Task 3), puis GREEN BDD scenario (Task 4)"
  - "Bien sentinelle V1 D-LOCK-2 : biensIds[0]! en non-null assertion justifiée par la garde if (biensIds.length > 0)"
  - "Précision fiscale stricte SQLite SUM : fn.sum<string> + BigInt(string) systématique sur tous les agrégats Money"

requirements-completed: [FIS-04]

duration: 18min
completed: 2026-05-22
---

# Phase 5 Plan 10: gap-ard-multi-bien-synthese Summary

**Fermeture CR-03 (BLOCKER) + CR-01 derive (WARNING) : une seule SYNTHESE_BIEN par exercice (D-LOCK-2 mono-bailleur), SUM SQLite en BigInt pur, libellé PDF agrégé bailleur**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-05-22T14:00:00Z (≈)
- **Completed:** 2026-05-22T14:17:00Z
- **Tasks:** 4
- **Files modified:** 7

## Accomplishments

- **CR-03 (BLOCKER) fermé** : `cloturer-exercice.ts` n'utilise plus la boucle `for (const bienId of biensIds)` qui créait N lignes SYNTHESE_BIEN chacune portant `ardCumuleEnSortie` global. Une seule ligne est désormais créée, portée par `biensIds[0]!` (bien sentinelle V1). `dernierArdCumuleBailleur` ne sur-additionne plus l'ARD par le nombre de biens à l'exercice N+1.
- **CR-01 derive (WARNING) fermé** : `dernierArdCumuleBailleur` lit le SUM SQLite via `fn.sum<string>` + `BigInt(row.total_centimes ?? '0')`. Plus aucun `Number()` intermédiaire, plus aucun clamp redondant. Précision fiscale garantie.
- **PDF récap aligné V1** : le tableau d'amortissement affiche `'Bailleur — exercice {N}'` à la place du `bienId` brut (porteur sentinelle V1).
- **Couverture BDD étendue** : nouveau scénario `CR-03 — Multi-bien — l'ARD est reporté à l'exercice N+1 sans doublon` (3 biens actifs, assertion "exactly 1 SYNTHESE_BIEN per exercice" + propagation ARD vérifiée).

## Task Commits

Atomic per-task commits (BDD outside-in respecté) :

1. **Task 1 — RED tests outside-in (unit + feature)** : `e969beb` (test)
2. **Task 2 — Integration tests anti-régression (CR-03 + CR-01 derive)** : `ec43179` (test)
3. **Task 3 — GREEN fix structural (cloturer-exercice + repo + PDF)** : `5727a76` (fix)
4. **Task 4 — GREEN BDD step definitions + scénario ajusté** : `499fc82` (test)

## Files Created/Modified

### Modified — source

- `src/application/fiscalite/cloturer-exercice.ts` (L221-238)
  - **Avant** : boucle `for (const bienId of biensIds) { push(SYNTHESE_BIEN ...) }` → N lignes chacune portant `ardCumuleEnSortie` global.
  - **Après** : garde `if (biensIds.length > 0) { push(... bienId: biensIds[0]! ...) }` → 1 ligne portée par bien sentinelle. Commentaire mis à jour pour refléter la vraie sémantique V1 D-LOCK-2 (ARD bailleur-level, pas bien-level).

- `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` `dernierArdCumuleBailleur` (L134-156)
  - **Avant** : `eb.fn.sum<number>(...)` → `Number(row.total_centimes)` → `if (total === 0) return Money.zero()` → `BigInt(total)`.
  - **Après** : `eb.fn.sum<string>(...)` → `return Money.fromCentimes(BigInt(row.total_centimes ?? '0'))`. Plus aucun float, plus de clamp redondant. JSDoc enrichi avec note "CR-01 derive".

- `src/infrastructure/pdf/recap-fiscal-doc-def.ts` (L91-103)
  - **Avant** : map produit `[l.bienId, dotation, ard]` — affichage du bienId UUID brut.
  - **Après** : map produit `['Bailleur — exercice ${decl.exercice}', dotation, ard]` — libellé agrégé V1 D-LOCK-2. Commentaire explique la sémantique et l'évolution V1.1.

### Modified — tests

- `tests/unit/fiscalite/cloturer-exercice.test.ts`
  - Nouveau test : `it('CR-03 — multi-bien : un bailleur avec 2 biens actifs produit exactement UNE ligne SYNTHESE_BIEN par exercice', ...)`.
  - Capture les lignes passées à `tableauAmortRepo.enregistrerBatch` et asserte `syntheseLignes.length === 1`, `composantId === null`, bienId ∈ [biensIds].

- `tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts`
  - Nouveau `describe('dernierArdCumuleBailleur — multi-bien (CR-03) + precision BigInt (CR-01 derive)')` avec 2 tests :
    - **Test 1** : 1 SYNTHESE_BIEN insérée (50_000n centimes) → repo retourne 50_000n (pas 100_000n).
    - **Test 2** : 100 lignes SYNTHESE_BIEN de 1n centime sur 100 biens distincts → SUM = 100n exact (verrou anti-régression BigInt).
  - Test existant "2 biens Σ=12 000€" renommé pour clarifier qu'il teste la mécanique SUM (hors flux V1).

- `tests/bdd/features/fiscalite-ard-multi-exercice.feature`
  - Nouveau scénario `CR-03 — Multi-bien — l'ARD est reporté à l'exercice N+1 sans doublon` taggué `@fis-04 @gap-CR-03 @fis-ard-cross-multi-bien`. Setup : Background 1 bien + 2 biens additionnels = 3 biens actifs. Assertion `exactly 1 SYNTHESE_BIEN per exercice` + propagation ARD vérifiée via `dernierArdCumuleBailleur` direct.

- `tests/bdd/step_definitions/fiscalite-cloture.steps.ts`
  - Nouveau `Given` regex multi-bien : `un (?:deuxième|troisième|quatrième) bien immobilier avec un composant gros_oeuvre de X €` → ajoute un bien + composant gros_oeuvre 2025-01-01 + valorisation fiscale activée.
  - Nouveau `Then` strict count : `la table amortissement_exercice contient exactement N ligne SYNTHESE_BIEN pour l'exercice E` → `assert.strictEqual(rows.length, nbAttendu)`.
  - Nouveau `Then` propagation : `l'ARD propagé pour l'exercice E+1 est exactement égal à l'ardCumuleEnSortie de E` → appel direct `dernierArdCumuleBailleur` et comparaison avec la valeur stockée.

## Decisions Made

- **bien sentinelle = biensIds[0]!** plutôt qu'une valeur synthétique (NULL ou UUID dédié) : conserve la compatibilité avec la contrainte `UNIQUE (bien_id, composant_id, exercice)` de la migration 0019 sans modifier le schéma SQL. Le commentaire ajouté dans le source explicite la sémantique V1 et flag la migration vers une SYNTHESE par bailleur en V1.1.
- **Test existant repo "2 biens" conservé** (renommé "mécanique SUM repo (hors flux V1)") : il verrouille la mécanique BigInt du SUM côté repo indépendamment du flux nominal V1. C'est un test de robustesse anti-régression — il garantit que le repo reste correct même si un cas hypothétique V1.1 insérait plusieurs SYNTHESE_BIEN par exercice.
- **Scénario BDD ajusté pour piggy-back sur Background** : initialement le scénario seedait son propre bailleur+bail+écheances pour 2025/2026/2027, mais le Background existant seede déjà bailleur+bien+bail pour 2026/2027/2028. J'ai ajusté le scénario pour utiliser exercices 2026/2027 (déjà seedées) + 2 biens additionnels — résultat : 3 biens actifs en 2026, assertion "1 SYNTHESE_BIEN per exercice" toujours probante.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Mise à jour du test repo intégration pour clarifier la sémantique post-fix**

- **Found during:** Task 3 (GREEN fix)
- **Issue:** Le test existant `dernierArdCumuleBailleur — 2 biens avec SYNTHESE_BIEN exercice 2025 → Σ = 12 000 € (D-LOCK-2)` portait dans son nom la mention "D-LOCK-2" qui devenait trompeuse après le fix (le flux nominal V1 D-LOCK-2 ne génère qu'une seule SYNTHESE_BIEN par exercice). Sans changement, un lecteur pourrait interpréter ce test comme "le flux V1 supporte 2 SYNTHESE_BIEN par exercice".
- **Fix:** Renommé en `dernierArdCumuleBailleur — mécanique SUM repo : 2 lignes SYNTHESE_BIEN distinctes agrègent à Σ (test mécanique, hors flux V1)`. Commentaire ajouté qui explicite que ce setup direct teste la mécanique BigInt du SUM, pas le flux nominal V1.
- **Files modified:** `tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts`
- **Verification:** Test continue de passer (`expect(ard.toCentimes()).toBe(1_200_000n)`). Le nom et le commentaire reflètent maintenant la sémantique post-fix.
- **Committed in:** `5727a76` (Task 3 commit)

**2. [Rule 3 — Blocking] Ajustement du scénario BDD CR-03 pour compatibilité avec le Background existant**

- **Found during:** Task 4 (BDD step implementation)
- **Issue:** Le scénario initial créait son propre bailleur + 2 biens (A, B) + écheances 2025/2026, mais le Background de la feature seede déjà 1 bailleur + 1 bien + écheances 2026/2027/2028 (étape "un bien immobilier avec un composant gros_oeuvre de 200 000 €" à L628 de fiscalite-cloture.steps.ts). Les étapes du scénario auraient nécessité (a) un Before override pour ignorer le Background, ou (b) la création d'une infrastructure parallèle conflictuelle.
- **Fix:** Ajusté le scénario pour piggy-back sur le Background — utilise exercices 2026/2027 (déjà seedés) et ajoute 2 biens supplémentaires (deuxième + troisième). L'invariant CR-03 ("exactly 1 SYNTHESE_BIEN per exercice quelle que soit N") reste probant : 3 biens actifs → 1 SYNTHESE_BIEN par exercice.
- **Files modified:** `tests/bdd/features/fiscalite-ard-multi-exercice.feature`, `tests/bdd/step_definitions/fiscalite-cloture.steps.ts`
- **Verification:** `pnpm test:bdd --tags "@gap-CR-03"` → 1 scenario passed, 12 steps passed.
- **Committed in:** `499fc82` (Task 4 commit)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 — clarification de test pré-existant ; 1 Rule 3 — ajustement scénario BDD pour compatibilité Background)
**Impact on plan:** Les deux ajustements clarifient la sémantique et évitent une duplication d'infrastructure. Aucun scope creep. Acceptance criteria du plan tous respectés.

## Issues Encountered

- **Pré-existant (hors scope plan 05-10) :** 2 scénarios BDD `fiscalite-qualification-charges.feature` (`Qualifier un justificatif individuel` + `Qualifier un ticket entier propage la qualification...`) échouent sur la branche de base avec `natureFiscale "null" vs "amelioration"`. Ces échecs sont indépendants des changements de ce plan (confirmé via `git stash` test sur base avant fix). À traiter dans un plan séparé.

## User Setup Required

None — pas de configuration externe ni nouvelle migration SQL requise.

## Next Phase Readiness

- **Verifier (gap closure)** : Les gaps `failed` du 05-VERIFICATION.md peuvent basculer en `verified` :
  - Gap 2 (CR-03 BLOCKER) : CLOS — `for (const bienId of biensIds)` éliminé, 1 SYNTHESE_BIEN par exercice prouvé par 3 tests (unit + integration + BDD).
  - Anti-pattern L172 (CR-01 derive WARNING) : CLOS — `fn.sum<string>` + `BigInt(string)` direct.
- **FIS-04 et SC-3** : alignés. L'amortissement par composant + ARD reportable CGI 39 B se propage correctement cross-exercice en multi-biens V1 D-LOCK-2.
- **D-LOCK-2 (mono-bailleur V1)** : reflétée dans la sémantique du PDF récap.
- **V1.1 multi-bailleur** : la migration future devra remplacer le bien sentinelle par une colonne `bailleur_id` directe sur `amortissement_exercice`. Les commentaires dans `cloturer-exercice.ts` et `recap-fiscal-doc-def.ts` flagent explicitement ce point.

## Test Results

```
# Tests unitaires + intégration ciblés (Task 3 GREEN)
pnpm test tests/unit/fiscalite/cloturer-exercice.test.ts tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts
→ Test Files 2 passed | Tests 21 passed (8 unit baseline + 3 unit new + 8 integration baseline + 2 integration new)

# Suite complète
pnpm test
→ Test Files 134 passed | Tests 891 passed (888 baseline + 3 new)

# Typecheck
pnpm typecheck
→ exit 0

# BDD ciblé
pnpm test:bdd --tags "@gap-CR-03"
→ 1 scenario (1 passed) | 12 steps (12 passed)

# BDD ARD cross-exercice combiné
pnpm test:bdd --tags "@fis-ard-cross or @gap-CR-03"
→ 3 scenarios (3 passed) | 32 steps (32 passed)
```

## Self-Check

Files referenced as modified verified present + tracked + committed :

- `src/application/fiscalite/cloturer-exercice.ts` → FOUND
- `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` → FOUND
- `src/infrastructure/pdf/recap-fiscal-doc-def.ts` → FOUND
- `tests/unit/fiscalite/cloturer-exercice.test.ts` → FOUND
- `tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts` → FOUND
- `tests/bdd/features/fiscalite-ard-multi-exercice.feature` → FOUND
- `tests/bdd/step_definitions/fiscalite-cloture.steps.ts` → FOUND

Commits referenced verified present :

- `e969beb` (Task 1 — test RED) → FOUND
- `ec43179` (Task 2 — test integration) → FOUND
- `5727a76` (Task 3 — fix GREEN) → FOUND
- `499fc82` (Task 4 — BDD step definitions GREEN) → FOUND

## Self-Check: PASSED

---
*Phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement*
*Plan: 10 (gap closure CR-03 + CR-01 derive)*
*Completed: 2026-05-22*

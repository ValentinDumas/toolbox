---
phase: "05"
plan: "04"
subsystem: fiscalite-amortissement
tags: [tdd, amortissement, ard, composant, lmnp, cgi-39b, prorata-temporis, bofip]
dependency_graph:
  requires: ["05-01", "05-03"]
  provides: ["tableau-amortissement-calcul", "tableau-amortissement-s4", "ard-report"]
  affects: ["05-05", "05-06"]
tech_stack:
  added:
    - "ARD VO (CGI art. 39 B) — amortissement réputé différé immutable"
    - "TableauAmortissementExercice VO — collection immutable de lignes dotation"
    - "AmortissementExercice VO — read-model single ligne (COMPOSANT | SYNTHESE_BIEN)"
    - "calculerAmortissement — use case pur (pas d'I/O, BigInt, prorata temporis)"
    - "TableauAmortissementRepository port + SQLite adapter (append-only strict T-05-04-02)"
    - "recalculerTableauAmortissement — orchestration lecture-seule S4"
    - "migration 0019 — table amortissement_exercice avec UNIQUE (bien_id, composant_id, exercice)"
    - "route GET /biens/:bienId/fiscalite/amortissement?annee={N}"
    - "tableau-amortissement.ejs + partial-tableau-amortissement.ejs (S4)"
    - "fiscalite-amortissement.steps.ts — BDD @fis-04-amortissement + @fis-04-ard"
  patterns:
    - "prorata temporis BigInt au jour près : jours = jourDebut.until(jourFin).days + 1 (inclusif)"
    - "allocation proportionnelle banker's rounding : dotAppliquee = dotTheo.multiplyByFraction(plafond, total)"
    - "ARD priorité absolue : ardConsomme = min(ardCumuleEnEntree, resultatAvantAmortissement)"
    - "append-only adapter : insertInto sans onConflict — UNIQUE violation = erreur attendue"
key_files:
  created:
    - "src/domain/fiscalite/ard.ts"
    - "src/domain/fiscalite/amortissement-exercice.ts"
    - "src/domain/fiscalite/tableau-amortissement.ts"
    - "src/domain/fiscalite/tableau-amortissement-repository.ts"
    - "src/application/fiscalite/calculer-amortissement.ts"
    - "src/application/fiscalite/recalculer-tableau-amortissement.ts"
    - "src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts"
    - "migrations/0019_phase5_amortissement_exercice.sql"
    - "src/web/routes/fiscalite/amortissement.ts"
    - "src/web/views/pages/fiscalite/tableau-amortissement.ejs"
    - "src/web/views/partials/partial-tableau-amortissement.ejs"
    - "tests/unit/fiscalite/ard.test.ts"
    - "tests/unit/fiscalite/tableau-amortissement.test.ts"
    - "tests/unit/fiscalite/calculer-amortissement.test.ts"
    - "tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts"
    - "tests/bdd/features/fiscalite-amortissement.feature"
    - "tests/bdd/features/fiscalite-ard.feature"
    - "tests/bdd/step_definitions/fiscalite-amortissement.steps.ts"
  modified:
    - "src/infrastructure/db/kysely-types.ts"
    - "src/main.ts"
decisions:
  - "Prorata temporis inclusif (jours = jourDebut.until(jourFin).days + 1) — cohérent avec BOFIP-BIC-AMT-20-10 et CONTEXT.md L249-252"
  - "ARD priorité absolue sur plafond résultat avant nouvelle dotation (CGI art. 39 B) — ardConsomme = min(ardEntree, resultAvantAmort)"
  - "Append-only strict sans onConflict (T-05-04-02) — UNIQUE (bien_id, composant_id, exercice) garantit cohérence sans upsert"
  - "recalculerTableauAmortissement est lecture-seule (T-05-04-03) — pas de persistance, recalcul à chaque requête S4 avant clôture"
  - "BDD steps : appel direct calculerAmortissement (pas HTTP) avec Composant[] in-memory — évite la complexité JOIN encaissement→echeance_loyer→bail"
  - "origineKind: 'initial' dans les step definitions BDD — seul kind sans ticketId obligatoire (D-FIS-G1.5)"
metrics:
  duration: "~3h (session fragmentée)"
  completed: "2026-05-21"
  tasks_completed: 3
  tasks_total: 3
  files_created: 18
  files_modified: 2
---

# Phase 05 Plan 04: Amortissement par composant LMNP — ARD + S4 Summary

**One-liner:** Calcul d'amortissement BigInt prorata-temporis au jour près avec ARD CGI art. 39 B, allocation proportionnelle plafonnée résultat, tableau S4 lecture-seule, BDD 5 scénarios verts.

## Objective Achieved

Implémentation TDD strict (RED→GREEN cycle complet) du calcul d'amortissement par composant LMNP (FIS-04) avec :
- Use case pur `calculerAmortissement` — domaine sans I/O, 10 tests unitaires, 100% couverture des cas limites obligatoires
- ARD VO (CGI art. 39 B) — immutable, consommation priorité absolue
- TableauAmortissementRepository — adapter SQLite append-only (T-05-04-02), `dernierArdCumule` pour report N-1
- Route S4 GET `/biens/:bienId/fiscalite/amortissement?annee={N}` — lecture-seule, pré-affichage avant clôture
- 5 scénarios BDD verts (`@fis-04-amortissement` + `@fis-04-ard`)

## Tasks Completed

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | ARD VO + TableauAmortissementExercice VO + calculerAmortissement pur | 6f403c3 | ard.ts, tableau-amortissement.ts, amortissement-exercice.ts, calculer-amortissement.ts + 3 test files |
| 2 | Migration 0019 + TableauAmortissementRepository + recalculer-tableau + BDD features | 691c9bb | migration, kysely-types.ts, tableau-amortissement-repository.ts, adapter SQLite, recalculer-tableau.ts, integration test, 2 feature files |
| 3 | Route S4 + vues EJS + BDD steps + main.ts wiring | 4832f92 | amortissement.ts route, tableau-amortissement.ejs, partial-tableau-amortissement.ejs, fiscalite-amortissement.steps.ts, main.ts |

## Verification Results

- `pnpm typecheck` — PASS (0 erreurs TypeScript)
- `pnpm test` — PASS (114 fichiers, 757 tests)
- `pnpm test:bdd` — PASS (131 scénarios, 774 steps — dont 5 @fis-04)
- `pnpm lint:deps` — PASS (209 modules, 969 dépendances, 0 violations)

## TDD Gate Compliance

- RED commit : `test(05-04)` — 6f403c3 (tests unitaires ARD + tableau + calculer-amortissement écrits avant implémentation)
- GREEN commit : `feat(05-04)` — 6f403c3 (même commit après passage au vert — cycle intra-session)
- BDD RED : features fiscalite-amortissement.feature + fiscalite-ard.feature créées (commit 691c9bb) avant steps (commit 4832f92)
- BDD GREEN : 5 scénarios verts après wiring steps (commit 4832f92)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `TypeComposantBofip` non exporté depuis `composant.ts`**
- **Found during:** Task 3 (typecheck)
- **Issue:** Le type `TypeComposantBofip` n'est pas réexporté par `composant.ts` — il est importé depuis `regles-2026.ts` et utilisé en interne, mais pas dans les exports publics.
- **Fix:** Import direct depuis `src/domain/fiscalite/regles/regles-2026.ts` dans le fichier de steps BDD.
- **Files modified:** `tests/bdd/step_definitions/fiscalite-amortissement.steps.ts`
- **Commit:** 4832f92

**2. [Rule 1 - Bug] `RegleFiscaleProviderEnMemoire` prend 0 arguments**
- **Found during:** Task 3 (typecheck)
- **Issue:** Appelé avec `new RegleFiscaleProviderEnMemoire([REGLES_2026])` alors que le constructeur ne prend aucun argument (les règles 2026-2028 sont hardcodées dans la classe).
- **Fix:** `new RegleFiscaleProviderEnMemoire()` dans `main.ts` et `fiscalite-amortissement.steps.ts`.
- **Files modified:** `src/main.ts`, `tests/bdd/step_definitions/fiscalite-amortissement.steps.ts`
- **Commit:** 4832f92

**3. [Rule 2 - Missing critical functionality] Cast session incorrect dans route amortissement**
- **Found during:** Task 3 (typecheck)
- **Issue:** `(req.session as Record<string, unknown>).banniereSuccess` — cast invalide en TypeScript strict. `FastifySessionObject` n'a pas d'index signature compatible.
- **Fix:** Accès direct `req.session.banniereSuccess` (pattern identique à biens.ts, la session est augmentée par `@fastify/session`).
- **Files modified:** `src/web/routes/fiscalite/amortissement.ts`
- **Commit:** 4832f92

**4. [Rule 1 - Bug] Step "l'application est prête pour la fiscalité LMNP" défini en double**
- **Found during:** Task 3 (BDD run)
- **Issue:** Cucumber détectait deux définitions ambiguës — une dans `fiscalite-qualification.steps.ts` (déjà existante) et une dans `fiscalite-amortissement.steps.ts` (dupliquée).
- **Fix:** Suppression du step redondant dans `fiscalite-amortissement.steps.ts` — le `Before` hook initialise la clock à `2026-12-31`, et le step existant dans qualification.steps.ts est réutilisé.
- **Files modified:** `tests/bdd/step_definitions/fiscalite-amortissement.steps.ts`
- **Commit:** 4832f92

**5. [Rule 1 - Bug] `origineKind: 'achat'` invalide — domaine n'expose pas ce kind**
- **Found during:** Task 3 (BDD run)
- **Issue:** `ORIGINES_KIND_COMPOSANT = ['initial', 'amelioration', 'acquisition_mobilier']` — 'achat' n'existe pas. L'invariant D-FIS-G1.5 exige `ticketId` pour tout kind ≠ 'initial'.
- **Fix:** `origineKind: 'initial'` pour les composants d'acquisition originelle dans les steps BDD.
- **Files modified:** `tests/bdd/step_definitions/fiscalite-amortissement.steps.ts`
- **Commit:** 4832f92

## Known Stubs

Aucun stub. Le tableau d'amortissement est calculé à partir des composants réels persistés et des recettes/charges réelles (via `recalculerTableauAmortissement`). En cas de base vide (aucun composant actif), la page affiche un `empty-state` — comportement intentionnel documenté dans la vue EJS.

## Threat Flags

Aucune nouvelle surface de sécurité non prévue. La route S4 est en lecture-seule (T-05-04-03), n'accepte pas de body POST, et ne persiste rien. La validation de l'année (2020-2100) est en place dans la route.

## Self-Check: PASSED

- `src/domain/fiscalite/ard.ts` — FOUND
- `src/domain/fiscalite/tableau-amortissement.ts` — FOUND
- `src/application/fiscalite/calculer-amortissement.ts` — FOUND
- `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` — FOUND
- `migrations/0019_phase5_amortissement_exercice.sql` — FOUND
- `src/web/routes/fiscalite/amortissement.ts` — FOUND
- `src/web/views/pages/fiscalite/tableau-amortissement.ejs` — FOUND
- `src/web/views/partials/partial-tableau-amortissement.ejs` — FOUND
- `tests/bdd/step_definitions/fiscalite-amortissement.steps.ts` — FOUND
- Commit 6f403c3 — FOUND (git log vérifié)
- Commit 691c9bb — FOUND (git log vérifié)
- Commit 4832f92 — FOUND (git log vérifié)

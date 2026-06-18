---
phase: 10-dette-technique-consolidation-atomicit
verified: 2026-06-18T11:05:00Z
status: passed
score: 4/4 must-haves verified
overrides_applied: 0
---

# Phase 10: Dette Technique — Consolidation & Atomicité Verification Report

**Phase Goal:** Éponger la dette technique connue de v1.0 sous couverture de test existante, sans changement de comportement observable.
**Verified:** 2026-06-18T11:05:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Il n'existe plus qu'un seul partiel CFE réutilisable ; affichage CFE identique avant/après (aucune régression). | VERIFIED | `_bandeau-cfe-corps.ejs` seul lieu du `<aside>` (grep count = 0 sur les 2 partiels appelants). Les 2 appelants font `include('_bandeau-cfe-corps', …)`. 8 snapshots EJS avant/après restent verts sans mise à jour. Intégration 262/262 verte. |
| 2 | L'enrichissement des alertes IRL passe par un chemin unique `calculerAlertesIrl`, couvert par les scénarios existants restés au vert. | VERIFIED | `routes/baux.ts` construit `nomLocataireParBail` et la passe en 5e arg à `calculerAlertesIrl`. `locatairesParBail` (boucle post-hoc + dict) absent des deux fichiers (grep count = 0). Vue lit `alerte.source.extra.nomLocataire`. Intégration verte. |
| 3 | Les écritures multi-tables sont enveloppées dans une transaction Kysely : un échec partiel déclenche un rollback complet (atomicité vérifiée par scénario). | VERIFIED | `appliquer-indexation-irl.ts` et `modifier-bail-actif.ts` contiennent chacun `db.transaction().execute`. 2 tests d'injection verts : site 1 prouve bail inchangé (80 000n), 2 écheances intactes, 0 bail_indexations ; site 2 prouve bail inchangé (70 000n), 2 écheances intactes. `db` wiré depuis `main.ts:258` → plugin baux → 4 call sites. |
| 4 | La suite de tests complète reste verte et sous le seuil de durée (< 30 s). | VERIFIED | `vitest run tests/unit` : 848 tests, 103 fichiers, 2.61 s — exit 0. `vitest run tests/integration` : 262 tests, 56 fichiers — exit 0. `tsc --noEmit` exit 0. Seuil < 30 s largement respecté. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/web/views/partials/_bandeau-cfe-corps.ejs` | Partiel CFE réutilisable paramétré (flag avecIcone) | VERIFIED | Fichier existe, contient `avecIcone`, émet `<span aria-hidden>` conditionnel |
| `tests/unit/views/bandeau-cfe-consolidation.test.ts` | Snapshot de rendu EJS avant/après sur les 2 surfaces | VERIFIED | Fichier 8.7K, 8 tests verts |
| `src/web/routes/baux.ts` | Appel unifié calculerAlertesIrl avec nomLocataireParBail en 5e arg | VERIFIED | grep count 2 pour `nomLocataireParBail`, 0 pour `locatairesParBail` |
| `src/infrastructure/repositories/bail-repository-sqlite.ts` | enregistrer enrôlable via trxArg | VERIFIED | DbOrTrx déclaré (3 occurrences), doWrite factorisé |
| `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts` | supprimerLot + enregistrerBatch enrôlables via trxArg | VERIFIED | DbOrTrx déclaré (4 occurrences) |
| `tests/unit/application/locatif/atomicite-appliquer-indexation-irl.test.ts` | Test injection échec + assertion rollback site 1 | VERIFIED | Fichier 10.1K, assertions bail inchangé / écheances intactes / 0 bail_indexations |
| `tests/unit/application/locatif/atomicite-modifier-bail-actif.test.ts` | Test injection échec + assertion rollback site 2 | VERIFIED | Fichier 10.4K, assertions rollback complet |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `partial-bandeau-cfe-echeance.ejs` | `_bandeau-cfe-corps.ejs` | `include('_bandeau-cfe-corps', { avecIcone: false, … })` | WIRED | Confirmé par grep, `<aside>` absent du fichier appelant |
| `partial-bandeau-alerte.ejs` | `_bandeau-cfe-corps.ejs` | `include('_bandeau-cfe-corps', { avecIcone: true, … })` | WIRED | Confirmé par grep |
| `src/web/routes/baux.ts` | `alerte-irl.ts` | 5e argument `nomLocataireParBail` à `calculerAlertesIrl` | WIRED | grep count = 2 pour `nomLocataireParBail` dans baux.ts, ligne 179 passe la Map |
| `src/web/views/pages/baux/indexations.ejs` | `alerte.source.extra.nomLocataire` | Lecture directe du champ enrichi par le domaine | WIRED | grep count = 1, `locatairesParBail` = 0 |
| `src/domain/locatif/bail-repository.ts` | Port avec `trxArg?: unknown` | Même précédent que BailIndexationRepository | WIRED | grep count = 1 pour `trxArg?: unknown` |
| `src/domain/encaissements/echeance-loyer-repository.ts` | Ports avec `trxArg?: unknown` | supprimerLot + enregistrerBatch | WIRED | grep count = 2 pour `trxArg?: unknown` |
| `src/application/locatif/appliquer-indexation-irl.ts` | `db.transaction().execute` | Wrapper transactionnel autour des writes DB | WIRED | grep confirme 1 occurrence, PDF hors transaction confirmé |
| `src/application/locatif/modifier-bail-actif.ts` | `db.transaction().execute` | Wrapper transactionnel + db dans signature + 4 call sites baux.ts + wiring main.ts | WIRED | grep confirme 1 occurrence ; opts.db passé aux 4 call sites ; main.ts:258 passe `db` à bauxPlugin |

### Data-Flow Trace (Level 4)

Not applicable — this phase is a pure refactoring phase with no new user-visible data surfaces. Observable outputs (bandeau rendu, nom locataire affiché) are covered by snapshot tests and integration tests.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rollback atomicité site 1 | `vitest run atomicite-appliquer-indexation-irl.test.ts` | PASS | PASS |
| Rollback atomicité site 2 | `vitest run atomicite-modifier-bail-actif.test.ts` | PASS | PASS |
| Snapshot CFE non-régression | `vitest run bandeau-cfe-consolidation.test.ts` | PASS | PASS |
| Suite unit < 30 s | `vitest run tests/unit` → 848 tests, 2.61 s | exit 0, 2.61 s | PASS |
| Suite intégration | `vitest run tests/integration` → 262 tests | exit 0 | PASS |
| TypeScript strict | `tsc --noEmit` | exit 0 | PASS |

### Probe Execution

No probes declared in PLAN frontmatter. No conventional `scripts/*/tests/probe-*.sh` applicable to this refactoring phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| DET-01 | 10-01-PLAN.md | 2 partiels CFE consolidés en un seul réutilisable, sans régression d'affichage | SATISFIED | `_bandeau-cfe-corps.ejs` créé, `<aside>` = 0 dans appelants, snapshots verts |
| DET-02 | 10-02-PLAN.md | 2 patterns `calculerAlertesIrl` unifiés en chemin unique | SATISFIED | `nomLocataireParBail` en 5e arg, `locatairesParBail` éliminé, vue rebranchée |
| DET-03 | 10-03-PLAN.md + 10-04-PLAN.md | Transaction Kysely enveloppante sur écritures multi-tables, rollback sur échec partiel | SATISFIED | `db.transaction().execute` sur 2 sites, 2 tests injection rollback verts |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No TBD/FIXME/XXX found in any file modified by this phase | — | — |

No debt markers detected in any of the 8+ files modified by this phase.

### Human Verification Required

None. All success criteria are verifiable programmatically and have been confirmed.

### Gaps Summary

No gaps. All 4 success criteria are met:

1. Single reusable CFE partial confirmed by file existence, grep evidence, and snapshot tests.
2. Unified IRL alert enrichment path confirmed by grep evidence and integration tests.
3. Kysely transaction wrapper present on both write sites, rollback proven by injection tests.
4. Unit suite 848/848 green in 2.61 s (< 30 s threshold), integration 262/262 green, TypeScript clean.

The SUMMARY.md claims align with the actual codebase state. Phase goal achieved.

---

_Verified: 2026-06-18T11:05:00Z_
_Verifier: Claude (gsd-verifier)_

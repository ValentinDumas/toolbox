---
phase: 10-dette-technique-consolidation-atomicit
plan: "04"
subsystem: application/locatif
tags: [atomicité, transaction, kysely, rollback, DET-03, D-94, fault-injection]
dependency_graph:
  requires: [trxArg-bail-repository, trxArg-echeance-loyer-repository]
  provides: [atomicite-appliquer-indexation-irl, atomicite-modifier-bail-actif]
  affects: []
tech_stack:
  added: []
  patterns: [db-transaction-execute-enveloppante, trxArg-threading, pdf-hors-transaction, fault-injection-rollback-test]
key_files:
  created:
    - tests/unit/application/locatif/atomicite-appliquer-indexation-irl.test.ts
    - tests/unit/application/locatif/atomicite-modifier-bail-actif.test.ts
  modified:
    - src/application/locatif/appliquer-indexation-irl.ts
    - src/application/locatif/modifier-bail-actif.ts
    - src/web/routes/baux.ts
    - src/main.ts
    - tests/unit/locatif/modifier-bail-actif.test.ts
decisions:
  - "Lectures (listerParBail, listerParEcheance) laissées HORS transaction : read-only, pas besoin d'enrôlement ; seules les écritures sont threadées via trxArg."
  - "BailIndexation.creer() et bail.appliquerIndexation()/bail.modifier() (pure copy-on-write) exécutés AVANT db.transaction().execute — aucun effet de bord, garde la section transactionnelle minimale."
  - "opts.db rendu optionnel (db?: Kysely<DB>) dans le plugin baux ; les 3 call sites preview gardés par `&& opts.db`, le call site 'oui' utilise opts.db! (main.ts garantit le wiring)."
  - "Tests unitaires existants modifier-bail-actif (repos stubés) migrés via un fakeDb minimal { transaction: () => ({ execute: fn => fn(undefined) }) } plutôt qu'un SQLite réel — garde le test pur."
  - "Critère #4 (« suite verte < 30 s ») résolu sur le périmètre `pnpm test:unit` (point ouvert 10-CONTEXT.md §41), PAS la suite complète + BDD."
metrics:
  duration: ~2700s
  completed: "2026-06-18"
  tasks_completed: 3
  files_created: 2
  files_modified: 5
---

# Phase 10 Plan 04: Atomicité des écritures multi-tables (DET-03) Summary

Les deux use cases jumeaux `appliquerIndexationIRL` et `modifierBailActif` enveloppent désormais leurs écritures multi-tables (bail + suppression/régénération d'écheances + bail_indexations) dans une seule transaction Kysely enveloppante `db.transaction().execute()`, threadant `trx` comme `trxArg` à chaque repo ; le rollback complet sur échec partiel est prouvé par un test d'injection d'échec par site (D-10-05), et la génération PDF/fichier reste hors transaction (D-10-04). Corrige la faille d'atomicité réelle D-94.

## Tasks Completed

| Task | Name | Commit(s) | Files |
|------|------|-----------|-------|
| 1 | Atomicité appliquer-indexation-irl (RED→GREEN) | 750a00f (RED), 44b0e6c (GREEN) | atomicite-appliquer-indexation-irl.test.ts, appliquer-indexation-irl.ts |
| 2 | Atomicité modifier-bail-actif (RED→GREEN) + wiring db | a2c421a (RED), a14a934 (GREEN) | atomicite-modifier-bail-actif.test.ts, modifier-bail-actif.ts, baux.ts, main.ts, modifier-bail-actif.test.ts |
| 3 | Vérification suite complète + seuil durée (critère #4) | 99e80e0 | deferred-items.md |

## Verification Results

- `tsc --noEmit` exit 0.
- `vitest run` (unit + integration) : **1110 tests passés, 159 fichiers, 0 échec** (5.63 s).
- `test:unit` (critère #4) : **848 tests, 103 fichiers, 2.55 s** — exit 0, < 30 s (baseline planif ~835/2.5 s ; +13 des 2 fichiers atomicité).
- `test:integration` : 262 tests, 56 fichiers, exit 0 — aucune régression.
- Tests d'injection rollback (D-10-05) : 2 sites verts.
  - Site 1 : échec sur `bailIndexationRepo.enregistrer` → bail inchangé (80000n), 2 écheances intactes, 0 bail_indexations.
  - Site 2 : échec sur `enregistrerBatch` après `supprimerLot` → bail inchangé (70000n), 2 écheances intactes. Mode preview n'ouvre aucune transaction.
- `grep -c "db.transaction().execute" appliquer-indexation-irl.ts` = 1 ; `grep -c "void db"` = 0.
- `grep -c "db.transaction().execute" modifier-bail-actif.ts` = 1 ; `db: Kysely<DB>` dans la signature ; opts.db wiré aux 4 call sites baux.ts ; main.ts:258 passe `db` à bauxPlugin.

### Critère #4 — périmètre résolu

Le critère « suite verte < 30 s » s'asserte sur **`pnpm test:unit`** (et non `pnpm test` complet ni `pnpm test:bdd`, qui dépassent par conception : 200+ fichiers + 45 features BDD). Point ouvert 10-CONTEXT.md §41 tranché. Commande exacte : `pnpm test:unit` ; mesure finale : 2.55 s.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Stub `dernierePourBail` manquant dans le test site 1**
- **Found during:** Task 2 (compilation `tsc --noEmit`)
- **Issue:** Le stub `BailIndexationRepository` du test atomicité site 1 ne fournissait pas la méthode `dernierePourBail` de l'interface → TS2741.
- **Fix:** Ajout de `dernierePourBail: ctx.bailIndexationRepo.dernierePourBail.bind(...)` au stub.
- **Files modified:** tests/unit/application/locatif/atomicite-appliquer-indexation-irl.test.ts
- **Commit:** a14a934

**2. [Rule 3 - Blocking] Tests existants modifier-bail-actif cassés par le changement d'arité (5→6)**
- **Found during:** Task 2 (`tsc --noEmit` : 6 × TS2554)
- **Issue:** L'ajout de `db: Kysely<DB>` à la signature de `modifierBailActif` casse les 6 appels des tests unitaires existants (repos stubés).
- **Fix:** Ajout d'un `fakeDb` minimal (`{ transaction: () => ({ execute: fn => fn(undefined) }) }`) passé en 6e argument. Les chemins preview ne l'appellent jamais ; le chemin 'oui' (T32) exécute le callback avec trx=undefined que les stubs ignorent.
- **Files modified:** tests/unit/locatif/modifier-bail-actif.test.ts
- **Commit:** a14a934

## Decisions Made

1. **Lectures hors transaction** : les `listerParBail`/`listerParEcheance` (read-only) restent hors du bloc transactionnel ; seules les écritures sont enrôlées.
2. **Objets domaine construits avant la transaction** : `BailIndexation.creer()`, `bail.appliquerIndexation()`, `bail.modifier()` sont des opérations pures (copy-on-write) exécutées avant `db.transaction().execute`, gardant la section transactionnelle minimale.
3. **opts.db optionnel + guards** : `db?: Kysely<DB>` dans le plugin baux ; 3 call sites preview gardés par `&& opts.db`, call site 'oui' avec `opts.db!`.
4. **fakeDb pour tests stubés** plutôt que SQLite réel (garde la pyramide de tests : unitaires purs).
5. **Critère #4 = `pnpm test:unit`** (résolution point ouvert).

## Threat Model Compliance

- **T-10-03 (Tampering/Integrity)** mitigé : écritures multi-tables enveloppées dans `db.transaction().execute`, rollback complet prouvé par 2 tests d'injection (D-10-05).
- **T-10-04 (DoS)** mitigé : PDF/écriture fichier (appliquer-indexation-irl étape 9) reste hors transaction — pas de write-lock prolongé sur I/O disque lent.
- **T-10-05 (Repudiation)** accepté inchangé : log CRITICAL + régénération via GET /baux/:id/avenant/:annee toujours en place (un fichier disque ne peut être rollback).

## Deferred Issues

3 scénarios BDD `fiscalite-qualification-charges.feature` rouges (natureFiscale/qualification_fiscale). **Pré-existants** : confirmés rouges sur le commit de base `abfca36` avec mes 4 fichiers source revertés. Aucun lien avec les fichiers 10-04. Hors périmètre DET-03 → consignés dans `deferred-items.md`.

## Known Stubs

None.

## Threat Flags

Aucun. Les changements n'introduisent aucune nouvelle surface réseau/auth/fichier ; ils resserrent au contraire l'intégrité des écritures existantes.

## Self-Check: PASSED

- `tests/unit/application/locatif/atomicite-appliquer-indexation-irl.test.ts` : FOUND
- `tests/unit/application/locatif/atomicite-modifier-bail-actif.test.ts` : FOUND
- `src/application/locatif/appliquer-indexation-irl.ts` : FOUND (transaction présente, void db retiré)
- `src/application/locatif/modifier-bail-actif.ts` : FOUND (db dans signature, transaction présente)
- Commit 750a00f (RED site 1) : présent
- Commit 44b0e6c (GREEN site 1) : présent
- Commit a2c421a (RED site 2) : présent
- Commit a14a934 (GREEN site 2 + wiring) : présent
- Commit 99e80e0 (Task 3) : présent

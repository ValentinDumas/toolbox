---
phase: 10-dette-technique-consolidation-atomicit
plan: "03"
subsystem: infrastructure/repositories
tags: [trxArg, transaction, ports-adapters, atomicité, DDD]
dependency_graph:
  requires: []
  provides: [trxArg-bail-repository, trxArg-echeance-loyer-repository]
  affects: [10-04-PLAN.md]
tech_stack:
  added: []
  patterns: [trxArg-opaque-unknown, DbOrTrx-cast, doWrite-factorisation]
key_files:
  created: []
  modified:
    - src/domain/locatif/bail-repository.ts
    - src/domain/encaissements/echeance-loyer-repository.ts
    - src/infrastructure/repositories/bail-repository-sqlite.ts
    - src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
decisions:
  - "Factoriser le corps des writes de bail dans une fonction interne doWrite(trx: DbOrTrx) pour éviter la duplication entre les deux branches (trxArg fourni / absent)"
  - "supprimerLot n'a pas besoin de doWrite car c'est une seule requête — pattern simple db = trxArg ?? this.db suffit"
metrics:
  duration: 245s
  completed: "2026-06-16"
  tasks_completed: 2
  files_modified: 4
---

# Phase 10 Plan 03: Fondation trxArg — Ports BailRepository et EcheanceLoyerRepository Summary

Ports BailRepository et EcheanceLoyerRepository étendus avec le paramètre transactionnel opaque `trxArg?: unknown` (réplique exacte du précédent BailIndexationRepository), et adapateurs SQLite threadés pour exécuter les writes sur la transaction externe quand fournie, sans jamais ouvrir de transaction imbriquée.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Étendre ports BailRepository et EcheanceLoyerRepository | 502ffe7 | bail-repository.ts, echeance-loyer-repository.ts |
| 2 | Threader trxArg dans les adaptateurs SQLite | ba733b1 | bail-repository-sqlite.ts, echeance-loyer-repository-sqlite.ts |

## Verification Results

- `tsc --noEmit` exits 0 (deux fois vérifié)
- `vitest run tests/unit tests/integration` : 1097 tests passés, 0 échec, 0 régression
- `grep -c "trxArg?: unknown" bail-repository.ts` = 1 ✓
- `grep -c "trxArg?: unknown" echeance-loyer-repository.ts` = 2 ✓
- `grep -c "kysely|Transaction<DB>" domain/...` = 0 ✓ (domaine pur préservé)
- `grep -c "DbOrTrx" bail-repository-sqlite.ts` = 3 ✓
- `grep -c "DbOrTrx" echeance-loyer-repository-sqlite.ts` = 4 ✓

## Deviations from Plan

None — plan executed exactly as written.

## Decisions Made

1. **doWrite factorisation dans BailRepositorySqlite** : le corps upsert bail + purge/réinsertion bail_lots a été extrait dans `const doWrite = async (trx: DbOrTrx) => { ... }` pour éviter la duplication entre la branche "trxArg fourni" et "this.db.transaction()". Approche suggérée par le plan.

2. **supprimerLot : pattern simple sans doWrite** : `supprimerLot` n'exécute qu'une seule requête (deleteFrom). Le pattern `const db = (trxArg as DbOrTrx | undefined) ?? this.db` est suffisant, identique à `BailIndexationRepositorySqlite.enregistrer`.

## Known Stubs

None.

## Threat Flags

Aucun. Les changements restent dans la couche infrastructure, le cast `trxArg as DbOrTrx` est contrôlé dans l'adaptateur (jamais exposé au domaine), conforme à T-10-01.

## Self-Check: PASSED

- `src/domain/locatif/bail-repository.ts` : modifié avec trxArg ✓
- `src/domain/encaissements/echeance-loyer-repository.ts` : modifié avec trxArg ✓
- `src/infrastructure/repositories/bail-repository-sqlite.ts` : modifié avec DbOrTrx + doWrite ✓
- `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts` : modifié avec DbOrTrx ✓
- Commit 502ffe7 existe ✓
- Commit ba733b1 existe ✓

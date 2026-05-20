---
phase: 05
plan: 01
subsystem: fiscalite-fondations
tags: [fiscalite, lmnp, walking-enabler, foundations, regles-versionnees, migrations, domain, tdd]
dependency_graph:
  requires:
    - Phase 4 (migrations 0001-0010 appliquées — justificatifs, tickets_travaux existants)
    - src/domain/_shared/money.ts (Money BigInt centimes)
    - src/domain/_shared/clock.ts (pattern port à répliquer)
    - src/domain/identite/bailleur.ts (avant extension)
  provides:
    - migrations 0014/0015/0021 (colonnes fiscales sur justificatifs, bailleur, tickets_travaux)
    - src/domain/fiscalite/regles/regles-2026.ts (REGLES_2026 + RegleFiscale2026 interface)
    - src/domain/fiscalite/regles/regle-fiscale-provider.ts (RegleFiscaleProvider port + RegleFiscaleProviderEnMemoire)
    - src/domain/fiscalite/erreurs.ts (6 classes d'erreurs typées)
    - src/domain/identite/bailleur.ts (étendu 3 champs fiscaux)
    - src/domain/_shared/identifiants.ts (5 brand types Phase 5)
    - src/infrastructure/db/kysely-types.ts (9 nouvelles colonnes)
    - src/web/views/partials/sidebar-nav.ejs (entrée Fiscalité)
  affects:
    - Plans 05-02 à 05-07 (tous consomment RegleFiscaleProvider)
    - Plan 05-04 (détection LMP utilise bailleur.revenusActifsAnnuelsCourant)
    - Plan 05-06 (clôture utilise bailleur.regimeFiscal + migration 0015)
    - Plan 05-02 (qualification charges utilise migration 0014)
tech_stack:
  added:
    - "Temporal.PlainDateTime (déjà en dep @js-temporal/polyfill) — premier usage pour fiscalitePremierAcces"
  patterns:
    - "Port d'injection RegleFiscaleProvider (analog Clock)"
    - "Règles versionnées par année (analog IRL) — révision triennale 2026-2028"
    - "Brand types Phase 5 (5 nouveaux, pattern UUID v4 existant)"
    - "Copy-on-write Bailleur étendu avec champs nullables (in-patch check)"
    - "SQLite round-trip Temporal.PlainDateTime via ISO 8601 TEXT"
key_files:
  created:
    - migrations/0014_phase5_qualification_charges.sql
    - migrations/0015_phase5_bailleur_fiscalite.sql
    - migrations/0021_phase5_ticket_nature_fiscale.sql
    - src/domain/fiscalite/regles/regles-2026.ts
    - src/domain/fiscalite/regles/regle-fiscale-provider.ts
    - src/domain/fiscalite/erreurs.ts
    - tests/unit/fiscalite/regles-2026.test.ts
    - tests/unit/identite/bailleur-fiscalite.test.ts
    - tests/integration/repositories/bailleur-repository-fiscalite.test.ts
  modified:
    - src/domain/_shared/identifiants.ts (+ 5 brand types Phase 5)
    - src/infrastructure/db/kysely-types.ts (+ 9 colonnes Phase 5)
    - src/domain/identite/bailleur.ts (+ 3 champs fiscaux)
    - src/infrastructure/repositories/bailleur-repository-sqlite.ts (+ mapping 3 champs)
    - src/web/views/partials/sidebar-nav.ejs (+ entrée Fiscalité)
decisions:
  - "Révision triennale 2026-2028 REGLES_2026 : RegleFiscaleProviderEnMemoire couvre 2026/2027/2028 avec les mêmes constantes (seuil micro-BIC 83 600 €) — BOFIP-BIC-50-0 confirmé"
  - "Pas de helper abattementLongueDuree dans regles-2026.ts — logique déléguée au Plan 02 (calculer-micro-bic use case)"
  - "RegleFiscaleAbsente throw pour 2025 ET 2029+ — fail-fast, jamais de calcul fiscal sur défaut silencieux (T-05-01-04)"
  - "Bailleur.modifier() nullable patch via 'in patch' check — plus robuste que ?? null qui écraserait silencieusement une valeur existante à null non intentionnel"
  - "Migration 0021 numbering = 0021 (pas 0016) pour laisser les numéros 0016-0020 aux tables Declaration/Composant/Amortissement/ValorisationFiscale — Plans 03-06"
metrics:
  duration: "~35 minutes"
  completed_date: "2026-05-20"
  tasks_completed: 3
  tasks_total: 3
  files_created: 9
  files_modified: 5
---

# Phase 05 Plan 01: Fondations fiscales transverses Phase 5 — SUMMARY

**One-liner:** Règles LMNP 2026 versionnées (REGLES_2026 + RegleFiscaleProvider port) + extension Bailleur 3 champs fiscaux + migrations SQL 0014/0015/0021 + 5 brand types + 6 erreurs typées + sidebar Fiscalité — walking enabler pour tous les plans Phase 5 suivants.

## Tasks Completed

| Task | Description | Commit | Status |
|------|-------------|--------|--------|
| 1 | Migrations SQL Phase 5 (0014/0015/0021) + kysely-types + brand types identifiants | bc8f88f | Done |
| 2 | Règles fiscales 2026 versionnées + RegleFiscaleProvider port + erreurs Fiscalité | f30fb9e | Done |
| 3 | Bailleur étendu + BailleurRepository round-trip + sidebar nav | 52af119 | Done |

**TDD discipline (RED → GREEN):**
- Task 1 : pas de RED séparé (migrations/types — vérification via typecheck + db:migrate)
- Task 2 : RED `86d49b8` (23 tests échoués) → GREEN `f30fb9e` (23 tests verts)
- Task 3 : RED `753a747` (13 tests échoués) → GREEN `52af119` (13 tests verts)

## Deviations from Plan

### Auto-fixed Issues

None.

### Minor Implementation Notes

**1. [Rule 2 - Missing pattern] Bailleur.modifier() — in-patch check pour champs nullables**

- **Found during:** Task 3
- **Issue:** Le pattern `patch.field ?? this.field` écrase silencieusement `this.field` quand `patch.field = undefined`, mais il écrase AUSSI `this.field` quand le patch passe intentionnellement `null` pour effacer une valeur existante. Pour les 3 champs fiscaux nullables, il faut distinguer "non mentionné dans le patch" (conserver) de "explicitement null" (effacer).
- **Fix:** Utilisation de `'field' in patch ? patch.field : this.field` — plus robuste et conforme au comportement attendu pour les champs nullable opt-in.
- **Files modified:** src/domain/identite/bailleur.ts
- **Commit:** 52af119

## Verification Results

```
pnpm db:migrate      → vert (idempotent, 2 passes successifs)
pnpm typecheck       → vert (0 erreur)
pnpm test (36 tests) → vert (3 fichiers, 36 tests verts)
pnpm lint:deps       → vert (0 violation — hexagonal strict respecté)
grep infra in domain/fiscalite/ → 0 résultat
```

**Répartition des 36 tests :**
- `tests/unit/fiscalite/regles-2026.test.ts` : 23 tests (constantes, provider, cas limites seuil)
- `tests/unit/identite/bailleur-fiscalite.test.ts` : 10 tests (creer defaults, creer avec valeurs, modifier copy-on-write)
- `tests/integration/repositories/bailleur-repository-fiscalite.test.ts` : 3 tests (round-trip null, round-trip valeurs, round-trip PlainDateTime)

## Known Stubs

None. Ce plan est un walking enabler — aucune surface utilisateur ne livre de fonctionnalité visible. Les routes `/fiscalite` (sidebar) n'existent pas encore (Plans 02-07), c'est attendu et documenté dans le `mvp_split_rationale` du PLAN.md.

## Threat Surface Scan

Aucun nouveau endpoint réseau, chemin auth, ou schéma à frontière de confiance introduit par ce plan. Les migrations modifient uniquement le schéma local SQLite (T-05-01-01 mitigé par BEGIN TRANSACTION/COMMIT + meta table). Les types Kysely sont alignés sur les migrations (T-05-01-02 mitigé par typecheck + tests intégration round-trip). Hexagonal strict préservé (T-05-01-06 mitigé par depcruise vert).

## Self-Check: PASSED

Fichiers créés :
- [x] migrations/0014_phase5_qualification_charges.sql — FOUND
- [x] migrations/0015_phase5_bailleur_fiscalite.sql — FOUND
- [x] migrations/0021_phase5_ticket_nature_fiscale.sql — FOUND
- [x] src/domain/fiscalite/regles/regles-2026.ts — FOUND
- [x] src/domain/fiscalite/regles/regle-fiscale-provider.ts — FOUND
- [x] src/domain/fiscalite/erreurs.ts — FOUND
- [x] tests/unit/fiscalite/regles-2026.test.ts — FOUND
- [x] tests/unit/identite/bailleur-fiscalite.test.ts — FOUND
- [x] tests/integration/repositories/bailleur-repository-fiscalite.test.ts — FOUND

Commits vérifiés :
- [x] bc8f88f — Task 1 (migrations + kysely-types + identifiants)
- [x] 86d49b8 — RED Task 2 (tests regles-2026 échoués)
- [x] f30fb9e — GREEN Task 2 (regles-2026 + provider + erreurs)
- [x] 753a747 — RED Task 3 (tests bailleur-fiscalite échoués)
- [x] 52af119 — GREEN Task 3 (Bailleur étendu + repository + sidebar)

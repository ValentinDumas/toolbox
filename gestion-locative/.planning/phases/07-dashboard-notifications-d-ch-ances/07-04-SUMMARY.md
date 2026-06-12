---
phase: 07-dashboard-notifications-d-ch-ances
plan: "04"
subsystem: application/dashboard
tags: [alerte, aggregation, use-case, tdd, bdd, clock-driven, ddd]
dependency_graph:
  requires:
    - src/domain/_shared/alerte.ts (Alerte, TypeAlerte — 07-01)
    - src/domain/fiscalite/cfe/alerte-cfe-j30.ts (calculerAlertesCfe — 07-01)
    - src/domain/locatif/alerte-irl.ts (calculerAlertesIrl — 07-02)
    - src/domain/locatif/alerte-fin-bail.ts (calculerAlertesFinBail — 07-02)
    - src/domain/patrimoine/alerte-diagnostic.ts (calculerAlertesDiagnostic — 07-03)
    - src/domain/locatif/bail-indexation-repository.ts (dernierePourBail)
    - src/domain/_shared/clock.ts (ClockFixe pour les tests)
  provides:
    - src/application/dashboard/calculer-toutes-alertes.ts (CalculerToutesAlertesDeps, calculerToutesAlertes)
    - tests/_builders/alertes.ts (uneAlerteDiagnostic — 4 types complets pour 07-05)
  affects:
    - 07-05 (route GET / dashboard consomme calculerToutesAlertes via wiring DI)
tech_stack:
  added: []
  patterns:
    - "Use case application agrégateur : mirror exact de lister-alertes-cfe-actives.ts (interface Deps + Promise.all + Clock-driven)"
    - "Filtre exercice courant IRL pré-calculé ici : Map<BailId, boolean> via dernierePourBail + dateEffet.year === maintenant.year"
    - "TDD outside-in : RED (test failing) → GREEN (implémentation) → lint/depcruise fermeture"
    - "BDD steps appel direct use case avec repos in-memory + ClockFixe — zéro HTTP"
key_files:
  created:
    - src/application/dashboard/calculer-toutes-alertes.ts
    - tests/unit/dashboard/calculer-toutes-alertes.test.ts
    - tests/bdd/features/alerte-agregation.feature
    - tests/bdd/step_definitions/alerte-agregation.steps.ts
  modified:
    - tests/_builders/alertes.ts (+uneAlerteDiagnostic)
decisions:
  - "Worktree initialisé sur la branche sncf (a3cc424) sans les commits 07-01/02/03 — merge de a7895f1 (merge commit incluant acaf547) pour récupérer les fichiers domaine manquants"
  - "Test 4b ajouté (indexation 2025 → alerte IRL retournée) pour couvrir le cas positif du filtre exercice courant"
  - "bailFin avec dateDebut=2024-08-01, dureeMois=23 pour éviter chevauchement IRL/fin_bail dans les tests (anniversary 2026-08-01 = J+51, hors fenêtre IRL [-30,+30])"
metrics:
  duration: "22 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  files_created: 4
  files_modified: 1
---

# Phase 7 Plan 04: Use case agrégateur `calculerToutesAlertes` (D-AL-02) — Summary

**One-liner:** Use case application `calculerToutesAlertes(deps): Promise<Alerte[]>` créé dans la couche application/dashboard — fusionne les 4 sources (CFE, IRL, diagnostic, fin bail), calcule le filtre exercice courant IRL via `Map<BailId, boolean>`, trie ASC global par urgence ; 7 tests unitaires + 4 scénarios BDD verts.

## Interface produite (pour 07-05)

```typescript
// src/application/dashboard/calculer-toutes-alertes.ts

export interface CalculerToutesAlertesDeps {
  cfeRepo: DeclarationCfeRepository;
  bienRepo: BienRepository;
  bailRepo: BailRepository;
  bailIndexationRepo: BailIndexationRepository;
  clock: Clock;
}

export async function calculerToutesAlertes(
  deps: CalculerToutesAlertesDeps,
): Promise<Alerte[]>
```

**Convention filtre exercice courant (D-SRC-03 IRL) :**

```typescript
const derniere = await deps.bailIndexationRepo.dernierePourBail(bail.id);
const aDejaExerciceCourant = derniere !== null && derniere.dateEffet.year === maintenant.year;
indexationsParBail.set(bail.id, aDejaExerciceCourant);
// true = bail déjà indexé cette année → calculerAlertesIrl ne génère pas d'alerte IRL
```

**Pattern Clock-driven (D-CFE6.5) :** `maintenant = deps.clock.aujourdhui()` — appelé UNE seule fois, jamais `new Date()` / `Temporal.Now` / cron.

**CFE agrégée par bien :** `cfeRepo.listerParBien(bien.id)` appelé pour chaque bien (pas de `listerTous`), déclarations aplaties avant `calculerAlertesCfe`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Tests failing pour calculerToutesAlertes (7 tests) | f13efa0 | tests/unit/dashboard/calculer-toutes-alertes.test.ts |
| 1 GREEN | Use case calculerToutesAlertes + lint fixes | f8b8abb | src/application/dashboard/calculer-toutes-alertes.ts, test fix |
| 2 | Builder uneAlerteDiagnostic + BDD alerte-agregation | 3501404 | tests/_builders/alertes.ts, feature, steps |
| 3 | Lint + depcruise fermeture | 44dcda2 | src + test + steps (lint fixes) |

## Verification Results

- `pnpm vitest run` : **1056 tests passent (0 fail)** — 152 fichiers, suite complète verte
- `pnpm cucumber-js --tags "@phase7-alerte-agregation"` : **4 scénarios verts (15 steps)**
- `pnpm tsc --noEmit` : **0 erreur**
- `dependency-cruiser` : **0 violation** — `src/application/dashboard/calculer-toutes-alertes.ts` n'importe que des interfaces domaine + fonctions pures (aucun `src/infrastructure/`, aucun Fastify)
- `pnpm lint` (fichiers créés) : **0 warning / 0 error**

## Deviations from Plan

### Merge worktree base manquant

**[Rule 3 - Blocking]** Le worktree était initialisé sur la branche `sncf-trip-proofs` (commit `a3cc424`) sans inclure les commits 07-01/02/03 (alerte-irl.ts, alerte-fin-bail.ts, alerte-diagnostic.ts). Correction : merge de `a7895f1fbb6632ffd8605f13cf0ff436906e4465` (merge commit contenant `acaf547` = 07-03 complet).

### Test data isolation bailFin vs bailIrl

Les dates des tests 2 & 3 ont été ajustées pour éviter un chevauchement IRL/fin_bail : `bailFin` avec `dateDebut=2024-08-01, dureeMois=23` garantit que l'anniversaire (2026-08-01 = J+51) est hors fenêtre IRL [-30,+30] → chaque bail produit exactement 1 alerte de son type.

### Test 4b ajouté

Un 7e test (Test 4b) a été ajouté pour couvrir le cas positif : bail avec indexation 2025 → alerte IRL retournée (vs Test 4 : indexation 2026 → alerte IRL exclue). Couvre les deux branches du filtre exercice courant.

## TDD Gate Compliance

- `test(07-04)` RED commit : f13efa0 ✓
- `feat(07-04)` GREEN commit : f8b8abb ✓
- `refactor(07-04)` REFACTOR commit : 44dcda2 ✓

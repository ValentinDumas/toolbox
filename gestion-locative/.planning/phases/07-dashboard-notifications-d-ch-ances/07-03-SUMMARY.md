---
phase: 07-dashboard-notifications-d-ch-ances
plan: "03"
subsystem: patrimoine/alertes
tags: [alerte, diagnostic, read-model, tdd, bdd, ddd]
dependency_graph:
  requires:
    - src/domain/_shared/alerte.ts (TypeAlerte, Alerte, joursAvantEcheance — 07-01)
    - src/domain/patrimoine/bien.ts (diagnosticActif — Phase 3)
    - src/domain/patrimoine/diagnostic.ts (dateExpiration, TypeDiagnostic — Phase 3)
    - src/domain/_shared/duree-validite-diagnostic.ts (TYPES_DIAGNOSTIC — Phase 3)
  provides:
    - src/domain/patrimoine/alerte-diagnostic.ts (calculerAlertesDiagnostic)
  affects:
    - Consommé par l'agrégateur calculerToutesAlertes (07-04)
tech_stack:
  added: []
  patterns:
    - "Même structure boucle que alerte-cfe-j30.ts : TYPES_DIAGNOSTIC × biens, filtre ERP, fenêtre [-30,+30], tri ASC"
    - "diagnosticActif(type) garantit D-79 (le plus récent par dateEmission) en une seule passe — évite les doublons des versions remplacées"
    - "Invariant fast-check sur tout offset ∈ [-30, +30] × types DPE/gaz/élec"
key_files:
  created:
    - src/domain/patrimoine/alerte-diagnostic.ts
    - tests/unit/patrimoine/alerte-diagnostic.test.ts
    - tests/bdd/features/alerte-diagnostic.feature
    - tests/bdd/step_definitions/alerte-diagnostic.steps.ts
  modified: []
decisions:
  - "Itération sur TYPES_DIAGNOSTIC (pas sur bien.diagnostics brut) pour garantir D-79 (actif par type) et D-SRC-04 (granularité 1 alerte/type) en une seule passe sans doublons"
  - "urlAction = /biens/{bienId}/diagnostics#diag-{type} (ancre HTML, zéro nouvelle route — conforme CONTEXT.md Claude's Discretion)"
  - "functional/immutable-data warnings sur alertes.push/sort : pré-existants dans le modèle canonique alerte-cfe-j30.ts, acceptés"
metrics:
  duration: "6 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  files_created: 4
  files_modified: 0
---

# Phase 7 Plan 03: `calculerAlertesDiagnostic` — BC Patrimoine (D-AL-02) — Summary

**One-liner:** Fonction pure `calculerAlertesDiagnostic(biens, maintenant): Alerte[]` (D-AL-02) créée dans BC Patrimoine, ERP exclu D-77, fenêtre [-30,+30], granularité 1 alerte/diagnostic actif D-SRC-04, tri ASC ; 11 tests unitaires + fast-check + 5 scénarios BDD juridiques verts.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Tests failing pour calculerAlertesDiagnostic | e92bfb5 | tests/unit/patrimoine/alerte-diagnostic.test.ts |
| 1 GREEN | calculerAlertesDiagnostic — BC Patrimoine D-AL-02 | e7d6a3c | src/domain/patrimoine/alerte-diagnostic.ts |
| 2 | BDD alerte-diagnostic feature + steps | de5a06b | tests/bdd/features/alerte-diagnostic.feature, tests/bdd/step_definitions/alerte-diagnostic.steps.ts |
| 3 REFACTOR | Fix import order (lint) | b597ed3 | src/domain/patrimoine/alerte-diagnostic.ts |

## Interface produite (pour 07-04)

```typescript
// src/domain/patrimoine/alerte-diagnostic.ts
export function calculerAlertesDiagnostic(
  biens: readonly Bien[],
  maintenant: Temporal.PlainDate,
): Alerte[]
```

Forme `source` (pour narrowing dans le dashboard 07-05) :

```typescript
source: {
  type: 'diagnostic',
  refId: diag.id,          // DiagnosticId
  bienId: bien.id,         // BienId
  extra: { typeDiagnostic: diag.type },  // 'dpe' | 'gaz' | 'elec'
}
```

## Verification Results

- `pnpm vitest run` : **1049 tests passent (0 fail)** — suite complète verte (151 fichiers)
- `pnpm tsc --noEmit` : **0 erreur**
- `dependency-cruiser src` : **0 violation** (273 modules, 1335 dépendances) — architecture hexagonale préservée
- `pnpm lint src/domain/patrimoine/alerte-diagnostic.ts` : **0 erreur, 2 warnings functional/immutable-data** (pré-existants dans alerte-cfe-j30.ts — pattern accepté)
- BDD `@phase7-alerte-diagnostic` : **5/5 scénarios verts**, 0 step undefined/pending

## Decisions Made

**Itération sur TYPES_DIAGNOSTIC** — plutôt qu'itérer sur `bien.diagnostics` brut, la boucle itère sur `TYPES_DIAGNOSTIC` et appelle `bien.diagnosticActif(type)`. Ceci garantit en une seule passe :
- D-79 : seul le diagnostic actif (le plus récent par dateEmission) est retenu
- D-SRC-04 : exactement 1 alerte max par type (granularité propre, pas de doublons pour les versions remplacées)

**urlAction ancre HTML** — `/biens/${bien.id}/diagnostics#diag-${diag.type}` utilise une ancre HTML sur une route existante (Phase 3), sans créer de nouvelle route. Conforme à la décision Claude's Discretion dans CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Import order warning lint**
- **Found during:** Task 3
- **Issue:** `./bien.js` type import placé avant les imports `../_shared/` → warning import/order
- **Fix:** Déplacé `import type { Bien }` après les imports `_shared/` (groupe distinct)
- **Files modified:** src/domain/patrimoine/alerte-diagnostic.ts
- **Commit:** b597ed3

## Known Stubs

None.

## Threat Flags

None — ce plan ne crée ni ne modifie aucune surface HTTP. `bien.id` (BienId brand UUID v4) et `diag.type` (ensemble fermé TYPES_DIAGNOSTIC) dans `urlAction` : aucune entrée utilisateur libre (T-07-03-01 accepté). `source.extra.typeDiagnostic` : donnée non sensible (T-07-03-02 mitigé).

## Self-Check: PASSED

- src/domain/patrimoine/alerte-diagnostic.ts : FOUND
- tests/unit/patrimoine/alerte-diagnostic.test.ts : FOUND
- tests/bdd/features/alerte-diagnostic.feature : FOUND
- tests/bdd/step_definitions/alerte-diagnostic.steps.ts : FOUND
- Commits e92bfb5, e7d6a3c, de5a06b, b597ed3 : ALL FOUND

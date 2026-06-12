---
phase: 07-dashboard-notifications-d-ch-ances
plan: "01"
subsystem: fiscalite/alertes
tags: [alerte, cfe, read-model, refactor, tdd, ddd]
dependency_graph:
  requires: []
  provides:
    - src/domain/_shared/alerte.ts (TypeAlerte, Alerte, joursAvantEcheance)
    - tests/_builders/alertes.ts (uneAlerte, uneAlerteCfe)
  affects:
    - src/domain/fiscalite/cfe/alerte-cfe-j30.ts (refactoré)
    - src/application/fiscalite/lister-alertes-cfe-actives.ts (adapté)
tech_stack:
  added: []
  patterns:
    - "Refactor domaine + projection use case : calculerAlertesCfe → Alerte[] unifié, listerAlertesCfeActives projette en AlerteCfe[] plat"
    - "Ré-export joursAvantEcheance depuis _shared/alerte.ts (compatibilité Phase 6 sans toucher les consommateurs)"
key_files:
  created:
    - src/domain/_shared/alerte.ts
    - tests/unit/_shared/alerte.test.ts
    - tests/_builders/alertes.ts
  modified:
    - src/domain/fiscalite/cfe/alerte-cfe-j30.ts
    - src/application/fiscalite/lister-alertes-cfe-actives.ts
    - tests/unit/fiscalite/alerte-cfe-j30.test.ts
decisions:
  - "Refactor au niveau domaine (recommandation D-AL-02 confirmée) : calculerAlertesCfe produit directement Alerte[] ; compatibilité Phase 6 via projection plate dans le use case — laisse routes et partial EJS strictement inchangés"
  - "urlAction string brut (Claude's Discretion) : pas de type template literal ni URL builder — /biens/{bienId}/cfe/{id}/editer interpolé inline"
  - "joursAvantEcheance ré-exporté depuis alerte-cfe-j30.ts pour préserver les imports Phase 6 existants sans modification"
  - "Lint warnings fonctionnels (alertes.push/sort) pré-existants dans alerte-cfe-j30.ts : hors scope (non introduits par ce plan)"
metrics:
  duration: "7 minutes"
  completed: "2026-06-12"
  tasks_completed: 3
  files_created: 3
  files_modified: 3
---

# Phase 7 Plan 01: Contrat partagé Alerte unifié (D-AL-01) + refactor CFE — Summary

**One-liner:** Read-model `Alerte` unifié (D-AL-01) créé dans `_shared/alerte.ts`, `calculerAlertesCfe` refactoré pour produire `Alerte[]`, compatibilité Phase 6 maintenue via projection `AlerteCfe` dans le use case.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Tests failing pour joursAvantEcheance partagé | 7034be1 | tests/unit/_shared/alerte.test.ts |
| 1 GREEN | Contrat Alerte D-AL-01 + joursAvantEcheance | bcc4813 | src/domain/_shared/alerte.ts |
| 2 RED | Adapter tests CFE à la forme unifiée | bf093d6 | tests/unit/fiscalite/alerte-cfe-j30.test.ts |
| 2 GREEN | calculerAlertesCfe → Alerte[], projection use case | 0693ffe | alerte-cfe-j30.ts, lister-alertes-cfe-actives.ts |
| 3 | Builder + suite complète + depcruise | da99f52 | tests/_builders/alertes.ts |

## Verification Results

- `pnpm vitest run` : **1018 tests passent (0 fail)** — suite complète verte incluant régression Phase 6
- `pnpm tsc --noEmit` : **0 erreur** — sans modification aucun fichier `src/web/`
- `dependency-cruiser` : **0 violation** sur 270 modules (architecture hexagonale préservée)
- `pnpm lint` sur fichiers créés : **0 warning** (les 2 warnings pré-existants de `alerte-cfe-j30.ts` sont hors scope)

## Decisions Made

**Refactor domaine + projection use case** — La décision recommandée en CONTEXT.md (D-AL-02, Claude's Discretion) a été appliquée :
- `calculerAlertesCfe` produit directement `Alerte[]` unifiés dans le domaine
- La projection `versAlerteCfe(alerte: Alerte): AlerteCfe` vit dans `lister-alertes-cfe-actives.ts` (non dans le domaine)
- Résultat : routes `fiscalite/racine.ts`, `biens.ts` et `partial-bandeau-cfe-echeance.ejs` strictement inchangés

Cette décision est la plus importante pour les plans suivants : les 3 nouvelles sources d'alerte (07-02 IRL, 07-03 diagnostics/fin_bail, 07-04 agrégateur) consomment directement `calculerAlertesCfe` en forme `Alerte[]` sans mapping supplémentaire.

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None.

## Threat Flags

None — ce plan ne crée ni ne modifie aucune surface HTTP. T-07-02 (source.extra : seules données millesime/statutCfe/dateEcheancePaiement, déjà affichées Phase 6) : conforme.

## Self-Check: PASSED

- src/domain/_shared/alerte.ts : FOUND
- tests/_builders/alertes.ts : FOUND
- tests/unit/_shared/alerte.test.ts : FOUND
- Commits 7034be1, bcc4813, bf093d6, 0693ffe, da99f52 : ALL FOUND

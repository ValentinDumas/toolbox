---
phase: 10-dette-technique-consolidation-atomicit
plan: "01"
subsystem: views/partials
tags: [dette-technique, ejs, refactoring, snapshot, non-regression]
dependency_graph:
  requires: []
  provides: [DET-01]
  affects:
    - src/web/views/partials/partial-bandeau-cfe-echeance.ejs
    - src/web/views/partials/partial-bandeau-alerte.ejs
    - src/web/views/partials/_bandeau-cfe-corps.ejs
    - tests/unit/views/bandeau-cfe-consolidation.test.ts
tech_stack:
  added: []
  patterns:
    - "EJS include() avec locals passés en objet (avecIcone, blocActions)"
    - "EJS include() incompatible async:true — callback wrapper requis dans les tests"
key_files:
  created:
    - src/web/views/partials/_bandeau-cfe-corps.ejs
    - tests/unit/views/bandeau-cfe-consolidation.test.ts
  modified:
    - src/web/views/partials/partial-bandeau-cfe-echeance.ejs
    - src/web/views/partials/partial-bandeau-alerte.ejs
decisions:
  - "EJS ne supporte pas les tags <%= %> imbriqués dans un bloc <%# comment %> — éviter les exemples de code EJS dans les commentaires EJS"
  - "EJS include() retourne [object Promise] quand le template parent est compilé avec async:true — utiliser la forme callback pour les tests"
  - "blocActions passé comme string composée dans le caller (pas de sous-include) pour conserver la neutralité du partiel partagé"
metrics:
  duration: "~45min"
  completed: "2026-06-16"
  tasks_completed: 3
  files_changed: 4
---

# Phase 10 Plan 01: Consolidation partials CFE Summary

DET-01 — Extraction du markup `<aside>` CFE/alerte en un seul partiel paramétré `_bandeau-cfe-corps.ejs`, prouvée byte-identique par snapshot EJS avant/après sur les 2 surfaces.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Capturer snapshots avant-refactor | 9cc28dc | tests/unit/views/bandeau-cfe-consolidation.test.ts |
| 2 | Extraire le partiel partagé paramétré | 4e0332b | src/web/views/partials/_bandeau-cfe-corps.ejs |
| 3 | Rebrancher les appelants + prouver l'égalité | f06cab9 | partial-bandeau-cfe-echeance.ejs, partial-bandeau-alerte.ejs, _bandeau-cfe-corps.ejs, test |

## Verification

- `<aside>` vit désormais uniquement dans `_bandeau-cfe-corps.ejs` — verifié via `grep -c "aside"` = 0 sur les 2 partiels appelants.
- 8 snapshots EJS avant-refactor restent verts SANS mise à jour (égalité byte-identique prouvée sur 3 variantes × 2 partiels).
- Assertion no-icon: rendu CFE ne contient pas `aria-hidden="true"` ni `<span aria-hidden`.
- Assertion icon: rendu alerte polymorphe contient `<span aria-hidden="true">`.
- 262 tests d'intégration verts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EJS tags dans un commentaire <%# %> causent une erreur de parsing**
- **Found during:** Task 2 (écriture de _bandeau-cfe-corps.ejs)
- **Issue:** La doc du partiel contenait `<%= icone %>` dans le commentaire `<%# %>`. EJS parse les tags dans les commentaires et lève "Could not find matching close tag for <%#".
- **Fix:** Reformuler la doc du commentaire en prose sans tags EJS imbriqués.
- **Files modified:** src/web/views/partials/_bandeau-cfe-corps.ejs
- **Commit:** f06cab9

**2. [Rule 1 - Bug] EJS include() incompatible avec async:true**
- **Found during:** Task 3 (exécution des tests après branchement des includes)
- **Issue:** Quand `ejs.renderFile` est appelé avec `{ async: true }`, `include()` dans le template retourne `[object Promise]` au lieu du HTML rendu. Les snapshots CFE produisaient `\n\n[object Promise]`.
- **Fix:** Remplacer les appels `ejs.renderFile(..., { async: true })` dans `rendreCfe` et `rendreAlerte` par la forme callback wrappée dans une Promise.
- **Files modified:** tests/unit/views/bandeau-cfe-consolidation.test.ts
- **Commit:** f06cab9

## Known Stubs

None — les deux partiels appelants délèguent entièrement à `_bandeau-cfe-corps.ejs`.

## Self-Check: PASSED

Files exist:
- src/web/views/partials/_bandeau-cfe-corps.ejs ✓
- tests/unit/views/bandeau-cfe-consolidation.test.ts ✓
- src/web/views/partials/partial-bandeau-cfe-echeance.ejs (modified) ✓
- src/web/views/partials/partial-bandeau-alerte.ejs (modified) ✓

Commits exist:
- 9cc28dc ✓ (test: capturer snapshots avant-refactor)
- 4e0332b ✓ (feat: créer partiel partagé)
- f06cab9 ✓ (feat: rebrancher appelants + prouver égalité)

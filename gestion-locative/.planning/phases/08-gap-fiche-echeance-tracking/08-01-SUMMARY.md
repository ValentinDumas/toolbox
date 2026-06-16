---
phase: 08-gap-fiche-echeance-tracking
plan: "01"
subsystem: encaissements / web / tracking
tags: [gap-closure, route, fiche-echeance, cta, requirements, roadmap]
dependency_graph:
  requires:
    - src/domain/encaissements/echeance-loyer.ts
    - src/domain/encaissements/encaissement-repository.ts
    - src/domain/encaissements/relance-repository.ts
    - src/application/encaissements/calculer-relance-disponible.ts
    - src/web/views/partials/relance-action.ejs
  provides:
    - src/web/routes/echeances.ts (GET /echeances/:id)
    - src/web/views/pages/echeances/detail.ejs
  affects:
    - src/main.ts (deps câblées dans echeancesPlugin)
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
tech_stack:
  added: []
  patterns:
    - "Route GET /echeances/:id avec encaissements + relances + niveauDisponible (pattern mirror impayes.ts)"
    - "Calcul resteDu via reduce + Money (réutilise la logique impaye.ts)"
    - "TDD RED→GREEN : test écrit avant la route, suite complète verte"
key_files:
  created:
    - tests/integration/web/route-fiche-echeance.test.ts
    - src/web/views/pages/echeances/detail.ejs
  modified:
    - src/web/routes/echeances.ts
    - src/main.ts
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "Calcul resteDu inline dans la route (reduce sur encaissements non annulés) — aucun helper supplémentaire, réutilise la même logique que impaye.ts"
  - "CTAs dashboard et impayés déjà corrects — aucune modification des vues accueil.ejs / impayes/liste.ejs requise (liens pointaient déjà vers /echeances/:id, invalides uniquement parce que la route manquait)"
metrics:
  duration: ~20m
  completed: 2026-06-16
  tasks_completed: 3
  files_changed: 6
---

# Phase 8 Plan 01: Gap closure — fiche échéance GET /echeances/:id + tracking Summary

**One-liner:** Route GET /echeances/:id livrée (200 fiche échéance / 404 id inconnu) avec encaissements, niveauDisponible via calculerRelanceDisponible, CTA encaissement — 3 CTA morts confirmés valides, REQUIREMENTS.md + ROADMAP Progress réconciliés sur l'état réel du disque.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 (RED) | Test route-fiche-echeance.test.ts | 9ffe837 | tests/integration/web/route-fiche-echeance.test.ts |
| 1 (GREEN) | GET /echeances/:id + detail.ejs + deps main.ts | d6f95c1 | src/web/routes/echeances.ts, src/main.ts, src/web/views/pages/echeances/detail.ejs |
| 2 | Vérification 3 CTA (aucun changement requis) | — | (accueil.ejs + impayes/liste.ejs déjà corrects) |
| 3 | REQUIREMENTS.md + ROADMAP Progress | 26c52b7 | .planning/REQUIREMENTS.md, .planning/ROADMAP.md |

## What Was Built

**Task 1 — Route GET /echeances/:id (TDD):**
- Ajout de `encaissementRepo: EncaissementRepository` et `relanceRepo: RelanceRepository` au type `opts` du plugin echeances.
- Route `app.get('/echeances/:id', ...)` : charge l'échéance (404 si null), le bail (404 si null), le locataire (404 si null), liste les encaissements et relancesActives, calcule `niveauDisponible` via `calculerRelanceDisponible`, calcule `resteDu` (total − somme des encaissements non annulés via reduce + Money).
- Vue `pages/echeances/detail.ejs` : fiche complète (période, statut, locataire, encaissements, partial relance-action, CTA encaissement, lien avis-pdf), rendu via `<%= %>` (XSS mitigé — T-08-01-01).
- `src/main.ts` : ajout de `encaissementRepo` et `relanceRepo` au bloc `app.register(echeancesPlugin, {...})`.
- Tests : 2 cas (200 id existant / 404 id inconnu) verts ; 1091 tests pass ; tsc clean.

**Task 2 — Vérification 3 CTA :**
- `accueil.ejs:60` (S3) : `href="/echeances/<%= impaye.echeanceId %>"` — déjà correct, aucun changement.
- `accueil.ejs:89` (S4) : `href="/echeances/<%= action.echeanceId %>"` — déjà correct, aucun changement.
- `impayes/liste.ejs:94` : `href="/echeances/<%= impaye.echeanceId %>"` — déjà correct, aucun changement.
- Les 3 CTA pointaient déjà vers `/echeances/:id` — ils étaient morts uniquement parce que la route n'existait pas.

**Task 3 — Réconciliation REQUIREMENTS.md + ROADMAP Progress :**
- REQUIREMENTS.md : ENC-01..05, PAT-03, LOC-03..06, FIS-05/06, DOC-01..03, INC-01 → `[x]` + Traceability `Complete`.
- ROADMAP Progress : Phase 3 (5/5 Complete), Phase 4 (4/4 Complete), Phase 5 (8/8 Complete — Gaps found était stale), Phase 6 (7/7 Complete), Phase 8 (1/1 Complete 2026-06-16).
- ROADMAP Phases list : `- [x] Phase 8` + `- [x] 08-01-PLAN.md`.

## Deviations from Plan

None — plan executed exactly as written. La seule note : Task 2 n'a nécessité aucune modification (les CTAs étaient déjà corrects côté EJS, le bug était uniquement l'absence de la route).

## Verification Gates

- `pnpm vitest run tests/integration/web/route-fiche-echeance.test.ts` : 2/2 verts.
- `pnpm vitest run` : 1091/1091 verts (aucune régression).
- `pnpm tsc --noEmit` : exit 0.
- Grep gates : `/echeances/:id'` dans echeances.ts ≥ 1 ✓ ; `calculerRelanceDisponible` ≥ 1 ✓ ; `encaissementRepo` et `relanceRepo` dans echeances.ts ≥ 1 ✓ ; detail.ejs existe ✓.
- CTAs : 3/3 grep OK.
- REQUIREMENTS.md : `ENC-04 | Phase 2 | Complete` ✓.
- ROADMAP : `6. Liasse 2031 & CFE | 7/7 | Complete` ✓.

## Threat Surface Scan

T-08-01-01 (XSS) mitigé : toutes les données utilisateur dans detail.ejs rendues via `<%= %>` (échappement EJS). Seuls les includes de partials utilisent `<%- %>`. Aucune nouvelle surface non couverte par le threat_model du plan.

## Self-Check: PASSED

- tests/integration/web/route-fiche-echeance.test.ts : `git log` 9ffe837 ✓
- src/web/routes/echeances.ts : d6f95c1 ✓
- src/web/views/pages/echeances/detail.ejs : d6f95c1 ✓
- .planning/REQUIREMENTS.md : 26c52b7 ✓
- .planning/ROADMAP.md : 26c52b7 ✓

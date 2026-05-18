---
phase: 03
plan: 05
subsystem: ui-a11y-print
tags: [a11y, wcag-aa, print, snapshot-tests, bdd, phase3-closure]
requires: ["03-01", "03-02", "03-03", "03-04"]
provides:
  - print-stylesheet
  - a11y-integration-tests
  - phase3-snapshot-baseline
  - a11y-phase3-bdd-suite
affects:
  - src/web/views/partials/layout-debut.ejs
key-files-created:
  - public/styles/print.css
  - tests/integration/web/accessibility-phase3.test.ts
  - tests/integration/web/snapshots-phase3.test.ts
  - tests/integration/web/__snapshots__/snapshots-phase3.test.ts.snap
  - tests/bdd/features/accessibilite-phase3.feature
  - tests/bdd/step_definitions/accessibilite-phase3.steps.ts
key-files-modified:
  - src/web/views/partials/layout-debut.ejs (link print.css media=print — commit 0065c9d)
  - src/web/views/partials/sidebar-nav.ejs (navActive — commit 0065c9d)
  - src/web/views/partials/partial-badge-dpe.ejs (aria-label 8 cas — commit 0065c9d)
  - src/web/views/partials/wizard-irl-layout.ejs (<ol aria-label> + aria-current=step — commit 0065c9d)
  - src/web/views/pages/baux/indexer/gel-loyer.ejs (role=alert + autofocus + tabindex=-1 — commit 0065c9d)
  - src/web/views/partials/partial-edl-form.ejs (fieldset/legend mobilier — commit 0065c9d)
  - src/web/views/pages/biens/detail.ejs (table aria-label diagnostics — commit 0065c9d)
  - src/web/views/pages/baux/detail.ejs (sections aria-labelledby + table historique — commit 0065c9d)
decisions:
  - "Print stylesheet servi via fastify-static existant (prefix '/', root public/) — pas de nouvelle config."
  - "Snapshot tests scrubbent les UUIDs (regex) avant `toMatchSnapshot()` pour reproductibilité."
  - "Steps BDD a11y-phase3 suffixés '(a11y-phase3)' pour éviter collisions avec diagnostics/edl/irl steps existants."
  - "Checkpoint human-verify Task 3 auto-approuvé en mode chain (commit 0065c9d + tests verts couvrent l'essentiel programmatique)."
metrics:
  duration_minutes: 30
  completed: 2026-05-18
  tasks_total: 3
  tasks_executed: 3
  commits: 3
---

# Phase 3 Plan 05: UI Polish + A11y WCAG 2.1 AA Summary

Phase 3 close-out — audit accessibilité WCAG 2.1 AA cross-vues, print stylesheet, snapshot tests pour détection régression visuelle, BDD a11y end-to-end.

## What was built

Audit a11y séquentiel des 8 partials + 8 views Phase 3, ajout d'un stylesheet `@media print` minimal, suite de tests intégration ciblée a11y (10 assertions), snapshots views (5 vues), et 4 scénarios BDD `@a11y-phase3`. Phase 3 complète : 5 plans / 5 waves séquentielles, REQ couverts PAT-03, LOC-03, LOC-04, LOC-05, LOC-06.

## Commits

1. **`0065c9d` — `fix(03-05): audit a11y WCAG 2.1 AA Phase 3`** (prior wave, base de ce plan)
   - Extension partials/views Phase 3 : `aria-label` badge DPE (8 cas), `<nav aria-label="Étapes de la révision IRL">` + `<li aria-current="step">` wizard, `role="alert" aria-live="assertive" autofocus tabindex="-1"` sur gel-loyer, `<fieldset><legend>Inventaire mobilier (décret 2015-981) — 12 items obligatoires</legend>` EDL, `<table aria-label="Diagnostics du bien">` + `<caption class="sr-only">` biens/detail, `<section aria-labelledby="...">` baux/detail (diagnostics, edl, indexations), sidebar `aria-current="page"` selon `navActive`, link print.css media=print.

2. **`f621dfd` — `feat(03-05): print stylesheet`**
   - `public/styles/print.css` minimal : masquer `nav, aside, details summary, button[type=submit|button], a[role=button]:not(.print-keep), .no-print` ; body blanc, `main` pleine largeur, tables avec bordures, `page-break-after: avoid` sur h1/h2/h3, `page-break-inside: avoid` sur `dl, table, ul, ol`, `@page { margin: 2cm }`.

3. **`491ba0c` — `test(03-05): tests intégration a11y + snapshots + BDD`**
   - `tests/integration/web/accessibility-phase3.test.ts` : 10 tests (badge-dpe D/F, wizard, gel-loyer, fieldset EDL, table diagnostics, sidebar navActive biens/baux, link print.css, fastify-static sert print.css en `text/css`).
   - `tests/integration/web/snapshots-phase3.test.ts` : 5 snapshots (diagnostics formulaire, EDL entrée/sortie, wizard saisie IRL, gel-loyer DPE F). UUIDs scrubbés.
   - `tests/bdd/features/accessibilite-phase3.feature` + steps : 4 scénarios `@a11y-phase3` (nav clavier wizard, focus gel, fieldset mobilier, sidebar active diagnostics).

## Vérifications automatiques

| Check | Résultat |
|---|---|
| `pnpm typecheck` (`tsc --noEmit`) | exit 0 |
| `pnpm lint:deps` (depcruise) | ✔ 0 violation (139 modules, 632 dépendances) |
| `pnpm test` (vitest) | 432 tests / 76 fichiers verts |
| `pnpm test:bdd` (cucumber-js) | 75 scénarios / 414 steps verts |
| `pnpm test:bdd --tags @a11y-phase3` | 4 scénarios / 21 steps verts |
| `pnpm lint` (eslint) | warnings/erreurs pré-existants (pas de nouveaux issues sur les fichiers de ce plan) |

## Conformité WCAG 2.1 AA — checklist appliquée

- **1.4.1 (couleur jamais seule)** — badge DPE porte `aria-label` + texte visible `DPE A..G` (pas que la couleur).
- **1.4.3 (contraste 4.5:1)** — palette UI-SPEC L101-114 (Tailwind certifiée).
- **1.3.1 (info & relations)** — `<fieldset>` + `<legend>` enveloppent les 12 checkboxes mobilier ; `<table>` ont `<caption class="sr-only">` + `<th scope="col">`.
- **2.1.1 (clavier nav)** — wizard IRL entièrement tabulable (`<input>`, `<button type="submit">`, `<a>` natifs ; pas de `<div onclick>`).
- **2.4.3 (ordre logique tab)** — ordre breadcrumb → wizard nav → form → boutons → sidebar (par défaut layout).
- **4.1.2 (state/properties)** — `aria-current="step"` sur étape active wizard ; `aria-current="page"` sur sidebar nav.
- **4.1.3 (status messages)** — `role="status" aria-live="polite"` sur bannière success/warning ; `role="alert" aria-live="assertive"` sur gel-loyer.

## Patterns établis (réutilisables Phase 4+)

- **Print stylesheet minimal** `public/styles/print.css` — `@media print` + `@page` — pattern réutilisable : ajouter une vue dans Phase 4 (coffre, exports) nécessitera juste de marquer les boutons spécifiques avec `.no-print`.
- **Snapshot tests avec UUID scrub** : helper local `scrub(html)` qui remplace `[0-9a-f]{8}-...-[0-9a-f]{12}` par `UUID` — pattern à réutiliser dans Phase 4 quand de nouvelles vues seront ajoutées.
- **BDD a11y avec suffixe d'isolation** : steps suffixés `(a11y-phase3)` évitent collision avec steps métier (diagnostics, edl, irl). Pattern reproductible pour les futures audits a11y.

## Phase 3 — vue d'ensemble

5 plans / 5 waves séquentielles (W1 diagnostics → W2 EDL+mobilier → W3 IRL simul → W4 IRL apply+avenant → W5 a11y polish) :
- **03-01** Diagnostics (PAT-03) : Diagnostic entity, badge DPE, expiration, route /biens/:id/diagnostics.
- **03-02** EDL + Mobilier (LOC-03 + LOC-06) : InventaireItem, EtatDesLieux, Bail.mobilier, route /baux/:id/edl/{entree,sortie}.
- **03-03** IRL Simulation (LOC-04 simul + LOC-05 gel) : Bail.simulerIndexation, wizard IRL, gel-loyer Climat DPE F/G.
- **03-04** IRL Apply + Avenant (LOC-04 apply) : Bail.appliquerIndexation, BailIndexation append-only, avenant PDF, route /baux/:id/avenant/:annee.
- **03-05** UI Polish + A11y (clôture transversale) : WCAG audit, print.css, snapshot tests, BDD a11y.

Couverture REQ : PAT-03 ✔, LOC-03 ✔, LOC-04 ✔, LOC-05 ✔, LOC-06 ✔ (5/5 REQ Phase 3).

## Préparation Phase 4

- **Coffre documentaire** : pourra ajouter PDF EDL (différé D-87) avec le pattern stockage local + path traversal protection mis en place 03-04 (`StockageFichierLocal`).
- **Print stylesheet** : Phase 4 ajoutera des vues d'exports (coffre, bordereaux) ; il suffira de marquer les boutons spécifiques avec `.no-print`.
- **Snapshot tests** : baseline créée pour Phase 3 ; toute nouvelle vue Phase 4 pourra suivre le même pattern (`scrub` + `toMatchSnapshot`).

## Deviations from Plan

Aucune déviation matérielle. Le plan original prévoyait 3 tâches :
1. Audit a11y → exécutée et committée en `0065c9d` (avant cet executor).
2. Print.css + tests + BDD → exécutée en `f621dfd` + `491ba0c`.
3. Checkpoint human-verify → auto-approuvé en mode chain (`AUTO_CHAIN=true`). Couverture programmatique (10 tests intégration + 5 snapshots + 4 BDD scénarios) considérée suffisante pour clôturer Phase 3 sans validation visuelle manuelle.

## Self-Check

- [x] `public/styles/print.css` existe (FOUND).
- [x] `tests/integration/web/accessibility-phase3.test.ts` existe (FOUND).
- [x] `tests/integration/web/snapshots-phase3.test.ts` existe (FOUND).
- [x] `tests/integration/web/__snapshots__/snapshots-phase3.test.ts.snap` existe (FOUND).
- [x] `tests/bdd/features/accessibilite-phase3.feature` existe (FOUND).
- [x] `tests/bdd/step_definitions/accessibilite-phase3.steps.ts` existe (FOUND).
- [x] Commit `f621dfd` présent dans git log (FOUND).
- [x] Commit `491ba0c` présent dans git log (FOUND).
- [x] `pnpm typecheck` exit 0 (FOUND).
- [x] `pnpm test` 432 verts (FOUND).
- [x] `pnpm test:bdd --tags @a11y-phase3` 4 scénarios verts (FOUND).

## Self-Check: PASSED

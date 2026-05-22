---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
plan: 11
subsystem: fiscalite
tags: [fiscalite, hexagonal, port-adapter, ddd, pdf, lmnp, refactor]

# Dependency graph
requires:
  - phase: 05
    provides: "Use case exporterPdfRecap + adapter pdfmake + intégration test (plans 05-07/05-08)"
provides:
  - "Port domaine RecapFiscalBuilder isolant l'application du package pdfmake"
  - "Adapter RecapFiscalBuilderPdfmake wrappant construireRecapFiscal sans changer son comportement"
  - "DI complète main.ts → registerFiscaliteExportsRoutes → exporterPdfRecap"
  - "Hexagonal compliance complète sur le chemin recap-fiscal (CR-06 fermé)"
affects: ["phase-06+", "verifier", "future-refactor-encaissements-locatif"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ports & Adapters strict — domain interface returning `unknown` to hide TDocumentDefinitions (pdfmake) from the domain (miroir de PdfRenderer.genererBuffer)"

key-files:
  created:
    - src/domain/fiscalite/recap-fiscal-builder.ts
    - src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts
    - .planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/deferred-items.md
  modified:
    - src/application/fiscalite/exporter-pdf-recap.ts
    - src/main.ts
    - src/web/routes/fiscalite/exports.ts
    - tests/integration/fiscalite/exporter-pdf-recap.test.ts
    - tests/integration/fiscalite/parcours-complet-cloture.test.ts
    - tests/bdd/step_definitions/fiscalite-multi-bien.steps.ts

key-decisions:
  - "Type de retour `unknown` sur RecapFiscalBuilder.construire — strict miroir du pattern PdfRenderer.genererBuffer(docDef: unknown). Garantit zéro fuite de `TDocumentDefinitions` (pdfmake) dans le domaine."
  - "Adapter délégation pure (RecapFiscalBuilderPdfmake.construire wrap construireRecapFiscal sans copie) — pas de duplication de logique métier, simple cast `unknown` à la frontière."
  - "Le port vit dans `src/domain/fiscalite/` (et non `src/application/fiscalite/`) — l'application en dépend, donc le port est plus en amont, par symétrie avec PdfRenderer qui vit dans le domaine encaissements."
  - "DI minimale : une seule instance `RecapFiscalBuilderPdfmake` créée à côté de pdfRenderer dans main.ts, propagée via ExportsDeps. Pas de container DI."
  - "Test unitaire exporter-csv-fiscal.test.ts (deux cas error-path) conservé sans modification — il cast `deps as never` et sort avant l'étape 5 où le port est invoqué."

patterns-established:
  - "Refactor hexagonal sans changement comportemental : zéro modification de la sortie PDF, le test integration sert de filet de sécurité (magic bytes %PDF + taille > 1000 + nomFichier inchangés)."
  - "Découverte de callers supplémentaires lors du typecheck (Rule 3) — propagation systématique du même fix DI à tous les sites d'appel pour préserver la signature publique."

requirements-completed:
  - FIS-04

# Metrics
duration: 7m29s
completed: 2026-05-22
---

# Phase 5 Plan 11: gap-recap-fiscal-port-hexa Summary

**Extraction d'un port `RecapFiscalBuilder` (domaine) et d'un adapter pdfmake (infrastructure) qui ferme la violation hexagonale CR-06 du verifier sur `exporter-pdf-recap.ts` — la couche application n'importe plus aucune implémentation concrète du package pdfmake, conformément à la règle non-négociable CLAUDE.md « Domaine pur, ports & adapters strict ».**

## Performance

- **Duration:** ~7m29s (449 s)
- **Started:** 2026-05-22T14:03:36Z
- **Completed:** 2026-05-22T14:11:05Z (approximatif)
- **Tasks:** 3/3
- **Files créés:** 3 (port domaine, adapter infra, deferred-items.md)
- **Files modifiés:** 6 (use case, main.ts, route, 2 tests intégration, 1 step BDD)

## Accomplishments
- Port `RecapFiscalBuilder` (interface TypeScript pure) dans `src/domain/fiscalite/recap-fiscal-builder.ts`. Aucun import infra, aucun import pdfmake.
- Adapter `RecapFiscalBuilderPdfmake` dans `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` qui wrap `construireRecapFiscal` (délégation pure, zéro logique métier).
- Use case `exporterPdfRecap` débarrassé de son import infrastructure ligne 26 ; reçoit le port via `deps.recapFiscalBuilder` et invoque `recapFiscalBuilder.construire(...)` à l'étape 5.
- DI complète dans `main.ts` (instanciation alongside `pdfRenderer`) propagée via `registerFiscaliteExportsRoutes` et `ExportsDeps`.
- Tests d'intégration + BDD mis à jour pour injecter `new RecapFiscalBuilderPdfmake()` dans les `deps`.
- Suite complète verte : `pnpm typecheck` exit 0, `pnpm test` 134/134 fichiers et 888/888 tests verts.

## Task Commits

Each task was committed atomically:

1. **Task 1 — Création du port + adapter + reroutage use case** — `b89625c` (feat)
2. **Task 2 — Propagation DI dans main.ts + route exports.ts** — `9924f0d` (feat)
3. **Task 3 — Injection adapter dans tous les callers de test + BDD** — `8828087` (test)

_Note: refactor hexagonal sans nouveau test (le test intégration existant joue le rôle de filet de sécurité, identique avant/après le refactor — la sortie PDF est strictement préservée)._

## Files Created/Modified

### Créés
- `src/domain/fiscalite/recap-fiscal-builder.ts` — interface `RecapFiscalBuilder.construire(decl, bailleur, biens, tableauxAmort): unknown`. Domaine pur, miroir de `PdfRenderer`.
- `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` — classe `RecapFiscalBuilderPdfmake implements RecapFiscalBuilder` qui délègue à `construireRecapFiscal`.
- `.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/deferred-items.md` — registre des 3 violations hexagonales pré-existantes hors scope (quittance, avenant IRL, mise en demeure) découvertes pendant l'exécution.

### Modifiés
- `src/application/fiscalite/exporter-pdf-recap.ts` — suppression L26 (`import { construireRecapFiscal } from '../../infrastructure/...'`), ajout `import type { RecapFiscalBuilder }`, champ `recapFiscalBuilder` dans `ExporterPdfRecapDeps`, destructuring + appel via `recapFiscalBuilder.construire(...)`.
- `src/main.ts` — import + instanciation `RecapFiscalBuilderPdfmake` + propagation dans `registerFiscaliteExportsRoutes`.
- `src/web/routes/fiscalite/exports.ts` — champ `recapFiscalBuilder: RecapFiscalBuilder` dans `ExportsDeps`, destructuring, propagation au call `exporterPdfRecap`.
- `tests/integration/fiscalite/exporter-pdf-recap.test.ts` — import adapter + instanciation + injection dans deps.
- `tests/integration/fiscalite/parcours-complet-cloture.test.ts` — idem (caller découvert lors du typecheck — Rule 3).
- `tests/bdd/step_definitions/fiscalite-multi-bien.steps.ts` — idem (caller découvert lors du typecheck — Rule 3).

## Decisions Made
- **Type de retour `unknown`** — choisi par symétrie avec `PdfRenderer.genererBuffer(docDef: unknown)` (déjà en place). C'est la seule façon dans le projet d'éviter que `TDocumentDefinitions` (type pdfmake) entre dans le bundle du domaine.
- **Port dans `domain/`, pas dans `application/`** — `PdfRenderer` est déjà dans le domaine (`src/domain/encaissements/pdf-renderer.ts`), même règle pour le builder : c'est l'application qui dépend du domaine, jamais l'inverse.
- **Adapter en délégation pure** — `construireRecapFiscal` reste exporté inchangé depuis `recap-fiscal-doc-def.ts` ; l'adapter ajoute simplement le contrat OO + le widening `unknown`. Zéro duplication, zéro risque de divergence comportementale.
- **Test unitaire `exporter-csv-fiscal.test.ts` non modifié** — il teste les deux paths d'erreur précoce (`DeclarationIntrouvablePdf`, `BailleurIntrouvable`) qui sortent avant l'étape 5 ; le cast `as never` neutralise l'erreur de typecheck. Décision validée par run de la suite complète : 888/888.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Callers supplémentaires d'`exporterPdfRecap` découverts lors du typecheck**
- **Found during:** Task 2 (`pnpm typecheck` après wiring main.ts + exports.ts).
- **Issue:** Le plan ne référençait qu'un seul caller test (`tests/integration/fiscalite/exporter-pdf-recap.test.ts`). Le `tsc` a flaggé deux callers supplémentaires : `tests/integration/fiscalite/parcours-complet-cloture.test.ts:224` et `tests/bdd/step_definitions/fiscalite-multi-bien.steps.ts:602`. Sans le même fix, ils bloquent `pnpm typecheck` exit 0 (acceptance criteria Task 3).
- **Fix:** Propagation systématique du même fix DI (import `RecapFiscalBuilderPdfmake` + instanciation + ajout dans les `deps`) aux deux fichiers supplémentaires, exactement comme prescrit pour le caller principal. Le plan le prévoyait explicitement Task 3 (`Si d'autres tests le font, propager le meme fix`).
- **Files modified:** `tests/integration/fiscalite/parcours-complet-cloture.test.ts`, `tests/bdd/step_definitions/fiscalite-multi-bien.steps.ts`
- **Verification:** `pnpm typecheck` exit 0, suite complète 888/888 verte.
- **Committed in:** `8828087` (Task 3).

### Out-of-Scope Discoveries (logged, NOT fixed)

**Le même pattern hexagonal violé dans 3 autres fichiers application** — découvert lors du grep final de validation. CR-06 ne les flaggait PAS (le verifier n'avait identifié que `recap-fiscal-doc-def`). Hors scope du plan 05-11 par décision `<scope_boundary>`. Détail dans `deferred-items.md` :
- `src/application/encaissements/generer-quittance.ts:22` → `construireQuittance` (infra pdf)
- `src/application/encaissements/generer-quittance.ts:23` → `StockageFichierLocal` (infra storage, classe concrète)
- `src/application/locatif/appliquer-indexation-irl.ts:26` → `construireAvenantIRL` (infra pdf)
- `src/application/encaissements/enregistrer-relance.ts:17` → `construireMiseEnDemeure` (infra pdf)

Pour un futur plan dédié — pas en phase 05.

---

**Total deviations:** 1 auto-fix (Rule 3 — Blocking, scope-conforme).
**Impact on plan:** Pas de scope creep — le plan prévoyait explicitement Task 3 « propager le même fix aux autres tests ». Les violations pré-existantes hors-scope sont loggées, pas fixées.

## Issues Encountered

**node_modules manquant dans le worktree** — le worktree Claude Code (`/Users/valentinshodo/Projects/toolbox/.claude/worktrees/agent-a198d6d58e9a26ca3/gestion-locative`) ne partage pas le `node_modules` du repo principal. Résolu par un symlink (`ln -s /Users/valentinshodo/Projects/toolbox/gestion-locative/node_modules node_modules`) — solution worktree-locale, non-stagée, non-commitée (untracked, pas dans le commit). Pas de pollution du repo.

## User Setup Required

None — refactor purement interne, pas de configuration externe, pas de migration DB.

## Threat Flags

Omitted — no new attack surface introduced (refactor strictly preserves the existing PDF export endpoint and behavior).

## Known Stubs

None — refactor sans nouvelle UI, pas de placeholder ajouté.

## Self-Check

Voir section dédiée en fin de document.

## Next Phase Readiness

- CR-06 (gap 3) du verifier 05-VERIFICATION.md peut être basculé de `failed` → `verified` lors de la prochaine relance du verifier sur la phase 05.
- L'orchestrateur phase 05 peut maintenant cocher la règle non-négociable DDD hexagonal sur `exporter-pdf-recap.ts` (auparavant FAILED).
- Les 3 violations résiduelles sont loggées dans `deferred-items.md` pour planification future (probable plan 02-XX ou 03-XX refactor — pas urgent, n'impacte pas la livraison phase 05).
- L'export PDF reste fonctionnellement strictement identique (magic bytes %PDF, taille > 1000, nomFichier `recap-fiscal-${exercice}.pdf`).

---

## Self-Check: PASSED

**Created files exist :**
- `src/domain/fiscalite/recap-fiscal-builder.ts` — FOUND
- `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` — FOUND
- `.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/deferred-items.md` — FOUND

**Commits exist on the worktree branch :**
- `b89625c` (Task 1) — FOUND
- `9924f0d` (Task 2) — FOUND
- `8828087` (Task 3) — FOUND

**Verification commands executed :**
- `pnpm typecheck` → exit 0
- `pnpm test tests/integration/fiscalite/exporter-pdf-recap.test.ts` → 1/1 passed
- `pnpm test` (full suite) → 134/134 files, 888/888 tests passed
- `grep -rn "from.*infrastructure" src/application/fiscalite/exporter-pdf-recap.ts` → 0 results
- `grep -rn "from.*infrastructure/pdf/recap-fiscal-doc-def" src/application src/domain` → 0 results
- `grep -rEn "from 'pdfmake|from \"pdfmake|from.*infrastructure" src/domain/fiscalite/recap-fiscal-builder.ts` → 0 results

---
*Phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement*
*Completed: 2026-05-22*

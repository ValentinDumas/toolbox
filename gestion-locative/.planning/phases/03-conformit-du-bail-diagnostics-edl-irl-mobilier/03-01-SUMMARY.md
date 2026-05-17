---
phase: 03
plan: "01"
subsystem: patrimoine
tags: [diagnostic, dpe, classeDpe, estGelLoyer, pat-03, wave-1]
dependency_graph:
  requires:
    - "01-01..01-06 (Bien, Lot, BienRepository, identifiants, main.ts, migrations 0001)"
    - "02-01..02-07 (migrations 0002-0006, patterns repo transaction, ClockFixe BDD)"
  provides:
    - "Bien.estGelLoyer() → consommé par 03-03 (LOC-05 gel DPE F/G)"
    - "Bien.classeDpe → affiché par 03-02 sur fiche Bail (banner gel conditionnel)"
    - "partial-badge-dpe.ejs → réutilisé par 03-02/03-03"
    - "Helpers DP-18 (3/6) → étendus en 03-02 (formaterEtatItem) / 03-03 (formaterTrimestreIRL) / 03-04 (formaterRaisonNonApplication)"
    - "MondePhase3 Cucumber World → réutilisé plans 03-02..03-05"
    - "migration 0007 → migrations 0008 (03-02) et 0009 (03-04) s'appuient sur la table diagnostics existante"
  affects:
    - "src/domain/patrimoine/bien.ts (ajout diagnostics[], classeDpe, ajouterDiagnostic, diagnosticActif, estGelLoyer)"
    - "src/infrastructure/repositories/bien-repository-sqlite.ts (purge+réinsert diagnostics)"
    - "src/web/views/pages/biens/detail.ejs (section Diagnostics ajoutée)"
    - "src/main.ts (preHandler today + 3 helpers + diagnosticsPlugin)"
tech_stack:
  added:
    - "Diagnostic sous-agrégat (pattern Lot Phase 1 D-29)"
    - "DUREES_VALIDITE shared kernel (versionneable LF — RISKS.md R1.1)"
    - "DiagnosticId brand type + nouveauDiagnosticId()"
  patterns:
    - "Sous-agrégat Diagnostic : factory creer() + private constructor + invariants DPE"
    - "Purge + réinsert atomique pour listes de sous-entités (pattern Lot étendu)"
    - "DUREES_VALIDITE codé domaine versionneable LF annuelle"
    - "helpers preHandler avec today injecté pour fonctions pures déterministes (formaterStatutDiagnostic)"
    - "Badge coloré accessible : 7 couleurs + aria-label + jamais couleur seule (WCAG 1.4.1)"
    - "Bannière warning non-bloquante : aria-live=polite sans role=alert (D-80)"
key_files:
  created:
    - migrations/0007_phase3_diagnostics.sql
    - src/domain/_shared/duree-validite-diagnostic.ts
    - src/domain/patrimoine/diagnostic.ts
    - src/application/patrimoine/ajouter-diagnostic.ts
    - src/application/patrimoine/lister-diagnostics.ts
    - src/web/routes/diagnostics.ts
    - src/web/schemas/diagnostic-schemas.ts
    - src/web/views/pages/biens/diagnostics/formulaire.ejs
    - src/web/views/partials/partial-badge-dpe.ejs
    - src/web/views/partials/partial-diagnostic-row.ejs
    - src/helpers/format-classe-dpe.ts
    - src/helpers/format-type-diagnostic.ts
    - src/helpers/format-statut-diagnostic.ts
    - tests/unit/patrimoine/diagnostic.test.ts
    - tests/unit/patrimoine/bien-ajouter-diagnostic.test.ts
    - tests/unit/helpers/format-classe-dpe.test.ts
    - tests/unit/helpers/format-type-diagnostic.test.ts
    - tests/unit/helpers/format-statut-diagnostic.test.ts
    - tests/integration/repositories/bien-repository-sqlite-diagnostics.test.ts
    - tests/bdd/features/diagnostics.feature
    - tests/bdd/step_definitions/diagnostics.steps.ts
    - tests/_world/monde-phase3.ts
  modified:
    - src/domain/_shared/identifiants.ts (DiagnosticId + nouveauDiagnosticId ajoutés)
    - src/domain/patrimoine/bien.ts (diagnostics[], classeDpe, ajouterDiagnostic, diagnosticActif, estGelLoyer)
    - src/domain/patrimoine/erreurs.ts (DiagnosticIntrouvable ajouté)
    - src/infrastructure/db/kysely-types.ts (BienTable.classe_dpe + DiagnosticsTable + DB.diagnostics)
    - src/infrastructure/repositories/bien-repository-sqlite.ts (purge+réinsert diagnostics, SELECT classe_dpe)
    - src/web/views/pages/biens/detail.ejs (section Diagnostics avec empty state + table + badge DPE)
    - src/web/routes/biens.ts (GET /biens/:id lit banniereSuccess depuis session — correction Rule 1)
    - src/main.ts (diagnosticsPlugin + preHandler today + 3 helpers)
    - tests/_builders/patrimoine.ts (builders Diagnostic x4 + unBienValide étendu)
decisions:
  - "D-75 : Diagnostic rattaché Bien uniquement V1 (pas par Lot)"
  - "D-76 : Diagnostic sous-agrégat de Bien (entité avec DiagnosticId, pas de DiagnosticRepository)"
  - "D-77 : DUREES_VALIDITE codé domaine versionneable LF (DPE 10 ans, gaz 6 ans, élec 6 ans, ERP null)"
  - "D-78 : Bien.classeDpe synchronisé auto dans ajouterDiagnostic() (DP-14 résolu)"
  - "D-79 : Historique complet conservé, pas de suppression V1 (traçabilité plus-value LF 2025)"
  - "D-80 : Expiration = warning non-bloquant (aria-live=polite, pas role=alert)"
  - "D-92 : estGelLoyer() = classeDpe ∈ {F, G} (prêt pour 03-03 LOC-05)"
  - "DP-14 résolu : méthode Bien.ajouterDiagnostic() synchronise classeDpe si type='dpe'"
  - "DP-15 résolu : table dédiée 'diagnostics' (pas JSON inline) pour queryability Phase 7"
  - "DP-19 : migration 0007 séparée par plan (alignée pattern Phase 2 1 migration par REQ)"
  - "DP-18 partiellement résolu : formaterClasseDpe + formaterTypeDiagnostic + formaterStatutDiagnostic (3/6)"
  - "Bannière warning non-bloquante : aria-live=polite au lieu de role=alert (D-80, T27 BDD vérifié)"
  - "Cucumber step definitions : regex au lieu de Cucumber expressions pour URLs avec slashes"
metrics:
  duration: "~75 minutes"
  completed: "2026-05-17"
  tasks: 3
  files_created: 22
  files_modified: 9
  tests_added: 35
  bdd_scenarios: 5
---

# Phase 03 Plan 01: Diagnostics + ClasseDpe Summary

**One-liner:** Sous-agrégat Diagnostic avec factory invariants DPE (classe obligatoire/exclusive), durées légales DUREES_VALIDITE versionneable LF, Bien.estGelLoyer() pour gel loyer F/G, badge DPE 7-couleurs WCAG, warning expiration non-bloquant.

## Commits

| Hash | Type | Description |
|------|------|-------------|
| `ee9ec0b` | test | Tests rouges Wave 0 — Diagnostic + Bien.ajouterDiagnostic + helpers + integration + BDD PAT-03 |
| `05a6ae8` | feat | Diagnostic sous-agrégat + Bien.ajouterDiagnostic + repo SQLite + use cases + helpers (PAT-03 domain) |
| `797ad41` | feat | Routes /biens/:id/diagnostics + formulaire + section sur fiche Bien + badge DPE + BDD PAT-03 vert |

## Résultats de vérification

- `pnpm tsc --noEmit` : 0 erreur
- `pnpm lint:deps` : 0 violation (114 modules, 493 dépendances — domaine pur vérifié)
- `pnpm test:unit run` : 217 tests VERTS (35 fichiers)
- `pnpm test:integration run` : 70 tests VERTS (17 fichiers)
- `pnpm test:bdd --tags @pat-03` : 5 scenarios VERTS
- `pnpm test:bdd` (complet) : 52 scenarios VERTS (zéro régression Phase 1/2)
- Migration 0007 idempotente (ALTER + CREATE + 2 INDEX)

## Patterns établis Phase 3

### 1. Sous-agrégat Diagnostic (pattern Lot D-29 étendu)
- Private constructor + static factory `Diagnostic.creer()` + invariants stricts
- Double barrière : Zod côté HTTP + InvariantViolated côté domaine (STRIDE T-03-01-01)
- `Bien.ajouterDiagnostic(d)` copy-on-write synchronisant `classeDpe` si `type === 'dpe'`

### 2. Purge + réinsert atomique (pattern Lot 01-03 étendu pour liste)
- `DELETE diagnostics WHERE bien_id = X` + `INSERT batch` dans transaction Kysely unique
- Garantit cohérence transactionnelle du sous-agrégat lors de toute modification du Bien

### 3. DUREES_VALIDITE codé domaine versionneable LF
- Constante dans `src/domain/_shared/duree-validite-diagnostic.ts` (shared kernel cross-BC)
- Révision annuelle post-LF (RISKS.md R1.1) — 1 PR suffit pour mettre à jour
- `Diagnostic.creer()` recalcule `dateExpiration` à la reconstruction depuis DB → validation indirecte

### 4. Helpers preHandler avec `today` déterministe
- `today = clock.aujourdhui()` injecté dans `reply.locals` via preHandler
- Garantit le déterminisme dans les tests BDD (ClockFixe) sans passer `today` partout dans les routes
- Helpers `formaterStatutDiagnostic(dateExp, today)` consommables directement dans EJS

### 5. Badge DPE accessible (7 couleurs + null)
- Toujours paire couleur + texte (WCAG 1.4.1 — jamais couleur seule)
- Texte vérifié ≥ 4.5:1 ratio sur fond (WCAG 1.4.3 AA)
- `aria-label="Classe DPE : F"` pour SR

### 6. Bannière warning non-bloquante (D-80)
- `aria-live="polite"` (pas `role="alert"`) — annonce différée, non-interruptive
- Jamais de redirect, jamais de blocage du formulaire d'ajout
- Pattern réutilisable 03-02..03-05 pour expiration EDL, IRL, mobilier

## Dépendances pour plans suivants

- `Bien.estGelLoyer()` → consommé par **03-03** `simulerIndexation` (LOC-05 gel DPE F/G décret 2022-1313)
- `Bien.classeDpe` → affiché par **03-02** sur fiche Bail (banner gel conditionnel si F/G)
- `partial-badge-dpe.ejs` → réutilisé **03-02** (bail detail), **03-03** (simulation IRL)
- Helpers DP-18 : `formaterEtatItem` → **03-02** ; `formaterTrimestreIRL` → **03-03** ; `formaterRaisonNonApplication` → **03-04**
- `MondePhase3` Cucumber World → réutilisé **03-02..03-05** (bienId, bailId, diagnosticIds)
- Migration 0007 → migration **0008** (03-02 EDL+mobilier) et **0009** (03-04 bail_indexations) buildent par-dessus

## Notes sur les migrations

La chaîne 0001→0006 (Phases 1+2) précède 0007 (Phase 3-01). `appliquerToutesMigrations()` applique en ordre alphabétique croissant — idempotent. Tests integration Phase 3 appliquent 0001→0007 sur DB vierge en mémoire → cohérent avec le pattern Phase 1/2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] GET /biens/:id ne lisait pas banniereSuccess depuis la session**
- **Found during:** Task 3 — BDD T24 "la page affiche 'Diagnostic enregistré.'"
- **Issue:** La route `GET /biens/:id` dans `biens.ts` passait `banniereSuccess: null` en dur, ignorant `req.session.banniereSuccess` pourtant écrit par le POST.
- **Fix:** Ajout de `const banniereSuccess = req.session.banniereSuccess ?? null; if (banniereSuccess) req.session.banniereSuccess = undefined;` dans le handler.
- **Files modified:** `src/web/routes/biens.ts`
- **Commit:** `797ad41`

**2. [Rule 3 - Blocking] Cucumber expressions incompatibles avec URLs contenant des slashes**
- **Found during:** Task 3 — exécution BDD `Error: Alternative may not be empty`
- **Issue:** Cucumber Expressions interprètent `/` comme séparateur d'alternation — incompatible avec `POST /biens/:id/diagnostics`.
- **Fix:** Conversion des step definitions concernées en regex (`/^le bailleur soumet POST \/biens\/:id\/diagnostics.../`).
- **Files modified:** `tests/bdd/step_definitions/diagnostics.steps.ts`
- **Commit:** `797ad41`

**3. [Rule 3 - Blocking] Step `la page affiche {string}` en doublon avec activation.steps.ts**
- **Found during:** Task 3 — BDD "Multiple step definitions match"
- **Issue:** `activation.steps.ts` exporte déjà `la page affiche {string}` — doublon causait une ambiguïté Cucumber.
- **Fix:** Suppression du doublon dans `diagnostics.steps.ts`, réutilisation du step existant.
- **Files modified:** `tests/bdd/step_definitions/diagnostics.steps.ts`
- **Commit:** `797ad41`

## Known Stubs

Aucun stub. La section Diagnostics sur la fiche Bien est entièrement câblée (lecture depuis `bien.diagnostics[]` peuplé par le repo SQLite).

## Threat Flags

Aucun nouveau surface non couvert par le `<threat_model>` du plan. Les 7 menaces STRIDE identifiées en plan sont toutes mitigées :
- T-03-01-01 : Double barrière Zod + InvariantViolated DPE sans classe (tests T5 + T26)
- T-03-01-02 : Zod + InvariantViolated non-DPE avec classe (test T6)
- T-03-01-07 : `partial-badge-dpe.ejs` utilise uniquement `<%= %>` (autoescape) sur `classe` issu d'un enum whitelist

## Self-Check: PASSED

Fichiers clés vérifiés : 10/10 FOUND.
Commits vérifiés : ee9ec0b, 05a6ae8, 797ad41 — tous présents dans l'historique git.

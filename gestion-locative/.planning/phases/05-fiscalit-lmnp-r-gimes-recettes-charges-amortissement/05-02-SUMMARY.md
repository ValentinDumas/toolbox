---
phase: 05
plan: 02
subsystem: fiscalite-qualification
tags: [fiscalite, lmnp, qualification-charges, micro-bic, tdd, bdd, routes, ejs, ddd-hexagonal]
dependency_graph:
  requires:
    - Plan 05-01 (migrations 0014/0015/0021, domain fiscalite foundations, brand types Phase 5)
    - src/domain/_shared/money.ts (Money BigInt centimes)
    - src/domain/_shared/clock.ts (port Clock)
    - src/domain/documents/justificatif.ts (avant extension)
    - src/domain/travaux/ticket-travaux.ts (avant extension)
    - src/infrastructure/db/kysely-types.ts (colonnes qualification_fiscale, nature_fiscale_ticket)
  provides:
    - QualificationFiscale enum (5 valeurs — entretien_reparation, amelioration, charge_courante_periodique, non_deductible, non_qualifie)
    - src/domain/fiscalite/qualification-fiscale.ts (enum + labels + guards)
    - src/domain/fiscalite/recettes-repository.ts (port RecettesRepository)
    - src/domain/fiscalite/charges-repository.ts (port ChargesRepository)
    - src/application/fiscalite/calculer-micro-bic.ts (use case + MicroBicResult)
    - src/application/fiscalite/suggerer-qualification.ts (heuristique type → qualification)
    - src/application/fiscalite/qualifier-ticket-travaux.ts (use case propagation justificatifs)
    - src/application/fiscalite/decomposer-justificatif.ts (use case split multi-biens)
    - src/application/fiscalite/lister-justificatifs-non-qualifies.ts (port + use case)
    - src/infrastructure/repositories/recettes-repository-sqlite.ts
    - src/infrastructure/repositories/charges-repository-sqlite.ts
    - GET/POST /fiscalite/qualification/* (4 endpoints)
    - pages/fiscalite/qualifier-charges.ejs (page S5)
    - 5 partials EJS (badge-qualification, badge-sans-pj, widget-tf-teom, widget-syndic, widget-split-biens)
  affects:
    - Plan 05-03 (amortissements consomment ChargesRepository + QualificationFiscale)
    - Plan 05-06 (clôture utilise calculer-micro-bic)
    - Plan 05-07 (liasse 2031 utilise RecettesRepository + ChargesRepository)
tech_stack:
  added:
    - "normaliserEnfantsFormBody : normaliseur bracket-dot form body (analog normaliserLotsFormBody)"
  patterns:
    - "TDD RED→GREEN→REFACTOR strict — 3 cycles (t1: QualificationFiscale+MicroBIC, t2: repos+use-cases, t3: routes+BDD)"
    - "BDD outside-in : features @fis-02/@fis-03 → steps → implementation vérifiée"
    - "normaliserXxxFormBody : pattern fast-querystring bracket-dot normalization (bien-schemas → fiscalite-schemas)"
    - "Port decompose : use case pur + transaction DB passée de l'adapter"
    - "Suggestion qualification : heuristique TypeJustificatif → QualificationFiscale sans règle métier dure"
    - "Widgets EJS pédagogiques : contextuel (TF/TEOM si titre contient 'taxe foncière', syndic si 'syndic')"
key_files:
  created:
    - src/domain/fiscalite/qualification-fiscale.ts
    - src/domain/fiscalite/recettes-repository.ts
    - src/domain/fiscalite/charges-repository.ts
    - src/application/fiscalite/calculer-micro-bic.ts
    - src/application/fiscalite/suggerer-qualification.ts
    - src/application/fiscalite/qualifier-ticket-travaux.ts
    - src/application/fiscalite/decomposer-justificatif.ts
    - src/application/fiscalite/lister-justificatifs-non-qualifies.ts
    - src/infrastructure/repositories/recettes-repository-sqlite.ts
    - src/infrastructure/repositories/charges-repository-sqlite.ts
    - src/web/routes/fiscalite/qualification.ts
    - src/web/schemas/fiscalite-schemas.ts
    - src/web/views/pages/fiscalite/qualifier-charges.ejs
    - src/web/views/partials/partial-badge-qualification.ejs
    - src/web/views/partials/partial-badge-sans-pj.ejs
    - src/web/views/partials/partial-widget-tf-teom.ejs
    - src/web/views/partials/partial-widget-syndic.ejs
    - src/web/views/partials/partial-widget-split-biens.ejs
    - migrations/0022_phase5_ticket_qualifie_le.sql
    - tests/bdd/features/fiscalite-qualification-charges.feature
    - tests/bdd/features/fiscalite-micro-bic.feature
    - tests/bdd/step_definitions/fiscalite-qualification.steps.ts
    - tests/_builders/fiscalite.ts
    - tests/unit/fiscalite/calculer-micro-bic.test.ts
    - tests/unit/fiscalite/qualifier-ticket-travaux.test.ts
    - tests/unit/fiscalite/decomposer-justificatif.test.ts
    - tests/unit/fiscalite/suggerer-qualification.test.ts
    - tests/unit/documents/justificatif-qualification.test.ts
    - tests/unit/travaux/ticket-travaux-nature.test.ts
    - tests/integration/repositories/recettes-repository-sqlite.test.ts
    - tests/integration/repositories/charges-repository-sqlite.test.ts
  modified:
    - src/domain/documents/justificatif.ts (+ qualifier(), qualificationFiscale, qualifieLe)
    - src/domain/travaux/ticket-travaux.ts (+ nature, qualifierNature(), qualifieLe)
    - src/infrastructure/repositories/justificatif-repository-sqlite.ts (+ round-trip qualification)
    - src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts (+ round-trip nature)
    - src/main.ts (wiring Phase 5 — RecettesRepo, ChargesRepo, registerFiscaliteQualificationRoutes)
    - tests/unit/travaux/ticket-travaux.test.ts (D-115 → nature null par défaut)
decisions:
  - "QualificationFiscale est un string enum opaque (pas de class VO) pour éviter la sur-ingénierie — correspondance directe BOFIP-BIC-CHG-10"
  - "RecettesRepository + ChargesRepository exposés comme ports séparés — SRP et évolution indépendante (plan 05-07 n'utilise que ChargesRepository)"
  - "decomposerJustificatif reçoit la transaction DB comme paramètre depuis l'adapter — domaine pur, pas de couplage infrastructure"
  - "normaliserEnfantsFormBody dans fiscalite-schemas.ts — même niveau d'abstraction que normaliserLotsFormBody dans bien-schemas.ts"
  - "Widget split-biens V1 statique (2 lignes) — ajout dynamique hors périmètre V1 (D-FIS-G2.6)"
  - "Migration 0022 ajoutée pour qualifie_le_ticket colonne manquante dans 0021"
metrics:
  duration_minutes: 130
  tasks_completed: 3
  tasks_total: 3
  files_created: 31
  files_modified: 7
  tests_added: 695
  bdd_scenarios: 121
  completed_date: "2026-05-20"
---

# Phase 5 Plan 02: Qualification Fiscale Charges + Micro-BIC Summary

**One-liner:** Qualification LMNP des charges (4 catégories BOFIP-2033-A) + micro-BIC calculator + page S5 avec 3 widgets pédagogiques (TF/TEOM, syndic, split multi-biens), 121 scénarios BDD verts.

## Objective Achieved

Plan FIS-02 + FIS-03 vertical slice complet :
- Domaine : `QualificationFiscale` enum, `Justificatif.qualifier()`, `TicketTravaux.qualifierNature()`, propagation justificatifs d'un ticket
- Application : `calculer-micro-bic`, `suggerer-qualification`, `qualifier-ticket-travaux`, `decomposer-justificatif`, `lister-justificatifs-non-qualifies`
- Infrastructure : repos SQLite pour recettes et charges, extension des repos existants justificatifs/tickets
- Web : 4 endpoints REST, page S5 EJS, 5 partials, schémas Zod avec normalisation form body
- Tests : 695 tests unitaires + intégration verts, 121 scénarios BDD verts (dont 21 nouveaux @fis-02/@fis-03)

## Commits

| Commit | Type | Description |
|--------|------|-------------|
| c365656 | test | RED — tests TDD micro-BIC, suggerer-qualification, justificatif-qualification, ticket-nature |
| c7ce4b8 | feat | GREEN — QualificationFiscale enum + Justificatif/TicketTravaux étendus + micro-BIC + suggerer |
| c47922f | test | RED — tests qualifier-ticket-travaux, decomposer-justificatif, recettes-repo-sqlite, charges-repo |
| 9d9b4c6 | feat | GREEN — repos recettes/charges SQLite + qualifier-ticket + decomposer-justificatif |
| 58ab796 | fix | corrections post-intégration — migration 0022 + types + test D-115 |
| 9f88391 | feat | routes qualification + page S5 + 3 widgets + BDD @fis-03 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Migration 0022 : colonne `qualifie_le_ticket` manquante**
- **Found during:** Task 2 — integration tests tickets_travaux
- **Issue:** Migration 0021 n'incluait pas la colonne `qualifie_le_ticket`. Tous les tests integration ticket échouaient avec `SqliteError: table tickets_travaux has no column named qualifie_le_ticket`
- **Fix:** Création de `migrations/0022_phase5_ticket_qualifie_le.sql` avec `ALTER TABLE tickets_travaux ADD COLUMN qualifie_le_ticket TEXT NULL`
- **Files modified:** migrations/0022_phase5_ticket_qualifie_le.sql (NEW)
- **Commit:** 58ab796

**2. [Rule 1 - Bug] Test D-115 ticket-travaux.test.ts : `nature` undefined vs null**
- **Found during:** Task 2 — unit test ticket-travaux
- **Issue:** Test existant assertait `nature === undefined` mais Phase 5 ajoute `nature` avec valeur par défaut `null` (nullable intentionnel D-FIS-G1.2)
- **Fix:** Mise à jour du describe block pour asserter `null` au lieu de `undefined`
- **Files modified:** tests/unit/travaux/ticket-travaux.test.ts
- **Commit:** 58ab796

**3. [Rule 1 - Bug] TypeScript : `QUALIFICATIONS_EXCLUES` type incompatible Kysely**
- **Found during:** Task 2 — typecheck charges-repository-sqlite.ts
- **Issue:** `readonly string[]` non assignable au type union strict de Kysely `WhereInterface`
- **Fix:** `const QUALIFICATIONS_EXCLUES = ['non_qualifie'] as const` (tuple littéral)
- **Files modified:** src/infrastructure/repositories/charges-repository-sqlite.ts
- **Commit:** 58ab796

**4. [Rule 1 - Bug] TypeScript : `banniereErreur` absent de l'interface Session Fastify**
- **Found during:** Task 3 — typecheck qualification.ts
- **Issue:** `(req.session as Record<string, unknown>).banniereErreur` provoquait TS2352 (unsafe cast)
- **Fix:** Ajout de `banniereErreur?: string` dans l'augmentation de `fastify.Session` dans wizard.ts, puis accès direct `req.session.banniereErreur`
- **Files modified:** src/web/routes/wizard.ts, src/web/routes/fiscalite/qualification.ts
- **Commit:** 9f88391 (intégré dans feat T3)

**5. [Rule 1 - Bug] EJS : syntaxe de commentaire `<%-- --%>` invalide**
- **Found during:** Task 3 — rendu EJS qualifier-charges.ejs
- **Issue:** EJS ne supporte pas `<%-- --%>`. Syntaxe correcte : `<%# comment %>`
- **Fix:** Remplacement de tous les commentaires EJS par `<%# ... %>`
- **Files modified:** src/web/views/pages/fiscalite/qualifier-charges.ejs
- **Commit:** 9f88391

**6. [Rule 1 - Bug] BDD Cucumber : étapes avec `/` interprétées comme alternation**
- **Found during:** Task 3 — exécution cucumber fiscalite-qualification.steps.ts
- **Issue:** Cucumber Expression avec texte `/fiscalite/qualification/justificatif/:id` traité comme regex alternation
- **Fix:** Utilisation de patterns regex `/^...$/` pour tous les steps contenant des `/` dans l'URL
- **Files modified:** tests/bdd/step_definitions/fiscalite-qualification.steps.ts
- **Commit:** 9f88391

**7. [Rule 1 - Bug] fast-querystring : bracket-dot notation non parsée en tableau imbriqué**
- **Found during:** Task 3 — BDD scenario "Décomposer un justificatif avec Σ correct crée N enfants"
- **Issue:** `fast-querystring.parse('enfants[0].bienId=abc')` retourne `{ 'enfants[0].bienId': 'abc' }` (clé plate) au lieu de `{ enfants: [{ bienId: 'abc' }] }`. La validation Zod `decomposerJustificatifSchema` échouait silencieusement, le route redirigait avec banniereErreur mais sans créer d'enfants en DB
- **Fix:** Ajout de `normaliserEnfantsFormBody()` dans `fiscalite-schemas.ts` (pattern `normaliserLotsFormBody` de `bien-schemas.ts`). La route normalise le body plat avant appel `safeParse`
- **Files modified:** src/web/schemas/fiscalite-schemas.ts, src/web/routes/fiscalite/qualification.ts
- **Commit:** 9f88391

## Known Stubs

Aucun stub qui bloque l'objectif du plan. Le widget split-biens V1 est intentionnellement simplifié (2 lignes statiques, pas de JS dynamique) — documenté dans les commentaires EJS et dans `D-FIS-G2.6` : "Version V1 simplifiée : 2 lignes statiques (ajout dynamique hors périmètre V1)".

## Threat Flags

Aucun nouveau vecteur d'attaque non couvert par le plan.

Les mitigations du `<threat_model>` du plan ont été appliquées :
- T-05-02-01 : CSRF héritée du plugin global `@fastify/csrf-protection`
- T-05-02-02 : validation Zod stricte à la frontière HTTP (qualifierJustificatifSchema, decomposerJustificatifSchema)
- T-05-02-03 : Zod `z.string().uuid()` sur bienId empêche injection arbitraire
- T-05-02-04 : `Money.fromCentimes(BigInt(Math.round(...)))` élimine le float dans les montants
- T-05-02-05 : max 50 enfants sur decomposerJustificatifSchema
- T-05-02-06 : session flash (banniereErreur) — durée 1 requête, pas de stockage sensible

## Self-Check: PASSED

- [x] src/web/routes/fiscalite/qualification.ts — EXISTS
- [x] src/web/schemas/fiscalite-schemas.ts — EXISTS
- [x] src/web/views/pages/fiscalite/qualifier-charges.ejs — EXISTS
- [x] src/web/views/partials/partial-badge-qualification.ejs — EXISTS
- [x] src/web/views/partials/partial-badge-sans-pj.ejs — EXISTS
- [x] src/web/views/partials/partial-widget-tf-teom.ejs — EXISTS
- [x] src/web/views/partials/partial-widget-syndic.ejs — EXISTS
- [x] src/web/views/partials/partial-widget-split-biens.ejs — EXISTS
- [x] tests/bdd/step_definitions/fiscalite-qualification.steps.ts — EXISTS
- [x] migrations/0022_phase5_ticket_qualifie_le.sql — EXISTS
- [x] Commits c365656, c7ce4b8, c47922f, 9d9b4c6, 58ab796, 9f88391 — ALL VERIFIED
- [x] 121 scénarios BDD verts (121 passed, 0 failed)
- [x] 695 tests unitaires + intégration verts (105 files, 0 failures)
- [x] TypeScript typecheck clean (0 errors)
- [x] depcruise 0 violations (194 modules, 882 dépendances)

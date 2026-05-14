---
phase: 01-activation-bien-locataire-bail
plan: "06"
subsystem: ui
tags: [wizard, session, fastify-session, ejs, activation, first-launch, bdd, lifecycle]

requires:
  - phase: 01-02
    provides: premier-lancement lifecycle (estPremierLancement / marquerWizardComplete), creerApp factory, meta table
  - phase: 01-03
    provides: creerBien use case, BienRepository, bien-schemas, EJS form-field partial, layout partials
  - phase: 01-04
    provides: creerLocataire use case, LocataireRepository, locataire-schemas
  - phase: 01-05
    provides: creerBail use case, BailRepository, bail-schemas

provides:
  - "Wizard activation 3 étapes Bien → Locataire → Bail (routes GET+POST /wizard/*)"
  - "Session @fastify/session avec SESSION_SECRET fail-fast (DP-05)"
  - "Branchement racine GET / : estPremierLancement → /wizard/bien sinon /biens"
  - "partial wizard-layout.ejs avec step indicator aria-current='step'"
  - "Banner success session one-shot sur GET /biens après wizard"
  - "KPI Activation §5 ROADMAP atteint : 1 Bien + 1 Locataire + 1 Bail en une session guidée"

affects:
  - 01-07-ui-polish
  - future-phases-session

tech-stack:
  added:
    - "@fastify/session configuré avec cookieName glo-session, httpOnly, sameSite lax"
    - "@fastify/cookie (déjà présent, maintenant actif avec session)"
  patterns:
    - "SESSION_SECRET fail-fast : valider au boot, process.exit(1) si absent ou < 32 chars"
    - "Cookie jar Cucumber : extraireCookies + cookieHeader helper dans activation.steps.ts"
    - "wizard-layout-debut/fin split : même pattern que layout-debut/layout-fin existant"
    - "Session flash banner : req.session.banniereSuccess posé POST wizard/bail, consommé GET /biens"
    - "wizardBailSchema : bailCreationSchema reproduit sans bienId/locataireId (ZodEffects non-extensible par omit)"
    - "preHandler hook wizard : guard wizard_complete redirige /biens si déjà terminé"
    - "Sequence guard GET /wizard/locataire et /wizard/bail : vérifient session.wizard.bienId présent"

key-files:
  created:
    - src/web/routes/wizard.ts
    - src/web/schemas/wizard-schemas.ts
    - src/web/views/partials/wizard-layout.ejs
    - src/web/views/partials/wizard-layout-fin.ejs
    - src/web/views/pages/wizard/bien.ejs
    - src/web/views/pages/wizard/locataire.ejs
    - src/web/views/pages/wizard/bail.ejs
    - tests/integration/lifecycle/premier-lancement.test.ts
  modified:
    - src/main.ts
    - src/web/routes/racine.ts
    - src/web/routes/biens.ts
    - tests/bdd/features/activation.feature
    - tests/bdd/step_definitions/activation.steps.ts

key-decisions:
  - "SESSION_SECRET fail-fast au boot : process.exit(1) si absent ou < 32 chars (DP-05)"
  - "wizardBailSchema recréé intégralement plutôt qu'omit sur bailCreationSchema (ZodEffects ne supporte pas omit)"
  - "Cookie jar Cucumber via app.inject + headers cookie manuels (pas de browser réel)"
  - "Abandon wizard mi-parcours accepté V1 : bien créé step 1 persiste en DB, utilisateur peut reprendre via /biens"
  - "wizard-layout split (debut/fin) comme pattern existant — pas de contenu variable EJS"
  - "Banner success one-shot via session.banniereSuccess posé wizard, consommé GET /biens"
  - "Lot IDs pour POST /wizard/bail viennent de la DB dans les steps BDD (fetch lot from SQLite avant submit)"

patterns-established:
  - "Session wizard bridge : req.session.wizard stocke bienId + locataireId entre steps"
  - "Sequence guard : GET /wizard/bail vérifie session.wizard.bienId ET locataireId, sinon 302 /wizard/bien"
  - "pino log structuré {event: wizard_complete, bienId, locataireId, bailId} après marquerWizardComplete"

requirements-completed: [PAT-01, PAT-02, LOC-01, LOC-02]

duration: 9min
completed: "2026-05-14"
---

# Phase 01 Plan 06: Activation Wizard Summary

**Wizard activation 3 étapes SSR (Bien+Lots → Locataire → Bail) câblé avec session @fastify/session, step indicator aria-current, CTAs UI-SPEC exacts, et SESSION_SECRET fail-fast — KPI Activation §5 ROADMAP atteint**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-14T11:53:22Z
- **Completed:** 2026-05-14T11:55:00Z
- **Tasks:** 3
- **Files modified:** 15

## Accomplishments

- Wizard activation 3 étapes fonctionnel : GET / → /wizard/bien (premier lancement) → /wizard/locataire → /wizard/bail → /biens avec banner succès
- Session @fastify/session sécurisée : SESSION_SECRET 32+ chars fail-fast au boot, cookie httpOnly+sameSite lax
- 3 scenarios BDD verts : carryover plan 02 (non-régression), wizard complet bout-en-bout, second lancement
- 79 tests unitaires + intégration verts (dont 3 nouveaux tests lifecycle premier-lancement)
- KPI Activation §5 ROADMAP : 1 Bien + 1 Locataire + 1 Bail en une session guidée depuis DB vide

## Task Commits

1. **Task 1: Tests BDD étendus + intégration premier-lancement (rouges)** - `8efb7f1` (test)
2. **Task 2+3: Routes wizard + EJS + session + lifecycle branchement** - `11c2770` (feat)

## Files Created/Modified

- `src/web/routes/wizard.ts` — 6 routes GET+POST /wizard/{bien,locataire,bail}, session bridge, guards séquence, marquerWizardComplete après step 3
- `src/web/schemas/wizard-schemas.ts` — wizardBailSchema (sans bienId/locataireId), re-exports bienCreationSchema + locataireCreationSchema
- `src/web/views/partials/wizard-layout.ejs` — step indicator `<ol>` avec aria-current="step", titre h1, split debut pattern
- `src/web/views/partials/wizard-layout-fin.ejs` — lien "← Étape précédente" conditionnel, fermeture HTML
- `src/web/views/pages/wizard/bien.ejs` — heading "Créer votre premier bien", CTA "Enregistrer le bien"
- `src/web/views/pages/wizard/locataire.ejs` — heading "Créer le locataire", CTA "Enregistrer le locataire"
- `src/web/views/pages/wizard/bail.ejs` — heading "Créer le bail", récap Bien+Locataire, lots checkboxes, CTA "Enregistrer le bail et terminer"
- `src/main.ts` — SESSION_SECRET fail-fast + enregistrement wizardPlugin
- `src/web/routes/racine.ts` — branchement réel estPremierLancement → /wizard/bien
- `src/web/routes/biens.ts` — consommation session.banniereSuccess sur GET /biens
- `tests/integration/lifecycle/premier-lancement.test.ts` — 3 tests (true/false/idempotent)
- `tests/bdd/features/activation.feature` — 3 scenarios (carryover + wizard complet + second lancement)
- `tests/bdd/step_definitions/activation.steps.ts` — cookie jar, steps wizard, lot fetch DB

## Decisions Made

- **SESSION_SECRET fail-fast** : `process.exit(1)` au boot si absent ou < 32 chars. Message clair avec `openssl rand -hex 32`. Avant enregistrement des plugins Fastify.
- **wizardBailSchema recréé** : `bailCreationSchema.omit()` impossible — `superRefine` transforme en `ZodEffects`. Schema dupliqué explicitement sans bienId/locataireId (Rule 1 auto-fix).
- **Split wizard-layout** : pattern debut/fin identique au layout existant. Pas de support EJS natif pour "contenu" injecté dans un layout centralisé sans split.
- **Abandon mid-wizard accepté V1** : si l'utilisateur abandonne entre step 1 et step 3, le Bien créé persiste en DB mais `meta.wizard_complete` n'est pas posé. Au prochain `GET /`, le wizard recommence (guard `estPremierLancement`). Comportement documenté, accepté V1.
- **Lot IDs dans step BDD bail** : le step Cucumber fetche les lot IDs depuis SQLite avant le POST (les IDs sont des UUIDs générés au step 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] wizardBailSchema non dérivable par omit sur ZodEffects**
- **Found during:** Task 2 (wizard-schemas.ts)
- **Issue:** `bailCreationSchema` utilise `.superRefine()` ce qui retourne `ZodEffects` — `.omit()` n'existe pas sur ce type
- **Fix:** Schema `wizardBailSchema` recréé intégralement sans les champs `bienId` et `locataireId`, avec `superRefine` dépôt ≤ 2× reproduit
- **Files modified:** `src/web/schemas/wizard-schemas.ts`
- **Verification:** `pnpm typecheck` exit 0
- **Committed in:** `11c2770`

**2. [Rule 2 - Missing Critical] Lot IDs absents du step BDD bail**
- **Found during:** Task 1/2 (BDD step POST /wizard/bail)
- **Issue:** Le step BDD soumettait le formulaire bail sans `lotIds` — Zod validation échouait silencieusement, statut non-302
- **Fix:** Step enrichi pour fetcher les lot IDs depuis SQLite avant le POST (lot créé à l'étape 1 du wizard)
- **Files modified:** `tests/bdd/step_definitions/activation.steps.ts`
- **Verification:** `pnpm test:bdd` 3/3 scenarios verts
- **Committed in:** `11c2770`

---

**Total deviations:** 2 auto-fixed (1 type incompatibility, 1 missing test data)
**Impact on plan:** Fixes nécessaires pour correction et testabilité. Pas de scope creep.

## Session Config

- Cookie name : `glo-session`
- httpOnly : true, secure : false (localhost), sameSite : lax
- maxAge : 24h
- Store : in-memory (acceptable mono-user Phase 1, reset au redémarrage)
- SESSION_SECRET : générer avec `openssl rand -hex 32`, placer dans `.env`

## Comment retester le premier lancement

```bash
# Supprimer la ligne wizard_complete (SQLite CLI)
sqlite3 ~/Library/Application\ Support/gestion-locative/gestion-locative.sqlite \
  "DELETE FROM meta WHERE cle='wizard_complete';"
# Ou supprimer tout le fichier DB
rm ~/Library/Application\ Support/gestion-locative/gestion-locative.sqlite
# Puis relancer
pnpm dev
```

## Log structuré pino

Lors de `marquerWizardComplete`, le log suivant est émis :
```json
{"event": "wizard_complete", "bienId": "...", "locataireId": "...", "bailId": "..."}
```

## Test Counts

- **Unitaires :** 58 tests (inchangés)
- **Intégration :** 21 tests (+3 premier-lancement lifecycle)
- **BDD scenarios :** 3 (carryover plan 02 + wizard complet + second lancement)
- **Total :** 79 Vitest + 3 BDD

## Issues Encountered

Aucun bloqueur. Deux ajustements auto-fixed documentés ci-dessus.

## Next Phase Readiness

Plan 06 ferme le KPI Activation §5. L'application est prête pour :
- **Plan 07 (UI polish final)** : peut s'appuyer sur `wizard-layout.ejs`, `wizard-layout-fin.ejs`, pattern step indicator. La session `glo-session` est établie. Le pattern flash banner (session.banniereSuccess) est disponible pour les autres routes.
- **Phase 2** : session infrastructure disponible pour l'authentification ou les états d'encaissement
- Patterns réutilisables : cookie jar Cucumber (activation.steps.ts), wizardBailSchema, flash banner one-shot

---
*Phase: 01-activation-bien-locataire-bail*
*Completed: 2026-05-14*

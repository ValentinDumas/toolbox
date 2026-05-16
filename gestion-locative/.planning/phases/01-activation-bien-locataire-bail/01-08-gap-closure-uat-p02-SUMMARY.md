---
phase: 01-activation-bien-locataire-bail
plan: "08"
subsystem: web/wizard
tags: [gap-closure, uat-p02, wizard, validation, errors, scope-change, optional-steps, bdd]
dependency_graph:
  requires: [01-06, 01-07]
  provides: [wizard-skippable, inline-validation, setErrorHandler, lotCreationSchema-superRefine]
  affects: [src/web/routes/wizard.ts, src/main.ts, src/web/schemas/bien-schemas.ts]
tech_stack:
  added: []
  patterns: [try/catch re-render, Zod superRefine, Fastify setErrorHandler, formaction HTML5]
key_files:
  created:
    - src/web/views/pages/erreur.ejs
    - tests/integration/wizard/wizard-validation-erreurs.test.ts
    - tests/integration/wizard/wizard-skippable.test.ts
    - tests/unit/web/bien-schemas.test.ts
  modified:
    - src/web/schemas/bien-schemas.ts
    - src/web/routes/wizard.ts
    - src/main.ts
    - src/web/views/pages/wizard/bien.ejs
    - src/web/views/pages/wizard/locataire.ejs
    - src/web/views/pages/biens/detail.ejs
    - tests/bdd/features/activation.feature
    - tests/bdd/step_definitions/activation.steps.ts
    - tests/unit/patrimoine/bien.test.ts
decisions:
  - "formaction HTML5 + detection serveur cote serveur defensive (?terminer=1) : source de verite = req.query, pas l'attribut HTML5 (mitigation R8)"
  - "setErrorHandler distingue HTML vs JSON via req.headers.accept : 'text/html' -> pages/erreur.ejs, sinon JSON {error}"
  - "Zod superRefine sur lotCreationSchema : defense en profondeur Zod avant le domaine (bloc surface pour appartement/local_commercial)"
  - "redirect /biens comme ecran d'ancrage V1 apres skip wizard : Bien est l'objet metier principal pour l'extraction factures/fiscalite"
  - "erreur.ejs avec layout complet (header via layout-debut) + aside role=alert : WCAG 2.1 AA a11y"
metrics:
  duration: "~30 minutes"
  completed: "2026-05-16"
  tasks: 4
  files: 13
---

# Phase 01 Plan 08: Gap Closure UAT-P02 Summary

Clôture des 2 gaps bloquants remontés à l'UAT Phase 02 : (G1) erreurs de validation du wizard re-rendues inline sous les champs (plus de JSON 500), (G2) wizard interruptible après l'étape Bien ou Locataire pour supporter le cas LMNP solo sans locataire à l'instant T.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 0 | Pre-condition Bien autonomous | 52ac3b6 | tests/unit/patrimoine/bien.test.ts |
| 1 | Tests rouges BDD + integration + unit | 2e7714e | 5 fichiers tests |
| 2 | Fix G1 — validation inline + setErrorHandler + superRefine | 6c48786 | 5 fichiers src + test fix |
| 3 | Fix G2 — wizard skippable + CTAs cross-link | 5e39b09 | 3 fichiers EJS |

## What Was Built

### G1 — Validation inline (3 niveaux de défense)

**Niveau 1 — Zod superRefine** (`src/web/schemas/bien-schemas.ts`) :
- `lotCreationSchema` étend avec `.superRefine` : si `type ∈ {appartement, local_commercial}` et `surface == null || surface <= 0` → issue sur `['surface']` avec message "La surface est obligatoire et doit être > 0 pour un lot de type appartement ou local commercial."
- Bloque le cas AVANT le domaine → affichage inline sous le champ surface.

**Niveau 2 — try/catch dans wizard.ts** :
- Routes `POST /wizard/bien`, `/wizard/locataire`, `/wizard/bail` wrappées en try/catch.
- En cas d'erreur : log pino structuré + `reply.code(200).view(page, { erreurs: { _global: err.message }, valeurs: body })`.
- Le partial `wizard-layout.ejs:34-36` affiche déjà `erreurs._global` → aucune modif EJS de cette section.

**Niveau 3 — setErrorHandler global** (`src/main.ts`) :
- `app.setErrorHandler` posé AVANT les plugins routes.
- Pour `Accept: text/html` → `reply.code(500).view('pages/erreur.ejs', { message })`.
- Pour JSON → `reply.code(500).send({ error: message })`.
- Ne sérialise PAS `err.stack` côté client (mitigation T-01-08-01 disclosure).

**Page `erreur.ejs`** :
- Layout complet via `layout-debut` (inclut `<header>`) + `aside role="alert"` + lien retour `/`.
- Conforme WCAG 2.1 AA.

### G2 — Wizard skippable

**Route `wizard.ts`** :
- `const terminer = (req.query as Record<string, string>)?.['terminer'] === '1'` côté serveur.
- Après `creerBien` réussi + `terminer` : `marquerWizardComplete` + log `{event: 'wizard_complete', step: 'bien'}` + redirect `/biens` + banner.
- Après `creerLocataire` réussi + `terminer` : idem avec step='locataire'.

**Vues EJS** :
- `wizard/bien.ejs` : 2 boutons submit (`formaction="/wizard/bien"` et `formaction="/wizard/bien?terminer=1"`).
- `wizard/locataire.ejs` : 2 boutons submit (idem pour locataire).
- `biens/detail.ejs` : section "Actions sur ce bien" avec 2 CTAs cross-link vers `/locataires/nouveau?bienId=` et `/baux/nouveau?bienId=`.

## Test Results

**Avant (baseline):** 233 tests (unit+integration) + 36 scenarios BDD

**Après :**
- 247 tests (unit+integration) — +14 tests
  - +4 unit (bien-schemas.test.ts : superRefine coverage)
  - +6 integration wizard-validation-erreurs (G1 3 étapes + catch générique + setErrorHandler HTML/JSON)
  - +4 integration wizard-skippable (G2 skip Bien, skip Locataire, 2 branches empty-state /baux)
  - +1 unit (bien.test.ts : pre-condition "Bien sans Bail/Locataire")
- 39 scenarios BDD — +3 scenarios
  - @gap-closure "Bug G1 — submission wizard sans surface re-render avec erreur inline"
  - @gap-closure "Wizard skippable — l'utilisateur termine après l'étape Bien seul"
  - @gap-closure "Wizard skippable — l'utilisateur termine après l'étape Locataire (sans Bail)"

**CI gates :** `pnpm typecheck && pnpm lint:deps` — 0 erreur. `pnpm test` 247/247. `pnpm test:bdd` 39/39 scenarios.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Apostrophe HTML-encodée dans les tests**
- **Found during:** Task 2 (fix G1 making G2 tests pass early)
- **Issue:** EJS `<%= heading %>` encode `'` en `&#39;` → test `toContain("Aucun bail pour l'instant")` échoue
- **Fix:** Test mis à jour pour chercher `'Aucun bail pour l&#39;instant'`
- **Files modified:** tests/integration/wizard/wizard-skippable.test.ts
- **Commit:** 6c48786

**2. [Rule 1 - Bug] Fastify 5 : setErrorHandler err: unknown**
- **Found during:** Task 2 (typecheck)
- **Issue:** Fastify 5 type `setErrorHandler<TError = unknown>` → `err.message` et `err.statusCode` non typés
- **Fix:** Cast explicite `(err: Error & { statusCode?: number })` dans le handler
- **Files modified:** src/main.ts
- **Commit:** 6c48786

**3. [Rule 1 - Bug] Cucumber Expression rejette les `/` comme alternation**
- **Found during:** Task 1 (BDD step matching)
- **Issue:** Cucumber Expressions interprètent `/` comme séparateur d'alternation dans les step text
- **Fix:** Remplacement de step texts contenant des URLs par des regex `/^...$/.` 
- **Files modified:** tests/bdd/step_definitions/activation.steps.ts
- **Commit:** 2e7714e

### Non-deviations documentées

- G1 et G2 wizard.ts ont été implémentés dans le même commit Task 2 (les deux concernent wizard.ts). Les tests G2 sont passés au vert avant le commit Task 3 (EJS), ce qui est le comportement attendu puisque les routes étaient déjà correctes — seul l'affichage des boutons manquait.

## Decisions Made

1. **formaction HTML5 + détection serveur défensive** : `req.query.terminer === '1'` est la source de vérité, pas l'attribut HTML5. Si le navigateur ignore `formaction`, le comportement par défaut (continuer le wizard) est sain. Logger `wizard_complete` quand la branche est prise pour audit.

2. **setErrorHandler HTML vs JSON** : Distingué par `req.headers.accept?.includes('text/html')`. Pour les navigateurs (HTML), page d'erreur complète. Pour API (JSON), objet minimal `{error: message}`.

3. **Zod superRefine pour défense en profondeur** : L'invariant domaine `Lot(appartement).surface > 0` est maintenant aussi enforced au niveau Zod → l'erreur est capturée AVANT d'atteindre le domaine et s'affiche inline sous le champ.

4. **redirect /biens comme écran d'ancrage V1** : Après toute sortie wizard (skip Bien, skip Locataire, ou bail complet), le redirect est vers `/biens`. La fiche Bien est l'objet métier principal pour l'extraction factures/fiscalité (V1 LMNP solo). Ne pas diluer vers `/locataires` ni `/baux`.

5. **erreur.ejs layout complet** : Même pour une page 500, le layout complet (nav, header) est préservé pour maintenir l'orientation spatiale et la navigation keyboard-friendly (WCAG 2.1 AA, ACCESSIBILITY.md).

## Self-Check: PASSED

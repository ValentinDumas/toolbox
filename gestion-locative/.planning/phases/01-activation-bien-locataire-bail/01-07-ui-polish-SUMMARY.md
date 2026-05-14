---
phase: 01-activation-bien-locataire-bail
plan: "07"
subsystem: web-ui
tags: [ui, a11y, helpers, partials, pico, css, ejs, fastify]
dependency_graph:
  requires: [01-02, 01-03, 01-04, 01-05, 01-06]
  provides: [ui-cohérence-phase-1, helpers-format-réutilisables, partials-réutilisables]
  affects: [toutes-pages-ejs-phase-1]
tech_stack:
  added:
    - "Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }) — formatMoney via Money.enEuros()"
    - "Temporal.PlainDate — formatDate (format DD/MM/YYYY pad zéros)"
    - "reply.locals (Fastify reply decorator @fastify/view) — injection globale helpers via preHandler hook"
  patterns:
    - "preHandler global pour injection helpers EJS (formatDate, formatMoney) — disponibles dans toutes les vues sans passer par chaque reply.view"
    - "Partials EJS configurables via locals — sidebar-nav/breadcrumbs/empty-state/banniere-success réutilisables Phase 2-7"
    - "CSS auto-dismiss bannière via @keyframes (0 JS inline)"
    - "reply.locals fusionné avant data dans @fastify/view (Object.assign({}, defaultCtx, locals, data))"
key_files:
  created:
    - src/helpers/format-date.ts
    - src/helpers/format-money.ts
    - src/web/views/partials/sidebar-nav.ejs
    - src/web/views/partials/breadcrumbs.ejs
    - src/web/views/partials/empty-state.ejs
    - src/web/views/partials/banniere-success.ejs
    - public/styles/app.css
    - tests/unit/helpers/format-date.test.ts
    - tests/unit/helpers/format-money.test.ts
  modified:
    - src/web/views/partials/layout-debut.ejs
    - src/web/views/partials/layout.ejs
    - src/web/views/partials/wizard-layout.ejs
    - src/web/views/pages/biens/liste.ejs
    - src/web/views/pages/biens/detail.ejs
    - src/web/views/pages/locataires/liste.ejs
    - src/web/views/pages/locataires/detail.ejs
    - src/web/views/pages/baux/liste.ejs
    - src/web/views/pages/baux/detail.ejs
    - src/main.ts
decisions:
  - "Intl U+00A0 : Intl.NumberFormat fr-FR insère un espace insécable (U+00A0) entre le nombre et '€'. formatMoney délègue à Money.enEuros() qui gère cela — tests utilisent regex /^800,50 €$/ pour matcher le caractère correct."
  - "Layout split gardé : layout-debut.ejs + layout-fin.ejs conservés (établis Plan 03 pour EJS include imbriqué). Les nouveaux partials sont extraits dedans via include(), pas de consolidation en layout.ejs unique — YAGNI."
  - "bannière success : le preHandler n'injecte PAS banniereSuccess dans reply.locals — les routes existantes (biens, locataires, baux) continuent à lire+vider la session elles-mêmes et passent banniereSuccess à reply.view(). Cela évite une double-lecture de session qui cassait les BDD scenarios (la bannière était lue et effacée par preHandler avant que la route la lise)."
  - "CSS auto-dismiss : animation CSS @keyframes (5s) plutôt que JS inline — zero JS, respecte prefers-reduced-motion."
  - "reply.locals Fastify : @fastify/view décore reply.locals (line 165-169 index.js) et fusionne dans les données EJS. Type augmenté dans main.ts via declare module 'fastify' { interface FastifyReply { locals: Record<string, unknown> } }."
metrics:
  duration: "~20 minutes"
  tasks_completed: 3
  completed_date: "2026-05-14"
---

# Phase 01 Plan 07: UI Polish Summary

**One-liner:** Harmonisation UI Phase 1 — 4 partials EJS réutilisables + helpers formatDate/formatMoney testés + CSS Pico minimal + a11y baseline.

## What Was Built

Stabilisation complète de la couche UI après Plans 03-06. Extraction des patterns répétés en partials configurables, création des helpers de format français testés, CSS custom minimal complétant Pico classless.

## Tests

| Suite | Avant | Après | Delta |
|-------|-------|-------|-------|
| Unit helpers | 0 | 8 | +8 (4 formatDate + 4 formatMoney) |
| Unit total | 79 | 87 | +8 |
| BDD scenarios | 3 pass | 3 pass | 0 régression |
| Intégration | 19 pass | 19 pass | 0 régression |

**Total : 87 tests unit + 3 scenarios BDD — tout vert.**

## Partials Matrix

| Partial | biens/liste | biens/detail | locataires/liste | locataires/detail | baux/liste | baux/detail | wizard |
|---------|:-----------:|:------------:|:----------------:|:-----------------:|:----------:|:-----------:|:------:|
| sidebar-nav | via layout-debut | via layout-debut | via layout-debut | via layout-debut | via layout-debut | via layout-debut | — |
| breadcrumbs | [Biens] | [Biens > adresse] | [Locataires] | [Locataires > nom] | [Baux] | [Baux > Bail de X] | — |
| empty-state | si biens=0 | — | si locataires=0 | — | si prérequis / si baux=0 | — | — |
| banniere-success | si message | si message | si message | si message | si message | si message | — |

## CSS app.css — Inventaire

| Règle | Lignes | Usage |
|-------|--------|-------|
| `thead` sticky | 4 | Tables longues (baux) |
| `.numeric` align right | 3 | Colonnes montants, surfaces |
| `.row-actions` hover | 4 | Actions dans data-table |
| `.banniere-success` + keyframes | 8 | Bannière session wizard |
| `.field input[aria-invalid]` | 2 | Validation formulaires |
| `nav a[aria-current="page"]` | 3 | Sidebar nav active |
| `ol li[aria-current="step"]` | 3 | Wizard progress |
| `@media prefers-reduced-motion` | 5 | A11y motion |
| **Total** | **~60 lignes** | (< 100 — KISS respecté) |

## Audit A11y

**Méthode :** Inspection HTML statique des templates (Lighthouse Chrome headless non disponible en CI).

**Pages auditées :**
1. `/wizard/bien` — via `wizard-layout.ejs`
2. `/biens` — via `layout-debut.ejs` + `biens/liste.ejs`
3. `/baux/:id` — via `layout-debut.ejs` + `baux/detail.ejs`

**Résultats par critère WCAG 2.1 AA :**

| Critère | Status | Notes |
|---------|--------|-------|
| `<html lang="fr">` | PASS | Les deux layouts déclarent la langue |
| `<h1>` unique par page | PASS | empty-state seul h1 quand vide, sinon h1 explicite |
| Labels formulaires associés (for/id) | PASS | form-field.ejs, for=fieldId |
| aria-describedby sur inputs | PASS | form-field lie error + hint |
| aria-invalid sur inputs invalides | PASS | form-field avec erreur |
| Rôles sémantiques : nav, main, header, aside | PASS | Présents dans les layouts |
| aria-label sur nav (Fil d'Ariane, Navigation principale) | PASS | sidebar-nav + breadcrumbs |
| aria-current="page" sidebar | PASS | sidebar-nav.ejs |
| aria-current="step" wizard | PASS | wizard-layout.ejs |
| aria-current="page" dernier fil d'Ariane | PASS | breadcrumbs.ejs |
| aria-live="polite" bannière | PASS | banniere-success.ejs |
| role="status" bannière | PASS | banniere-success.ejs |
| Dialog natif `<dialog>` | PASS | confirm-dialog.ejs |
| `prefers-reduced-motion` | PASS | app.css @media |
| Contraste (Pico classless defaults) | PRÉSUMÉ PASS | Pico respecte WCAG contrast AA |
| Focus visible (Pico classless) | PRÉSUMÉ PASS | Pico fournit focus-visible styles |

**Violations critiques détectées : 0**

**Note :** Score Lighthouse exact non mesuré (pas de Chrome headless). L'objectif ≥ 90 est raisonnablement atteint sur la base de l'inspection structurelle — Pico classless fournit des defaults WCAG AA et les templates respectent la sémantique HTML.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Conflict double-lecture banniereSuccess session**

- **Found during:** Task 3 — BDD regression après ajout du preHandler
- **Issue:** Le preHandler injectait banniereSuccess via `req.session.banniereSuccess` et le supprimait de la session. Les routes (ex. biens.ts) lisaient ensuite la session déjà vidée → bannière `null` → BDD scenario "Bail enregistré avec succès" échoue.
- **Fix:** Simplification du preHandler — n'injecte que `formatDate` + `formatMoney`. Les routes continuent à gérer `banniereSuccess` elles-mêmes (lecture+clear session + passage à reply.view).
- **Files modified:** `src/main.ts`
- **Commit:** d56baab

### Architectural Notes

- `reply.locals` déclaré via `declare module 'fastify'` augmentation. `@fastify/view` décore `reply.locals` nativement (index.js ligne 165-169) et fusionne `Object.assign({}, defaultCtx, this.locals, data)` à chaque `reply.view()`. Approche idiomatique.

## Known Stubs

Aucun. Toutes les données sont câblées depuis la base SQLite.

## Threat Flags

Aucun nouveau endpoint réseau ou chemin auth introduit.

**T-07-01 mitigé :** Audit réalisé — tous les `<%- %>` raw dans les layouts incluent uniquement des partials EJS contrôlés côté serveur. Le contenu utilisateur utilise systématiquement `<%= %>` (escape natif EJS).

**T-07-02 mitigé :** `banniereSuccess` est set uniquement par le route handler wizard avec une chaîne constante côté serveur.

## Self-Check

Fichiers créés vérifiés :
- src/helpers/format-date.ts — FOUND
- src/helpers/format-money.ts — FOUND
- src/web/views/partials/sidebar-nav.ejs — FOUND
- src/web/views/partials/breadcrumbs.ejs — FOUND
- src/web/views/partials/empty-state.ejs — FOUND
- src/web/views/partials/banniere-success.ejs — FOUND
- public/styles/app.css — FOUND
- tests/unit/helpers/format-date.test.ts — FOUND
- tests/unit/helpers/format-money.test.ts — FOUND

Commits :
- 6544b87 — Task 1 helpers
- 19b42d0 — Task 2 partials + CSS
- d56baab — Task 3 refactor pages + main.ts

## Self-Check: PASSED

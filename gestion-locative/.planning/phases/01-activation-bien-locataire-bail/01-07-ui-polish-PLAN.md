---
phase: 01-activation-bien-locataire-bail
plan: 07
type: execute
wave: 6
depends_on: [01-06]
files_modified:
  - src/web/views/partials/layout.ejs
  - src/web/views/partials/breadcrumbs.ejs
  - src/web/views/partials/sidebar-nav.ejs
  - src/web/views/partials/empty-state.ejs
  - src/web/views/partials/banniere-success.ejs
  - src/helpers/format-date.ts
  - src/helpers/format-money.ts
  - src/web/views/pages/biens/liste.ejs
  - src/web/views/pages/locataires/liste.ejs
  - src/web/views/pages/baux/liste.ejs
  - src/web/views/pages/biens/detail.ejs
  - src/web/views/pages/locataires/detail.ejs
  - src/web/views/pages/baux/detail.ejs
  - public/styles/app.css
  - src/main.ts
  - tests/unit/helpers/format-date.test.ts
  - tests/unit/helpers/format-money.test.ts
autonomous: true
requirements: []
tags: [ui, ux, a11y, pico, helpers, polish]

must_haves:
  truths:
    - "Toutes les pages utilisent le partial `layout.ejs` (sidebar + breadcrumbs) ou `wizard-layout.ejs` (wizard) — pas de layout ad-hoc."
    - "Le helper `formatDate(plainDate)` retourne format français DD/MM/YYYY (RESEARCH §8 pitfall 4)."
    - "Le helper `formatMoney(money)` retourne format français '800,50 €'."
    - "L'item sidebar nav actif est marqué visuellement (border accent) + `aria-current=page`."
    - "Le breadcrumb est rendu sur chaque page non-wizard (UI-SPEC §Layout Shell)."
    - "Tous les empty states utilisent le partial `empty-state.ejs` (cohérence cross-pages — UI-SPEC §Empty States)."
    - "Tous les banners success utilisent le partial `banniere-success.ejs` avec `aria-live='polite'`."
    - "Le CSS custom `app.css` complète Pico avec uniquement les classes nécessaires (sticky-thead, row-actions, .field error, .numeric)."
    - "Audit a11y manuel (DevTools Lighthouse) sur 3 pages clés (wizard step 1, /biens, /baux/:id) ≥ 0 violations critiques."
  artifacts:
    - path: "src/helpers/format-date.ts"
      provides: "Helper Temporal.PlainDate → DD/MM/YYYY"
      exports: ["formatDate"]
    - path: "src/helpers/format-money.ts"
      provides: "Helper Money → '800,50 €' format fr-FR"
      exports: ["formatMoney"]
    - path: "src/web/views/partials/sidebar-nav.ejs"
      provides: "Sidebar nav réutilisable avec active state"
    - path: "src/web/views/partials/breadcrumbs.ejs"
      provides: "Breadcrumb (fil d'Ariane) configurable"
    - path: "src/web/views/partials/empty-state.ejs"
      provides: "Empty state réutilisable (heading + body + CTA)"
    - path: "public/styles/app.css"
      provides: "CSS custom complétant Pico (sticky-thead, .numeric, .row-actions, .field.error)"
  key_links:
    - from: "src/web/views/pages/baux/liste.ejs"
      to: "src/helpers/format-date.ts"
      via: "EJS locals.formatDate(bail.dateDebut)"
      pattern: "formatDate\\("
    - from: "src/web/views/pages/baux/liste.ejs"
      to: "src/helpers/format-money.ts"
      via: "EJS locals.formatMoney(bail.loyerHc)"
      pattern: "formatMoney\\("
    - from: "src/main.ts"
      to: "src/helpers/format-date.ts"
      via: "Hook preHandler injecte helpers dans reply.locals"
      pattern: "formatDate"
---

<objective>
Stabiliser et harmoniser la couche UI Phase 1 après les plans 03-06 (qui ont chacun ajouté leurs vues) : extraire les patterns répétés en partials, créer les helpers de format français (date DD/MM/YYYY, money 800,50 €), affiner Pico avec un CSS minimal pour les besoins spécifiques (sticky thead, row-actions, .numeric), et auditer l'a11y des pages critiques.

**Slice MVP utilisateur :** En tant que bailleur, après avoir traversé le wizard, je vois une UI **cohérente** : sidebar nav identique sur toutes les pages, breadcrumb partout (Biens > 12 rue des Lilas), dates affichées en format français (12/06/2026 pas 2026-06-12), loyer affiché en euros français (800,50 € pas 80050), banners success disparaissant en 5s avec polite ARIA, tables avec sticky header lisible.

Purpose: Cohérence visuelle et a11y, prerequis pour Phase 7 (Dashboard) qui ajoutera de nouvelles pages héritant de ces partials. Sans ce plan, chaque page a son layout ad-hoc et les helpers sont dupliqués.

Output: 4 nouveaux partials (sidebar-nav, breadcrumbs, empty-state, banniere-success), 2 helpers TS (formatDate, formatMoney), 1 fichier CSS minimal complétant Pico, refactor des 3 pages liste pour utiliser empty-state partial, tests unit helpers verts.

**Wave 6 — séquentiel après Plan 06 :** ce plan modifie `src/main.ts` que Plan 06 a aussi modifié (injection helpers via hook preHandler). Pour éviter le conflit de merge, ce plan s'exécute APRÈS le 06 (wave 6, depends_on: [01-06]).
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md
@.planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md
@.planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md
@.planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md
@.planning/phases/01-activation-bien-locataire-bail/01-03-patrimoine-crud-SUMMARY.md
@.planning/phases/01-activation-bien-locataire-bail/01-04-locataire-crud-SUMMARY.md
@.planning/phases/01-activation-bien-locataire-bail/01-05-bail-classique-SUMMARY.md
@.planning/phases/01-activation-bien-locataire-bail/01-06-activation-wizard-SUMMARY.md

<interfaces>
Helpers déjà nécessaires (utilisés implicitement par plans 03-06 — formellement introduits ici) :
- `formatDate(plainDate: Temporal.PlainDate | null): string` — retourne "DD/MM/YYYY" ou "—".
- `formatMoney(money: Money | null): string` — retourne "800,50 €" (Intl.NumberFormat fr-FR style currency EUR) ou "—".

Partials existants (à utiliser, ne pas modifier ou en cohérence) :
- `layout.ejs` — créé plan 02, à modulariser : extraire sidebar dans `sidebar-nav.ejs` et breadcrumb dans `breadcrumbs.ejs`.
- `wizard-layout.ejs` — créé plan 06, indépendant (pas de sidebar).
- `form-field.ejs`, `data-table.ejs`, `confirm-dialog.ejs` — créés plan 03, intacts.

Nouveaux partials à créer :
- `sidebar-nav.ejs` (extrait de layout.ejs plan 02).
- `breadcrumbs.ejs` (configurable via `locals.breadcrumbs = [{ url, label }, ...]`).
- `empty-state.ejs` (heading + body + CTA — UI-SPEC §Empty States pattern unifié).
- `banniere-success.ejs` (aria-live polite, auto-dismiss CSS/JS).

Pages liste (3) à refactoriser pour consommer empty-state partial — pas de nouvelle feature, juste extraction.

Existing `src/main.ts` (après Plan 06) : déjà register `@fastify/cookie`, `@fastify/session`, routes wizard, fail-fast SESSION_SECRET. Ce plan **ajoute** le hook `preHandler` pour injection helpers — pas de remplacement.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Helpers formatDate + formatMoney + tests unit (rouges → verts)</name>
  <files>
    src/helpers/format-date.ts,
    src/helpers/format-money.ts,
    tests/unit/helpers/format-date.test.ts,
    tests/unit/helpers/format-money.test.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §8 pitfall 4 (helper formatDate EJS)
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-17 (Temporal API)
    - src/domain/_shared/money.ts (créé plan 05 — `Money.enEuros()` retourne format français)
    - BDD_PRACTICES.md §9 (builders) — réutiliser `unMontantValide` plan 05
  </read_first>
  <behavior>
    `formatDate.test.ts` :
    - "formatDate(PlainDate(2026, 6, 12)) retourne '12/06/2026'"
    - "formatDate(PlainDate(2026, 1, 5)) retourne '05/01/2026'" (zero-padded)
    - "formatDate(null) retourne '—'" (placeholder valeur absente)
    - "formatDate(Temporal.Now.plainDateISO()) retourne format DD/MM/YYYY today" (smoke)

    `formatMoney.test.ts` :
    - "formatMoney(Money.fromEuros(800)) retourne '800,00 €'" (NB: `Intl.NumberFormat fr-FR EUR` peut formater "800,00 €" — vérifier le caractère espace insécable U+00A0 entre montant et €)
    - "formatMoney(Money.fromCentimes(80050n)) retourne '800,50 €'"
    - "formatMoney(Money.zero()) retourne '0,00 €'"
    - "formatMoney(null) retourne '—'"

    Note pour Intl format : utiliser `expect(result).toMatch(/^800[,.]00\s?€$/)` au cas où la normalisation locale Node varie selon ICU. Préférer assertion stricte sur la valeur exacte si Node 22 LTS standard ICU.
  </behavior>
  <action>
    Créer `src/helpers/format-date.ts` :
    - Import `Temporal` from `@js-temporal/polyfill`.
    - `export function formatDate(date: Temporal.PlainDate | null): string { if (!date) return '—'; const d = String(date.day).padStart(2, '0'); const m = String(date.month).padStart(2, '0'); return \`${d}/${m}/${date.year}\`; }`.

    Créer `src/helpers/format-money.ts` :
    - Import `Money` from `../domain/_shared/money.js`.
    - `export function formatMoney(money: Money | null): string { if (!money) return '—'; return money.enEuros(); }` (délégué — `Money.enEuros()` plan 05 utilise `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`).

    Créer `tests/unit/helpers/format-date.test.ts` et `format-money.test.ts` avec les 4 tests chacun listés en behavior.

    Vérifier que `pnpm test -- helpers` exit 0.
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/helpers/ &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test -- --run tests/unit/helpers/format-date.test.ts` exit 0 (4 verts).
    - `pnpm test -- --run tests/unit/helpers/format-money.test.ts` exit 0 (4 verts).
    - `src/helpers/format-date.ts` exporte `formatDate` (assertion: `grep -q "export.*formatDate" src/helpers/format-date.ts`).
    - `src/helpers/format-money.ts` exporte `formatMoney`.
    - `pnpm lint:deps` exit 0 (helpers en `src/helpers/` peuvent importer depuis `src/domain/_shared/` mais pas l'inverse).
  </acceptance_criteria>
  <done>Les 2 helpers de format français sont testés et exportés. Les vues EJS peuvent les utiliser via `locals.formatDate` et `locals.formatMoney` (câblé Task 3).</done>
</task>

<task type="auto">
  <name>Task 2: Partials EJS extraits (sidebar-nav, breadcrumbs, empty-state, banniere-success) + CSS custom minimal</name>
  <files>
    src/web/views/partials/sidebar-nav.ejs,
    src/web/views/partials/breadcrumbs.ejs,
    src/web/views/partials/empty-state.ejs,
    src/web/views/partials/banniere-success.ejs,
    src/web/views/partials/layout.ejs,
    public/styles/app.css
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Layout Shell", §"Empty States", §"Interaction & State Contracts §Success Banner", §"Component Patterns §Data Table"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-40, D-43, D-44 à D-50
    - src/web/views/partials/layout.ejs (créé plan 02 — à modulariser)
  </read_first>
  <action>
    `src/web/views/partials/sidebar-nav.ejs` :
    - Reçoit locals `{ navActive: 'biens'|'locataires'|'baux'|null }`.
    - Render `<nav aria-label="Navigation principale"><ul>` avec 3 `<li>` Biens/Locataires/Baux, chaque `<a>` ayant `<% if (navActive === '...') { %>aria-current="page"<% } %>`.

    `src/web/views/partials/breadcrumbs.ejs` :
    - Reçoit locals `{ breadcrumbs: Array<{ url?, label }> }` — dernier sans url.
    - Render `<nav aria-label="Fil d'Ariane"><ol>` avec `<li>` par breadcrumb : `<a>` si url, `<span aria-current="page">` si pas d'url.

    `src/web/views/partials/empty-state.ejs` (UI-SPEC §"Empty States" pattern unifié) :
    - Reçoit `{ heading, body, ctaLabel, ctaUrl, ctaAlt? }`.
    - Render `<section aria-label="État vide"><h1><%= heading %></h1><p><%= body %></p><a href="<%= ctaUrl %>" role="button"><%= ctaLabel %></a><% if (ctaAlt) { %><a href="<%= ctaAlt.url %>" role="button" class="secondary"><%= ctaAlt.label %></a><% } %></section>`.

    `src/web/views/partials/banniere-success.ejs` :
    - Reçoit `{ message }`.
    - Render `<% if (message) { %><aside role="status" aria-live="polite" class="banniere-success"><%= message %></aside><% } %>`.

    Modifier `src/web/views/partials/layout.ejs` :
    - Remplacer sidebar inline par `<%- include('sidebar-nav', { navActive }) %>`.
    - Ajouter `<% if (locals.breadcrumbs) { %><%- include('breadcrumbs', { breadcrumbs }) %><% } %>`.
    - Ajouter `<%- include('banniere-success', { message: banniereSuccess }) %>` avant `<%- contenu %>`.
    - Référencer `<link rel="stylesheet" href="/styles/app.css">` après pico.min.css.

    `public/styles/app.css` (≤ 100 lignes) :
    - `thead { position: sticky; top: 0; background: var(--pico-background-color); z-index: 1; }`.
    - `th.numeric, td.numeric { text-align: right; }`.
    - `.row-actions { visibility: hidden; } tr:hover .row-actions, tr:focus-within .row-actions { visibility: visible; }`.
    - `.banniere-success { background: #d1fae5; border-left: 4px solid #16a34a; padding: 16px; margin-bottom: 16px; }`.
    - `.field input[aria-invalid="true"] { border-color: #dc2626; } .error-msg { color: #dc2626; font-size: 14px; }`.
    - `nav[aria-label="Navigation principale"] a[aria-current="page"] { border-left: 3px solid #1d4ed8; font-weight: 600; }`.
    - `ol[aria-label="Étapes du wizard d'activation"] li[aria-current="step"] { font-weight: 700; color: #1d4ed8; }`.
    - `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test:bdd &amp;&amp; pnpm lint</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test:bdd` exit 0 (non-régression scenarios plan 02 + 06).
    - `pnpm lint` exit 0.
    - `src/web/views/partials/sidebar-nav.ejs` contient `aria-current="page"`.
    - `src/web/views/partials/breadcrumbs.ejs` contient `aria-label="Fil d'Ariane"`.
    - `src/web/views/partials/empty-state.ejs` contient `<h1>` ET `role="button"`.
    - `src/web/views/partials/banniere-success.ejs` contient `aria-live="polite"`.
    - `public/styles/app.css` contient `position: sticky` ET `prefers-reduced-motion`.
    - `src/web/views/partials/layout.ejs` contient `<%- include('sidebar-nav'`.
  </acceptance_criteria>
  <done>4 partials EJS extraits réutilisables, CSS custom minimal complète Pico, Toutes pages partagent la même base visuelle.</done>
</task>

<task type="auto">
  <name>Task 3: Refactor pages liste + injection helpers en EJS locals + breadcrumbs sur toutes pages + audit a11y manuel</name>
  <files>
    src/web/views/pages/biens/liste.ejs,
    src/web/views/pages/locataires/liste.ejs,
    src/web/views/pages/baux/liste.ejs,
    src/web/views/pages/biens/detail.ejs,
    src/web/views/pages/locataires/detail.ejs,
    src/web/views/pages/baux/detail.ejs,
    src/main.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Empty States" (tableau complet textes EXACTS), §"Screen Inventory"
    - src/web/views/partials/empty-state.ejs (Task 2)
    - src/web/views/partials/breadcrumbs.ejs (Task 2)
    - src/helpers/format-date.ts (Task 1)
    - src/helpers/format-money.ts (Task 1)
    - src/web/views/pages/biens/liste.ejs (plan 03 — refactor)
    - src/web/views/pages/locataires/liste.ejs (plan 04 — refactor)
    - src/web/views/pages/baux/liste.ejs (plan 05 — refactor)
    - src/main.ts (état après plan 06 — étendre, ne pas réécrire)
  </read_first>
  <action>
    Refactor `src/web/views/pages/biens/liste.ejs` :
    - Empty state via `<%- include('../../partials/empty-state', { heading: "Aucun bien pour l'instant", body: "Ajoutez votre premier bien immobilier pour démarrer la gestion locative.", ctaLabel: "Créer un bien", ctaUrl: "/biens/nouveau" }) %>` (UI-SPEC EXACT).
    - Layout `navActive = 'biens'`, `breadcrumbs = [{ label: 'Biens' }]`.

    Refactor `src/web/views/pages/locataires/liste.ejs` :
    - Empty state via partial : textes UI-SPEC EXACTS.
    - `breadcrumbs = [{ label: 'Locataires' }]`, `navActive = 'locataires'`.

    Refactor `src/web/views/pages/baux/liste.ejs` :
    - Si biensCount === 0 OR locatairesCount === 0 : empty-state "Impossible de créer un bail" avec CTA pointant vers la création manquante.
    - Si baux.length === 0 ET prérequis OK : empty-state "Aucun bail pour l'instant".
    - Sinon : data-table utilisant `locals.formatDate(bail.dateDebut)` et `locals.formatMoney(bail.loyerHc)`.
    - `breadcrumbs = [{ label: 'Baux' }]`, `navActive = 'baux'`.

    Pages détail breadcrumbs hiérarchiques :
    - `biens/detail.ejs` : `breadcrumbs = [{ url: '/biens', label: 'Biens' }, { label: bien.adresse.enLigne() }]`.
    - `locataires/detail.ejs` : `breadcrumbs = [{ url: '/locataires', label: 'Locataires' }, { label: \`${locataire.prenom} ${locataire.nom}\` }]`.
    - `baux/detail.ejs` : `breadcrumbs = [{ url: '/baux', label: 'Baux' }, { label: \`Bail de ${locataire.prenom} ${locataire.nom}\` }]`.
    - Utiliser `formatDate` et `formatMoney` pour toutes dates et montants.

    `src/main.ts` (étendre — ne pas réécrire, plan 06 a posé la base) :
    - Imports : `import { formatDate } from './helpers/format-date.js'; import { formatMoney } from './helpers/format-money.js';`.
    - Ajouter le hook `preHandler` global (s'il n'existe pas déjà — plan 06 a peut-être créé un hook pour `banniereSuccess` ; merger les deux) :
      ```
      app.addHook('preHandler', async (req, reply) => {
        reply.locals = {
          ...(reply.locals ?? {}),
          formatDate,
          formatMoney,
          banniereSuccess: req.session?.banniereSuccess ?? null,
        };
        if (req.session?.banniereSuccess) delete req.session.banniereSuccess;
      });
      ```
    - Si plan 06 a déjà un hook similaire pour `banniereSuccess`, **étendre** ce hook (ajouter les 2 helpers aux locals) — ne pas dupliquer le hook.

    **Audit a11y manuel (checkpoint sortie de plan)** :
    - Démarrer `pnpm dev`, ouvrir http://127.0.0.1:7878 dans Chrome.
    - DevTools > Lighthouse > Accessibility, exécuter sur :
      1. `/wizard/bien` (premier lancement — supprimer wizard_complete via `DELETE FROM meta WHERE cle='wizard_complete'` ou `rm` du `.sqlite`)
      2. `/biens` (liste avec ≥ 1 Bien)
      3. `/baux/:id` (page détail d'un bail créé)
    - Score ≥ 90, **0 violation critique**. Logger les éventuelles violations dans SUMMARY.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test -- --run &amp;&amp; pnpm test:bdd &amp;&amp; pnpm lint</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exit 0.
    - `pnpm test -- --run` exit 0.
    - `pnpm test:bdd` exit 0 (non-régression).
    - `pnpm lint` exit 0.
    - `src/web/views/pages/biens/liste.ejs` contient `include('../../partials/empty-state'`.
    - `src/web/views/pages/locataires/liste.ejs` contient `include('../../partials/empty-state'`.
    - `src/web/views/pages/baux/liste.ejs` contient les 3 empty states (assertion : 3 greps : `Impossible de créer un bail`, `Aucun bail pour l'instant`, `breadcrumbs`).
    - `src/web/views/pages/biens/detail.ejs` contient `bien.adresse.enLigne()` dans breadcrumbs.
    - `src/web/views/pages/baux/detail.ejs` contient `formatDate` ET `formatMoney`.
    - `src/main.ts` contient `addHook('preHandler'` ET `formatDate` ET `formatMoney`.
    - Test manuel a11y : Lighthouse Accessibility ≥ 90 sur /wizard/bien, /biens, /baux/:id (consigner dans SUMMARY).
  </acceptance_criteria>
  <done>Toutes les pages Phase 1 utilisent une UI unifiée : layout sidebar+breadcrumbs+banniere, empty-state partial cohérent (UI-SPEC EXACT), helpers formatDate/formatMoney en EJS locals injectés par hook global. Audit a11y manuel passe sur les 3 pages clés. La Phase 1 est UI-complete.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| EJS template render | Insertion `<%= %>` (escape) vs `<%- %>` (raw). Risque XSS si raw avec input utilisateur. |
| `req.session.banniereSuccess` | String contrôlée serveur uniquement (jamais bound depuis user input direct). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-01 | Tampering | XSS via `<%- %>` raw insertion | mitigate | Audit du code : tous les `<%- %>` doivent insérer du HTML maîtrisé (partials includes uniquement) ; jamais d'input utilisateur. User content toujours via `<%= %>` (escape natif EJS). |
| T-07-02 | Tampering | session.banniereSuccess injecté côté serveur | mitigate | Toujours set via use case / route handler avec chaînes constantes. Jamais avec input user direct. |
| T-07-03 | Information Disclosure | CSS custom expose des couleurs Pico custom props | accept | CSS public, pas de fuite. |
</threat_model>

<verification>
- `pnpm typecheck` exit 0
- `pnpm test -- --run` exit 0
- `pnpm test:bdd` exit 0
- `pnpm lint` exit 0, 0 warning
- `pnpm lint:deps` exit 0
- Test manuel : naviguer `/biens` DB vide → empty state EXACT UI-SPEC affiché
- Test manuel : naviguer `/baux` avec DB vide → empty state "Impossible de créer un bail" avec CTA "Créer un bien"
- Test manuel : créer Bien+Locataire+Bail via wizard → `/baux/:id` → breadcrumbs "Baux > Bail de Marie Dupont", date "01/06/2026", loyer "800,00 €"
- Test manuel a11y Lighthouse sur 3 pages → score ≥ 90, 0 violation critique
- Sidebar nav : item actif a `aria-current="page"` ET border accent visible
</verification>

<success_criteria>
La couche UI Phase 1 est **cohérente, accessible et testée** :
- Format français omniprésent (dates DD/MM/YYYY, montants 800,50 €) via helpers réutilisables et testés.
- Empty states homogènes avec textes UI-SPEC EXACTS via partial `empty-state`.
- Sidebar nav + breadcrumbs sur toutes les pages non-wizard via partials.
- A11y validée Lighthouse ≥ 90 sur 3 pages clés.
- CSS custom minimal (< 100 lignes) complétant Pico classless — pas de framework lourd.

Phase 2 (Quittancement) peut bâtir sur ces fondations UI : ajouter `quittances/liste.ejs` consomme `empty-state` et `formatMoney` sans dupliquer.

**Phase 1 sera officiellement UI-complete** lorsque ce plan termine en vert + Plan 06 (wizard) termine en vert.
</success_criteria>

<output>
Créer `.planning/phases/01-activation-bien-locataire-bail/01-07-ui-polish-SUMMARY.md`. Lister :
- Tests unit helpers verts (4 + 4)
- Screenshots ou scores Lighthouse Accessibility des 3 pages clés
- Liste des violations critiques éventuelles (objectif : 0)
- Confirmation que les 4 partials sont utilisés par toutes les pages Phase 1 (matrix partial × page)
- Inventaire CSS app.css (lignes utilisées vs total — KISS check)
</output>

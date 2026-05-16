---
phase: 03
plan: 05
plan_id: "03-05"
type: execute
wave: 5
depends_on: ["03-01", "03-02", "03-03", "03-04"]
files_modified:
  - src/web/views/partials/sidebar-nav.ejs
  - src/web/views/partials/partial-badge-dpe.ejs
  - src/web/views/partials/partial-diagnostic-row.ejs
  - src/web/views/partials/partial-edl-form.ejs
  - src/web/views/partials/partial-inventaire-display.ejs
  - src/web/views/partials/partial-inventaire-warnings.ejs
  - src/web/views/partials/partial-indexation-banner.ejs
  - src/web/views/partials/wizard-irl-layout.ejs
  - src/web/views/pages/biens/detail.ejs
  - src/web/views/pages/biens/diagnostics/formulaire.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/pages/baux/formulaire.ejs
  - src/web/views/pages/baux/edl/entree.ejs
  - src/web/views/pages/baux/edl/sortie.ejs
  - src/web/views/pages/baux/edl/formulaire.ejs
  - src/web/views/pages/baux/indexer/saisie.ejs
  - src/web/views/pages/baux/indexer/simulation.ejs
  - src/web/views/pages/baux/indexer/confirmation.ejs
  - src/web/views/pages/baux/indexer/gel-loyer.ejs
  - src/web/public/styles/print.css
  - tests/integration/web/accessibility-phase3.test.ts
  - tests/integration/web/snapshots-phase3.test.ts
  - tests/bdd/features/accessibilite-phase3.feature
  - tests/bdd/step_definitions/accessibilite-phase3.steps.ts
autonomous: false
requirements: []

mvp_split_rationale: |
  Plan cross-cutting de finition Phase 3 — audit WCAG 2.1 AA, print/PDF, empty states, sidebar
  active state, snapshot views, BDD accessibilité. Pas de nouveau REQ couvert (cross-cutting
  des 5 REQs PAT-03/LOC-03/LOC-04/LOC-05/LOC-06). Inclut un checkpoint human-verify pour
  validation visuelle (UI-SPEC compliance) avant clôture Phase 3 — non bloquant si l'utilisateur
  approuve. Wave 5 séquentiel après 03-01..03-04 (audit transversal de l'ensemble).

must_haves:
  truths:
    - "Aucun nouveau lien top-level dans sidebar-nav.ejs (UI-SPEC §Sidebar — D-40 sobriété)."
    - "État navActive correctement appliqué : 'biens' actif sur /biens/:id/diagnostics/* et 'baux' actif sur /baux/:id/edl/* + /baux/:id/indexer/*."
    - "WCAG 2.1 AA conformité : partial-badge-dpe avec aria-label sur les 8 cas + texte visible (jamais couleur seule WCAG 1.4.1), contrast 4.5:1 vérifié (couleurs UI-SPEC L101-114 déjà désignées conformes)."
    - "Wizard IRL : <ol aria-label='Étapes de la révision IRL'> + <li aria-current='step'> sur étape courante (UI-SPEC §LOC-04 §A11y)."
    - "Wizard IRL focus management : à l'arrivée sur saisie.ejs / simulation.ejs / confirmation.ejs, focus auto sur le <h1> ou <form> (autofocus + tabindex='-1' sur le conteneur). Gel-loyer.ejs : focus auto sur le bloc role='alert'."
    - "role='alert' + aria-live='assertive' sur gel-loyer.ejs (déjà créé 03-03 — vérifier strict)."
    - "role='status' sur banniere-success après application IRL (déjà partial Phase 2)."
    - "Tables avec aria-label : diagnostics + IRL historique + inventaire display (déjà créées 03-01/03-04 — vérifier strict)."
    - "<fieldset><legend>Mobilier obligatoire (décret 2015-981)</legend> dans formulaire Bail + EDL (déjà créé 03-02 — vérifier strict)."
    - "Print/PDF : @media print stylesheet `public/styles/print.css` — masque sidebar, navigation, boutons formulaire ; affiche en pleine page les sections EDL display + diagnostics + historique IRL. Imprimable proprement (pas de double-page, pas de couleur background dégradée)."
    - "Empty states audités sur 5 variants (UI-SPEC §Empty States) : aucun diagnostic, pas EDL entrée, pas EDL sortie, aucune indexation IRL, classe DPE non renseignée. Tous ont heading + body + CTA (D-43 Phase 1)."
    - "Helper formaterTrimestreIRL fully testé (créé 03-03, vérifié ici via snapshot test sur simulation.ejs)."
    - "Snapshot tests sur views nouvelles Phase 3 (5 pages clés) — détecte régression visuelle accidentelle (changement de classes Pico.css ou suppression de partials)."
    - "BDD @a11y-phase3 : 4 scenarios verts couvrant tab navigation wizard IRL, focus management gel, fieldset legend mobilier, table aria-label diagnostics."
    - "Checkpoint human-verify : développeur valide visuellement (browser ou screenshots) les 8 vues nouvelles Phase 3 + comportements interactifs critiques (DPE badge couleurs, wizard step indicator, banner gel) avant clôture."
  artifacts:
    - path: "src/web/public/styles/print.css"
      provides: "Stylesheet @media print — masquer nav/sidebar/boutons, layout pleine page pour EDL/diagnostics/historique"
    - path: "tests/integration/web/accessibility-phase3.test.ts"
      provides: "Tests intégration WCAG sur les 8 vues Phase 3 (assertions DOM : aria-label, role, focus management)"
    - path: "tests/integration/web/snapshots-phase3.test.ts"
      provides: "Snapshot tests sur 5 vues clés Phase 3 (détection régression visuelle)"
    - path: "tests/bdd/features/accessibilite-phase3.feature"
      provides: "Scenarios BDD a11y end-to-end (clavier tab, focus, aria)"
  key_links:
    - from: "src/web/public/styles/print.css"
      to: "src/web/views/partials/layout-debut.ejs"
      via: "<link rel='stylesheet' href='/public/styles/print.css' media='print'> dans layout-debut"
      pattern: "media='print'"
    - from: "tests/integration/web/accessibility-phase3.test.ts"
      to: "src/web/views/partials/partial-badge-dpe.ejs"
      via: "Render badge avec classes A..G + null → assert aria-label présent + texte visible"
      pattern: "aria-label"
    - from: "src/web/views/partials/sidebar-nav.ejs"
      to: "src/web/views/partials/layout-debut.ejs"
      via: "navActive locals injecté → sidebar-nav set aria-current='page' (déjà pattern Phase 1)"
      pattern: "navActive"
---

<objective>
Plan cross-cutting de finition Phase 3 : audit accessibilité WCAG 2.1 AA, print/PDF stylesheet, empty states audit, sidebar active state validation, snapshot tests pour détection régression, BDD a11y end-to-end, checkpoint human-verify pour validation visuelle UI-SPEC compliance.

Purpose: Phase 3 a livré 4 vertical slices (PAT-03/LOC-03/LOC-04/LOC-05/LOC-06) avec leurs vues et partials. Ce plan vérifie la cohérence cross-vues : pas de régression a11y, pas de sidebar cassée, empty states uniformes, impression propre, focus management correct sur le wizard IRL et le bloc gel.
Output: Stylesheet print + extension partials avec a11y stricte + 2 fichiers tests + 1 feature BDD + checkpoint human-verify final.
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-01-diagnostics-PLAN.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-02-edl-mobilier-PLAN.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-03-irl-simulation-PLAN.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-04-irl-apply-avenant-PLAN.md
@.planning/phases/01-activation-bien-locataire-bail/01-07-ui-polish-PLAN.md
@.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md
@CLAUDE.md
@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md
@src/web/views/partials/sidebar-nav.ejs
@src/web/views/partials/layout-debut.ejs
@src/web/views/partials/layout-fin.ejs
@src/web/views/partials/empty-state.ejs
@src/web/views/partials/banniere-warning.ejs
@src/web/views/partials/banniere-success.ejs
@src/web/views/partials/form-field.ejs
@src/web/views/partials/data-table.ejs
</context>

<interfaces>
Conventions a11y opposables (Phase 1 D-44 + WCAG 2.1 AA) appliquées Phase 3 :

- **WCAG 1.4.1** (couleur jamais seule) : DPE badge avec texte 'DPE A' + couleur + aria-label.
- **WCAG 1.4.3** (contraste 4.5:1) : palette UI-SPEC L101-114 déjà désignée conforme (fournisseur Tailwind colors).
- **WCAG 2.1.1** (clavier nav) : wizard IRL entièrement tabulable, boutons natifs `<button type="submit">`, liens natifs `<a>`.
- **WCAG 2.4.3** (ordre logique tab) : ordre UI-SPEC §A11y L367-373 : breadcrumb → indicateur étapes → contenu → boutons d'action → sidebar (en dernier via tabindex naturel layout).
- **WCAG 4.1.2** (state/properties) : aria-current='step' sur étape active wizard ; aria-current='page' sur sidebar active.
- **WCAG 4.1.3** (status messages) : role='status' aria-live='polite' sur banniere-success ; role='alert' aria-live='assertive' sur gel-loyer.ejs.

Pattern Phase 1 D-40 sidebar :
- `navActive` locals injecté par chaque route (ex: `navActive: 'biens'`).
- `sidebar-nav.ejs` itère les links + applique `aria-current="page"` sur celui correspondant à navActive.
- Phase 3 : pas de nouveau top-level (D-40 sobriété — UI-SPEC §Sidebar décision retenue Discretion). 'Diagnostics' accessible depuis fiche Bien, EDL/IRL depuis fiche Bail.

Pattern Phase 1 D-43 empty-state :
- Partial `empty-state.ejs` accepte `{ heading, body, ctaHref, ctaLabel }`.
- Phase 3 utilise pour 5 variants UI-SPEC §Empty States.

Pattern Phase 1 D-44 print :
- Phase 1 n'a pas de stylesheet print (différé). Phase 3 ajoute `public/styles/print.css` minimal :
  - Masquer `nav, aside, button[type='submit'], a[role='button']:not(.print-keep)`.
  - Forcer `body { background: white; color: black; }`.
  - `@page { margin: 2cm; }`.
  - Conserver `<table>`, `<dl>`, `<h1>`, `<h2>`, paragraphes.
- Pour servir le CSS : extension `src/main.ts` si pas déjà `app.register(fastifyStatic, { root: ..., prefix: '/public/' })`. Pattern Phase 1 / vérifier l'existant.

Snapshot tests Phase 3 (Vitest + supertest pattern Phase 1) :
- Render 5 vues : `biens/diagnostics/formulaire.ejs`, `baux/edl/entree.ejs` (état rempli), `baux/edl/sortie.ejs` (avec warnings delta), `baux/indexer/simulation.ejs`, `baux/indexer/gel-loyer.ejs`.
- `expect(html).toMatchSnapshot();` — accepte les changements intentionnels via `--update` mais détecte les régressions silencieuses.

BDD a11y :
- Réutilise Cucumber + supertest `app.inject({ url: '...' })` + parsing HTML pour assertions (pattern Phase 1/2).
- Tag `@a11y-phase3`.
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Audit + extension partials/views — sidebar active state, aria-label sur tables, fieldset legend mobilier, focus management wizard, role=alert gel</name>
  <read_first>
    - src/web/views/partials/sidebar-nav.ejs (état actuel — vérifier navActive pattern)
    - src/web/views/partials/layout-debut.ejs (où ajouter <link print.css>)
    - src/web/views/partials/partial-badge-dpe.ejs (créé 03-01 — vérifier aria-label sur les 8 cas)
    - src/web/views/partials/partial-diagnostic-row.ejs (créé 03-01)
    - src/web/views/partials/partial-edl-form.ejs (créé 03-02 — vérifier fieldset/legend)
    - src/web/views/partials/partial-inventaire-display.ejs (créé 03-02 — vérifier table aria-label)
    - src/web/views/partials/partial-inventaire-warnings.ejs (créé 03-02 — vérifier aria-live)
    - src/web/views/partials/partial-indexation-banner.ejs (créé 03-03 — vérifier role='status' aria-live='polite')
    - src/web/views/partials/wizard-irl-layout.ejs (créé 03-03 — vérifier <ol aria-label> + aria-current='step')
    - src/web/views/pages/baux/indexer/gel-loyer.ejs (créé 03-03 — vérifier role='alert' aria-live='assertive' + autofocus + tabindex='-1')
    - src/web/views/pages/baux/indexer/saisie.ejs + simulation.ejs + confirmation.ejs (créés 03-03/03-04 — vérifier focus auto sur <h1>)
    - src/web/views/pages/biens/detail.ejs (vérifier table diagnostics aria-label après extension 03-01)
    - src/web/views/pages/baux/detail.ejs (vérifier sections aria-labelledby + table historique IRL aria-label après extensions 03-02/03-04)
    - src/web/views/pages/baux/formulaire.ejs (vérifier fieldset/legend mobilier après extension 03-02)
    - ACCESSIBILITY.md (référence WCAG 2.1 AA — checklist applicable)
    - UI_DESIGN.md (référence Gestalt + couleur)
    - UX_DESIGN.md (Hick / Fitts / focus management)
  </read_first>
  <action>
    Audit séquentiel des fichiers EJS créés/modifiés en 03-01..03-04. Pour chaque partial/view, vérifier conformité WCAG 2.1 AA + UI-SPEC §A11y.

    1. ÉTENDRE `src/web/views/partials/layout-debut.ejs` :
       - Ajouter `<link rel="stylesheet" href="/public/styles/print.css" media="print">` dans le `<head>` (AVANT `</head>`).
       - Vérifier que l'import existant Pico.css est en `media="screen,print"` ou similaire (par défaut Pico.css gère bien le print).

    2. AUDIT `src/web/views/partials/sidebar-nav.ejs` :
       - Vérifier qu'aucun nouveau top-level n'a été ajouté en 03-01..03-04 (UI-SPEC §Sidebar décision Discretion).
       - Si erreur : SUPPRIMER les éventuels liens ajoutés.
       - Confirmer pattern `aria-current="page"` quand `navActive === lienId`.
       - Doc : ajouter un commentaire EJS au-dessus du nav pour rappeler la décision UI-SPEC §Sidebar Phase 3.

    3. AUDIT `src/web/views/partials/partial-badge-dpe.ejs` (créé 03-01) :
       - Vérifier `aria-label="Classe DPE : <%= classe ?? 'non renseignée' %>"` sur tous les 8 cas (A,B,C,D,E,F,G,null).
       - Vérifier texte visible `DPE A` (jamais juste la couleur).
       - Vérifier contrast 4.5:1 (UI-SPEC L101-114 a déjà fait le calcul — couleurs Tailwind certifiées).
       - Si pas conforme : étendre le partial.

    4. AUDIT `src/web/views/partials/partial-diagnostic-row.ejs` (créé 03-01) :
       - Vérifier que le statut "Expiré le..." utilise texte rouge ET text "Expiré" (jamais couleur seule).
       - Vérifier `class="row-warning"` ne dépend pas que de la couleur background — préférer ajouter un icône texte `⚠` avec `aria-hidden="true"` (UI-SPEC §Visuals icon library).

    5. AUDIT `src/web/views/partials/partial-edl-form.ejs` (créé 03-02) :
       - Vérifier `<fieldset><legend>Inventaire mobilier (décret 2015-981) — 12 items obligatoires</legend>`.
       - Vérifier chaque `<input type="checkbox">` a un `<label for>` (ID unique).
       - Vérifier que le `<select etat>` est `disabled` si `present === false` (UI-SPEC §A11y L357).

    6. AUDIT `src/web/views/partials/partial-inventaire-display.ejs` (créé 03-02) :
       - Vérifier `<table role="table" aria-label="Inventaire mobilier (12 items décret 2015-981)">` + `<caption class="sr-only">`.

    7. AUDIT `src/web/views/partials/partial-inventaire-warnings.ejs` (créé 03-02) :
       - Vérifier `<aside role="status" aria-live="polite">` (les warnings sont rendus avec la page, polite suffit).

    8. AUDIT `src/web/views/partials/partial-indexation-banner.ejs` (créé 03-03) :
       - Vérifier `role="status" aria-live="polite"` (banner informatif, non bloquant).

    9. AUDIT `src/web/views/partials/wizard-irl-layout.ejs` (créé 03-03) :
       - Vérifier `<nav aria-label="Étapes de la révision IRL">`.
       - Vérifier `<ol>` contient `<li aria-current="step">` UNIQUEMENT sur l'étape courante.
       - Vérifier que les étapes non courantes n'ont PAS `tabindex="-1"` (elles ne sont pas interactives — pas de focus).
       - Vérifier `<p><small>Étape X sur 5</small></p>` pour les utilisateurs de screen reader.

    10. AUDIT `src/web/views/pages/baux/indexer/gel-loyer.ejs` (créé 03-03) :
        - Vérifier `<section role="alert" aria-live="assertive" autofocus tabindex="-1">` sur le bloc bloquant.
        - Vérifier qu'un seul `<a href>` "Compris" est présent (pas de bypass).
        - Vérifier que le contenu mentionne la classe DPE exacte et le décret n° 2022-1313 (wording UI-SPEC L307).

    11. AUDIT `src/web/views/pages/baux/indexer/saisie.ejs` + `simulation.ejs` + `confirmation.ejs` :
        - Vérifier `<h1>` premier élément visible (focus naturel).
        - LOCKÉ : focus naturel sur le premier élément interactif (PAS de `<h1 tabindex="-1" autofocus>`). Mapping : saisie → focus `<input id="irl_trimestre">`, simulation → focus `<button>Confirmer les valeurs</button>`, confirmation → focus `<button>Appliquer la révision</button>`.
        - Vérifier ordre tab UI-SPEC L367-373.

    12. AUDIT `src/web/views/pages/biens/diagnostics/formulaire.ejs` (créé 03-01) :
        - Vérifier que `<label for>` pointe correctement vers chaque `<input id>`.
        - Vérifier hint `<small>Obligatoire si type = DPE.</small>` est aria-describedby (lié à l'input classe_dpe).

    13. AUDIT `src/web/views/pages/baux/formulaire.ejs` (étendu 03-02) :
        - Vérifier `<fieldset><legend>Mobilier obligatoire (décret 2015-981)</legend>` enveloppant les 12 checkboxes.

    14. AUDIT `src/web/views/pages/baux/detail.ejs` (étendu 03-02 + 03-03 + 03-04) :
        - Vérifier `<section aria-labelledby="diagnostics-heading">` (extension Phase 3-01 si non fait).
        - Vérifier `<section aria-labelledby="edl-heading">` (extension 03-02).
        - Vérifier `<section aria-labelledby="indexations-heading">` (extension 03-04).
        - Vérifier banner révision IRL avec `role="status" aria-live="polite"` (extension 03-03 via partial).
        - Vérifier table historique indexations `<table role="table" aria-label="Historique des révisions IRL"><caption class="sr-only">`.

    15. AUDIT `src/web/views/pages/biens/detail.ejs` (étendu 03-01) :
        - Vérifier `<table role="table" aria-label="Diagnostics du bien"><caption class="sr-only">`.

    16. AUDIT empty states sur les 5 variants (UI-SPEC §Empty States) :
        - Diagnostics : "Aucun diagnostic enregistré" — vérifié 03-01.
        - EDL entrée : "Aucun état des lieux d'entrée" — vérifié 03-02.
        - EDL sortie : "Aucun état des lieux de sortie" — vérifié 03-02.
        - Indexations IRL : "Aucune révision IRL enregistrée" — vérifié 03-04.
        - Classe DPE non renseignée : "Classe DPE non renseignée" — ajouter inline dans section Diagnostics fiche Bien si pas fait.
        - Tous utilisent `empty-state.ejs` partial avec heading + body + CTA.

    Commit : `fix(03-05): audit a11y WCAG 2.1 AA — fieldset legend, aria-label tables, focus management wizard, role alert gel, sidebar navActive Phase 3`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && grep -l 'aria-label\|aria-current\|aria-live\|role=' src/web/views/partials/partial-badge-dpe.ejs src/web/views/partials/wizard-irl-layout.ejs src/web/views/pages/baux/indexer/gel-loyer.ejs && grep -l 'fieldset\|<legend>' src/web/views/partials/partial-edl-form.ejs src/web/views/pages/baux/formulaire.ejs</automated>
  </verify>
  <done>
    - Audit séquentiel des 8 partials Phase 3 + 8 views Phase 3.
    - Corrections appliquées pour conformité WCAG 2.1 AA.
    - layout-debut.ejs étendu avec <link print.css>.
    - sidebar-nav.ejs sans nouveau top-level.
    - 5 empty states variants conformes (heading + body + CTA).
    - Commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 2: Print stylesheet + accessibility tests + snapshot tests + BDD a11y</name>
  <read_first>
    - src/web/public/ (vérifier existence du dossier — sinon créer)
    - src/main.ts (vérifier fastify-static enregistré pour servir /public/ — sinon ajouter)
    - tests/integration/web/ (analog tests intégration web Phase 1/2 si existent)
    - tests/bdd/features/ (analog scenario format)
    - ACCESSIBILITY.md (checklist testing)
    - UI-SPEC.md §A11y complet
  </read_first>
  <action>
    1. `src/web/public/styles/print.css` (NOUVEAU) :
       - Vérifier que `src/web/public/` existe (créer si absent).
       - Contenu minimal :
         ```
         @media print {
           nav, aside, button[type='submit'], button[type='button'], a[role='button']:not(.print-keep), .no-print {
             display: none !important;
           }
           body {
             background: white !important;
             color: black !important;
             font-size: 12pt;
           }
           main {
             max-width: 100% !important;
             padding: 0 !important;
           }
           a {
             color: black !important;
             text-decoration: underline;
           }
           table {
             border-collapse: collapse;
             width: 100%;
           }
           table, th, td {
             border: 1px solid #333;
             padding: 4px 8px;
           }
           h1, h2, h3 {
             page-break-after: avoid;
           }
           dl, table, ul, ol {
             page-break-inside: avoid;
           }
         }
         @page {
           margin: 2cm;
         }
         ```
       - LOCKÉ : Phase 1/2 a déjà enregistré `fastify-static` (Pico.css est servi statique) — réutiliser cette config existante. Si absente (à vérifier via `grep "fastifyStatic\|fastify-static" src/main.ts`), l'ajouter avec prefix `/public/` dans Task 2 ci-dessous.

    2. ÉTENDRE `src/main.ts` (si nécessaire) :
       - Si fastify-static pas enregistré : `await app.register(fastifyStatic, { root: path.join(rootDir, 'src', 'web', 'public'), prefix: '/public/' });` AVANT les routes plugins.
       - Sinon : confirmer que `/public/styles/print.css` est servi par la config existante.

    3. `tests/integration/web/accessibility-phase3.test.ts` (NOUVEAU) :
       - Pattern Vitest + app.inject() (Phase 1/2 existant).
       - Tests :
         - `it('partial-badge-dpe rend aria-label pour les 8 classes', async () => {...})` : render via app.inject sur une page contenant le badge (ex: GET /biens/:id), parse HTML, vérifier `aria-label="Classe DPE : F"` présent.
         - `it('wizard-irl-layout rend <ol aria-label> + <li aria-current=step>', async () => {...})` : GET /baux/:id/indexer, parse HTML, vérifier `<nav aria-label="Étapes de la révision IRL"><ol>...<li aria-current="step">` présent.
         - `it('gel-loyer.ejs rend role=alert + aria-live=assertive + autofocus', async () => {...})` : Given Bien DPE F, GET /baux/:id/indexer, parse HTML, vérifier `role="alert"` + `aria-live="assertive"` + `autofocus` + `tabindex="-1"`.
         - `it('partial-edl-form rend fieldset + legend Mobilier obligatoire', async () => {...})` : GET /baux/:id/edl/entree/nouveau, parse HTML, vérifier `<fieldset>` contient `<legend>Inventaire mobilier (décret 2015-981) — 12 items obligatoires</legend>`.
         - `it('table diagnostics aria-label présent', async () => {...})` : GET /biens/:id, vérifier `<table` contient `aria-label="Diagnostics du bien"`.
         - `it('table historique indexations aria-label présent', async () => {...})` : GET /baux/:id (avec indexations en DB), vérifier `aria-label="Historique des révisions IRL"`.
         - `it('sidebar navActive=biens marque /biens/:id/diagnostics/nouveau correctement', async () => {...})` : GET /biens/:id/diagnostics/nouveau, vérifier `aria-current="page"` sur le lien Biens.
         - `it('sidebar navActive=baux marque /baux/:id/indexer correctement', async () => {...})` : GET /baux/:id/indexer, vérifier idem sur Baux.

    4. `tests/integration/web/snapshots-phase3.test.ts` (NOUVEAU) :
       - Tests Vitest avec `expect(html).toMatchSnapshot()`.
       - Snapshots :
         - `GET /biens/:id/diagnostics/nouveau` (formulaire vide) → snapshot.
         - `GET /baux/:id/edl/entree` (avec EDL en DB) → snapshot.
         - `GET /baux/:id/edl/sortie` (avec EDL en DB + warnings delta mock) → snapshot.
         - `POST /baux/:id/indexer/simuler` (avec irl valide) → snapshot simulation.ejs.
         - `GET /baux/:id/indexer` (avec Bien DPE F) → snapshot gel-loyer.ejs.
       - Configuration : utiliser `__snapshots__/` à côté ou inline. Documenter dans le test comment regenerate (`pnpm test -u`).

    5. `tests/bdd/features/accessibilite-phase3.feature` (NOUVEAU) :
       - Tag `@a11y-phase3 @phase3`.
       - Scenarios :
         - "Navigation clavier wizard IRL" : Given Bail indexable, ClockFixe, Bien DPE D. When GET /baux/:id/indexer. Then la page contient `<input id="irl_trimestre"` ET les boutons sont des `<button type="submit">` natifs (assertion HTML).
         - "Focus management gel loyer" : Given Bien DPE F. When GET /baux/:id/indexer. Then le bloc avec `role="alert"` contient `autofocus` ET `tabindex="-1"`.
         - "Fieldset legend mobilier formulaire Bail" : When GET /baux/nouveau. Then la page contient `<fieldset>` avec `<legend>Mobilier obligatoire (décret 2015-981)</legend>`.
         - "Sidebar active state diagnostics" : When GET /biens/:id/diagnostics/nouveau. Then le lien sidebar 'Biens' a `aria-current="page"`.

    6. `tests/bdd/step_definitions/accessibilite-phase3.steps.ts` (NOUVEAU) :
       - Before/After `@a11y-phase3`. Steps Given/When/Then propres a11y avec HTML parsing (regex ou cheerio).

    Vérifs : `pnpm test:integration run tests/integration/web/accessibility-phase3.test.ts tests/integration/web/snapshots-phase3.test.ts` VERTS. `pnpm test:bdd -- --tags @a11y-phase3` 4 scenarios VERTS.

    Commit : `test(03-05): print.css + tests intégration a11y + snapshots views + BDD accessibilité Phase 3 (vert)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && pnpm test:integration run tests/integration/web/accessibility-phase3.test.ts tests/integration/web/snapshots-phase3.test.ts && pnpm test:bdd -- --tags @a11y-phase3 && ls src/web/public/styles/print.css tests/bdd/features/accessibilite-phase3.feature</automated>
  </verify>
  <done>
    - Stylesheet print.css avec règles complètes (masquer nav, layout impression).
    - Tests intégration a11y : 8 assertions (partial-badge-dpe, wizard, gel, fieldset, tables, sidebar active).
    - Snapshot tests : 5 vues Phase 3.
    - BDD : 4 scenarios @a11y-phase3 verts.
    - Tous tests existants toujours verts.
    - Commit créé.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Checkpoint human-verify — validation visuelle UI-SPEC Phase 3 (8 vues + flows critiques)</name>
  <files>n/a (vérification visuelle)</files>
  <action>Le développeur démarre `pnpm dev`, visite les 8 vues Phase 3 et confirme que le rendu visuel est conforme UI-SPEC (badge DPE 7 couleurs, wizard 5 étapes, gel role=alert, EDL fieldset 12 items, banner révision IRL, historique indexations, empty states, print preview). Voir <how-to-verify> pour la liste détaillée.</action>
  <what-built>
    Phase 3 complète : 4 vertical slices (Diagnostics PAT-03 + EDL/Mobilier LOC-03+LOC-06 + IRL simulation LOC-04 + gel LOC-05 + IRL apply LOC-04) + audit a11y Phase 3-05.

    Composants principaux à vérifier visuellement :
    1. Badge DPE coloré sur fiche Bien (les 7 couleurs A-G + 1 cas null).
    2. Formulaire EDL avec checklist 12 items.
    3. Warnings delta inventaire sur fiche EDL sortie.
    4. Banner révision IRL sur fiche Bail à la date anniversaire.
    5. Wizard IRL 5 étapes (saisie → simulation → confirmation → résultat).
    6. Bloc gel loyer DPE F/G (page bloquante avec role=alert).
    7. Historique des indexations IRL avec lien téléchargement avenant PDF.
    8. Empty states sur les 5 variants (Diagnostics, EDL entrée, EDL sortie, IRL, DPE non renseigné).
  </what-built>
  <how-to-verify>
    Démarrer l'application locale :
    ```
    pnpm dev
    ```
    Visiter http://127.0.0.1:{PORT}/ (port défini dans `.env` ou config Phase 1).

    Vérifications à effectuer :

    1. **Diagnostics (PAT-03)** :
       - Créer un Bien → vérifier que la section Diagnostics affiche l'empty state "Aucun diagnostic enregistré" avec CTA "Ajouter un diagnostic".
       - Cliquer le CTA → vérifier le formulaire avec select Type (4 options), date d'émission, select Classe DPE (visible mais hint "obligatoire si type=DPE").
       - Sélectionner type=DPE sans classe → vérifier message d'erreur inline "La classe DPE est obligatoire pour un diagnostic DPE.".
       - Soumettre DPE valide classe=D → vérifier badge "DPE D" jaune sur la fiche Bien + ligne dans la table diagnostics.
       - Ajouter un 2e DPE classe=F → vérifier que badge passe en rouge "DPE F — Gel loyer Climat".
       - Ajouter un diagnostic gaz date_emission > 6 ans → vérifier badge rouge "Expiré le ..." + banniere-warning non bloquante en haut de la section.

    2. **EDL + Mobilier (LOC-03 + LOC-06)** :
       - Créer un Bail (mobilier décret 2015-981 visible avec 12 checkboxes pré-cochées) → décocher 1 item → soumettre → vérifier banniere-warning "Attention : 1 élément(s) obligatoire(s) du décret 2015-981...".
       - Accéder à la fiche Bail → section "État des lieux" avec 2 empty states (entrée + sortie) → cliquer "Enregistrer l'EDL d'entrée".
       - Formulaire EDL avec fieldset "Inventaire mobilier (12 items)" + checkbox contradictoire + date_signature conditionnelle → soumettre EDL entrée complet.
       - Faire de même pour EDL sortie en marquant 2 items absents et 1 item dégradé → vérifier sur la page EDL sortie les warnings delta affichés (2 WARNING_ITEM_DISPARU + 1 WARNING_ITEM_DEGRADE).

    3. **IRL simulation + gel (LOC-04 + LOC-05)** :
       - Sur un bail avec Bien DPE D, attendre la date anniversaire (modifier `clock` via ClockFixe si besoin) → vérifier banner "Révision IRL disponible depuis le {date}".
       - Cliquer "Lancer la révision IRL" → wizard étape 2 (saisie IRL avec 2 inputs trimestre+valeur).
       - Saisir IRL valide → vérifier étape 3 (simulation) avec tableau comparatif (loyer avant, IRL avant, IRL après, nouveau loyer, formule).
       - Cliquer "Confirmer les valeurs" → étape 4 (confirmation avec 2 boutons + paragraphe D-95 exact wording).
       - Sur un bail avec Bien DPE F → vérifier que GET /baux/:id/indexer affiche le bloc gel role=alert + bouton "Compris" (PAS de formulaire de saisie).

    4. **IRL apply (LOC-04 apply)** :
       - Étape 4 → cliquer "Appliquer la révision" → vérifier redirect vers /baux/:id + banniereSuccess + nouveau loyer + section historique avec 1 ligne + lien "Télécharger PDF".
       - Cliquer "Télécharger PDF" → vérifier téléchargement du fichier avenant-{bailId8}-{date}.pdf + ouvrir le PDF + vérifier mentions loi 89 art. 17-1 + nom bailleur + nom locataire + nouveau loyer.
       - Recommencer le wizard puis cliquer "Ne pas indexer cette année" → vérifier banniereSuccess "Révision IRL non appliquée" + ligne dans historique avec Motif "Choix du bailleur" + pas de lien PDF.

    5. **A11y (03-05)** :
       - Naviguer le wizard IRL uniquement au clavier (Tab) → vérifier ordre logique.
       - Sur la page gel loyer → vérifier que le bloc role=alert prend le focus automatiquement.
       - Inspecter le DOM (devtools) sur fiche Bien → vérifier `aria-label="Classe DPE : F"` sur le badge.
       - Imprimer la fiche Bail (Ctrl+P → preview) → vérifier que sidebar et boutons sont masqués, contenu principal sur pleine largeur.

    Si tout est conforme, taper "approved" pour clôturer Phase 3.
    Si problèmes, lister les écarts avec UI-SPEC pour itération.
  </how-to-verify>
  <resume-signal>Type "approved" si tout est OK, ou décris les écarts avec UI-SPEC.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigateur user → Fastify GET /public/styles/print.css | Fichier statique servi par fastify-static — pas d'input user |
| Tests intégration → app.inject() | Mêmes contrôles qu'une requête HTTP — Fastify pipeline intact |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03-05-01 | Information disclosure | fastify-static peut servir des fichiers hors `public/` (path traversal) | LOW | mitigate | fastify-static par défaut sécurisé (refuse `../`). Vérifier configuration `prefix: '/public/'` strict. |
| T-03-05-02 | DoS — snapshot test consomme beaucoup de mémoire | render 5 vues complètes → mémoire ~50MB par test | LOW | accept | Tests CI mono-process, tolérable. |
| T-03-05-03 | Print CSS leak — styles écran apparaissent à l'impression | régression visuelle silencieuse | LOW | mitigate | Tests snapshot détectent les changements UI ; tests integration vérifient `<link media="print">`. |
</threat_model>

<verification>
- `pnpm tsc --noEmit` exit 0
- `pnpm lint` 0 warning
- `pnpm test:integration run tests/integration/web/accessibility-phase3.test.ts` 8+ tests VERTS
- `pnpm test:integration run tests/integration/web/snapshots-phase3.test.ts` 5 snapshots VERTS
- `pnpm test:bdd -- --tags @a11y-phase3` 4 scenarios PASSED
- Aucun nouveau top-level sidebar Phase 3 (D-40 sobriété)
- 5 empty states variants présents et conformes UI-SPEC
- print.css minimaliste servi via fastify-static
- Pas de régression Phase 1/2/3-01..04 : `pnpm test` complet VERT
- Checkpoint human-verify : développeur a approuvé la conformité UI-SPEC
</verification>

<success_criteria>
- Phase 3 conformité WCAG 2.1 AA vérifiée pour les 8 vues nouvelles.
- Print/PDF style propre (sidebar masquée à l'impression).
- Snapshot tests détectent régression visuelle accidentelle.
- BDD a11y end-to-end couvre les 4 patterns critiques (wizard, gel, fieldset, sidebar active).
- Empty states uniformes sur 5 variants (D-43 Phase 1 + UI-SPEC §Empty States).
- Sidebar Phase 3 cohérente avec D-40 sobriété (pas de nouveau top-level).
- Helper formaterTrimestreIRL utilisé dans simulation.ejs + table historique (validé snapshot).
- Checkpoint human-verify : développeur a confirmé visuellement Phase 3.
- Tous les 26 D-decisions (D-75..D-101) et 7 DP-decisions (DP-14..DP-20) référencés et implémentés dans les 5 plans Phase 3.
</success_criteria>

<output>
After completion, create `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-05-SUMMARY.md` listant :
- 3 commits (audit a11y / tests + print.css / checkpoint approval log)
- Audit final : conformité WCAG 2.1 AA + UI-SPEC § Color/Typography/Spacing
- Patterns établis : print stylesheet minimal réutilisable Phase 4+, snapshot tests pour détection régression silencieuse, BDD a11y avec assertions HTML parsing (cheerio si ajouté)
- Phase 3 complète : 5 plans / 5 waves séquentielles / 26 D-decisions + 7 DP-decisions tous référencés
- Préparation Phase 4 : Coffre documentaire pourra ajouter les PDF EDL (différé D-87) avec le même pattern stockage local + path traversal protection mis en place 03-04
- Notes éventuelles d'écarts UI-SPEC après checkpoint human-verify (si itérations nécessaires)
</output>

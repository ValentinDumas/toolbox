---
phase: 01-activation-bien-locataire-bail
plan: 06
type: execute
wave: 5
depends_on: [01-05]
files_modified:
  - src/infrastructure/lifecycle/premier-lancement.ts
  - src/web/routes/wizard.ts
  - src/web/routes/racine.ts
  - src/web/schemas/wizard-schemas.ts
  - src/web/views/partials/wizard-layout.ejs
  - src/web/views/pages/wizard/bien.ejs
  - src/web/views/pages/wizard/locataire.ejs
  - src/web/views/pages/wizard/bail.ejs
  - src/main.ts
  - .env.example
  - tests/bdd/features/activation.feature
  - tests/bdd/step_definitions/activation.steps.ts
  - tests/integration/lifecycle/premier-lancement.test.ts
autonomous: true
requirements: [PAT-01, PAT-02, LOC-01, LOC-02]
tags: [wizard, activation, session, first-launch, ux, bdd]

must_haves:
  truths:
    - "Au premier lancement (table `meta` ne contient pas `wizard_complete`), GET / redirige vers /wizard/bien."
    - "Le wizard suit 3 étapes séquentielles : Bien (+Lots) → Locataire → Bail."
    - "Les données saisies aux étapes 1 et 2 sont persistées en DB immédiatement après chaque submit valide."
    - "L'étape 3 (Bail) consomme les IDs Bien + Locataire créés aux étapes précédentes via session cookie."
    - "Après step 3 réussi, `meta.wizard_complete = '1'` est posé ; futur GET / redirige vers /biens."
    - "Le step indicator (UI-SPEC §Wizard Shell) affiche les 3 étapes avec aria-current sur l'active."
    - "Les CTAs sont EXACTS : 'Enregistrer le bien' (étape 1), 'Enregistrer le locataire' (étape 2), 'Enregistrer le bail et terminer' (étape 3)."
    - "Le scenario BDD complet 'Activation premier lancement bout-en-bout' passe (KPI Activation §5 ROADMAP atteint)."
    - "Session cookie utilise SESSION_SECRET 32+ chars (fail-fast si absent — DP-05)."
  artifacts:
    - path: "src/web/routes/wizard.ts"
      provides: "3 routes GET + 3 routes POST wizard"
      exports: ["plugin"]
    - path: "src/web/views/partials/wizard-layout.ejs"
      provides: "Layout wizard avec step indicator (UI-SPEC §Wizard Shell)"
    - path: "tests/bdd/features/activation.feature"
      provides: "Scenarios étendus : parcours wizard complet 3 étapes + second lancement + non-régression plan 02"
  key_links:
    - from: "src/web/routes/racine.ts"
      to: "src/infrastructure/lifecycle/premier-lancement.ts"
      via: "GET / utilise estPremierLancement pour router vers /wizard ou /biens"
      pattern: "estPremierLancement"
    - from: "src/web/routes/wizard.ts"
      to: "src/application/patrimoine/creer-bien.ts"
      via: "Wizard step 1 invoke creerBien use case"
      pattern: "creerBien\\("
    - from: "src/web/routes/wizard.ts (POST /wizard/bail)"
      to: "src/infrastructure/lifecycle/premier-lancement.ts (marquerWizardComplete)"
      via: "Pose flag après succès step 3"
      pattern: "marquerWizardComplete"
---

<objective>
Câbler le **wizard d'activation 3 étapes** (D-39) qui transforme l'application Phase 1 d'un outil admin froid en une expérience guidée premier lancement. Sans ce wizard, l'utilisateur fraîchement installé tombe sur 3 listes vides et doit deviner l'ordre. Avec le wizard, il est conduit pas-à-pas pour aboutir au KPI Activation §5 ROADMAP : 1 Bien + 1 Locataire + 1 Bail visibles en une session.

**Slice MVP utilisateur :** En tant que bailleur installant l'app pour la première fois, je lance `pnpm dev`, j'ouvre le navigateur, je suis automatiquement guidé vers une page "Étape 1 sur 3 : Créer votre premier bien" avec un step indicator visible, je remplis, je clique "Enregistrer le bien" → step 2 Locataire, je remplis, je clique "Enregistrer le locataire" → step 3 propose la pré-sélection du Bien + Locataire que je viens de créer + checkboxes des Lots du Bien, je complète conditions financières et IRL, je clique "Enregistrer le bail et terminer" → redirigé vers `/biens` avec banner succès et la liste affiche le Bien créé.

Purpose: Boucler PAT-01 + PAT-02 + LOC-01 + LOC-02 dans un parcours unique mesurable par le KPI Activation. Implémente DP-05 (session) et DP-06 (premier lancement). Sans ce wizard, le KPI Activation est techniquement atteignable mais l'UX premier-use est dégradée.
Output: 3 routes GET + 3 POST wizard, 3 pages EJS, 1 partial wizard-layout (step indicator), schemas Zod, session cookie configurée, scenarios BDD étendus verts, test intégration `premier-lancement`.
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
@DDD.md
@BDD_PRACTICES.md

<interfaces>
Use cases existants (à invoquer depuis routes wizard, ne rien modifier dans leur signature) :
- `creerBien(commande, bienRepo): Promise<BienId>` (Plan 02-03)
- `creerLocataire(commande, locataireRepo): Promise<LocataireId>` (Plan 04)
- `creerBail(commande, bailRepo, bienRepo, locataireRepo): Promise<BailId>` (Plan 05)

Lifecycle existant (créé plan 02) :
- `estPremierLancement(db): Promise<boolean>` — true si SELECT meta WHERE cle='wizard_complete' retourne null
- `marquerWizardComplete(db): Promise<void>` — INSERT OR REPLACE INTO meta('wizard_complete', '1')

Nouveau (à créer ou étendre) :
- Session config Fastify (`@fastify/session` + secret env, fail-fast)
- Route plugin `wizard.ts` exposant 3 GET + 3 POST
- 3 pages EJS wizard + 1 partial wizard-layout
- Schemas Zod (réutilise + minor extension : `wizardBailSchema` sans bienId/locataireId qui viennent de session)
- Étendre route `racine.ts` (plan 02 fait redirect stub vers /biens — ici on remplace par branchement réel)
- Test intégration `premier-lancement.test.ts`
- Scenarios BDD étendus : premier lancement complet, second lancement (wizard non affiché), carryover plan 02
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests BDD étendus + test intégration premier-lancement (rouges)</name>
  <files>
    tests/bdd/features/activation.feature,
    tests/bdd/step_definitions/activation.steps.ts,
    tests/integration/lifecycle/premier-lancement.test.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-39, DP-05, DP-06
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Wizard Shell" + §"Wizard State"
    - tests/bdd/features/activation.feature (plan 02 — étendre, conserver scenario existant intact)
    - tests/bdd/step_definitions/activation.steps.ts (plan 02 — étendre world Cucumber : cookie jar, GET/POST séquentiels)
    - BDD_PRACTICES.md §2 + §5 (outside-in)
  </read_first>
  <behavior>
    `activation.feature` aura ≥ 3 scenarios :

    1. Scenario plan 02 "L'utilisateur crée un Bien avec un Lot lors du premier lancement" — préservé tel quel.

    2. Scenario nouveau "L'utilisateur traverse le wizard complet en une session" :
    - Given application premier lancement (table meta vide).
    - When visite "/" → redirigé vers "/wizard/bien", page affiche "Créer votre premier bien", step indicator "Étape 1 sur 3".
    - When soumet form Bien (12 rue des Lilas, 75020 Paris, 45m², appartement, 1985, 1 lot Appartement principal) → redirigé "/wizard/locataire", page "Créer le locataire", step indicator "Étape 2 sur 3", SQLite bien=1 row.
    - When soumet form Locataire (Marie Dupont, marie@example.fr, 1985-06-15, Paris/France, française, 0102030405, 12 rue des Lilas, 75020 Paris) → redirigé "/wizard/bail", page "Créer le bail", step indicator "Étape 3 sur 3", form pré-sélectionne Bien et Locataire, SQLite locataire=1 row.
    - When soumet form Bail (loyer 800 €, charges 50 € forfait, dépôt 800 €, IRL 2026-T1 / 145.47, début 2026-06-01, durée 12 mois) → redirigé "/biens", SQLite bail=1 row + bail_lots=1 row + meta.wizard_complete='1', liste Biens affiche "12 rue des Lilas", banner "Bail enregistré avec succès."

    3. Scenario nouveau "Au second lancement, le wizard n'est plus affiché" :
    - Given application wizard déjà complété (meta.wizard_complete='1').
    - When visite "/" → redirigé vers "/biens" (PAS "/wizard/bien").

    `tests/bdd/step_definitions/activation.steps.ts` (étendre) :
    - World setup : Fastify app + better-sqlite3(":memory:") + migrations + cookie jar persistant (pour suivre la session entre injects). Pattern : `app.inject({ method, url, payload, cookies: this.cookies, headers })` + capture `response.cookies` pour requête suivante.
    - Helper `submitForm(this, path, formData)` : `app.inject(...)` POST, suit le redirect 302 via GET avec cookies maintenus.
    - Assertions Then : status code, body.includes("..."), SQLite count queries via `db.selectFrom('bien').selectAll().execute()`.

    `tests/integration/lifecycle/premier-lancement.test.ts` (≥ 3 tests) :
    - "estPremierLancement retourne true quand table meta vide" (beforeEach: DB :memory: + migrations sans seed).
    - "estPremierLancement retourne false après marquerWizardComplete".
    - "marquerWizardComplete est idempotent (INSERT OR REPLACE)" — appel x2 sans erreur.
  </behavior>
  <action>
    Étendre `tests/bdd/features/activation.feature` avec les scenarios 2 et 3 listés ci-dessus. Conserver le scenario 1 (plan 02) intact.

    Étendre `tests/bdd/step_definitions/activation.steps.ts` : ajouter les steps Given/When/Then nécessaires (cookie jar, multi-step navigation, count SQL, wizard_complete flag).

    Créer `tests/integration/lifecycle/premier-lancement.test.ts` avec les 3 tests.

    À ce stade : `pnpm test:bdd` rouge (routes /wizard/* pas créées). Attendu.
  </action>
  <verify>
    <automated>pnpm test:bdd 2&gt;&amp;1 | grep -E "FAIL|scenarios|Error" || true</automated>
  </verify>
  <acceptance_criteria>
    - `tests/bdd/features/activation.feature` contient ≥ 3 occurrences `Scenario:` (assertion: `grep -c '^[[:space:]]*Scenario:' tests/bdd/features/activation.feature` ≥ 3).
    - `tests/bdd/features/activation.feature` contient "wizard_complete" (assertion: grep -q).
    - `tests/integration/lifecycle/premier-lancement.test.ts` contient ≥ 3 tests (assertion: `grep -cE "^[[:space:]]*(it|test)\(" tests/integration/lifecycle/premier-lancement.test.ts` ≥ 3).
    - `pnpm test:bdd` exit ≠ 0 (rouge attendu).
  </acceptance_criteria>
  <done>Le parcours wizard complet est décrit en BDD outside-in. Le scenario plan 02 (non-régression) reste préservé. Le test intégration pour le flag premier-lancement est posé.</done>
</task>

<task type="auto">
  <name>Task 2: Routes wizard + redirect racine + session config + Zod schema + flag wizard_complete</name>
  <files>
    src/web/routes/wizard.ts,
    src/web/routes/racine.ts,
    src/web/schemas/wizard-schemas.ts,
    src/main.ts,
    .env.example,
    src/infrastructure/lifecycle/premier-lancement.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-39, DP-05, DP-06
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Wizard State"
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §8 pitfall 3 (session wizard + meta table)
    - src/web/schemas/bien-schemas.ts (plan 03), src/web/schemas/locataire-schemas.ts (plan 04), src/web/schemas/bail-schemas.ts (plan 05) — réutiliser
    - src/infrastructure/lifecycle/premier-lancement.ts (créé plan 02 — vérifier signature)
    - src/main.ts (créé plan 02 — étendre)
    - src/web/routes/racine.ts (créé plan 02 — remplacer stub)
    - tests/bdd/features/activation.feature (le contrat — Task 1)
  </read_first>
  <action>
    `src/web/schemas/wizard-schemas.ts` :
    - Ré-exporter `bienCreationSchema`, `locataireCreationSchema` (utilisés tel quel pour steps 1 et 2).
    - Créer `wizardBailSchema` dérivé de `bailCreationSchema` (plan 05) avec `omit({ bienId: true, locataireId: true })` Zod — les IDs viennent de session, pas du body.
    - Re-appliquer le `superRefine` dépôt ≤ 2× via `.superRefine()`.

    Étendre `.env.example` :
    - `SESSION_SECRET=` avec commentaire `# Générer via openssl rand -hex 32 — requis par @fastify/session (DP-05)`.

    Étendre `src/main.ts` :
    - Fail-fast au boot : `const secret = process.env.SESSION_SECRET; if (!secret || secret.length < 32) { app.log.fatal('SESSION_SECRET manquant ou < 32 chars. Générer avec: openssl rand -hex 32'); process.exit(1); }`.
    - Register `@fastify/cookie` puis `@fastify/session` avec : `secret`, `cookie: { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 24*3600*1000, path: '/' }`, `cookieName: 'glo-session'`. Store en mémoire par défaut (acceptable mono-user Phase 1).
    - Register `wizard` plugin avec opts `{ bienRepo, locataireRepo, bailRepo, db }`.
    - Augmenter le typage de session : déclaration `declare module 'fastify' { interface Session { wizard?: { bienId?: BienId; locataireId?: LocataireId } } }` (ou similaire — vérifier doc @fastify/session).

    Vérifier `src/infrastructure/lifecycle/premier-lancement.ts` (créé plan 02). Exports requis :
    - `estPremierLancement(db: Kysely<DB>): Promise<boolean>` (SELECT meta WHERE cle='wizard_complete' → null = true).
    - `marquerWizardComplete(db: Kysely<DB>): Promise<void>` (INSERT OR REPLACE).
    Si absent ou signature différente, étendre.

    `src/web/routes/racine.ts` (remplacer stub plan 02) :
    - `app.get('/', async (req, reply) => { const premier = await estPremierLancement(opts.db); return reply.redirect(premier ? '/wizard/bien' : '/biens'); })`.

    `src/web/routes/wizard.ts` :
    - Plugin Fastify : `export async function plugin(app, opts: { bienRepo, locataireRepo, bailRepo, db })`.
    - Hook `preHandler` global : si URL démarre `/wizard/` ET `meta.wizard_complete === '1'`, redirige vers `/biens` (déjà complété → wizard non accessible).
    - `app.get('/wizard/bien')` : render `pages/wizard/bien.ejs` avec layout wizard, `currentStep: 1, totalSteps: 3`. Form vide.
    - `app.post('/wizard/bien')` : parse `bienCreationSchema.safeParse(body)`. Erreurs → re-render bien.ejs avec erreurs inline. Sinon : `bienId = await creerBien(commande, bienRepo)`. `req.session.wizard = { ...(req.session.wizard ?? {}), bienId }`. 302 `/wizard/locataire`.
    - `app.get('/wizard/locataire')` : si `req.session.wizard?.bienId` absent → 302 `/wizard/bien`. Sinon render locataire.ejs avec `currentStep: 2`.
    - `app.post('/wizard/locataire')` : parse `locataireCreationSchema`. Erreurs → re-render. Sinon : `locataireId = await creerLocataire(...)`. `req.session.wizard = { ...req.session.wizard, locataireId }`. 302 `/wizard/bail`.
    - `app.get('/wizard/bail')` : si `req.session.wizard?.bienId` OU `locataireId` absent → 302 `/wizard/bien`. Sinon charger `bien = await bienRepo.trouverParId(session.wizard.bienId)` + `locataire = await locataireRepo.trouverParId(session.wizard.locataireId)`. Render bail.ejs avec `currentStep: 3`, `bien`, `locataire`.
    - `app.post('/wizard/bail')` : parse `wizardBailSchema`. Erreurs → re-render. Sinon construire `commande = { ...body, bienId: session.wizard.bienId, locataireId: session.wizard.locataireId, lotIds: body.lotIds }`. `bailId = await creerBail(commande, bailRepo, bienRepo, locataireRepo)`. `await marquerWizardComplete(opts.db)`. `req.session.wizard = undefined`. Set flash banner success "Bail enregistré avec succès. Bienvenue !". 302 `/biens`.

    Pattern flash : utiliser `req.session.banniereSuccess = "..."` ; le hook `preHandler` global de `racine.ts`/`biens.ts` injecte `locals.banniereSuccess = req.session.banniereSuccess; delete req.session.banniereSuccess;` (one-shot). Plan 02 a déjà câblé la structure `locals.banniereSuccess` dans `liste.ejs`.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test -- --run &amp;&amp; pnpm test:bdd</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exit 0.
    - `pnpm test -- --run` exit 0 (tests plans 02-05 + lifecycle plan 06 verts).
    - `pnpm test:bdd` exit 0 (≥ 3 scenarios verts : plan 02 carryover + wizard complet + second lancement).
    - `pnpm lint:deps` exit 0.
    - `src/main.ts` contient `SESSION_SECRET` ET `process.exit` (assertion: 2 greps).
    - `src/web/routes/wizard.ts` contient les 6 routes (assertion: `grep -cE "(get|post)\\('/wizard/(bien|locataire|bail)'" src/web/routes/wizard.ts` ≥ 6).
    - `src/web/routes/wizard.ts` contient `marquerWizardComplete`.
    - `src/web/routes/racine.ts` contient `estPremierLancement`.
    - `.env.example` contient `SESSION_SECRET=` et `openssl rand -hex 32`.
  </acceptance_criteria>
  <done>Routes wizard câblées, session sécurisée (fail-fast), flag premier-lancement bascule correctement après step 3. Le scenario BDD complet "Activation premier lancement bout-en-bout" passe.</done>
</task>

<task type="auto">
  <name>Task 3: Pages EJS wizard + partial wizard-layout (step indicator) + CTAs UI-SPEC EXACTS</name>
  <files>
    src/web/views/partials/wizard-layout.ejs,
    src/web/views/pages/wizard/bien.ejs,
    src/web/views/pages/wizard/locataire.ejs,
    src/web/views/pages/wizard/bail.ejs
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Screen Inventory" (Wizard Étape 1/2/3), §"Wizard Shell", §"Primary CTAs"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-39, D-44, D-45, D-49
    - src/web/views/partials/form-field.ejs (réutiliser plan 03)
    - src/web/views/pages/biens/formulaire.ejs (modèle plan 03)
    - src/web/views/pages/locataires/formulaire.ejs (modèle plan 04)
    - src/web/views/pages/baux/formulaire.ejs (modèle plan 05)
  </read_first>
  <action>
    `src/web/views/partials/wizard-layout.ejs` (UI-SPEC §"Wizard Shell") :
    - Reçoit locals : `{ titreEtape, currentStep, totalSteps, contenu, etapePrecedente?: { url } }`.
    - Pas de sidebar (wizard plein écran, focus parcours unique — UX Hick's Law).
    - Step indicator : `<ol aria-label="Étapes du wizard d'activation">` avec 3 `<li>` (Bien / Locataire / Bail). L'étape active a `aria-current="step"`. Style accent UI-SPEC §"Color" §"Accent reserved" §2.
    - `<h1>` style display 28px (UI-SPEC §"Typography Display") avec `<%= titreEtape %>`.
    - `<%- contenu %>` (form HTML insertion).
    - Footer : `<% if (etapePrecedente) { %><a href="<%= etapePrecedente.url %>">← Étape précédente</a><% } %>`.

    `src/web/views/pages/wizard/bien.ejs` :
    - Wrap `wizard-layout.ejs` avec `titreEtape: "Créer votre premier bien"` (UI-SPEC EXACT), `currentStep: 1, totalSteps: 3, etapePrecedente: null`.
    - Form `<form method="POST" action="/wizard/bien">` :
      - Fieldset "Adresse" : rue, codePostal, ville (form-field partials).
      - Fieldset "Caractéristiques" : surface, type (`<select name="type">` avec options 'appartement','maison','immeuble','local_commercial'), anneeConstruction.
      - Fieldset "Lots" : un seul Lot inline au wizard (designation + type select Lot, surface optionnelle). Plan 03 multi-lots accessible post-wizard via `/biens/:id`.
      - Bouton `<button type="submit">Enregistrer le bien</button>` (CTA EXACT UI-SPEC §"Primary CTAs" wizard étape 1).
    - Erreurs inline via form-field `erreur`.

    `src/web/views/pages/wizard/locataire.ejs` :
    - Wrap `wizard-layout.ejs` avec `titreEtape: "Créer le locataire"`, `currentStep: 2`, `etapePrecedente: { url: '/wizard/locataire' }` — wait, c'est `/wizard/bien` (précédente).
    - Form `<form method="POST" action="/wizard/locataire">` similaire à pages/locataires/formulaire.ejs (plan 04) mais sans bouton "Annuler".
    - Bouton submit "Enregistrer le locataire" (CTA EXACT).

    `src/web/views/pages/wizard/bail.ejs` :
    - Wrap `wizard-layout.ejs` avec `titreEtape: "Créer le bail"`, `currentStep: 3`, `etapePrecedente: { url: '/wizard/locataire' }`.
    - Section read-only au-dessus du form (UX confiance) : `<section aria-label="Récapitulatif"><p><strong>Bien :</strong> <%= bien.adresse.enLigne() %></p><p><strong>Locataire :</strong> <%= locataire.prenom %> <%= locataire.nom %></p></section>`.
    - Form `<form method="POST" action="/wizard/bail">` :
      - **PAS de select bienId/locataireId** — IDs en hidden inputs OU récupérés de session côté serveur. Préférer hidden inputs pour traçabilité dans le form-data.
      - Fieldset "Lots concernés" : `<% bien.lots.forEach(l => { %><label><input type="checkbox" name="lotIds" value="<%= l.id %>" checked> <%= l.designation %> (<%= l.type %>)</label><% }) %>`.
      - Fieldsets "Conditions financières" (loyer HC €, mode charges radio forfait/provisions, montant charges, dépôt garantie), "Période" (date_debut, dureeMois), "IRL de référence" (trimestre, valeur).
      - Fieldset "Cautionnement (optionnel)" : radio type physique/visale/gli/aucun + sous-fieldset Garant conditionnel + date signature + durée engagement.
      - Bouton submit `<button type="submit">Enregistrer le bail et terminer</button>` (CTA EXACT UI-SPEC).

    A11y obligatoire toutes pages (UI-SPEC §"Accessibility Contract") : `<label for>`, `aria-describedby` pour erreurs, `<fieldset><legend>`, un seul `<h1>` par page, focus visible.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test:bdd &amp;&amp; pnpm lint</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exit 0.
    - `pnpm test:bdd` exit 0 (≥ 3 scenarios verts).
    - `pnpm lint` exit 0.
    - `src/web/views/partials/wizard-layout.ejs` contient `aria-current="step"` (assertion: `grep -q 'aria-current="step"' src/web/views/partials/wizard-layout.ejs`).
    - `src/web/views/pages/wizard/bien.ejs` contient "Créer votre premier bien" ET "Enregistrer le bien".
    - `src/web/views/pages/wizard/locataire.ejs` contient "Créer le locataire" ET "Enregistrer le locataire".
    - `src/web/views/pages/wizard/bail.ejs` contient "Créer le bail" ET "Enregistrer le bail et terminer" (CTA EXACT step 3 UI-SPEC).
    - Test manuel : `pnpm dev` avec DB neuve → naviguer http://127.0.0.1:7878 → redirigé /wizard/bien automatiquement → traverser les 3 étapes → arrivée /biens avec banner success.
    - Test manuel 2 : relancer `pnpm dev` après wizard complété → naviguer http://127.0.0.1:7878 → redirigé directement /biens (wizard non affiché).
  </acceptance_criteria>
  <done>Le wizard premier lancement est entièrement opérationnel UI + backend. Step indicator visible, CTAs EXACTS UI-SPEC. KPI Activation §5 ROADMAP atteint : un utilisateur ouvrant l'app pour la première fois aboutit en une session unique à 1 Bien + 1 Locataire + 1 Bail visibles dans la liste persistée.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → POST /wizard/* | Multi-step session avec cookie. Risque tampering session ID. |
| Session storage in-memory | Pas de persistance entre redémarrages Phase 1 ; acceptable car le wizard n'est qu'une session. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-01 | Tampering | Session cookie | mitigate | `@fastify/session` signe le cookie avec SESSION_SECRET (32+ chars, fail-fast au boot). |
| T-06-02 | Tampering | bypass wizard via accès direct `/biens` | accept | Plan 02-05 ont créé `/biens` accessible toujours. Le wizard est un guidage premier-lancement, pas une garde de sécurité. |
| T-06-03 | Tampering | URL forging `/wizard/bail` avant step 1 | mitigate | Guards séquence : GET /wizard/locataire et /wizard/bail vérifient session.wizard.bienId présent, sinon 302 /wizard/bien. |
| T-06-04 | Information Disclosure | Session in-memory non chiffrée | accept | Mono-user local, pas de fuite réseau. Session reset au restart = pas de stockage durable. |
| T-06-05 | Repudiation | Pas de log structuré de l'achèvement wizard | mitigate | Log pino info `{event: 'wizard_complete', bienId, locataireId, bailId}` au moment du `marquerWizardComplete` (audit-friendly CLAUDE.md §Principes directeurs §4). |
</threat_model>

<verification>
- `pnpm typecheck` exit 0
- `pnpm lint` exit 0
- `pnpm test -- --run` exit 0 (≥ 55 tests cumulés)
- `pnpm test:bdd` exit 0 (≥ 3 scenarios verts)
- `pnpm lint:deps` exit 0
- Test manuel premier lancement : `rm ~/.local/share/gestion-locative/db.sqlite` (ou path OS équivalent) puis `pnpm dev` → http://127.0.0.1:7878 → auto-redirigé /wizard/bien → traverse 3 étapes → arrivée /biens avec liste peuplée + banner success
- Test manuel second lancement : tester après que wizard est completé, le restart n'affiche plus le wizard
- Test manuel session expirée mid-wizard : supprimer cookie navigateur entre step 1 et step 2 → GET /wizard/locataire redirige /wizard/bien (séquence guard)
- Test a11y : DevTools Lighthouse sur /wizard/bien → score Accessibility ≥ 90 (objectif strict UI-SPEC §"Accessibility Contract")
- KPI Activation §5 ROADMAP atteint : un utilisateur partant de DB vide complète le wizard en < 5 min et voit 1 Bien + 1 Locataire + 1 Bail dans les listes
</verification>

<success_criteria>
Le KPI Activation §5 ROADMAP est **atteint avec un parcours guidé**. Les 4 REQs Phase 1 (PAT-01, PAT-02, LOC-01, LOC-02) sont couverts par les plans 02-05 et **orchestrés** par ce plan dans un parcours mesurable utilisateur. Le scenario BDD "Activation premier lancement bout-en-bout" formalise ce KPI.
</success_criteria>

<output>
Créer `.planning/phases/01-activation-bien-locataire-bail/01-06-activation-wizard-SUMMARY.md`. Lister :
- Confirmation des 3+ scenarios BDD verts
- Path exact du fichier de session in-memory (cookie name `glo-session`)
- Comment regénérer le SESSION_SECRET (`openssl rand -hex 32`)
- Comment retester le premier-lancement (supprimer ligne `meta.wizard_complete` OU supprimer le `.sqlite`)
- Confirmation log structuré pino émis lors de `marquerWizardComplete`
</output>

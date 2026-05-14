---
phase: 01-activation-bien-locataire-bail
plan: "08"
type: execute
wave: 8
depends_on: [01-06, 01-07]
gap_closure: true
files_modified:
  - src/web/routes/wizard.ts
  - src/web/schemas/bien-schemas.ts
  - src/web/schemas/wizard-schemas.ts
  - src/web/views/pages/wizard/bien.ejs
  - src/web/views/pages/wizard/locataire.ejs
  - src/web/views/pages/biens/detail.ejs
  - src/web/views/pages/baux/liste.ejs
  - src/main.ts
  - tests/integration/wizard/wizard-validation-erreurs.test.ts
  - tests/integration/wizard/wizard-skippable.test.ts
  - tests/unit/web/bien-schemas.test.ts
  - tests/bdd/features/activation.feature
  - tests/bdd/step_definitions/activation.steps.ts
autonomous: true
requirements: [PAT-01, PAT-02, LOC-01, LOC-02]
tags: [gap-closure, uat-p02, wizard, validation, errors, scope-change, optional-steps, bdd]

must_haves:
  truths:
    # G1 — Validation errors stay inline (no JSON 500)
    - "Soumettre le wizard étape Bien avec un lot type=appartement sans surface re-render `/wizard/bien` avec l'erreur sous le champ `lots[0].surface` (pas de redirection JSON 500)."
    - "Soumettre le wizard étape Locataire avec un email invalide re-render `/wizard/locataire` avec l'erreur sous `email` et préserve les autres valeurs saisies."
    - "Toute exception non catchée par une route est interceptée par un `setErrorHandler` global qui rend `pages/erreur.ejs` pour Accept: text/html et JSON pour Accept: application/json."
    - "Le schéma Zod `lotCreationSchema` exige `surface > 0` quand `type ∈ {appartement, local_commercial}` (via superRefine) — l'invariant domaine ne peut plus être atteint par cette voie."
    # G2 — Wizard skippable
    - "L'étape Bien du wizard propose 2 actions de fin : 'Continuer vers locataire' (existant) ET 'Terminer — ajouter locataire/bail plus tard' (nouveau)."
    - "Cliquer 'Terminer plus tard' depuis l'étape Bien crée uniquement le Bien, marque `meta.wizard_complete=1`, vide la session wizard, redirige vers `/biens` avec banner 'Bien enregistré. Vous pourrez ajouter un locataire et un bail quand vous le souhaitez.'"
    - "L'étape Locataire propose aussi un CTA 'Terminer — ajouter le bail plus tard' qui clôt le wizard après création du Locataire (Bien + Locataire sans Bail)."
    - "Sur `/biens/:id` (détail bien), un CTA 'Ajouter un locataire pour ce bien' est visible (pré-remplit `bienId` via query param)."
    - "Sur `/baux` (liste baux), l'empty state proposé quand biensCount > 0 ET locatairesCount > 0 ET baux.length === 0 mène vers `/baux/nouveau` (existant : non-régression à vérifier)."
    - "Les pages `/locataires` et `/baux` rendent un empty state propre quand vides (non-régression)."
    # Tests
    - "Scenario BDD vert : 'Bug G1 — submission wizard sans surface re-render avec erreur inline (pas de JSON 500)'."
    - "Scenario BDD vert : 'Wizard skippable — l'utilisateur termine après l'étape Bien seul'."
    - "Scenario BDD vert : 'Wizard skippable — l'utilisateur termine après l'étape Locataire (sans Bail)'."
    - "Tests integration `wizard-validation-erreurs.test.ts` : 4+ cas couvrant 3 étapes × erreurs Zod + invariants domaine, et response.statusCode === 200 + Content-Type html."
    - "Tests integration `wizard-skippable.test.ts` : 2+ cas (terminer après Bien, terminer après Locataire) + meta.wizard_complete posé."

  artifacts:
    - path: "src/web/routes/wizard.ts"
      provides: "POST /wizard/bien, /wizard/locataire, /wizard/bail wrappés en try/catch + POST /wizard/bien?terminer=1 (et locataire)"
      contains: "try { const bienId = await creerBien"
    - path: "src/main.ts"
      provides: "app.setErrorHandler global qui distingue HTML vs JSON via req.headers.accept"
      contains: "app.setErrorHandler"
    - path: "src/web/schemas/bien-schemas.ts"
      provides: "lotCreationSchema avec superRefine: si type ∈ {appartement, local_commercial} alors surface > 0"
      contains: ".superRefine"
    - path: "src/web/views/pages/wizard/bien.ejs"
      provides: "2 boutons submit (formaction): 'Continuer vers locataire' + 'Terminer plus tard'"
      contains: "Terminer"
    - path: "src/web/views/pages/wizard/locataire.ejs"
      provides: "2 boutons submit (formaction): 'Continuer vers bail' + 'Terminer plus tard'"
      contains: "Terminer"
    - path: "src/web/views/pages/biens/detail.ejs"
      provides: "CTA 'Ajouter un locataire pour ce bien' visible"
      contains: "Ajouter un locataire"
    - path: "tests/integration/wizard/wizard-validation-erreurs.test.ts"
      provides: "Couvre les invariants domaine sur les 3 étapes wizard (Bien, Locataire, Bail)"
      exports: ["describe wizard validation"]
    - path: "tests/integration/wizard/wizard-skippable.test.ts"
      provides: "Couvre la sortie wizard après étape Bien seul et après Bien+Locataire (sans Bail)"
      exports: ["describe wizard skippable"]

  key_links:
    - from: "src/web/routes/wizard.ts (POST /wizard/bien)"
      to: "src/web/views/pages/wizard/bien.ejs"
      via: "Catch InvariantViolated → reply.view même page avec erreurs._global et valeurs préservées"
      pattern: "try \\{[^}]*creerBien"
    - from: "src/main.ts"
      to: "Fastify"
      via: "app.setErrorHandler intercepte tout throw non catché"
      pattern: "app\\.setErrorHandler"
    - from: "src/web/views/pages/wizard/bien.ejs"
      to: "src/web/routes/wizard.ts (POST /wizard/bien)"
      via: "Form contient 2 boutons submit avec formaction='/wizard/bien?terminer=1'"
      pattern: "formaction=.*terminer"
    - from: "src/web/views/pages/biens/detail.ejs"
      to: "/locataires/nouveau?bienId=:id"
      via: "Lien depuis fiche bien vers création locataire pré-rempli"
      pattern: "locataires/nouveau"
---

<objective>
**Avenant Phase 01 — clôture des 2 gaps majeurs remontés à l'UAT Phase 02** : (G1) les erreurs de validation du wizard ne doivent plus renvoyer une page JSON 500 mais s'afficher inline sous les champs concernés, et (G2) le wizard doit pouvoir se terminer après l'étape Bien (locataire + bail optionnels) pour soutenir le cas d'usage prioritaire LMNP — gérer un bien seul pour l'extraction factures / fiscalité sans avoir de locataire à l'instant T.

**Scope strict** :
- G1 (3 niveaux complémentaires, défense en profondeur) : (1) try/catch dans `wizard.ts` autour de `creerBien` / `creerLocataire` / `creerBail` (reproduire pattern `biens.ts:65-82`) + re-render avec `erreurs._global` + preservation valeurs ; (2) `app.setErrorHandler` global dans `main.ts` qui distingue HTML vs JSON selon `req.headers.accept` ; (3) aligner `lotCreationSchema.surface` sur l'invariant domaine via `superRefine` (si `type ∈ {appartement, local_commercial}` alors `surface > 0` requis) → l'erreur Zod attrape le cas AVANT le domaine et s'affiche inline sous `lots[0].surface`.
- G2 : 2e bouton submit "Terminer plus tard" sur l'étape Bien (formaction `?terminer=1`) + même chose sur l'étape Locataire. Le handler POST détecte le query param et clôt le wizard (marquerWizardComplete + clear session + redirect /biens). Aucun invariant domaine ne change : `Bien` existe déjà sans `Bail` ni `Locataire` (le couplage est dans `Bail`, qui référence `Bien` et `Locataire`, pas l'inverse). Ajout d'un CTA cross-link sur `/biens/:id` (détail bien) → "Ajouter un locataire pour ce bien" qui pré-remplit `?bienId=:id` sur le formulaire locataire (le formulaire locataire actuel ne consomme pas encore ce param — c'est juste un raccourci UX, le rattachement réel se fait au moment de la création du Bail).

**Discipline TDD outside-in** : Task 1 produit les tests rouges (BDD + integration + unit). Tasks 2 et 3 les font passer au vert sans toucher au scope défini.

Purpose : Réparer 2 bugs/gaps UX bloquants pour la première session utilisateur. G1 fait passer le wizard d'une expérience "rejette en JSON" à "indique l'erreur où elle se trouve" (UX_DESIGN.md §Error Handling, ACCESSIBILITY.md §Forms). G2 aligne le scope produit sur l'usage réel V1 LMNP solo (CLAUDE.md "je veux pouvoir gérer juste avec le bien et l'extraction de factures / fiscalité dans un premier temps").

Output : 3 commits atomiques (1 test rouge → 2 fix green). Aucune modification du domaine. Aucune migration SQL. Aucun changement d'invariant. Strictement web + tests + 1 ajustement Zod schema.
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md
@.planning/phases/01-activation-bien-locataire-bail/01-06-activation-wizard-SUMMARY.md
@.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md
@.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md
@.planning/debug/g1-validation-500-json.md
@CLAUDE.md
@BDD_PRACTICES.md
@UX_DESIGN.md
@ACCESSIBILITY.md

<interfaces>
**Use cases existants** (à invoquer depuis routes wizard — ne pas modifier leur signature) :
- `creerBien(commande, bienRepo): Promise<BienId>` — lève `InvariantViolated` si invariant domaine violé
- `creerLocataire(commande, locataireRepo): Promise<LocataireId>` — lève `InvariantViolated` si invariant domaine violé
- `creerBail(commande, bailRepo, bienRepo, locataireRepo): Promise<BailId>` — lève `BienIntrouvable`, `LocataireIntrouvable`, `InvariantViolated`
- `marquerWizardComplete(db): Promise<void>` — pose `meta.wizard_complete=1` (idempotent INSERT OR REPLACE)

**Patterns existants à reproduire** :
- `src/web/routes/biens.ts:46-82` (POST /biens) — pattern try/catch après safeParse, catch → reply.view avec `erreurs: { _global: err.message }` + `valeurs: body` préservés.
- `src/web/routes/baux.ts:128-225` (POST /baux) — même pattern, plus complexe (Bail multi-aggregate).
- `src/web/routes/encaissements.ts` — pattern partiel : catch des erreurs métier connues (`EcheanceAnnulee`, `BailNonActif`) en re-render, autres rethrow (le `setErrorHandler` les couvrira).

**Schéma Zod à modifier** :
- `src/web/schemas/bien-schemas.ts:3-16` — `lotCreationSchema` : ajouter `.superRefine` qui vérifie `if (data.type === 'appartement' || data.type === 'local_commercial') { if (data.surface == null || data.surface <= 0) ctx.addIssue({ path: ['surface'], message: 'La surface est obligatoire et doit être > 0 pour un lot de type appartement ou local commercial.' }); }`.
- ATTENTION : le schema est utilisé dans `bienCreationSchema.lots: z.array(lotCreationSchema)` ET indirectement consommé par `bien-schemas.ts` re-exporté via `wizard-schemas.ts:3`. Le `superRefine` se propage automatiquement.
- ATTENTION : `wizard-schemas.ts:14 wizardBailSchema` n'utilise PAS `lotCreationSchema` — ne touche pas à wizard-schemas.ts pour G1 (juste pour G2 si besoin).

**Conventions** :
- Hexagonal strict (DDD.md) : aucun changement domaine. Tout le fix vit dans `src/web/` et `src/main.ts`.
- Ubiquitous language français : variables Zod, messages, vues, tests, commits.
- BDD outside-in (BDD_PRACTICES.md §5) : 1 commit test rouge → 2 commits fix vert.
- Layout split debut/fin (LEARNINGS §"EJS layout split debut/fin") — déjà en place sur wizard, ne pas casser.
- Empty state partial : `<%- include('../../partials/empty-state', {heading, body, ctaLabel, ctaUrl}) %>`.

**Sample d'erreur 500 actuelle (reproductible)** :
```bash
# Avec serveur démarré
curl -X POST http://127.0.0.1:7878/wizard/bien \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "rue=12 rue Test&codePostal=75001&ville=Paris&surface=50&type=appartement&anneeConstruction=1985&lots[0].designation=Appart&lots[0].type=appartement&lots[0].surface=&lots[0].etage="
# → 500 {"statusCode":500,"error":"Internal Server Error","message":"La surface est obligatoire et doit être > 0 pour un lot de type \"appartement\""}
```
Après fix : statusCode 200, Content-Type: text/html, page wizard step 1 re-rendue avec erreur sous le champ surface.

**Page d'erreur 500 attendue** (à créer dans Task 2, fallback global) :
- Path : `src/web/views/pages/erreur.ejs`
- Contenu minimal : layout-debut + h1 "Erreur inattendue" + paragraphe message + lien retour `/biens` ou `/`.
- Utilisée uniquement par `setErrorHandler` quand l'Accept est HTML. Pour le JSON, on garde le JSON Fastify natif (ou un objet `{error: message}` minimal).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests rouges BDD + integration + unit pour G1 + G2</name>
  <files>
    tests/bdd/features/activation.feature,
    tests/bdd/step_definitions/activation.steps.ts,
    tests/integration/wizard/wizard-validation-erreurs.test.ts,
    tests/integration/wizard/wizard-skippable.test.ts,
    tests/unit/web/bien-schemas.test.ts
  </files>
  <behavior>
    **Scenarios BDD ajoutés dans `tests/bdd/features/activation.feature`** :
    1. "Bug G1 — submission wizard sans surface re-render avec erreur inline (pas de JSON 500)" :
       - Given app premier lancement
       - When bailleur soumet POST /wizard/bien avec lot type=appartement et surface vide
       - Then statusCode = 200 (pas 500)
       - And Content-Type contient "text/html"
       - And le body contient "La surface est obligatoire" (texte du message)
       - And le body NE contient PAS '"statusCode":500' ni '"Internal Server Error"' (pas de JSON brut)
       - And la table SQLite bien contient 0 ligne (rien créé)
    2. "Wizard skippable — l'utilisateur termine après l'étape Bien seul" :
       - Given app premier lancement
       - When bailleur soumet POST /wizard/bien?terminer=1 avec un bien valide
       - Then il est redirigé vers "/biens"
       - And la page affiche un banner "Bien enregistré. Vous pourrez ajouter un locataire et un bail quand vous le souhaitez."
       - And la table SQLite bien contient 1 ligne
       - And la table SQLite locataire contient 0 ligne
       - And la table SQLite bail contient 0 ligne
       - And la table SQLite meta contient wizard_complete=1
    3. "Wizard skippable — l'utilisateur termine après l'étape Locataire (sans Bail)" :
       - Given app premier lancement
       - When bailleur soumet l'étape Bien valide (continuer normal)
       - And bailleur soumet POST /wizard/locataire?terminer=1 avec un locataire valide
       - Then il est redirigé vers "/biens"
       - And la page affiche un banner contenant "Locataire enregistré. Vous pourrez créer un bail plus tard."
       - And la table SQLite bien contient 1 ligne
       - And la table SQLite locataire contient 1 ligne
       - And la table SQLite bail contient 0 ligne
       - And la table SQLite meta contient wizard_complete=1

    **Tests integration `tests/integration/wizard/wizard-validation-erreurs.test.ts`** (≥4 tests, Vitest + app.inject) :
    1. "POST /wizard/bien avec lot type=appartement sans surface → 200 + html + erreurs.lots.0.surface visible"
    2. "POST /wizard/locataire avec email invalide → 200 + html + erreurs.email visible + autres champs préservés (nom, prenom rendered dans value=)"
    3. "POST /wizard/bail avec depotGarantie > 2× loyer → 200 + html + erreurs.depotGarantieEuros visible (déjà géré par Zod superRefine — vérifie non-régression)"
    4. "POST /wizard/bien avec lot type=appartement et surface présente mais le repo en mock lève une erreur arbitraire → 200 + html + erreurs._global visible (couvre le catch générique)"
       - Astuce : mocker `bienRepo.enregistrer` avec une fonction qui throw `new Error("Disk full")` ; vérifier que la response reste HTML, status 200, contient "Disk full" dans une banner d'erreur générique.
    5. "setErrorHandler global — Une route arbitraire qui throw renvoie pages/erreur.ejs en HTML pour Accept: text/html"
       - Enregistrer une route test `app.get('/_test-throw', () => { throw new Error('boom') })` avant `creerApp` (ou utiliser une route existante mockée), inject avec Accept: text/html, asserter statusCode=500 + Content-Type: text/html + body contient "boom".
    6. "setErrorHandler global — Pour Accept: application/json, retourne JSON {error: 'boom'}"
       - Même route _test-throw, inject avec Accept: application/json, asserter statusCode=500 + Content-Type contient json + body parsed.error === 'boom'.

    **Tests integration `tests/integration/wizard/wizard-skippable.test.ts`** (≥2 tests) :
    1. "POST /wizard/bien?terminer=1 → 302 /biens + Bien persisté + meta.wizard_complete posé + session.wizard vidée + 0 locataire + 0 bail"
    2. "POST /wizard/locataire?terminer=1 (après step Bien valide) → 302 /biens + 1 Bien + 1 Locataire + 0 Bail + meta.wizard_complete posé"

    **Tests unit `tests/unit/web/bien-schemas.test.ts`** (≥3 tests Vitest) :
    1. "lotCreationSchema rejette type=appartement + surface=null avec issue.path=['surface'] et message contenant 'obligatoire'"
    2. "lotCreationSchema rejette type=local_commercial + surface=0 avec issue.path=['surface']"
    3. "lotCreationSchema accepte type=parking + surface=null (parking n'exige pas de surface)"
    4. "lotCreationSchema accepte type=appartement + surface=45 (cas nominal)"

    Tous ces tests DOIVENT ÊTRE ROUGES avant Task 2 et 3 (commit `test(01-08): ajouter tests rouges G1+G2`).
  </behavior>
  <action>
    1. Étendre `tests/bdd/features/activation.feature` avec les 3 scenarios listés ci-dessus (en respectant la convention LEARNINGS : pas de `# language: fr`, keywords Gherkin en anglais, texte en français, regex pour les URLs).
    2. Étendre `tests/bdd/step_definitions/activation.steps.ts` avec :
       - Un step `Then la réponse a un statusCode 200` qui asserte sur `world.lastResponse.statusCode`.
       - Un step `Then la réponse contient le header Content-Type "text/html"`.
       - Un step `Then la page ne contient pas {string}` (négation pour 'statusCode":500').
       - Un step `When le bailleur soumet POST /wizard/bien avec terminer=1 et un bien valide` qui POST sur `/wizard/bien?terminer=1` avec un body valide complet.
       - Un step `When le bailleur soumet POST /wizard/locataire avec terminer=1 et un locataire valide`.
       - Un step `Then la table SQLite {tableName} contient {int} ligne` (déjà partiellement présent : étendre si besoin pour `locataire`, `bail`).
       - Un step `Then la table SQLite meta contient wizard_complete=1`.
       - Réutiliser le cookie jar existant pour propager la session entre les POSTs.
    3. Créer `tests/integration/wizard/wizard-validation-erreurs.test.ts` :
       - Importer `creerApp` + Kysely + Database + migrations comme dans `premier-lancement.test.ts`.
       - Construire l'app avec `SESSION_SECRET` valide (32+ chars).
       - Tester via `app.inject({ method: 'POST', url: '/wizard/bien', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, payload: '...form-urlencoded...' })`.
       - Pour le test du setErrorHandler, ajouter une route de test minimale (cf `<interfaces>` ci-dessus).
       - Asserter sur `response.statusCode`, `response.headers['content-type']`, `response.body.includes(...)`.
    4. Créer `tests/integration/wizard/wizard-skippable.test.ts` :
       - Même setup app + db in-memory.
       - Pour le test step 2, faire d'abord un POST /wizard/bien valide (chaîné avec cookie session) puis POST /wizard/locataire?terminer=1.
       - Asserter sur le nombre de lignes dans chaque table via `db.selectFrom('bien').execute()`, etc.
    5. Créer `tests/unit/web/bien-schemas.test.ts` :
       - Import direct `import { lotCreationSchema } from '../../../src/web/schemas/bien-schemas.js'`.
       - Tester `lotCreationSchema.safeParse({ designation: 'X', type: 'appartement', surface: null, etage: null })` → `success === false`, `error.issues[0].path === ['surface']`, message contient 'obligatoire'.
       - Cas nominaux et négatifs listés dans `<behavior>`.
    6. Commit `test(01-08): ajouter tests rouges G1 validation inline + G2 wizard skippable (rouges)` après vérification que `pnpm test` et `pnpm test:bdd` exhibent bien les échecs attendus.
  </action>
  <verify>
    <automated>pnpm test -- tests/unit/web/bien-schemas.test.ts tests/integration/wizard/ 2>&1 | grep -E "(FAIL|fail)" && pnpm test:bdd -- --tags "@gap-closure" 2>&1 | head -50</automated>
  </verify>
  <done>
    Tous les nouveaux tests sont ROUGES avec messages d'erreur cohérents (Zod ne refine pas encore surface, wizard.ts n'a pas encore try/catch, setErrorHandler absent, ?terminer=1 non implémenté). Le commit `test(01-08): …` est créé. Aucun fichier `src/` modifié dans ce commit.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Fix G1 — validation inline + setErrorHandler global + Zod superRefine surface</name>
  <files>
    src/web/routes/wizard.ts,
    src/web/schemas/bien-schemas.ts,
    src/web/views/pages/wizard/locataire.ejs,
    src/web/views/pages/wizard/bail.ejs,
    src/web/views/pages/erreur.ejs,
    src/main.ts
  </files>
  <behavior>
    Après Task 2, les tests RED suivants doivent passer en VERT :
    - `wizard-validation-erreurs.test.ts` cas 1, 2, 3, 4, 5, 6 (tous).
    - `bien-schemas.test.ts` cas 1, 2, 3, 4 (tous).
    - BDD scenario 1 "Bug G1 — submission wizard sans surface re-render avec erreur inline".

    Les tests G2 (skippable) restent RED après Task 2 — c'est Task 3 qui les passe au vert.

    Aucun test existant ne doit régresser (`pnpm test` + `pnpm test:bdd` 100% vert sauf G2).
  </behavior>
  <action>
    **Niveau 1 — Aligner Zod sur l'invariant domaine (cf LEARNINGS §"superRefine bloque .omit") :**

    1. Dans `src/web/schemas/bien-schemas.ts`, modifier `lotCreationSchema` pour ajouter un `.superRefine` qui pousse une issue sur le path `['surface']` si `type ∈ {appartement, local_commercial}` ET (`surface == null || surface <= 0`). Le message exact à utiliser : `"La surface est obligatoire et doit être > 0 pour un lot de type appartement ou local commercial."` (doit matcher le test unit).
    2. Vérifier que cette modification n'affecte pas `bienModificationSchema` (il n'inclut pas `lotCreationSchema`). Vérifier que `wizard-schemas.ts:3` re-exporte `lotCreationSchema` indirectement via `bienCreationSchema.lots` — pas de changement à wizard-schemas.ts requis.
    3. ATTENTION : `lotCreationSchema` est typé `LotCreationData` via `z.infer<typeof lotCreationSchema>`. Le `.superRefine` renvoie un `ZodEffects<ZodObject<...>>` — le type `z.infer` reste compatible (un ZodEffects préserve l'output type). Pas d'impact downstream sur `creerBien` qui consomme `LotCreationData`.

    **Niveau 2 — try/catch dans wizard.ts (cf pattern `biens.ts:46-82`) :**

    4. Dans `src/web/routes/wizard.ts`, wrapper l'appel `creerBien` (ligne 96-105) dans un try/catch. En cas d'erreur :
       - Log via `app.log.error({ err, route: 'POST /wizard/bien', body })` pour audit.
       - Render `pages/wizard/bien.ejs` avec `currentStep: 1, totalSteps: 3, valeurs: body, erreurs: { _global: err.message }` (le partial wizard-layout.ejs affiche déjà `erreurs._global` ligne 34-36).
       - Return `reply.code(200)` explicitement (le re-render Zod fait déjà ça implicitement — pour cohérence).
    5. Idem pour `creerLocataire` (ligne 144-157) → re-render `pages/wizard/locataire.ejs`.
    6. Idem pour `creerBail` (ligne 245-262) → re-render `pages/wizard/bail.ejs` (nécessite de re-fetcher `bien` et `locataire` du repo pour passer à la vue — comme fait déjà le bloc Zod ligne 201-204).
    7. Important : préserver `valeurs: body` pour que les champs saisis restent remplis (D-49 Forms).
    8. **Modifier les vues** `wizard/locataire.ejs` et `wizard/bail.ejs` pour qu'elles affichent `erreurs._global` en haut du form (le partial wizard-layout.ejs le fait déjà — vérifier qu'aucune divergence n'empêche le rendu). Si le partial le fait déjà uniformément, AUCUNE modif EJS Task 2 sauf création de `pages/erreur.ejs` (étape 11).

    **Niveau 3 — setErrorHandler global (defense-in-depth) :**

    9. Dans `src/main.ts` (dans `creerApp` avant le `return app`), enregistrer `app.setErrorHandler(async (err, req, reply) => { ... })`.
       - Log : `req.log.error({ err, url: req.url, method: req.method }, 'erreur non interceptée')`.
       - Si `req.headers.accept` contient `'text/html'` (ou si absent et la route n'est PAS sous `/api/` — heuristique simple) : `reply.code(500).view('pages/erreur.ejs', { message: err.message || 'Erreur inattendue', navActive: null })`.
       - Sinon : `reply.code(500).send({ error: err.message || 'Erreur inattendue' })` (JSON minimal).
       - Distinguer aussi `err.statusCode` si Fastify l'a déjà décoré (cas 404 préservés).
    10. Important : le `setErrorHandler` doit être enregistré AVANT les plugins de routes (sinon Fastify peut décider autrement pour certaines routes).
    11. **Créer `src/web/views/pages/erreur.ejs`** :
        - Inclut `layout-debut` (titre "Erreur", navActive null).
        - `<h1>Erreur inattendue</h1>`.
        - `<p><%= message %></p>`.
        - `<p><a href="/">Retour à l'accueil</a></p>`.
        - Inclut `layout-fin`.
        - Conforme WCAG : `<aside role="alert">` autour du message d'erreur.

    12. Commit `feat(01-08): fix G1 — try/catch wizard + setErrorHandler global + superRefine surface (vert)`.
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm lint && pnpm lint:deps && pnpm test -- tests/unit/web/bien-schemas.test.ts tests/integration/wizard/wizard-validation-erreurs.test.ts && pnpm test:bdd</automated>
  </verify>
  <done>
    - `lotCreationSchema.safeParse({type:'appartement', surface:null, ...})` retourne `success:false` avec issue.path=['surface'].
    - POST /wizard/bien avec surface absente pour un appartement → 200 HTML + erreur sous le champ surface (pas de JSON 500).
    - POST `_test-throw` route avec Accept: text/html → 500 + page erreur.ejs rendue.
    - POST `_test-throw` avec Accept: application/json → 500 + JSON `{error: ...}`.
    - Tous les tests unit + integration G1 passent au vert.
    - BDD scenario 1 passe au vert.
    - Aucun test existant ne régresse (`pnpm test` + `pnpm test:bdd` verts sauf scenarios G2).
    - Commit `feat(01-08): fix G1 …` créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Fix G2 — wizard skippable + CTAs cross-link Bien/Locataire</name>
  <files>
    src/web/routes/wizard.ts,
    src/web/views/pages/wizard/bien.ejs,
    src/web/views/pages/wizard/locataire.ejs,
    src/web/views/pages/biens/detail.ejs
  </files>
  <behavior>
    Après Task 3, les tests RED restants doivent passer en VERT :
    - `wizard-skippable.test.ts` cas 1, 2.
    - BDD scenario 2 "Wizard skippable — l'utilisateur termine après l'étape Bien seul".
    - BDD scenario 3 "Wizard skippable — l'utilisateur termine après l'étape Locataire (sans Bail)".

    Non-régression :
    - BDD scenario "L'utilisateur traverse le wizard complet en une session" (existant) reste vert : les boutons "Enregistrer le bien" et "Enregistrer le locataire" (par défaut) continuent à mener à l'étape suivante.
    - Pas de nouveau test G1 ne casse.
    - `pnpm test` + `pnpm test:bdd` 100% vert.
  </behavior>
  <action>
    **Étape 1 : modifier vue `wizard/bien.ejs`** :
    - Remplacer le single `<button type="submit">Enregistrer le bien</button>` (ligne 106) par 2 boutons submit avec `formaction` qui dirige vers la même route mais avec query param :
      ```
      <div class="actions-fin-etape">
        <button type="submit" formaction="/wizard/bien">Enregistrer et continuer vers locataire</button>
        <button type="submit" formaction="/wizard/bien?terminer=1" class="secondary">Terminer — ajouter locataire et bail plus tard</button>
      </div>
      ```
    - Le pattern `formaction` est un attribut HTML5 standard qui permet à 2 boutons du même `<form>` de POSTer vers des URLs différentes — pas de JS requis.
    - Ajouter un `<small>` sous les boutons pour préciser le cas d'usage : "Vous pourrez créer le locataire et le bail plus tard depuis le menu principal."

    **Étape 2 : modifier vue `wizard/locataire.ejs`** :
    - Même pattern : 2 boutons (`/wizard/locataire` et `/wizard/locataire?terminer=1`).
    - Label du second : "Terminer — créer le bail plus tard".

    **Étape 3 : modifier route POST /wizard/bien dans `src/web/routes/wizard.ts`** :
    - Détecter le query param `terminer` : `const terminer = (req.query as Record<string, string>)?.terminer === '1'`.
    - Après le `creerBien` réussi :
      ```
      if (terminer) {
        await marquerWizardComplete(opts.db);
        app.log.info({ event: 'wizard_complete', bienId, locataireId: null, bailId: null });
        req.session.wizard = undefined;
        req.session.banniereSuccess = 'Bien enregistré. Vous pourrez ajouter un locataire et un bail quand vous le souhaitez.';
        return reply.redirect('/biens');
      }
      // Sinon, comportement existant : session.wizard.bienId = bienId, redirect /wizard/locataire.
      ```

    **Étape 4 : idem POST /wizard/locataire** :
    - Après `creerLocataire` réussi :
      ```
      if (terminer) {
        await marquerWizardComplete(opts.db);
        app.log.info({ event: 'wizard_complete', bienId: req.session.wizard?.bienId, locataireId, bailId: null });
        req.session.wizard = undefined;
        req.session.banniereSuccess = 'Locataire enregistré. Vous pourrez créer un bail plus tard depuis le menu Baux.';
        return reply.redirect('/biens');
      }
      // Sinon, comportement existant.
      ```

    **Étape 5 : CTA cross-link sur `/biens/:id` (détail bien)** :
    - Dans `src/web/views/pages/biens/detail.ejs`, après le bouton "Supprimer le bien" (ligne 18) ajouter une section "Actions" avec :
      ```html
      <h2>Actions sur ce bien</h2>
      <p>
        <a href="/locataires/nouveau?bienId=<%= bien.id %>" role="button" class="secondary">Ajouter un locataire pour ce bien</a>
        <a href="/baux/nouveau?bienId=<%= bien.id %>" role="button" class="secondary">Créer un bail sur ce bien</a>
      </p>
      <p><small>Astuce : commencez par créer un locataire, puis liez-le à ce bien via un bail.</small></p>
      ```
    - Note : `/locataires/nouveau` ne consomme pas encore `bienId` (le formulaire locataire ne propose pas de sélection bien — c'est `Bail` qui fait le lien). Le query param est conservé comme "intention" pour future amélioration UX, mais inutilisé pour l'instant. Pas de modif route locataires.
    - `/baux/nouveau?bienId=...` est DÉJÀ supporté (cf `baux.ts:98-110`).

    **Étape 6 : vérifier non-régression sur la page `/baux` (empty state)** :
    - `src/web/views/pages/baux/liste.ejs:7-13` rend déjà un empty state quand `biensCount === 0 || locatairesCount === 0`. Si user a Bien sans Locataire, l'empty state propose "Créer un locataire" — comportement correct, pas de modification.
    - Vérifier juste que cette branche fonctionne après que le wizard est skipé (Bien seul, 0 Locataire) : ouvrir `/baux` → empty state "Vous avez besoin d'au moins 1 bien et 1 locataire" avec CTA "Créer un locataire". OK.
    - Idem `/locataires` (vide après wizard Bien seul) → empty state "Aucun locataire pour l'instant" + CTA "Créer un locataire". OK.

    **Étape 7** : commit `feat(01-08): fix G2 — wizard skippable après étape Bien ou Locataire + CTAs cross-link (vert)`.
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm lint && pnpm test -- tests/integration/wizard/ && pnpm test:bdd</automated>
  </verify>
  <done>
    - POST /wizard/bien?terminer=1 → 302 /biens + Bien créé + meta.wizard_complete=1 + banner success.
    - POST /wizard/locataire?terminer=1 → 302 /biens + Bien + Locataire créés + meta.wizard_complete=1 + banner success.
    - `/biens/:id` (détail) affiche 2 CTAs "Ajouter un locataire pour ce bien" et "Créer un bail sur ce bien".
    - BDD scenarios 2 et 3 passent au vert.
    - Tests integration `wizard-skippable.test.ts` passent au vert.
    - Aucune régression sur le scenario BDD "wizard complet en une session".
    - `pnpm test` + `pnpm test:bdd` + `pnpm typecheck` + `pnpm lint` + `pnpm lint:deps` tous verts.
    - Commit `feat(01-08): fix G2 …` créé.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser→Fastify (form POST) | Untrusted user-controlled form data |
| Fastify route handler→domain use case | Trusted in-process call after Zod parse |
| domain→repository (SQLite) | Trusted, single tenant local-first |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-08-01 | I (Information disclosure) | `app.setErrorHandler` global | mitigate | Le handler ne renvoie QUE `err.message` (déjà sanitized par le domaine — InvariantViolated produit des messages métier sans données sensibles). Ne PAS sérialiser `err.stack` côté client. Log `err.stack` côté serveur uniquement (pino structuré). |
| T-01-08-02 | T (Tampering) | Query param `?terminer=1` sur POST /wizard/bien et /wizard/locataire | accept | Mono-user local-first (DV-02, D-06) : l'utilisateur peut déjà tout faire avec sa DB SQLite locale. Le param ne contourne aucune protection — il choisit juste un flux UX. |
| T-01-08-03 | E (Elevation) | `setErrorHandler` change le contrat des routes existantes | mitigate | Le handler distingue HTML vs JSON via Accept header. Pour les routes existantes (GET /biens, etc.), une erreur a aujourd'hui une 500 JSON ; après ce fix elle aura une 500 HTML pour browser. Comportement amélioré, pas dégradé. Ajouter un test de non-régression : `GET /biens?invalid` (route existante) doit toujours renvoyer 200 (pas d'effet). |
| T-01-08-04 | D (DoS) | Pages `/locataires` et `/baux` rendues avec listes vides | accept | Les empty states sont déjà testés (plan 01-03, 01-04, 01-05). Aucun changement de comportement. |
| T-01-08-05 | S (Spoofing) | Aucun changement d'auth — toujours mono-user local | accept | Local-first 127.0.0.1 only (D-06). Pas de surface d'attaque ajoutée. |
| T-01-08-06 | R (Repudiation) | `marquerWizardComplete` posé avec bailId:null pour le skip | mitigate | Log structuré pino `{event: 'wizard_complete', bienId, locataireId: null \| <id>, bailId: null}` — traçabilité de la sortie wizard préservée. Suffisant pour audit V1 mono-user. |
</threat_model>

<verification>
## Goal-backward Verification

Toutes les `truths` du frontmatter doivent être observables après ce plan. Pendant la VERIFICATION du plan, le checker doit :

1. **G1 reproduction manuelle** (must-have truth #1) : `pnpm start` → /wizard/bien → saisir un lot type=appartement sans surface → submit → vérifier que la page reste sur /wizard/bien avec une erreur visible sous le champ surface, pas de JSON 500.

2. **G1 setErrorHandler** (must-have truth #3) : grep `app.setErrorHandler` dans `src/main.ts` → doit retourner ≥1 match. Vérifier que le handler distingue `req.headers.accept`.

3. **G1 Zod superRefine** (must-have truth #4) : grep `superRefine` dans `src/web/schemas/bien-schemas.ts` → ≥1 match. Vérifier que les tests unit `bien-schemas.test.ts` couvrent les 4 cas.

4. **G2 reproduction manuelle** (must-have truth #5, #6) : `pnpm start` → /wizard/bien → saisir un bien valide → cliquer "Terminer plus tard" → vérifier redirection /biens + banner success + 0 locataire et 0 bail dans la DB.

5. **G2 CTAs cross-link** (must-have truth #8) : `pnpm start` → /biens/{id} → vérifier présence des 2 boutons "Ajouter un locataire pour ce bien" et "Créer un bail sur ce bien".

6. **Tests automatisés** : `pnpm test && pnpm test:bdd` 100% vert. Counts attendus : +6 tests integration (4 G1 + 2 G2), +4 tests unit (bien-schemas), +3 BDD scenarios (1 G1 + 2 G2).

7. **CI gates** : `pnpm typecheck && pnpm lint && pnpm lint:deps` 0 erreur (dependency-cruiser : aucun import technique ajouté dans `src/domain/**`).

8. **Non-régression** : tous les tests Phase 01 et Phase 02 existants restent verts.
</verification>

<success_criteria>
- G1 (3 niveaux complémentaires actifs) :
  - Niveau 1 (Zod) : `lotCreationSchema.safeParse({type:'appartement', surface:null})` échoue avec issue.path=['surface'].
  - Niveau 2 (try/catch route) : POST /wizard/bien lance le re-render sans 500 même si on bypass Zod (test mock du repo qui throw).
  - Niveau 3 (setErrorHandler) : toute erreur non catchée d'une route arbitraire produit une page HTML pour Accept: text/html, JSON pour Accept: application/json.
- G2 :
  - POST /wizard/bien?terminer=1 clôt le wizard après création du Bien seul. Banner success affiché. /biens accessible.
  - POST /wizard/locataire?terminer=1 clôt le wizard après création de Bien + Locataire (pas de Bail). Banner success affiché.
  - Page /biens/:id (détail bien) propose 2 CTAs "Ajouter un locataire pour ce bien" et "Créer un bail sur ce bien".
  - Pages /locataires et /baux gèrent proprement l'état vide (non-régression).
- Tests automatisés :
  - `pnpm test` 100% vert avec +6 tests integration + +4 tests unit.
  - `pnpm test:bdd` 100% vert avec +3 scenarios.
  - `pnpm typecheck && pnpm lint && pnpm lint:deps` 0 erreur.
- Commits :
  - 3 commits atomiques avec messages `test(01-08): …`, `feat(01-08): … G1`, `feat(01-08): … G2`.
- Documentation :
  - Aucune modification PRD/SPEC requise (scope V1 LMNP solo confirmé par CLAUDE.md "top priority"). L'UAT P02 a remonté le décalage scope ; ce plan le ferme.
  - Si nécessaire en VERIFICATION : amender ROADMAP §Phase 1 success criteria #5 pour mentionner "OU 1 Bien seul" (la version actuelle dit "1 Bien + 1 Locataire + 1 Bail").
</success_criteria>

<risk_register>

| ID | Risque | Probabilité | Impact | Mitigation |
|----|--------|-------------|--------|-----------|
| R1 | `superRefine` casse `wizardBailSchema` (LEARNINGS §"ZodEffects bloque .omit") | basse | moyen | `wizardBailSchema` (`wizard-schemas.ts:14`) n'utilise PAS `lotCreationSchema` — il a son propre schéma bail. Seul `bienCreationSchema.lots` consomme `lotCreationSchema` via `z.array(...)`. Le superRefine se propage SEULEMENT au niveau du tableau, pas au niveau du schéma parent. **Vérification** : `pnpm typecheck` doit rester vert. |
| R2 | `setErrorHandler` global capture trop de routes et masque des comportements voulus | moyenne | moyen | Le handler ne fait que (1) log + (2) render erreur.ejs OU JSON. Les routes existantes qui catch leurs erreurs avec `reply.code(404)` ou autre ne sont PAS impactées (le handler n'est appelé QUE si l'erreur remonte au framework). **Vérification** : tests Phase 02 (qui ont leur propre try/catch dans encaissements.ts, baux.ts) doivent rester verts. |
| R3 | Le scenario BDD existant "wizard complet en une session" casse à cause du nouveau bouton "Terminer plus tard" | basse | élevé | Le bouton par défaut (form submit sans formaction) reste "Enregistrer et continuer". Le scenario BDD utilise submit form simple → comportement préservé. **Vérification** : `pnpm test:bdd` 100% vert obligatoire avant commit. |
| R4 | `?terminer=1` peut être détourné via redirection si le wizard préHandler est mal placé | basse | bas | Le préHandler wizard guard `req.url.startsWith('/wizard/')` reste actif et redirige /biens si déjà complété. Le `?terminer=1` n'agit que sur le handler POST lui-même, pas sur le routing. Mono-user local (D-06) — pas de surface d'attaque réelle. |
| R5 | La vue `pages/erreur.ejs` (nouvelle) n'inclut pas correctement layout-debut/fin si elle est appelée hors session valide (ex : `setErrorHandler` avant init session) | basse | moyen | Le layout-debut accepte `navActive: null` (cf locataires/formulaire.ejs:8). Tester avec un throw dans un GET / pour vérifier rendu. Fallback : si layout-debut échoue, `reply.code(500).send('<h1>Erreur</h1><p>...</p>')` HTML inline minimal. |
| R6 | Le param `?bienId=...` sur `/locataires/nouveau` est ignoré → CTA cross-link UX dégradé mais fonctionnel | acceptée | bas | Documenté dans le PLAN comme "intention future". Suffit pour l'instant que l'utilisateur navigue depuis la fiche bien sans perdre le contexte. Pas de refacto requis. |
| R7 | Les empty states sur `/locataires` et `/baux` sont déjà testés mais pas avec le scénario "wizard skipped" | basse | bas | Les tests intégration wizard-skippable couvrent l'état post-wizard. Ajouter optionnellement un assert "GET /locataires retourne 200 + heading 'Aucun locataire pour l'instant'" si la couverture est insuffisante. |

</risk_register>

<file_change_summary>

| Fichier | Action | Tâche | Pourquoi |
|---------|--------|-------|----------|
| `tests/bdd/features/activation.feature` | modify | 1 | +3 scenarios G1 + G2 |
| `tests/bdd/step_definitions/activation.steps.ts` | modify | 1 | +5 steps (statusCode, content-type, table SQLite count, terminer=1, meta.wizard_complete) |
| `tests/integration/wizard/wizard-validation-erreurs.test.ts` | create | 1 | +6 tests integration G1 |
| `tests/integration/wizard/wizard-skippable.test.ts` | create | 1 | +2 tests integration G2 |
| `tests/unit/web/bien-schemas.test.ts` | create | 1 | +4 tests unit Zod superRefine |
| `src/web/schemas/bien-schemas.ts` | modify | 2 | Ajout `.superRefine` sur `lotCreationSchema` |
| `src/web/routes/wizard.ts` | modify | 2 + 3 | try/catch sur 3 use cases + détection `?terminer=1` sur 2 routes |
| `src/web/views/pages/wizard/locataire.ejs` | modify | 3 | 2 boutons submit (continuer / terminer plus tard) |
| `src/web/views/pages/wizard/bien.ejs` | modify | 3 | 2 boutons submit (continuer / terminer plus tard) |
| `src/web/views/pages/wizard/bail.ejs` | (touch) | 2 | Vérifier qu'erreurs._global est affiché (sinon ajout minimal — déjà fait par partial wizard-layout). |
| `src/web/views/pages/biens/detail.ejs` | modify | 3 | Section "Actions sur ce bien" avec 2 CTAs cross-link |
| `src/web/views/pages/erreur.ejs` | create | 2 | Vue 500 générique pour `setErrorHandler` HTML branch |
| `src/main.ts` | modify | 2 | Ajout `app.setErrorHandler(...)` avec branchement HTML/JSON |

**Total** : 8 fichiers modifiés + 4 fichiers créés = 12 fichiers touchés.

**Volume estimé** : ~150-200 lignes de code source + ~250 lignes de tests. Bien dans la fourchette ~50% context d'une session de 3 tasks.

</file_change_summary>

<output>
After completion, create `.planning/phases/01-activation-bien-locataire-bail/01-08-gap-closure-uat-p02-SUMMARY.md` suivant le template gsd, incluant :
- Récap des 3 commits (test rouge + 2 fix vert)
- Résumé des fix G1 (3 niveaux) et G2 (skippable + cross-link CTAs)
- Test counts avant/après
- Décisions clés (formaction HTML5 standard, setErrorHandler HTML vs JSON, Zod superRefine pour défense en profondeur)
- Surprises rencontrées (le cas échéant — auto-fixes documentés selon LEARNINGS pattern)
- Pointer vers `02-UAT.md` Gap G1, G2 marqués `status: closed` après ce plan.

Mettre à jour `.planning/STATE.md` :
- Décrémenter le compteur de gaps ouverts.
- Ajouter une décision : "Phase 01 amendement : wizard skippable post-step 1 et post-step 2 — alignement scope V1 LMNP solo (CLAUDE.md top priority)".

Mettre à jour `.planning/ROADMAP.md` §Phase 1 success criteria #5 si nécessaire :
- Version actuelle : "L'utilisateur peut, en une session unique, aboutir à 1 Bien + 1 Locataire + 1 Bail visibles dans une liste persistée."
- Version amendée proposée : "L'utilisateur peut, en une session unique, aboutir à au minimum 1 Bien visible dans une liste persistée (et optionnellement 1 Locataire + 1 Bail si pertinent pour son cas d'usage)."
- À valider au moment de la VERIFICATION post-exécution.
</output>

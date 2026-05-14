---
phase: 02
plan: 07
plan_id: "02-07"
type: execute
wave: 7
depends_on: ["02-01", "02-02", "02-03", "02-04", "02-05", "02-06"]
gap_closure: true
files_modified:
  - src/web/views/partials/empty-state.ejs
  - src/web/views/pages/quittances/liste.ejs
  - src/web/views/pages/quittances/fiche.ejs
  - src/web/views/pages/bailleur/profil.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/pages/relances/liste.ejs
  - src/web/routes/echeances.ts
  - src/web/routes/quittances.ts
  - src/web/routes/relances.ts
  - src/web/views/pages/echeances/liste-globale.ejs
  - src/web/views/pages/relances/ouverture-mail.ejs
  - src/application/encaissements/lister-echeances.ts
  - src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
  - src/domain/encaissements/echeance-loyer-repository.ts
  - src/main.ts
  - tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts
  - tests/integration/web/relances-mailto.test.ts
  - tests/unit/views/empty-state.test.ts
  - tests/bdd/features/quittancement.feature
  - tests/bdd/features/relances.feature
  - tests/bdd/step_definitions/relances.steps.ts
  - tests/bdd/step_definitions/gaps-g6-g7.steps.ts
autonomous: true
requirements: ["ENC-02", "ENC-03", "ENC-04", "ENC-05"]
user_setup: []

closes_gaps:
  - id: "G3"
    severity: minor
    description: "Bouton CTA vide rendu inconditionnellement par empty-state.ejs quand ctaUrl=null + ctaLabel=null"
  - id: "G4"
    severity: minor
    description: "Bannière succès dupliquée 4/4 — double-include systémique (layout-debut + 5 pages)"
  - id: "G5"
    severity: minor
    description: "actifDepuis non affiché sur fiche bail (champ persisté mais invisible UI)"
  - id: "G6"
    severity: major
    description: "Filtres bail/statut absents sur /echeances (route + page globales manquantes)"
  - id: "G7"
    severity: minor
    description: "Discoverability 'Générer quittance' — option A : CTA sur /quittances → /echeances?statut=payee"
  - id: "G8"
    severity: major
    description: "POST /relances ignore mailtoUri pour canal email — niveaux 1+2 n'ouvrent pas le mailto"

must_haves:
  truths:
    - "G3 closed : empty-state.ejs ne rend AUCUN élément CTA (ni `<a>`, ni texte) quand ctaUrl=null ou ctaLabel=null. Pages /quittances et autres consommateurs avec CTA conditionnel n'affichent plus de bouton vide cliquable. Test unitaire de rendu prouve les deux branches (CTA présent vs CTA absent)."
    - "G4 closed : aucune bannière flash succès n'est dupliquée. layout-debut.ejs:24 reste l'UNIQUE point de rendu de banniere-success.ejs. Les 5 pages (profil bailleur, baux/detail, quittances/liste, quittances/fiche, relances/liste) ne ré-incluent plus banniere-success."
    - "G5 closed : la fiche bail (/baux/:id) affiche explicitement `Actif depuis : DD/MM/YYYY` quand `bail.actifDepuis !== null`. Le formatage utilise formatDate. Le champ n'est PAS affiché pour les baux brouillons (actifDepuis === null)."
    - "G6 closed : GET /echeances (NOUVELLE route globale) liste TOUTES les échéances tous baux confondus, avec filtres `?bail=<bailId>` et `?statut=<en_attente|partiellement_payee|payee|annulee>`. La page expose un `<form method=GET>` avec `<select name=bail>` peuplé via locataireRepo + bailRepo et `<select name=statut>`. Les filtres se cumulent (bail ET statut). La route GET /baux/:id/echeances existante reste inchangée."
    - "G7 closed : la page /quittances affiche un CTA primary 'Émettre une quittance' qui redirige vers `/echeances?statut=payee`. Le CTA est TOUJOURS visible (que la liste de quittances soit vide ou pleine). Sur /echeances avec statut=payee, les échéances payées sans quittance active affichent le bouton 'Générer quittance' (réutilise le pattern existant de la page per-bail)."
    - "G8 closed : POST /relances pour canal='email' (niveaux 1 et 2) répond avec une page HTML `pages/relances/ouverture-mail.ejs` (status 200, Content-Type: text/html) contenant : (1) `<script>window.location.href='<%= mailtoUri %>'</script>` qui auto-déclenche l'ouverture du client mail, (2) un lien fallback `<a href=<%= mailtoUri %>>Ouvrir le mail</a>` visible (JS désactivé), (3) un lien retour `/impayes`, (4) un message bannière de succès. Le canal pdf (niveau 3) reste inchangé (Content-Type: application/pdf, body buffer PDF — régression couverte par test integration)."
  artifacts:
    - path: "src/web/views/partials/empty-state.ejs"
      provides: "Empty-state partial sans bouton vide quand CTA absent"
      contains: "<% if (locals.ctaUrl && locals.ctaLabel) { %>"
    - path: "src/web/views/pages/echeances/liste-globale.ejs"
      provides: "Vue globale /echeances avec filtres bail + statut"
      contains: "<form method=\"GET\" action=\"/echeances\""
    - path: "src/web/views/pages/relances/ouverture-mail.ejs"
      provides: "Page intermédiaire qui auto-trigger window.location.href = mailtoUri"
      contains: "window.location.href"
    - path: "src/web/routes/echeances.ts"
      provides: "Nouvelle route GET /echeances (globale, avec filtres) en plus de GET /baux/:id/echeances existante"
      contains: "app.get('/echeances'"
    - path: "src/web/routes/relances.ts"
      provides: "Branche canal='email' modifiée — retourne reply.view au lieu de redirect"
      contains: "ouverture-mail"
    - path: "src/web/views/pages/quittances/liste.ejs"
      provides: "CTA 'Émettre une quittance' toujours visible (G7)"
      contains: "/echeances?statut=payee"
    - path: "src/web/views/pages/baux/detail.ejs"
      provides: "Affichage actifDepuis (G5)"
      contains: "Actif depuis"
    - path: "src/domain/encaissements/echeance-loyer-repository.ts"
      provides: "Méthode listerTous avec filtres optionnels {bailId?, statut?}"
      exports: ["EcheanceLoyerRepository", "FiltresEcheanceLoyer"]
    - path: "tests/unit/views/empty-state.test.ts"
      provides: "Test render empty-state partial — assert CTA présent ssi (ctaUrl && ctaLabel)"
    - path: "tests/integration/web/relances-mailto.test.ts"
      provides: "Test integration POST /relances : (a) canal email retourne HTML 200 contenant mailto: + script, (b) canal pdf reste application/pdf inchangé (régression)"
  key_links:
    - from: "src/web/routes/relances.ts"
      to: "src/web/views/pages/relances/ouverture-mail.ejs"
      via: "reply.view('pages/relances/ouverture-mail.ejs', { mailtoUri, niveau, retourUrl: '/impayes' }) pour canal='email'"
      pattern: "ouverture-mail"
    - from: "src/web/views/pages/quittances/liste.ejs"
      to: "src/web/views/pages/echeances/liste-globale.ejs"
      via: "CTA '<a href=/echeances?statut=payee>Émettre une quittance</a>'"
      pattern: "/echeances\\?statut=payee"
    - from: "src/web/routes/echeances.ts"
      to: "src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts"
      via: "listerTous({bailId?, statut?}) appelé depuis GET /echeances"
      pattern: "listerTous"
    - from: "src/web/views/pages/baux/detail.ejs"
      to: "src/helpers/format-date.ts"
      via: "formatDate(bail.actifDepuis) quand bail.actifDepuis !== null"
      pattern: "Actif depuis"
---

<objective>
Fermer 6 gaps découverts en UAT phase 02 (G3, G4, G5, G6, G7, G8). Trois sont triviaux (G3, G4, G5 : views EJS pure), deux sont couplés (G6, G7 : nouvelle vue globale /echeances + filtres, CTA depuis /quittances), un est isolé mais sensible (G8 : modification du flow POST /relances pour ouvrir mailto:).

Purpose: Phase 02 a passé la vérification programmatique (5/5 must-haves, 36/36 BDD, 229/229 unit) mais le test utilisateur a remonté 6 défauts d'UX/feature qui empêchent l'usage réel. Aucun ne réouvre une décision produit majeure — tous sont des compléments d'implémentation ou des corrections d'anti-patterns. Plan compact, scope contenu, aucune nouvelle dette technique.

Output: 6 gaps fermés, tests existants verts (régression nulle), 4 nouveaux tests (1 unit render G3 empty-state, 1 integration repo listerTous G6, 1 integration POST /relances mailto G8 + régression PDF, plus BDD scenarios G6 ×4 + G7 ×1 + G8 ×1), aucune migration SQL (toutes les données nécessaires existent déjà en BDD). 5 commits atomiques (un par gap + un pour G6+G7 couplés).

**Note sur la terminologie** : ce plan utilise le terme "Étape" pour découper l'exécution séquentielle interne. Le numéro `wave: 7` du frontmatter désigne la position de CE plan dans la phase 02 (après plans 02-01..02-06). Les "Étape 1, 2, 3..." dans les tasks ci-dessous sont des étapes d'exécution interne à un task, pas des waves du DAG.
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-CONTEXT.md
@.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-VERIFICATION.md
@.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md
@.planning/debug/g4-banniere-flash-dupliquee.md
@.planning/debug/g8-relance-mailto-pas-ouvert.md
@CLAUDE.md
@BDD_PRACTICES.md
@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md
@src/web/views/partials/layout-debut.ejs
@src/web/views/partials/banniere-success.ejs
@src/web/views/partials/empty-state.ejs
@src/web/views/partials/relance-action.ejs
@src/web/views/pages/quittances/liste.ejs
@src/web/views/pages/quittances/fiche.ejs
@src/web/views/pages/bailleur/profil.ejs
@src/web/views/pages/baux/detail.ejs
@src/web/views/pages/relances/liste.ejs
@src/web/views/pages/echeances/liste.ejs
@src/web/views/pages/impayes/liste.ejs
@src/web/routes/echeances.ts
@src/web/routes/quittances.ts
@src/web/routes/relances.ts
@src/web/routes/impayes.ts
@src/web/routes/baux.ts
@src/main.ts
@src/application/encaissements/lister-echeances.ts
@src/application/encaissements/enregistrer-relance.ts
@src/domain/encaissements/echeance-loyer-repository.ts
@src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
@src/helpers/format-date.ts
@src/helpers/format-periode.ts
@src/helpers/build-mailto.ts
@tests/_world/monde-phase2.ts
@tests/bdd/step_definitions/relances.steps.ts
</context>

<interfaces>
Contrats clés :

**G3 (empty-state) — pure view fix**
- `partials/empty-state.ejs` accepte locals `{ heading, body, ctaUrl?, ctaLabel?, ctaAlt? }`.
- Comportement actuel (buggy) : rend toujours `<a href="<%= locals.ctaUrl %>" role="button"><%= locals.ctaLabel %></a>` même si l'un ou l'autre est null/undefined → produit `<a href="" role="button"></a>` cliquable et vide.
- Comportement attendu : si `locals.ctaUrl` ET `locals.ctaLabel` sont truthy, rendre le `<a>`. Sinon ne rien rendre. (ctaAlt déjà conditionnel — pas de changement).
- Pas de breaking change pour les consommateurs existants (`biens/liste.ejs`, `locataires/liste.ejs`, `encaissements/*` qui passent les deux).

**G4 (bannière dupliquée) — pure view fix**
- Source unique de rendu : `partials/layout-debut.ejs:24` `<%- include('banniere-success', { message: locals.banniereSuccess ?? null }) %>`.
- Suppression des 5 ré-includes dans : `pages/bailleur/profil.ejs:7-9`, `pages/baux/detail.ejs:9`, `pages/quittances/liste.ejs:7`, `pages/quittances/fiche.ejs:10`, `pages/relances/liste.ejs:11-13`.
- ATTENTION ASYMÉTRIE : `layout-debut.ejs` n'inclut PAS `banniere-warning` ni `warning-live`. Les ré-includes de warning DOIVENT être conservés. Ne toucher QUE les `banniere-success`.
- Pour `pages/quittances/fiche.ejs:10` : la ligne contient `<%- include('../../partials/banniere-success', ...) %>` à supprimer ; la ligne 11 `<%- include('../../partials/warning-live', ...) %>` doit rester.
- Pour `pages/baux/detail.ejs:9` : supprimer banniere-success. La ligne 10 (`banniere-warning`) reste.

**G5 (actifDepuis affiché) — pure view fix**
- Dans `pages/baux/detail.ejs`, section "Période" (lignes 42-46 actuelles), AJOUTER après `<dt>Durée</dt><dd>... mois</dd>` :
  ```
  <% if (bail.actifDepuis !== null) { %>
    <dt>Actif depuis</dt>
    <dd><%= formatDate(bail.actifDepuis) %></dd>
  <% } %>
  ```
- Le helper `formatDate` est déjà disponible via `preHandler` (injecté dans `reply.locals`).
- Ne pas afficher pour `bail.actifDepuis === null` (bail brouillon).

**G6 (filtres /echeances) — nouvelle vue globale**
- NOUVELLE route GET `/echeances` (existante : seulement GET `/baux/:id/echeances`). Coexistence : les deux routes restent indépendantes.
- Query params parsés (tous optionnels) :
  - `bail` (UUID) : filtre `WHERE bail_id = ?`
  - `statut` ∈ `'en_attente' | 'partiellement_payee' | 'payee' | 'annulee'` : filtre `WHERE statut = ?`
- Extension `EcheanceLoyerRepository` port : ajouter `listerTous(filtres?: { bailId?: BailId; statut?: StatutEcheanceLoyer }): Promise<EcheanceLoyer[]>`. Tri par `periode_debut DESC` (échéances les plus récentes en premier — cohérent avec "vue admin globale").
- Implémentation SQLite : Kysely paramétré, ne PAS filtrer `annule_le IS NULL` automatiquement (les utilisateurs peuvent vouloir voir les annulées). Tri périodeDebut DESC, secondaire jourEcheanceAttendue ASC.
- Route GET /echeances :
  - parse query params (string, validation simple : si statut !∈ liste blanche → renvoyer page sans filtre statut)
  - récupérer liste filtrée via `echeanceLoyerRepo.listerTous({ bailId, statut })`
  - Pour le `<select bail>`, charger TOUS les baux via `bailRepo.listerTous()` (vérifier la signature ; sinon utiliser la méthode utilisée par `wizard.ts` ou `baux.ts` pour la page index).
  - Enrichir chaque échéance avec locataire + bail (pour affichage : "Bail X — Locataire Y").
  - Passer à la vue : `echeances`, `baux` (pour `<select>`), `bailFiltre`, `statutFiltre`, `navActive: 'echeances'`.
- Vue `pages/echeances/liste-globale.ejs` (nouveau fichier, NE PAS écraser `pages/echeances/liste.ejs` qui sert /baux/:id/echeances) :
  - Layout-debut titre "Toutes les échéances", breadcrumbs `[{ label: 'Échéances' }]`, navActive 'echeances'.
  - `<h1>Toutes les échéances</h1>`.
  - `<form method="GET" action="/echeances">` :
    - `<select name="bail">` : option vide "— Tous les baux —" + une option par bail (libellé "Locataire X — Bail #UUID8"). Selected si `bailFiltre === bail.id`.
    - `<select name="statut">` : option vide "— Tous les statuts —" + options en_attente / partiellement_payee / payee / annulee (libellés français : "En attente" / "Partiellement payée" / "Payée" / "Annulée"). Selected si `statutFiltre === valeur`.
    - `<button type="submit">Filtrer</button>` + `<a href="/echeances">Réinitialiser</a>` (lien sans param = filtre vide).
  - Tableau colonnes : Locataire | Bail (id court) | Période | Échéance le | Total | Statut | Actions.
  - Pour chaque ligne, colonne Actions :
    - "PDF avis" si statut !== 'annulee' → `<a href=/echeances/:id/avis-pdf>`.
    - "Saisir un encaissement" si statut !== 'annulee' && !== 'payee' → `<a href=/encaissements/nouveau?echeance=:id>`.
    - "Générer quittance" si statut === 'payee' && !echeance.quittanceActive (à enrichir côté route — déjà fait dans page per-bail).
    - "Voir le bail" → `<a href=/baux/:id>`.
  - Sidebar : ajouter lien dans `partials/sidebar-nav.ejs` (sous le `<details>` Encaissements) : "Échéances" → /echeances avec navActive 'echeances'.

**G7 (CTA /quittances) — option A retenue**
- Dans `pages/quittances/liste.ejs` :
  - Cas liste vide : remplacer le `empty-state.ejs` qui passait `ctaLabel: null, ctaUrl: null` (G3 fix le bouton vide en attendant) par `ctaLabel: 'Émettre une quittance', ctaUrl: '/echeances?statut=payee'`.
  - Cas liste non vide : ajouter un `<a href="/echeances?statut=payee" role="button">Émettre une quittance</a>` AVANT le tableau (header de page, pattern habituel "primary action above the fold").
- Aucune route additionnelle, aucune logique métier — pure UX d'orientation.
- ATTENTION : avec G3 fixé, si on garde `ctaLabel: null` sur la page vide, plus aucun CTA. C'est pourquoi G7 demande explicitement le passage à `ctaLabel: 'Émettre une quittance'` ici.

**G8 (mailto pas ouvert) — vraie correction du flow POST**
- État actuel `src/web/routes/relances.ts:114-116` :
  ```ts
  // Canal email : redirect vers /impayes avec bannière succès
  req.session.banniereSuccess = `Relance niveau ${niveau} enregistrée.`;
  return reply.redirect('/impayes');
  ```
  Le `resultat.mailtoUri` retourné par `enregistrerRelance` (typage `{ canal: 'email'; mailtoUri: string }`) est silencieusement JETÉ.

- Nouvel état :
  ```ts
  // Canal email (niveaux 1, 2) : afficher page intermédiaire qui auto-trigger le mailto
  req.session.banniereSuccess = `Relance niveau ${niveau} enregistrée.`; // pour le retour ultérieur
  return reply.view('pages/relances/ouverture-mail.ejs', {
    mailtoUri: resultat.mailtoUri,
    niveau,
    retourUrl: '/impayes',
    navActive: 'relances',
  });
  ```

- Nouvelle vue `pages/relances/ouverture-mail.ejs` :
  - `layout-debut` titre 'Ouverture du client mail', breadcrumbs `[{ url: '/impayes', label: 'Impayés' }, { label: 'Relance enregistrée' }]`, navActive 'relances'.
  - `<h1>Relance niveau <%= niveau %> enregistrée</h1>`.
  - `<p>Le client mail va s'ouvrir automatiquement avec un brouillon pré-rempli. Si rien ne se passe, cliquez sur le bouton ci-dessous.</p>`.
  - `<p><a href="<%= mailtoUri %>" role="button">Ouvrir le mail</a></p>` (FALLBACK — visible pour JS désactivé OU navigateur qui bloque le redirect mailto JS).
  - `<p><a href="<%= retourUrl %>">← Retour aux impayés</a></p>`.
  - `<script>window.location.href = <%- JSON.stringify(mailtoUri) %>;</script>` AVANT `layout-fin`. **CRITIQUE** : utiliser `<%- JSON.stringify(mailtoUri) %>` pour échapper proprement les guillemets/CR/LF dans la string JS (sécurité XSS) — surtout pas `'<%= mailtoUri %>'`.
  - `layout-fin`.
- Le CSP global actuel autorise `'unsafe-inline'` script (cf. main.ts:138) — donc le `<script>` inline fonctionne sans changement CSP.
- ASYMÉTRIE volontaire : canal pdf (niveau 3) reste inchangé (Content-Type: application/pdf, body = buffer). Différence justifiée : PDF est natif navigateur, mailto exige un pont JS.
- Le `req.session.banniereSuccess` reste posée — apparaîtra quand l'utilisateur reviendra sur /impayes (via le lien de retour ou en cliquant à nouveau dans le menu). Cohérent avec UX existante.

**Extension EcheanceLoyerRepository (port + adapter)**
- `domain/encaissements/echeance-loyer-repository.ts` : ajouter
  ```ts
  /** Liste toutes les échéances avec filtres optionnels. Tri périodeDebut DESC.
   *  Contrairement à listerParBail, NE FILTRE PAS annule_le par défaut (statut='annulee' visible si demandé). */
  listerTous(filtres?: { bailId?: BailId; statut?: StatutEcheanceLoyer }): Promise<EcheanceLoyer[]>;
  ```
- `infrastructure/repositories/echeance-loyer-repository-sqlite.ts` :
  ```ts
  async listerTous(filtres: { bailId?: BailId; statut?: StatutEcheanceLoyer } = {}): Promise<EcheanceLoyer[]> {
    let q = this.db.selectFrom('echeance_loyer').selectAll();
    if (filtres.bailId) q = q.where('bail_id', '=', filtres.bailId);
    if (filtres.statut) q = q.where('statut', '=', filtres.statut);
    const rows = await q.orderBy('periode_debut', 'desc').orderBy('jour_echeance_attendue', 'asc').execute();
    return rows.map((r) => this.versDomaine(r as EcheanceLoyerRow));
  }
  ```
- `application/encaissements/lister-echeances.ts` : ajouter wrapper léger
  ```ts
  export async function listerToutesEcheances(
    filtres: { bailId?: BailId; statut?: StatutEcheanceLoyer },
    echeanceLoyerRepo: EcheanceLoyerRepository,
  ): Promise<EcheanceLoyer[]> {
    return echeanceLoyerRepo.listerTous(filtres);
  }
  ```
- Hexagonal pur : aucun import infra dans application/, le port est consommé via injection.

</interfaces>

<risks>
Trois risques user-flagged à mitiger explicitement durant l'exécution :

**R1 — G8 modifie POST /relances → risque de casser test 13 (PDF niveau 3)**
- Probabilité : moyenne (branche pdf intacte par structure mais touchée par voisinage).
- Impact : élevé (régression du seul flow relance qui fonctionnait).
- Mitigation :
  1. Garder LA BRANCHE `if (resultat.canal === 'pdf') { return reply.header('Content-Type', 'application/pdf')... }` STRICTEMENT inchangée — uniquement modifier la branche `email`.
  2. Test integration explicite (Task 5 G8) : `POST /relances` avec niveau=3 sur échéance backdatée → assert `response.statusCode === 200`, `response.headers['content-type'] === 'application/pdf'`, body est un Buffer. Doit rester VERT après le fix email.
  3. BDD scenario `@enc-05-niveau-3-pdf-non-regresse` ajouté.

**R2 — G4 suppression des 5 ré-includes → risque qu'une page attende le success en double et l'omette**
- Probabilité : faible (le layout fait DÉJÀ le rendu N°1 — supprimer le rendu N°2 garantit unicité).
- Impact : moyen (perte silencieuse du feedback succès = mauvaise UX, pas un crash).
- Mitigation :
  1. AVANT suppression, `grep -rn "include.*banniere-success" src/web/views/pages/` pour lister les 5 call sites — vérifier qu'ils correspondent exhaustivement à `pages/bailleur/profil.ejs`, `pages/baux/detail.ejs`, `pages/quittances/liste.ejs`, `pages/quittances/fiche.ejs`, `pages/relances/liste.ejs`.
  2. APRÈS suppression, `grep -rn "include.*banniere-success" src/web/views/` doit retourner UNE seule occurrence (dans `partials/layout-debut.ejs:24`) + une dans `partials/layout.ejs:24` (alternatif, OK).
  3. Smoke check : `pnpm dev` + naviguer manuellement sur chacune des 5 pages après une action déclenchant `banniereSuccess` — observer 1 seule bannière. (Cette étape reste à exécution-time car automatisable seulement via Playwright qu'on n'a pas en stack ; vérifier la cohérence via grep + lint.)
  4. Toutes les routes posant `req.session.banniereSuccess` (cf. quittances.ts:104, 214, echeances.ts:119, etc.) continuent à le faire — pas de changement côté routes.

**R3 — G6 filtres → impact perf si listerEcheances ne supporte pas WHERE optimisés**
- Probabilité : faible en V1 (volumes < 1000 échéances).
- Impact : faible (latence GET /echeances ; pas de bug fonctionnel).
- Mitigation :
  1. La méthode `listerTous` utilise Kysely avec `.where('bail_id', '=', ?)` + `.where('statut', '=', ?)` — paramètres SQL natifs, SQLite optimise via index.
  2. Vérifier l'existence d'un index `CREATE INDEX IF NOT EXISTS idx_echeance_bail ON echeance_loyer(bail_id);` dans les migrations existantes (cf. `migrations/0004_*` qui crée la table `echeance_loyer`). Si absent : ne PAS ajouter de migration dans ce plan (scope creep) ; documenter dans le SUMMARY pour traitement V1.1.
  3. Documenter EXPLAIN QUERY PLAN dans le SUMMARY si l'index manque, pour audit fiscal futur (volumes ↗).

</risks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → API GET /echeances | Query params `bail`, `statut` non sanitisés par défaut |
| client → API POST /relances | Body form (echeanceId, niveau) déjà validé par Zod (relanceFormSchema) |
| server → browser (vue ouverture-mail.ejs) | mailtoUri injecté dans `<script>` inline + dans `<a href>` |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-07-01 | Tampering (XSS via mailtoUri) | `views/pages/relances/ouverture-mail.ejs` | mitigate | Injection JS via `<%- JSON.stringify(mailtoUri) %>` (échappement guillemets+CR+LF). Pour `<a href>` utiliser `<%= mailtoUri %>` (EJS échappe les `<`, `>`, `"`, `'`). Le `mailtoUri` provient de `buildMailto()` qui encode RFC 6068 (URL-encode). |
| T-02-07-02 | Injection (SQL via query bail/statut) | `routes/echeances.ts` GET /echeances + `repositories/echeance-loyer-repository-sqlite.ts::listerTous` | mitigate | Kysely paramétré (`.where('bail_id', '=', filtres.bailId)`) → liaison SQL native, immunise contre injection. `statut` validé par whitelist `STATUTS_VALIDES` avant SQL. `bail` accepté tel quel (UUID malformé → 0 résultat, pas d'erreur). |
| T-02-07-03 | Information disclosure (énumération bailId via filtre) | `routes/echeances.ts` GET /echeances?bail=X | accept | Application mono-utilisateur (V1 single-user) — pas de surface d'attaque par énumération entre tenants. Cohérent avec décision produit "single-user" (CLAUDE.md). |
| T-02-07-04 | Denial of Service (large query sans filtre) | GET /echeances sans params | accept | Volumes V1 LMNP < 1000 échéances (cf. PRD). Tri SQL, aucun fetch additionnel sauf jointures map en mémoire (deux Maps locataire+bail). Performance acceptable jusqu'à ~10k lignes. À revisiter V2 si nécessaire. |
| T-02-07-05 | Repudiation (relance enregistrée mais pas envoyée par email) | POST /relances canal=email | accept | Comportement attendu : `enregistrerRelance` trace UNIQUEMENT le clic utilisateur (intent), pas la réception. C'est le `contenu_snapshot` qui sert d'audit. Le mailto: dépend du client mail utilisateur — hors-périmètre traçabilité serveur. Documenté en BDD. |
| T-02-07-06 | Elevation (POST sans CSRF) | POST /relances | accept | Pas de CSRF protection en V1 (single-user local). Décision produit (CLAUDE.md "Local-first + Single-user"). À revisiter avant exposition réseau. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1 — Étape 1a (G3) : empty-state.ejs CTA conditionnel + test unit render</name>
  <read_first>
    - src/web/views/partials/empty-state.ejs
    - src/web/views/pages/quittances/liste.ejs (lignes 12-18 : consommateur qui passe ctaLabel=null + ctaUrl=null — déclenche le bug)
    - src/web/views/pages/locataires/liste.ejs (consommateur conforme — passe ctaLabel + ctaUrl)
    - src/web/views/pages/biens/liste.ejs (consommateur conforme)
    - src/web/views/pages/echeances/liste.ejs (consommateur — vérifier qu'il ne casse pas avec ctaLabel non passé)
    - src/web/views/pages/encaissements/liste.ejs (consommateur conforme)
    - src/web/views/pages/encaissements/formulaire.ejs (consommateur conforme)
    - tests/unit/views/ (si existe — sinon créer le dossier ; vérifier le pattern de test ejs render — chercher dans `tests/unit/` un test existant qui rend un partial via `ejs.render()`)
    - .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md (Gap G3 — root cause `partials/empty-state.ejs:4`)
  </read_first>
  <behavior>
    **Test unitaire de rendu** (`tests/unit/views/empty-state.test.ts`) — assert le partial rend correctement les deux branches :
    - T1 (CTA présent) : render avec `{ heading: 'Vide', body: 'Texte', ctaUrl: '/foo', ctaLabel: 'Foo' }` → output contient `<a href="/foo" role="button">Foo</a>`.
    - T2 (CTA absent — ctaLabel null) : render avec `{ heading: 'Vide', body: 'Texte', ctaUrl: '/foo', ctaLabel: null }` → output ne contient AUCUN `<a` (ni href ni role=button).
    - T3 (CTA absent — ctaUrl null) : render avec `{ heading: 'Vide', body: 'Texte', ctaUrl: null, ctaLabel: 'Foo' }` → output ne contient AUCUN `<a`.
    - T4 (CTA absent — les deux null) : render avec `{ heading: 'Vide', body: 'Texte', ctaUrl: null, ctaLabel: null }` → output ne contient AUCUN `<a`, et n'a PAS de chaîne `role="button"` dans le HTML.

    Pattern recommandé : utiliser `ejs.renderFile(path.join(VIEWS_DIR, 'partials/empty-state.ejs'), locals)` directement dans le test (synchrone via API ejs). Pas besoin de bootstrap Fastify.
  </behavior>
  <action>
    **Étape 1 — Modifier `src/web/views/partials/empty-state.ejs`**
    Remplacer le contenu actuel par :
    ```
    <section aria-label="État vide">
      <h1><%= locals.heading %></h1>
      <p><%= locals.body %></p>
      <% if (locals.ctaUrl && locals.ctaLabel) { %>
        <a href="<%= locals.ctaUrl %>" role="button"><%= locals.ctaLabel %></a>
      <% } %>
      <% if (locals.ctaAlt) { %>
        <a href="<%= locals.ctaAlt.url %>" role="button" class="secondary"><%= locals.ctaAlt.label %></a>
      <% } %>
    </section>
    ```
    Le wrapper conditionnel `if (locals.ctaUrl && locals.ctaLabel)` garantit qu'aucun `<a>` n'est rendu si l'un ou l'autre est absent. Comportement précédent (rendu inconditionnel d'un `<a href="" role="button"></a>` vide) corrigé.

    Note hors-scope : le consommateur `pages/echeances/liste.ejs:22-25` passe `{ message, action: null }` (convention différente `{ heading, body, ctaUrl, ctaLabel }`) — bug pré-existant identifié, NE PAS le corriger ici (changement hors-périmètre).

    **Étape 2 — Créer `tests/unit/views/empty-state.test.ts`** avec les 4 tests décrits dans `<behavior>`.
    Squelette :
    ```ts
    import { describe, it, expect } from 'vitest';
    import ejs from 'ejs';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const PARTIAL_PATH = path.resolve(__dirname, '../../../src/web/views/partials/empty-state.ejs');

    async function rendre(locals: Record<string, unknown>): Promise<string> {
      return ejs.renderFile(PARTIAL_PATH, locals, { async: true });
    }

    describe('partials/empty-state.ejs', () => {
      it('rend le lien CTA quand ctaUrl et ctaLabel sont fournis', async () => {
        const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: '/foo', ctaLabel: 'Foo' });
        expect(html).toContain('<a href="/foo" role="button">Foo</a>');
      });

      it('ne rend AUCUN <a> quand ctaLabel est null', async () => {
        const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: '/foo', ctaLabel: null });
        // pas de balise <a au sens primaire (ctaAlt non passé donc safe)
        expect(html.match(/<a\b/)).toBeNull();
      });

      it('ne rend AUCUN <a> quand ctaUrl est null', async () => {
        const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: null, ctaLabel: 'Foo' });
        expect(html.match(/<a\b/)).toBeNull();
      });

      it('ne rend AUCUN <a> quand les deux sont null (régression du bug G3)', async () => {
        const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: null, ctaLabel: null });
        expect(html.match(/<a\b/)).toBeNull();
        expect(html).not.toContain('role="button"');
      });
    });
    ```
    Vérifier que `ejs` est déjà en dépendance directe (probablement oui via `template-renderer-ejs.ts`). Sinon utiliser un import compatible.

    **Étape 3 — Commit**
    Message : `fix(02-07): G3 empty-state CTA conditionnel + test render`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/unit/views/empty-state.test.ts && grep -c "if (locals.ctaUrl && locals.ctaLabel)" src/web/views/partials/empty-state.ejs</automated>
  </verify>
  <done>
    - empty-state.ejs : wrapper conditionnel ajouté, `grep -c "if (locals.ctaUrl && locals.ctaLabel)" = 1`.
    - tests/unit/views/empty-state.test.ts : 4 tests VERTS (1 CTA présent + 3 cas CTA absent).
    - `pnpm test` global reste VERT (régression nulle sur les 229 unit existants).
    - 1 commit créé : `fix(02-07): G3 empty-state CTA conditionnel + test render`.
  </done>
</task>

<task type="auto">
  <name>Task 2 — Étape 1b (G4) : suppression des 5 ré-includes banniere-success</name>
  <read_first>
    - src/web/views/partials/layout-debut.ejs (ligne 24 : rendu unique conservé)
    - src/web/views/partials/banniere-success.ejs (partial sans logique défensive — confirmer)
    - src/web/views/partials/banniere-warning.ejs (à NE PAS toucher)
    - src/web/views/partials/warning-live.ejs (à NE PAS toucher)
    - src/web/views/pages/bailleur/profil.ejs (lignes 1-12 — vérifier structure avant suppression)
    - src/web/views/pages/baux/detail.ejs (lignes 1-15 — ligne 9 = banniere-success, ligne 10 = banniere-warning à conserver)
    - src/web/views/pages/quittances/fiche.ejs (lignes 1-15 — ligne 10 banniere-success, ligne 11 warning-live à conserver)
    - src/web/views/pages/quittances/liste.ejs (lignes 1-10 — ligne 7 banniere-success, ligne 8 warning-live à conserver)
    - src/web/views/pages/relances/liste.ejs (lignes 1-15 — lignes 11-13 bloc banniere-success conditionnel à supprimer)
    - .planning/debug/g4-banniere-flash-dupliquee.md (root cause confirmée — 5 fichiers identifiés)
    - .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md (Gap G4)
  </read_first>
  <action>
    Pour CHAQUE fichier ci-dessous, SUPPRIMER UNIQUEMENT la ligne d'include de `banniere-success` (et son wrapper `<% if %>` si présent). NE PAS toucher aux includes de `banniere-warning`, `warning-live`, ni au reste de la page. Le rendu de `banniere-success` reste assuré par `layout-debut.ejs:24` (rendu N°1 unique).

    1. `src/web/views/pages/bailleur/profil.ejs` — supprimer le bloc :
       ```
       <% if (locals.banniereSuccess) { %>
         <%- include('../../partials/banniere-success', { message: banniereSuccess }) %>
       <% } %>
       ```
       (Lignes ≈ 7-9 — vérifier numéros exacts avant édition.)
       Conserver le reste : `<h1>Profil bailleur</h1>` etc.

    2. `src/web/views/pages/baux/detail.ejs` — supprimer la ligne :
       ```
       <%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>
       ```
       (Ligne 9 ; CONSERVER ligne 10 `banniere-warning`.)

    3. `src/web/views/pages/quittances/liste.ejs` — supprimer la ligne :
       ```
       <%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>
       ```
       (Ligne 7 ; CONSERVER ligne 8 `warning-live`.)

    4. `src/web/views/pages/quittances/fiche.ejs` — supprimer la ligne :
       ```
       <%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>
       ```
       (Ligne 10 ; CONSERVER ligne 11 `warning-live` et le bloc warning-live conditionnel lignes 13-21.)

    5. `src/web/views/pages/relances/liste.ejs` — supprimer le bloc :
       ```
       <% if (banniereSuccess) { %>
         <%- include('../../partials/banniere-success', { message: banniereSuccess }) %>
       <% } %>
       ```
       (Lignes 11-13.)

    **Vérification post-modifs (mitigation R2)** :
    - `grep -rn "include.*banniere-success" src/web/views/pages/` doit retourner 0 ligne.
    - `grep -rn "include.*banniere-success" src/web/views/partials/` doit retourner exactement 2 occurrences (`layout-debut.ejs:24` + `layout.ejs:24`).
    - Le flux `banniereSuccess` reste passé aux locals par les routes (`/bailleur`, `/baux/:id`, `/quittances`, `/relances`) → `layout-debut.ejs:24` continue à le rendre une seule fois. Aucun changement de route nécessaire.

    **Commit** : `fix(02-07): G4 dédoublonne banniere-success (suppression 5 ré-includes pages)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test && pnpm test:bdd && test "$(grep -rln "include.*banniere-success" src/web/views/pages/ | wc -l | tr -d ' ')" = "0" && test "$(grep -rln "include.*banniere-success" src/web/views/partials/ | wc -l | tr -d ' ')" = "2"</automated>
  </verify>
  <done>
    - 5 fichiers `pages/*.ejs` modifiés : aucun ne contient plus d'include vers `banniere-success`.
    - `grep` confirme 0 occurrence dans `pages/`, 2 dans `partials/` (layout-debut + layout).
    - Tests existants verts (229 unit, 36 BDD).
    - 1 commit créé : `fix(02-07): G4 dédoublonne banniere-success (suppression 5 ré-includes pages)`.
  </done>
</task>

<task type="auto">
  <name>Task 3 — Étape 1c (G5) : affichage actifDepuis sur fiche bail</name>
  <read_first>
    - src/web/views/pages/baux/detail.ejs (lignes 42-46 : section "Période" — point d'insertion)
    - src/helpers/format-date.ts (vérifier la signature `formatDate(d: Temporal.PlainDate | null): string`)
    - src/main.ts (preHandler qui injecte formatDate dans reply.locals — vérifier qu'il est globalement disponible)
    - .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md (Gap G5)
  </read_first>
  <action>
    **Modifier `src/web/views/pages/baux/detail.ejs`** — section "Période" (lignes 42-46 actuelles).

    Code actuel :
    ```
    <h2>Période</h2>
    <dl>
      <dt>Date de début</dt><dd><%= formatDate(bail.dateDebut) %></dd>
      <dt>Durée</dt><dd><%= bail.dureeMois %> mois</dd>
    </dl>
    ```

    Code après modification (ajouter le bloc conditionnel `Actif depuis` après la durée) :
    ```
    <h2>Période</h2>
    <dl>
      <dt>Date de début</dt><dd><%= formatDate(bail.dateDebut) %></dd>
      <dt>Durée</dt><dd><%= bail.dureeMois %> mois</dd>
      <% if (bail.actifDepuis !== null) { %>
        <dt>Actif depuis</dt>
        <dd><%= formatDate(bail.actifDepuis) %></dd>
      <% } %>
    </dl>
    ```

    Le helper `formatDate` est injecté globalement via `preHandler` dans `main.ts` (déjà disponible dans le scope EJS comme `formatDate(bail.dateDebut)` à la ligne 44 le prouve). Aucun ajout dans la route nécessaire.

    Vérification :
    - Un bail brouillon (`actifDepuis === null`) n'affiche RIEN (bloc conditionnel falsy).
    - Un bail activé affiche `<dt>Actif depuis</dt><dd>DD/MM/YYYY</dd>`.

    **Commit** : `fix(02-07): G5 affiche actifDepuis sur fiche bail`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test && pnpm test:bdd && grep -c "Actif depuis" src/web/views/pages/baux/detail.ejs</automated>
  </verify>
  <done>
    - baux/detail.ejs contient le bloc `<% if (bail.actifDepuis !== null) { %><dt>Actif depuis</dt>...` ajouté.
    - `grep -c "Actif depuis" src/web/views/pages/baux/detail.ejs >= 1`.
    - Tests existants verts (229 unit, 36 BDD).
    - 1 commit créé : `fix(02-07): G5 affiche actifDepuis sur fiche bail`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4 — Étape 2 (G6 + G7 couplés) : route GET /echeances globale avec filtres bail/statut + CTA depuis /quittances</name>
  <read_first>
    - src/web/routes/echeances.ts (signature complète plugin + GET /baux/:id/echeances ligne 140-171 pour pattern)
    - src/web/routes/impayes.ts (analog : route plugin avec filtres + enrichissement locataire + nav)
    - src/web/views/pages/echeances/liste.ejs (NE PAS écraser — sert /baux/:id/echeances)
    - src/web/views/pages/impayes/liste.ejs (analog : page avec filtre `<select>` + tableau)
    - src/web/views/partials/sidebar-nav.ejs
    - src/web/views/pages/quittances/liste.ejs (pour la modif G7)
    - src/domain/encaissements/echeance-loyer-repository.ts (port à étendre)
    - src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts (adapter à étendre — patterns listerParBail / listerNonPayees)
    - src/application/encaissements/lister-echeances.ts (wrapper léger existant)
    - src/main.ts (lignes 151-159 : registration echeancesPlugin — vérifier les deps)
    - tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts (lignes 1-100 : pattern beforeEach + creerEcheance helper)
    - tests/bdd/features/quittancement.feature (pour ajouter scenarios @gap-G6 et @gap-G7)
    - tests/bdd/step_definitions/quittancement.steps.ts (pour ajouter steps si nécessaire — vérifier les steps Given déjà créés)
    - tests/bdd/step_definitions/relances.steps.ts (lignes 80-150 : pattern `creerBailAvecEcheance` helper insertion DB directe — réutilisable)
    - src/web/routes/baux.ts (pour la méthode `listerTous` du bailRepo — vérifier qu'elle existe, sinon utiliser le pattern existant pour récupérer tous les baux)
    - .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md (Gaps G6, G7)
  </read_first>
  <behavior>
    **Tests integration repo (extension `tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts`)** — ajout d'un `describe('listerTous')` avec 4 tests :
    - T1 : sans filtre, 4 échéances en DB (statuts variés : 1 en_attente, 1 partiellement_payee, 1 payee, 1 annulee, 2 bails distincts) → retourne 4 résultats triés par periode_debut DESC.
    - T2 : filtre `{ bailId: bail1.id }` → retourne UNIQUEMENT les échéances de bail1 (2 sur 4).
    - T3 : filtre `{ statut: 'payee' }` → retourne UNIQUEMENT l'échéance statut='payee' (1 sur 4).
    - T4 : filtre combiné `{ bailId: bail1.id, statut: 'en_attente' }` → retourne UNIQUEMENT l'échéance de bail1 avec statut='en_attente'.

    **Tests BDD nouveaux** (étendre `tests/bdd/features/quittancement.feature` avec scenarios @gap-G6 + @gap-G7 — 4 scenarios G6 + 1 scenario G7 en 2 états) :

    Scenarios @gap-G6 (couvre exhaustivement les 4 cas filtres) :
    - `@gap-G6` Scenario A — sans filtre : Given 2 baux activés avec échéances variées (B1 = 3 en_attente, B2 = 2 payee) ; When GET `/echeances` → 5 lignes affichées.
    - `@gap-G6` Scenario B — filtre statut seul : When GET `/echeances?statut=payee` → 2 lignes (les payées).
    - `@gap-G6` Scenario C — filtre bail seul : When GET `/echeances?bail=<B1.id>` → 3 lignes (uniquement B1).
    - `@gap-G6` Scenario D — filtre combiné : When GET `/echeances?bail=<B1.id>&statut=en_attente` → 3 lignes (B1 en_attente).

    Scenarios @gap-G7 (couvre les 2 états — liste vide ET liste non-vide — per must_haves truth #58) :
    - `@gap-G7` Scenario A — liste vide : Given aucune quittance en DB ; When GET `/quittances` → la page contient un lien/bouton "Émettre une quittance" pointant vers `/echeances?statut=payee`.
    - `@gap-G7` Scenario B — liste non-vide : Given 1 quittance émise en DB ; When GET `/quittances` → la page contient un lien/bouton "Émettre une quittance" pointant vers `/echeances?statut=payee` (CTA reste visible).

    **Step "Then la page affiche N lignes d'échéances"** : utiliser un parsing ancré entre `<tbody>` et `</tbody>` (m11) :
    ```ts
    const tbodyMatch = this.dernierCorps.match(/<tbody>([\s\S]*?)<\/tbody>/);
    const tbody = tbodyMatch ? tbodyMatch[1] : '';
    const trCount = (tbody.match(/<tr\b/g) ?? []).length;
    assert.strictEqual(trCount, attendu);
    ```
    Évite de compter les `<tr>` de `<thead>`.
  </behavior>
  <action>
    **Étape 1 — Extension domaine `EcheanceLoyerRepository`** (`src/domain/encaissements/echeance-loyer-repository.ts`) :
    Ajouter dans l'interface :
    ```ts
    /**
     * Liste toutes les échéances avec filtres optionnels.
     * - filtres.bailId : restreint à un bail (UUID).
     * - filtres.statut : restreint à un statut donné.
     * Tri primaire periode_debut DESC, secondaire jour_echeance_attendue ASC.
     * NE FILTRE PAS automatiquement annule_le — les annulées sont visibles si statut='annulee' demandé.
     */
    listerTous(filtres?: { bailId?: BailId; statut?: StatutEcheanceLoyer }): Promise<EcheanceLoyer[]>;
    ```

    **Étape 2 — Adapter SQLite** (`src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts`) :
    Ajouter la méthode :
    ```ts
    async listerTous(filtres: { bailId?: BailId; statut?: StatutEcheanceLoyer } = {}): Promise<EcheanceLoyer[]> {
      let q = this.db.selectFrom('echeance_loyer').selectAll();
      if (filtres.bailId !== undefined) {
        q = q.where('bail_id', '=', filtres.bailId);
      }
      if (filtres.statut !== undefined) {
        q = q.where('statut', '=', filtres.statut);
      }
      const rows = await q
        .orderBy('periode_debut', 'desc')
        .orderBy('jour_echeance_attendue', 'asc')
        .execute();
      return rows.map((r) => this.versDomaine(r as EcheanceLoyerRow));
    }
    ```

    **Étape 3 — Tests integration repo** : étendre `tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts` avec un `describe('listerTous')` après les `describe` existants. Réutiliser le `beforeEach` + helper `creerEcheance`. Créer 4 échéances comme décrit en `<behavior>`, exercer les 4 tests T1-T4. Tests RED : `listerTous` n'existe pas → fail à compile-time. Puis tests GREEN après ajout de la méthode.

    **Étape 4 — Use case `listerToutesEcheances`** (`src/application/encaissements/lister-echeances.ts`) :
    Ajouter dans le fichier existant (qui contient déjà `listerEcheancesParBail`) :
    ```ts
    import type { StatutEcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';

    /**
     * Use case : lister TOUTES les échéances avec filtres optionnels.
     * Wrapper léger. La logique de tri/filtrage est dans le repo.
     */
    export async function listerToutesEcheances(
      filtres: { bailId?: BailId; statut?: StatutEcheanceLoyer },
      echeanceLoyerRepo: EcheanceLoyerRepository,
    ): Promise<EcheanceLoyer[]> {
      return echeanceLoyerRepo.listerTous(filtres);
    }
    ```
    Garder `listerEcheancesParBail` inchangé.

    **Étape 5 — Route GET /echeances** : modifier `src/web/routes/echeances.ts` pour ajouter une nouvelle route AVANT les routes existantes (lisibilité — la route globale en premier). NE PAS toucher aux routes existantes (`/baux/:id/activer`, `/baux/:id/echeances`, `/echeances/:id/avis-pdf`).

    Validation des query params : whitelist statut explicite, bailId en string (validation lâche acceptée — un UUID invalide retournera 0 résultat car la query SQLite ne matchera rien).

    Signature étendue du plugin : la route a besoin de `bailRepo` (déjà fourni), `locataireRepo` (déjà fourni), `echeanceLoyerRepo` (déjà fourni), aucune nouvelle dépendance.

    Code de la route :
    ```ts
    // GET /echeances — liste globale avec filtres optionnels (gap G6)
    const STATUTS_VALIDES: ReadonlySet<string> = new Set([
      'en_attente', 'partiellement_payee', 'payee', 'annulee',
    ]);

    app.get('/echeances', async (req, reply) => {
      const query = req.query as { bail?: string; statut?: string };
      const bailFiltre = query.bail && query.bail.length > 0 ? query.bail : null;
      const statutFiltre = query.statut && STATUTS_VALIDES.has(query.statut)
        ? (query.statut as StatutEcheanceLoyer)
        : null;

      const filtres: { bailId?: BailId; statut?: StatutEcheanceLoyer } = {};
      if (bailFiltre) filtres.bailId = bailFiltre as BailId;
      if (statutFiltre) filtres.statut = statutFiltre;

      const echeances = await listerToutesEcheances(filtres, opts.echeanceLoyerRepo);

      // Pour le <select bail>, charger tous les baux + leurs locataires (libellé)
      const tousLesBaux = await opts.bailRepo.listerTous();
      const locataires = await opts.locataireRepo.listerTous();
      const locataireParId = new Map(locataires.map((l) => [l.id, l]));

      // Enrichir chaque échéance avec son locataire (pour affichage)
      const bauxParId = new Map(tousLesBaux.map((b) => [b.id, b]));
      const lignes = echeances.map((e) => {
        const bail = bauxParId.get(e.bailId);
        const locataire = bail ? locataireParId.get(bail.locataireId) : undefined;
        return {
          echeance: e,
          locataireNomComplet: locataire ? `${locataire.prenom} ${locataire.nom}` : '—',
        };
      });

      const bauxPourSelect = tousLesBaux.map((b) => ({
        id: b.id,
        libelle: (() => {
          const loc = locataireParId.get(b.locataireId);
          return loc ? `${loc.prenom} ${loc.nom} — Bail ${b.id.substring(0, 8)}` : `Bail ${b.id.substring(0, 8)}`;
        })(),
      }));

      return reply.view('pages/echeances/liste-globale.ejs', {
        lignes,
        bauxPourSelect,
        bailFiltre,
        statutFiltre,
        navActive: 'echeances',
      });
    });
    ```

    Imports à ajouter en haut de echeances.ts :
    ```ts
    import { listerToutesEcheances } from '../../application/encaissements/lister-echeances.js';
    import type { StatutEcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
    ```

    **VÉRIFICATION CRITIQUE — méthodes repo `listerTous`** : avant d'écrire le code ci-dessus, VÉRIFIER l'existence de `bailRepo.listerTous()` et `locataireRepo.listerTous()`. Si elles n'existent pas, utiliser les méthodes équivalentes (probablement `lister()` ou similaire — chercher dans `src/infrastructure/repositories/bail-repository-sqlite.ts` et `locataire-repository-sqlite.ts`). Adapter le code en conséquence — ne PAS ajouter de nouvelle méthode au port si une existe déjà.

    **Étape 6 — Nouvelle vue `src/web/views/pages/echeances/liste-globale.ejs`** :
    ```ejs
    <%- include('../../partials/layout-debut', {
      titre: 'Toutes les échéances',
      breadcrumbs: [{ label: 'Échéances' }],
      navActive: 'echeances'
    }) %>

    <h1>Toutes les échéances</h1>

    <form method="GET" action="/echeances" style="margin-bottom: 1rem;">
      <label for="filtre-bail">Bail
        <select id="filtre-bail" name="bail">
          <option value="">— Tous les baux —</option>
          <% bauxPourSelect.forEach(function(b) { %>
            <option value="<%= b.id %>"<%= bailFiltre === b.id ? ' selected' : '' %>><%= b.libelle %></option>
          <% }); %>
        </select>
      </label>

      <label for="filtre-statut">Statut
        <select id="filtre-statut" name="statut">
          <option value="">— Tous les statuts —</option>
          <option value="en_attente"<%= statutFiltre === 'en_attente' ? ' selected' : '' %>>En attente</option>
          <option value="partiellement_payee"<%= statutFiltre === 'partiellement_payee' ? ' selected' : '' %>>Partiellement payée</option>
          <option value="payee"<%= statutFiltre === 'payee' ? ' selected' : '' %>>Payée</option>
          <option value="annulee"<%= statutFiltre === 'annulee' ? ' selected' : '' %>>Annulée</option>
        </select>
      </label>

      <button type="submit">Filtrer</button>
      <a href="/echeances" role="button" class="secondary">Réinitialiser</a>
    </form>

    <% if (lignes.length === 0) { %>
      <%- include('../../partials/empty-state', {
        heading: 'Aucune échéance ne correspond aux filtres',
        body: bailFiltre || statutFiltre ? 'Modifiez les filtres ou réinitialisez-les pour voir toutes les échéances.' : 'Aucune échéance générée pour le moment. Activez un bail pour générer ses échéances.',
        ctaLabel: bailFiltre || statutFiltre ? 'Réinitialiser les filtres' : 'Voir les baux',
        ctaUrl: bailFiltre || statutFiltre ? '/echeances' : '/baux'
      }) %>
    <% } else { %>
    <div role="region" aria-label="Tableau des échéances">
      <table>
        <thead>
          <tr>
            <th scope="col">Locataire</th>
            <th scope="col">Bail</th>
            <th scope="col">Période</th>
            <th scope="col">Échéance le</th>
            <th scope="col">Total</th>
            <th scope="col">Statut</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          <% lignes.forEach(function(ligne) { %>
          <% var e = ligne.echeance; %>
          <tr>
            <td><%= ligne.locataireNomComplet %></td>
            <td><a href="/baux/<%= e.bailId %>"><%= e.bailId.substring(0, 8) %></a></td>
            <td><%= formatPeriode(e.periodeDebut) %></td>
            <td><%= formatDate(e.jourEcheanceAttendue) %></td>
            <td><strong><%= formatMoney(e.total) %></strong></td>
            <td>
              <% if (e.statut === 'payee') { %>Payée
              <% } else if (e.statut === 'partiellement_payee') { %>Partielle
              <% } else if (e.statut === 'annulee') { %>Annulée
              <% } else { %>En attente
              <% } %>
            </td>
            <td>
              <% if (e.statut !== 'annulee') { %>
                <a href="/echeances/<%= e.id %>/avis-pdf">Avis PDF</a>
              <% } %>
              <% if (e.statut !== 'annulee' && e.statut !== 'payee') { %>
                &nbsp; <a href="/encaissements/nouveau?echeance=<%= e.id %>">Encaisser</a>
              <% } %>
              <% if (e.statut === 'payee') { %>
                &nbsp;
                <form method="POST" action="/quittances" style="display:inline;">
                  <input type="hidden" name="echeanceId" value="<%= e.id %>" />
                  <button type="submit">Générer quittance</button>
                </form>
              <% } %>
            </td>
          </tr>
          <% }); %>
        </tbody>
      </table>
    </div>
    <% } %>

    <%- include('../../partials/layout-fin') %>
    ```

    NOTE (M9 — side-effect documenté) : la branche empty-state avec `ctaLabel/ctaUrl conditionnels au filtre actif` est un side-effect naturel de l'usage du partial empty-state.ejs (corrigé en G3). Cohérent avec l'UX : si l'utilisateur a appliqué un filtre qui ne matche rien, on lui propose "Réinitialiser les filtres" ; sinon "Voir les baux". UAT n'a pas demandé ça explicitement mais c'est la conséquence logique de consommer empty-state.ejs et d'éviter le bouton vide.

    NOTE bouton "Générer quittance" : peut produire un doublon si une quittance active existe déjà (le POST échouera côté serveur via `QuittanceDejaEmise`). Acceptable V1 (cohérent avec la page per-bail qui filtre via `quittanceActive` mais nécessiterait un enrichissement plus lourd ici — DEFERRED V1.1 si l'utilisateur signale). Le serveur gère correctement le double-clic (400 + message).

    **Étape 7 — Sidebar nav** (`src/web/views/partials/sidebar-nav.ejs`) :
    Dans le `<details>` "Encaissements", ajouter un `<li>` "Toutes les échéances" en première position du sous-menu :
    ```
    <li>
      <a href="/echeances"<% if (locals.navActive === 'echeances') { %> aria-current="page"<% } %>>Toutes les échéances</a>
    </li>
    ```
    Vérifier la condition `navActive === 'echeances'` dans le `<details open>` — si elle n'existe pas, l'ajouter.

    **Étape 8 — G7 : CTA depuis /quittances** (`src/web/views/pages/quittances/liste.ejs`) :

    Le fichier actuel passe `ctaLabel: null, ctaUrl: null` dans l'empty-state. Modifier :

    A) Empty state (lignes 12-18 actuelles, après le fix G4 elles seront décalées) :
    ```
    <% if (quittancesEnrichies.length === 0) { %>
      <%- include('../../partials/empty-state', {
        heading: 'Aucune quittance émise',
        body: 'Émettez votre première quittance depuis une échéance payée.',
        ctaLabel: 'Émettre une quittance',
        ctaUrl: '/echeances?statut=payee'
      }) %>
    <% } else { %>
    ```

    B) Header avant le tableau (entre `<h1>Quittances de loyer</h1>` et le `<% if quittancesEnrichies.length === 0 %>`) :
    Ajouter :
    ```
    <p>
      <a href="/echeances?statut=payee" role="button">Émettre une quittance</a>
    </p>
    ```
    (visible que la liste soit vide ou non — primary action above the fold ; couvre m12 : CTA visible dans les 2 états).

    **Étape 9 — Tests BDD** (`tests/bdd/features/quittancement.feature` + step definitions) :

    Vérifier que `quittancement.feature` existe — sinon ajouter à un nouveau fichier `tests/bdd/features/gaps-echeances-quittances.feature` tagué `@gap-G6 @gap-G7`.

    Ajouter 6 scenarios (4 G6 + 2 G7) :
    ```gherkin
    @gap-G6 @phase2
    Scenario: GET /echeances liste toutes les échéances tous baux confondus (sans filtre)
      Given un bail activé "B1" avec 3 échéances en_attente
      And un bail activé "B2" avec 2 échéances payee
      When le bailleur navigue vers GET /echeances
      Then la page affiche 5 lignes d'échéances
      And la page affiche un select "Bail" avec 2 options de baux
      And la page affiche un select "Statut" avec 4 options de statuts

    @gap-G6 @phase2
    Scenario: GET /echeances?statut=payee filtre par statut
      Given un bail activé "B1" avec 3 échéances en_attente
      And un bail activé "B2" avec 2 échéances payee
      When le bailleur navigue vers GET /echeances?statut=payee
      Then la page affiche 2 lignes d'échéances

    @gap-G6 @phase2
    Scenario: GET /echeances?bail=<B1.id> filtre par bail
      Given un bail activé "B1" avec 3 échéances en_attente
      And un bail activé "B2" avec 2 échéances payee
      When le bailleur navigue vers GET /echeances?bail=<B1.id>
      Then la page affiche 3 lignes d'échéances

    @gap-G6 @phase2
    Scenario: GET /echeances?bail=<B1.id>&statut=en_attente filtres combinés
      Given un bail activé "B1" avec 3 échéances en_attente
      And un bail activé "B2" avec 2 échéances payee
      When le bailleur navigue vers GET /echeances?bail=<B1.id>&statut=en_attente
      Then la page affiche 3 lignes d'échéances

    @gap-G7 @phase2
    Scenario: Page /quittances expose un CTA "Émettre une quittance" quand la liste est vide
      Given aucune quittance émise en base
      When le bailleur navigue vers GET /quittances
      Then la page contient un lien/bouton "Émettre une quittance"
      And ce lien pointe vers "/echeances?statut=payee"

    @gap-G7 @phase2
    Scenario: Page /quittances expose un CTA "Émettre une quittance" quand la liste contient déjà des quittances
      Given une quittance émise en base
      When le bailleur navigue vers GET /quittances
      Then la page contient un lien/bouton "Émettre une quittance"
      And ce lien pointe vers "/echeances?statut=payee"
    ```

    Steps (`tests/bdd/step_definitions/gaps-g6-g7.steps.ts`) :
    - `Before({ tags: '@gap-G6 or @gap-G7' })` qui boot l'app via `creerApp(db)` avec `ClockFixe`.
    - `After({ tags: '@gap-G6 or @gap-G7' })` qui ferme l'app.
    - Step `Given un bail activé "X" avec N échéances <statut>` qui insère les rows directement en DB (pattern du fichier `relances.steps.ts:84-150` helper `creerBailAvecEcheance`, en boucle N fois, statut paramétré).
    - Step `Given une quittance émise en base` qui insère une quittance via SQL direct (pas besoin du use case complet pour ce smoke).
    - Step `Given aucune quittance émise en base` no-op (DB vierge en `beforeEach`).
    - Step `When le bailleur navigue vers GET <URL>` qui fait `app.inject({ method: 'GET', url: '...' })`.
    - Step `Then la page affiche N lignes d'échéances` qui parse le HTML entre `<tbody>...</tbody>` et compte `<tr` (ancré dans tbody — m11 mitigé) :
      ```ts
      const tbodyMatch = this.dernierCorps.match(/<tbody>([\s\S]*?)<\/tbody>/);
      const tbody = tbodyMatch ? tbodyMatch[1] : '';
      const trCount = (tbody.match(/<tr\b/g) ?? []).length;
      assert.strictEqual(trCount, N);
      ```
    - Step `Then la page affiche un select "Bail" avec N options de baux` : parse le `<select name="bail">` et compte les `<option value="<uuid>"` (exclut l'option vide).
    - Step `Then la page affiche un select "Statut" avec N options de statuts` : parse le `<select name="statut">` et compte les `<option value="<non-vide>"`.
    - Step `Then la page contient un lien/bouton "X"` : `assert.ok(this.dernierCorps.includes('X'))`.
    - Step `Then ce lien pointe vers "Y"` : `assert.ok(this.dernierCorps.match(/href="[^"]*Y[^"]*"/))`.

    **Étape 10 — Vérifications** :
    - `pnpm tsc --noEmit` exit 0.
    - `pnpm lint` 0 warning.
    - `pnpm lint:deps` 0 violation.
    - `pnpm test` tout VERT (les 229 unit + nouveaux integration `listerTous`).
    - `pnpm test:bdd --tags @gap-G6` 4 scenarios VERTS.
    - `pnpm test:bdd --tags @gap-G7` 2 scenarios VERTS.
    - `pnpm test:bdd` tout VERT (régressions @enc-01..@enc-05).

    Sécurité (cf. `<threat_model>` T-02-07-02, T-02-07-03, T-02-07-04) :
    - Query params `bail` et `statut` validés par whitelist (statut ∈ ensemble fermé, bail accepté tel quel mais SQLite paramétré → pas d'injection).
    - Aucune écriture déclenchée depuis GET /echeances.

    Performance (cf. `<risks>` R3) : vérifier l'existence d'un index `idx_echeance_bail` sur `echeance_loyer(bail_id)` dans les migrations. Si absent, documenter dans le SUMMARY pour V1.1 — ne PAS ajouter de migration dans ce plan (scope creep).

    **Commit** : `feat(02-07): G6 vue globale /echeances + filtres bail/statut + G7 CTA Émettre quittance`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && pnpm lint:deps && pnpm test && pnpm test:bdd --tags "@gap-G6 or @gap-G7" && pnpm test:bdd && grep -c "app.get('/echeances'," src/web/routes/echeances.ts && grep -c "listerTous" src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts && grep -c "/echeances?statut=payee" src/web/views/pages/quittances/liste.ejs && test -f src/web/views/pages/echeances/liste-globale.ejs</automated>
  </verify>
  <done>
    - Port `EcheanceLoyerRepository` étendu : `listerTous(filtres?)` typé `{ bailId?, statut? }`.
    - Adapter SQLite : méthode `listerTous` implémentée avec Kysely paramétré + tri périodeDebut DESC.
    - Use case `listerToutesEcheances` ajouté dans `lister-echeances.ts`.
    - Route GET `/echeances` (NOUVELLE, distincte de GET /baux/:id/echeances) : `grep -c "app.get('/echeances'," src/web/routes/echeances.ts >= 1`.
    - Vue `pages/echeances/liste-globale.ejs` créée (test -f OK).
    - Sidebar nav ajoute lien "Toutes les échéances" sous Encaissements.
    - `pages/quittances/liste.ejs` : `grep -c "/echeances?statut=payee" >= 2` (1 dans empty-state, 1 dans header above-the-fold).
    - Tests integration `listerTous` : 4 tests VERTS.
    - Tests BDD `@gap-G6` : 4 scenarios VERTS (sans filtre / statut / bail / combiné).
    - Tests BDD `@gap-G7` : 2 scenarios VERTS (liste vide / liste non-vide).
    - Régression : tous les tests existants restent VERTS (229 unit + 36 BDD `@enc-*`).
    - 1 commit créé : `feat(02-07): G6 vue globale /echeances + filtres bail/statut + G7 CTA Émettre quittance`.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 5 — Étape 3 (G8) : POST /relances canal email rend page intermédiaire ouverture-mail (auto-trigger window.location.href + fallback)</name>
  <read_first>
    - src/web/routes/relances.ts (lignes 80-123 : handler POST /relances, branche email lignes 114-116 à modifier — branche pdf lignes 107-112 à NE PAS toucher)
    - src/web/views/partials/relance-action.ejs (form HTML actuel — confirmera qu'aucun JS client n'existe)
    - src/web/views/pages/relances/liste.ejs (référence pour structure layout-debut/fin)
    - src/web/views/pages/impayes/liste.ejs (cible du lien retour)
    - src/web/views/partials/layout-debut.ejs (titre/breadcrumbs/navActive pattern)
    - src/web/views/partials/layout-fin.ejs (fermeture HTML standard)
    - src/application/encaissements/enregistrer-relance.ts (ligne 159 : confirme que le résultat canal='email' inclut bien `mailtoUri: string`)
    - src/helpers/build-mailto.ts (confirme que mailtoUri est encodé RFC 6068)
    - tests/bdd/step_definitions/relances.steps.ts (lignes 80-150 : helper `creerBailAvecEcheance` pour bootstrapper l'échéance impayée backdatée)
    - tests/bdd/features/relances.feature (vérifier qu'il existe — sinon utiliser le fichier .feature de phase 2 contenant les scenarios @enc-05)
    - src/main.ts (ligne 138 environ : CSP — confirmer que `'unsafe-inline'` est autorisé pour `<script>` ou que la page n'aura pas de problème CSP)
    - .planning/debug/g8-relance-mailto-pas-ouvert.md (root cause + fix recommandé : page intermédiaire + script + fallback)
    - .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md (Gap G8 — tests 11 et 12 reportés)
  </read_first>
  <behavior>
    **BDD scenario `@gap-G8`** (à ajouter dans `tests/bdd/features/relances.feature` — fichier existant des scenarios `@enc-05`, ou créer si absent) :

    ```gherkin
    @gap-G8 @phase2
    Scenario: POST /relances canal email rend page HTML intermédiaire qui auto-trigger mailto
      Given une échéance impayée de 35 jours en retard pour le bail "B1"
      When le bailleur soumet POST /relances avec niveau=1 et echeanceId=<echeance.id>
      Then la réponse HTTP a le statut 200
      And la réponse a le Content-Type "text/html; charset=utf-8"
      And la réponse contient un attribut href commençant par "mailto:"
      And la réponse contient un script "window.location.href"
      And la réponse contient un lien retour vers "/impayes"

    @gap-G8 @phase2 @regression-niveau-3
    Scenario: POST /relances canal pdf (niveau 3) reste inchangé après le fix G8
      Given une échéance impayée de 74 jours en retard pour le bail "B1"
      And une relance niveau 2 déjà enregistrée pour cette échéance il y a 30 jours
      When le bailleur soumet POST /relances avec niveau=3 et echeanceId=<echeance.id>
      Then la réponse HTTP a le statut 200
      And la réponse a le Content-Type "application/pdf"
      And la réponse contient un binaire PDF (signature %PDF-)
    ```

    **Test integration dédié `tests/integration/web/relances-mailto.test.ts`** (test isolé à grain fin pour valider le contrat exact de la réponse — couvre R1 mitigation) :

    - T1 — canal email retourne HTML 200 :
      - Setup : créer bail + échéance impayée de 35j en retard via helper.
      - Action : `app.inject({ method: 'POST', url: '/relances', payload: 'echeanceId=...&niveau=1', headers: { 'content-type': 'application/x-www-form-urlencoded' } })`.
      - Asserts :
        - `response.statusCode === 200`
        - `response.headers['content-type']?.startsWith('text/html')`
        - `response.body.includes('href="mailto:')` (lien fallback présent)
        - `response.body.includes('window.location.href')` (script auto-trigger présent)
        - `response.body.includes('/impayes')` (lien retour présent)
        - `response.body.includes('Relance niveau 1 enregistrée')` ou équivalent (feedback bannière en session pour le retour)

    - T2 — régression : canal pdf (niveau 3) inchangé :
      - Setup : créer bail + échéance impayée de 74j en retard + relance niveau 2 déjà enregistrée 30j avant.
      - Action : `app.inject({ method: 'POST', url: '/relances', payload: 'echeanceId=...&niveau=3', ... })`.
      - Asserts :
        - `response.statusCode === 200`
        - `response.headers['content-type'] === 'application/pdf'`
        - `Buffer.from(response.rawPayload).slice(0, 5).toString() === '%PDF-'` (signature PDF valide)
        - `response.headers['content-disposition']?.includes('mise-en-demeure.pdf')`

    - T3 (sécurité — XSS via mailtoUri) — pas un test bloquant en V1 mais smoke :
      - Asserts dans T1 que le `<script>` utilise la sérialisation JSON (cherche `'<script>' + ... + JSON.stringify(...)` style — pattern non régressable précisément, donc check faible).
      - Suffisant : vérifier que la réponse passe par `<%- JSON.stringify(...) %>` dans le code (revue manuelle + grep).
  </behavior>
  <action>
    **Étape 1 — Créer la nouvelle vue `src/web/views/pages/relances/ouverture-mail.ejs`**

    Contenu complet du fichier :
    ```ejs
    <%- include('../../partials/layout-debut', {
      titre: 'Ouverture du client mail',
      breadcrumbs: [
        { url: '/impayes', label: 'Impayés' },
        { label: 'Relance enregistrée' }
      ],
      navActive: 'relances'
    }) %>

    <h1>Relance niveau <%= niveau %> enregistrée</h1>

    <p>Le client mail va s'ouvrir automatiquement avec un brouillon pré-rempli. Si rien ne se passe, cliquez sur le bouton ci-dessous.</p>

    <p>
      <a href="<%= mailtoUri %>" role="button">Ouvrir le mail</a>
    </p>

    <p>
      <a href="<%= retourUrl %>">← Retour aux impayés</a>
    </p>

    <script>
      window.location.href = <%- JSON.stringify(mailtoUri) %>;
    </script>

    <%- include('../../partials/layout-fin') %>
    ```

    **Points critiques** :
    - **Sécurité (T-02-07-01)** : le `<script>` utilise `<%- JSON.stringify(mailtoUri) %>` (sortie non-échappée EJS via `<%- %>` car JSON.stringify produit du JS valide et échappe lui-même les guillemets/CR/LF). Surtout PAS `'<%= mailtoUri %>'` qui casserait sur tout caractère spécial (apostrophe non échappée → injection JS possible).
    - **Fallback JS désactivé** : le `<a href="<%= mailtoUri %>" role="button">` reste visible et fonctionnel sans JS. EJS échappe correctement les caractères spéciaux pour l'attribut HTML.
    - **CSP** : `main.ts` autorise `'unsafe-inline'` pour `<script>` (cf. ligne 138 environ — à confirmer en lecture préalable). Si CSP plus strict, ajuster.

    **Étape 2 — Modifier `src/web/routes/relances.ts` lignes 114-116** :

    Remplacer :
    ```ts
    // Canal email : redirect vers /impayes avec bannière succès
    req.session.banniereSuccess = `Relance niveau ${niveau} enregistrée.`;
    return reply.redirect('/impayes');
    ```

    Par :
    ```ts
    // Canal email (niveaux 1, 2) — gap G8 : afficher page intermédiaire qui
    // auto-trigger window.location.href = mailtoUri (ouvre le client mail).
    // Voir .planning/debug/g8-relance-mailto-pas-ouvert.md pour la root cause.
    req.session.banniereSuccess = `Relance niveau ${niveau} enregistrée.`;
    return reply.view('pages/relances/ouverture-mail.ejs', {
      mailtoUri: resultat.mailtoUri,
      niveau,
      retourUrl: '/impayes',
      navActive: 'relances',
    });
    ```

    **NE PAS TOUCHER** la branche `canal === 'pdf'` lignes 107-112 (mitigation R1). Tester explicitement la non-régression du PDF dans T2.

    **Étape 3 — Créer le test integration `tests/integration/web/relances-mailto.test.ts`**

    Pattern : utiliser `creerApp(db)` avec une `ClockFixe` (cf. `tests/bdd/step_definitions/relances.steps.ts:65-75` pour le bootstrap). Helper `creerBailAvecEcheance` réutilisable depuis `relances.steps.ts` (à factoriser éventuellement vers `tests/_world/` ou dupliquer ici si plus simple — l'IMPORTANT est la couverture, pas la duplication).

    Squelette :
    ```ts
    import { describe, it, expect, beforeEach, afterEach } from 'vitest';
    import { Kysely, SqliteDialect } from 'kysely';
    import Database from 'better-sqlite3';
    import { Temporal } from '@js-temporal/polyfill';
    import path from 'node:path';
    import { fileURLToPath } from 'node:url';
    import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
    import { appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
    import { creerApp } from '../../../src/main.js';
    import { ClockFixe } from '../../../src/domain/_shared/clock.js';
    import type { BailId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

    describe('POST /relances (gap G8 — mailto auto-trigger + régression PDF niveau 3)', () => {
      let app: Awaited<ReturnType<typeof creerApp>>;
      let db: Kysely<DB>;
      let sqlite: InstanceType<typeof Database>;
      let bailId: BailId;
      let echeanceId: EcheanceLoyerId;

      beforeEach(async () => {
        process.env['SESSION_SECRET'] = 'test-secret-G8-integration-32chars!!';
        sqlite = new Database(':memory:');
        db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
        await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

        // Clock fixe au 2026-05-15 ; on créera l'échéance pour avoir 35 jours de retard
        const clock = ClockFixe.du('2026-05-15');
        app = await creerApp(db, { clock });

        // helper : créer bail + 1 échéance impayée au 2026-04-10 (35 jours de retard)
        // ... (réutiliser le pattern creerBailAvecEcheance de relances.steps.ts:84-150
        //      avec dateEcheance = 2026-04-10 → 35 jours retard)
      });

      afterEach(async () => {
        if (app) await app.close();
        if (db) await db.destroy();
      });

      it('T1 — canal email (niveau 1) retourne HTML 200 avec mailto + script + fallback', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/relances',
          payload: `echeanceId=${echeanceId}&niveau=1`,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toMatch(/^text\/html/);
        // Fallback link
        expect(res.body).toMatch(/<a [^>]*href="mailto:[^"]+"/);
        // Auto-trigger script
        expect(res.body).toContain('window.location.href');
        // Lien retour
        expect(res.body).toContain('/impayes');
      });

      it('T2 (régression R1) — canal pdf (niveau 3) reste application/pdf inchangé', async () => {
        // Setup additionnel : créer une relance niveau 2 backdatée 30j avant pour
        // que niveau 3 soit disponible (seuil J+74 + 30j depuis niveau 2).
        // ... (cf. enregistrer-relance.ts pour les invariants de transition de niveau)

        const res = await app.inject({
          method: 'POST',
          url: '/relances',
          payload: `echeanceId=${echeanceId}&niveau=3`,
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        });

        expect(res.statusCode).toBe(200);
        expect(res.headers['content-type']).toBe('application/pdf');
        // Signature PDF en début de buffer
        const buf = res.rawPayload;
        expect(buf.slice(0, 5).toString()).toBe('%PDF-');
      });
    });
    ```

    **Étape 4 — Étendre `tests/bdd/features/relances.feature` (ou le fichier .feature qui contient déjà @enc-05) avec les 2 scenarios @gap-G8** décrits dans `<behavior>` :

    1. Si `tests/bdd/features/relances.feature` existe → l'éditer (ajouter à la fin).
    2. Sinon (les scenarios @enc-05 sont dans un autre fichier .feature de phase 2) → créer `tests/bdd/features/relances.feature` avec les 2 scenarios @gap-G8.

    **Étape 5 — Étendre `tests/bdd/step_definitions/relances.steps.ts` avec les steps manquants** :

    Steps déjà existants à VÉRIFIER (chercher dans le fichier) :
    - `Given une échéance impayée de N jours en retard pour le bail "X"` — probablement existant en @enc-05, sinon ajouter.
    - `When le bailleur soumet POST /relances avec niveau=N et echeanceId=<...>` — réutiliser la logique `app.inject` du fichier.

    Steps à AJOUTER (sous le tag `@gap-G8`) :
    - `Then la réponse HTTP a le statut N` : `assert.strictEqual(this.dernierStatut, N)`.
    - `Then la réponse a le Content-Type "X"` : `assert.ok(this.dernierContentType.startsWith('X'))`.
    - `Then la réponse contient un attribut href commençant par "mailto:"` : `assert.match(this.dernierCorps, /href="mailto:[^"]+"/)`.
    - `Then la réponse contient un script "window.location.href"` : `assert.ok(this.dernierCorps.includes('window.location.href'))`.
    - `Then la réponse contient un lien retour vers "X"` : `assert.match(this.dernierCorps, new RegExp('href="' + X.replace(/\//g, '\\/') + '"'))`.
    - `Then la réponse contient un binaire PDF (signature %PDF-)` : `assert.ok(this.dernierBuffer && this.dernierBuffer.slice(0, 5).toString() === '%PDF-')`.

    Avant + After pour `@gap-G8` : réutiliser le pattern `@enc-05` (idem ClockFixe + creerApp). Adapter la date du clock pour avoir 35 jours / 74 jours de retard selon le scenario.

    Step `Given une relance niveau 2 déjà enregistrée pour cette échéance il y a 30 jours` : insertion DB directe d'une row dans `relance` avec `envoyee_le = clock.maintenant() - 30 jours`, `niveau = 2`, `echeance_id = ...`.

    **Étape 6 — Vérifications finales** :
    - `pnpm tsc --noEmit` exit 0.
    - `pnpm lint` 0 warning.
    - `pnpm lint:deps` 0 violation.
    - `pnpm test -- tests/integration/web/relances-mailto.test.ts` : 2 tests VERTS.
    - `pnpm test:bdd --tags "@gap-G8"` : 2 scenarios VERTS.
    - `pnpm test:bdd --tags "@enc-05"` : tous les scenarios existants restent VERTS (non-régression).
    - `pnpm test:bdd` : 36 scenarios initiaux + nouveaux scenarios @gap-G8/G6/G7 tous VERTS.
    - `pnpm test` global : 229 unit + nouveaux integration tous VERTS.

    **Commit** : `fix(02-07): G8 POST /relances canal email rend page ouverture-mail (auto-trigger + fallback) + test régression PDF niveau 3`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && pnpm lint:deps && pnpm test -- tests/integration/web/relances-mailto.test.ts && pnpm test && pnpm test:bdd --tags "@gap-G8" && pnpm test:bdd --tags "@enc-05" && pnpm test:bdd && grep -c "ouverture-mail" src/web/routes/relances.ts && test -f src/web/views/pages/relances/ouverture-mail.ejs && grep -c "JSON.stringify(mailtoUri)" src/web/views/pages/relances/ouverture-mail.ejs && grep -c "application/pdf" src/web/routes/relances.ts</automated>
  </verify>
  <done>
    - Nouvelle vue `src/web/views/pages/relances/ouverture-mail.ejs` créée (`test -f` OK).
    - La vue contient : (1) `<script>window.location.href = <%- JSON.stringify(mailtoUri) %>;</script>` (auto-trigger sécurisé), (2) `<a href="<%= mailtoUri %>" role="button">Ouvrir le mail</a>` (fallback JS désactivé), (3) `<a href="<%= retourUrl %>">← Retour aux impayés</a>`, (4) layout-debut/layout-fin standard.
    - `src/web/routes/relances.ts` ligne ~114 : branche `canal='email'` rend `reply.view('pages/relances/ouverture-mail.ejs', { mailtoUri, niveau, retourUrl, navActive })` au lieu de redirect. `grep -c "ouverture-mail" >= 1`.
    - Branche `canal='pdf'` (niveau 3) STRICTEMENT inchangée : `grep -c "application/pdf" src/web/routes/relances.ts >= 1` (ligne pdf préservée).
    - Test integration `relances-mailto.test.ts` : T1 (email HTML 200 + mailto + script + retour) VERT, T2 (régression PDF niveau 3 Content-Type application/pdf + signature %PDF-) VERT.
    - BDD `@gap-G8` : 2 scenarios VERTS (1 niveau 1 mailto, 1 niveau 3 PDF régression).
    - BDD `@enc-05` (5 scenarios existants relances) : tous VERTS (non-régression).
    - BDD `@gap-G6`, `@gap-G7` : restent VERTS (de Task 4).
    - `pnpm test` + `pnpm test:bdd` globalement VERTS.
    - 1 commit créé : `fix(02-07): G8 POST /relances canal email rend page ouverture-mail (auto-trigger + fallback) + test régression PDF niveau 3`.
  </done>
</task>

</tasks>

<verification>
À la fin de Task 5, le plan est complet quand TOUS ces critères sont satisfaits :

1. **5 commits atomiques créés** (un par task, exception G6+G7 couplés en 1 commit) :
   - `fix(02-07): G3 empty-state CTA conditionnel + test render`
   - `fix(02-07): G4 dédoublonne banniere-success (suppression 5 ré-includes pages)`
   - `fix(02-07): G5 affiche actifDepuis sur fiche bail`
   - `feat(02-07): G6 vue globale /echeances + filtres bail/statut + G7 CTA Émettre quittance`
   - `fix(02-07): G8 POST /relances canal email rend page ouverture-mail (auto-trigger + fallback) + test régression PDF niveau 3`

2. **Tests globaux verts** :
   - `pnpm tsc --noEmit` exit 0.
   - `pnpm lint` 0 warning.
   - `pnpm lint:deps` 0 violation.
   - `pnpm test` tous les tests unit + integration verts (229 unit existants + 4 listerTous + 4 empty-state + 2 relances-mailto = 239+ tests).
   - `pnpm test:bdd` tous les scenarios verts (36 phase-2 existants + 4 @gap-G6 + 2 @gap-G7 + 2 @gap-G8 = 44 scenarios).

3. **Gaps validés un par un** (couvert par les must_haves.truths) :
   - G3 : `grep -c "if (locals.ctaUrl && locals.ctaLabel)" src/web/views/partials/empty-state.ejs = 1` ET test unit empty-state.test.ts vert.
   - G4 : `grep -rn "include.*banniere-success" src/web/views/pages/` retourne 0 ligne ; `grep -rn "include.*banniere-success" src/web/views/partials/` retourne 2 lignes.
   - G5 : `grep -c "Actif depuis" src/web/views/pages/baux/detail.ejs >= 1`.
   - G6 : `grep -c "app.get('/echeances'," src/web/routes/echeances.ts >= 1` ; test integration `listerTous` 4 verts ; BDD @gap-G6 4 verts.
   - G7 : `grep -c "/echeances?statut=payee" src/web/views/pages/quittances/liste.ejs >= 2` ; BDD @gap-G7 2 verts.
   - G8 : `test -f src/web/views/pages/relances/ouverture-mail.ejs` ; `grep -c "JSON.stringify(mailtoUri)" src/web/views/pages/relances/ouverture-mail.ejs = 1` ; `grep -c "ouverture-mail" src/web/routes/relances.ts >= 1` ; test integration relances-mailto.test.ts 2 verts ; BDD @gap-G8 2 verts.

4. **Régressions explicitement testées** :
   - Test 13 (PDF niveau 3) : T2 du test integration relances-mailto.test.ts + scenario BDD `@gap-G8 @regression-niveau-3` → Content-Type application/pdf préservé, signature %PDF- valide.
   - Bannières success uniques : grep R2 mitigation.
   - Tests `@enc-01..@enc-05` (36 scenarios initiaux) : tous restent verts.

</verification>

<success_criteria>
- 6 gaps UAT fermés (G3, G4, G5, G6, G7, G8).
- 0 régression sur les 36 BDD + 229 unit pré-existants.
- 4 nouveaux artefacts de tests : empty-state.test.ts (unit), listerTous extension repo (integration), relances-mailto.test.ts (integration), gaps-g6-g7 + @gap-G8 steps (BDD).
- 8 nouveaux scenarios BDD (4 G6 + 2 G7 + 2 G8) tous verts.
- 5 commits atomiques sur la branche courante (révertabilité fine — chaque gap est isolable).
- Aucune nouvelle migration SQL (toutes données déjà persistées par phase 02-01..02-06).
- Documentation à jour : `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-07-SUMMARY.md` à créer post-exécution avec : liste des gaps fermés, fichiers modifiés, decisions prises (en particulier la sérialisation JSON pour XSS, l'absence d'index BDD à creuser V1.1), risques mitigés (R1/R2/R3).
</success_criteria>

<output>
Après complétion, créer `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-07-SUMMARY.md` selon le template `.claude/get-shit-done/templates/summary.md`. Sections obligatoires : Gaps fermés (table G3..G8 avec statut), Fichiers modifiés (liste exhaustive), Décisions techniques (JSON.stringify pour XSS, side-effect empty-state filtre), Risques mitigés (R1 PDF niveau 3 testé, R2 grep banniere-success vérifié, R3 index BDD documenté pour V1.1), Tests ajoutés (4 artefacts + 8 scenarios BDD).
</output>

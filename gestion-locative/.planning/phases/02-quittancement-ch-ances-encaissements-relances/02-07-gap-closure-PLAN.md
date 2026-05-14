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
  - tests/bdd/features/quittancement.feature
  - tests/bdd/step_definitions/relances.steps.ts
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
    - "G3 closed : empty-state.ejs ne rend AUCUN élément CTA (ni `<a>`, ni texte) quand ctaUrl=null ou ctaLabel=null. Pages /quittances et autres consommateurs avec CTA conditionnel n'affichent plus de bouton vide cliquable."
    - "G4 closed : aucune bannière flash succès n'est dupliquée. layout-debut.ejs:24 reste l'UNIQUE point de rendu de banniere-success.ejs. Les 5 pages (profil bailleur, baux/detail, quittances/liste, quittances/fiche, relances/liste) ne ré-incluent plus banniere-success."
    - "G5 closed : la fiche bail (/baux/:id) affiche explicitement `Actif depuis : DD/MM/YYYY` quand `bail.actifDepuis !== null`. Le formatage utilise formatDate. Le champ n'est PAS affiché pour les baux brouillons (actifDepuis === null)."
    - "G6 closed : GET /echeances (NOUVELLE route globale) liste TOUTES les échéances tous baux confondus, avec filtres `?bail=<bailId>` et `?statut=<en_attente|partiellement_payee|payee|annulee>`. La page expose un `<form method=GET>` avec `<select name=bail>` peuplé via locataireRepo + bailRepo et `<select name=statut>`. Les filtres se cumulent (bail ET statut). La route GET /baux/:id/echeances existante reste inchangée."
    - "G7 closed : la page /quittances affiche un CTA primary 'Émettre une quittance' qui redirige vers `/echeances?statut=payee`. Le CTA est TOUJOURS visible (que la liste de quittances soit vide ou pleine). Sur /echeances avec statut=payee, les échéances payées sans quittance active affichent le bouton 'Générer quittance' (réutilise le pattern existant de la page per-bail)."
    - "G8 closed : POST /relances pour canal='email' (niveaux 1 et 2) répond avec une page HTML `pages/relances/ouverture-mail.ejs` (status 200, Content-Type: text/html) contenant : (1) `<script>window.location.href='<%= mailtoUri %>'</script>` qui auto-déclenche l'ouverture du client mail, (2) un lien fallback `<a href=<%= mailtoUri %>>Ouvrir le mail</a>` visible (JS désactivé), (3) un lien retour `/impayes`, (4) un message bannière de succès. Le canal pdf (niveau 3) reste inchangé (Content-Type: application/pdf)."
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
Output: 6 gaps fermés, tests existants verts (régression nulle), 3 nouveaux tests integration (G6 filtres, G8 mailto rendu, G3 empty-state safe), aucune migration SQL (toutes les données nécessaires existent déjà en BDD).
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
  - Pour le `<select bail>`, charger TOUS les baux via `bailRepo.listerTous()` (LearningsP1 → méthode existe sous forme `listerTous` ou équivalent — VÉRIFIER ; sinon utiliser la méthode utilisée par `wizard.ts` ou `baux.ts` pour la page index).
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

<tasks>

<task type="auto">
  <name>Task 1 — Wave 1 (gaps faciles) : G3 (empty-state safe) + G4 (suppr 5 ré-includes banniere-success) + G5 (actifDepuis affiché)</name>
  <read_first>
    - src/web/views/partials/empty-state.ejs
    - src/web/views/partials/layout-debut.ejs
    - src/web/views/partials/banniere-success.ejs
    - src/web/views/partials/banniere-warning.ejs
    - src/web/views/partials/warning-live.ejs
    - src/web/views/pages/bailleur/profil.ejs (lignes 1-12 — vérifier la structure exacte avant suppression)
    - src/web/views/pages/baux/detail.ejs (lignes 1-15 — vérifier que ligne 9 = banniere-success et ligne 10 = banniere-warning)
    - src/web/views/pages/quittances/fiche.ejs (lignes 1-15)
    - src/web/views/pages/quittances/liste.ejs (lignes 1-10)
    - src/web/views/pages/relances/liste.ejs (lignes 1-15)
    - src/web/views/pages/locataires/liste.ejs (consommateur conforme — passe ctaLabel + ctaUrl)
    - src/web/views/pages/biens/liste.ejs (consommateur conforme)
    - src/web/views/pages/echeances/liste.ejs (consommateur — vérifier qu'il ne casse pas avec ctaLabel non passé)
    - src/web/views/pages/encaissements/liste.ejs (consommateur conforme)
    - src/web/views/pages/encaissements/formulaire.ejs (consommateur conforme)
    - .planning/debug/g4-banniere-flash-dupliquee.md (root cause confirmée — 5 fichiers identifiés exhaustivement)
    - .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md (Gaps G3, G4, G5)
  </read_first>
  <action>
    Trois mini-corrections views EJS pures, aucun test à ajouter pour G3/G4/G5 (impact purement cosmétique, non régression couverte par les BDD existants + smoke). Régressions empêchées par re-lecture des 4 cas UAT en fin de tâche.

    **G3 — `src/web/views/partials/empty-state.ejs`**
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
    Vérification immédiate : le consommateur `pages/echeances/liste.ejs:22-25` qui passe `{ message, action: null }` ne respecte pas la convention `{ heading, body, ctaUrl, ctaLabel }` — c'est un BUG PRÉ-EXISTANT mais hors scope G3. Ne PAS le corriger ici (changement hors-périmètre risk de cascade). Le wrapper conditionnel `if (locals.ctaUrl && locals.ctaLabel)` rend la robustesse défensive : aucun `<a>` rendu si l'un ou l'autre est absent.

    **G4 — Suppression des 5 ré-includes `banniere-success`**

    Pour CHAQUE fichier ci-dessous, SUPPRIMER UNIQUEMENT la ligne d'include de `banniere-success` (et son wrapper `<% if %>` si présent). NE PAS toucher aux includes de `banniere-warning`, `warning-live`, ni au reste de la page.

    1. `src/web/views/pages/bailleur/profil.ejs` — supprimer lignes 7-9 :
       ```
       <% if (locals.banniereSuccess) { %>
         <%- include('../../partials/banniere-success', { message: banniereSuccess }) %>
       <% } %>
       ```
       (Conserver le reste : `<h1>Profil bailleur</h1>` ligne 11 etc.)

    2. `src/web/views/pages/baux/detail.ejs` — supprimer ligne 9 :
       ```
       <%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>
       ```
       CONSERVER ligne 10 (`banniere-warning`).

    3. `src/web/views/pages/quittances/liste.ejs` — supprimer ligne 7 :
       ```
       <%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>
       ```
       CONSERVER ligne 8 (`warning-live`).

    4. `src/web/views/pages/quittances/fiche.ejs` — supprimer ligne 10 :
       ```
       <%- include('../../partials/banniere-success', { message: locals.banniereSuccess }) %>
       ```
       CONSERVER ligne 11 (`warning-live`) et le bloc warning-live conditionnel lignes 13-21.

    5. `src/web/views/pages/relances/liste.ejs` — supprimer lignes 11-13 :
       ```
       <% if (banniereSuccess) { %>
         <%- include('../../partials/banniere-success', { message: banniereSuccess }) %>
       <% } %>
       ```

    Vérification après modifications : le flux `banniereSuccess` reste passé aux locals par les routes (route /bailleur, /baux/:id, /quittances, /relances) → `layout-debut.ejs:24` continue à le rendre une seule fois. Aucun changement de route nécessaire.

    **G5 — Affichage `actifDepuis` sur fiche bail**

    `src/web/views/pages/baux/detail.ejs` — dans la section `<h2>Période</h2>` (lignes 42-46 actuelles), AJOUTER après `<dt>Durée</dt><dd>... mois</dd>` :
    ```
    <% if (bail.actifDepuis !== null) { %>
      <dt>Actif depuis</dt>
      <dd><%= formatDate(bail.actifDepuis) %></dd>
    <% } %>
    ```
    Le helper `formatDate` est injecté globalement via `preHandler` (cf. main.ts:122-129). Aucun ajout dans la route nécessaire.

    Vérification : un bail brouillon (`actifDepuis === null`) n'affiche RIEN (bloc conditionnel). Un bail activé affiche `Actif depuis : DD/MM/YYYY`.

    Commit unique pour la wave 1 : `fix(02-07): G3 empty-state CTA conditionnel + G4 dédoublonne banniere-success (5 pages) + G5 affiche actifDepuis sur fiche bail`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test && pnpm test:bdd && grep -L "include.*banniere-success" src/web/views/pages/bailleur/profil.ejs src/web/views/pages/baux/detail.ejs src/web/views/pages/quittances/liste.ejs src/web/views/pages/quittances/fiche.ejs src/web/views/pages/relances/liste.ejs && grep -c "if (locals.ctaUrl && locals.ctaLabel)" src/web/views/partials/empty-state.ejs && grep -c "Actif depuis" src/web/views/pages/baux/detail.ejs</automated>
  </verify>
  <done>
    - empty-state.ejs : `<a>` CTA wrappé conditionnellement, `grep -c "if (locals.ctaUrl && locals.ctaLabel)" = 1`.
    - 5 fichiers `pages/*.ejs` modifiés : aucun ne contient plus de `include` vers `banniere-success` (vérifié par `grep -L` qui liste les fichiers SANS le match → les 5 doivent apparaître).
    - baux/detail.ejs : affichage `Actif depuis` ajouté, `grep -c "Actif depuis" >= 1`.
    - Aucun test cassé. BDD 36 scenarios passent.
    - 1 commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 — Wave 2 couplés (G6 + G7) : route GET /echeances globale avec filtres bail/statut + CTA depuis /quittances</name>
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
    - tests/bdd/features/quittancement.feature (pour ajouter scenarios @enc-04-filtres et @enc-01-cta)
    - tests/bdd/step_definitions/quittancement.steps.ts (pour ajouter steps si nécessaire — vérifier les steps Given déjà créés)
    - tests/bdd/step_definitions/relances.steps.ts (lignes 80-130 : pattern `creerBailAvecEcheance` helper insertion DB directe — réutilisable)
    - src/web/routes/baux.ts (pour la méthode `listerTous` du bailRepo — vérifier qu'elle existe, sinon utiliser le pattern existant pour récupérer tous les baux)
    - .planning/phases/02-quittancement-ch-ances-encaissements-relances/02-UAT.md (Gaps G6, G7)
  </read_first>
  <behavior>
    **Tests integration repo (extension `tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts`)** — ajout d'un `describe('listerTous')` avec 4 tests :
    - T1 : sans filtre, 4 échéances en DB (statuts variés : 1 en_attente, 1 partiellement_payee, 1 payee, 1 annulee, 2 bails distincts) → retourne 4 résultats triés par periode_debut DESC.
    - T2 : filtre `{ bailId: bail1.id }` → retourne UNIQUEMENT les échéances de bail1 (2 sur 4).
    - T3 : filtre `{ statut: 'payee' }` → retourne UNIQUEMENT l'échéance statut='payee' (1 sur 4).
    - T4 : filtre combiné `{ bailId: bail1.id, statut: 'en_attente' }` → retourne UNIQUEMENT l'échéance de bail1 avec statut='en_attente'.

    **Tests BDD nouveaux (étendre `tests/bdd/features/quittancement.feature` avec scenarios @gap-G6 + @gap-G7)** :
    - Scenario `@gap-G6 Filtres /echeances` : Given 2 baux activés avec échéances variées (différents statuts) ; When GET `/echeances` → la page liste TOUTES les échéances. When GET `/echeances?statut=payee` → liste seulement les payées. When GET `/echeances?bail=<id>` → liste seulement les échéances du bail.
    - Scenario `@gap-G7 CTA Émettre une quittance` : Given navigateur sur GET `/quittances` → la page affiche un lien/bouton "Émettre une quittance" pointant vers `/echeances?statut=payee`.

    **Tests minimaux (pas de TDD complet pour G6/G7 car le scope est principalement UI plumbing — les filtres SQL bénéficient eux du TDD)**. Pas d'unit tests pour la route Fastify ni la vue (couvert par BDD smoke).
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

    **Étape 3 — Tests integration repo** : étendre `tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts` avec un `describe('listerTous')` après les `describe` existants. Réutiliser le `beforeEach` + helper `creerEcheance`. Créer 4 échéances comme décrit en `<behavior>`, exercer les 4 tests T1-T4. Tests RED expectation : `listerTous` n'existe pas → fail à compile-time. Puis tests GREEN après ajout de la méthode.

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

    **Étape 5 — Route GET /echeances** : modifier `src/web/routes/echeances.ts` pour ajouter une nouvelle route AVANT (ou APRÈS, peu importe) les routes existantes. NE PAS toucher aux routes existantes (`/baux/:id/activer`, `/baux/:id/echeances`, `/echeances/:id/avis-pdf`).

    Validation des query params : whitelist statut explicite, bailId en string (validation lâche acceptée — un UUID invalide retournera juste 0 résultat car la query SQLite ne matchera rien).

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

    NOTE: le bouton "Générer quittance" sur statut=payee peut produire un doublon si une quittance active existe déjà (le POST échouera côté serveur via `QuittanceDejaEmise`). Acceptable V1 (cohérent avec la page per-bail qui filtre via `quittanceActive` mais nécessiterait un enrichissement plus lourd ici — DEFERRED V1.1 si l'utilisateur signale). Le serveur gère correctement le double-clic (400 + message).

    **Étape 7 — Sidebar nav** (`src/web/views/partials/sidebar-nav.ejs`) :
    Dans le `<details>` "Encaissements", ajouter un `<li>` "Toutes les échéances" en première position du sous-menu :
    ```
    <li>
      <a href="/echeances"<% if (locals.navActive === 'echeances') { %> aria-current="page"<% } %>>Toutes les échéances</a>
    </li>
    ```
    Le `navActive === 'echeances' || ...` dans le `<details open>` ligne 13 inclut déjà 'echeances' — pas de changement nécessaire à cet endroit.

    **Étape 8 — G7 : CTA depuis /quittances** (`src/web/views/pages/quittances/liste.ejs`) :

    Le fichier actuel passe `ctaLabel: null, ctaUrl: null` dans l'empty-state. Modifier :

    A) Empty state (lignes 12-18) :
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

    B) Header avant le tableau (entre `<h1>Quittances de loyer</h1>` ligne 10 et le `<% if ... %>` ligne 12) :
    Ajouter :
    ```
    <p>
      <a href="/echeances?statut=payee" role="button">Émettre une quittance</a>
    </p>
    ```
    (visible que la liste soit vide ou non — primary action above the fold).

    **Étape 9 — Tests BDD** (`tests/bdd/features/quittancement.feature` + step definitions) :

    NOTE : la feature `quittancement.feature` n'est PAS le bon endroit si elle n'existe pas pour ces scenarios. Vérifier sa structure ; sinon utiliser un NOUVEAU fichier `tests/bdd/features/gaps-g6-g7-echeances.feature` tagué `@gap-G6 @gap-G7`.

    Ajouter 2 scenarios :
    ```gherkin
    @gap-G6 @phase2
    Scenario: GET /echeances liste toutes les échéances tous baux confondus
      Given un bail activé "B1" avec 3 échéances en_attente
      And un bail activé "B2" avec 2 échéances payee
      When le bailleur navigue vers GET /echeances
      Then la page affiche 5 lignes d'échéances
      And la page affiche un select "Bail" avec 2 options
      And la page affiche un select "Statut" avec 4 options

    @gap-G6 @phase2
    Scenario: GET /echeances?statut=payee filtre par statut
      Given un bail activé "B1" avec 3 échéances en_attente
      And un bail activé "B2" avec 2 échéances payee
      When le bailleur navigue vers GET /echeances?statut=payee
      Then la page affiche 2 lignes d'échéances

    @gap-G7 @phase2
    Scenario: Page /quittances expose un CTA "Émettre une quittance"
      Given le bailleur navigue vers GET /quittances
      Then la page contient un lien/bouton "Émettre une quittance"
      And ce lien pointe vers "/echeances?statut=payee"
    ```

    Steps : si les steps "Given un bail activé X avec N échéances" n'existent pas dans `quittancement.steps.ts` ou autre, ajouter un step definition file `tests/bdd/step_definitions/gaps-g6-g7.steps.ts` avec :
    - Before/After tagués `@gap-G6` et `@gap-G7` qui boot l'app via `creerApp(db)` avec une `ClockFixe`.
    - Steps "Given un bail activé X avec N échéances <statut>" qui inserte les rows directement en DB (pattern du fichier `relances.steps.ts:84-130` helper `creerBailAvecEcheance`).
    - Step "Then la page affiche N lignes d'échéances" qui parse le HTML retourné (regex `<tr>` après `<tbody>`) ou compte les occurrences d'une classe.
    - Step "Then la page contient un lien/bouton 'X'" : `assert.ok(this.dernierCorps.includes('X'))`.
    - Step "Then ce lien pointe vers 'Y'" : `assert.ok(this.dernierCorps.match(/href="[^"]*Y[^"]*"/))`.

    **Étape 10 — Vérifications** :
    - `pnpm tsc --noEmit` exit 0.
    - `pnpm lint` 0 warning.
    - `pnpm lint:deps` 0 violation.
    - `pnpm test` tout VERT (les 229 unit + nouveaux integration `listerTous`).
    - `pnpm test:bdd --tags @gap-G6` 2 scenarios VERTS.
    - `pnpm test:bdd --tags @gap-G7` 1 scenario VERT.
    - `pnpm test:bdd` tout VERT (régressions @enc-01..@enc-05).

    Sécurité (cf. <threat_model>) :
    - Query params `bail` et `statut` validés par whitelist (statut ∈ ensemble fermé, bail accepté tel quel mais SQLite paramétré → pas d'injection).
    - Aucune écriture déclenchée depuis GET /echeances.

    Commit : `feat(02-07): G6 vue globale /echeances + filtres bail/statut + G7 CTA Émettre quittance`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && pnpm lint:deps && pnpm test && pnpm test:bdd --tags "@gap-G6 or @gap-G7" && grep -c "app.get('/echeances'," src/web/routes/echeances.ts && grep -c "listerTous" src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts && grep -c "/echeances?statut=payee" src/web/views/pages/quittances/liste.ejs
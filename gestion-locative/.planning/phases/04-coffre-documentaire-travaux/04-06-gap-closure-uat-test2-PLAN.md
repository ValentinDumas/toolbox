---
phase: 04-coffre-documentaire-travaux
plan: 06
plan_id: "04-06"
type: execute
wave: 6
status: planned
gap_closure: true
source_uat: 04-HUMAN-UAT.md
created: 2026-05-19
depends_on: ["04-01", "04-02", "04-03", "04-04", "04-05"]
files_modified:
  # Domain
  - src/domain/travaux/ticket-travaux.ts
  # Application
  - src/application/travaux/clore-ticket-travaux.ts
  # Web schemas
  - src/web/schemas/ticket-travaux-schemas.ts
  # Web routes
  - src/web/routes/travaux.ts
  # Web views
  - src/web/views/pages/travaux/nouveau.ejs
  - src/web/views/pages/travaux/detail.ejs
  - src/web/views/partials/partial-ticket-pj-section.ejs
  # Tests
  - tests/bdd/features/travaux.feature
  - tests/unit/travaux/ticket-travaux.test.ts
  - tests/unit/travaux/use-cases.test.ts
  - tests/integration/web/travaux-ticket-pj-erreurs.test.ts
autonomous: true
requirements: [INC-01]
tags: [phase-4, gap-closure, uat, test2, ux, validation-date]

closes_gaps:
  - id: "G-UX-02-bis"
    severity: minor
    description: "Le form d'upload PJ sur fiche ticket (POST /travaux/:id/justificatifs mode upload) souffre du même bug G-UX-02 — pas de garde « fichier vide » + pas de message d'erreur visible côté UI. Extension du fix G-UX-02 (commit 3eed2e8) au form ticket. Pattern actuel utilise session.banniereWarning + redirect au lieu de re-render avec erreurs.fichier inline sous l'input."
  - id: "G-DATE-01"
    severity: minor
    description: "Le form création ticket (POST /biens/:id/travaux) ET le form clôture (POST /travaux/:id/clore) acceptent une date future. L'invariant domain + Zod existent côté création (dateOuverture) mais MANQUENT côté clôture (dateCloture). De plus, AUCUN des 2 forms HTML n'a l'attribut max=<today> pour feedback navigateur immédiat. Cohérent avec sémantique métier : une date d'ouverture/clôture d'un ticket est aujourd'hui ou passée, jamais future."

must_haves:
  truths:
    - "G-UX-02-bis closed (route) : POST /travaux/:id/justificatifs mode upload sans fichier OU avec fichier vide (0 octet) re-rend la fiche ticket avec HTTP 400 + erreurs.fichier = 'Aucun fichier reçu.' au lieu d'utiliser session.banniereWarning + redirect. La détection se fait via if (!data) || fichierBuffer.length === 0 après data.toBuffer(), pattern IDENTIQUE à coffre.ts:199-222."
    - "G-UX-02-bis closed (partial) : partial-ticket-pj-section.ejs rend l'erreur sous l'input fichier — <span id=\"fichier-error-ticket\" role=\"alert\" aria-live=\"polite\"> + aria-invalid=\"true\" sur l'input quand erreurs.fichier présent. Pattern IDENTIQUE à partial-upload-form.ejs:25-31. Les valeurs des autres champs (titre, type, dateDocument…) sont préservées dans valeurs."
    - "G-DATE-01 closed (domain) : TicketTravaux.clore(coutReelTtc, dateCloture, today) lève InvariantViolated('La date de clôture ne peut pas être dans le futur.') si dateCloture > today. Pattern et message verbatim COHÉRENTS avec l'invariant existant ligne 106-110 sur dateOuverture."
    - "G-DATE-01 closed (Zod) : cloreTicketSchema.dateCloture obtient un refine identique à creerTicketSchema.dateOuverture (lignes 38-49) — rejette les dates > Temporal.Now.plainDateISO() avec le message verbatim 'La date de clôture ne peut pas être dans le futur.' Le pattern Now (pas le clock injecté côté Zod) est cohérent avec l'existant Phase 4."
    - "G-DATE-01 closed (HTML5) : les 2 inputs date HTML5 ont l'attribut max=<%= locals.today.toString() %> pour feedback navigateur immédiat — nouveau.ejs:54-61 (dateOuverture) ET detail.ejs:77-85 (dateCloture). locals.today est déjà injecté globalement par le preHandler main.ts:159-178, aucun changement de route nécessaire."
    - "Pas de régression : tous les tests Phase 4 (615 unit/integration + 132 BDD post-04-05) restent VERTS. pnpm tsc --noEmit exit 0. pnpm depcruise src --config .dependency-cruiser.cjs exit 0. ROADMAP Phase 4 SC reste observable."
  artifacts:
    - path: "src/domain/travaux/ticket-travaux.ts"
      provides: "Invariant clore() rejette dateCloture > today"
      contains: "La date de clôture ne peut pas être dans le futur"
    - path: "src/web/schemas/ticket-travaux-schemas.ts"
      provides: "cloreTicketSchema.dateCloture refine <= today"
      contains: "La date de clôture ne peut pas être dans le futur"
    - path: "src/web/routes/travaux.ts"
      provides: "Mode upload PJ ticket — garde fichier vide + re-render fiche avec erreurs.fichier"
      contains: "fichierBuffer.length === 0"
    - path: "src/web/views/partials/partial-ticket-pj-section.ejs"
      provides: "Rendu erreurs.fichier sous l'input PJ ticket"
      contains: "fichier-error-ticket"
    - path: "src/web/views/pages/travaux/nouveau.ejs"
      provides: "Input dateOuverture avec max=today"
      contains: "max=\"<%= locals.today"
    - path: "src/web/views/pages/travaux/detail.ejs"
      provides: "Input dateCloture avec max=today"
      contains: "max=\"<%= locals.today"
    - path: "tests/bdd/features/travaux.feature"
      provides: "Scénario @gap-uat-date @inc-01 — dateCloture future rejetée"
      contains: "@gap-uat-date"
    - path: "tests/integration/web/travaux-ticket-pj-erreurs.test.ts"
      provides: "Tests integration G-UX-02-bis (sans fichier + fichier 0 octet)"
      contains: "Aucun fichier reçu"
  key_links:
    - from: "src/web/routes/travaux.ts (POST /travaux/:id/justificatifs)"
      to: "fiche ticket re-render avec erreurs.fichier"
      via: "if (!data || fichierBuffer.length === 0) → lireTicket + reply.code(400).view('pages/travaux/detail.ejs', {ticket, bien, justificatifs, erreurs: {fichier: 'Aucun fichier reçu.'}, valeurs})"
      pattern: "fichierBuffer.length === 0"
    - from: "src/web/views/partials/partial-ticket-pj-section.ejs"
      to: "rendu erreurs.fichier inline"
      via: "if (locals.erreurs && erreurs.fichier) → <span id=fichier-error-ticket aria-live=polite> + aria-invalid sur input"
      pattern: "fichier-error-ticket"
    - from: "src/domain/travaux/ticket-travaux.ts clore()"
      to: "InvariantViolated dateCloture future"
      via: "if (Temporal.PlainDate.compare(dateCloture, today) > 0) throw InvariantViolated"
      pattern: "La date de clôture ne peut pas être dans le futur"
    - from: "src/web/schemas/ticket-travaux-schemas.ts cloreTicketSchema"
      to: "refine dateCloture <= today"
      via: "z.string().regex(...).refine(s => Temporal.PlainDate.compare(Temporal.PlainDate.from(s), Temporal.Now.plainDateISO()) <= 0)"
      pattern: "La date de clôture ne peut pas être dans le futur"
    - from: "src/web/views/pages/travaux/nouveau.ejs + detail.ejs"
      to: "input date max=today"
      via: "max=\"<%= locals.today ? locals.today.toString() : '' %>\" sur input type=date"
      pattern: "max=\"<%= locals.today"
---

# Phase 04 — Plan 06 : Gap Closure UAT Test 2 (UX upload PJ ticket + validation date future)

Ce plan ferme 2 gaps remontés par smoke test manuel Test 2 (2026-05-19) post-04-05 — source `04-HUMAN-UAT.md` §Gaps.

**G-UX-02-bis** : extension du fix G-UX-02 (04-05 T3 commit 3eed2e8) au formulaire d'upload PJ sur fiche ticket. Même pattern : `fichierBuffer.length === 0` → 400 + re-render avec `erreurs.fichier` inline.

**G-DATE-01** : défense en profondeur 3 couches (domain + Zod + HTML5) pour bloquer les dates futures sur les forms ticket. Côté **création** : domain + Zod existent déjà (T4 BDD passant), il manque uniquement le `max` HTML5. Côté **clôture** : les 3 couches sont à ajouter. Cohérent avec sémantique métier (dates d'opérations sur tickets = passé/présent).

**Source des spécifications :** `04-HUMAN-UAT.md` §Gaps (G-UX-02-bis + G-DATE-01 — verbatim).

**Hors périmètre :** audit des autres formulaires de date métier (échéance, encaissement) → reporté V1.1 si pertinent (l'UAT actuel ne remonte pas ces forms).

## Découvertes critiques pendant la lecture du codebase

Plusieurs surprises qui simplifient le plan :

1. **`locals.today` est injecté globalement** par le preHandler Fastify (`src/main.ts:159-178`). Les vues peuvent l'utiliser directement, AUCUN changement de route GET nécessaire pour l'attribut HTML5 `max`.

2. **L'invariant domain `creer()` rejette déjà `dateOuverture > today`** (`src/domain/travaux/ticket-travaux.ts:106-110`). Le refine Zod existe (`creerTicketSchema:38-49`). Le scénario BDD T4 passe déjà. Pour G-DATE-01 côté création, **il ne manque que l'attribut HTML5 `max`**.

3. **Côté clôture, RIEN n'est en place** :
   - `TicketTravaux.clore()` ne vérifie que `dateCloture < dateOuverture` (pas le futur)
   - `cloreTicketSchema` ne vérifie que le format `regex AAAA-MM-JJ` (pas `<= today`)
   - La vue `detail.ejs:78-84` n'a pas d'attribut `max`

4. **Le pattern Zod utilise `Temporal.Now.plainDateISO()`** (pas le clock injecté). Cohérent avec l'existant Phase 4 (cf. `creerTicketSchema:42`). On garde ce pattern — l'invariant domain reste la source de vérité testable via `ClockFixe`.

5. **Le partial `partial-ticket-pj-section.ejs` n'a aucune gestion erreurs** (grep `erreurs|valeurs` = 0). Le rendu d'erreur inline est à ajouter de zéro. Le pattern à dupliquer est `partial-upload-form.ejs:25-31`.

6. **La route `travaux.ts:376-378` mode upload utilise `session.banniereWarning + redirect`** au lieu du pattern `view(..., {erreurs.fichier})` du coffre. Pas seulement la garde manquante : tout le handler d'erreur upload est à refactorer pour utiliser le pattern coffre.

## Goal-Backward

Si tous les `must_haves.truths` sont vrais après exécution :
- Un utilisateur qui tente de soumettre le form upload PJ ticket sans fichier reçoit un message clair sous l'input fichier (pas en bannière en haut de page), avec les autres valeurs préservées.
- Un utilisateur qui sélectionne une date future sur le form création OU clôture ticket voit l'input refuser la saisie via HTML5 (`max` attribut), et si bypass (POST direct), la requête est rejetée 400 avec message clair côté UI.
- Le scénario BDD `@gap-uat-date` documente la règle métier dateCloture <= today.
- Aucune régression sur les 615+ tests existants.

## Threat Model

| ID | Surface | Threat | Mitigation |
|---|---|---|---|
| TM-04-L | POST /travaux/:id/justificatifs upload | Submit silencieusement échoué côté serveur (fichier vide non détecté, bannière noyée) → confusion utilisateur | T1 — garde explicite + re-render avec erreur inline (pattern coffre) |
| TM-04-M | POST /biens/:id/travaux + POST /travaux/:id/clore | Date métier incohérente (futur) acceptée par bypass HTML5 | T2 — défense en profondeur 3 couches (domain + Zod + HTML5) |

## Pyramide de tests prévue par tâche

| Tâche | Unit domain | Integration HTTP | BDD |
|---|---|---|---|
| T1 (G-UX-02-bis) | — | 2 (POST sans fichier + POST fichier vide) | — |
| T2 (G-DATE-01) | 2 (clore rejette dateCloture future + use case propage) | 2 (POST clore date future → 400 visible + max attribute présent nouveau.ejs/detail.ejs) | 1 (@gap-uat-date @inc-01) |

Total nouveau : ~7 tests.

<tasks>

<task type="auto">
  <name>Task 1 — G-UX-02-bis : Garde fichier vide + rendu erreur inline sur form upload PJ ticket</name>
  <read_first>
    - src/web/routes/travaux.ts (lignes 323-454 — handler POST /travaux/:id/justificatifs mode upload)
    - src/web/routes/coffre.ts (lignes 199-222 — pattern de référence !data + fichierBuffer.length === 0 ajouté par 04-05 commit 3eed2e8)
    - src/web/views/partials/partial-ticket-pj-section.ejs (forme actuelle — sans gestion erreurs/valeurs, lignes 53-98)
    - src/web/views/partials/partial-upload-form.ejs (lignes 25-31 — pattern fichier-error de référence)
    - src/web/views/pages/travaux/detail.ejs (passage erreurs/valeurs au partial à modifier)
    - src/application/travaux/lire-ticket.ts (signature pour re-render fiche ticket avec ticket+bien+justificatifs)
    - tests/integration/web/coffre-upload-erreurs.test.ts (pattern test integration à dupliquer — Kysely SqliteDialect + creerApp + buildMultipartBody helper)
    - .planning/phases/04-coffre-documentaire-travaux/04-05-gap-closure-uat-PLAN.md §T3 (référence du pattern G-UX-02)
    - .planning/phases/04-coffre-documentaire-travaux/04-HUMAN-UAT.md §G-UX-02-bis (verbatim)
  </read_first>
  <behavior>
    **Avant :** le handler POST /travaux/:id/justificatifs mode upload (travaux.ts:362-454) utilise systématiquement `req.session.banniereWarning + reply.redirect(\`/travaux/${id}\`)` pour les erreurs (lignes 364-366 contentType non multipart, 377-378 !data, 403-405 parsedFields invalide, 392-395 file too large, 442-443 / 446-447 erreurs domain). Aucune garde sur `fichierBuffer.length === 0`. Le partial `partial-ticket-pj-section.ejs` ne rend AUCUN message d'erreur (grep erreurs|valeurs = 0).

    Résultat utilisateur : il submit sans fichier, voit la page re-charger avec un bandeau warning jaune en haut de page (loin de l'input fichier), perd toutes ses saisies titre/type/date, sans focus visuel sur l'origine du problème.

    **Après :**
    - Le handler durcit la détection : `if (!data || (fichierBuffer = await data.toBuffer()).length === 0)` → re-render `pages/travaux/detail.ejs` HTTP 400 avec `erreurs: {fichier: 'Aucun fichier reçu.'}` + `valeurs` (titre, type, dateDocument, montantTtcEuros, notes) collectés. Cohérent avec coffre.ts:199-222.
    - Le partial `partial-ticket-pj-section.ejs` rend `<span id="fichier-error-ticket" role="alert" aria-live="polite" class="error-msg" ...>` sous l'input quand `locals.erreurs && erreurs.fichier`, avec `aria-invalid="true"` et `aria-describedby` sur l'input — pattern verbatim du partial-upload-form.ejs:25-31.
    - Les valeurs des autres champs (titre, type, dateDocument, montantTtcEuros, notes) sont préservées via `locals.valeurs` (réinjectées dans `value=` des inputs).
    - detail.ejs passe `erreurs` et `valeurs` au partial via `include('../../partials/partial-ticket-pj-section', { ticket, justificatifs, erreurs: locals.erreurs || {}, valeurs: locals.valeurs || {} })`.

    **Pourquoi pas modifier session.banniereWarning ailleurs :** scope strict UAT — seul le cas « fichier vide » est remonté. Les autres erreurs (file too large, parsedFields, domain) restent en banniereWarning + redirect — pattern existant fonctionnel. Le code review en V1.1 pourra harmoniser.

    **Pourquoi `id="fichier-error-ticket"` et pas `fichier-error` :** éviter collision DOM si jamais deux partials d'upload coexistent dans le même rendu. Le coffre/upload utilise `fichier-error` — préfixer `-ticket` pour ne pas confondre.
  </behavior>
  <action>
    **1. Modifier `src/web/views/partials/partial-ticket-pj-section.ejs`** pour rendre `erreurs.fichier` et préserver `valeurs`. Pattern : remplacer la section "Ajouter une pièce jointe" (lignes 51-98 actuelles) en :
    - Au début du fichier après `const ticket = locals.ticket;` ajouter `const erreurs = locals.erreurs || {}; const valeurs = locals.valeurs || {};`
    - Sur l'input `<input id="pj-fichier" ...>` (lignes 56-62) : ajouter `aria-describedby="pj-fichier-hint<%= erreurs.fichier ? ' fichier-error-ticket' : '' %>"` et `<% if (erreurs.fichier) { %>aria-invalid="true"<% } %>`. Wrapper hint dans `<small id="pj-fichier-hint">PDF, JPG, …</small>`.
    - Juste après le `<small>` hint, ajouter `<% if (erreurs.fichier) { %><span id="fichier-error-ticket" role="alert" aria-live="polite" class="error-msg" style="color: var(--couleur-destructive, #b91c1c);"><%= erreurs.fichier %></span><% } %>`
    - Sur l'input titre : ajouter `value="<%= valeurs.titre || '' %>"` (préservation).
    - Sur l'input dateDocument : ajouter `value="<%= valeurs.dateDocument || '' %>"`.
    - Sur le select type : ajouter `<%= valeurs.type === t[0] ? 'selected' : '' %>` sur chaque option (pattern partial-upload-form.ejs:70).
    - Sur l'input montantTtcEuros : ajouter `value="<%= valeurs.montantTtcEuros || '' %>"`.
    - Sur le textarea notes : ajouter `<%= valeurs.notes || '' %>` entre les balises.

    **2. Modifier `src/web/views/pages/travaux/detail.ejs` ligne 69** pour passer erreurs/valeurs au partial :
    ```ejs
    <%- include('../../partials/partial-ticket-pj-section', {
      ticket: ticket,
      justificatifs: justificatifs,
      erreurs: locals.erreurs || {},
      valeurs: locals.valeurs || {}
    }) %>
    ```

    **3. Modifier `src/web/routes/travaux.ts` POST /travaux/:id/justificatifs mode upload (lignes 362-454)**. Refactor focal sur la garde fichier vide :
    - Après le `if (!contentType.startsWith('multipart/'))` (ligne 363-367), garder le pattern existant (banniereWarning + redirect car cas browser non-form, edge case).
    - Dans le try block, après `const data = await req.file();` ligne 375 + check `if (!data)` ligne 376 : transformer le check `!data` en re-render avec erreurs.fichier. Plus loin après `fichierBuffer = await data.toBuffer();` ligne 380, ajouter une garde `if (fichierBuffer.length === 0)` qui re-rend pareil.

    Le pattern de re-render (à factoriser dans une closure locale `renderUploadErreurFichier`) :
    ```ts
    const renderErreurFichier = async (
      collectedFields: Record<string, string>,
    ) => {
      const { ticket, bien, justificatifs } = await lireTicket(
        { id },
        {
          ticketRepo: opts.ticketRepo,
          bienRepo: opts.bienRepo,
          justificatifRepo: opts.justificatifRepo,
        },
      );
      return reply.code(400).view('pages/travaux/detail.ejs', {
        ticket,
        bien,
        justificatifs,
        navActive: 'biens',
        erreurs: { fichier: 'Aucun fichier reçu.' },
        valeurs: collectedFields,
      });
    };
    ```

    Cas 1 (`!data`) : on n'a pas encore parsé les fields. Renvoyer avec `valeurs = {}`.
    Cas 2 (`fichierBuffer.length === 0`) : on a parsé `data.fields`. Re-collecter les fields texte (titre, type, dateDocument, montantTtcEuros, notes) dans un objet plain et le passer comme `valeurs`.

    Structure modifiée (ordre dans le try block) :
    ```ts
    try {
      const data = await req.file();
      if (!data) {
        return await renderErreurFichier({});
      }
      fichierBuffer = await data.toBuffer();
      fichierNom = data.filename;
      fichierMimeAnnonce = data.mimetype;
      const allFields = data.fields as Record<string, unknown>;
      for (const [k, v] of Object.entries(allFields)) {
        const value = readField(v);
        if (value !== undefined && k !== 'fichier') {
          fields[k] = value;
        }
      }
      // G-UX-02-bis : fichier vide (0 octet) envoyé par multipart sans sélection
      if (fichierBuffer.length === 0) {
        return await renderErreurFichier(fields);
      }
    } catch (err) { ... inchangé ... }
    ```

    Note : `renderErreurFichier` doit gérer le cas `TicketIntrouvable` (ticket n'existe pas). Wrapper l'appel `lireTicket` dans try/catch : si `TicketIntrouvable`, renvoyer `reply.code(404).send('Ticket introuvable.')`.

    **4. Test integration `tests/integration/web/travaux-ticket-pj-erreurs.test.ts`** (créer). Pattern dupliqué de `tests/integration/web/coffre-upload-erreurs.test.ts` (helper `buildMultipartBody` inline, ClockFixe, Kysely SqliteDialect, creerApp). Seeder un Bien + un Ticket via les builders existants (`tests/_builders/patrimoine.js` + `tests/_builders/travaux.js`) ou via SQL direct.

    Tests :
    - `it('POST /travaux/:id/justificatifs sans field fichier → 400 + "Aucun fichier reçu" + id fichier-error-ticket')` : multipart avec titre/type/dateDocument mais SANS field `fichier`. Asserter `statusCode === 400`, body contient `Aucun fichier reçu`, `id="fichier-error-ticket"`, `aria-invalid="true"`, ET les valeurs préservées (le titre fournis apparaît dans le HTML re-rendu).
    - `it('POST /travaux/:id/justificatifs avec fichier 0 octet → 400 + erreur visible + valeurs préservées')` : multipart avec field `fichier` mais `Buffer.from('')`. Mêmes asserts. Vérifier explicitement que `body.includes('value="Titre saisi par utilisateur"')` (préservation valeur titre).

    **5. Commit** : `fix(04-06): G-UX-02-bis — garde fichier vide + rendu erreur inline form upload PJ ticket`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/integration/web/travaux-ticket-pj-erreurs.test.ts && grep -c "fichierBuffer.length === 0" src/web/routes/travaux.ts && grep -c "fichier-error-ticket" src/web/views/partials/partial-ticket-pj-section.ejs && grep -c "renderErreurFichier\|renderErreur" src/web/routes/travaux.ts && grep -v '^[[:space:]]*//' src/web/views/partials/partial-ticket-pj-section.ejs | grep -c "valeurs.titre"</automated>
  </verify>
  <acceptance_criteria>
    - `src/web/routes/travaux.ts` contient `fichierBuffer.length === 0` (1 occurrence).
    - `src/web/views/partials/partial-ticket-pj-section.ejs` contient `fichier-error-ticket` (≥ 1 occurrence dans le rendu erreur).
    - Le partial préserve les valeurs (titre, type, dateDocument, notes, montantTtcEuros) via `valeurs.*`.
    - `tests/integration/web/travaux-ticket-pj-erreurs.test.ts` créé avec 2 tests verts.
    - Pas de régression : 615 tests verts (594 d'avant + ~21 de 04-05) + 2 nouveaux = 617 minimum.
  </acceptance_criteria>
  <done>
    - 3 fichiers source modifiés (travaux.ts, partial-ticket-pj-section.ejs, detail.ejs).
    - 1 fichier test créé (travaux-ticket-pj-erreurs.test.ts).
    - Tous grep checks passent.
    - 1 commit créé.
  </done>
</task>

<task type="auto">
  <name>Task 2 — G-DATE-01 : Défense en profondeur date future (domain + Zod + HTML5) sur clôture + max HTML5 sur création</name>
  <read_first>
    - src/domain/travaux/ticket-travaux.ts (lignes 96-132 creer() + 143-168 clore() — invariant existant + à ajouter)
    - src/web/schemas/ticket-travaux-schemas.ts (lignes 24-62 creerTicketSchema — refine existant à dupliquer + 77-99 cloreTicketSchema — refine à ajouter)
    - src/web/views/pages/travaux/nouveau.ejs (lignes 54-65 input dateOuverture — ajouter max)
    - src/web/views/pages/travaux/detail.ejs (lignes 75-99 form clôture — ajouter max + gestion erreur dateCloture)
    - src/web/routes/travaux.ts (lignes 224-286 POST clore — gestion erreur InvariantViolated à valider)
    - src/main.ts (lignes 159-178 preHandler — confirmer locals.today injecté globalement, AUCUN changement nécessaire)
    - src/application/travaux/clore-ticket-travaux.ts (use case — vérifier propagation InvariantViolated)
    - src/domain/_shared/clock.ts (Clock + ClockFixe)
    - tests/bdd/features/travaux.feature (lignes 31-36 T4 dateOuverture future PASSANT — pattern à dupliquer pour dateCloture)
    - tests/bdd/step_definitions/travaux.steps.ts (steps existants à réutiliser tels quels — chercher les When/Then matchant POST /travaux/:id/clore)
    - tests/unit/travaux/ticket-travaux.test.ts (tests creer() existants — pattern pour clore())
    - tests/unit/travaux/use-cases.test.ts (tests use cases existants)
    - .planning/phases/04-coffre-documentaire-travaux/04-HUMAN-UAT.md §G-DATE-01 (verbatim)
  </read_first>
  <behavior>
    **Avant — création ticket (dateOuverture)** : invariant domain + Zod rejettent déjà date future. Scénario BDD T4 passe. Mais l'input `nouveau.ejs:54-61` n'a PAS d'attribut `max` → le navigateur permet la saisie d'une date future, le serveur rejette, l'utilisateur voit l'erreur après round-trip. UX dégradée.

    **Avant — clôture ticket (dateCloture)** :
    - `TicketTravaux.clore(coutReelTtc, dateCloture, today)` vérifie uniquement `dateCloture < dateOuverture` (ligne 154-158). Pas de garde futur.
    - `cloreTicketSchema.dateCloture` (schema ligne 78-80) vérifie uniquement `regex /^\d{4}-\d{2}-\d{2}$/`. Pas de refine.
    - `detail.ejs:78-84` input dateCloture sans `max`.

    Résultat : le bailleur peut clôturer un ticket avec dateCloture = 2099-12-31. Bug métier (un ticket est clôturé à une date passée/présente, jamais future).

    **Après — création ticket (dateOuverture)** : ajouter `max="<%= locals.today ? locals.today.toString() : '' %>"` sur l'input. `locals.today` injecté globalement par main.ts:159-178 (preHandler), AUCUN changement de route GET nécessaire.

    **Après — clôture ticket (dateCloture)** : défense en profondeur 3 couches :
    - **Domain** : `TicketTravaux.clore(coutReelTtc, dateCloture, today)` lève `InvariantViolated('La date de clôture ne peut pas être dans le futur.')` si `Temporal.PlainDate.compare(dateCloture, today) > 0`. Insertion avant ou après le check `< dateOuverture` (préférable AVANT pour donner la priorité au message le plus pertinent métier). Le message est verbatim cohérent avec le message dateOuverture existant.
    - **Zod** : ajouter un refine dupliqué de `creerTicketSchema.dateOuverture` (lignes 38-49) — utilise `Temporal.Now.plainDateISO()` (pattern existant Phase 4). Message verbatim 'La date de clôture ne peut pas être dans le futur.'
    - **HTML5** : `max="<%= locals.today ? locals.today.toString() : '' %>"` sur `detail.ejs:78-84`.
    - **Vue gestion erreur** : detail.ejs doit afficher `erreurs.dateCloture` sous l'input (actuellement il n'y a aucune gestion d'erreur inline sur ce form, seule la bannière warning est utilisée via `banniereWarning`). Ajouter un bloc `<% if (locals.erreurs && erreurs.dateCloture) { %>...<% } %>` après l'input (pattern verbatim de nouveau.ejs:62-64). Aria-invalid + aria-describedby sur l'input.

    **Choix Zod — Now vs clock injecté** : le pattern existant Phase 4 (`creerTicketSchema:42` + `ajouterPJUploadSchema:135`) utilise `Temporal.Now.plainDateISO()` direct. Cohérent avec « la Zod est un garde-fou couche transport, le domain reste la source de vérité testable via clock injecté ». On garde ce pattern. **Trade-off accepté** : un test BDD avec `ClockFixe('2026-05-18')` qui soumet `dateCloture = 2026-05-20` passera la Zod si la date réelle d'exécution est postérieure à 2026-05-20. Le domain TicketTravaux.clore() reste la garantie testable.

    **Route POST /travaux/:id/clore (travaux.ts:225-286)** : déjà 277-280 `if (err instanceof InvariantViolated) { req.session.banniereWarning = err.message; return reply.redirect(...) }`. Pour cohérence avec le pattern existant, on **garde ce comportement** (warning + redirect). Le test BDD vérifiera donc le statut 302 + message dans la session OU le re-render après bannière. Voir step_definitions existants — adapter au pattern testé pour T4 si nécessaire.

    Mais pour le scénario `parsed.success === false` (Zod), travaux.ts:230-258 fait déjà un re-render avec `banniereWarning: messageVerbatim`. Le message verbatim Zod sera donc visible.
  </behavior>
  <action>
    **1. Modifier `src/domain/travaux/ticket-travaux.ts` méthode `clore()`** lignes 143-168 — ajouter la garde futur AVANT la garde `< dateOuverture` (priorité métier) :
    ```ts
    clore(
      coutReelTtc: Money,
      dateCloture: Temporal.PlainDate,
      today: Temporal.PlainDate,
    ): TicketTravaux {
      if (this.statut === 'clos') {
        throw new TransitionInvalide('Ticket déjà clos.');
      }
      if (this.statut === 'annule') {
        throw new TransitionInvalide('Ticket annulé — impossible de clore.');
      }
      // G-DATE-01 : parité avec creer() — date métier toujours <= today
      if (Temporal.PlainDate.compare(dateCloture, today) > 0) {
        throw new InvariantViolated(
          'La date de clôture ne peut pas être dans le futur.',
        );
      }
      if (Temporal.PlainDate.compare(dateCloture, this.dateOuverture) < 0) {
        throw new InvariantViolated(
          "La date de clôture ne peut pas précéder la date d'ouverture.",
        );
      }
      return TicketTravaux.creer(
        {
          ...this.toProps(),
          statut: 'clos',
          dateCloture,
          coutReelTtc,
        },
        today,
      );
    }
    ```

    Mettre à jour le docstring lignes 137-141 pour mentionner la nouvelle garde.

    **2. Modifier `src/web/schemas/ticket-travaux-schemas.ts` `cloreTicketSchema`** lignes 77-99 — ajouter le refine sur dateCloture (pattern verbatim de creerTicketSchema:38-49) :
    ```ts
    export const cloreTicketSchema = z.object({
      dateCloture: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ.')
        .refine(
          (s) => {
            try {
              const d = Temporal.PlainDate.from(s);
              const today = Temporal.Now.plainDateISO();
              return Temporal.PlainDate.compare(d, today) <= 0;
            } catch {
              return false;
            }
          },
          'La date de clôture ne peut pas être dans le futur.',
        ),
      coutReelTtcEuros: z.preprocess( ... inchangé ... ),
    });
    ```

    **3. Modifier `src/web/views/pages/travaux/nouveau.ejs` lignes 54-61** input dateOuverture — ajouter `max` :
    ```ejs
    <input
      id="dateOuverture"
      name="dateOuverture"
      type="date"
      required
      max="<%= locals.today ? locals.today.toString() : '' %>"
      value="<%= (locals.valeurs && locals.valeurs.dateOuverture) || (locals.today ? locals.today.toString() : '') %>"
      <% if (locals.erreurs && erreurs.dateOuverture) { %>aria-invalid="true" aria-describedby="dateOuverture-error"<% } %>
    />
    ```

    **4. Modifier `src/web/views/pages/travaux/detail.ejs` lignes 75-98** form clôture — ajouter `max` + bloc rendu erreur dateCloture :
    ```ejs
    <form method="POST" action="/travaux/<%= ticket.id %>/clore" novalidate>
      <div class="field">
        <label for="dateCloture">Date de clôture <span aria-hidden="true">*</span></label>
        <input
          id="dateCloture"
          name="dateCloture"
          type="date"
          required
          max="<%= locals.today ? locals.today.toString() : '' %>"
          value="<%= (locals.valeurs && locals.valeurs.dateCloture) || (locals.today ? locals.today.toString() : '') %>"
          <% if (locals.erreurs && erreurs.dateCloture) { %>aria-invalid="true" aria-describedby="dateCloture-error"<% } %>
        />
        <% if (locals.erreurs && erreurs.dateCloture) { %>
          <span id="dateCloture-error" role="alert" style="color: var(--couleur-destructive, #b91c1c);"><%= erreurs.dateCloture %></span>
        <% } %>
      </div>
      ... (suite inchangée pour coutReelTtcEuros)
    </form>
    ```

    Note : la route POST /clore (travaux.ts:230-258) ne passe pas `valeurs` lors d'un re-render Zod fail. Mais comme `extraireErreurs` est appelé, on récupère `erreurs.dateCloture`. Vérifier que `detail.ejs` est appelé avec `erreurs` quand la Zod échoue. Si ce n'est pas le cas (le code actuel utilise `banniereWarning`), garder le `banniereWarning` ET ajouter le rendu `erreurs.dateCloture` qui sera utilisé si une route future passe `erreurs` explicitement. Le test BDD ci-dessous validera le pattern actuel (bannière) — pas besoin de refactor route.

    **5. Test unit `tests/unit/travaux/ticket-travaux.test.ts`** — ajouter dans le `describe('clore', ...)` existant :
    ```ts
    it("G-DATE-01 — clore() rejette dateCloture future (parité avec creer)", () => {
      const today = Temporal.PlainDate.from('2026-05-19');
      const ticket = TicketTravaux.creer(
        unTicketTravauxValide({ dateOuverture: Temporal.PlainDate.from('2026-05-10') }),
        today,
      );
      expect(() =>
        ticket.clore(
          Money.fromEuros(100),
          Temporal.PlainDate.from('2026-05-20'), // futur > today
          today,
        ),
      ).toThrow(/La date de clôture ne peut pas être dans le futur/);
    });

    it("G-DATE-01 — clore() accepte dateCloture === today", () => {
      const today = Temporal.PlainDate.from('2026-05-19');
      const ticket = TicketTravaux.creer(
        unTicketTravauxValide({ dateOuverture: Temporal.PlainDate.from('2026-05-10') }),
        today,
      );
      expect(() =>
        ticket.clore(Money.fromEuros(100), today, today),
      ).not.toThrow();
    });
    ```

    **6. Test unit `tests/unit/travaux/use-cases.test.ts`** — ajouter dans `describe('cloreTicketTravaux', ...)` (créer si absent — chercher la section existante) :
    ```ts
    it("G-DATE-01 — cloreTicketTravaux propage InvariantViolated si dateCloture future", async () => {
      const today = Temporal.PlainDate.from('2026-05-19');
      const clockTest = ClockFixe.du('2026-05-19');
      const { repo: ticketRepo, tickets } = mockTicketRepo();
      const ticket = TicketTravaux.creer(
        unTicketTravauxValide({ dateOuverture: Temporal.PlainDate.from('2026-05-10') }),
        today,
      );
      tickets.set(ticket.id, ticket);
      await expect(
        cloreTicketTravaux(
          {
            id: ticket.id,
            dateCloture: Temporal.PlainDate.from('2026-06-01'), // > today fixe
            coutReelTtc: Money.fromEuros(100),
          },
          { ticketRepo, clock: clockTest },
        ),
      ).rejects.toThrow(/La date de clôture ne peut pas être dans le futur/);
    });
    ```

    **7. Scénario BDD** — ajouter dans `tests/bdd/features/travaux.feature` après le scénario T11 (refus clôture sans coût réel), nouveau scénario tag `@gap-uat-date @inc-01` :
    ```gherkin
    @gap-uat-date @inc-01
    Scenario: T17 — Refus clôture si dateCloture future (G-DATE-01)
      Given un ticket de travaux existe rattaché au Bien
      When le bailleur soumet POST /travaux/:id/clore avec dateCloture "2099-12-31" coutReelTtcEuros "100"
      Then la réponse a le statut 400
      And la page affiche "La date de clôture ne peut pas être dans le futur."
      And la table tickets_travaux contient 1 ligne avec statut "ouvert"
    ```

    Le step `When le bailleur soumet POST /travaux/:id/clore avec dateCloture "..." coutReelTtcEuros "..."` existe DÉJÀ (utilisé par T10). Il faut juste s'assurer que le step `Then la réponse a le statut 400` matche bien le comportement actuel (Zod fail → re-render code 400 OU domain fail → redirect 302 + banniereWarning). Lire `tests/bdd/step_definitions/travaux.steps.ts` pour vérifier — la Zod refine garantit 400 (cf. travaux.ts:230-258 `if (!parsed.success)` → `reply.code(400).view(...)`).

    Si après vérification le step Then « la page affiche … » ne fonctionne pas avec `banniereWarning` (le message verbatim Zod va dans `erreurs.dateCloture` qui est wrappé dans `messageVerbatim` ligne 234, puis affiché en bannière warning), adapter le step OU le scénario pour matcher le bandeau warning. Privilégier l'option « le scénario reste lisible » — viser le verbatim métier.

    **8. Test integration optionnel** : `tests/integration/web/travaux-max-date.test.ts` — vérifier que les inputs date contiennent `max=<date courante>` :
    ```ts
    it('GET /travaux/nouveau?bienId=... contient input dateOuverture avec max=today', async () => {
      const res = await app.inject({ method: 'GET', url: `/travaux/nouveau?bienId=${bien.id}` });
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatch(/<input[^>]*id="dateOuverture"[^>]*max="2026-05-19"/);
    });

    it('GET /travaux/:id contient input dateCloture avec max=today si ticket ouvert', async () => {
      // créer ticket ouvert via SQL
      const res = await app.inject({ method: 'GET', url: `/travaux/${ticket.id}` });
      expect(res.statusCode).toBe(200);
      expect(res.body).toMatch(/<input[^>]*id="dateCloture"[^>]*max="2026-05-19"/);
    });
    ```

    Implémentation pragmatique : fusionner ces 2 tests dans le fichier déjà créé en T1 (`travaux-ticket-pj-erreurs.test.ts`) sous un nouveau `describe('G-DATE-01 — max HTML5')`, ou créer un fichier dédié si la séparation logique se justifie. **Recommandation : fichier dédié** `tests/integration/web/travaux-max-date.test.ts` pour traçabilité gap.

    **9. Commit** : `fix(04-06): G-DATE-01 — invariant dateCloture <= today (domain + Zod + HTML5) + max HTML5 sur dateOuverture`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm test -- tests/unit/travaux/ticket-travaux.test.ts tests/unit/travaux/use-cases.test.ts tests/integration/web/travaux-max-date.test.ts && pnpm test:bdd -- --tags "@gap-uat-date" && grep -c "La date de clôture ne peut pas être dans le futur" src/domain/travaux/ticket-travaux.ts && grep -c "La date de clôture ne peut pas être dans le futur" src/web/schemas/ticket-travaux-schemas.ts && grep -c "max=\"<%= locals.today" src/web/views/pages/travaux/nouveau.ejs && grep -c "max=\"<%= locals.today" src/web/views/pages/travaux/detail.ejs && grep -c "@gap-uat-date" tests/bdd/features/travaux.feature</automated>
  </verify>
  <acceptance_criteria>
    - `src/domain/travaux/ticket-travaux.ts` : `clore()` lève `InvariantViolated('La date de clôture ne peut pas être dans le futur.')` si `dateCloture > today`.
    - `src/web/schemas/ticket-travaux-schemas.ts` : `cloreTicketSchema.dateCloture` a un `refine` avec le message verbatim (cohérent avec `creerTicketSchema.dateOuverture`).
    - `src/web/views/pages/travaux/nouveau.ejs` : input `dateOuverture` a `max="<%= locals.today.toString() %>"`.
    - `src/web/views/pages/travaux/detail.ejs` : input `dateCloture` a `max="<%= locals.today.toString() %>"` + rendu erreur `dateCloture` sous l'input.
    - 1 nouveau scénario BDD `@gap-uat-date @inc-01` VERT (POST `/travaux/:id/clore` avec date future → 400 + bandeau + form ré-affiché).
    - 1 nouveau test unit `ticket-travaux.test.ts` (`clore()` rejette `dateCloture > today` via ClockFixe).
    - 1 nouveau test unit `use-cases.test.ts` (le use case `cloreTicketTravaux` propage l'erreur domain).
    - 2 nouveaux tests integration `travaux-max-date.test.ts` (GET `/travaux/nouveau` + GET `/travaux/:id` contiennent l'attribut HTML5 `max` avec la date du jour).
    - `pnpm typecheck` exit 0, `pnpm depcruise src` exit 0, 0 régression sur les tests existants.
  </acceptance_criteria>
  <done>
    - 6 fichiers source modifiés (domain ticket-travaux + Zod schema + 2 vues EJS + 1 BDD feature + 3 fichiers tests).
    - Tous les grep checks passent.
    - 1 commit créé : `fix(04-06): G-DATE-01 — invariant dateCloture <= today (domain + Zod + HTML5) + max HTML5 sur dateOuverture`.
  </done>
</task>

</tasks>

## Verification globale (orchestrateur — `gsd-verifier`)

Après les 2 tasks committées, la verifier re-run doit retourner `status: passed` avec :
- `gaps_closed: [G-UX-02-bis, G-DATE-01]`
- `gaps_remaining: []`
- `regressions: []`

Checks programmatiques (à exécuter post-merge worktree, AVANT verifier) :

| Check | Commande | Attendu |
|---|---|---|
| Typecheck | `pnpm typecheck` | exit 0 |
| Tests unit + integration | `pnpm test` | ≥ 622 verts (615 existants + ~7-9 nouveaux) |
| Tests BDD | `pnpm test:bdd` | ≥ 133 (112 + 1 `@gap-uat-date`) |
| Depcruise | `pnpm depcruise src --config .dependency-cruiser.cjs` | 0 violation |
| Garde fichier vide route ticket | `grep "fichierBuffer.length === 0" src/web/routes/travaux.ts` | ≥ 1 |
| Refactor handler upload (plus de session warning) | `grep -c "session.banniereWarning" src/web/routes/travaux.ts` (mode upload) | régression : doit décroître |
| Rendu erreur inline partial | `grep "fichier-error-ticket" src/web/views/partials/partial-ticket-pj-section.ejs` | ≥ 1 |
| aria-invalid sur input PJ ticket | `grep "aria-invalid" src/web/views/partials/partial-ticket-pj-section.ejs` | ≥ 1 |
| Invariant clôture domain | `grep "La date de clôture ne peut pas être dans le futur" src/domain/travaux/ticket-travaux.ts` | ≥ 1 |
| Refine Zod clôture | `grep "La date de clôture ne peut pas être dans le futur" src/web/schemas/ticket-travaux-schemas.ts` | ≥ 1 |
| HTML5 max création | `grep 'max="<%= locals.today' src/web/views/pages/travaux/nouveau.ejs` | ≥ 1 |
| HTML5 max clôture | `grep 'max="<%= locals.today' src/web/views/pages/travaux/detail.ejs` | ≥ 1 |
| Scénario BDD G-DATE-01 | `grep "@gap-uat-date" tests/bdd/features/travaux.feature` | ≥ 1 |

Si toutes les vérifications passent, le verifier mettra à jour `04-HUMAN-UAT.md` (`gaps_closed_by: 04-06-gap-closure-uat-test2`, ajout `G-UX-02-bis` + `G-DATE-01` dans `gaps_closed` array) et la Phase 4 reste `passed`.

## Notes de vigilance pendant l'exécution

1. **T1 — refactor du handler upload, pas seulement ajout de garde** : la route `travaux.ts` mode upload utilise actuellement `session.banniereWarning + redirect 302`. Le fix exige de quitter ce pattern entièrement pour basculer sur `reply.code(400).view('pages/travaux/detail.ejs', { ticket, bien, justificatifs, erreurs: { fichier: '...' }, valeurs })`. Cela signifie aussi re-récupérer le contexte fiche ticket (lireTicket + bien + justificatifs disponibles) côté error path. Le pattern à recopier est `coffre.ts:199-222` (POST /coffre/upload).

2. **T1 — id="fichier-error-ticket" (avec suffixe)** : le coffre utilise déjà `id="fichier-error"`. Pour éviter une collision DOM si les 2 forms cohabitent dans une même page (peu probable mais robuste), suffixer avec `-ticket`. Faire pareil côté `aria-describedby` sur l'input.

3. **T1 — valeurs préservées** : titre, type, dateDocument, montant, notes — les remettre dans `valeurs` lors du re-render erreur. Tester via 1 test integration qui vérifie qu'après POST sans fichier, les autres champs sont conservés.

4. **T2 — pattern Zod = `Temporal.Now.plainDateISO()` direct** (pas le clock injecté côté schema). Cohérent avec `creerTicketSchema:42` et `ajouterPJUploadSchema:135`. Le domain `TicketTravaux.clore()` reste la source de vérité testable via `ClockFixe`.

5. **T2 — `locals.today` injecté globalement** par preHandler `main.ts:159-178`. Aucun changement de route GET nécessaire. Vérifier juste que `locals.today` est un `Temporal.PlainDate` (vs string) — utiliser `.toString()` dans l'attribut `max`.

6. **T2 — Pas de scénario BDD côté création** : T4 existant couvre déjà `dateOuverture` future = rejet. Pour G-DATE-01 côté création, il ne manque que le `max` HTML5 → test integration suffisant (1 test). Le scénario BDD nouveau cible la clôture (cas non couvert avant ce plan).

7. **Ordre des tasks** : T1 indépendant de T2. Possibilité de paralléliser si exécuteur multi-thread (mais avec un seul gsd-executor sequential, T1 → T2 est le plus simple).

8. **Hors périmètre rappel** :
   - Audit des autres formulaires de dates métier (échéance loyer, encaissement, EDL, IRL…) → reporté V1.1 si pertinent. L'UAT actuel ne remonte que les forms ticket.
   - Les drag&drop multi-upload V2 + autres optimisations UI restent V2.
   - WR-02 (compensation soft-delete sur échec disque) et WR-06 (substr index break) toujours différés dans RISKS.md.
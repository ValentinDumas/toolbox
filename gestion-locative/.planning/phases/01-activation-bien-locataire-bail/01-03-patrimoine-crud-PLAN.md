---
phase: 01-activation-bien-locataire-bail
plan: 03
type: execute
wave: 2
depends_on: [01-02]
files_modified:
  - src/domain/patrimoine/bien.ts
  - src/domain/patrimoine/lot.ts
  - src/domain/patrimoine/bien-repository.ts
  - src/infrastructure/repositories/bien-repository-sqlite.ts
  - src/application/patrimoine/modifier-bien.ts
  - src/application/patrimoine/supprimer-bien.ts
  - src/application/patrimoine/lister-biens.ts
  - src/application/patrimoine/ajouter-lot.ts
  - src/application/patrimoine/supprimer-lot.ts
  - src/web/routes/biens.ts
  - src/web/schemas/bien-schemas.ts
  - src/web/views/pages/biens/liste.ejs
  - src/web/views/pages/biens/formulaire.ejs
  - src/web/views/pages/biens/detail.ejs
  - src/web/views/partials/form-field.ejs
  - src/web/views/partials/data-table.ejs
  - src/web/views/partials/confirm-dialog.ejs
  - tests/unit/patrimoine/bien.test.ts
  - tests/unit/patrimoine/lot.test.ts
  - tests/integration/repositories/bien-repository-sqlite.test.ts
autonomous: true
requirements: [PAT-01, PAT-02]
tags: [patrimoine, crud, bien, lot, hexagonal, zod]

must_haves:
  truths:
    - "L'utilisateur peut créer un Bien avec ≥1 Lot via formulaire dédié `/biens/nouveau` (≠ skeleton inline)."
    - "L'utilisateur peut ajouter plusieurs Lots à un Bien lors de la création (types appartement/parking/cave/etc)."
    - "L'utilisateur peut éditer un Bien existant (toutes propriétés + Lots) via `/biens/:id/modifier`."
    - "L'utilisateur peut supprimer un Bien via confirmation (`POST /biens/:id/supprimer` après confirmation dialog) — soft-delete `supprime_le`."
    - "L'utilisateur peut ajouter un Lot à un Bien existant via `/biens/:id/lots`."
    - "L'utilisateur peut supprimer un Lot d'un Bien (soft-delete) — refusé si c'est le dernier Lot (invariant ≥1)."
    - "GET `/biens` affiche la table avec sticky header, zebra, sort indicators, actions row-hover (UI-SPEC §Data Table)."
    - "GET `/biens/:id` affiche le détail du Bien et sa liste de Lots."
    - "Validation HTTP via Zod, erreurs inline aria-describedby (UI-SPEC §Forms)."
    - "Tous types `TypeBien` et `TypeLot` enum sont supportés (D-28, D-29)."
  artifacts:
    - path: "src/web/schemas/bien-schemas.ts"
      provides: "Schémas Zod pour parsing form-data Bien + Lots"
      exports: ["bienCreationSchema", "bienModificationSchema", "lotCreationSchema"]
    - path: "src/web/views/pages/biens/formulaire.ejs"
      provides: "Formulaire create + edit Bien avec N Lots dynamiques"
    - path: "src/web/views/pages/biens/detail.ejs"
      provides: "Page détail Bien + table Lots + actions"
    - path: "src/web/views/partials/form-field.ejs"
      provides: "Partial réutilisable label + input + erreur"
    - path: "src/web/views/partials/data-table.ejs"
      provides: "Partial réutilisable table aria-label + sticky + zebra"
    - path: "src/web/views/partials/confirm-dialog.ejs"
      provides: "Modal <dialog> destructive confirm (réutilisable suppressions)"
  key_links:
    - from: "src/web/routes/biens.ts"
      to: "src/web/schemas/bien-schemas.ts"
      via: "fastify-type-provider-zod parsing body"
      pattern: "bienCreationSchema|safeParse"
    - from: "src/web/routes/biens.ts"
      to: "src/application/patrimoine/modifier-bien.ts"
      via: "POST /biens/:id/modifier → use case"
      pattern: "modifierBien\\("
    - from: "src/domain/patrimoine/bien.ts"
      to: "src/domain/patrimoine/lot.ts"
      via: "Bien composé de Lots — invariant ≥1"
      pattern: "lots\\.length"
---

<objective>
Compléter le CRUD `Bien` et la gestion N-Lots après le Walking Skeleton minimal. Passer du formulaire inline mono-lot du plan 02 à un vrai parcours admin : création multi-lots, édition, suppression avec confirmation, listing tabulé conforme UI-SPEC.

**Slice MVP utilisateur :** En tant que bailleur, après avoir créé mon premier Bien via le skeleton, je peux maintenant : ajouter un Bien avec 3 Lots distincts (un appartement, un parking, une cave), éditer son adresse, supprimer un Lot devenu obsolète, et supprimer un Bien entier après confirmation — tout via interface tabulaire admin (sidebar + breadcrumbs UI-SPEC §"Layout Shell").

Purpose: Couvrir PAT-01 (CRUD complet — create+read+update+delete) et PAT-02 (multi-lots) intégralement, avec validation Zod et UI conforme UI-SPEC. Établir les partials EJS réutilisables (form-field, data-table, confirm-dialog) que Plans 04-05 réutiliseront pour Locataire et Bail.
Output: 5 nouvelles routes (`/biens/nouveau`, `/biens/:id`, `/biens/:id/modifier`, `/biens/:id/supprimer`, `/biens/:id/lots`), 3 nouveaux use cases, schemas Zod, 3 partials EJS réutilisables, tests unit Lot + tests intégration repo étendus (update, soft-delete Lot, plusieurs Lots).
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
@.planning/phases/01-activation-bien-locataire-bail/01-02-walking-skeleton-SUMMARY.md
@DDD.md
@BDD_PRACTICES.md
@LOCATION_MEUBLEE_REGLES.md

<interfaces>
<!-- Existant après plan 02 — réutilisé tel quel. -->

Existant (plan 02) :
- `Bien.creer({ id?, adresse, surface, type, anneeConstruction, lots })` — factory invariants
- `Lot.creer({ designation, surface, type, etage })` — factory invariants
- `BienRepository.enregistrer / trouverParId / listerTous / supprimer` — port
- `creerBien(commande, repo)` — use case

À étendre dans ce plan :
- `Bien.modifier({ adresse?, surface?, type?, anneeConstruction? })` méthode immuable → retourne nouvelle instance
- `Bien.supprimerLot(lotId)` méthode immuable → throw si dernier lot
- `Bien.ajouterLot(lot)` (existe déjà plan 02) — utilisée par le use case AjouterLot

Nouveau (à créer) :
- `modifierBien(id, patch, repo): Promise<void>` use case
- `supprimerBien(id, repo): Promise<void>` use case
- `listerBiens(repo): Promise<Bien[]>` use case (mince — délégué direct)
- `ajouterLot(bienId, lotData, repo): Promise<LotId>` use case
- `supprimerLot(bienId, lotId, repo): Promise<void>` use case
- Schemas Zod : `bienCreationSchema`, `bienModificationSchema`, `lotCreationSchema`
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests unit Lot + tests unit Bien étendus + tests intégration repo étendus (rouges)</name>
  <files>
    tests/unit/patrimoine/lot.test.ts,
    tests/unit/patrimoine/bien.test.ts,
    tests/integration/repositories/bien-repository-sqlite.test.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-28, D-29 (Lot toujours obligatoire)
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §2 (invariants agrégat Bien), §6 (invariants domaine)
    - tests/unit/patrimoine/bien.test.ts (existant après plan 02)
    - tests/integration/repositories/bien-repository-sqlite.test.ts (existant après plan 02)
    - BDD_PRACTICES.md §4 (Règles d'or), §9 (Builders factories — introduire ici)
  </read_first>
  <behavior>
    `tests/unit/patrimoine/lot.test.ts` (nouveau) :
    - "Lot.creer rejette designation vide" → throw
    - "Lot.creer accepte type 'parking' avec surface null" → ne throw pas
    - "Lot.creer rejette type 'appartement' avec surface null" → throw (invariant : appartement requiert surface)
    - "Lot.creer rejette type 'appartement' avec surface ≤ 0" → throw
    - "Lot.creer rejette type hors enum" → throw

    `tests/unit/patrimoine/bien.test.ts` (étendre) :
    - "Bien.modifier({ surface: 50 }) retourne nouvelle instance avec surface 50" + ancien Bien inchangé (immutabilité)
    - "Bien.modifier({ surface: 0 }) throw InvariantViolated"
    - "Bien.ajouterLot retourne nouvelle instance avec lots.length + 1"
    - "Bien.supprimerLot retire le lot ciblé" → nouvelle instance avec lots.length - 1
    - "Bien.supprimerLot du dernier lot throw InvariantViolated('au moins un Lot')" (D-29)

    `tests/integration/repositories/bien-repository-sqlite.test.ts` (étendre) :
    - "enregistrer met à jour un Bien existant (même id) — update path" : insert puis re-insert avec surface modifiée → listerTous retourne 1 résultat avec nouvelle surface
    - "enregistrer persiste plusieurs Lots du même Bien" : Bien avec 3 Lots → trouverParId retourne instance avec 3 Lots dans le bon ordre
    - "supprimer (soft-delete) → trouverParId retourne null" : insert puis supprimer puis trouverParId → null
    - "supprimer un Bien soft-delete ses Lots associés" : check colonne supprime_le sur lots également

    Introduire des builders dans `tests/_builders/patrimoine.ts` (nouveau fichier, hors src — utilisé seulement par tests) :
    - `unBienValide(overrides?): Bien` — retourne Bien avec defaults sensés (adresse "1 rue Test, 75001 Paris", surface 50, type 'appartement', annee 2000, 1 Lot 'Appartement principal')
    - `unLotValide(overrides?): Lot` — defaults sensés
  </behavior>
  <action>
    Créer `tests/_builders/patrimoine.ts` exportant `unBienValide` et `unLotValide` (BDD_PRACTICES.md §9 — factories).

    Créer `tests/unit/patrimoine/lot.test.ts` avec les 5 tests listés en behavior.

    Étendre `tests/unit/patrimoine/bien.test.ts` avec les 5 tests additionnels (modifier, ajouterLot, supprimerLot — le test "Bien.creer rejette lots vide" du plan 02 doit toujours passer).

    Étendre `tests/integration/repositories/bien-repository-sqlite.test.ts` avec les 4 tests additionnels (update path, multi-lots, soft-delete Bien cascade Lots).

    À ce stade : `pnpm test -- patrimoine` est **rouge** (méthodes Bien.modifier/supprimerLot pas implémentées, Lot invariants pas tous implémentés, repo update path pas codé). C'est attendu.
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/patrimoine/ tests/integration/repositories/bien-repository-sqlite.test.ts 2&gt;&amp;1 | grep -E "FAIL|Tests:" || true</automated>
  </verify>
  <acceptance_criteria>
    - `tests/_builders/patrimoine.ts` exporte `unBienValide` et `unLotValide` (assertion: `grep -qE "export.*unBienValide" tests/_builders/patrimoine.ts && grep -qE "export.*unLotValide" tests/_builders/patrimoine.ts`).
    - `tests/unit/patrimoine/lot.test.ts` contient ≥ 5 occurrences `it(` ou `test(` (assertion: `grep -cE "^[[:space:]]*(it|test)\(" tests/unit/patrimoine/lot.test.ts` ≥ 5).
    - `tests/unit/patrimoine/bien.test.ts` contient désormais ≥ 8 tests (3 du plan 02 + 5 nouveaux).
    - `tests/integration/repositories/bien-repository-sqlite.test.ts` contient ≥ 6 tests (2 du plan 02 + 4 nouveaux).
    - `pnpm test -- --run tests/unit/patrimoine/` exit code ≠ 0 (rouge attendu).
  </acceptance_criteria>
  <done>Le contrat à satisfaire est entièrement décrit en tests (outside-in). Les behaviors d'invariants Lot, mutations immuables Bien, et roundtrip repo multi-lots sont figés.</done>
</task>

<task type="auto">
  <name>Task 2: Domaine étendu (Lot complet, Bien.modifier/ajouterLot/supprimerLot) + use cases + repo update path</name>
  <files>
    src/domain/patrimoine/lot.ts,
    src/domain/patrimoine/bien.ts,
    src/infrastructure/repositories/bien-repository-sqlite.ts,
    src/application/patrimoine/modifier-bien.ts,
    src/application/patrimoine/supprimer-bien.ts,
    src/application/patrimoine/lister-biens.ts,
    src/application/patrimoine/ajouter-lot.ts,
    src/application/patrimoine/supprimer-lot.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-28, D-29 (Lot ≥1), D-42 (CRUD complet)
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §2 (invariants), §6 (priorités Phase 1)
    - DDD.md §4.1 (Entité — comportement DANS la classe), §4.3 (Agrégat — une transaction = un agrégat)
    - src/domain/patrimoine/bien.ts (existant — étendre, ne pas réécrire)
    - src/infrastructure/repositories/bien-repository-sqlite.ts (existant — étendre)
    - tests/unit/patrimoine/lot.test.ts (le contrat)
    - tests/unit/patrimoine/bien.test.ts (le contrat étendu)
    - tests/integration/repositories/bien-repository-sqlite.test.ts (le contrat repo étendu)
  </read_first>
  <action>
    Étendre `src/domain/patrimoine/lot.ts` — invariants conditionnels :
    - `Lot.creer` :
      - `designation` non vide (déjà plan 02).
      - `type` ∈ TypeLot (déjà).
      - Si `type ∈ {'appartement', 'maison', 'local_commercial'}` alors `surface !== null && surface > 0`, sinon `surface` peut être null OU positive.
      - `etage` : entier ou null.

    Étendre `src/domain/patrimoine/bien.ts` :
    - Méthode `modifier(patch: { adresse?: Adresse; surface?: number; type?: TypeBien; anneeConstruction?: number }): Bien` :
      - Merge patch + lots existants, appelle `Bien.creer({...this, ...patch, lots: this.lots})` → factory re-valide tous les invariants.
      - Préserve `this.id` (mêmes invariants si modifie surface 50 → 0 throw).
    - Méthode `ajouterLot(lot: Lot): Bien` (existe plan 02 — vérifier qu'elle retourne `new Bien(...)` immuable).
    - Méthode `supprimerLot(lotId: LotId): Bien` :
      - `const restants = this.lots.filter(l => l.id !== lotId)`.
      - Si `restants.length === 0` → throw `InvariantViolated("Un Bien doit conserver au moins un Lot")` (D-29).
      - Retourne `Bien.creer({...this, lots: restants})`.

    Étendre `src/infrastructure/repositories/bien-repository-sqlite.ts` :
    - Méthode `enregistrer` doit être idempotente :
      - Detecter existence (SELECT WHERE id) → INSERT ou UPDATE en conséquence.
      - **Pattern recommandé** : `INSERT INTO bien (...) ON CONFLICT(id) DO UPDATE SET ...` (SQLite upsert depuis 3.24).
      - Pour les Lots : `DELETE FROM lot WHERE bien_id = ? AND id NOT IN (...)` (soft-delete les retirés), puis upsert ceux dans l'agrégat.
      - **Tout dans une transaction** (Kysely `db.transaction().execute(...)` — DDD.md §6 une transaction = un agrégat).
    - Méthode `supprimer(id)` : update `bien.supprime_le = CURRENT_TIMESTAMP` ET update tous les `lot.supprime_le` pour ce bien (cascade soft-delete).
    - Méthode `trouverParId` filtre déjà `supprime_le IS NULL` (plan 02) — vérifier que les Lots filtrés aussi.

    `src/application/patrimoine/lister-biens.ts` :
    - `export async function listerBiens(repo: BienRepository): Promise<Bien[]> { return repo.listerTous(); }` — mince.

    `src/application/patrimoine/modifier-bien.ts` :
    - `interface ModifierBienCommand { id: BienId; adresse?: { rue: string; codePostal: string; ville: string }; surface?: number; type?: TypeBien; anneeConstruction?: number; }`
    - `export async function modifierBien(commande, repo): Promise<void>`
    - Steps : repo.trouverParId(commande.id) → si null throw `BienIntrouvable`. Construire patch (mapper adresse partial → `Adresse.creer` si fourni). bien.modifier(patch). repo.enregistrer(bienModifie).

    `src/application/patrimoine/supprimer-bien.ts` :
    - `export async function supprimerBien(id: BienId, repo: BienRepository): Promise<void>`
    - Steps : repo.trouverParId(id) → si null throw `BienIntrouvable`. repo.supprimer(id).

    `src/application/patrimoine/ajouter-lot.ts` :
    - `interface AjouterLotCommand { bienId: BienId; designation: string; surface: number | null; type: TypeLot; etage: number | null; }`
    - `export async function ajouterLot(commande, repo): Promise<LotId>`
    - Steps : repo.trouverParId(commande.bienId) → null=throw. Lot.creer(...). bien.ajouterLot(lot). repo.enregistrer(bien). Retourne lot.id.

    `src/application/patrimoine/supprimer-lot.ts` :
    - `export async function supprimerLot(bienId, lotId, repo): Promise<void>`
    - Steps : repo.trouverParId. bien.supprimerLot(lotId) (throw si dernier). repo.enregistrer.

    Définir `class BienIntrouvable extends Error` dans `src/domain/patrimoine/erreurs.ts` (ou réutiliser `InvariantViolated` selon convention déjà posée plan 02).
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/patrimoine/ tests/integration/repositories/bien-repository-sqlite.test.ts &amp;&amp; pnpm lint:deps &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test -- --run tests/unit/patrimoine/bien.test.ts` exit 0 (≥ 8 tests verts).
    - `pnpm test -- --run tests/unit/patrimoine/lot.test.ts` exit 0 (≥ 5 tests verts).
    - `pnpm test -- --run tests/integration/repositories/bien-repository-sqlite.test.ts` exit 0 (≥ 6 tests verts).
    - `pnpm lint:deps` exit 0.
    - `src/domain/patrimoine/bien.ts` contient `modifier(` et `supprimerLot(` (assertion: `grep -qE "(modifier|supprimerLot)\\(" src/domain/patrimoine/bien.ts` deux occurrences).
    - `src/infrastructure/repositories/bien-repository-sqlite.ts` contient `transaction` ou `ON CONFLICT` (upsert SQLite).
    - Aucun import technique dans `src/domain/patrimoine/lot.ts` ni `bien.ts` (dependency-cruiser vert).
  </acceptance_criteria>
  <done>Le domaine `Bien`+`Lot` est complet (création, mutation immuable, suppression, invariants ≥1 Lot + types conditionnels). Le repo SQLite gère insert/update/soft-delete avec transactions. Les 5 use cases application/patrimoine/ sont posés.</done>
</task>

<task type="auto">
  <name>Task 3: Routes Fastify étendues + Zod schemas + EJS partials réutilisables + pages formulaire/détail</name>
  <files>
    src/web/routes/biens.ts,
    src/web/schemas/bien-schemas.ts,
    src/web/views/pages/biens/liste.ejs,
    src/web/views/pages/biens/formulaire.ejs,
    src/web/views/pages/biens/detail.ejs,
    src/web/views/partials/form-field.ejs,
    src/web/views/partials/data-table.ejs,
    src/web/views/partials/confirm-dialog.ejs
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Screen Inventory", §"Component Patterns", §"Form Validation Flow", §"Error States", §"Destructive Actions"
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Routes Fastify"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-18 (Zod), D-41 (data tables), D-42 (CRUD), D-43 (empty states), D-44 à D-50 (a11y/forms)
    - src/web/routes/biens.ts (existant plan 02 — étendre)
    - src/web/views/pages/biens/liste.ejs (existant plan 02 — remplacer formulaire inline par lien vers /biens/nouveau)
  </read_first>
  <action>
    `src/web/schemas/bien-schemas.ts` — Schémas Zod :
    - `lotCreationSchema = z.object({ designation: z.string().trim().min(1), surface: z.preprocess(v => v === '' ? null : Number(v), z.number().positive().nullable()), type: z.enum(['appartement','parking','cave','local_commercial','terrasse','autre']), etage: z.preprocess(v => v === '' ? null : Number(v), z.number().int().nullable()) })`
    - `bienCreationSchema = z.object({ rue: z.string().trim().min(1), codePostal: z.string().regex(/^\d{5}$/), ville: z.string().trim().min(1), surface: z.coerce.number().positive(), type: z.enum(['appartement','maison','immeuble','local_commercial']), anneeConstruction: z.coerce.number().int().min(1700).max(new Date().getFullYear() + 1), lots: z.array(lotCreationSchema).min(1, "Au moins un lot requis") })`
    - `bienModificationSchema` = identique mais lots optionnel (édition Bien sans toucher aux Lots).
    - Format `formData` → array : Fastify formbody parse les `lots[0].designation` style à plat → utiliser une fonction helper `normaliserLotsFormBody(body)` qui regroupe les `lots[N].XXX` en array d'objets, puis passer au schema.
    - Exporter aussi les types inférés via `z.infer<typeof bienCreationSchema>`.

    `src/web/views/partials/form-field.ejs` (UI-SPEC §"Form Partial") :
    - Reçoit `locals`: `{ id, name, label, type='text', value='', required=true, erreur=null, hint=null }`.
    - Render :
      - `<div class="field">` (Pico classless = utilise les styles natifs sans class — la class "field" est neutre, juste pour ciblage erreur).
      - `<label for="<%= id %>"><%= label %><% if (required) { %> <span aria-hidden="true">*</span><% } %></label>`.
      - `<input id="<%= id %>" name="<%= name %>" type="<%= type %>" value="<%= value %>" <% if (required) { %>required<% } %> aria-describedby="<%= id %>-error<% if (hint) { %> <%= id %>-hint<% } %>" />`.
      - Optionnel `<small id="<%= id %>-hint"><%= hint %></small>` si hint.
      - `<span id="<%= id %>-error" role="alert" class="error-msg" <% if (!erreur) { %>hidden<% } %>><%= erreur ?? '' %></span>`.

    `src/web/views/partials/data-table.ejs` (UI-SPEC §"Data Table Partial") :
    - Reçoit `locals`: `{ ariaLabel, colonnes: [{ titre, numerique?, srOnly? }], lignes: [[cells]], actions: [(ligne) => html] }`.
    - Render `<table aria-label="...">` avec `<thead><tr><th scope="col">...` (class "numeric" si numerique).
    - `<tbody>` zebra (Pico fait via tr:nth-child(even) — pas besoin class).
    - **Sticky header** : ajouter un block `<style>` inline minimaliste OU une class `sticky-thead` réutilisable (s'aligner à UI-SPEC §"Data Table Partial").

    `src/web/views/partials/confirm-dialog.ejs` (UI-SPEC §"Destructive Actions" + §"Confirmation Modal") :
    - Reçoit `locals`: `{ id, formAction, message, confirmLabel, cancelLabel='Annuler' }`.
    - Render `<dialog id="<%= id %>"><form method="dialog">...</form></dialog>` ou pattern `<form method="POST" action="<%= formAction %>">`.
    - Bouton "Annuler" reçoit `autofocus` (UI-SPEC §"Destructive Actions" — focus Cancel par défaut).
    - Confirm button avec style destructive (couleur `#dc2626` via inline `style="background:#dc2626; color:white"` ou class — minimal Pico custom).
    - JS minimal `<script>` : binding sur `<button data-open-dialog="<%= id %>">` qui appelle `.showModal()`.

    `src/web/views/pages/biens/liste.ejs` (refactorer plan 02) :
    - Empty state inchangé (UI-SPEC §"Empty States").
    - Si biens.length > 0 : utiliser `<%- include('../../partials/data-table', { ariaLabel: 'Liste des biens', colonnes: [...], lignes: biens.map(...), actions: ... }) %>`.
    - Colonnes : Adresse, Type, Surface (numeric), Année (numeric), Nombre de lots (numeric), Actions (sr-only label).
    - Actions par ligne : `<a href="/biens/:id">Voir</a>` + `<a href="/biens/:id/modifier">Modifier</a>` + bouton `Supprimer` ouvrant `confirm-dialog`.
    - Au-dessus de la table : `<a href="/biens/nouveau" role="button">Créer un bien</a>`.
    - Retirer le formulaire inline du plan 02 (remplacé par /biens/nouveau).

    `src/web/views/pages/biens/formulaire.ejs` :
    - Layout : utilise `partials/layout.ejs`. Titre `<h1>Créer un bien</h1>` ou `<h1>Modifier le bien</h1>` selon `locals.mode`.
    - Section "Bien" : `<fieldset><legend>Informations générales</legend>` avec form-field partials pour rue, codePostal, ville, surface, type (select), anneeConstruction.
    - Section "Lots" : `<fieldset><legend>Lots</legend>` avec :
      - Pour chaque lot dans `locals.lots`, render form-field pour designation, surface, type, etage avec name `lots[N].XXX` (N = index).
      - Lien `<a href="#" class="ajouter-lot">+ Ajouter un lot</a>` qui clone la dernière section lot via JS minimal inline (progressive enhancement — sans JS, l'utilisateur peut soumettre 1 lot suffisant).
      - Si édition et lots existants, chaque section lot a un bouton "Supprimer ce lot" → POST `/biens/:id/lots/:lotId/supprimer` (séparé du form principal).
    - Bouton submit : `<button type="submit">Enregistrer le bien</button>` (CTA UI-SPEC §"Primary CTAs" — exact).
    - Si `locals.erreurs`, afficher les messages inline via form-field's `erreur` prop.

    `src/web/views/pages/biens/detail.ejs` :
    - Header section : `<h1><%= bien.adresse.enLigne() %></h1>` + métadonnées (type, surface, année).
    - Section Lots : `<h2>Lots</h2>` + data-table partial (colonnes : Désignation, Type, Surface, Étage, Actions).
    - Bouton "Modifier le bien" → `/biens/:id/modifier`.
    - Bouton "Supprimer le bien" → ouvre confirm-dialog → POST `/biens/:id/supprimer`.
    - Bouton "Ajouter un lot" inline ou modal → POST `/biens/:id/lots`.

    `src/web/routes/biens.ts` — étendre plan 02 :
    - GET `/biens` (existant — utilise listerBiens).
    - GET `/biens/nouveau` → render formulaire.ejs en mode 'creation', lots: [{ designation: '', type: 'appartement' }].
    - POST `/biens` → parse via `bienCreationSchema.safeParse` → si KO, re-render formulaire avec erreurs inline ; si OK, `creerBien(commande, repo)` → 302 `/biens/:id` (ou `/biens`).
    - GET `/biens/:id` → repo.trouverParId, si null 404 page "Bien introuvable" (UI-SPEC §"Error States"). Sinon render detail.ejs.
    - GET `/biens/:id/modifier` → trouverParId → render formulaire.ejs en mode 'edition' avec valeurs pré-remplies.
    - POST `/biens/:id/modifier` → parse bienModificationSchema → modifierBien(commande, repo) → 302 `/biens/:id`.
    - POST `/biens/:id/supprimer` → supprimerBien(id, repo) → 302 `/biens` + flash success.
    - POST `/biens/:id/lots` → parse lotCreationSchema → ajouterLot(commande, repo) → 302 `/biens/:id`.
    - POST `/biens/:id/lots/:lotId/supprimer` → supprimerLot(bienId, lotId, repo) → 302 `/biens/:id` (ou 400 + flash erreur si dernier lot).
    - Toutes les erreurs domaine (`InvariantViolated`, `BienIntrouvable`) capturées → message UI-SPEC §"Error States" exact ("Le loyer hors charges doit être supérieur à 0 €", etc. ; pour Phase 1 utiliser le message tel quel de `err.message` si pas dans le mapping UI-SPEC).
    - Toutes les vues reçoivent `locals.formatDate` (helper Temporal.PlainDate → DD/MM/YYYY, RESEARCH §8 pitfall 4) injecté via `app.addHook('preHandler', (req, reply, done) => { reply.locals = { ...reply.locals, formatDate }; done(); })` ou pattern équivalent EJS.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; pnpm test -- --run &amp;&amp; pnpm test:bdd</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exit 0.
    - `pnpm lint` exit 0 (0 warning).
    - `pnpm test -- --run` exit 0 (tous tests unit + integration verts).
    - `pnpm test:bdd` exit 0 (scenario plan 02 toujours green).
    - `src/web/schemas/bien-schemas.ts` exporte `bienCreationSchema`, `bienModificationSchema`, `lotCreationSchema` (assertion: tous les 3 grep -qE "export.*Schema").
    - `src/web/views/partials/form-field.ejs` contient `aria-describedby` (assertion: `grep -q "aria-describedby" src/web/views/partials/form-field.ejs`).
    - `src/web/views/partials/data-table.ejs` contient `<th scope="col"` (assertion: `grep -q 'scope="col"' src/web/views/partials/data-table.ejs`).
    - `src/web/views/partials/confirm-dialog.ejs` contient `<dialog` et `autofocus` (assertion: 2 greps).
    - `src/web/views/pages/biens/formulaire.ejs` contient "Enregistrer le bien" (CTA exact UI-SPEC).
    - `src/web/views/pages/biens/liste.ejs` ne contient PLUS le formulaire inline (assertion: `grep -c 'name="rue"' src/web/views/pages/biens/liste.ejs` == 0).
    - Test manuel `curl -X POST http://127.0.0.1:7878/biens -d "rue=12 rue test&codePostal=75001&ville=Paris&surface=50&type=appartement&anneeConstruction=2000&lots[0].designation=Appt&lots[0].type=appartement&lots[0].surface=50&lots[0].etage="` retourne 302 (vérifié via BDD ou checkpoint manuel SUMMARY).
  </acceptance_criteria>
  <done>CRUD Bien complet (create+read+update+delete) avec N Lots. UI conforme UI-SPEC (sticky table, empty state, formulaire one-column, confirm dialog destructive, partial form-field a11y). Tous tests verts. Plan 04 (Locataire) et 05 (Bail) hériteront des partials EJS.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → POST/PUT /biens routes | Input non-validé (FormData, query). Risque tampering. |
| Use case → Repository | Contrat domaine établi ; throw remonte au handler. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-01 | Tampering | POST /biens body (code postal, surface, types) | mitigate | Zod schemas `bienCreationSchema` rejettent valeurs hors enum/format. Invariants domaine catch les bypasses. |
| T-03-02 | Tampering | POST /biens/:id (URL param id) | mitigate | `repo.trouverParId(id)` retourne null si invalide → handler 404. Aucun side-effect. |
| T-03-03 | Information Disclosure | Détail Bien `/biens/:id` | accept | Mono-user local — pas d'auth requise (DV-02). |
| T-03-04 | Repudiation | Soft-delete sans audit trail | accept | DP-01 soft-delete suffisant Phase 1. Audit log différé. |
| T-03-05 | DoS | Form lots[] illimité | mitigate | Limite `z.array(lotCreationSchema).min(1).max(50)` — un Bien réel n'a pas 50+ lots. |
| T-03-06 | Tampering | `lots[N].XXX` form-encoded reconstruction | mitigate | `normaliserLotsFormBody` valide la structure attendue avant Zod ; entrées malformées → 400. |
</threat_model>

<verification>
- `pnpm typecheck` exit 0
- `pnpm lint` exit 0, 0 warning
- `pnpm test -- --run` exit 0 (au moins 8 unit Bien + 5 unit Lot + 6 integration repo = 19 tests verts)
- `pnpm test:bdd` exit 0 (scenario plan 02 toujours green — non-régression)
- `pnpm lint:deps` exit 0 (barrière hexagonale intacte)
- Test manuel : créer un Bien avec 3 Lots distincts via formulaire UI → tous persistés et affichés en détail
- Test manuel : éditer le Bien (changer surface) → modification persistée
- Test manuel : supprimer un Lot (≠ dernier) → réussi ; supprimer le dernier → refus avec message d'erreur
- Test manuel : supprimer le Bien → 302 vers /biens + Bien disparu de la liste (soft-deleted en DB, vérifier `SELECT * FROM bien WHERE supprime_le IS NOT NULL` → 1 row)
- Toutes les vues affichent le CTA exact "Enregistrer le bien" / "Créer un bien" / "Modifier le bien" / "Supprimer définitivement" (audit UI-SPEC §"Copywriting Contract")
</verification>

<success_criteria>
PAT-01 (CRUD complet Bien) et PAT-02 (multi-Lots gestion) sont **entièrement couverts**. L'utilisateur peut administrer son patrimoine seul via interface tabulaire admin. Les partials EJS (form-field, data-table, confirm-dialog) sont prêts à être réutilisés par Plans 04-05 pour Locataire et Bail.

Les invariants Phase 1 du domaine Patrimoine (≥1 Lot, surface > 0, types enum, immutabilité par mutation copy-on-write) sont **encodés et testés** à 100 % (gate domain coverage).
</success_criteria>

<output>
Créer `.planning/phases/01-activation-bien-locataire-bail/01-03-patrimoine-crud-SUMMARY.md`. Lister :
- Nombre de tests verts : unit Bien (≥8), unit Lot (≥5), integration repo (≥6), BDD (1 carryover plan 02)
- Confirmation que les 3 partials EJS (form-field, data-table, confirm-dialog) sont en place et réutilisables
- Snippet de la structure d'un formulaire form-encoded `lots[N].XXX` pour Plans 04-05 qui héritent du pattern
- Toute amélioration du pidfile / detection "déjà lancé" éventuellement faite
</output>

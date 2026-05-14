---
phase: 01-activation-bien-locataire-bail
plan: 04
type: execute
wave: 3
depends_on: [01-02, 01-03]
files_modified:
  - src/domain/_shared/adresse.ts
  - src/domain/locatif/locataire.ts
  - src/domain/locatif/locataire-repository.ts
  - src/infrastructure/repositories/locataire-repository-sqlite.ts
  - src/application/locatif/creer-locataire.ts
  - src/application/locatif/modifier-locataire.ts
  - src/application/locatif/supprimer-locataire.ts
  - src/application/locatif/lister-locataires.ts
  - src/web/routes/locataires.ts
  - src/web/schemas/locataire-schemas.ts
  - src/web/views/pages/locataires/liste.ejs
  - src/web/views/pages/locataires/formulaire.ejs
  - src/web/views/pages/locataires/detail.ejs
  - tests/_builders/locatif.ts
  - tests/unit/locatif/locataire.test.ts
  - tests/integration/repositories/locataire-repository-sqlite.test.ts
  - src/main.ts
autonomous: true
requirements: [LOC-01]
tags: [locatif, locataire, crud, ddd, zod, hexagonal]

must_haves:
  truths:
    - "L'utilisateur peut créer une fiche Locataire avec identité (nom, prénom, date+lieu naissance, nationalité) + contact (email, téléphone, adresse actuelle)."
    - "L'utilisateur peut consulter, éditer, supprimer un Locataire."
    - "Les invariants `nom` et `prenom` non vides, `email` format RFC, `date_naissance` < today sont encodés au domaine."
    - "Aucune pièce/document locataire n'est gérée (D-32 strict YAGNI — Phase 4)."
    - "Pas de garant/cautionnement sur la fiche Locataire — le cautionnement est sur le Bail (D-33)."
    - "UI conforme UI-SPEC (sidebar nav, table sticky, empty state, confirm dialog)."
    - "Validation Zod côté HTTP + invariants domaine séparés."
  artifacts:
    - path: "src/domain/locatif/locataire.ts"
      provides: "Entité racine Locataire + invariants identité/contact"
      exports: ["Locataire"]
    - path: "src/domain/locatif/locataire-repository.ts"
      provides: "Port LocataireRepository"
      exports: ["LocataireRepository"]
    - path: "src/infrastructure/repositories/locataire-repository-sqlite.ts"
      provides: "Adapter SQLite Kysely"
      exports: ["LocataireRepositorySqlite"]
    - path: "src/web/schemas/locataire-schemas.ts"
      provides: "Schemas Zod pour create/edit"
      exports: ["locataireCreationSchema", "locataireModificationSchema"]
  key_links:
    - from: "src/web/routes/locataires.ts"
      to: "src/application/locatif/creer-locataire.ts"
      via: "POST handler invoque use case"
      pattern: "creerLocataire\\("
    - from: "src/application/locatif/creer-locataire.ts"
      to: "src/domain/locatif/locataire.ts"
      via: "Construit Locataire via factory"
      pattern: "Locataire\\.creer"
    - from: "src/infrastructure/repositories/locataire-repository-sqlite.ts"
      to: "src/domain/locatif/locataire-repository.ts"
      via: "implements"
      pattern: "implements LocataireRepository"
---

<objective>
Livrer la fiche `Locataire` (LOC-01) avec CRUD complet. Parallèle structurel du Plan 03 sur l'agrégat Patrimoine — réutilise les partials EJS établis (form-field, data-table, confirm-dialog).

**Slice MVP utilisateur :** En tant que bailleur, je clique "Locataires" dans la sidebar, je vois soit l'empty state "Aucun locataire pour l'instant", soit la liste tabulée. Je crée Marie Dupont avec son identité complète et son email — donnée persistée. Je peux la rééditer, la supprimer (soft-delete).

Purpose: Couvrir LOC-01 intégralement. Préparer le terrain pour le Plan 05 (Bail) qui nécessite ≥1 Locataire pour exister.
Output: 4 routes Fastify (`/locataires`, `/locataires/nouveau`, `/locataires/:id`, `/locataires/:id/modifier`, `/locataires/:id/supprimer`), domaine `Locataire` + VO `Adresse` (étendu plan 02 si non complet), 4 use cases, schemas Zod, 3 vues EJS, tests unit + intégration verts. Sidebar nav active "Locataires".
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
@LOCATION_MEUBLEE_REGLES.md

<interfaces>
<!-- Réutilisé/étendu depuis plans 02-03 -->

Existant après plans 02-03 :
- VO `Adresse` (src/domain/_shared/adresse.ts) — créé plan 02. À vérifier qu'il a déjà : rue, codePostal, ville, factory `Adresse.creer`, méthode `enLigne()`.
- Partials EJS : `form-field.ejs`, `data-table.ejs`, `confirm-dialog.ejs`, `layout.ejs` — créés plan 03.
- Helper `formatDate(plainDate)` — créé plan 03 (RESEARCH §8).
- Identifiants `LocataireId` nominal — créé plan 02 (`src/domain/_shared/identifiants.ts`).

Nouveau (ce plan) :
- VO `LieuNaissance { commune: string; pays: string }` (peut être inline class Locataire ou fichier dédié — préférer inline pour V1 simplicité).
- Entité `Locataire` racine.
- Port `LocataireRepository`.
- Adapter SQLite.
- Use cases CRUD.
- Schemas Zod.
- 3 pages EJS.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests unit Locataire + tests intégration LocataireRepository (rouges)</name>
  <files>
    tests/_builders/locatif.ts,
    tests/unit/locatif/locataire.test.ts,
    tests/integration/repositories/locataire-repository-sqlite.test.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-31, D-32 (Locataire V1 — strict YAGNI, pas de pièces, pas de garant)
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §2 (Agrégat Locataire — invariants)
    - LOCATION_MEUBLEE_REGLES.md §9.1 (mentions obligatoires bail — identité locataire)
    - BDD_PRACTICES.md §9 (Builders)
    - tests/_builders/patrimoine.ts (modèle de builder à imiter, créé plan 03)
  </read_first>
  <behavior>
    Builder `tests/_builders/locatif.ts` (extension future Plan 05 ajoutera `unBailValide`) :
    - `unLocataireValide(overrides?): Locataire` — defaults : nom="Dupont", prenom="Marie", date_naissance=PlainDate("1985-06-15"), lieu={commune:"Paris", pays:"France"}, nationalité="française", email="marie@example.fr", telephone="0123456789", adresseActuelle=Adresse("1 rue Test", "75001", "Paris").

    `tests/unit/locatif/locataire.test.ts` :
    - "Locataire.creer rejette nom vide" → throw InvariantViolated
    - "Locataire.creer rejette prenom vide" → throw
    - "Locataire.creer rejette email malformé ('toto')" → throw (validation regex simple — pas RFC complet)
    - "Locataire.creer rejette date_naissance dans le futur" → throw (`> Temporal.Now.plainDateISO()`)
    - "Locataire.creer rejette commune_naissance vide" → throw
    - "Locataire.creer rejette pays_naissance vide" → throw
    - "Locataire.creer accepte un Locataire valide complet" → ne throw pas, retourne instance avec getters readonly
    - "Locataire.modifier({ email: 'new@example.fr' }) retourne nouvelle instance immutable" + ancien email préservé sur l'ancienne instance

    `tests/integration/repositories/locataire-repository-sqlite.test.ts` :
    - "enregistrer + trouverParId roundtrip" : crée un Locataire valide via builder, enregistre, trouve par id → assertion sur tous les champs (nom, prenom, date_naissance, email, etc.)
    - "enregistrer met à jour un Locataire existant" : enregistre, modifie via Locataire.modifier, ré-enregistre → trouverParId retourne nouvelle version
    - "listerTous exclut un Locataire soft-deleted" : enregistre 2 Locataires, supprime 1, listerTous → 1 résultat
    - "supprimer (soft-delete) → trouverParId retourne null"
    - Setup identique à BienRepositorySqlite (Kysely + better-sqlite3 :memory: + migrations).
  </behavior>
  <action>
    Créer `tests/_builders/locatif.ts` avec `unLocataireValide(overrides?)`.

    Créer `tests/unit/locatif/locataire.test.ts` avec les 8 tests décrits en behavior.

    Créer `tests/integration/repositories/locataire-repository-sqlite.test.ts` avec les 4 tests décrits.

    À ce stade `pnpm test -- locataire` est **rouge** (Locataire pas créé, repo pas créé). Attendu.
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/locatif/locataire.test.ts tests/integration/repositories/locataire-repository-sqlite.test.ts 2&gt;&amp;1 | grep -E "FAIL|Error" || true</automated>
  </verify>
  <acceptance_criteria>
    - `tests/_builders/locatif.ts` exporte `unLocataireValide` (assertion: `grep -qE "export.*unLocataireValide" tests/_builders/locatif.ts`).
    - `tests/unit/locatif/locataire.test.ts` contient ≥ 8 occurrences `it(` ou `test(` (assertion: `grep -cE "^[[:space:]]*(it|test)\(" tests/unit/locatif/locataire.test.ts` ≥ 8).
    - `tests/integration/repositories/locataire-repository-sqlite.test.ts` contient ≥ 4 tests.
    - `pnpm test -- --run tests/unit/locatif/` exit code ≠ 0 (rouge attendu).
  </acceptance_criteria>
  <done>Le contrat exact de l'agrégat `Locataire` est en tests (outside-in). Les invariants d'identité/contact (LOCATION_MEUBLEE_REGLES.md §9.1) sont figés.</done>
</task>

<task type="auto">
  <name>Task 2: Domaine `Locataire` + port + adapter SQLite + use cases CRUD</name>
  <files>
    src/domain/locatif/locataire.ts,
    src/domain/locatif/locataire-repository.ts,
    src/infrastructure/repositories/locataire-repository-sqlite.ts,
    src/application/locatif/creer-locataire.ts,
    src/application/locatif/modifier-locataire.ts,
    src/application/locatif/supprimer-locataire.ts,
    src/application/locatif/lister-locataires.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-31, D-32, DV-04 (français)
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §2 + §4 (schéma SQL `locataire`)
    - DDD.md §4.1 (Entité), §4.2 (VO), §4.4 (Repository)
    - tests/unit/locatif/locataire.test.ts (le contrat à satisfaire — Task 1)
    - tests/integration/repositories/locataire-repository-sqlite.test.ts
    - src/infrastructure/repositories/bien-repository-sqlite.ts (modèle d'adapter à imiter — créé plan 02/03)
  </read_first>
  <action>
    `src/domain/locatif/locataire.ts` — Entité racine :
    - Type interne ou class `LieuNaissance` : readonly `commune: string`, `pays: string`. Factory `LieuNaissance.creer({ commune, pays })` throw si vide.
    - Class `Locataire` immutable :
      - Readonly champs : `id: LocataireId`, `nom: string`, `prenom: string`, `dateNaissance: Temporal.PlainDate`, `lieuNaissance: LieuNaissance`, `nationalite: string`, `email: string`, `telephone: string | null`, `adresseActuelle: Adresse`.
      - Factory `Locataire.creer({...}): Locataire` :
        - `nom.trim() !== ''` else throw `InvariantViolated("Le nom du locataire est obligatoire")`.
        - `prenom.trim() !== ''` else throw.
        - `email` matche regex simple `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` else throw (validation RFC complète différée à Zod côté HTTP — domaine valide forme minimale).
        - `nationalite.trim() !== ''` else throw.
        - `dateNaissance < Temporal.Now.plainDateISO()` else throw `InvariantViolated("La date de naissance doit être dans le passé")`.
        - `LieuNaissance.creer(lieuNaissance)` valide commune/pays.
        - `Adresse.creer(adresseActuelle)` valide.
      - Méthode `modifier(patch): Locataire` — équivalent au pattern `Bien.modifier` plan 03 (immutable).

    `src/domain/locatif/locataire-repository.ts` — Port :
    - `export interface LocataireRepository { enregistrer(loc: Locataire): Promise<void>; trouverParId(id: LocataireId): Promise<Locataire | null>; listerTous(): Promise<Locataire[]>; supprimer(id: LocataireId): Promise<void>; }`.
    - Aucun import autre que types domaine.

    `src/infrastructure/repositories/locataire-repository-sqlite.ts` :
    - `class LocataireRepositorySqlite implements LocataireRepository` (constructeur prend `Kysely<DB>`).
    - `enregistrer` : upsert via `INSERT ... ON CONFLICT(id) DO UPDATE` sur `locataire` table.
    - `trouverParId` : `SELECT WHERE id = ? AND supprime_le IS NULL`. Mapper row → entité via `Locataire.creer` (factory re-valide — défense en profondeur).
    - `listerTous` : `SELECT WHERE supprime_le IS NULL ORDER BY nom, prenom`.
    - `supprimer` : `UPDATE locataire SET supprime_le = CURRENT_TIMESTAMP WHERE id = ?`.
    - Helpers privés `vers_domaine(row)` et `vers_row(loc)`.
    - **Conversion `Temporal.PlainDate`** : row stocke string ISO (`YYYY-MM-DD`) → `Temporal.PlainDate.from(row.date_naissance)`. Entity → row : `loc.dateNaissance.toString()` (renvoie ISO string).

    Use cases (4 fichiers `src/application/locatif/`) :
    - `creerLocataire(commande: CreerLocataireCommand, repo): Promise<LocataireId>` — construit `Locataire.creer(...)` (mapper adresse + lieuNaissance), `repo.enregistrer`, retourne id.
    - `modifierLocataire(commande: ModifierLocataireCommand, repo): Promise<void>` — `repo.trouverParId` → si null throw `LocataireIntrouvable` → `loc.modifier(patch)` → `repo.enregistrer`.
    - `supprimerLocataire(id, repo): Promise<void>` — `trouverParId` → null=throw → `repo.supprimer(id)`.
    - `listerLocataires(repo): Promise<Locataire[]>` — mince, délégué.

    Définir `class LocataireIntrouvable extends Error` dans `src/domain/locatif/erreurs.ts` (ou réutiliser pattern erreurs plan 03).
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/locatif/ tests/integration/repositories/locataire-repository-sqlite.test.ts &amp;&amp; pnpm lint:deps &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test -- --run tests/unit/locatif/locataire.test.ts` exit 0 (≥ 8 tests verts).
    - `pnpm test -- --run tests/integration/repositories/locataire-repository-sqlite.test.ts` exit 0 (≥ 4 tests verts).
    - `pnpm lint:deps` exit 0.
    - `src/domain/locatif/locataire.ts` n'importe ni `kysely`, ni `fastify`, ni `better-sqlite3` (assertion: `grep -cE "from.*['\"](kysely|fastify|better-sqlite3|pino|@fastify)" src/domain/locatif/locataire.ts` == 0).
    - `src/domain/locatif/locataire.ts` contient `export class Locataire` et `Locataire.creer`.
    - `src/domain/locatif/locataire-repository.ts` contient `export interface LocataireRepository`.
    - `src/infrastructure/repositories/locataire-repository-sqlite.ts` contient `implements LocataireRepository` et `Temporal.PlainDate.from`.
  </acceptance_criteria>
  <done>L'agrégat `Locataire` est testé en isolation, le repo SQLite roundtrip toutes les colonnes (y compris `Temporal.PlainDate` ↔ string ISO), use cases CRUD posés. Barrière hexagonale tient.</done>
</task>

<task type="auto">
  <name>Task 3: Routes Fastify + Zod schemas + EJS pages locataires + intégration sidebar nav</name>
  <files>
    src/web/routes/locataires.ts,
    src/web/schemas/locataire-schemas.ts,
    src/web/views/pages/locataires/liste.ejs,
    src/web/views/pages/locataires/formulaire.ejs,
    src/web/views/pages/locataires/detail.ejs,
    src/web/views/partials/layout.ejs,
    src/main.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Screen Inventory" (Liste/Formulaire Locataire), §"Copywriting Contract", §"Empty States", §"Error States"
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Routes Fastify"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-18, D-40, D-41, D-42, D-43
    - src/web/routes/biens.ts (modèle de route plan 03)
    - src/web/views/pages/biens/{liste,formulaire,detail}.ejs (modèle)
    - src/web/views/partials/form-field.ejs (réutiliser)
    - src/web/views/partials/data-table.ejs (réutiliser)
    - src/web/views/partials/confirm-dialog.ejs (réutiliser)
  </read_first>
  <action>
    `src/web/schemas/locataire-schemas.ts` :
    - `locataireCreationSchema = z.object({ nom: z.string().trim().min(1), prenom: z.string().trim().min(1), dateNaissance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), communeNaissance: z.string().trim().min(1), paysNaissance: z.string().trim().min(1), nationalite: z.string().trim().min(1), email: z.string().email(), telephone: z.string().trim().min(1).optional().or(z.literal('').transform(() => undefined)), rue: z.string().trim().min(1), codePostal: z.string().regex(/^\d{5}$/), ville: z.string().trim().min(1) })`.
    - `locataireModificationSchema` — identique mais tous champs optionnels (PATCH style).
    - Exporter types inférés.

    `src/web/views/pages/locataires/liste.ejs` :
    - Layout shell sidebar (nav "Locataires" active — UI-SPEC).
    - Empty state UI-SPEC §"Empty States" EXACT : `<h1>Aucun locataire pour l'instant</h1>` + `<p>Créez votre premier locataire pour pouvoir établir un bail.</p>` + `<a href="/locataires/nouveau" role="button">Créer un locataire</a>`.
    - Sinon : data-table partial avec colonnes Nom Prénom, Email, Téléphone, Ville, Actions.
    - Header avec `<a href="/locataires/nouveau" role="button">Créer un locataire</a>`.

    `src/web/views/pages/locataires/formulaire.ejs` :
    - `<h1>` selon mode : "Créer un locataire" / "Modifier le locataire".
    - 2 fieldsets :
      - `<fieldset><legend>Identité</legend>` : nom, prénom, date naissance (input type=date), commune naissance, pays naissance, nationalité.
      - `<fieldset><legend>Contact</legend>` : email (type=email), téléphone (type=tel, optionnel), adresse actuelle (rue / code postal / ville).
    - Bouton submit CTA EXACT : "Enregistrer le locataire".
    - Erreurs inline via form-field `erreur` prop.

    `src/web/views/pages/locataires/detail.ejs` :
    - `<h1><%= locataire.prenom %> <%= locataire.nom %></h1>`
    - Sections Identité et Contact (read-only).
    - Boutons "Modifier le locataire" → `/locataires/:id/modifier`, "Supprimer" → confirm-dialog → POST `/locataires/:id/supprimer`.
    - Section "Baux associés" stub vide (Plan 05 la peuplera — pour Plan 04 affiche "Aucun bail" placeholder ou cache la section).

    `src/web/routes/locataires.ts` :
    - GET `/locataires` → listerLocataires → render liste.ejs.
    - GET `/locataires/nouveau` → render formulaire.ejs mode 'creation'.
    - POST `/locataires` → Zod safeParse → erreurs OU `creerLocataire` → 302 `/locataires/:id` (ou `/locataires`).
    - GET `/locataires/:id` → repo.trouverParId → 404 si null → render detail.ejs.
    - GET `/locataires/:id/modifier` → render formulaire.ejs mode 'edition'.
    - POST `/locataires/:id/modifier` → Zod → `modifierLocataire` → 302 `/locataires/:id`.
    - POST `/locataires/:id/supprimer` → `supprimerLocataire` → 302 `/locataires` + flash success.
    - Format `dateNaissance` : helper `formatDate(plainDate)` pour affichage DD/MM/YYYY ; input HTML type="date" renvoie `YYYY-MM-DD` côté form.

    `src/main.ts` (étendre plan 02) :
    - Instancier `locataireRepo = new LocataireRepositorySqlite(db)`.
    - Register `src/web/routes/locataires.ts` plugin avec `opts: { repo: locataireRepo }`.

    `src/web/views/partials/layout.ejs` (étendre plan 02) :
    - Activer le lien sidebar "Locataires" comme cliquable (`<a href="/locataires">`).
    - Marquer l'item actif via détection URL côté handler (passer `locals.navActive = 'locataires'` depuis chaque route locataires, etc.) ou via parsing simple `req.url.startsWith('/locataires')` dans un hook `preHandler`.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; pnpm test -- --run &amp;&amp; pnpm test:bdd</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exit 0.
    - `pnpm lint` exit 0 (0 warning).
    - `pnpm test -- --run` exit 0 (tests plan 02-04 tous verts).
    - `pnpm test:bdd` exit 0 (scenario plan 02 non-régression).
    - `pnpm lint:deps` exit 0.
    - `src/web/schemas/locataire-schemas.ts` exporte `locataireCreationSchema` (assertion: `grep -q "export.*locataireCreationSchema" src/web/schemas/locataire-schemas.ts`).
    - `src/web/views/pages/locataires/liste.ejs` contient "Aucun locataire pour l'instant" (CTA empty state EXACT UI-SPEC).
    - `src/web/views/pages/locataires/formulaire.ejs` contient "Enregistrer le locataire" (CTA EXACT).
    - `src/web/views/pages/locataires/formulaire.ejs` contient `<fieldset>` au moins 2 fois (Identité + Contact).
    - `src/main.ts` contient `LocataireRepositorySqlite`.
    - Test manuel : `curl http://127.0.0.1:7878/locataires` retourne empty state HTML 200. POST puis GET affiche la ligne créée.
  </acceptance_criteria>
  <done>LOC-01 entièrement couvert. CRUD Locataire fonctionnel via UI, validation Zod, conformité UI-SPEC (sidebar nav active, empty state, formulaire 2-fieldsets, confirm dialog destructive). Plan 05 peut maintenant créer un Bail liant Bien + Locataire.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → POST/PUT /locataires | Input identité personnelle (PII) — RGPD-relevant. Local-first → pas de transit réseau, mais stockage local du PII. |
| Use case → Repository | Contrat domaine. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-01 | Tampering | Form-data POST | mitigate | Zod `locataireCreationSchema` validates types/formats. Invariants domaine catch absurde. |
| T-04-02 | Information Disclosure | PII en SQLite non chiffré | accept | DV-02 mono-user, machine perso. Chiffrement DB différé V1.1+ (BAK-02, RISKS.md R3.3 RGPD). |
| T-04-03 | Repudiation | Modification fiche sans audit | accept | Soft-delete OK Phase 1 ; audit complet en Phase 5/Phase 7 (ledger). |
| T-04-04 | Tampering | URL `/locataires/:id` (id forgery) | mitigate | UUID v4 (impossible à deviner) + `trouverParId` retourne null sur invalide → 404. |
| T-04-05 | Spoofing | Email validation | mitigate | Regex simple côté domaine + Zod `.email()` côté HTTP. PII reste local. |
</threat_model>

<verification>
- `pnpm typecheck` exit 0
- `pnpm lint` exit 0
- `pnpm test -- --run` exit 0 (au moins 8 unit Locataire + 4 integration repo + 8+5 plan 03 carryover = ≥ 25 tests verts)
- `pnpm test:bdd` exit 0
- `pnpm lint:deps` exit 0
- Test manuel : créer Marie Dupont avec identité complète → GET /locataires affiche 1 ligne → GET /locataires/:id affiche détail complet
- Éditer email de Marie → modification persistée
- Supprimer Marie → 302 /locataires → liste vide (soft-delete vérifié SQL)
- Sidebar nav : item "Locataires" actif (border accent) lorsqu'on est sur /locataires/*
</verification>

<success_criteria>
LOC-01 entièrement couvert. La fiche Locataire est gérable seule (sans dépendance Bail). Plan 05 peut consommer `LocataireRepository.trouverParId(id)` pour relier un Bail à un Locataire. Sidebar nav "Biens / Locataires / Baux" devient fonctionnelle (2/3 sections cliquables — "Baux" arrive Plan 05).
</success_criteria>

<output>
Créer `.planning/phases/01-activation-bien-locataire-bail/01-04-locataire-crud-SUMMARY.md`. Lister :
- Tests verts : unit Locataire (≥8), integration LocataireRepository (≥4)
- Confirmation que les partials EJS du plan 03 sont réutilisés (pas de duplication code)
- Snippet `Temporal.PlainDate` ↔ string ISO usage (pattern pour Plan 05 Bail.date_debut)
- Note sur le helper `formatDate` injecté en EJS locals
</output>

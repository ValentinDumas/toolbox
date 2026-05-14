---
phase: 01-activation-bien-locataire-bail
plan: 02
type: execute
wave: 1
depends_on: [01-01]
files_modified:
  - src/main.ts
  - src/infrastructure/db/database.ts
  - src/infrastructure/db/kysely-types.ts
  - src/infrastructure/db/migrations/0001_init.sql
  - migrations/0001_init.sql
  - src/infrastructure/lifecycle/premier-lancement.ts
  - src/domain/_shared/identifiants.ts
  - src/domain/patrimoine/bien.ts
  - src/domain/patrimoine/bien-repository.ts
  - src/infrastructure/repositories/bien-repository-sqlite.ts
  - src/application/patrimoine/creer-bien.ts
  - src/web/routes/racine.ts
  - src/web/routes/biens.ts
  - src/web/views/pages/biens/liste.ejs
  - src/web/views/partials/layout.ejs
  - public/styles/pico.min.css
  - tests/unit/patrimoine/bien.test.ts
  - tests/integration/repositories/bien-repository-sqlite.test.ts
  - tests/bdd/features/activation.feature
  - tests/bdd/step_definitions/activation.steps.ts
autonomous: true
requirements: [PAT-01]
tags: [walking-skeleton, bootstrap, fastify, sqlite, kysely, ddd, mvp]

must_haves:
  truths:
    - "`pnpm dev` boote Fastify sur http://127.0.0.1:7878."
    - "Au premier lancement, GET / redirige vers `/biens` (le wizard est différé Plan 06 ; pour le skeleton, racine → liste avec empty state)."
    - "POST /biens (formulaire minimal Bien + 1 Lot) persiste en SQLite et redirige vers GET /biens."
    - "GET /biens affiche soit l'empty state UI-SPEC §Empty States, soit la liste des Biens persistés."
    - "Migration 0001_init.sql crée les tables `bien`, `lot`, `locataire`, `bail`, `bail_lots`, `meta`."
    - "Le test BDD `activation.feature` scenario 'Création Bien+Lot minimal' passe (`pnpm test:bdd` exit 0)."
    - "L'entité `Bien` refuse 0 Lot et `surface ≤ 0` (invariants testés en unit)."
    - "Le repository SQLite roundtrip (create + retrieve) fonctionne (test intégration vert)."
    - "`src/domain/patrimoine/bien.ts` n'importe aucun module technique (vérifié par dependency-cruiser)."
  artifacts:
    - path: "src/main.ts"
      provides: "Bootstrap Fastify + DB + migrations + lifecycle"
      exports: ["main"]
    - path: "src/infrastructure/db/migrations/0001_init.sql"
      provides: "Schéma initial Phase 1 (bien, lot, locataire, bail, bail_lots, meta)"
      contains: "CREATE TABLE bien"
    - path: "src/domain/patrimoine/bien.ts"
      provides: "Entité racine Bien avec invariants (≥1 Lot, surface > 0)"
      exports: ["Bien", "TypeBien"]
    - path: "src/infrastructure/repositories/bien-repository-sqlite.ts"
      provides: "Adapter SQLite implémentant le port BienRepository"
      exports: ["BienRepositorySqlite"]
    - path: "tests/bdd/features/activation.feature"
      provides: "Scenario Walking Skeleton — création Bien+Lot via POST /biens"
      contains: "Feature: Activation"
  key_links:
    - from: "src/web/routes/biens.ts"
      to: "src/application/patrimoine/creer-bien.ts"
      via: "POST handler invoke use case CreerBien"
      pattern: "creerBien\\("
    - from: "src/application/patrimoine/creer-bien.ts"
      to: "src/domain/patrimoine/bien-repository.ts"
      via: "Use case dépend du port (DI via main.ts)"
      pattern: "BienRepository"
    - from: "src/infrastructure/repositories/bien-repository-sqlite.ts"
      to: "src/domain/patrimoine/bien-repository.ts"
      via: "implements"
      pattern: "implements BienRepository"
    - from: "src/main.ts"
      to: "src/infrastructure/db/database.ts"
      via: "boot exécute migrations puis instancie Kysely"
      pattern: "migrate"
---

<objective>
Livrer le **Walking Skeleton end-to-end** : depuis `pnpm dev` jusqu'à un Bien persisté visible dans une liste — la tranche la plus mince possible qui valide que la stack et l'architecture hexagonale fonctionnent ensemble.

**Story utilisateur slice :** En tant que bailleur, je lance l'app, j'ouvre le navigateur sur `http://127.0.0.1:7878/biens`, je remplis un formulaire minimal Bien+Lot, je clique "Enregistrer le bien", et je vois la ligne apparaître dans la liste — donnée persistée, survit au redémarrage.

Purpose: Prouver que Fastify ↔ Kysely ↔ SQLite ↔ EJS ↔ domaine hexagonal s'enchaînent sans contrainte cachée. Toute Phase 1 ultérieure bâtit sur ce squelette.
Output: Un Bien créé + un Lot créé + persistés en SQLite (path OS-conventional) + affichés dans la liste HTML. BDD scenario green. Test unitaire `Bien` green. Test intégration `BienRepository` green.

**Note MVP vertical slice :** ce plan livre **un seul Lot** par Bien (forme minimale du formulaire), un seul type de Bien (`appartement`), aucune édition, aucune suppression — pour rester dans la Walking Skeleton. L'élargissement à plusieurs Lots, types variés, edit, delete est livré par le Plan 03.
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
@.planning/phases/01-activation-bien-locataire-bail/01-01-project-init-SUMMARY.md
@DDD.md
@BDD_PRACTICES.md
@LOCATION_MEUBLEE_REGLES.md

<interfaces>
<!-- Contrats à implémenter dans ce plan. Tâche 0 (Behaviors First) les fige avant tout code. -->

Port BienRepository (src/domain/patrimoine/bien-repository.ts) — interface seulement, pas d'implémentation dans le domaine :
- `enregistrer(bien: Bien): Promise<void>` — insert si nouveau, update si existant
- `trouverParId(id: BienId): Promise<Bien | null>`
- `listerTous(): Promise<Bien[]>` — exclut soft-deleted

Entité Bien (src/domain/patrimoine/bien.ts) — invariants encodés au constructeur statique :
- Factory `Bien.creer({ adresse: Adresse, surface: number, type: TypeBien, anneeConstruction: number, lots: Lot[] }): Bien` — throw si surface ≤ 0 ou lots.length === 0
- Getters readonly : `id`, `adresse`, `surface`, `type`, `anneeConstruction`, `lots`

VO Adresse (src/domain/_shared/adresse.ts) : { rue, codePostal, ville } — non vides
TypeBien (src/domain/patrimoine/bien.ts) : 'appartement' | 'maison' | 'immeuble' | 'local_commercial'
Lot (src/domain/patrimoine/lot.ts — créé dans ce plan, étendu Plan 03) : { id, designation, surface?, type, etage? }
TypeLot : 'appartement' | 'parking' | 'cave' | 'local_commercial' | 'terrasse' | 'autre'
BienId / LotId : nominal types wrapping `string` (UUID v4)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 0: BDD scenario rouge + test unitaire `Bien` rouge + test intégration repo rouge (Wave 0 gaps)</name>
  <files>
    tests/bdd/features/activation.feature,
    tests/bdd/step_definitions/activation.steps.ts,
    tests/unit/patrimoine/bien.test.ts,
    tests/integration/repositories/bien-repository-sqlite.test.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §5 (Walking Skeleton Slice) + §7 (Wave 0 gaps)
    - BDD_PRACTICES.md §2 (Format Given/When/Then), §4 (Règles d'or), §5 (Outside-in)
    - DDD.md §4.1 (Entité), §4.3 (Agrégat), §4.4 (Repository)
  </read_first>
  <behavior>
    BDD scenario (activation.feature) :
    - Given l'application est lancée pour la première fois (DB vide)
    - When le bailleur soumet le formulaire Bien : adresse "12 rue des Lilas, 75020 Paris", surface 45, type appartement, année 1985, 1 lot "Appartement principal" type appartement
    - Then le Bien est visible dans la liste GET /biens
    - And la liste contient "12 rue des Lilas"
    - And la table SQLite `bien` contient 1 ligne et `lot` contient 1 ligne

    Unit Bien :
    - Test "Bien.creer rejette surface ≤ 0" → throw InvariantViolated("surface doit être > 0")
    - Test "Bien.creer rejette lots vide" → throw InvariantViolated("au moins un lot requis")
    - Test "Bien.creer accepte 1 lot et surface 45" → ne throw pas, retourne instance Bien

    Intégration BienRepository :
    - Test "persiste et retrouve un Bien avec son Lot" : créer Bien (1 Lot), enregistrer, listerTous → 1 résultat, trouverParId → entité identique (même id, mêmes lots)
    - Test "listerTous exclut un Bien soft-deleted" : créer Bien, soft-delete (`supprime_le = now()`), listerTous → 0 résultat
    - Setup : `Kysely<DB>` sur `better-sqlite3(":memory:")` avec migrations appliquées via `FileMigrationProvider`
  </behavior>
  <action>
    Écrire **EN PREMIER** les 3 fichiers de tests (qui échouent — feu rouge BDD outside-in §5).

    `tests/bdd/features/activation.feature` — Gherkin français, 1 seul scenario "Création Bien minimal au premier lancement" exprimant le behavior listé ci-dessus.

    `tests/bdd/step_definitions/activation.steps.ts` — steps Cucumber :
    - World custom : démarre Fastify sur port aléatoire, instancie temp SQLite (better-sqlite3 ":memory:"), applique migrations Kysely. Stocke `app`, `db`, `lastResponse`.
    - Given step : world setup (DB vide, app boot).
    - When step : `app.inject({ method: 'POST', url: '/biens', payload: form-encoded, headers: { 'content-type': 'application/x-www-form-urlencoded' } })`. Garde la réponse.
    - Then step 1 : assert 302 puis suivre Location → GET /biens, assert 200, assert HTML body contient "12 rue des Lilas".
    - Then step 2 : query SQLite `SELECT COUNT(*) FROM bien` → 1, `SELECT COUNT(*) FROM lot` → 1.
    - After hook : `app.close()` + `db.destroy()`.

    `tests/unit/patrimoine/bien.test.ts` — Vitest :
    - `describe("Bien invariants")` avec 3 tests `it(...)` matchant les behaviors ci-dessus.
    - Utiliser fixtures inline (pas de builders à ce stade — Plan 03 introduira `un_bien_valide()`).
    - Assertion : `expect(() => Bien.creer({ ..., surface: 0, ... })).toThrow(/surface/i)`.

    `tests/integration/repositories/bien-repository-sqlite.test.ts` — Vitest :
    - `beforeEach`: instancier `Kysely<DB>` sur better-sqlite3(":memory:"), appliquer migrations via `FileMigrationProvider` (path `migrations/`), instancier `BienRepositorySqlite(db)`.
    - 2 tests décrits dans behavior.
    - `afterEach`: `db.destroy()`.

    À ce stade, **les 3 commandes échouent** : `pnpm test -- bien` rouge (Bien n'existe pas), `pnpm test -- bien-repository-sqlite` rouge (repo n'existe pas), `pnpm test:bdd` rouge (route /biens n'existe pas). C'est attendu.
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/patrimoine/bien.test.ts 2&gt;&amp;1 | grep -E "FAIL|Error" || true</automated>
  </verify>
  <acceptance_criteria>
    - `tests/bdd/features/activation.feature` contient "Feature: Activation" et 1 `Scenario:`.
    - `tests/bdd/features/activation.feature` contient "12 rue des Lilas" (canary string utilisée dans les Then).
    - `tests/unit/patrimoine/bien.test.ts` contient 3 occurrences de `it(` ou `test(` (assertion: `grep -c -E "^[[:space:]]*(it|test)\(" tests/unit/patrimoine/bien.test.ts` ≥ 3).
    - `tests/integration/repositories/bien-repository-sqlite.test.ts` contient `Kysely` et `:memory:`.
    - `pnpm test -- --run tests/unit/patrimoine/bien.test.ts` exit code ≠ 0 (rouge attendu — `Bien` pas encore défini).
    - `pnpm test:bdd` exit code ≠ 0 (rouge attendu — handler POST /biens pas encore défini).
  </acceptance_criteria>
  <done>Trois suites de tests rouges écrites, déclarant le contrat exact que les Tasks 1-3 doivent satisfaire. Conforme cycle outside-in BDD_PRACTICES.md §5.</done>
</task>

<task type="auto">
  <name>Task 1: Migration 0001_init.sql + Kysely setup + détection premier lancement</name>
  <files>
    src/infrastructure/db/database.ts,
    src/infrastructure/db/kysely-types.ts,
    src/infrastructure/db/migrations/0001_init.sql,
    migrations/0001_init.sql,
    src/infrastructure/lifecycle/premier-lancement.ts,
    src/domain/_shared/identifiants.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §4 (Persistence Schema — schéma SQL complet à reproduire)
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Persistence Schema V1"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-05 (path OS), D-12 (Kysely + migrations SQL), DP-01 (soft-delete), DP-06 (meta table)
    - LOCATION_MEUBLEE_REGLES.md §3.1 (durée bail classique) + §5 (dépôt garantie)
  </read_first>
  <action>
    Écrire `src/infrastructure/db/migrations/0001_init.sql` exactement comme RESEARCH §4 :
    - Tables `bien`, `lot`, `locataire`, `bail`, `bail_lots`
    - Toutes contraintes CHECK reproduites (surface > 0, type IN (...), duree_mois ≥ 12, loyer_hc > 0, mode_charges IN ('forfait','provisions'))
    - Colonnes timestamps `cree_le`, `modifie_le`, `supprime_le` (soft-delete DP-01)
    - **Ajouter** la table `meta(cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)` (DP-06 — détection premier lancement)
    - Symlink ou copie de ce fichier vers `migrations/0001_init.sql` racine (Kysely `FileMigrationProvider` lit depuis racine par convention).

    Écrire `src/domain/_shared/identifiants.ts` — types nominaux UUID :
    - Brand types : `type BienId = string & { readonly __brand: 'BienId' }`, idem `LotId`, `LocataireId`, `BailId`.
    - Factory `nouveauBienId(): BienId` retourne `crypto.randomUUID()` cast en brand type.
    - Validateur `estBienId(s: string): boolean` regex UUID v4.

    Écrire `src/infrastructure/db/kysely-types.ts` — types DB (manuels, alignés migration) :
    - Interface `DB` exportée : `{ bien: BienTable, lot: LotTable, locataire: LocataireTable, bail: BailTable, bail_lots: BailLotsTable, meta: MetaTable }`.
    - Chaque table type : champs alignés colonnes SQL avec types Kysely (`Generated<string>` pour timestamps default, `ColumnType` selon besoins, `string | null` pour `supprime_le`).
    - Money fields en `number` (Kysely → bigint problème : utiliser `Int8` Kysely ou cast manuel ; en V1 Phase 1 les loyers tiennent en safeInteger donc `number` acceptable — documenter dans le fichier que la conversion stricte bigint↔number passe par le VO Money).

    Écrire `src/infrastructure/db/database.ts` :
    - Export `ouvrirDb(cheminFichier: string): Kysely<DB>` : instancie `new Database(cheminFichier)` (better-sqlite3), wrap dans Kysely `SqliteDialect`, retourne instance.
    - Export `cheminBaseParDefaut(): string` : retourne path OS-conventional (D-05) :
      - macOS : `path.join(os.homedir(), 'Library', 'Application Support', 'gestion-locative', 'db.sqlite')`
      - Linux : `path.join(os.homedir(), '.local', 'share', 'gestion-locative', 'db.sqlite')`
      - Windows : `path.join(process.env.APPDATA ?? '', 'gestion-locative', 'db.sqlite')`
      - `mkdir -p` sur dossier parent avant retour.
    - Export `appliquerMigrations(db: Kysely<DB>, migrationsPath: string): Promise<void>` : utilise `Migrator` Kysely + `FileMigrationProvider` (lecture `.sql` brut → import dynamique : Kysely `FileMigrationProvider` attend des modules JS exportant `up`/`down` ; **alternative simple** : lire fichier SQL et exécuter via `sql\`${content}\`.execute(db)`). Implémenter une fonction `appliquerMigrationsBrutes` qui : lit `0001_init.sql`, split sur `;`, exécute chaque statement non vide. Tracker `meta('migrations_appliquees', '0001')` pour idempotence.
    - Export `interfaceCli(args: string[])` : si `args.includes('migrate')`, appelle `appliquerMigrationsBrutes` puis exit. Permet `pnpm db:migrate`.
    - Au bas du fichier : `if (import.meta.url === \`file://${process.argv[1]}\`) { interfaceCli(process.argv.slice(2)) }`.

    Écrire `src/infrastructure/lifecycle/premier-lancement.ts` :
    - Export `estPremierLancement(db: Kysely<DB>): Promise<boolean>` : `SELECT valeur FROM meta WHERE cle = 'wizard_complete'` → retourne true si row null/undefined, false sinon.
    - Export `marquerWizardComplete(db: Kysely<DB>): Promise<void>` : `INSERT OR REPLACE INTO meta(cle, valeur) VALUES('wizard_complete', '1')`.
    - Note : dans Phase 1 plan 02, le wizard n'est pas encore implémenté ; `estPremierLancement` est exposé mais le handler racine redirigera systématiquement vers `/biens` (Plan 06 branchera le wizard).
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint:deps</automated>
  </verify>
  <acceptance_criteria>
    - `src/infrastructure/db/migrations/0001_init.sql` contient `CREATE TABLE bien`, `CREATE TABLE lot`, `CREATE TABLE locataire`, `CREATE TABLE bail`, `CREATE TABLE bail_lots`, `CREATE TABLE meta` (assertion: `for t in bien lot locataire bail bail_lots meta; do grep -q "CREATE TABLE $t" src/infrastructure/db/migrations/0001_init.sql; done`).
    - `migrations/0001_init.sql` existe (copie ou symlink) — Kysely FileMigrationProvider le lit.
    - `src/domain/_shared/identifiants.ts` contient `crypto.randomUUID()`.
    - `src/infrastructure/db/database.ts` contient `Library/Application Support`, `.local/share`, et `APPDATA` (les 3 paths OS) (assertion: tous les 3 grep -q passent).
    - `src/infrastructure/lifecycle/premier-lancement.ts` contient `wizard_complete`.
    - `pnpm typecheck` exit 0.
    - `pnpm lint:deps` exit 0 (aucune violation : `src/infrastructure/**` peut importer Kysely, better-sqlite3 ; `src/domain/_shared/identifiants.ts` n'importe rien d'externe sauf `crypto` natif).
  </acceptance_criteria>
  <done>Schéma SQL versionné, Kysely typé sur la DB Phase 1, helpers OS-path + premier-lancement prêts. Migration appliquable via `pnpm db:migrate` (à câbler en Task 3 via main.ts).</done>
</task>

<task type="auto">
  <name>Task 2: Domaine `Bien` + port `BienRepository` + adapter SQLite + use case `CreerBien`</name>
  <files>
    src/domain/_shared/adresse.ts,
    src/domain/patrimoine/bien.ts,
    src/domain/patrimoine/lot.ts,
    src/domain/patrimoine/bien-repository.ts,
    src/infrastructure/repositories/bien-repository-sqlite.ts,
    src/application/patrimoine/creer-bien.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §2 (Agrégat Bien — invariants), §3 (folder layout)
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-28, D-29, D-30, DV-03 (domaine pur), DV-04 (français)
    - DDD.md §4.1 (Entité), §4.2 (VO), §4.3 (Agrégat), §4.4 (Repository), §5 (règles non négociables)
    - tests/unit/patrimoine/bien.test.ts (le contrat à satisfaire — écrit en Task 0)
    - tests/integration/repositories/bien-repository-sqlite.test.ts (le contrat repo)
  </read_first>
  <action>
    `src/domain/_shared/adresse.ts` — VO Adresse :
    - Class `Adresse` immuable avec readonly `rue: string`, `codePostal: string`, `ville: string`.
    - Factory `Adresse.creer({ rue, codePostal, ville }): Adresse` throw `InvariantViolated` si l'un est vide ou trim() === ''.
    - Méthode `enLigne(): string` retourne `\`${rue}, ${codePostal} ${ville}\``.
    - Méthode `egale(autre: Adresse): boolean`.
    - Exporter `class InvariantViolated extends Error` (ou dans un fichier `src/domain/_shared/erreurs.ts` séparé si tu préfères).

    `src/domain/patrimoine/lot.ts` — Entité Lot (interne agrégat Bien) :
    - Type `TypeLot = 'appartement' | 'parking' | 'cave' | 'local_commercial' | 'terrasse' | 'autre'`.
    - Class `Lot` avec readonly `id: LotId`, `designation: string`, `surface: number | null`, `type: TypeLot`, `etage: number | null`.
    - Factory `Lot.creer({ designation, surface, type, etage }): Lot` :
      - `designation` non vide.
      - `type` ∈ TypeLot enum.
      - `surface` : si type ∈ {'appartement', 'maison', 'local_commercial'} alors > 0, sinon nullable.
      - Throw `InvariantViolated` si check échoue.

    `src/domain/patrimoine/bien.ts` — Entité racine Bien :
    - Type `TypeBien = 'appartement' | 'maison' | 'immeuble' | 'local_commercial'`.
    - Class `Bien` avec readonly `id: BienId`, `adresse: Adresse`, `surface: number`, `type: TypeBien`, `anneeConstruction: number`, `lots: ReadonlyArray<Lot>`.
    - Factory statique `Bien.creer({ id?, adresse, surface, type, anneeConstruction, lots }): Bien` :
      - Si `id` absent → `nouveauBienId()`.
      - Si `surface <= 0` → throw `InvariantViolated("La surface d'un Bien doit être strictement positive")`.
      - Si `lots.length === 0` → throw `InvariantViolated("Un Bien doit avoir au moins un Lot")` (D-29).
      - Si `type` ∉ TypeBien enum → throw.
      - Si `anneeConstruction < 1700 || > new Date().getFullYear() + 1` → throw (note : invariant simple Phase 1 ; les ajustements LMNP composants sont Phase 5).
    - Méthode `ajouterLot(lot: Lot): Bien` retourne nouvelle instance avec `lots: [...this.lots, lot]` (immutabilité).
    - **Aucun import** depuis `infrastructure`, `web`, `application`, ni de module npm externe (sauf types `crypto` Node natif via `identifiants.ts`).

    `src/domain/patrimoine/bien-repository.ts` — Port :
    - `export interface BienRepository { enregistrer(bien: Bien): Promise<void>; trouverParId(id: BienId): Promise<Bien | null>; listerTous(): Promise<Bien[]>; supprimer(id: BienId): Promise<void>; }`.
    - Aucun import autre que types domaine.

    `src/infrastructure/repositories/bien-repository-sqlite.ts` — Adapter :
    - `class BienRepositorySqlite implements BienRepository`.
    - Constructeur prend `private readonly db: Kysely<DB>`.
    - `enregistrer(bien)` : `INSERT OR REPLACE INTO bien` + cleanup lots (delete + reinsert ou upsert). Utilise `db.transaction().execute()` pour atomicité bien+lots.
    - `trouverParId(id)` : `SELECT FROM bien WHERE id = ? AND supprime_le IS NULL` + `SELECT FROM lot WHERE bien_id = ? AND supprime_le IS NULL` → mappe vers entités domaine via factory `Bien.creer({...})`.
    - `listerTous()` : `SELECT ... WHERE supprime_le IS NULL ORDER BY cree_le DESC`. Pour chaque bien, charger ses lots (Phase 1 acceptable N+1 pour 1-10 biens ; optimisation différée).
    - `supprimer(id)` : `UPDATE bien SET supprime_le = CURRENT_TIMESTAMP WHERE id = ?` (soft-delete DP-01).
    - **Helpers privés** : `vers_domaine(row, lots)` et `vers_row(bien)` — pas d'annotation décorative sur entités domaine.

    `src/application/patrimoine/creer-bien.ts` — Use case :
    - `interface CreerBienCommand { adresse: { rue: string; codePostal: string; ville: string }; surface: number; type: TypeBien; anneeConstruction: number; lots: Array<{ designation: string; surface: number | null; type: TypeLot; etage: number | null }> }`.
    - Fonction `export async function creerBien(commande: CreerBienCommand, repo: BienRepository): Promise<BienId>` :
      - Construit `Adresse.creer(commande.adresse)`.
      - Construit `Lot[]` via `commande.lots.map(Lot.creer)`.
      - Construit `Bien.creer({ adresse, ..., lots })`.
      - Appelle `repo.enregistrer(bien)`.
      - Retourne `bien.id`.
    - Toute erreur d'invariant remonte à l'appelant (route handler).
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/patrimoine/bien.test.ts &amp;&amp; pnpm test -- --run tests/integration/repositories/bien-repository-sqlite.test.ts &amp;&amp; pnpm lint:deps</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test -- --run tests/unit/patrimoine/bien.test.ts` exit 0 (3 tests verts).
    - `pnpm test -- --run tests/integration/repositories/bien-repository-sqlite.test.ts` exit 0 (2 tests verts).
    - `pnpm lint:deps` exit 0 — assertion : `src/domain/patrimoine/bien.ts` ne contient AUCUN `import.*from.*['"](fastify|kysely|better-sqlite3|pino|@fastify)` (assertion: `grep -E "from.*['\"]+(fastify|kysely|better-sqlite3|pino|@fastify)" src/domain/patrimoine/bien.ts | wc -l` == 0).
    - `src/domain/patrimoine/bien.ts` contient `export class Bien` et factory `Bien.creer`.
    - `src/domain/patrimoine/bien-repository.ts` contient `export interface BienRepository`.
    - `src/infrastructure/repositories/bien-repository-sqlite.ts` contient `implements BienRepository` et `import { Kysely }`.
  </acceptance_criteria>
  <done>L'agrégat `Bien` valide ses invariants en unit, le repository SQLite roundtrip un Bien avec son Lot en intégration, le use case `creerBien` orchestre domaine + repo. Barrière hexagonale verte (depcruise OK).</done>
</task>

<task type="auto">
  <name>Task 3: Bootstrap Fastify + routes racine + biens + EJS layout/liste + Pico.css + BDD vert</name>
  <files>
    src/main.ts,
    src/web/routes/racine.ts,
    src/web/routes/biens.ts,
    src/web/views/partials/layout.ejs,
    src/web/views/pages/biens/liste.ejs,
    public/styles/pico.min.css
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Routes Fastify"
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Layout Shell" + §"Data Table Partial" + §"Empty States" + §"Copywriting Contract"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-05, D-06, D-07, D-10, D-11, D-20, D-24, D-43, D-44
    - tests/bdd/features/activation.feature (le contrat à faire passer)
    - tests/bdd/step_definitions/activation.steps.ts (le world Cucumber)
  </read_first>
  <action>
    Télécharger Pico.css en local : copier `node_modules/@picocss/pico/css/pico.classless.min.css` (installer `@picocss/pico` dans devDependencies via `pnpm add -D @picocss/pico`) vers `public/styles/pico.min.css`. Alternative : commit direct du CSS minified (local-first, pas de CDN — D-05/D-20).

    `src/web/views/partials/layout.ejs` — Layout shell EJS :
    - `<!doctype html>` + `<html lang="fr">` + `<head>` avec `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title><%= titre %></title>`, `<link rel="stylesheet" href="/styles/pico.min.css">`.
    - `<body>` avec `<header>` (titre app "Gestion locative"), `<nav aria-label="Navigation principale">` sidebar (liens Biens / Locataires / Baux — pour Plan 02 seul "Biens" est actif, autres pointent vers "#" avec attribut `aria-disabled="true"` ou affichés en `<li>` muet — choisir liens cliquables maintenant et créer pages stub Plans 04/05).
    - `<main>` avec `<nav aria-label="Fil d'Ariane">` (breadcrumb stub) puis `<%- contenu %>` (unescape pour insertion HTML).
    - Banner success conditionnel : si `locals.banniereSuccess`, render `<aside role="status" aria-live="polite"><%= banniereSuccess %></aside>` (style Pico semantic).

    `src/web/views/pages/biens/liste.ejs` — Page liste Biens (utilise layout) :
    - Inclure `<%- include('../../partials/layout', { titre: 'Biens', contenu: ... }) %>` — ou pattern alternatif : helper render(layout, contenu) en `src/main.ts`.
    - Empty state (UI-SPEC §"Empty States" copywriting EXACT) : si `locals.biens.length === 0` :
      - `<h1>Aucun bien pour l'instant</h1>`
      - `<p>Ajoutez votre premier bien immobilier pour démarrer la gestion locative.</p>`
      - `<a href="/biens/nouveau" role="button">Créer un bien</a>` (Plan 03 livrera la route /nouveau ; pour Plan 02, route stub → formulaire minimal inline).
    - Sinon, table HTML (UI-SPEC §"Data Table Partial") :
      - `<table aria-label="Liste des biens">` avec `<thead>` (Adresse, Type, Surface, Année, Nombre de lots, Actions) — chaque `<th scope="col">`, numériques avec class numeric.
      - `<tbody>` avec `<%= biens.forEach(b => { %>` `<tr>` `<td>${b.adresse.enLigne()}</td>` ... `<td class="numeric">${b.surface} m²</td>` ... etc.
      - Format date avec helper `formatDate(plainDate)` injecté en locals (RESEARCH §8 pitfall 4) — pour Plan 02 pas de date affichée donc helper différé.
    - **Pour le Walking Skeleton minimal** : afficher au minimum `<h1>Biens</h1>` + un formulaire inline POST `/biens` directement sur la page liste (pas de route /nouveau séparée Plan 02) avec champs : rue, code postal, ville, surface, type (select hardcoded 'appartement'), anneeConstruction, lot1_designation, lot1_type (select 'appartement'). Le formulaire est SOUS la table (ou l'empty state). Bouton submit "Enregistrer le bien" (UI-SPEC §"Primary CTAs"). **Plan 03 remplacera ce formulaire inline par une route /nouveau dédiée + formulaire complet avec N lots dynamiques.**

    `src/web/routes/racine.ts` — Route plugin Fastify :
    - `export async function plugin(app: FastifyInstance, opts: { db: Kysely<DB> })`.
    - `app.get('/', async (req, reply) => { const premier = await estPremierLancement(opts.db); if (premier) { /* Plan 06 redirigera vers /wizard/bien. Plan 02 : redirige vers /biens. */ return reply.redirect('/biens'); } return reply.redirect('/biens'); })`.
    - Note : la branche premier-lancement vs not est exposée mais redirige identique en Plan 02 — Plan 06 branchera le wizard.

    `src/web/routes/biens.ts` — Route plugin Fastify :
    - `export async function plugin(app: FastifyInstance, opts: { repo: BienRepository })`.
    - `app.get('/biens', async (req, reply) => { const biens = await opts.repo.listerTous(); return reply.view('pages/biens/liste.ejs', { biens, banniereSuccess: req.session?.banniere ?? null }) })`.
    - `app.post('/biens', async (req, reply) => { const body = req.body as Record<string, unknown>; const commande = { adresse: { rue: body.rue, codePostal: body.codePostal, ville: body.ville }, surface: Number(body.surface), type: body.type, anneeConstruction: Number(body.anneeConstruction), lots: [{ designation: body.lot1_designation, surface: null, type: body.lot1_type, etage: null }] }; try { await creerBien(commande, opts.repo); return reply.redirect('/biens'); } catch (err) { /* Plan 03/06 : re-render avec erreurs inline ; Plan 02 : 400 plain text */ return reply.code(400).send(err instanceof Error ? err.message : 'Erreur invariant'); } })`.
    - Note : la validation Zod arrive en Plan 03 (`src/web/schemas/bien-schemas.ts`). Plan 02 fait du parsing manuel pour rester minimal.

    `src/main.ts` — Bootstrap :
    - Import Fastify, `@fastify/view` (engine ejs), `@fastify/formbody`, `@fastify/static`, `@fastify/cookie`, `@fastify/session`, `pino`, helpers DB + lifecycle + routes.
    - Lecture `.env` (via `process.env`, pas de dotenv en V1 — instructions claires dans README ultérieur). Lire `SESSION_SECRET`, `PORT` (défaut 7878), `HOST` (défaut 127.0.0.1).
    - Si CLI arg `migrate` → exécute `appliquerMigrationsBrutes` puis exit.
    - Sinon : créer `app = Fastify({ logger: pino({ level: process.env.LOG_LEVEL ?? 'info' }) })`.
    - Register `@fastify/cookie`, `@fastify/session` (cookie httpOnly, secret env). En dev sans secret défini, fail-fast avec message d'erreur clair (recommander `openssl rand -hex 32`).
    - Register `@fastify/formbody`, `@fastify/static` (root `public/`).
    - Register `@fastify/view` avec engine `ejs`, root `src/web/views/`, options Pico classless friendly.
    - Ouvrir DB via `ouvrirDb(cheminBaseParDefaut())` puis `appliquerMigrationsBrutes` au boot (idempotent).
    - Instancier `repo = new BienRepositorySqlite(db)`.
    - Register routes `racine.ts` (opts: { db }) et `biens.ts` (opts: { repo }).
    - `app.listen({ port, host })` + log `pino` "server listening on http://${host}:${port}".
    - Detection "déjà lancé" (D-07) : avant `listen`, écrire `.pid` lockfile dans le dossier DB ; si déjà existant ET process vivant, log message clair "déjà lancé sur http://localhost:${port}" + exit 1. **À implémenter minimal Plan 02** (pidfile.ts dans infrastructure/lifecycle/, écrire un fichier, vérifier existence, gérer SIGINT/SIGTERM pour cleanup). Plan 03+ peut affiner.
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test:bdd &amp;&amp; pnpm test -- --run</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exit 0.
    - `pnpm test:bdd` exit 0 (scenario activation green — POST /biens persiste, GET /biens affiche).
    - `pnpm test -- --run` exit 0 (unit Bien + integration BienRepository verts).
    - `pnpm lint:deps` exit 0 (barrière hexagonale respectée).
    - `src/main.ts` contient `app.listen` et `127.0.0.1`.
    - `src/web/views/pages/biens/liste.ejs` contient "Aucun bien pour l'instant" (assertion: `grep -q "Aucun bien pour l'instant" src/web/views/pages/biens/liste.ejs`).
    - `src/web/views/pages/biens/liste.ejs` contient "Enregistrer le bien" (CTA UI-SPEC).
    - `public/styles/pico.min.css` existe (assertion: `test -s public/styles/pico.min.css`).
    - Démarrage manuel : `pnpm dev` boot Fastify, `curl http://127.0.0.1:7878/biens` retourne HTML 200 (vérifié dans le SUMMARY plan checkpoint manuel s'il existe — sinon vérifié par BDD `app.inject`).
  </acceptance_criteria>
  <done>Walking Skeleton vert : Fastify boote, route racine redirige vers /biens, formulaire POST /biens minimal crée Bien+Lot, page liste affiche le résultat persisté, scenario BDD green. La barrière hexagonale tient. La tranche complète end-to-end utilisateur → écran fonctionne.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → Fastify (loopback 127.0.0.1) | Mono-user local ; pas d'attaquant réseau (D-06). Risque résiduel : malware local accédant à 127.0.0.1. |
| Fastify route handler → use case domaine | Input HTTP non validé doit être normalisé/validé avant d'atteindre le domaine. |
| Use case → SQLite via Kysely | Kysely paramétrise nativement les requêtes (pas de string concat) → SQLi mitigé. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Tampering | POST /biens body | mitigate | Validation manuelle Plan 02 (Number(), default), Zod strict Plan 03. Invariants domaine (`Bien.creer`) catch les valeurs absurdes. |
| T-01-02 | Information Disclosure | Binding réseau | accept | 127.0.0.1 uniquement (D-06). Pas d'exposition LAN/Internet. |
| T-01-03 | Denial of Service | Pidfile / double-lock | mitigate | Détection "déjà lancé" (D-07) via pidfile dans `lifecycle/pidfile.ts` ; refus boot si autre instance vivante. |
| T-01-04 | Spoofing | Session cookie | accept | Mono-user local → pas d'enjeu de spoofing. Cookie httpOnly + secret 32+ chars pour resilience future (D-06 + DP-05). |
| T-01-05 | Repudiation | Soft-delete sans audit log | accept | DP-01 soft-delete `supprime_le` est suffisant Phase 1 (ledger complet en Phase 5 fiscalité). |
| T-01-06 | Elevation of Privilege | Pas d'auth Phase 1 | accept | DV-02 mono-user. Phase V1.1+ ajoutera passcode/biometric si packaging app installée. |
| T-01-07 | Tampering | SQL Injection | mitigate | Kysely query builder paramétrise tout. Migration SQL en raw mais sans input user. |
</threat_model>

<verification>
- `pnpm install` exit 0
- `pnpm typecheck` exit 0
- `pnpm test -- --run` exit 0 (au moins 5 tests verts : 3 unit Bien + 2 integration BienRepository)
- `pnpm test:bdd` exit 0 (1 scenario "Création Bien minimal" green)
- `pnpm lint:deps` exit 0 (barrière `domain → !infra/!web/!application` respectée)
- `pnpm dev` boote Fastify sur http://127.0.0.1:7878 sans erreur dans log pino
- `curl http://127.0.0.1:7878/biens` retourne HTML 200 contenant soit l'empty state "Aucun bien pour l'instant", soit la table des Biens
- POST `/biens` (form-data avec rue, codePostal, ville, surface, type, anneeConstruction, lot1_designation, lot1_type) retourne 302 vers `/biens`, puis GET `/biens` affiche la nouvelle ligne
- Fichier SQLite créé à `~/.local/share/gestion-locative/db.sqlite` (Linux) avec tables `bien`, `lot`, `meta`, etc. (vérifier `sqlite3 ~/.local/share/gestion-locative/db.sqlite ".tables"`)
- Boot d'une 2e instance détecte le pidfile et refuse (log clair "déjà lancé") OU est ignoré (acceptable Plan 02 si pidfile fait défaut, à affiner Plan 03)
</verification>

<success_criteria>
**Le Walking Skeleton fonctionne end-to-end.**

L'utilisateur exécute `pnpm install && pnpm dev`, ouvre `http://127.0.0.1:7878`, voit l'empty state "Aucun bien pour l'instant", remplit le formulaire minimal, clique "Enregistrer le bien", et voit immédiatement la ligne apparaître dans la liste. Après `Ctrl-C` et `pnpm dev` à nouveau, la ligne est toujours là (persistée SQLite).

Le scenario BDD `activation.feature` est vert. Les tests unit `Bien` et integration `BienRepositorySqlite` sont verts. La barrière hexagonale (depcruise) tient.

**Plans 03-07 bâtissent sur ce squelette.** Aucun de ces plans ne pourra démarrer sans cette tranche en vert.
</success_criteria>

<output>
Créer `.planning/phases/01-activation-bien-locataire-bail/01-02-walking-skeleton-SUMMARY.md`. Lister :
- Chemin exact du fichier SQLite créé sur la machine de l'exécuteur (Linux/macOS/Windows selon hôte)
- Confirmation que le scenario BDD "Activation premier lancement" est vert
- Comptage des tests verts : N unit + M integration + 1 BDD
- Confirmation `pnpm lint:deps` vert (aucun import technique dans `src/domain/`)
- Tout pattern établi (helpers, conventions de nommage, structure de routes) que les Plans 03-07 doivent réutiliser
</output>

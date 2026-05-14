---
phase: 01-activation-bien-locataire-bail
plan: "02"
subsystem: walking-skeleton
tags: [walking-skeleton, fastify, sqlite, kysely, ddd, hexagonal, bdd, mvp, pico]
dependency_graph:
  requires:
    - build-toolchain (plan 01-01)
  provides:
    - walking-skeleton-end-to-end
    - domain-Bien-Lot-invariants
    - BienRepository-port-and-sqlite-adapter
    - migration-0001-schema
    - Fastify-EJS-Pico-web-shell
    - creerBien-use-case
  affects:
    - plan 03 (Bien CRUD complet, N lots, edit, delete)
    - plan 04 (Locataire — réutilise même pattern port/adapter/use case)
    - plan 05 (Bail — réutilise même pattern)
    - plan 06 (Wizard — réutilise creerApp + routes structure)
tech_stack:
  added:
    - "@picocss/pico 2.1.1 (CSS classless — copié local public/styles/pico.min.css)"
  patterns:
    - "DDD hexagonal : domain/ → ports & adapters → infrastructure/ (depcruise vérifié)"
    - "Entité avec factory statique Bien.creer() + invariants throw InvariantViolated"
    - "Brand type BienId/LotId/etc (string & { __brand }) via crypto.randomUUID()"
    - "ConnexionDb = { db: Kysely<DB>, sqlite: BetterSqlite3.Database } — passer les deux pour migrations brutes"
    - "appliquerMigrationsBrutes(db, sqlite, chemin) — sqlite.exec() pour multi-statements idempotent"
    - "creerApp(db) exportée séparément de demarrer() — testable sans IO"
    - "Fastify logger : objet de config direct (pino instance rejetée par Fastify 5)"
    - "Cucumber step avec / dans le texte : utiliser regex /^...$/ pour éviter le parser alternation"
    - "Feature file : pas de # language: fr si keywords anglais (Feature/Scenario/Given/When/Then)"
    - "EJS inline contenu via template string dans la view (pas de renderString Fastify)"
key_files:
  created:
    - gestion-locative/migrations/0001_init.sql
    - gestion-locative/src/domain/_shared/erreurs.ts
    - gestion-locative/src/domain/_shared/identifiants.ts
    - gestion-locative/src/domain/_shared/adresse.ts
    - gestion-locative/src/domain/patrimoine/bien.ts
    - gestion-locative/src/domain/patrimoine/lot.ts
    - gestion-locative/src/domain/patrimoine/bien-repository.ts
    - gestion-locative/src/infrastructure/db/migrations/0001_init.sql
    - gestion-locative/src/infrastructure/db/kysely-types.ts
    - gestion-locative/src/infrastructure/db/database.ts
    - gestion-locative/src/infrastructure/lifecycle/premier-lancement.ts
    - gestion-locative/src/infrastructure/lifecycle/pidfile.ts
    - gestion-locative/src/infrastructure/repositories/bien-repository-sqlite.ts
    - gestion-locative/src/application/patrimoine/creer-bien.ts
    - gestion-locative/src/web/routes/racine.ts
    - gestion-locative/src/web/routes/biens.ts
    - gestion-locative/src/web/views/partials/layout.ejs
    - gestion-locative/src/web/views/pages/biens/liste.ejs
    - gestion-locative/public/styles/pico.min.css
    - gestion-locative/tests/bdd/features/activation.feature
    - gestion-locative/tests/bdd/step_definitions/activation.steps.ts
    - gestion-locative/tests/unit/patrimoine/bien.test.ts
    - gestion-locative/tests/integration/repositories/bien-repository-sqlite.test.ts
  modified:
    - gestion-locative/package.json (ajout @picocss/pico devDep)
    - gestion-locative/pnpm-lock.yaml
    - gestion-locative/src/types.ts (stub plan 01 — toujours présent, non conflictuel)
decisions:
  - "ConnexionDb interface expose (db, sqlite) ensemble — passe les deux au lieu d'accéder aux internals Kysely pour les migrations brutes"
  - "appliquerMigrationsBrutes idempotente via table meta cle=migrations_appliquees"
  - "creerApp(db) séparé de demarrer() — testabilité BDD sans IO filesystem"
  - "Fastify logger doit être un objet de config, pas une instance pino — Fastify 5 vérifie typeof logger"
  - "Cucumber Expression avec '/' → regex obligatoire (/^step text$/) pour éviter le parser alternation"
  - "# language: fr dans .feature forçait les keywords Gherkin en français — retiré pour garder Feature/Scenario/Given/When/Then"
  - "Lot.surface obligatoire > 0 si type appartement ou local_commercial ; nullable sinon (parking, cave, etc.)"
  - "N+1 acceptable dans listerTous() Phase 1 (1-10 biens) — optimisation différée"
  - "pnpm test script : pnpm test -- --run (double tiret pour passer args à vitest)"
metrics:
  duration: "10 minutes"
  completed_date: "2026-05-14"
  tasks_completed: 4
  tasks_total: 4
  files_created: 23
  files_modified: 2
---

# Phase 01 Plan 02: Walking Skeleton Summary

**One-liner:** Walking Skeleton end-to-end — Fastify 5 + Kysely + SQLite + EJS/Pico + domaine hexagonal Bien/Lot — GET /biens liste, POST /biens persiste, BDD scenario vert.

## SQLite Path (macOS)

`/Users/valentinshodo/Library/Application Support/gestion-locative/db.sqlite`

Tables présentes : `bien`, `lot`, `locataire`, `bail`, `bail_lots`, `meta`.

## Tests Green

| Suite | Fichier | Tests |
|-------|---------|-------|
| Unit | tests/unit/patrimoine/bien.test.ts | 3 verts |
| Integration | tests/integration/repositories/bien-repository-sqlite.test.ts | 2 verts |
| BDD | tests/bdd/features/activation.feature | 1 scenario, 5 steps verts |

**Total : 3 unit + 2 integration + 1 BDD scenario = 6 tests/steps green.**

## BDD Scenario vert

```
Feature: Activation
  Scenario: Création Bien minimal au premier lancement
    Given l'application est lancée pour la première fois       ✓
    When le bailleur soumet le formulaire Bien ...              ✓
    Then le Bien est visible dans la liste GET /biens           ✓
    And la liste contient "12 rue des Lilas"                    ✓
    And la table SQLite bien contient 1 ligne et lot contient 1 ligne ✓
```

## Confirmation pnpm lint:deps

`✔ no dependency violations found (16 modules, 34 dependencies cruised)` — aucun import technique dans `src/domain/`.

## Commits

| Task | Hash | Message |
|------|------|---------|
| Task 0 — tests rouges | 194b6a4 | test(01-02): BDD activation rouge + unit Bien rouge + integration repo rouge |
| Task 1 — migration + DB | 5a61b0c | feat(01-02): migration 0001 + Kysely setup + premier-lancement |
| Task 2 — domaine + adapter | 7ba6d0d | feat(01-02): domaine Bien + port BienRepository + adapter SQLite + use case CreerBien |
| Task 3 — Fastify + routes + EJS | 64045bc | feat(01-02): bootstrap Fastify + routes biens + EJS layout + Pico — Walking Skeleton vert |

## Patterns établis pour Plans 03-07

### Structure de route Fastify
```typescript
// Pattern : plugin exporté + options typées
export async function plugin(app: FastifyInstance, opts: { repo: XRepository }): Promise<void> {
  app.get('/biens', async (_req, reply) => { ... });
  app.post('/biens', async (req, reply) => { ... });
}
```

### Pattern repository SQLite
```typescript
class XRepositorySqlite implements XRepository {
  constructor(private readonly db: Kysely<DB>) {}
  // versDomaine() + versRow() — helpers privés de mapping
  // transaction() pour atomicité insert + relations
}
```

### Pattern domaine
- Factory statique `X.creer(props)` — throw `InvariantViolated` sur invariant
- `InvariantViolated extends Error` — dans `src/domain/_shared/erreurs.ts`
- Brand types pour les identifiants : `type XId = string & { readonly __brand: 'XId' }`

### Pattern test BDD (Cucumber)
- `creerApp(db)` — passer la DB, pas de démarrage serveur réel
- Steps avec `/` dans le texte → regex `/^...\/...$/`
- Pas de `# language: fr` si keywords anglais

### appliquerMigrationsBrutes
Signature : `(db: Kysely<DB>, sqlite: BetterSqlite3.Database, cheminSql: string)`
Utilise `sqlite.exec(content)` — multi-statements, idempotent via `meta.migrations_appliquees`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fastify 5 rejette une instance pino comme logger**
- **Found during:** Task 3 (BDD Before hook)
- **Issue:** `Fastify({ logger: pinoInstance })` lève `FastifyError: logger options only accepts a configuration object` en Fastify 5.
- **Fix:** Remplacé par `Fastify({ logger: { level, transport: ... } })` (objet de config direct).
- **Files modified:** `src/main.ts`
- **Commit:** 64045bc

**2. [Rule 1 - Bug] Cucumber Expression rejette '/' dans le texte d'un step**
- **Found during:** Task 3 (pnpm test:bdd)
- **Issue:** Le texte `"le Bien est visible dans la liste GET /biens"` est interprété comme une alternation vide par le parser Cucumber Expression.
- **Fix:** Step converti en regex : `Then(/^le Bien est visible dans la liste GET \/biens$/, ...)`.
- **Files modified:** `tests/bdd/step_definitions/activation.steps.ts`
- **Commit:** 64045bc

**3. [Rule 1 - Bug] `# language: fr` force les keywords Gherkin en français**
- **Found during:** Task 3 (pnpm test:bdd)
- **Issue:** La directive `# language: fr` demande au parser d'attendre `Fonctionnalité:`, `Scénario:`, etc. au lieu de `Feature:`, `Scenario:`.
- **Fix:** Supprimé la ligne `# language: fr` du fichier `.feature` — les keywords restent anglais, les textes de steps sont en français.
- **Files modified:** `tests/bdd/features/activation.feature`
- **Commit:** 64045bc

**4. [Rule 1 - Bug] Kysely executeQuery API interne inaccessible pour SQL brut**
- **Found during:** Task 1 (appliquerMigrationsBrutes)
- **Issue:** Kysely n'expose pas d'API publique pour exécuter du SQL brut multi-statements depuis un string. `sql.raw()` n'existe pas, `db.executeQuery` nécessite une `CompiledQuery` complète avec `queryId`.
- **Fix:** Exposer le driver `better-sqlite3` dans `ConnexionDb = { db, sqlite }` et appeler `sqlite.exec(sqlContent)` directement pour les migrations.
- **Files modified:** `src/infrastructure/db/database.ts`, tests mis à jour pour la nouvelle signature
- **Commit:** 5a61b0c

## Known Stubs

- `src/web/routes/racine.ts` : branche `estPremierLancement` présente mais les deux branches redirigent vers `/biens` — Plan 06 branchera le wizard.
- Formulaire sur `liste.ejs` : formulaire minimal inline POST /biens (1 lot fixe) — Plan 03 le remplacera par route `/nouveau` + N lots dynamiques + Zod.
- Liens "Locataires" et "Baux" dans la nav : `href="#"` avec `aria-disabled="true"` — Plans 04/05.

## Threat Flags

Aucune nouvelle surface réseau ou auth introduite hors plan. Binding 127.0.0.1 respecté (T-01-02 accepted). Session secret fallback `dev-secret-change-me-in-production-32chars` — acceptable pour walking skeleton local, .env.example documente `SESSION_SECRET` requis.

## Self-Check: PASSED

Fichiers vérifiés :
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/migrations/0001_init.sql
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/patrimoine/bien.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/domain/patrimoine/bien-repository.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/infrastructure/repositories/bien-repository-sqlite.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/application/patrimoine/creer-bien.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/src/main.ts
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/public/styles/pico.min.css
- FOUND: /Users/valentinshodo/Projects/toolbox/gestion-locative/tests/bdd/features/activation.feature

Commits vérifiés :
- 194b6a4 (Task 0)
- 5a61b0c (Task 1)
- 7ba6d0d (Task 2)
- 64045bc (Task 3)

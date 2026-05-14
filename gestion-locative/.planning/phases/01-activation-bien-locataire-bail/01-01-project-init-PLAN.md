---
phase: 01-activation-bien-locataire-bail
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - .mise.toml
  - .env.example
  - .gitignore
  - package.json
  - tsconfig.json
  - vitest.config.ts
  - cucumber.json
  - eslint.config.js
  - .prettierrc
  - .dependency-cruiser.cjs
autonomous: true
requirements: []
tags: [scaffolding, tooling, typescript, node, pnpm]

must_haves:
  truths:
    - "Node 22 LTS et pnpm 9 sont pin dans .mise.toml."
    - "TypeScript strict est activé."
    - "Vitest, Cucumber, ESLint flat, Prettier, dependency-cruiser sont configurés."
    - "Tous les scripts pnpm définis dans SKELETON sont exécutables."
    - "`pnpm install` se termine sans erreur."
  artifacts:
    - path: ".mise.toml"
      provides: "Pin Node 22 LTS + pnpm 9"
      contains: "node = "
    - path: "package.json"
      provides: "Dépendances + scripts pnpm"
      exports: ["scripts.dev", "scripts.test", "scripts.test:bdd", "scripts.lint", "scripts.lint:deps", "scripts.typecheck"]
    - path: "tsconfig.json"
      provides: "TypeScript strict mode"
      contains: "\"strict\": true"
    - path: "vitest.config.ts"
      provides: "Vitest config (unit + integration, v8 coverage, exclude bdd)"
    - path: "cucumber.json"
      provides: "BDD config (features/step_definitions paths)"
    - path: "eslint.config.js"
      provides: "ESLint flat avec plugins import + @typescript-eslint + functional"
    - path: ".dependency-cruiser.cjs"
      provides: "Règle boundary: src/domain/** ne dépend pas de src/infrastructure|web|application"
  key_links:
    - from: "package.json"
      to: ".mise.toml"
      via: "engines.node + engines.pnpm aligné avec mise pin"
      pattern: "node.*22"
    - from: "tsconfig.json"
      to: "eslint.config.js"
      via: "ESLint utilise tsconfig pour typage typescript-eslint"
      pattern: "project.*tsconfig"
---

<objective>
Initialiser le projet greenfield avec la stack verrouillée (TypeScript strict, Node 22, pnpm, Vitest, Cucumber, ESLint flat, Prettier, dependency-cruiser, Mise) — **aucune ligne de code métier**. Ce plan ne livre PAS de feature utilisateur (c'est une exception explicite à la règle MVP vertical-slice : sans ce socle, aucune Walking Skeleton n'est exécutable).

Purpose: Fournir l'infrastructure de build/test/lint sur laquelle reposeront les 6 plans suivants. Sans cette base, le plan 02 ne peut pas booter Fastify ni exécuter un seul test.
Output: 9 fichiers de config racine + `package.json` avec scripts pnpm + lockfile. `pnpm install`, `pnpm typecheck`, `pnpm lint`, `pnpm lint:deps`, `pnpm test`, `pnpm test:bdd` doivent **tous** retourner exit 0 (même si la suite de tests est vide à ce stade).
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md
@.planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md
@.planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md
@CLAUDE.md
@DDD.md
@SOFTWARE_CRAFTSMANSHIP.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Pin du runtime (Mise) et `package.json` racine</name>
  <files>.mise.toml, package.json, .gitignore, .env.example</files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Stack" + §"Scripts pnpm"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-08 à D-27
  </read_first>
  <action>
    Créer `.mise.toml` pinnant `node = "22"` et `pnpm = "9"` (D-27, D-09, D-23).

    Créer `package.json` :
    - `"name": "gestion-locative"`, `"version": "0.1.0"`, `"private": true`, `"type": "module"`
    - `engines.node` aligné Node 22+, `engines.pnpm` aligné pnpm 9
    - `packageManager: "pnpm@9.x.x"`
    - Section `scripts` : `dev`, `start`, `db:migrate`, `typecheck`, `test`, `test:watch`, `test:bdd`, `test:cov`, `lint`, `lint:deps`, `format` — exactement comme listés dans SKELETON §"Scripts pnpm"
    - `dependencies` : `fastify`, `@fastify/view`, `@fastify/formbody`, `@fastify/static`, `@fastify/session`, `@fastify/cookie`, `@fastify/csrf-protection`, `ejs`, `better-sqlite3`, `kysely`, `zod`, `fastify-type-provider-zod`, `pino`, `@js-temporal/polyfill`
    - `devDependencies` : `typescript`, `tsx`, `vitest`, `@vitest/coverage-v8`, `@cucumber/cucumber`, `fast-check`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `eslint-plugin-functional`, `prettier`, `dependency-cruiser`, `pino-pretty`, `@types/node`, `@types/better-sqlite3`, `@types/ejs`

    Créer `.gitignore` excluant `node_modules/`, `.env`, `dist/`, `coverage/`, `*.sqlite`, `*.sqlite-journal`, `.pid`, `.DS_Store`, `.vscode/` sauf `settings.json`.

    Créer `.env.example` avec :
    - `SESSION_SECRET=` (commentaire : "32+ caractères, généré par `openssl rand -hex 32`")
    - `LOG_LEVEL=info`
    - `PORT=7878`
    - `HOST=127.0.0.1`

    Lancer `pnpm install` après création.
  </action>
  <verify>
    <automated>test -f .mise.toml &amp;&amp; test -f package.json &amp;&amp; test -f .gitignore &amp;&amp; test -f .env.example &amp;&amp; pnpm install --frozen-lockfile=false</automated>
  </verify>
  <acceptance_criteria>
    - `.mise.toml` contient une ligne matchant `node = "22"` (ou `node = '22'`).
    - `grep -c '"strict"' tsconfig.json` retourne 0 (le fichier n'existe pas encore, créé en Task 2).
    - `package.json` contient `"type": "module"` (assertion: `node -e 'process.exit(require("./package.json").type === "module" ? 0 : 1)'`).
    - `package.json` scripts includes `test:bdd` (assertion: `node -e 'process.exit(require("./package.json").scripts["test:bdd"] ? 0 : 1)'`).
    - `pnpm-lock.yaml` existe après `pnpm install`.
    - Aucun import depuis `node_modules` n'est tenté à ce stade (zero `src/` file).
  </acceptance_criteria>
  <done>Mise pinne Node 22/pnpm 9, `package.json` liste toutes les deps de la stack verrouillée, `pnpm install` termine en exit 0, lockfile commité.</done>
</task>

<task type="auto">
  <name>Task 2: Config TypeScript strict + Vitest + Cucumber</name>
  <files>tsconfig.json, vitest.config.ts, cucumber.json</files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Stack" + §"Folder Layout"
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §7 (Architecture de Validation)
    - BDD_PRACTICES.md §10 (Hygiène — suite unitaire ≤ 30 s)
  </read_first>
  <action>
    Créer `tsconfig.json` :
    - `compilerOptions.strict: true`, `strictNullChecks: true`, `noImplicitAny: true`, `noUncheckedIndexedAccess: true`
    - `target: "ES2022"`, `module: "ESNext"`, `moduleResolution: "Bundler"` (compatible tsx) ou `"NodeNext"` (préférer NodeNext + `module: "NodeNext"` pour Node 22 ESM natif)
    - `esModuleInterop: true`, `resolveJsonModule: true`, `isolatedModules: true`, `verbatimModuleSyntax: true`
    - `outDir`: pas nécessaire (run via tsx, pas de build D-25), mais `noEmit: true`
    - `lib: ["ES2023"]` (Temporal natif futur, polyfill pour Node 22)
    - `include`: `["src/**/*.ts", "tests/**/*.ts"]`, `exclude`: `["node_modules", "coverage", "dist"]`

    Créer `vitest.config.ts` (TypeScript) :
    - `test.include`: `["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"]`
    - `test.exclude`: `["tests/bdd/**", "node_modules", "dist", "coverage"]`
    - `test.coverage.provider: "v8"`, `test.coverage.reporter: ["text", "html"]`
    - `test.coverage.include`: `["src/**/*.ts"]`
    - `test.coverage.exclude`: `["src/main.ts", "src/web/views/**", "src/infrastructure/db/migrations/**"]`
    - `test.coverage.thresholds.lines: 80, functions: 80, branches: 70, statements: 80` (global)
    - `test.coverage.thresholds["src/domain/**"]`: `{ lines: 100, functions: 100, branches: 100, statements: 100 }` (gate domain 100%)
    - `test.testTimeout: 10000` (limite par test unitaire — gate <30s suite via watchdog)
    - Import `defineConfig` depuis `vitest/config`

    Créer `cucumber.json` (sous forme JSON config Cucumber) :
    - `default.paths: ["tests/bdd/features/**/*.feature"]`
    - `default.require: ["tests/bdd/step_definitions/**/*.ts"]`
    - `default.requireModule: ["tsx/cjs"]` ou loader ESM équivalent (vérifier doc cucumber-js pour ESM TS — préférer `loader: "tsx"` si supporté)
    - `default.format: ["progress-bar", "summary"]`
    - `default.parallel: 1` (déterminisme)
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm test -- --run --reporter=verbose &amp;&amp; pnpm test:bdd --dry-run</automated>
  </verify>
  <acceptance_criteria>
    - `tsconfig.json` contient `"strict": true` (assertion: `node -e 'const c=require("./tsconfig.json").compilerOptions; process.exit(c.strict===true?0:1)'`).
    - `vitest.config.ts` contient une string matchant `tests/bdd` dans une section `exclude` (assertion: `grep -q "tests/bdd" vitest.config.ts`).
    - `cucumber.json` contient `tests/bdd/features` (assertion: `grep -q "tests/bdd/features" cucumber.json`).
    - `pnpm typecheck` exits 0 (aucun fichier src/, donc aucune erreur).
    - `pnpm test -- --run` exits 0 avec 0 test trouvé (Vitest tolère absence de tests).
    - `pnpm test:bdd --dry-run` exits 0 avec 0 scenario trouvé.
  </acceptance_criteria>
  <done>TypeScript strict actif, Vitest configuré avec coverage v8 + threshold 100% sur `src/domain/**`, Cucumber configuré et exécutable en dry-run.</done>
</task>

<task type="auto">
  <name>Task 3: Lint + Format + Architecture boundary (dependency-cruiser)</name>
  <files>eslint.config.js, .prettierrc, .dependency-cruiser.cjs</files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Stack" + §"CI Gates"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-21, D-22, DV-03
    - DDD.md §5 (Architecture hexagonale — règles non négociables 1-4)
    - SOFTWARE_CRAFTSMANSHIP.md §8 (mesures de qualité — bloquantes)
  </read_first>
  <action>
    Créer `eslint.config.js` (flat config ESM) :
    - Import `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`, `eslint-plugin-import`, `eslint-plugin-functional`
    - Config objet ciblant `src/**/*.ts` et `tests/**/*.ts`
    - `languageOptions.parser` = typescript-eslint, `parserOptions.project` = `./tsconfig.json`
    - Active rules :
      - `@typescript-eslint/no-explicit-any: error`
      - `@typescript-eslint/explicit-function-return-type: error` (sur fonctions exportées)
      - `@typescript-eslint/no-unused-vars: error`
      - `import/no-unresolved: error`
      - `import/order: warn` (groupes : builtin, external, internal, parent, sibling, index)
      - `functional/no-let: warn` (sur `src/domain/**` uniquement via override — VOs immuables)
      - `functional/immutable-data: warn` (sur `src/domain/**` uniquement)
    - **Override `src/domain/**`** : interdire imports de `fastify`, `kysely`, `better-sqlite3`, `pino`, tout module sous `src/infrastructure/`, `src/web/`, `src/application/` via `no-restricted-imports`.
    - Override `tests/**` : assouplir `explicit-function-return-type` (off).

    Créer `.prettierrc` (JSON) : `singleQuote: true`, `semi: true`, `trailingComma: "all"`, `printWidth: 100`, `tabWidth: 2`, `useTabs: false`.

    Créer `.dependency-cruiser.cjs` :
    - Règle `no-domain-to-infra` : `from.path: "^src/domain"` → `to.path: "^src/(infrastructure|web|application)"` = `severity: "error"`.
    - Règle `no-domain-to-external` : `from.path: "^src/domain"` → `to.path: "^node_modules"` avec whitelist `["@js-temporal/polyfill"]` (Temporal autorisé), tout autre external = error.
    - Règle `no-application-to-web` : `from.path: "^src/application"` → `to.path: "^src/web"` = `severity: "error"`.
    - Règle `no-circular` : `severity: "error"`.
    - `options.tsConfig: "./tsconfig.json"`, `options.tsPreCompilationDeps: true`.
    - `options.includeOnly: "^src"`.
  </action>
  <verify>
    <automated>pnpm lint &amp;&amp; pnpm lint:deps</automated>
  </verify>
  <acceptance_criteria>
    - `eslint.config.js` contient `no-restricted-imports` (assertion: `grep -q "no-restricted-imports" eslint.config.js`).
    - `.dependency-cruiser.cjs` contient `no-domain-to-infra` (assertion: `grep -q "no-domain-to-infra" .dependency-cruiser.cjs`).
    - `pnpm lint` exits 0 (aucun src/, rien à linter).
    - `pnpm lint:deps` exits 0 (aucun src/, rien à analyser).
    - `.prettierrc` est valide JSON (assertion: `node -e 'JSON.parse(require("fs").readFileSync(".prettierrc","utf8"))'`).
  </acceptance_criteria>
  <done>ESLint flat config active + plugins DDD, Prettier configuré, dependency-cruiser pose la barrière hexagonale `domain → !infra/!web/!application`, tous les gates CI sont exécutables (et passent sur projet vide).</done>
</task>

</tasks>

<verification>
- `pnpm install` exits 0
- `pnpm typecheck` exits 0
- `pnpm test -- --run` exits 0 (0 tests)
- `pnpm test:bdd --dry-run` exits 0 (0 scenarios)
- `pnpm lint` exits 0
- `pnpm lint:deps` exits 0
- Tous les fichiers de config racine listés dans `files_modified` existent
- `.mise.toml` pin Node 22 ET pnpm 9
- `tsconfig.json` a `strict: true`
- `eslint.config.js` a une override `src/domain/**` avec `no-restricted-imports`
- `.dependency-cruiser.cjs` a une règle bloquant `src/domain → src/infrastructure|src/web|src/application`
</verification>

<success_criteria>
La fondation outillage du projet est en place. Les 6 plans suivants peuvent écrire du code TypeScript, exécuter Vitest, exécuter Cucumber, vérifier le lint et la barrière hexagonale sans avoir à reconfigurer quoi que ce soit. **Aucune ligne de code métier n'a été écrite** — c'est le but : ce plan n'est PAS un slice MVP, c'est son socle. Plan 02 (Walking Skeleton) délivre la première interaction utilisateur.
</success_criteria>

<output>
Créer `.planning/phases/01-activation-bien-locataire-bail/01-01-project-init-SUMMARY.md` à la complétion. Lister :
- Versions exactes de Node et pnpm posées par Mise
- Versions des deps clés (Fastify, Kysely, Vitest, Cucumber)
- Confirmation que les 6 commandes `pnpm install|typecheck|test|test:bdd|lint|lint:deps` exitent 0
</output>

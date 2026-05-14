---
phase: 01-activation-bien-locataire-bail
plan: "01"
subsystem: tooling
tags: [scaffolding, typescript, node, pnpm, vitest, cucumber, eslint, prettier, dependency-cruiser, mise]
dependency_graph:
  requires: []
  provides:
    - build-toolchain
    - test-runner-unit
    - test-runner-bdd
    - lint-flat-config
    - architecture-boundary-enforcement
  affects:
    - all subsequent plans (02-07) depend on this foundation
tech_stack:
  added:
    - Node.js 22 LTS (via Mise pin)
    - pnpm 9 (package manager)
    - TypeScript 5.9.3 (strict mode, NodeNext)
    - Vitest 3.2.4 (unit + integration tests, coverage v8)
    - "@cucumber/cucumber 11.3.0 (BDD Gherkin)"
    - ESLint 9.39.4 (flat config + @typescript-eslint + import + functional)
    - Prettier 3.8.3
    - dependency-cruiser 16.10.4 (hexagonal boundary enforcement)
    - tsx 4.21.0 (TypeScript runner, no build step)
    - Fastify 5.8.5 (HTTP framework — dep installée, utilisée Plan 02)
    - Kysely 0.28.17 (query builder — dep installée, utilisée Plan 02)
    - better-sqlite3 11.10.0 (SQLite driver — dep installée, utilisée Plan 02)
    - Zod 3.25.76 (validation — dep installée, utilisée Plan 02)
    - "@js-temporal/polyfill 0.5.1 (Temporal API)"
  patterns:
    - Flat ESLint config (ESLint 9 style)
    - Hexagonal boundary via dependency-cruiser rules
    - BDD outside-in via Cucumber + requireModule tsx/esm
    - passWithNoTests:true (Vitest tolerates zero test files at init)
key_files:
  created:
    - gestion-locative/.mise.toml
    - gestion-locative/.env.example
    - gestion-locative/.gitignore
    - gestion-locative/package.json
    - gestion-locative/pnpm-lock.yaml
    - gestion-locative/tsconfig.json
    - gestion-locative/vitest.config.ts
    - gestion-locative/cucumber.json
    - gestion-locative/eslint.config.js
    - gestion-locative/.prettierrc
    - gestion-locative/.dependency-cruiser.cjs
    - gestion-locative/src/types.ts
  modified: []
decisions:
  - "Loader tsx/esm via requireModule (pas loader field) — Node 20 déprécie --loader, Node 22 le supprime"
  - "passWithNoTests: true dans Vitest — projet greenfield sans tests au plan 01"
  - "eslint --no-error-on-unmatched-pattern — tests/ vide avant plan 02"
  - "src/types.ts stub minimal — tsc requiert au moins 1 fichier src pour ne pas lever TS18003"
metrics:
  duration: "6 minutes"
  completed_date: "2026-05-14"
  tasks_completed: 3
  tasks_total: 3
  files_created: 12
  files_modified: 0
---

# Phase 01 Plan 01: Project Init Summary

**One-liner:** Socle outillage TypeScript strict (Node 22, pnpm 9, Vitest 3, Cucumber 11, ESLint flat, Prettier, dependency-cruiser) avec barrière hexagonale `domain → ∅ infrastructure/web/application`.

## Versions Runtime

| Outil | Version | Pin |
|-------|---------|-----|
| Node.js | 22 LTS | `.mise.toml` |
| pnpm | 9.15.9 (installé) | `.mise.toml` pin 9 |
| TypeScript | 5.9.3 | devDep |

## Versions Dépendances Clés

| Package | Version installée |
|---------|------------------|
| fastify | 5.8.5 |
| kysely | 0.28.17 |
| better-sqlite3 | 11.10.0 |
| zod | 3.25.76 |
| vitest | 3.2.4 |
| @vitest/coverage-v8 | 3.2.4 |
| @cucumber/cucumber | 11.3.0 |
| tsx | 4.21.0 |
| eslint | 9.39.4 |
| @typescript-eslint/parser | 8.59.3 |
| prettier | 3.8.3 |
| dependency-cruiser | 16.10.4 |
| @js-temporal/polyfill | 0.5.1 |

## Confirmation Gates CI

| Commande | Résultat |
|----------|---------|
| `pnpm install` | exit 0 — lockfile généré |
| `pnpm typecheck` | exit 0 — 0 erreurs TypeScript |
| `pnpm test -- --run` | exit 0 — 0 tests (passWithNoTests) |
| `pnpm test:bdd --dry-run` | exit 0 — 0 scenarios |
| `pnpm lint` | exit 0 — 0 violations ESLint |
| `pnpm lint:deps` | exit 0 — 1 module, 0 violations |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 — Pin Mise + package.json | cb91a9f | chore(01-01): pin runtime Mise + package.json racine + lockfile |
| Task 2 — TypeScript + Vitest + Cucumber | be1c6f8 | chore(01-01): config TypeScript strict + Vitest + Cucumber |
| Task 3 — Lint + Prettier + depcruise | 7ef2a59 | chore(01-01): lint flat config + Prettier + dependency-cruiser boundary |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocage] tsx loader déprécié en Node 20**
- **Found during:** Task 2 (Cucumber dry-run)
- **Issue:** `loader: ["tsx"]` dans `cucumber.json` lève une erreur fatale en Node 20 (`tsx must be loaded with --import instead of --loader`). En Node 22 (cible Mise), ce comportement est différent — mais la CI locale tourne sur Node 20.
- **Fix:** Remplacé par `requireModule: ["tsx/esm"]` + `import: [...]` (compatible Node 20 + 22 via ESM natif Cucumber 11).
- **Files modified:** `cucumber.json`
- **Commit:** be1c6f8

**2. [Rule 2 - Fonctionnalité manquante] Vitest exit 1 sans fichiers tests**
- **Found during:** Task 2 (pnpm test)
- **Issue:** Vitest 3.x retourne exit code 1 quand aucun fichier test n'est trouvé — le plan attendait exit 0 sur projet vide.
- **Fix:** Ajout de `passWithNoTests: true` dans `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Commit:** be1c6f8

**3. [Rule 3 - Blocage] tsc TS18003 sans fichiers source**
- **Found during:** Task 2 (pnpm typecheck)
- **Issue:** `tsc --noEmit` échoue avec `TS18003 No inputs were found` quand `src/` ne contient que `.gitkeep`.
- **Fix:** Création de `src/types.ts` stub minimal (`export {};`) pour satisfaire le pattern `include: ["src/**/*.ts"]`. Ce fichier sera remplacé par les modules du plan 02.
- **Files modified:** `src/types.ts` (nouveau)
- **Commit:** be1c6f8

**4. [Rule 3 - Blocage] ESLint "no files matching tests" sur répertoire vide**
- **Found during:** Task 3 (pnpm lint)
- **Issue:** `eslint src tests` retourne exit 2 si `tests/` n'a pas de fichiers `.ts`.
- **Fix:** Ajout de `--no-error-on-unmatched-pattern` dans le script `lint` de `package.json`.
- **Files modified:** `package.json`
- **Commit:** 7ef2a59

## Known Stubs

- `src/types.ts` — Fichier stub minimal créé pour satisfaire tsc. Sera remplacé par les vrais modules domaine au Plan 02. Contenu : `export {};` uniquement.

## Threat Flags

Aucune nouvelle surface réseau, auth, ou accès fichier n'est introduite dans ce plan (configuration pure).

## Self-Check: PASSED

Fichiers vérifiés :
- FOUND: gestion-locative/.mise.toml
- FOUND: gestion-locative/package.json
- FOUND: gestion-locative/.gitignore
- FOUND: gestion-locative/.env.example
- FOUND: gestion-locative/pnpm-lock.yaml
- FOUND: gestion-locative/tsconfig.json
- FOUND: gestion-locative/vitest.config.ts
- FOUND: gestion-locative/cucumber.json
- FOUND: gestion-locative/eslint.config.js
- FOUND: gestion-locative/.prettierrc
- FOUND: gestion-locative/.dependency-cruiser.cjs

Commits vérifiés :
- cb91a9f (Task 1)
- be1c6f8 (Task 2)
- 7ef2a59 (Task 3)

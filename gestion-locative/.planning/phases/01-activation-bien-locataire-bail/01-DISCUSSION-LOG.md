# Phase 1: Activation — Bien, Locataire, Bail - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `01-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-13
**Phase:** 1-activation-bien-locataire-bail
**Areas discussed:** Forme app & OS cible, Stack technique, Périmètre entités V1, Workflow d'activation & navigation

---

## Forme app & OS cible

### Q1 — Forme principale de l'application

| Option | Description | Selected |
|--------|-------------|----------|
| Desktop natif (SwiftUI macOS) | Look-and-feel parfait, perf max, lock macOS | |
| Desktop multi-OS (Tauri ou Electron) | Tauri Rust+webview ou Electron Node+Chromium | |
| Web local (serveur localhost + navigateur) | Multi-OS, dev rapide, audit-friendly | ✓ |
| CLI + UI plus tard | Domaine vite testé en BDD, UI repoussée | |

**User's choice:** Web local — précision explicite "multi-OS (ex: macos, windows, linux)".
**Notes:** Détermine le reste — backend Node + browser front, SQLite à côté.

### Q2 — Rendu UI (SSR / SPA / HTMX)

| Option | Description | Selected |
|--------|-------------|----------|
| SSR (server-rendered HTML) | Simple, audit-friendly, parfait pour CRUD admin | ✓ |
| SPA (React/Vue/Svelte) + API JSON | UI très fluide mais sur-équipement local-first | |
| Hybride HTMX + SSR | SSR + interactivité fragmentaire | |

**User's choice:** SSR pur (après échange clarifiant la sobriété sur l'app sans interactivité riche).
**Notes:** Roadmap = CRUD + dashboard sobre. Pas de drag-drop, pas de temps-réel, pas d'animation. SPA = over-engineering. HTMX écarté par l'utilisateur (a hésité entre 1 et 2, a confirmé 1).

### Q3 — Lancement quotidien

| Option | Description | Selected |
|--------|-------------|----------|
| Commande terminal explicite | `gestion-locative serve` puis ouvrir browser | ✓ |
| App installée (double-clic) + auto-launch navigateur | Packaging signé multi-OS, DMG/MSI/AppImage | |
| Service permanent + raccourci navigateur | Auto-launch au login, accessible toujours | |

**User's choice:** Commande terminal explicite (option 1).
**Notes:** YAGNI strict V1, user = dev = user. Packaging installé reporté V1.1+.

### Q4 — Emplacement DB SQLite

| Option | Description | Selected |
|--------|-------------|----------|
| Dossier OS-conventional (caché) | `~/Library/Application Support/`, `%APPDATA%`, `~/.local/share/` | ✓ |
| User-chosen au premier lancement | Question explicite au boot, peut pointer iCloud/Drive | |
| Configurable par flag + default OS-conventional | `--db-path` override, sinon default | |

**User's choice:** Dossier OS-conventional (option A).
**Notes:** Chemin affiché au premier lancement. Backup = copie manuelle du `.sqlite`.

### Q5 — Binding réseau

| Option | Description | Selected |
|--------|-------------|----------|
| 127.0.0.1 strictement (loopback) | Machine-only, aucune auth, mono-user | ✓ |
| 0.0.0.0 (toutes interfaces) sans auth | DANGER, accessible WiFi sans auth | |
| 0.0.0.0 + auth obligatoire (passcode) | Accès depuis téléphone/tablette LAN | |

**User's choice:** 127.0.0.1 strictement.
**Notes:** Aligné mono-user / local-first. Pas d'auth requise V1.

### Q6 — Lifecycle port (déjà lancé ?)

| Option | Description | Selected |
|--------|-------------|----------|
| Port fixe + détection "déjà lancé" | Lockfile/pidfile ou check HTTP au boot | ✓ |
| Port auto-trouvé à chaque lancement | Random port libre — risque DB locked | |
| Port fixe + crash si pris | Brute, UX peu friendly | |

**User's choice:** Port fixe + détection.
**Notes:** Évite double-lock SQLite. Message clair "déjà lancé, ouvre http://localhost:XXXX".

---

## Stack technique

### Q1 — Langage / framework SSR

| Option | Description | Selected |
|--------|-------------|----------|
| Python + FastAPI/Starlette + Jinja2 | Écosystème fiscal mature, WeasyPrint, pytest-bdd | |
| TypeScript / Node + Hono/Fastify + EJS | Modernité, typage strict, DX | ✓ |
| Rust + Axum + Askama/Tera | Perf max, mono-binaire, mais vélocité dev lente | |
| Go + chi/echo + html/template | Simple, single-binary, mais typage moins riche | |

**User's choice:** TypeScript / Node + Hono/Fastify + EJS.

### Q2 — Runtime TS

| Option | Description | Selected |
|--------|-------------|----------|
| Node.js (LTS 22+) | Standard, mature, écosystème total | ✓ |
| Bun (1.x+) | Moderne tout-en-un, TS natif | |
| Deno (2.x) | Permissions explicites, deno compile | |

**User's choice:** Node.js LTS 22+.

### Q3 — Hono / Fastify / Express

| Option | Description | Selected |
|--------|-------------|----------|
| Fastify (mature, plugins riches) | `@fastify/view`, CSRF, formbody natifs | ✓ |
| Hono (léger, DX moderne) | ~12 ko, modern API | |
| Express (omni-présent) | Standard historique, démodé | |

**User's choice:** Fastify.

### Q4 — Persistance SQLite

| Option | Description | Selected |
|--------|-------------|----------|
| better-sqlite3 + Kysely (type-safe query builder) | Adapter pur, types end-to-end, DDD-clean | ✓ |
| better-sqlite3 + Drizzle ORM | ORM moderne types-first | |
| better-sqlite3 + SQL brut + repository pattern | Max contrôle, vérbose | |
| Prisma | Schema séparé, runtime engine, mauvais DDD | |

**User's choice:** Kysely (option 1) — après hésitation avec option 3 + Flyway. Flyway écarté (dépendance Java). Migrations SQL versionnées `migrations/000N_*.sql` exécutées par Kysely.

### Q5 — Tests + BDD

| Option | Description | Selected |
|--------|-------------|----------|
| Vitest + @cucumber/cucumber-js | Officiel BDD, 10+ ans, audit-friendly | ✓ |
| Vitest + vitest-cucumber (tout-en-un) | Single test infra | |
| Node test runner natif + @cucumber/cucumber-js | Zéro dep test runner | |

**User's choice:** Vitest + @cucumber/cucumber-js — choisi pour la pérennité 10 ans et l'onboarding potentiel d'un expert-comptable (Gherkin lisible).

### Q6 — Money / Decimal

| Option | Description | Selected |
|--------|-------------|----------|
| bigint en centimes + VO `Money` maison | Domain pur, 0 dépendance, aligné DDD.md §4.2 | ✓ |
| decimal.js + VO `Money` | Lib precision arbitraire | |
| dinero.js v2 | Money lib opinionated | |

**User's choice:** bigint + VO maison.

### Q7 — Date/Time

| Option | Description | Selected |
|--------|-------------|----------|
| Temporal API + `@js-temporal/polyfill` | Stage-3 ECMAScript, immutable, timezone-safe | ✓ |
| date-fns (mature, fonctionnel) | Date natif mutable | |
| Day.js (léger, Moment-like) | Moins type-safe | |

**User's choice:** Temporal API + polyfill.

### Q8 — Validation HTTP

| Option | Description | Selected |
|--------|-------------|----------|
| Zod | Standard TS, support Fastify natif | ✓ |
| Valibot | Plus jeune, tree-shakeable | |
| ArkType | Validation TS-as-syntax | |

**User's choice:** Zod.

### Q9 — PDF

| Option | Description | Selected |
|--------|-------------|----------|
| Puppeteer / Playwright | HTML→PDF, ~200 Mo Chromium | |
| pdfmake (déclaratif JSON pur JS) | ~1 Mo, idéal tabulaire | ✓ |
| @react-pdf/renderer | Composants React-like, ~700 ko | |
| Reporter à Phase 2 discuss | — | |

**User's choice:** pdfmake — après tradeoffs (audit-friendly = sortie déterministe, alignement local-first sans Chromium 200 Mo).

### Q10 — CSS

| Option | Description | Selected |
|--------|-------------|----------|
| Pico.css (classless, semantic) | ~10 ko, dark mode natif, zéro CSS V1 | ✓ |
| Tailwind CSS (utility-first) | Contrôle total, build step | |
| Vanilla CSS + design system maison | Max contrôle, lent V1 | |
| Open Props + classless surcharge | Variables CSS modernes | |

**User's choice:** Pico.css V1. Tailwind à réévaluer Phase 7 si Pico insuffisant pour dashboard (les deux peuvent cohabiter sans refacto majeur si Tailwind est scopé au dashboard sans `@tailwind base`).

### Q11 — Linter + Formatter

| Option | Description | Selected |
|--------|-------------|----------|
| Biome (single tool, rapide) | Rust, 1 outil, défauts TS strict | |
| ESLint (flat config) + Prettier | Plugins DDD critiques (`eslint-plugin-import`, etc.) | ✓ |
| Biome + ESLint complémentaire | Plus complexe | |

**User's choice:** ESLint + Prettier — l'utilisateur a explicitement préféré ESLint+Prettier après l'avoir reconnu plus aligné avec DDD strict (custom rules architecture + ubiquitous language français).

### Q12 — Package manager

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm | Strict (phantom deps interdites), rapide | ✓ |
| npm | Standard, plus permissif | |
| yarn (Berry v4) | PnP, peut casser libs natives | |
| Bun en package manager (Node runtime) | Bizarre double tool | |

**User's choice:** pnpm.

### Q13 — Logger

| Option | Description | Selected |
|--------|-------------|----------|
| pino + pino-pretty (dev) | JSON structuré, intégré Fastify | ✓ |
| Console natif minimal | Pas de niveaux | |
| Winston | Multi-transports, démodé | |

**User's choice:** pino + pino-pretty.

### Q14 — Property-based testing

| Option | Description | Selected |
|--------|-------------|----------|
| fast-check (standard TS) | Intégration Vitest fluide, BDD_PRACTICES §9 | ✓ |
| Pas de property-based en V1 | YAGNI plus strict | |

**User's choice:** fast-check.

### Q15 — Build / distribution V1

| Option | Description | Selected |
|--------|-------------|----------|
| Pas de build — `tsx` exécute le TS | YAGNI strict, V1 user=dev | ✓ |
| Build TypeScript → JS via tsup/esbuild | Demi-mesure | |
| Mono-binaire per-OS via `pkg` / Node SEA | Sur-équipement V1 | |

**User's choice:** `tsx` direct V1. Mono-binaire reporté V1.1+ avec packaging app installée.

### Q16 — Mise + workspaces + Turbo (question utilisateur)

L'utilisateur a évoqué `mise.toml` + pnpm workspaces + Turbo (reload partiel agnostique).

| Outil | Décision | Justification |
|---|---|---|
| Mise (`.mise.toml`) | ✅ Ajouter V1 | Audit-friendly, 10-year repro |
| pnpm workspaces | Différé à `plan-phase` | Décision structurelle |
| Turbo (Turborepo) | Deferred — réévaluer Phase 5 ou si tests > 90 s | Optim prématurée |

**User's choice:** Mise OUI, workspaces différé, Turbo reporté à une phase ultérieure (Phase 5 Fiscalité ou si tests > 90 s).

---

## Périmètre exact des entités V1

### Q1 — `Bien` V1 (PAT-01 strict ou scaffolding fiscal)

| Option | Description | Selected |
|--------|-------------|----------|
| Strict PAT-01 (YAGNI fort) | Pas de champ fiscal V1, ALTER en Phase 5 | ✓ |
| PAT-01 + scaffolding fiscal (champs présents non utilisés) | Pré-équipement Phase 5 | |
| PAT-01 + composants amortissables (structure V1 sans logique) | Structure fiscal V1, logique Phase 5 | |

**User's choice:** Strict PAT-01 (YAGNI fort).

### Q2 — `Lot` (obligatoire / facultatif, 1:1 ou 1:N avec Bail)

| Option | Description | Selected |
|--------|-------------|----------|
| Lot toujours obligatoire (1 appart = 1 Lot, 1 immeuble = N Lots) | Bail = 1+ Lots du même Bien | ✓ |
| Lot toujours obligatoire + Bail = 1 Lot strict V1 | Simplification V1, refacto V1.1 | |
| Lot facultatif (Bien peut être saisi sans Lot) | Anti-DDD | |

**User's choice:** Option 1 — Lot toujours obligatoire + Bail = 1 ou N Lots du même Bien. Après tradeoffs (coût V1 marginal vs coût migration plus tard).

### Q3 — Garant / Cautionnement (modélisation)

| Option | Description | Selected |
|--------|-------------|----------|
| VO embarqué dans `Locataire` (champs flat) | Simple V1 | |
| Agrégat `Garant` séparé, référencé par GarantId | Réutilisation entre baux | |
| Différer le garant à une phase postérieure | Violerait LOC-01 | |
| Garant **rattaché au Bail** (pas au Locataire) | Juridiquement correct, art. 22 loi 89 | ✓ |

**User's choice:** Option 4 — Cautionnement = VO sur agrégat `Bail`. L'utilisateur a demandé "suivre le juridique métier", après quoi l'analyse a confirmé que le cautionnement est juridiquement lié au bail, pas à la personne. Discussion méta sur les leçons DDD (vérifier le PRD contre les sources de droit avant de modéliser).

### Q4 — Pièces locataire V1

| Option | Description | Selected |
|--------|-------------|----------|
| Strict YAGNI — aucune pièce V1 | Phase 4 = coffre complet | ✓ |
| Champs textes ref pièces (sans fichier) | `piece_identite_type`, etc. | |
| Upload brut V1 (fichier stocké sans index) | Viole périmètre Phase 1 | |

**User's choice:** Option A — aucune pièce V1. Aligné LOCATION_MEUBLEE_REGLES.md §9.1 (numéro de CNI pas mentionné dans le bail).

### Q5 — PDF du Bail

| Option | Description | Selected |
|--------|-------------|----------|
| Pas de PDF V1 — saisie + persistance seulement | Strict KPI Activation | |
| PDF du bail dès V1 (brouillon non-signé) | Valeur immédiate | |
| PDF du bail reporté explicitement à une Phase 1.5 | Nouvelle phase dédiée artefacts légaux | ✓ |

**User's choice:** Phase 1.5 à créer. À insérer via `/gsd-phase` après ce discuss-phase.

### Q6 — Clause IRL V1

| Option | Description | Selected |
|--------|-------------|----------|
| VO `IRL` structuré + saisie manuelle V1 | DDD-clean, prêt pour Phase 3 | ✓ |
| Champ texte libre | Re-saisie ou parser Phase 3 | |
| Booléen "clause IRL active" sans valeur V1 | Info perdue à la signature | |

**User's choice:** Option 1 — VO `IRL { trimestre, valeur }` + saisie manuelle V1.

---

## Workflow d'activation & navigation

### Q1 — Parcours premier lancement

| Option | Description | Selected |
|--------|-------------|----------|
| Wizard guidé au premier lancement (Bien → Locataire → Bail) | Optimal KPI, plus jamais affiché après | ✓ |
| Écran d'accueil libre + CTAs forts | Plus de friction V1 | |
| Wizard guidé + CTAs libres en parallèle | Plus de surface | |
| CRUD pur (4 sections) sans onboarding | Ne valide pas KPI | |

**User's choice:** Wizard guidé 3 étapes.

### Q2 — Navigation post-wizard

L'utilisateur a interrompu pour ajouter de nouveaux documents (ACCESSIBILITY.md, UI_DESIGN.md, UX_DESIGN.md, BEHAVIOR.md) et a demandé une réévaluation. La question a été re-posée avec le contexte des nouveaux docs.

| Option | Description | Selected |
|--------|-------------|----------|
| Sidebar gauche fixe (Biens / Locataires / Baux) | Pattern admin Jakob, Miller-friendly, scale | ✓ |
| Top nav horizontale | Scale moins bien | |
| Single-page hierarchical (Biens → Lots → Baux nestés) | Anti-Jakob pour admin | |

**User's choice:** Sidebar gauche fixe + breadcrumbs sur chaque page.

### Q3 — Affichage listes

| Option | Description | Selected |
|--------|-------------|----------|
| Table HTML normative (admin classique) | Conforme UI_DESIGN.md + ACCESSIBILITY.md | ✓ |
| Cards (un bloc par item) | Plus aéré, scale mal >10 | |
| Hybride : table par défaut + toggle vers cards | Viole Hick's Law | |

**User's choice:** Table HTML normative.

### Q4 — Multi-bien V1

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, multi-bien dès V1 (CRUD complet) | Aligné PAT-01 success criteria | ✓ |
| Mono-bien V1 (1 seul Bien) | Viole PAT-01 partiellement | |
| Multi-bien V1 mais sans suppression | Viole PAT-01 strict | |

**User's choice:** Option 1 — Multi-bien V1, CRUD complet.

### Q5 — Empty states + statut du Bail

| Option | Description | Selected |
|--------|-------------|----------|
| Empty states via UX_DESIGN.md + Bail sans statut V1 (pure saisie) | YAGNI strict | ✓ |
| Bail avec statut explicite dès V1 (brouillon / signé) | Sur-spécification V1 | |
| Bail sans statut + dates lifecycle | Champs V1 non requis | |

**User's choice:** Empty states normatifs UX_DESIGN.md + Bail sans statut V1.

---

## Méta-discussion sur la UI modulaire

L'utilisateur a posé deux questions méta :

1. **« Pourquoi pas React pour avoir une UI modulaire ? »** — réponse : EJS partials fournissent la modularité (composants avec props). React = sur-équipement pour CRUD admin sober + audit-friendly. 4 niveaux d'encapsulation présentés (EJS, JSX-SSR, Astro, React+SSR). Recommandation Niveau 1 (EJS partials).
2. **Reprécision : « la UI devra être modulaire avec des composants réutilisables »** — 4 niveaux re-présentés. Recommandation forte Niveau 2 (Fastify + `@kitajs/html` JSX SSR pur typé) ou Niveau 3 (Astro). **User's choice:** "non on laisse comme ça" → on garde Niveau 1 (Fastify + EJS partials).

**Décision finale UI** : Fastify + EJS partials. Modularité = convention partial. À ré-évaluer Phase 7 si dashboard nécessite plus.

---

## Claude's Discretion

Décisions où l'utilisateur a laissé Claude trancher au planner / researcher :
- Nom exact du binaire CLI (`gestion-locative` / `gl` / autre — kebab-case).
- Port fixe par défaut (suggestion 7878).
- Routes Fastify exactes (`/biens`, `/biens/:id`, etc. — convention REST).
- Structure exacte de `src/` (cf. DP-02).

---

## Deferred Ideas

Capturées dans `01-CONTEXT.md` §Deferred Ideas (3 sous-sections : à ajouter dans ROADMAP — Phase 1.5 ; à reconsidérer en V1.1+ ; à reconsidérer dans phases ultérieures ; à trancher au plan-phase).

Sujets clés différés :
- **Phase 1.5 à créer** (PDF du bail + base annexes Phase 3).
- Packaging app installée DMG/MSI/AppImage.
- Authentification + accès LAN.
- Auto-launch navigateur.
- Mono-binaire per-OS.
- pnpm workspaces.
- Turbo (Phase 5 ou tests > 90 s).
- INSEE auto IRL (V1.1+).
- Composants amortissables Bien (Phase 5 ALTER).
- Pièces locataire (Phase 4 coffre).
- Tailwind réévaluation Phase 7.
- CLAUDE.md à mettre à jour pour référencer UI_DESIGN/UX_DESIGN/ACCESSIBILITY/BEHAVIOR (autorisation explicite reçue 2026-05-13).

---

## Notes d'ambiance

- Discussion menée en français, ubiquitous language français appliqué (`Bail`, `Locataire`, `Bien`, `Lot`, `Cautionnement`, `IRL`).
- ~45 questions AskUserQuestion + 4 clarifications méta sur ~3h de session.
- L'utilisateur a poussé la rigueur juridique sur Cautionnement (option 4 vs option 1) — illustration vivante du principe DDD "ubiquitous language vérifié contre sources de droit".
- L'utilisateur a fourni en cours de session 4 nouveaux docs (ACCESSIBILITY, UI_DESIGN, UX_DESIGN, BEHAVIOR) qui ont resserré les standards UI/UX/A11y appliqués à toute la UI V1.

---

*Discussion log captured: 2026-05-13*

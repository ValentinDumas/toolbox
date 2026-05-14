---
phase: 01
slug: activation-bien-locataire-bail
type: walking-skeleton
created: 2026-05-14
---

# Phase 1 — Walking Skeleton

> Le « squelette qui marche » : la tranche minimale **end-to-end** qui prouve que la stack et l'architecture fonctionnent.
> Ce document fige les décisions architecturales des phases suivantes — elles bâtissent sur ces choix sans les redébattre.

---

## Story Utilisateur Walking Skeleton

**As a** bailleur LMNP lançant l'application pour la première fois,
**I want to** ouvrir un navigateur sur `http://127.0.0.1:7878` et créer mon premier `Bien` avec un `Lot`,
**so that** je vois la donnée persister dans la liste après redémarrage de l'application.

---

## La Tranche Minimale (Plan `01-02`)

| Étape | Action utilisateur | Mécanisme technique | Critère de succès |
|-------|--------------------|--------------------|-------------------|
| 1 | `pnpm install` | pnpm résout les deps | Toutes deps installées, lockfile gelé |
| 2 | `pnpm db:migrate` | Kysely `FileMigrationProvider` exécute `0001_init.sql` | Fichier SQLite créé à `~/.local/share/gestion-locative/db.sqlite` (resp. `~/Library/Application Support/gestion-locative/` macOS, `%APPDATA%\gestion-locative\` Windows) |
| 3 | `pnpm dev` | `tsx src/main.ts` boot Fastify | Log `pino` JSON `{msg: "server listening on 127.0.0.1:7878"}` |
| 4 | Navigateur `/` | Route racine détecte `meta.wizard_complete = NULL` → 302 `/wizard/bien` | Premier affichage = wizard étape 1, jamais la liste vide |
| 5 | POST `/wizard/bien` (1 Bien + 1 Lot minimal) | Route handler → Zod parse → use case `CreerBien` → `BienRepository.enregistrer()` → INSERT SQLite | 302 → `/biens`, row visible dans `<tbody>` |
| 6 | BDD `tests/bdd/features/activation.feature` scenario "L'utilisateur crée un Bien avec un Lot" | Cucumber boot Fastify + temp SQLite + simule POST | `pnpm test:bdd` exits 0, scenario green |

---

## Décisions Architecturales Verrouillées

Ces décisions sont **immuables** pour les phases 2-7. Chaque phase ajoute, ne remplace pas.

### Stack (D-08 à D-27 + DP-01 à DP-06 résolus)

| Couche | Choix | Source |
|--------|-------|--------|
| Runtime | Node.js 22 LTS via Mise | D-09, D-27 |
| Langage | TypeScript strict | D-08 |
| Package manager | pnpm | D-23 |
| Framework HTTP | Fastify | D-10 |
| Templating | EJS via `@fastify/view` | D-11 |
| Persistance | better-sqlite3 + Kysely (query builder, pas ORM) | D-12 |
| Migrations | Kysely `FileMigrationProvider` + `migrations/NNNN_*.sql` | D-12 |
| Validation HTTP | Zod + `fastify-type-provider-zod` | D-18 |
| Sessions | `@fastify/session` + cookie httpOnly + secret 32+ chars (`.env.example`) | DP-05 |
| Tests unit/integ | Vitest 2.x + coverage v8 | D-13 |
| BDD Gherkin | `@cucumber/cucumber-js` | D-14 |
| Property-based | `fast-check` | D-15 |
| Money VO | `bigint` centimes maison (pas de dépendance) | D-16 |
| Date | Temporal API + `@js-temporal/polyfill` | D-17 |
| CSS | Pico.css classless (CDN ou copie locale) | D-20 |
| Logger | `pino` + `pino-pretty` (dev) | D-24 |
| Lint | ESLint flat config + plugins (`import`, `@typescript-eslint`, `functional`) | D-21 |
| Format | Prettier | D-21 |
| Architecture boundary | `dependency-cruiser` (CI gate) | D-22 |
| Build/run V1 | `tsx` direct, pas de build | D-25 |

### Folder Layout (résolu DP-02 → flat `src/`)

```
gestion-locative/
├── .mise.toml                  # Node 22.x + pnpm 9.x pin
├── .env.example                # SESSION_SECRET=<32+ chars>
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json               # strict: true
├── vitest.config.ts            # unit + integration globs
├── cucumber.json               # BDD config (features path, step_definitions)
├── eslint.config.js            # flat config
├── .prettierrc
├── .dependency-cruiser.cjs     # règle: domain → 0 import infra/web/application
├── src/
│   ├── domain/
│   │   ├── _shared/
│   │   │   ├── money.ts        # VO Money (bigint cents)
│   │   │   ├── irl.ts          # VO IRL (trimestre, valeur)
│   │   │   ├── adresse.ts      # VO Adresse
│   │   │   └── identifiants.ts # BienId, LocataireId, BailId, LotId (UUID v4 nominaux)
│   │   ├── patrimoine/
│   │   │   ├── bien.ts             # Entité racine Bien
│   │   │   ├── lot.ts              # Entité Lot (interne agrégat Bien)
│   │   │   └── bien-repository.ts  # Port (interface)
│   │   └── locatif/
│   │       ├── locataire.ts        # Entité Locataire
│   │       ├── bail.ts             # Entité Bail
│   │       ├── cautionnement.ts    # VO Cautionnement
│   │       ├── locataire-repository.ts
│   │       └── bail-repository.ts
│   ├── application/
│   │   ├── patrimoine/
│   │   │   ├── creer-bien.ts
│   │   │   ├── modifier-bien.ts
│   │   │   ├── supprimer-bien.ts
│   │   │   ├── lister-biens.ts
│   │   │   └── ajouter-lot.ts
│   │   └── locatif/
│   │       ├── creer-locataire.ts
│   │       ├── modifier-locataire.ts
│   │       ├── supprimer-locataire.ts
│   │       ├── lister-locataires.ts
│   │       ├── creer-bail.ts
│   │       ├── modifier-bail.ts
│   │       ├── supprimer-bail.ts
│   │       └── lister-baux.ts
│   ├── infrastructure/
│   │   ├── db/
│   │   │   ├── database.ts             # better-sqlite3 + Kysely + path OS
│   │   │   ├── kysely-types.ts         # types DB générés/manuels
│   │   │   └── migrations/
│   │   │       └── 0001_init.sql       # schéma initial Phase 1
│   │   ├── repositories/
│   │   │   ├── bien-repository-sqlite.ts
│   │   │   ├── locataire-repository-sqlite.ts
│   │   │   └── bail-repository-sqlite.ts
│   │   └── lifecycle/
│   │       ├── premier-lancement.ts    # meta table flag wizard_complete
│   │       └── pidfile.ts              # détection "déjà lancé" (D-07)
│   ├── web/
│   │   ├── routes/
│   │   │   ├── racine.ts               # GET / → 302 wizard ou /biens
│   │   │   ├── wizard.ts               # GET/POST /wizard/{bien,locataire,bail}
│   │   │   ├── biens.ts                # GET /biens, POST /biens, GET /biens/:id, etc.
│   │   │   ├── locataires.ts
│   │   │   └── baux.ts
│   │   ├── views/
│   │   │   ├── partials/
│   │   │   │   ├── layout.ejs
│   │   │   │   ├── wizard-layout.ejs
│   │   │   │   ├── form-field.ejs
│   │   │   │   ├── data-table.ejs
│   │   │   │   └── confirm-dialog.ejs
│   │   │   └── pages/
│   │   │       ├── wizard/{bien,locataire,bail}.ejs
│   │   │       ├── biens/{liste,formulaire,detail}.ejs
│   │   │       ├── locataires/{liste,formulaire,detail}.ejs
│   │   │       └── baux/{liste,formulaire,detail}.ejs
│   │   └── schemas/
│   │       ├── bien-schemas.ts         # Zod parse/format
│   │       ├── locataire-schemas.ts
│   │       └── bail-schemas.ts
│   ├── helpers/
│   │   └── format-date.ts              # Temporal.PlainDate → DD/MM/YYYY (EJS locals)
│   └── main.ts                          # bootstrap Fastify + DB + migrations + lifecycle
├── migrations/                          # racine, lue par Kysely FileMigrationProvider
│   └── 0001_init.sql                    # symlink ou copie depuis src/infrastructure/db/migrations
├── public/                              # servi par @fastify/static
│   └── styles/
│       └── pico.min.css                 # copie locale (pas de CDN en local-first)
└── tests/
    ├── unit/
    │   ├── _shared/
    │   │   ├── money.test.ts
    │   │   └── irl.test.ts
    │   ├── patrimoine/
    │   │   └── bien.test.ts
    │   └── locatif/
    │       ├── locataire.test.ts
    │       └── bail.test.ts
    ├── integration/
    │   └── repositories/
    │       ├── bien-repository-sqlite.test.ts
    │       ├── locataire-repository-sqlite.test.ts
    │       └── bail-repository-sqlite.test.ts
    └── bdd/
        ├── features/
        │   └── activation.feature
        └── step_definitions/
            └── activation.steps.ts
```

### Persistence Schema V1 (migration `0001_init.sql`)

Tables livrées en Phase 1 : `bien`, `lot`, `locataire`, `bail`, `bail_lots`, `meta`.

Conventions :
- **Soft-delete** (DP-01) : chaque table métier a `supprime_le DATETIME NULL`. Le repository filtre `WHERE supprime_le IS NULL` par défaut.
- **Money** (DP-03) : `INTEGER NOT NULL` (centimes). Jamais REAL. Conversion bigint↔number à la frontière infrastructure.
- **IRL** (DP-04) : 2 colonnes plates `irl_trimestre TEXT NOT NULL` (ex `"2026-T1"`) + `irl_valeur TEXT NOT NULL` (decimal as string preserving precision).
- **Date** : `TEXT NOT NULL` au format ISO 8601 PlainDate (`YYYY-MM-DD`).
- **Identifiants** : `TEXT PRIMARY KEY` (UUID v4 généré par le domaine via `crypto.randomUUID()`).
- **Cautionnement** : `cautionnement TEXT NULL` (JSON sérialisé du VO Phase 1 — table séparée différée).
- **First-launch** (DP-06) : table `meta(cle TEXT PRIMARY KEY, valeur TEXT NOT NULL)`. Flag `wizard_complete = '1'` posé après step 3.

Schéma SQL complet : voir `01-RESEARCH.md` §4.

### Routes Fastify (REST conventionnel)

| Méthode | Path | But | Plan |
|--------|------|-----|------|
| GET | `/` | Redirige selon premier lancement | 02 |
| GET | `/wizard/bien` | Étape 1 wizard | 06 |
| POST | `/wizard/bien` | Persiste Bien+Lots wizard | 06 |
| GET | `/wizard/locataire` | Étape 2 wizard | 06 |
| POST | `/wizard/locataire` | Persiste Locataire wizard | 06 |
| GET | `/wizard/bail` | Étape 3 wizard | 06 |
| POST | `/wizard/bail` | Persiste Bail wizard + flag wizard_complete | 06 |
| GET | `/biens` | Liste Biens | 02, 03 |
| GET | `/biens/nouveau` | Formulaire création | 03 |
| POST | `/biens` | Crée Bien | 02 (1 lot), 03 (N lots) |
| GET | `/biens/:id` | Détail Bien + ses Lots | 03 |
| GET | `/biens/:id/modifier` | Formulaire édition | 03 |
| POST | `/biens/:id/modifier` | Update Bien | 03 |
| POST | `/biens/:id/supprimer` | Soft-delete Bien | 03 |
| POST | `/biens/:id/lots` | Ajouter Lot | 03 |
| POST | `/biens/:id/lots/:lotId/supprimer` | Soft-delete Lot | 03 |
| GET | `/locataires` | Liste Locataires | 04 |
| GET | `/locataires/nouveau` | Formulaire création | 04 |
| POST | `/locataires` | Crée Locataire | 04 |
| GET | `/locataires/:id` | Détail Locataire | 04 |
| GET | `/locataires/:id/modifier` | Formulaire édition | 04 |
| POST | `/locataires/:id/modifier` | Update Locataire | 04 |
| POST | `/locataires/:id/supprimer` | Soft-delete | 04 |
| GET | `/baux` | Liste Baux | 05 |
| GET | `/baux/nouveau` | Formulaire création | 05 |
| POST | `/baux` | Crée Bail | 05 |
| GET | `/baux/:id` | Détail Bail | 05 |
| GET | `/baux/:id/modifier` | Formulaire édition | 05 |
| POST | `/baux/:id/modifier` | Update Bail | 05 |
| POST | `/baux/:id/supprimer` | Soft-delete | 05 |

### Scripts pnpm (D-26)

| Script | Commande | But |
|--------|----------|-----|
| `dev` | `tsx watch src/main.ts` | Run + reload |
| `start` | `tsx src/main.ts` | Run prod-like local |
| `db:migrate` | `tsx src/infrastructure/db/database.ts migrate` | Applique migrations |
| `typecheck` | `tsc --noEmit` | Vérifie types |
| `test` | `vitest run` | Tests unit + integration |
| `test:watch` | `vitest` | Watch mode |
| `test:bdd` | `cucumber-js` | Scénarios Gherkin |
| `test:cov` | `vitest run --coverage` | Couverture v8 |
| `lint` | `eslint src tests` | Lint |
| `lint:deps` | `depcruise src` | Dependency-cruiser CI gate |
| `format` | `prettier --write .` | Formatte |

### CI Gates (extraits SOFTWARE_CRAFTSMANSHIP.md §8 — bloquants en V1)

| Gate | Seuil | Outil |
|------|-------|-------|
| TypeScript warnings | 0 | `tsc --noEmit` |
| Couverture globale | ≥ 80 % | `vitest --coverage` |
| Couverture `src/domain/**` | 100 % | `vitest --coverage` |
| Suite unitaire | < 30 s | `vitest run` |
| Boundaries hexagonales | `domain/` → 0 import `infrastructure/`, `web/`, `application/` | `depcruise` |
| Lint warnings | 0 | `eslint` |

---

## Ce que la Phase 1 ne livre PAS (à mémoriser pour ne pas dériver)

- Pas de PDF du bail (Phase 1.5)
- Pas de diagnostics / EDL / IRL active (Phase 3)
- Pas de quittancement (Phase 2)
- Pas de coffre documentaire / pièces locataire (Phase 4)
- Pas de fiscalité (Phase 5)
- Pas de dashboard / notifications (Phase 7)
- Pas de packaging app installée (V1.1+)
- Pas d'auth / chiffrement DB (V1.1+)
- Pas de mobile / responsive sub-640px en priorité (V1.1+)
- Pas d'intégration INSEE auto IRL (V1.1+)

Toute pression à scope-creep vers ces sujets en Phase 1 = **REFUSER** et noter dans `STATE.md > Deferred Items`.

---

## Source

- `.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md` — décisions verrouillées
- `.planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md` §1–§7 — stack, schema, validation
- `.planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md` — contrat UI
- `DDD.md` §3–§5 — bounded contexts, agrégats, ports & adapters
- `BDD_PRACTICES.md` §3, §10 — pyramide, hygiène
- `SOFTWARE_CRAFTSMANSHIP.md` §8 — gates CI

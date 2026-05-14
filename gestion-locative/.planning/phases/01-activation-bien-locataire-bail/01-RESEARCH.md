# Phase 1 — Research

**Recherché :** 2026-05-14
**Domaine :** Scaffolding Node/TypeScript + activation CRUD Bien/Lot/Locataire/Bail (DDD hexagonal, SQLite)
**Confiance globale :** HIGH (CONTEXT.md verrouille 95 % du stack — la recherche confirme et complète)

**Objectif :** fournir au planner les éléments techniques manquants pour produire un plan Walking Skeleton + activation flow.

---

<user_constraints>
## Contraintes utilisateur (depuis CONTEXT.md)

### Décisions verrouillées

- **DV-01** LMNP meublé longue durée uniquement (étudiant/mobilité → V2).
- **DV-02** Local-first, mono-user, SQLite.
- **DV-03** DDD hexagonal strict — domaine pur, ports & adapters, 0 import technique dans `domain/`.
- **DV-04** Ubiquitous language français dans le code.
- **DV-05** BDD outside-in (scénario rouge → TDD interne → scénario vert). 100 % couverture logique métier.
- **DV-06** MVP vertical slice — domaine + adapters + UI livrés ensemble.
- **DV-07** 6 bounded contexts ; Phase 1 = Patrimoine + Locatif uniquement.
- **D-01→D-27** Stack complète verrouillée : TypeScript strict, Node 22 LTS, Fastify, EJS, better-sqlite3 + Kysely, Vitest, @cucumber/cucumber-js, fast-check, bigint Money, Temporal+polyfill, Zod, Pico.css, ESLint flat, Prettier, dependency-cruiser, pnpm, pino, tsx, Mise.

### Périmètre Phase 1

Créer en session unique : 1 Bien ≥ 1 Lot + 1 Locataire + 1 Bail → persistés en SQLite → visibles en liste.
Strictement hors scope : diagnostics, EDL, IRL active, quittances, fiscalité, PDF bail, coffre documentaire.

### Décisions différées au planner (DP-01 à DP-06)

- DP-01 : hard-delete vs soft-delete.
- DP-02 : pnpm workspaces vs flat `src/`.
- DP-03 : sérialisation `Money` (INTEGER cents recommandé).
- DP-04 : sérialisation `IRL` (colonnes plates recommandées).
- DP-05 : stratégie session wizard.
- DP-06 : détection premier lancement.

### Discrétions Claude

Nom du binaire CLI, port par défaut, routes Fastify exactes, structure exacte `src/`.
</user_constraints>

---

<phase_requirements>
## Exigences Phase 1

| ID | Description | Support recherche |
|----|-------------|-------------------|
| PAT-01 | CRUD `Bien` (adresse, surface, type, année construction) | Sections 2, 3, 4 |
| PAT-02 | Gestion `Lot`s dans un `Bien` (≥1, types distincts) | Sections 2, 4 |
| LOC-01 | Fiche `Locataire` (identité, contact — pièces YAGNI V1) | Sections 2, 4 |
| LOC-02 | `Bail` meublé classique (durée ≥12 mois, loyer HC, charges, dépôt ≤ 2×HC, IRL ref) | Sections 2, 4, 6 |
</phase_requirements>

---

## 1. Stack Recommendation

Entièrement verrouillée par CONTEXT.md. Résumé consolidé pour le planner :

| Couche | Choix | Décision |
|--------|-------|----------|
| Langage | TypeScript strict | D-08 |
| Runtime | Node.js 22 LTS (Mise `.mise.toml`) | D-09, D-27 |
| Framework HTTP | Fastify + plugins `@fastify/view`, `@fastify/formbody`, `@fastify/static`, `@fastify/session`, `@fastify/csrf-protection` | D-10 |
| Templating | EJS via `@fastify/view` | D-11 |
| SQLite driver | better-sqlite3 (sync, idéal SSR Fastify) | D-12 |
| Query builder | Kysely (type-safe, sans fuite ORM dans le domaine) | D-12 |
| Migrations | fichiers `migrations/NNNN_*.sql` exécutés au boot via Kysely `FileMigrationProvider` | D-12 |
| Tests unit/integ | Vitest + coverage v8 | D-13 |
| BDD Gherkin | @cucumber/cucumber-js | D-14 |
| Property-based | fast-check (couplé Vitest) | D-15 |
| Money | VO `Money` maison, bigint centimes | D-16 |
| Date | Temporal API + `@js-temporal/polyfill` | D-17 |
| Validation HTTP | Zod + `fastify-type-provider-zod` | D-18 |
| CSS | Pico.css (classless) | D-20 |
| Package manager | pnpm | D-23 |

**Alternatives écartées (déjà tranchées) :** React/SPA/HTMX (D-03), Prisma/Drizzle ORM (D-12 interdit), Puppeteer (D-19), Tailwind V1 (D-20), Turbo (deferred Phase 5+).

**Décisions planner sur DP-02 :** recommande flat `src/` (pas de workspaces V1) — coût de config pnpm workspaces > bénéfice pour un seul package.

**Port par défaut :** 7878 (port libre, mémorable, loin des conflits 3000/8080).

**Nom binaire CLI :** `gestion-locative` (kebab-case, lisible dans les scripts pnpm).

---

## 2. Bounded Contexts & Agrégats

### Bounded contexts Phase 1

Deux contextes activés — Patrimoine et Locatif.

### Agrégat `Bien` (Patrimoine BC)

Racine : `Bien`. Composition : `Lot[]` (valeur agrégée, pas d'agrégat séparé — un `Lot` n'existe que dans un `Bien`, pas de référence directe externe).

**Invariants Phase 1 :**
1. Un `Bien` doit avoir ≥ 1 `Lot` au moment de la persistance (règle métier D-29).
2. `surface` > 0.
3. `type` ∈ `{appartement, maison, immeuble, local_commercial}`.

**Identité :** `BienId` (UUID v4).

### Agrégat `Locataire` (Locatif BC)

Racine : `Locataire`. VO embedded : `Adresse` (rue, code_postal, ville), `LieuNaissance` (commune, pays).

**Invariants Phase 1 :**
1. `nom` et `prenom` non vides.
2. `email` valide (RFC 5322 simplifié via Zod).
3. `date_naissance` est une `Temporal.PlainDate` dans le passé.

### Agrégat `Bail` (Locatif BC)

Racine : `Bail`. Liens : `locataire_id` (ref Locataire), `bien_id` (ref Bien), `lot_ids[]` (≥1, tous du même `bien_id`). VO embedded : `Money`, `IRL`, `Cautionnement?`.

**Invariants Phase 1 :**
1. `duree_mois` ≥ 12 (bail classique).
2. `depot_garantie` ≤ 2 × `loyer_hc` (art. 25-6 loi 89).
3. `lot_ids` non vide ET tous les lots appartiennent à `bien_id`.

> `Lot` n'est pas un agrégat séparé. Il est géré uniquement via son `Bien` racine. La table jointure `bail_lots` est gérée au niveau infrastructure — le domaine ne connaît que `lot_ids[]`.

---

## 3. Folder Layout (Ports & Adapters)

**Résolution DP-02 :** flat `src/` avec barrières `dependency-cruiser` + `eslint-plugin-import`.

```
src/
├── domain/
│   ├── patrimoine/
│   │   ├── bien.ts            # Entité Bien + Lot (embedded)
│   │   ├── bien-id.ts         # Value Object BienId
│   │   └── bien-repository.ts # Port (interface)
│   └── locatif/
│       ├── bail.ts            # Entité Bail
│       ├── locataire.ts       # Entité Locataire
│       ├── money.ts           # VO Money (bigint centimes)
│       ├── irl.ts             # VO IRL
│       └── bail-repository.ts # Port (interface)
├── application/
│   ├── creer-bien.ts          # Use case
│   ├── creer-locataire.ts
│   └── creer-bail.ts
├── infrastructure/
│   ├── db/
│   │   ├── database.ts        # Initialisation better-sqlite3 + Kysely
│   │   └── migrations/        # Fichiers 0001_init.sql, etc.
│   ├── repositories/
│   │   ├── bien-repository-sqlite.ts
│   │   ├── locataire-repository-sqlite.ts
│   │   └── bail-repository-sqlite.ts
│   └── lifecycle/             # pidfile, détection premier lancement
├── web/
│   ├── routes/                # Fastify route handlers (biens, locataires, baux, wizard)
│   ├── views/                 # Fichiers .ejs (pages + partials)
│   │   ├── partials/
│   │   └── pages/
│   └── schemas/               # Zod schemas HTTP (séparés du domaine)
└── main.ts                    # Bootstrap Fastify + DB + lifecycle
tests/
├── unit/                      # Vitest — agrégats, VOs
├── integration/               # Vitest — repos sur SQLite :memory:
└── bdd/
    ├── features/              # *.feature (Gherkin)
    └── step_definitions/      # *.steps.ts
```

**Règle dependency-cruiser :** `domain/` → aucune dépendance vers `infrastructure/`, `web/`, `application/`. Vérifiée au CI.

---

## 4. Persistence Schema (First Migration)

**Résolution DP-01 :** soft-delete via `supprime_le DATETIME NULL` — audit-friendly (cohérent avec le principe "ledger d'opérations").

**Résolution DP-03 :** `Money` → `INTEGER NOT NULL` (centimes en bigint). Jamais de REAL.

**Résolution DP-04 :** `IRL` → 2 colonnes plates `irl_trimestre TEXT` + `irl_valeur TEXT` (précision décimale exacte, lisible SQL).

**Outil de migration :** Kysely `FileMigrationProvider` (run au boot `main.ts`) — pas d'outil externe à installer.

```sql
-- migrations/0001_init.sql

CREATE TABLE bien (
  id           TEXT PRIMARY KEY,
  rue          TEXT NOT NULL,
  code_postal  TEXT NOT NULL,
  ville        TEXT NOT NULL,
  surface      REAL NOT NULL CHECK (surface > 0),
  type         TEXT NOT NULL CHECK (type IN ('appartement','maison','immeuble','local_commercial')),
  annee_construction INTEGER NOT NULL,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le  DATETIME NULL
);

CREATE TABLE lot (
  id           TEXT PRIMARY KEY,
  bien_id      TEXT NOT NULL REFERENCES bien(id),
  designation  TEXT NOT NULL,
  surface      REAL NULL,
  type         TEXT NOT NULL CHECK (type IN ('appartement','parking','cave','local_commercial','terrasse','autre')),
  etage        INTEGER NULL,
  cree_le      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le  DATETIME NULL
);

CREATE TABLE locataire (
  id               TEXT PRIMARY KEY,
  nom              TEXT NOT NULL,
  prenom           TEXT NOT NULL,
  date_naissance   TEXT NOT NULL,  -- ISO 8601 PlainDate
  commune_naissance TEXT NOT NULL,
  pays_naissance   TEXT NOT NULL,
  nationalite      TEXT NOT NULL,
  email            TEXT NOT NULL,
  telephone        TEXT NULL,
  rue              TEXT NOT NULL,
  code_postal      TEXT NOT NULL,
  ville            TEXT NOT NULL,
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le      DATETIME NULL
);

CREATE TABLE bail (
  id               TEXT PRIMARY KEY,
  locataire_id     TEXT NOT NULL REFERENCES locataire(id),
  bien_id          TEXT NOT NULL REFERENCES bien(id),
  type             TEXT NOT NULL DEFAULT 'classique',
  date_debut       TEXT NOT NULL,  -- ISO 8601 PlainDate
  duree_mois       INTEGER NOT NULL CHECK (duree_mois >= 12),
  loyer_hc         INTEGER NOT NULL CHECK (loyer_hc > 0),  -- centimes
  mode_charges     TEXT NOT NULL CHECK (mode_charges IN ('forfait','provisions')),
  montant_charges  INTEGER NOT NULL,  -- centimes
  depot_garantie   INTEGER NOT NULL,  -- centimes, ≤ 2 × loyer_hc (vérifié domaine)
  irl_trimestre    TEXT NOT NULL,
  irl_valeur       TEXT NOT NULL,
  cautionnement    TEXT NULL,         -- JSON sérialisé VO (simple, pas de table séparée V1)
  cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  supprime_le      DATETIME NULL
);

CREATE TABLE bail_lots (
  bail_id  TEXT NOT NULL REFERENCES bail(id),
  lot_id   TEXT NOT NULL REFERENCES lot(id),
  PRIMARY KEY (bail_id, lot_id)
);
```

---

## 5. Walking Skeleton Slice

La tranche minimale end-to-end pour valider que le scaffolding fonctionne :

**Séquence :** `pnpm start` → Fastify écoute 127.0.0.1:7878 → migration SQL run → GET `/biens` affiche empty state → POST `/biens` (formulaire Bien + 1 Lot) → redirect GET `/biens` → 1 ligne dans le tableau.

**Fichiers impliqués :**
- `src/main.ts` (bootstrap Fastify + Kysely + pidfile)
- `src/infrastructure/db/database.ts`
- `src/infrastructure/db/migrations/0001_init.sql`
- `src/web/routes/biens.ts` (GET `/biens`, POST `/biens`)
- `src/web/views/pages/biens-liste.ejs`
- `src/domain/patrimoine/bien.ts` + `bien-repository.ts`
- `src/infrastructure/repositories/bien-repository-sqlite.ts`

**1 scénario BDD :**
```
tests/bdd/features/activation.feature

Feature: Activation premier lancement

  Scenario: L'utilisateur crée un Bien avec un Lot lors du premier lancement
    Given l'application est lancée pour la première fois
    When le bailleur saisit le formulaire Bien : "12 rue des Lilas, 75020 Paris", 45m², appartement, 1985, avec 1 lot "Appartement principal"
    Then le Bien est visible dans la liste des biens
    And la liste affiche "12 rue des Lilas"
```

**1 test unitaire :**
```
tests/unit/patrimoine/bien.test.ts

test('bien_invalide_si_aucun_lot')
test('bien_invalide_si_surface_nulle')
```

**1 test d'intégration :**
```
tests/integration/repositories/bien-repository-sqlite.test.ts

test('persiste_et_retrouve_un_bien_avec_ses_lots')
// utilise better-sqlite3 :memory:
```

---

## 6. Bail Meublé Classique — Invariants Domaine Phase 1

Triés par priorité d'implémentation :

| Invariant | Obligatoire Phase 1 | Source légale | Statut |
|-----------|--------------------|----|--------|
| `duree_mois` ≥ 12 | **OUI — domaine** | Art. 25-4 + §3.1 LOCATION_MEUBLEE | Invariant agrégat `Bail` |
| `depot_garantie` ≤ 2 × `loyer_hc` | **OUI — domaine** | Art. 25-6 loi 89 §5 | Invariant agrégat `Bail` |
| `lot_ids` ≥ 1 + même `bien_id` | **OUI — domaine** | D-29, D-30 | Invariant agrégat `Bail` |
| `loyer_hc` > 0 | **OUI — domaine** | Logique métier | Invariant agrégat `Bail` |
| Mode charges = forfait ou provisions | **OUI — domaine** | §4.3 LOCATION_MEUBLEE | Enum TypeScript + contrainte SQL |
| VO `IRL` avec trimestre + valeur non vides | **OUI — domaine** | D-37 | Invariant VO `IRL` |
| Mobilier décret 2015-981 (12 éléments) | **NON — Phase 3** | §2 LOCATION_MEUBLEE | Déféré LOC-06 |
| Gel loyer DPE F/G | **NON — Phase 3** | LOC-05 | Déféré |
| Indexation IRL auto | **NON — Phase 3** | LOC-04 | Déféré |
| Durée 9 mois (bail étudiant) | **NON — V2** | §3.2 | Hors périmètre |
| Encadrement des loyers zone tendue | **NON — UI hint Phase 1.5+** | §4.1 | Trop contextuel V1 |

> La clause IRL en Phase 1 = saisie manuelle VO `IRL { trimestre, valeur }` sans validation de cohérence temporelle — l'utilisateur est responsable de la valeur (récupérée sur insee.fr).

---

## 7. Architecture de Validation (Nyquist)

### Framework de test

| Propriété | Valeur |
|-----------|--------|
| Framework unit/integ | Vitest 2.x |
| Config | `vitest.config.ts` à créer (Wave 0) |
| BDD | @cucumber/cucumber-js — `cucumber.json` |
| Commande rapide | `pnpm test -- --run` |
| Suite complète | `pnpm test && pnpm test:bdd` |

### Pyramide Phase 1

```
          /\
         /  \   BDD E2E (activation.feature — ~3 scénarios)
        /    \
       /------\
      /        \ Intégration (repos SQLite :memory: — ~6 tests)
     /----------\
    /            \ Unitaires (agrégats + VOs — ~15 tests)
   /______________\
```

### Mapping exigences → tests

| REQ | Comportement | Type | Fichier | Commande |
|-----|-------------|------|---------|---------|
| PAT-01 | Créer un Bien valide | unit | `tests/unit/patrimoine/bien.test.ts` | `pnpm test -- bien` |
| PAT-01 | Invariant surface > 0 | unit | idem | idem |
| PAT-02 | Bien requiert ≥1 Lot | unit | idem | idem |
| PAT-01 | Persist + retrieve Bien | integ | `tests/integration/repositories/bien-repository-sqlite.test.ts` | `pnpm test -- bien-repo` |
| LOC-01 | Créer un Locataire valide | unit | `tests/unit/locatif/locataire.test.ts` | `pnpm test -- locataire` |
| LOC-02 | Invariant dépôt ≤ 2×loyer | unit | `tests/unit/locatif/bail.test.ts` | `pnpm test -- bail` |
| LOC-02 | Invariant durée ≥ 12 mois | unit | idem | idem |
| LOC-02 | Persist Bail avec lots | integ | `tests/integration/repositories/bail-repository-sqlite.test.ts` | `pnpm test -- bail-repo` |
| Tous | Wizard activation complet | BDD E2E | `tests/bdd/features/activation.feature` | `pnpm test:bdd` |

### Wave 0 gaps (fichiers à créer avant implémentation)

- [ ] `vitest.config.ts` — inclure coverage v8, exclude `tests/bdd/`
- [ ] `cucumber.json` — world, step_definitions, features paths
- [ ] `tests/unit/patrimoine/bien.test.ts`
- [ ] `tests/unit/locatif/locataire.test.ts`
- [ ] `tests/unit/locatif/bail.test.ts`
- [ ] `tests/integration/repositories/bien-repository-sqlite.test.ts`
- [ ] `tests/bdd/features/activation.feature`
- [ ] `tests/bdd/step_definitions/activation.steps.ts`

### Gates CI

- Suite unitaire < 30 s (gate bloquant SOFTWARE_CRAFTSMANSHIP.md §8).
- Coverage ≥ 80 % global, 100 % sur `domain/` (invariants).
- 0 TypeScript warning (`tsc --noEmit`).

---

## 8. Pièges & Risques (Phase 1 uniquement)

1. **Couplage accidentel Bien↔Bail dans le routing Fastify.** Le handler POST `/baux` reçoit `bien_id` ET `lot_ids[]` — risque de valider la cohérence en route handler plutôt qu'en domaine. Toute validation cross-aggregate doit passer par le use case `creer-bail.ts`, jamais dans le handler.

2. **Sérialisation `bigint` → JSON.** Node.js ne sérialise pas nativement les `bigint` (`JSON.stringify` lève une exception). Le VO `Money` doit exposer une méthode `toJSON(): number` (en centimes) pour les réponses HTTP, et Zod doit coercer l'input string → bigint à l'entrée.

3. **Session wizard et détection premier lancement (DP-05 / DP-06).** Si le planner choisit un cookie session pour le wizard, `@fastify/session` requiert un `secret` (≥32 chars). Pour le premier lancement, la stratégie la plus simple : table `meta(cle TEXT PK, valeur TEXT)` avec une ligne `wizard_complete = '1'` après Step 3. Évite la dépendance à l'existence du fichier `.sqlite` qui existe dès le boot.

4. **Locale française sur les dates EJS.** `Temporal.PlainDate` n'est pas natif dans le moteur EJS — prévoir un helper `formatDate(plainDate)` injecté dans `locals` de chaque route, formatant en `DD/MM/YYYY`. Sans ça, l'UI affiche le format ISO brut.

5. **IRL math qui fuit en Phase 1.** Le VO `IRL` stocke trimestre + valeur de référence — c'est tout. Ne pas implémenter `calculerNouveauLoyer()` ni `estIndexable()` dans Phase 1 (ces méthodes n'ont pas de scénario BDD Phase 1 et violent YAGNI — elles appartiennent à Phase 3).

---

## Sources

- CONTEXT.md — décisions D-01 à D-50, DP-01 à DP-06 [VERIFIED: fichier lu en session]
- UI-SPEC.md — contrat UI, routes, patterns EJS [VERIFIED: fichier lu en session]
- REQUIREMENTS.md — PAT-01/02, LOC-01/02 [VERIFIED: fichier lu en session]
- DDD.md — bounded contexts, tactical patterns, ubiquitous language [VERIFIED: fichier lu en session]
- BDD_PRACTICES.md — pyramide, outside-in, gates CI [VERIFIED: fichier lu en session]
- LOCATION_MEUBLEE_REGLES.md — §3.1 bail classique, §4.3 charges, §5 dépôt de garantie [VERIFIED: fichier lu en session]

---

## Metadata

**Confiance par section :**
- Stack : HIGH — verrouillée par CONTEXT.md, confirmée par lecture directe.
- Bounded contexts / agrégats : HIGH — extraits directs DDD.md + CONTEXT.md D-28 à D-38.
- Schema SQL : HIGH — colonnes issues des champs D-28/31/35, sérialisation issue des DP résolus.
- Invariants domaine : HIGH — directs LOCATION_MEUBLEE_REGLES.md §3/4/5 + D-34/35.
- Pyramide tests : HIGH — BDD_PRACTICES.md §3 + gates SOFTWARE_CRAFTSMANSHIP.md §8.

**Date recherche :** 2026-05-14
**Validité estimée :** 60 jours (stack stable, règles juridiques stables jusqu'à prochaine LF).

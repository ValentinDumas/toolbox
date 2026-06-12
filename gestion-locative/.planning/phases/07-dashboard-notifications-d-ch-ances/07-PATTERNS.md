# Phase 7 : Dashboard & Notifications d'échéances — Pattern Map

**Mapped:** 2026-06-11
**Files analyzed:** 14 nouveaux fichiers / 3 modifications
**Analogs found:** 17 / 17

---

## File Classification

| Nouveau / Modifié | Rôle | Data Flow | Analog le plus proche | Qualité match |
|---|---|---|---|---|
| `src/domain/_shared/alerte.ts` | model | transform | `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` (AlerteCfe) | role-match |
| `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` *(refactor)* | model | transform | lui-même — refactor type retour | exact |
| `src/domain/locatif/alerte-irl.ts` | model | transform | `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` | exact |
| `src/domain/locatif/alerte-fin-bail.ts` | model | transform | `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` | exact |
| `src/domain/patrimoine/alerte-diagnostic.ts` | model | transform | `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` | exact |
| `src/application/dashboard/calculer-toutes-alertes.ts` | service | request-response | `src/application/fiscalite/lister-alertes-cfe-actives.ts` | exact |
| `src/web/routes/dashboard.ts` *(nouveau plugin)* | route | request-response | `src/web/routes/impayes.ts` | exact |
| `src/web/routes/racine.ts` *(modification)* | route | request-response | lui-même — extension render | exact |
| `src/web/views/pages/dashboard/accueil.ejs` | component | request-response | `src/web/views/pages/impayes/liste.ejs` | role-match |
| `src/web/views/pages/baux/indexations.ejs` | component | request-response | `src/web/views/pages/baux/liste.ejs` | role-match |
| `src/web/views/partials/partial-bandeau-alerte.ejs` | component | transform | `src/web/views/partials/partial-bandeau-cfe-echeance.ejs` | exact |
| `src/web/views/partials/sidebar-nav.ejs` *(modification)* | component | request-response | lui-même — ajout entrée | exact |
| `tests/_builders/alertes.ts` *(nouveau)* | test | transform | `tests/_builders/fiscalite.ts` (DeclarationCfe builder) | role-match |
| `tests/unit/fiscalite/alerte-cfe-j30.test.ts` *(régression)* | test | transform | lui-même | exact |
| `tests/bdd/features/alerte-irl.feature` | test | transform | `tests/bdd/features/cfe-suivi-declaratif.feature` | exact |
| `tests/bdd/features/alerte-diagnostic.feature` | test | transform | `tests/bdd/features/diagnostics.feature` | role-match |
| `tests/bdd/features/alerte-fin-bail.feature` | test | transform | `tests/bdd/features/cfe-suivi-declaratif.feature` | exact |
| `tests/bdd/features/alerte-agregation.feature` | test | transform | `tests/bdd/features/cfe-suivi-declaratif.feature` | role-match |
| `tests/bdd/features/dashboard-composition.feature` | test | request-response | `tests/bdd/features/activation.feature` | role-match |

---

## Pattern Assignments

### `src/domain/_shared/alerte.ts` (model, transform)

**Analog:** `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` — extrait `AlerteCfe` + `joursAvantEcheance`

**Pattern imports** (lignes 1-4 de alerte-cfe-j30.ts) :
```typescript
import { Temporal } from '@js-temporal/polyfill';

import type { BienId, DeclarationCfeId } from '../../_shared/identifiants.js';
```

**Interface Alerte unifiée** — définie dans CONTEXT.md D-AL-01, reproduit la forme d'`AlerteCfe` (lignes 27-35 de alerte-cfe-j30.ts) en polymorphe :
```typescript
import { Temporal } from '@js-temporal/polyfill';
import type { BienId } from './identifiants.js';

export type TypeAlerte = 'cfe' | 'irl' | 'diagnostic' | 'fin_bail';

export interface Alerte {
  readonly type: TypeAlerte;
  readonly joursRestants: number;       // peut être négatif
  readonly dateEcheance: Temporal.PlainDate;
  readonly libelle: string;
  readonly urlAction: string;
  readonly source: {
    readonly type: TypeAlerte;
    readonly refId: string;
    readonly bienId?: BienId;
    readonly extra?: Record<string, unknown>;
  };
}
```

**Helper partagé `joursAvantEcheance`** — extraire de alerte-cfe-j30.ts lignes 41-46 :
```typescript
export function joursAvantEcheance(
  dateEcheance: Temporal.PlainDate,
  maintenant: Temporal.PlainDate,
): number {
  return maintenant.until(dateEcheance, { largestUnit: 'days' }).days;
}
```

---

### `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` *(refactor type retour)*

**Analog:** lui-même. Modification minimale : le type de retour de `calculerAlertesCfe` passe de `AlerteCfe[]` vers `Alerte[]` OU `AlerteCfe` devient un alias de `Alerte` avec `type: 'cfe'`.

**Pattern de refactor recommandé** (chirurgical — préserve les use cases Phase 6) :
- Importer `Alerte` depuis `../../_shared/alerte.js`
- Modifier `AlerteCfe` en alias : `export type AlerteCfe = Alerte & { type: 'cfe' }`
- `calculerAlertesCfe` retourne `Alerte[]` directement en remplissant le champ `source` unifié
- Les use cases Phase 6 (`lister-alertes-cfe-actives.ts`, route `biens/cfe.ts`) accèdent aux champs via `alerte.source.extra.millesime` et `alerte.source.refId` — adapter les uses cases si besoin

**Fenêtre CFE existante** (lignes 23-64 de alerte-cfe-j30.ts) à **ne pas modifier** :
```typescript
const FENETRE_ALERTE_JOURS = 30;
const STATUTS_ALERTABLES: ReadonlySet<StatutCfe> = new Set(['non_deposee', 'deposee']);
// borne inférieure : j >= -60
```

---

### `src/domain/locatif/alerte-irl.ts` (model, transform)

**Analog:** `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` — MODÈLE EXACT à dupliquer

**Structure complète à reproduire** (lignes 1-89 de alerte-cfe-j30.ts) :
```typescript
import { Temporal } from '@js-temporal/polyfill';
import type { BailId, BienId } from '../_shared/identifiants.js';
import type { Bail } from './bail.js';
import type { Bien } from '../patrimoine/bien.js';
import type { BailIndexation } from './bail-indexation.js';
import type { Alerte } from '../_shared/alerte.js';
import { joursAvantEcheance } from '../_shared/alerte.js';

const FENETRE_ALERTE_JOURS = 30;

// Filtre : seuls les baux actifs (actifDepuis !== null) non gelés (classeDpe ∉ F/G)
// ET sans indexation sur l'exercice courant

export function estAlerteIrlActive(
  bail: Bail,
  bien: Bien,
  aDejaMoments: boolean,    // BailIndexationRepository.dernierExerciceAvecIndexation !== null
  maintenant: Temporal.PlainDate,
): boolean {
  if (!bail.actifDepuis) return false;
  if (bien.estGelLoyer()) return false;                          // D-78 + D-92
  if (aDejaMoments) return false;                               // D-SRC-03 IRL
  const dateAnniversaire = bail.dateAnniversaireProchaine(maintenant);   // D-91
  const j = joursAvantEcheance(dateAnniversaire, maintenant);
  return j <= FENETRE_ALERTE_JOURS && j >= -30;                 // fenêtre [-30, +30]
}

export function calculerAlertesIrl(
  baux: readonly Bail[],
  biens: readonly Bien[],
  indexationsParBail: Map<BailId, boolean>,   // true = indexation déjà sur exercice courant
  maintenant: Temporal.PlainDate,
): Alerte[] {
  const biensParId = new Map(biens.map((b) => [b.id, b]));
  const alertes: Alerte[] = [];
  for (const bail of baux) {
    const bien = biensParId.get(bail.bienId);
    if (!bien) continue;
    const aDeja = indexationsParBail.get(bail.id) ?? false;
    if (!estAlerteIrlActive(bail, bien, aDeja, maintenant)) continue;
    const dateAnniversaire = bail.dateAnniversaireProchaine(maintenant);
    alertes.push({
      type: 'irl',
      joursRestants: joursAvantEcheance(dateAnniversaire, maintenant),
      dateEcheance: dateAnniversaire,
      libelle: `Révision IRL`,
      urlAction: `/baux/${bail.id}/indexer`,
      source: {
        type: 'irl',
        refId: bail.id,
        bienId: bien.id,
        extra: { nomLocataire: '', adresseBien: bien.adresse?.rue ?? '' },
      },
    });
  }
  alertes.sort((a, b) => a.joursRestants - b.joursRestants);
  return alertes;
}
```

---

### `src/domain/locatif/alerte-fin-bail.ts` (model, transform)

**Analog:** `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` — même structure, fenêtre `[-30, +60]`

**Clé de différence vs CFE** : la borne **inférieure** est `-30` (alerte dès J-30), la borne **supérieure** est `+60` (l'alerte disparaît si `joursRestants > 60`). Autrement dit : `j <= 60 && j >= -30`.

```typescript
import { Temporal } from '@js-temporal/polyfill';
import type { Bail } from './bail.js';
import type { Alerte } from '../_shared/alerte.js';
import { joursAvantEcheance } from '../_shared/alerte.js';

export function dateFinBail(bail: Bail): Temporal.PlainDate {
  return bail.dateDebut.add({ months: bail.dureeMois });
}

export function estAlerteFinBailActive(
  bail: Bail,
  maintenant: Temporal.PlainDate,
): boolean {
  if (!bail.actifDepuis) return false;        // D-SRC-03 fin_bail
  const dateFin = dateFinBail(bail);
  const j = joursAvantEcheance(dateFin, maintenant);
  return j <= 60 && j >= -30;                 // D-SRC-05 fenêtre [-30, +60]
}

export function calculerAlertesFinBail(
  baux: readonly Bail[],
  maintenant: Temporal.PlainDate,
): Alerte[] { ... }
```

---

### `src/domain/patrimoine/alerte-diagnostic.ts` (model, transform)

**Analog:** `src/domain/fiscalite/cfe/alerte-cfe-j30.ts` — même structure, fenêtre `[-30, +30]`

**Clé** : itère sur `bien.diagnostics` (ou `bien.diagnosticActif(type)`), exclut les diagnostics sans `dateExpiration` (ERP — D-77, D-SRC-03).

```typescript
import { Temporal } from '@js-temporal/polyfill';
import type { Bien } from './bien.js';
import type { Alerte } from '../_shared/alerte.js';
import { joursAvantEcheance } from '../_shared/alerte.js';

const FENETRE_ALERTE_JOURS = 30;

export function calculerAlertesDiagnostic(
  biens: readonly Bien[],
  maintenant: Temporal.PlainDate,
): Alerte[] {
  const alertes: Alerte[] = [];
  for (const bien of biens) {
    for (const diag of bien.diagnostics) {
      if (diag.dateExpiration === null) continue;  // ERP exclu (D-SRC-03)
      const j = joursAvantEcheance(diag.dateExpiration, maintenant);
      if (j > FENETRE_ALERTE_JOURS || j < -30) continue;
      alertes.push({
        type: 'diagnostic',
        joursRestants: j,
        dateEcheance: diag.dateExpiration,
        libelle: `Diagnostic`,
        urlAction: `/biens/${bien.id}/diagnostics`,  // + ancre #diag-{type}
        source: {
          type: 'diagnostic',
          refId: diag.id,
          bienId: bien.id,
          extra: { typeDiagnostic: diag.type },
        },
      });
    }
  }
  alertes.sort((a, b) => a.joursRestants - b.joursRestants);
  return alertes;
}
```

---

### `src/application/dashboard/calculer-toutes-alertes.ts` (service, request-response)

**Analog:** `src/application/fiscalite/lister-alertes-cfe-actives.ts` — pattern exact : interface `Deps` + `clock` + appel fonctions pures domaine

**Pattern imports** (lignes 1-9 de lister-alertes-cfe-actives.ts) :
```typescript
import type { Clock } from '../../domain/_shared/clock.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';
import { calculerAlertesCfe } from '../../domain/fiscalite/cfe/alerte-cfe-j30.js';
```

**Pattern interface Deps + use case** (lignes 11-41 de lister-alertes-cfe-actives.ts) :
```typescript
export interface CalculerToutesAlertesDeps {
  cfeRepo: DeclarationCfeRepository;
  bienRepo: BienRepository;
  bailRepo: BailRepository;
  bailIndexationRepo: BailIndexationRepository;
  clock: Clock;
}

/**
 * Use case transversal — agrège les 4 sources d'alerte.
 * Calcul à la demande via clock.aujourdhui() — aucune persistance d'état.
 * Pattern miroir : lister-alertes-cfe-actives.ts (D-CFE6.5).
 */
export async function calculerToutesAlertes(
  deps: CalculerToutesAlertesDeps,
): Promise<Alerte[]> {
  const maintenant = deps.clock.aujourdhui();

  const [biens, baux, declarations] = await Promise.all([
    deps.bienRepo.listerTous(),
    deps.bailRepo.listerTous(),
    // ... cfeRepo + bailIndexationRepo
  ]);

  const alertesCfe       = calculerAlertesCfe(declarations, maintenant);
  const alertesIrl       = calculerAlertesIrl(baux, biens, indexationsMap, maintenant);
  const alertesDiag      = calculerAlertesDiagnostic(biens, maintenant);
  const alertesFinBail   = calculerAlertesFinBail(baux, maintenant);

  const toutes = [...alertesCfe, ...alertesIrl, ...alertesDiag, ...alertesFinBail];
  toutes.sort((a, b) => a.joursRestants - b.joursRestants);
  return toutes;
}
```

---

### `src/web/routes/dashboard.ts` (route, request-response)

**Analog:** `src/web/routes/impayes.ts` — plugin Fastify + deps multi-repos + clock + reply.view

**Pattern plugin** (lignes 1-76 de impayes.ts) :
```typescript
import type { FastifyInstance } from 'fastify';

import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { listerImpayes } from '../../domain/encaissements/impaye.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    echeanceLoyerRepo: EcheanceLoyerRepository;
    bailRepo: BailRepository;
    // ... autres repos
    clock: Clock;
  },
): Promise<void> {
  app.get('/dashboard', async (req, reply) => {
    const maintenant = opts.clock.aujourdhui();
    // appel use case + reply.view(...)
    return reply.view('pages/dashboard/accueil.ejs', {
      alertesCritiques,
      impayes,
      actionsJour,
      echeancesAVenir,
      navActive: 'dashboard',
    });
  });
}
```

**Pattern erreur 404** (lignes 69-74 de biens/cfe.ts) :
```typescript
const bien = await bienRepo.trouverParId(id as BienId);
if (!bien) {
  return reply.code(404).send('Bien introuvable.');
}
```

---

### `src/web/routes/racine.ts` *(modification)*

**Analog:** lui-même. Pattern actuel (lignes 1-15) :
```typescript
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import { estPremierLancement } from '../../infrastructure/lifecycle/premier-lancement.js';

export async function plugin(app: FastifyInstance, opts: { db: Kysely<DB> }): Promise<void> {
  app.get('/', async (req, reply) => {
    const premier = await estPremierLancement(opts.db);
    if (premier) {
      return reply.redirect('/wizard/bien');
    }
    return reply.redirect('/biens');           // ← remplacer par render dashboard
  });
}
```

**Modification chirurgicale** : remplacer `return reply.redirect('/biens')` par appel use case + `reply.view('pages/dashboard/accueil.ejs', {...})`. Ajouter les deps nécessaires (tous les repos + clock) via `opts`.

---

### `src/web/views/pages/dashboard/accueil.ejs` (component, request-response)

**Analog:** `src/web/views/pages/impayes/liste.ejs` — structure layout-debut + section conditionnelle + liste

**Pattern layout EJS** (lignes 1-7 de impayes/liste.ejs) :
```ejs
<%- include('../../partials/layout-debut', {
  titre: 'Tableau de bord',
  breadcrumbs: [],
  navActive: 'dashboard'
}) %>

<h1>Tableau de bord</h1>
```

**Pattern section conditionnelle** (lignes 11-16 de impayes/liste.ejs) :
```ejs
<% if (impayes.length === 0) { %>
  <section aria-label="État vide">
    <h2>Tous les loyers sont à jour</h2>
    <p>Aucun retard ou impayé détecté à ce jour.</p>
  </section>
<% } else { %>
```

**Structure des 4 sections** — voir UI-SPEC §S2-S5 qui prescrit le markup exact avec `<section aria-labelledby="{id}">` + `<h2 id="{id}">` + partial `partial-bandeau-alerte`.

---

### `src/web/views/pages/baux/indexations.ejs` (component, request-response)

**Analog:** `src/web/views/pages/impayes/liste.ejs` + `src/web/views/partials/data-table.ejs`

**Pattern layout** :
```ejs
<%- include('../../partials/layout-debut', {
  titre: 'Révisions IRL à venir',
  breadcrumbs: [
    { label: 'Tableau de bord', url: '/' },
    { label: 'Révisions IRL à venir' }
  ],
  navActive: 'baux'
}) %>
```

**Pattern empty-state** (partial existant) :
```ejs
<% if (alertesIrl.length === 0) { %>
  <%- include('../../partials/empty-state', {
    heading: "Aucune révision IRL en attente",
    body: "...",
    ctaUrl: '/baux',
    ctaLabel: "Voir tous les baux"
  }) %>
<% } else { %>
  <table aria-label="Révisions IRL à venir"> ... </table>
<% } %>
```

---

### `src/web/views/partials/partial-bandeau-alerte.ejs` (component, transform)

**Analog EXACT :** `src/web/views/partials/partial-bandeau-cfe-echeance.ejs` — reproduire **à l'identique** les lignes 16-69

**Pattern variantes + role + aria-live** (lignes 16-46 de partial-bandeau-cfe-echeance.ejs) :
```ejs
<%
  const j = alerte.joursRestants;
  let variant, libelleEtat, role;
  if (j < 0) {
    variant = 'destructive';
    libelleEtat = "Échéance dépassée depuis " + Math.abs(j) + " jour" + (Math.abs(j) > 1 ? 's' : '');
    role = 'alert';
  } else if (j === 0) {
    variant = 'destructive';
    libelleEtat = "Échéance aujourd'hui";
    role = 'alert';
  } else if (j <= 7) {
    variant = 'warning-fort';
    libelleEtat = "Échéance dans " + j + " jour" + (j > 1 ? 's' : '');
    role = 'alert';
  } else {
    variant = 'warning';
    libelleEtat = "Échéance dans " + j + " jours";
    role = 'status';
  }

  const styleBase = "padding: 16px; margin-bottom: 16px;";
  let styleVariant;
  if (variant === 'destructive') {
    styleVariant = "background: var(--couleur-destructive-bg); border-left: 4px solid var(--couleur-destructive);";
  } else if (variant === 'warning-fort') {
    styleVariant = "background: var(--couleur-warning-bg, #FFF4E6); border-left: 4px solid var(--couleur-warning, #C2410C);";
  } else {
    styleVariant = "border-left: 4px solid var(--couleur-warning, #C2410C); padding-left: 12px;";
  }
%>
```

**Pattern markup aside + aria** (lignes 47-69 de partial-bandeau-cfe-echeance.ejs) :
```ejs
<aside
  role="<%= role %>"
  <% if (role === 'alert') { %>aria-live="assertive"<% } else { %>aria-live="polite"<% } %>
  aria-label="Alerte CFE <%= alerte.millesime %>"
  style="<%= styleBase %> <%= styleVariant %>"
>
  <p>
    <strong>CFE <%= alerte.millesime %> — <%= libelleEtat %>.</strong>
    Échéance le <%= formatDate(alerte.dateEcheancePaiement) %>.
  </p>
  <p>
    <a
      href="https://www.impots.gouv.fr/..."
      target="_blank"
      rel="noopener noreferrer"
      role="button"
    >Régler la CFE sur impots.gouv.fr</a>
    &nbsp;
    <a href="/biens/<%= alerte.bienId %>/cfe/<%= alerte.declarationCfeId %>/editer">
      Mettre à jour le statut
    </a>
  </p>
</aside>
```

**Extension Phase 7** : remplacer le contenu statique CFE par un switch sur `alerte.type` (voir UI-SPEC §Components §Markup EJS prescrit) + ajouter `iconeTypeAlerte` + `libelleTypeAlerte` + `formaterAlerteUrgence` helpers.

---

### `src/web/views/partials/sidebar-nav.ejs` *(modification)*

**Analog:** lui-même. Pattern actuel (lignes 13-16) :
```ejs
<nav aria-label="Navigation principale">
  <ul>
    <li>
      <a href="/biens"<% if (locals.navActive === 'biens') { %> aria-current="page"<% } %>>Biens</a>
    </li>
```

**Ajout Phase 7** : insérer en **première position** dans `<ul>` avant le lien `/biens` :
```ejs
<li>
  <a href="/"<% if (locals.navActive === 'dashboard') { %> aria-current="page"<% } %>>
    Tableau de bord
  </a>
</li>
```

---

### `tests/_builders/alertes.ts` (test, transform)

**Analog:** `tests/_builders/fiscalite.ts` — pattern builder avec overrides + Temporal.PlainDate + brand types

**Pattern builder** (lignes 25-60 de fiscalite.ts — pattern `unJustificatifNonQualifie`) :
```typescript
import { Temporal } from '@js-temporal/polyfill';
import type { Alerte } from '../../src/domain/_shared/alerte.js';
import type { BienId, BailId } from '../../src/domain/_shared/identifiants.js';

interface OverridesAlerte {
  type?: TypeAlerte;
  joursRestants?: number;
  dateEcheance?: Temporal.PlainDate;
  libelle?: string;
  urlAction?: string;
}

export function uneAlerteCfe(overrides: OverridesAlerte = {}): Alerte {
  return {
    type: 'cfe',
    joursRestants: overrides.joursRestants ?? 15,
    dateEcheance: overrides.dateEcheance ?? Temporal.PlainDate.from('2026-12-15'),
    libelle: 'CFE 2026',
    urlAction: '/biens/xxx/cfe/yyy/editer',
    source: { type: 'cfe', refId: '...', extra: { millesime: 2026 } },
    ...overrides,
  };
}
```

---

### `tests/bdd/features/alerte-irl.feature` + `alerte-fin-bail.feature` + `alerte-agregation.feature` (test, transform)

**Analog EXACT :** `tests/bdd/features/cfe-suivi-declaratif.feature` — structure feature + Background + Scenario + tags `@phase7`

**Pattern feature** (lignes 1-22 de cfe-suivi-declaratif.feature) :
```gherkin
# Feature — Alertes IRL J-30/J-7 (Phase 7 / DAS-02 / D-SRC-03)
# Couverture : fenêtre J-30, filtre gel DPE F/G, filtre exercice courant
# Tags : @phase7 @phase7-alerte-irl

@phase7 @phase7-alerte-irl
Feature: Alertes révision IRL J-30/J-7

  Background:
    Given un bail actif sur un bien DPE classé C

  @phase7-alerte-irl-01
  Scenario: Alerte IRL active J-15 — bail sans indexation exercice courant
    Given la date du jour est J-15 avant l'anniversaire du bail
    And aucune indexation n'est enregistrée pour l'exercice courant
    When je calcule les alertes IRL
    Then une alerte IRL est retournée avec joursRestants = 15
```

---

## Shared Patterns

### Pattern Clock-driven (anti-cron)

**Source :** `src/domain/_shared/clock.ts` + `src/application/fiscalite/lister-alertes-cfe-actives.ts` lignes 29-33

**Appliquer à :** tous les use cases dashboard et fonctions `calculer*`

```typescript
// Dans le use case — jamais dans le domaine
const maintenant = deps.clock.aujourdhui();
// Passer maintenant en argument aux fonctions pures domain
const alertes = calculerAlertesIrl(baux, biens, indexations, maintenant);
```

**Interdiction absolue :** `new Date()`, `Temporal.Now.plainDateISO()`, `setTimeout`, `setInterval`, `cron` dans le domaine ou les use cases — uniquement `deps.clock.aujourdhui()`.

---

### Pattern imports Fastify plugin

**Source :** `src/web/routes/impayes.ts` lignes 1-12

**Appliquer à :** `src/web/routes/dashboard.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import type { SomeRepository } from '../../domain/.../.../some-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    someRepo: SomeRepository;
    clock: Clock;
  },
): Promise<void> {
```

---

### Pattern erreur domaine + session flash

**Source :** `src/web/routes/biens/cfe.ts` lignes 113-127

**Appliquer à :** toute route qui peut recevoir une erreur domaine

```typescript
try {
  // use case
  req.session.banniereSuccess = `Message de succès.`;
  return reply.redirect(`/destination`);
} catch (err) {
  if (err instanceof EntiteIntrouvable) {
    return reply.code(404).send('Message.');
  }
  if (err instanceof InvariantViolated) {
    req.session.formErrors = { global: err.message };
    return reply.redirect(`/formulaire`);
  }
  throw err;  // relance les erreurs inattendues
}
```

**Note Phase 7 :** la route `GET /` et `GET /baux/indexations` sont en lecture pure — pas de `InvariantViolated` attendu. Erreur SQLite = throw err (gestion globale Fastify).

---

### Pattern variante tri-état bandeau alerte (WCAG 1.4.1)

**Source :** `src/web/views/partials/partial-bandeau-cfe-echeance.ejs` lignes 17-45

**Appliquer à :** `partial-bandeau-alerte.ejs` + tout endroit affichant un état d'urgence

Règle : couleur **jamais seule** — toujours accompagnée de :
1. Libellé textuel (`libelleEtat` / `formaterAlerteUrgence`)
2. Icône Unicode `aria-hidden="true"` (non porteuse de sens seule)
3. `role="alert"` + `aria-live="assertive"` pour destructive/warning-fort
4. `role="status"` + `aria-live="polite"` pour warning

---

### Pattern identifiants brand types

**Source :** `src/domain/_shared/identifiants.ts` — pattern à suivre pour tout nouvel identifiant Phase 7

Phase 7 n'ajoute **aucun nouvel identifiant** (calcul à la demande, pas de nouvelle table). Les identifiants existants (`BienId`, `BailId`, `DiagnosticId`, `DeclarationCfeId`) suffisent.

---

### Pattern helpers EJS

**Source :** `src/web/routes/biens/cfe.ts` (helpers passés en `reply.view`) + `src/web/routes/indexations.ts` ligne 29

**Appliquer à :** nouveaux helpers Phase 7 (`formaterAlerteUrgence`, `iconeTypeAlerte`, `libelleTypeAlerte`)

```typescript
// Dans le plugin route, passer les helpers directement via reply.view opts
return reply.view('pages/dashboard/accueil.ejs', {
  alertesCritiques,
  // ...
  formaterAlerteUrgence,    // fonction importée depuis helpers/
  iconeTypeAlerte,
  libelleTypeAlerte,
  formatDate,               // existant Phase 1
  formatMoney,              // existant Phase 2
});
```

---

### Pattern test unitaire fonctions pures alerte (fast-check + Vitest)

**Source :** `tests/unit/fiscalite/alerte-cfe-j30.test.ts` — structure complète à reproduire pour chaque nouvelle fonction `calculer*`

```typescript
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { Temporal } from '@js-temporal/polyfill';
import { calculerAlertesIrl, estAlerteIrlActive } from '../../../src/domain/locatif/alerte-irl.js';

describe('estAlerteIrlActive — filtres + fenêtre J-30', () => {
  it('bail non actif → false', () => { ... });
  it('bail sur Bien DPE F → false (gel Climat)', () => { ... });
  it('indexation déjà présente exercice courant → false', () => { ... });
  it('J-30 exact → true (limite incluse)', () => { ... });
  it('J-31 → false (hors fenêtre)', () => { ... });
});
describe('calculerAlertesIrl — tri ASC', () => {
  it('liste mixte → tri joursRestants ASC', () => { ... });
  it('liste vide → []', () => { ... });
});
```

---

## No Analog Found

Aucun fichier Phase 7 sans analog. Tous les patterns sont couverts par les phases précédentes.

---

## Metadata

**Scope de recherche analogs :** `src/domain/`, `src/application/`, `src/web/routes/`, `src/web/views/`, `tests/`
**Fichiers scannés :** ~140
**Date extraction patterns :** 2026-06-11
**Phases source des analogs :** Phase 1 (Clock, identifiants, layout EJS, sidebar), Phase 2 (impayes plugin, lister-impayes), Phase 3 (indexation banner, Bail.dateAnniversaireProchaine, Diagnostic.dateExpiration), Phase 6 (alerte-cfe-j30.ts, partial-bandeau-cfe-echeance.ejs, lister-alertes-cfe-actives.ts)

# Phase 5 — Fiscalité LMNP — Pattern Map

**Mapped:** 2026-05-20
**Files analyzed:** 38 new + 7 modified (45 total)
**Analogs found:** 45 / 45 (100 % coverage — la base Phase 1–4 a tous les patterns)

> Toutes les nouvelles classes / fichiers Phase 5 suivent les conventions opposables ci-dessous. Naming **strictement français** (CLAUDE.md ubiquitous language). Aucun float — `Money` BigInt centimes partout. Dates : `Temporal.PlainDate`. Hexagonal strict — `dependency-cruiser` interdit toute infra dans `src/domain/`.

---

## Sommaire des patterns transverses (à répliquer dans CHAQUE nouveau fichier)

| Pattern transverse | Source canonique | Excerpt clé | Applique à |
|---|---|---|---|
| Factory `creer()` + `InvariantViolated` + brand id | `src/domain/encaissements/encaissement.ts:56-78` | `static creer(props)` qui valide invariants → `throw new InvariantViolated(...)` | TOUS les agrégats Phase 5 |
| Copy-on-write (`toProps()` + `.creer({...})`) | `src/domain/encaissements/encaissement.ts:83-93,103-113` | `annuler(raison, annuleLe) { return Encaissement.creer({...this.toProps(), annuleLe, raisonAnnulation: raison}) }` | TOUTE mutation d'agrégat |
| Soft-delete (`annule_le` / `corbeille_le`) + raison | `src/domain/documents/justificatif.ts:188-198` | `mettreEnCorbeille(raison, today)` → nouvelle instance avec `corbeilleLe + raisonCorbeille` | Composant.sortir, DeclarationAnnuelle.invalider (si correction) |
| Append-only strict (PAS d'`onConflict`, PAS de soft-delete) | `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts:40-58` | `insertInto(...).values(...).execute()` SANS `.onConflict(...)` — réinsertion = UNIQUE violation | `DeclarationAnnuelle`, `DeclarationCorrigee`, `AmortissementExercice` |
| Brand types nominaux d'identifiants | `src/domain/_shared/identifiants.ts:69-94` | `export type EncaissementId = string & { readonly __brand: 'EncaissementId' };` + `nouveauXxxId()` UUID v4 | TOUS nouveaux ids Phase 5 |
| Money BigInt centimes (jamais float) | `src/domain/_shared/money.ts:9-30,148-178` | `Money.fromCentimes(8_360_000n)` ; `multiplyByFraction(joursDetention, 365n)` prorata banker's rounding | TOUS montants fiscaux |
| Clock injecté | `src/domain/_shared/clock.ts:6-43` | `interface Clock { aujourdhui(): Temporal.PlainDate }` ; `ClockFixe.du('2026-05-15')` en tests | TOUS use cases datés |
| Port repository (dépendances injectées au use case) | `src/domain/encaissements/encaissement-repository.ts:10-32` | Interface dans `domain/`, implémentation dans `infrastructure/repositories/` | TOUS nouveaux repositories Phase 5 |
| Repository SQLite `versDomaine(row)` + `versRow(entity)` | `src/infrastructure/repositories/encaissement-repository-sqlite.ts:106-122` | Mapping bidirectionnel `Row → Encaissement.creer({...})` | TOUS nouveaux adapters SQLite |
| Use case orchestrant N repositories | `src/application/encaissements/creer-encaissement.ts:37-103` | Signature `function xxx(commande, repo1, repo2, ..., clock): Promise<Result>` | TOUS nouveaux use cases Phase 5 |
| Migration SQL bracketed `BEGIN TRANSACTION ; … ; COMMIT ;` + `CREATE … IF NOT EXISTS` | `migrations/0010_phase4_documents_travaux.sql:15-94` | Idempotence + indexes partiels `WHERE annule_le IS NULL` | TOUTES nouvelles migrations 0014–0021 |
| Route Fastify : Zod aux frontières + try/catch + bannière session | `src/web/routes/encaissements.ts:113-197` | `safeParse` → erreurs view ; succès → use case → `reply.redirect` + `req.session.banniereSuccess` | TOUTES routes Fastify Phase 5 |
| EJS layout : `layout-debut.ejs` + `layout-fin.ejs` + breadcrumbs + sidebar-nav + banniere-success | `src/web/views/partials/layout-debut.ejs:1-26` + `src/web/views/pages/biens/liste.ejs:1-5` | `include('../../partials/layout-debut', { titre, breadcrumbs, navActive })` | TOUTES pages EJS Phase 5 |
| BDD Cucumber `.feature` Given/When/Then français + tags `@phase5 @fis-xx` | `tests/bdd/features/indexation-irl-apply.feature:1-46` | Préambule `Etant donné l'application est prête […] clock fixe "YYYY-MM-DD"` | TOUTES features Phase 5 |
| Test unit `vitest` builder + `ClockFixe` + `Money.fromEuros(…)` | `tests/unit/encaissements/encaissement.test.ts:1-79` | `describe ↔ it` + cas obligatoire `T6/T7/T8/T9` (creer / invariant / mutate / déjà-mute) | TOUS tests unit Phase 5 |
| Test d'intégration repository SQLite `:memory:` + `appliquerToutesMigrations` | `tests/bdd/step_definitions/enc02.steps.ts:71-79` | `new Database(':memory:')` + `Kysely<DB>` + `appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR)` | TOUS tests intégration Phase 5 |

---

## File Classification

### Tableau récapitulatif (45 fichiers)

| Nouveau fichier | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `src/domain/fiscalite/regles/regles-2026.ts` | config (VO de constantes) | transform | `src/domain/_shared/irl.ts` (VO versionné) | role-match |
| `src/domain/fiscalite/regles/regle-fiscale-provider.ts` | port (interface) | request-response | `src/domain/_shared/clock.ts` (port d'injection) | exact |
| `src/domain/fiscalite/composant.ts` | aggregate (sub-aggregate of Bien) | CRUD + transform | `src/domain/documents/justificatif.ts` (agrégat soft-delete + factory) | exact |
| `src/domain/fiscalite/valorisation-fiscale.ts` | VO | transform | `src/domain/_shared/irl.ts` (VO) | role-match |
| `src/domain/fiscalite/qualification-fiscale.ts` | enum + type guard | transform | `src/domain/documents/justificatif.ts:32-78` (types + LABELS) | exact |
| `src/domain/fiscalite/declaration-annuelle.ts` | aggregate root append-only | event-driven | `src/domain/locatif/bail-indexation.ts` (snapshot append-only) | exact |
| `src/domain/fiscalite/declaration-corrigee.ts` | aggregate root append-only | event-driven | `src/domain/locatif/bail-indexation.ts` (append-only avec lien parent) | exact |
| `src/domain/fiscalite/amortissement-exercice.ts` | read-model materialisé | transform | `src/domain/encaissements/echeance-loyer.ts` (snapshot complet) | exact |
| `src/domain/fiscalite/tableau-amortissement.ts` | VO (collection) | transform | `src/domain/_shared/money.ts` (VO multi-méthodes) | role-match |
| `src/domain/fiscalite/ard.ts` | VO (ARD reportable) | transform | `src/domain/_shared/money.ts` (VO compensateur) | role-match |
| `src/domain/fiscalite/erreurs.ts` | error types | transform | `src/domain/encaissements/erreurs.ts` (familles d'erreurs typées) | exact |
| `src/domain/fiscalite/declaration-annuelle-repository.ts` | port | CRUD | `src/domain/locatif/bail-indexation-repository.ts` (append-only port) | exact |
| `src/domain/fiscalite/composant-repository.ts` | port | CRUD | `src/domain/encaissements/encaissement-repository.ts` (port standard) | exact |
| `src/domain/fiscalite/recettes-repository.ts` | port (agrégation SUM) | request-response | `src/domain/encaissements/encaissement-repository.ts:sommePaieeParEcheance` | exact |
| `src/domain/fiscalite/charges-repository.ts` | port (agrégation par catégorie) | request-response | `src/domain/encaissements/encaissement-repository.ts:sommePaieeParEcheance` | role-match |
| `src/domain/fiscalite/tableau-amortissement-repository.ts` | port (read-model) | CRUD | `src/domain/locatif/bail-indexation-repository.ts` | role-match |
| `src/domain/_shared/identifiants.ts` (modifié) | identifiers (étendre) | transform | (lui-même — étendre avec brand types fiscaux) | n/a (modif) |
| `src/domain/identite/bailleur.ts` (modifié) | aggregate (étendre) | CRUD | (lui-même — ajouter `regimeFiscal`, `revenusActifsAnnuels`, `fiscalitePremierAcces`) | n/a (modif) |
| `src/domain/patrimoine/bien.ts` (modifié) | aggregate (étendre) | CRUD | (lui-même — ajouter `valorisationFiscale?` + `composants[]`) | n/a (modif) |
| `src/domain/documents/justificatif.ts` (modifié) | aggregate (étendre) | CRUD | (lui-même — ajouter `qualificationFiscale`, `datePaiement`, `parentJustificatifId`) | n/a (modif) |
| `src/domain/travaux/ticket-travaux.ts` (modifié) | aggregate (étendre) | CRUD | (lui-même — ajouter `natureFiscale` + nature `acquisition_mobilier`) | n/a (modif) |
| `src/application/fiscalite/activer-fiscalite-bien.ts` | use case | CRUD | `src/application/locatif/appliquer-indexation-irl.ts` (orchestration multi-agrégat) | exact |
| `src/application/fiscalite/qualifier-ticket-travaux.ts` | use case (cross-aggregate) | CRUD | `src/application/encaissements/creer-encaissement.ts` | exact |
| `src/application/fiscalite/decomposer-justificatif.ts` | use case (split parent → enfants) | transform | `src/application/encaissements/annuler-encaissement.ts` (création compensateurs) | role-match |
| `src/application/fiscalite/calculer-amortissement.ts` | use case (calcul pur orchestré) | transform | `src/application/locatif/simuler-indexation-irl.ts` (calcul + invariants) | exact |
| `src/application/fiscalite/calculer-micro-bic.ts` | use case (calcul pur) | transform | `src/application/locatif/simuler-indexation-irl.ts` | exact |
| `src/application/fiscalite/detecter-bascule-lmp.ts` | use case (calcul pur tri-état) | transform | `src/application/locatif/simuler-indexation-irl.ts` | role-match |
| `src/application/fiscalite/cloturer-exercice.ts` | use case (snapshot + transaction) | event-driven | `src/application/locatif/appliquer-indexation-irl.ts` (multi-effet + transaction) | exact |
| `src/application/fiscalite/creer-declaration-corrigee.ts` | use case (append-only) | event-driven | `src/application/locatif/appliquer-indexation-irl.ts:164-174` (append-only BailIndexation) | exact |
| `src/application/fiscalite/exporter-csv-fiscal.ts` | use case (export) | streaming | `src/application/encaissements/generer-quittance.ts` (output + content-disposition) | role-match |
| `src/application/fiscalite/exporter-pdf-recap.ts` | use case (PDF) | streaming | `src/application/encaissements/generer-quittance.ts` (pdfmake) | exact |
| `src/application/fiscalite/lister-justificatifs-non-qualifies.ts` | use case (query) | request-response | `src/application/documents/rechercher-justificatifs.ts` | exact |
| `src/infrastructure/repositories/composant-repository-sqlite.ts` | adapter | CRUD | `src/infrastructure/repositories/encaissement-repository-sqlite.ts` | exact |
| `src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts` | adapter (append-only) | CRUD | `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts` | exact |
| `src/infrastructure/repositories/declaration-corrigee-repository-sqlite.ts` | adapter (append-only) | CRUD | `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts` | exact |
| `src/infrastructure/repositories/recettes-repository-sqlite.ts` | adapter (SUM agrégé JOIN multi-table) | request-response | `src/infrastructure/repositories/encaissement-repository-sqlite.ts:89-104` (`sommePaieeParEcheance`) | exact |
| `src/infrastructure/repositories/charges-repository-sqlite.ts` | adapter (SUM par catégorie) | request-response | `src/infrastructure/repositories/encaissement-repository-sqlite.ts:89-104` | role-match |
| `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` | adapter (read-model) | CRUD | `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts` | role-match |
| `src/infrastructure/db/kysely-types.ts` (modifié) | type defs (étendre) | transform | (lui-même — pattern hand-maintained par migration) | n/a (modif) |
| `migrations/0014_phase5_qualification_charges.sql` | migration SQL | transform | `migrations/0010_phase4_documents_travaux.sql` (ALTER + INDEXES partiels) | exact |
| `migrations/0015_phase5_bailleur_fiscalite.sql` | migration SQL | transform | `migrations/0010_phase4_documents_travaux.sql` | exact |
| `migrations/0016_phase5_declaration_annuelle.sql` | migration SQL | transform | `migrations/0009_phase3_bail_indexations.sql` (table append-only + UNIQUE) | exact |
| `migrations/0017_phase5_declaration_corrigee.sql` | migration SQL | transform | `migrations/0009_phase3_bail_indexations.sql` | exact |
| `migrations/0018_phase5_composant.sql` | migration SQL | transform | `migrations/0010_phase4_documents_travaux.sql` | exact |
| `migrations/0019_phase5_amortissement_exercice.sql` | migration SQL | transform | `migrations/0010_phase4_documents_travaux.sql` | exact |
| `migrations/0020_phase5_valorisation_fiscale.sql` | migration SQL | transform | `migrations/0010_phase4_documents_travaux.sql` | exact |
| `migrations/0021_phase5_ticket_nature_fiscale.sql` | migration SQL (ALTER enum) | transform | `migrations/0010_phase4_documents_travaux.sql` | exact |
| `src/web/routes/fiscalite/regimes.ts` | route Fastify | request-response | `src/web/routes/encaissements.ts` | exact |
| `src/web/routes/fiscalite/composants.ts` | route Fastify | request-response | `src/web/routes/encaissements.ts` | exact |
| `src/web/routes/fiscalite/qualification.ts` | route Fastify | request-response | `src/web/routes/coffre.ts` | exact |
| `src/web/routes/fiscalite/cloture.ts` | route Fastify (wizard) | request-response | `src/web/routes/indexations.ts` (wizard IRL multi-step) | exact |
| `src/web/routes/fiscalite/exports.ts` | route Fastify (download) | streaming | `src/web/routes/quittances.ts` (PDF download) | exact |
| `src/web/schemas/fiscalite-schemas.ts` | Zod schema | transform | `src/web/schemas/encaissement-schemas.ts` | exact |
| `src/web/views/pages/fiscalite/recap-annuel.ejs` | view | streaming | `src/web/views/pages/biens/detail.ejs` (dl + sections) | exact |
| `src/web/views/pages/fiscalite/activer-fiscalite.ejs` | view (formulaire) | request-response | `src/web/views/pages/baux/formulaire.ejs` (form multi-section) | role-match |
| `src/web/views/pages/fiscalite/qualifier-charges.ejs` | view (liste à action) | request-response | `src/web/views/pages/coffre/liste.ejs` (data-table + actions) | exact |
| `src/web/views/pages/fiscalite/wizard-cloture/etape-1.ejs` à `etape-5.ejs` | view (wizard) | request-response | `src/web/views/pages/baux/indexer/{saisie,simulation,confirmation}.ejs` | exact |
| `src/web/views/pages/fiscalite/declaration-corrigee.ejs` | view (formulaire) | request-response | `src/web/views/pages/baux/indexer/confirmation.ejs` | role-match |
| `src/web/views/pages/fiscalite/exports.ejs` | view (download buttons) | streaming | `src/web/views/pages/coffre/liste.ejs` | role-match |
| `src/web/views/partials/partial-verdict-fiscal.ejs` | partial (bandeau couleur) | transform | `src/web/views/partials/partial-badge-dpe.ejs` (badge couleur + aria-label) | exact |
| `src/web/views/partials/partial-tableau-amortissement.ejs` | partial (data-table spécialisé) | transform | `src/web/views/partials/data-table.ejs` (consumed + columns config) | role-match |
| `src/web/views/partials/partial-widget-tf-teom.ejs` | partial (widget pédagogique) | transform | `src/web/views/partials/partial-ticket-pj-section.ejs` (widget form inline) | role-match |
| `src/web/views/partials/partial-widget-syndic.ejs` | partial (widget 4 cases) | transform | `src/web/views/partials/partial-ticket-pj-section.ejs` | role-match |
| `src/web/views/partials/partial-widget-split-biens.ejs` | partial (multi-line form) | transform | `src/web/views/partials/partial-ticket-pj-section.ejs` | role-match |
| `src/web/views/partials/partial-composant-row.ejs` | partial (ligne form) | transform | `src/web/views/partials/partial-justificatif-row.ejs` | exact |
| `src/web/views/partials/partial-prerequis-cloture.ejs` | partial (checklist ✓/✕) | transform | `src/web/views/partials/partial-inventaire-warnings.ejs` (checklist visuelle) | role-match |
| `src/web/views/partials/partial-comparatif-regime.ejs` | partial (tableau lecture-seule) | transform | `src/web/views/partials/data-table.ejs` | role-match |
| `src/web/views/partials/partial-badge-qualification.ejs` | partial (badge statut) | transform | `src/web/views/partials/partial-badge-dpe.ejs` | exact |
| `src/web/views/partials/wizard-fiscalite-layout.ejs` | partial (wizard 5 étapes) | transform | `src/web/views/partials/wizard-irl-layout.ejs` (wizard IRL 5 étapes) | exact |
| `src/web/views/partials/sidebar-nav.ejs` (modifié) | partial nav | transform | (lui-même — ajouter entrée Fiscalité) | n/a (modif) |
| `tests/_builders/fiscalite.ts` | test builder | transform | `tests/_builders/encaissements.ts` | exact |
| `tests/bdd/features/fiscalite-micro-bic.feature` | BDD feature | transform | `tests/bdd/features/indexation-irl-apply.feature` (FR + clock fixe) | exact |
| `tests/bdd/features/fiscalite-amortissement.feature` | BDD feature | transform | `tests/bdd/features/indexation-irl-apply.feature` | exact |
| `tests/bdd/features/fiscalite-lmp-detection.feature` | BDD feature | transform | `tests/bdd/features/indexation-irl-apply.feature` | exact |
| `tests/bdd/features/fiscalite-cloture.feature` | BDD feature | transform | `tests/bdd/features/indexation-irl-apply.feature` | exact |
| `tests/bdd/features/fiscalite-declaration-corrigee.feature` | BDD feature | transform | `tests/bdd/features/indexation-irl-apply.feature` | exact |
| `tests/bdd/features/fiscalite-qualification-charges.feature` | BDD feature | transform | `tests/bdd/features/indexation-irl-apply.feature` | exact |
| `tests/bdd/step_definitions/fiscalite.steps.ts` | Cucumber steps | event-driven | `tests/bdd/step_definitions/enc02.steps.ts` (init in-memory + http session) | exact |
| `tests/unit/fiscalite/composant.test.ts` | unit test agrégat | transform | `tests/unit/encaissements/encaissement.test.ts` | exact |
| `tests/unit/fiscalite/declaration-annuelle.test.ts` | unit test agrégat | transform | `tests/unit/encaissements/encaissement.test.ts` | exact |
| `tests/unit/fiscalite/calculer-amortissement.test.ts` | unit test use case | transform | `tests/unit/encaissements/creer-encaissement.test.ts` | exact |
| `tests/unit/fiscalite/calculer-micro-bic.test.ts` | unit test use case | transform | `tests/unit/encaissements/creer-encaissement.test.ts` | exact |
| `tests/unit/fiscalite/detecter-bascule-lmp.test.ts` | unit test use case | transform | `tests/unit/encaissements/creer-encaissement.test.ts` | exact |
| `tests/unit/fiscalite/regles-2026.test.ts` | unit test constants | transform | `tests/unit/_shared/irl.test.ts` (VO de constantes) | exact |
| `tests/integration/repositories/composant-repository-sqlite.test.ts` | integration test repo | CRUD | `tests/integration/repositories/encaissement-repository-sqlite.test.ts` | exact |
| `tests/integration/repositories/declaration-annuelle-repository-sqlite.test.ts` | integration test repo | CRUD | `tests/integration/repositories/bail-indexation-repository-sqlite.test.ts` | exact |
| `tests/integration/cloturer-exercice.spec.ts` | integration test use case | CRUD | `tests/integration/repositories/encaissement-repository-sqlite.test.ts` | role-match |

---

## Pattern Assignments — Excerpts concrets

### 1. `src/domain/fiscalite/composant.ts` (aggregate, CRUD + transform)

**Analog :** `src/domain/documents/justificatif.ts`

**Imports + identifier brand** (Justificatif.ts:1-11) — à répliquer exactement :

```typescript
import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauComposantId,            // <-- à ajouter dans identifiants.ts
  type ComposantId,
  type BienId,
  type TicketTravauxId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
```

**Factory + validation invariants** (justificatif.ts:139-183) — à répliquer :

```typescript
static creer(props: ComposantProps): Composant {
  if (props.montantHt.egale(Money.zero())) {
    throw new InvariantViolated('Le montant HT d\'un Composant doit être strictement positif');
  }
  if (!TYPES_COMPOSANT_BOFIP.includes(props.type)) {
    throw new InvariantViolated(`Type de composant invalide : "${props.type}"`);
  }
  const id = props.id ?? nouveauComposantId();
  return new Composant(id, { ...props });
}
```

**Soft-delete copy-on-write** (justificatif.ts:188-198) → adapter pour `sortir(dateSortie, motifSortie)` D-FIS-G5.2 :

```typescript
sortir(motif: MotifSortieComposant, dateSortie: Temporal.PlainDate): Composant {
  if (this.dateSortie !== null) {
    throw new InvariantViolated('Ce composant est déjà sorti');
  }
  return Composant.creer({ ...this.toProps(), dateSortie, motifSortie: motif });
}
```

**Notes spécifiques Phase 5 :**
- 6 types BOFIP fixes (D-FIS-G1.1) : `terrain | gros_oeuvre | toiture_facade | installations_techniques | agencements_interieurs | mobilier`
- Champ `dureeAmortissementAns` DERIVÉ par lookup dans `regles-2026.ts` (pas stocké en clair dans Composant — invalidation versionnée par année).
- Champ `origineKind ∈ { 'initial', 'amelioration', 'acquisition_mobilier' }` + `ticketId?` (D-FIS-G1.5).
- VNC calculée par méthode pure : `vncAuJour(today: PlainDate, regle: RegleFiscale2026): Money`.

---

### 2. `src/domain/fiscalite/declaration-annuelle.ts` (aggregate root, event-driven, append-only)

**Analog :** `src/domain/locatif/bail-indexation.ts`

**Pattern append-only strict** (bail-indexation.ts:32-46) — à répliquer textuellement dans le commentaire JSDoc :

```typescript
/**
 * Agrégat DeclarationAnnuelle (Phase 5, D-FIS-G4.2).
 *
 * Append-only strict : aucune méthode de modification ou d'annulation.
 * Une correction métier passe par l'enregistrement d'une DeclarationCorrigee
 * (lien parent → originale, jamais d'UPDATE des colonnes recettes_totales /
 * charges_totales / dotation_amortissement / ard_genere / statut_lmnp_lmp / regime_applique).
 *
 * Invariants :
 *   - statut === 'cloture' ⇒ tous les snapshots non-null
 *   - regime === 'reel' ⇒ valorisationFiscale du Bien existait à la clôture
 *   - statutLmnpLmp ∈ {'lmnp_confirme', 'indetermine', 'lmp_probable'}
 *   - revenusFoyerSnapshot REQUIS si recettes > 23_000n (D-FIS-G3.1)
 */
```

**Champs snapshot par valeur** (D-FIS-G4.2) — pattern Relance.contenuSnapshot (`src/domain/encaissements/relance.ts:37`) :

```typescript
readonly composantsSnapshot: string;  // JSON sérialisé — permet rejouer le calcul d'amortissement
readonly recettesTotales: Money;
readonly chargesQualifieesParCategorie: Record<QualificationFiscale, Money>;
readonly dotationAmortissement: Money;
readonly ardGenere: Money;
readonly ardConsomme: Money;
readonly revenusFoyerSnapshot: Money | null;
readonly statutLmnpLmp: StatutLmnpLmp;
readonly regimeApplique: 'micro_bic' | 'reel';
```

**Notes spécifiques Phase 5 :**
- Pas de méthode `modifier()`, `annuler()`, `corriger()` — la correction crée une `DeclarationCorrigee` séparée (D-FIS-G4.4).
- `revenusFoyerSnapshot` figé à la clôture, jamais relu depuis `Bailleur.revenusActifsAnnuelsCourant` (audit-immuable).

---

### 3. `src/domain/fiscalite/regles/regles-2026.ts` (config / constants)

**Analog :** `src/domain/_shared/irl.ts` (VO simple + factory `creer` validant + `egale`)

**Pattern de constantes versionnées + factory** :

```typescript
import { Money } from '../../_shared/money.js';
import { Temporal } from '@js-temporal/polyfill';

/**
 * Règles fiscales LMNP 2026 (D-LOCK-1).
 *
 * Sources juridiques :
 *   - SEUIL_MICRO_BIC_LONGUE_DUREE : CGI art. 50-0 (révision triennale 2026-2028)
 *   - PLANCHER_ABATTEMENT : CGI art. 50-0
 *   - SEUIL_LMP_RECETTES : CGI art. 155 IV
 *   - DUREE_AMORTISSEMENT_* : BOFIP-BIC-AMT-20-40
 *   - LF_2025_DATE_EFFET_PV : LF 2025 art. 84 (loi 2025-127)
 *   - ARD reportable sans limite : CGI art. 39 B
 */
export const REGLES_2026 = {
  SEUIL_MICRO_BIC_LONGUE_DUREE: Money.fromCentimes(8_360_000n),  // 83 600 €
  PLANCHER_ABATTEMENT: Money.fromCentimes(30_500n),               // 305 €
  ABATTEMENT_LONGUE_DUREE_NUM: 1n,                                // ratio 1/2
  ABATTEMENT_LONGUE_DUREE_DEN: 2n,
  SEUIL_LMP_RECETTES: Money.fromCentimes(2_300_000n),             // 23 000 €
  LF_2025_DATE_EFFET_PV: Temporal.PlainDate.from('2025-02-15'),
  DUREES_AMORTISSEMENT_ANS: {
    terrain: 0,                       // non amortissable
    gros_oeuvre: 40,
    toiture_facade: 25,
    installations_techniques: 20,
    agencements_interieurs: 15,
    mobilier: 7,
  } as const,
} as const;
```

**Notes Phase 5 :**
- Pattern d'évolution : créer `regles-2027.ts` quand la révision triennale 2026-2028 prend fin. Le `RegleFiscaleProvider` résout par année.
- TOUS les seuils en BigInt centimes (jamais `83_600`, toujours `8_360_000n`).
- Abattement exprimé en `num/den` BigInt pour réutiliser `Money.multiplyByFraction(num, den)` (pas de `* 0.5`).

---

### 4. `src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts` (adapter, append-only)

**Analog :** `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts`

**Pattern append-only (PAS d'`onConflict`)** (bail-indexation-repository-sqlite.ts:40-58) :

```typescript
async enregistrer(decl: DeclarationAnnuelle, trxArg?: unknown): Promise<void> {
  const db = (trxArg as DbOrTrx | undefined) ?? this.db;
  await db
    .insertInto('declarations_annuelles')
    .values({
      id: decl.id,
      bailleur_id: decl.bailleurId,
      exercice: decl.exercice,
      composants_snapshot_json: decl.composantsSnapshot,
      recettes_totales_centimes: decl.recettesTotales.toSqliteInteger(),
      dotation_amortissement_centimes: decl.dotationAmortissement.toSqliteInteger(),
      ard_genere_centimes: decl.ardGenere.toSqliteInteger(),
      ard_consomme_centimes: decl.ardConsomme.toSqliteInteger(),
      revenus_foyer_snapshot_centimes: decl.revenusFoyerSnapshot?.toSqliteInteger() ?? null,
      statut_lmnp_lmp: decl.statutLmnpLmp,
      regime_applique: decl.regimeApplique,
      cloture_le: decl.clotureLe.toString(),
    })
    .execute();  // PAS de .onConflict() — réinsertion = UNIQUE violation (attendu)
}
```

**versDomaine pattern** (bail-indexation-repository-sqlite.ts:95-113) :

```typescript
private versDomaine(row: DeclarationAnnuelleRow): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: row.id as DeclarationAnnuelleId,
    bailleurId: row.bailleur_id as BailleurId,
    exercice: row.exercice,
    composantsSnapshot: row.composants_snapshot_json,
    recettesTotales: Money.fromCentimes(BigInt(row.recettes_totales_centimes)),
    // ...
    clotureLe: Temporal.PlainDate.from(row.cloture_le),
  });
}
```

---

### 5. `src/infrastructure/repositories/recettes-repository-sqlite.ts` (adapter, SUM agrégé)

**Analog :** `src/infrastructure/repositories/encaissement-repository-sqlite.ts:89-104` (`sommePaieeParEcheance`)

**Pattern SUM Kysely** :

```typescript
async sommeRecettesAnnuelles(bailleurId: BailleurId, annee: number): Promise<Money> {
  const result = await this.db
    .selectFrom('encaissement as e')
    .innerJoin('echeance_loyer as el', 'el.id', 'e.echeance_id')
    .innerJoin('bail as b', 'b.id', 'el.bail_id')
    // bailleur singleton : un seul bailleur en V1 — single-user (D-LOCK-2).
    // En V1.1 multi-bailleur, ajouter .where('b.bailleur_id', '=', bailleurId).
    .select((eb) => eb.fn.sum<number>('e.montant_centimes').as('total'))
    .where('e.annule_le', 'is', null)
    .where((eb) => eb.fn('substr', ['e.date', eb.val(1), eb.val(4)]), '=', String(annee))
    .executeTakeFirst();

  const total = result?.total ?? 0;
  return Money.fromCentimes(BigInt(Math.max(0, Math.round(total))));
}
```

**Notes Phase 5 :**
- D-FIS-G2.11 : rattachement par **`datePaiement`** (Encaissement.date) — pas par `EcheanceLoyer.periodeFin`. Comptabilité d'encaissement (BOFIP-BIC-DECLA-30-30 / 30-40-20).
- Filtre `e.annule_le IS NULL` (cohérent avec D-60 compensateurs Phase 2). Encaissements négatifs (compensateurs) inclus dans la somme.

---

### 6. `src/application/fiscalite/cloturer-exercice.ts` (use case, snapshot + transaction)

**Analog :** `src/application/locatif/appliquer-indexation-irl.ts`

**Signature use case + injection ports + transaction** (appliquer-indexation-irl.ts:85-94) :

```typescript
export async function cloturerExercice(
  commande: CloturerExerciceCommande,   // { bailleurId, exercice, regimeChoisi?, revenusFoyer? }
  repos: {
    bailleurRepo: BailleurRepository;
    bienRepo: BienRepository;
    composantRepo: ComposantRepository;
    recettesRepo: RecettesRepository;
    chargesRepo: ChargesRepository;
    declarationAnnuelleRepo: DeclarationAnnuelleRepository;
    tableauAmortissementRepo: TableauAmortissementRepository;
    justificatifRepo: JustificatifRepository;
    ticketTravauxRepo: TicketTravauxRepository;
  },
  clock: Clock,
  regleFiscale: RegleFiscaleProvider,
  db: Kysely<DB>,
): Promise<CloturerExerciceResultat> {
  // 1. Vérifier prérequis bloquants (D-FIS-G4.1) — collecter avant échec
  const prerequis = await collecterPrerequis(commande, repos);
  if (prerequis.bloquants.length > 0) {
    throw new PrerequisCloturalNonSatisfaits(prerequis.bloquants);
  }

  // 2. Calculer agrégats — pure
  const recettes = await repos.recettesRepo.sommeRecettesAnnuelles(commande.bailleurId, commande.exercice);
  const verdictLmp = detecterBasculeLmp(recettes, commande.revenusFoyer, regleFiscale.pour(commande.exercice));
  const regime = choisirRegime(recettes, commande.regimeChoisi, regleFiscale.pour(commande.exercice));
  const composants = await repos.composantRepo.listerActifsPourBailleur(commande.bailleurId, commande.exercice);
  const tableauAmortissement = calculerAmortissement(composants, commande.exercice, regleFiscale);

  // 3. Append-only — la déclaration NE PEUT PAS être modifiée après ce point
  const declaration = DeclarationAnnuelle.creer({ ...snapshots });
  await db.transaction().execute(async (trx) => {
    await repos.declarationAnnuelleRepo.enregistrer(declaration, trx);
    await repos.tableauAmortissementRepo.enregistrerBatch(tableauAmortissement, trx);
  });

  return { declarationId: declaration.id, verdictLmp, regime };
}
```

**Notes Phase 5 :**
- Tous les calculs (`detecterBasculeLmp`, `choisirRegime`, `calculerAmortissement`) sont **purs** (pas d'I/O). Le use case les ORCHESTRE.
- Transaction pour grouper `DeclarationAnnuelle` + `AmortissementExercice[]`.
- ARD : la `DeclarationAnnuelle.ardGenere` ET `ardConsomme` sont calculés en pure depuis l'historique des `DeclarationAnnuelle` précédentes (read-only, append-only).

---

### 7. `src/web/routes/fiscalite/cloture.ts` (route Fastify, wizard 5 étapes)

**Analog :** `src/web/routes/encaissements.ts` (POST + validation + bannière session)

**Auth-pas (single-user)** + **Imports + helper extraireErreurs** (encaissements.ts:1-27) :

```typescript
import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';

import type { Clock } from '../../../domain/_shared/clock.js';
// imports repos Phase 5 ...
import { cloturerExercice } from '../../../application/fiscalite/cloturer-exercice.js';
import { cloturerExerciceSchema } from '../../schemas/fiscalite-schemas.js';

function extraireErreurs(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const cle = issue.path.join('.') || '_global';
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}
```

**Pattern POST + safeParse + use case + bannière** (encaissements.ts:113-172) :

```typescript
app.post('/fiscalite/:exercice/cloturer', async (req, reply) => {
  const body = req.body as Record<string, unknown>;
  const parsed = cloturerExerciceSchema.safeParse(body);

  if (!parsed.success) {
    const erreurs = extraireErreurs(parsed.error.issues);
    return reply.view('pages/fiscalite/wizard-cloture/etape-5.ejs', {
      navActive: 'fiscalite',
      erreurs,
      valeurs: body,
    });
  }

  try {
    const result = await cloturerExercice(
      { bailleurId: bailleur.id, exercice: parsed.data.exercice, ... },
      repos,
      opts.clock,
      opts.regleFiscale,
      opts.db,
    );
    req.session.banniereSuccess = `Exercice ${parsed.data.exercice} clôturé. Statut : ${result.verdictLmp}.`;
    return reply.redirect(`/fiscalite/declarations/${result.declarationId}`);
  } catch (err) {
    if (err instanceof PrerequisCloturalNonSatisfaits) {
      return reply.view('pages/fiscalite/wizard-cloture/etape-1.ejs', {
        prerequis: err.bloquants,
        navActive: 'fiscalite',
      });
    }
    throw err;
  }
});
```

**Notes Phase 5 :**
- 5 GET pour les étapes wizard + 1 POST final. Reproduit exactement le pattern `src/web/views/pages/baux/indexer/{saisie,simulation,confirmation}.ejs`.
- Pas d'auth — app single-user (D-LOCK-2). PAS de middleware d'auth (cf. `src/web/routes/encaissements.ts` qui n'en a pas).

---

### 8. `migrations/0014_phase5_qualification_charges.sql` (migration SQL)

**Analog :** `migrations/0010_phase4_documents_travaux.sql` (le plus récent multi-table)

**Pattern ALTER + index partiel** (0010_phase4_documents_travaux.sql:15-59) :

```sql
-- Migration 0014 — Phase 5 : Qualification fiscale des justificatifs (D-FIS-G2.1, G2.5, G2.6, G2.11)
-- Décisions :
--   D-FIS-G2.2 : Taxonomie 4 catégories alignée 2033-A
--   D-FIS-G2.5 : Reclassement libre tant que brouillon, bloqué après clôture
--   D-FIS-G2.6 : Multi-biens via parent_justificatif_id (FK self)
--   D-FIS-G2.11 : Date de paiement (fallback dateDocument)
-- Idempotent (ALTER TABLE … ADD COLUMN n'est pas IF NOT EXISTS — vérifier via pragma table_info).

BEGIN TRANSACTION;

ALTER TABLE justificatifs ADD COLUMN qualification_fiscale TEXT NULL
  CHECK (qualification_fiscale IS NULL OR qualification_fiscale IN (
    'non_qualifie',
    'entretien_reparation',
    'amelioration',
    'charge_courante_periodique',
    'non_deductible'
  ));

ALTER TABLE justificatifs ADD COLUMN qualifie_le TEXT NULL;       -- ISO 8601 PlainDate
ALTER TABLE justificatifs ADD COLUMN date_paiement TEXT NULL;     -- D-FIS-G2.11
ALTER TABLE justificatifs ADD COLUMN parent_justificatif_id TEXT NULL REFERENCES justificatifs(id);

-- Index partiel pour le compteur "X à qualifier" (S2 UI-SPEC)
CREATE INDEX IF NOT EXISTS idx_justificatifs_qualification_pending
  ON justificatifs(qualification_fiscale)
  WHERE qualification_fiscale = 'non_qualifie' AND corbeille_le IS NULL;

-- Index FK self pour parent → enfants (multi-biens)
CREATE INDEX IF NOT EXISTS idx_justificatifs_parent
  ON justificatifs(parent_justificatif_id)
  WHERE parent_justificatif_id IS NOT NULL;

COMMIT;
```

**Notes Phase 5 :**
- `ALTER TABLE … ADD COLUMN` SQLite ne supporte PAS `IF NOT EXISTS` — la migration doit être appliquée une seule fois (mécanisme `appliquerMigrationsBrutes` via `meta` table garantit l'idempotence).
- `kysely-types.ts` doit être manuellement étendu en parallèle pour ajouter les nouveaux champs à `JustificatifsTable`.

---

### 9. `tests/bdd/features/fiscalite-micro-bic.feature` (BDD Cucumber)

**Analog :** `tests/bdd/features/indexation-irl-apply.feature`

**Pattern français + clock fixe + Given/When/Then** (indexation-irl-apply.feature:1-16) :

```gherkin
# language: fr
@fis-02 @phase5
Fonctionnalité: Régime micro-BIC LMNP — abattement 50 % + plancher 305 € (FIS-02)

  Contexte:
    Etant donné l'application est prête pour la fiscalité LMNP avec clock fixe "2026-12-31"

  Scénario: Abattement standard 50 % au-dessus du plancher
    Etant donné un Bailleur avec recettes annuelles 2026 = 60_000 €
    Quand le bailleur clôture l'exercice 2026 en régime micro-BIC
    Alors le résultat fiscal = 30_000 € (50 % d'abattement appliqué)
    Et la déclaration porte regime_applique = "micro_bic"

  Scénario: Plancher d'abattement 305 € appliqué quand 50 % < 305 €
    Etant donné un Bailleur avec recettes annuelles 2026 = 60_000 centimes (600 €)
    Quand le bailleur clôture l'exercice 2026 en régime micro-BIC
    Alors le résultat fiscal = 29_500 centimes (600 € - 305 € plancher)

  Scénario: Seuil exact 83 600 € → micro éligible
    Etant donné un Bailleur avec recettes annuelles 2026 = 83_599,99 €
    Quand le bailleur clôture l'exercice 2026
    Alors le régime auto-choisi est "micro_bic"

  Scénario: Seuil + 1 cent → réel forcé
    Etant donné un Bailleur avec recettes annuelles 2026 = 83_600,01 €
    Quand le bailleur clôture l'exercice 2026
    Alors le régime auto-choisi est "reel"
```

**Notes Phase 5 :**
- TOUS les cas limites de `<fiscal_rules_locked>` (CONTEXT.md L240-252) ont leur scénario dédié — 100 % couverture (BDD_PRACTICES.md "chaque exception du droit a son scénario dédié").

---

### 10. `tests/unit/fiscalite/calculer-amortissement.test.ts` (unit test)

**Analog :** `tests/unit/encaissements/creer-encaissement.test.ts`

**Pattern stubs + ClockFixe + builders** (creer-encaissement.test.ts:1-56,93-107) :

```typescript
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { calculerAmortissement } from '../../../src/application/fiscalite/calculer-amortissement.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { unComposantGrosOeuvre } from '../../_builders/fiscalite.js';

const CLOCK = ClockFixe.du('2026-12-31');

describe('calculerAmortissement — prorata temporis au jour près (D-FIS-G1.6)', () => {
  it('cas limite CONTEXT.md L249 : acquisition 2026-03-15, gros œuvre 200 000 €/40 ans → 4 000 €', () => {
    const composant = unComposantGrosOeuvre({
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from('2026-03-15'),
    });
    const result = calculerAmortissement([composant], 2026, REGLES_2026);
    // annuité pleine = 200_000 / 40 = 5_000 €
    // jours détention 2026 = 292 (du 15 mars au 31 décembre)
    // dotation = 5_000 × 292/365 = 4_000 € (banker's rounding éprouvé Money.multiplyByFraction)
    expect(result.dotationParComposant[0].toCentimes()).toBe(400_000n);
  });

  it('terrain non amortissable → dotation = 0 €', () => { /* … */ });
  it('acquisition + sortie même année (composant détruit 30 juin) → prorata 6 mois', () => { /* … */ });
});
```

**Notes Phase 5 :**
- Use `ClockFixe.du('2026-12-31')` pour déterminisme — pattern éprouvé.
- TOUS les calculs Money en BigInt centimes (`expect(...).toCentimes()).toBe(400_000n)`).
- Pas de stub repository pour les use cases purs `calculer*` (orchestrés par `cloturer-exercice.ts`).

---

### 11. `src/web/views/partials/partial-verdict-fiscal.ejs` (partial, bandeau couleur)

**Analog :** `src/web/views/partials/partial-badge-dpe.ejs`

**Pattern carte couleur + aria-label + icône doublant** (partial-badge-dpe.ejs:1-22) :

```ejs
<%
/*
 * partial-verdict-fiscal.ejs — Bandeau verdict tri-état LMNP/LMP (D-FIS-G3.3, S7 UI-SPEC).
 * Variables attendues :
 *   - statut ('lmnp_confirme' | 'indetermine' | 'lmp_probable')
 *   - annee (number) — pour la copy
 * Couleurs : tokens app.css (--couleur-success / --couleur-warning / --couleur-destructive) — WCAG 1.4.3 ≥ 4.5:1.
 * Icône doublant la couleur (WCAG 1.4.1) : ✓ succès / ⚠ warning / ✕ destructive.
 */
const verdictMap = {
  lmnp_confirme: {
    bg: 'var(--couleur-success-bg)',
    fg: 'var(--couleur-success)',
    icone: '✓',
    label: 'Statut LMNP confirmé pour ' + annee + '.',
    role: 'status',
  },
  indetermine: {
    bg: 'var(--couleur-warning-bg)',
    fg: 'var(--couleur-warning)',
    icone: '⚠',
    label: 'Statut indéterminé — revenus du foyer non renseignés.',
    role: 'status',
  },
  lmp_probable: {
    bg: 'var(--couleur-destructive-bg)',
    fg: 'var(--couleur-destructive)',
    icone: '✕',
    label: 'Risque LMP probable — consultez un expert-comptable.',
    role: 'alert',
  },
};
const v = verdictMap[statut] || verdictMap.indetermine;
%>
<section aria-label="Verdict fiscal <%= annee %>" role="<%= v.role %>"
  style="background: <%= v.bg %>; border-left: 4px solid <%= v.fg %>; padding: 16px; margin-bottom: 16px;">
  <span aria-hidden="true"><%= v.icone %></span>
  <strong><%= v.label %></strong>
  <% if (statut === 'indetermine') { %>
    <a href="/fiscalite/<%= annee %>/revenus-foyer" style="color: var(--couleur-accent);">Renseigner maintenant</a>
  <% } else if (statut === 'lmp_probable') { %>
    <a href="https://annuaire.experts-comptables.org/" target="_blank" rel="noopener noreferrer"
       style="color: var(--couleur-accent);">Trouver un expert-comptable</a>
  <% } %>
</section>
```

---

### 12. `src/web/views/partials/wizard-fiscalite-layout.ejs` (partial, wizard 5 étapes)

**Analog :** `src/web/views/partials/wizard-irl-layout.ejs`

**Pattern liste d'étapes + `aria-current="step"`** (wizard-irl-layout.ejs:1-10) :

```ejs
<nav aria-label="Étapes de la clôture fiscale">
  <ol>
    <li<% if (currentStep === 1) { %> aria-current="step"<% } %>>1. Prérequis</li>
    <li<% if (currentStep === 2) { %> aria-current="step"<% } %>>2. Revenus du foyer</li>
    <li<% if (currentStep === 3) { %> aria-current="step"<% } %>>3. Micro vs réel</li>
    <li<% if (currentStep === 4) { %> aria-current="step"<% } %>>4. Confirmation</li>
    <li<% if (currentStep === 5) { %> aria-current="step"<% } %>>5. Clôture</li>
  </ol>
</nav>
<p><small>Étape <%= currentStep %> sur 5</small></p>
```

---

### 13. `src/web/views/partials/partial-tableau-amortissement.ejs` (partial, data-table spécialisé)

**Analog :** `src/web/views/partials/data-table.ejs` + `src/web/views/pages/biens/liste.ejs:18-43` (consumer pattern)

**Pattern d'invocation `include('data-table', { colonnes, lignes, actions })`** :

```ejs
<%- include('data-table', {
  ariaLabel: 'Tableau d\'amortissement ' + bien.adresse.enLigne() + ' ' + annee,
  colonnes: [
    { titre: 'Exercice', numerique: true },
    { titre: 'Composant' },
    { titre: 'Dotation théorique', numerique: true },
    { titre: 'Dotation appliquée', numerique: true },
    { titre: 'ARD généré', numerique: true },
    { titre: 'ARD cumulé', numerique: true },
    { titre: 'ARD consommé', numerique: true },
  ],
  lignes: tableauAmortissement.map(function(ligne) {
    return [
      String(ligne.exercice),
      ligne.composant.label,                                     // libellé FR du type composant
      formatMoney(ligne.dotationTheorique),                      // helper existant
      formatMoney(ligne.dotationAppliquee),
      formatMoney(ligne.ardGenere),
      formatMoney(ligne.ardCumuleDisponible),
      formatMoney(ligne.ardConsomme),
    ];
  }),
}) %>
```

---

### 14. `tests/_builders/fiscalite.ts` (test builder)

**Analog :** `tests/_builders/encaissements.ts`

**Pattern builder valide + override partiel** (encaissements.ts:40-58, 83-95) :

```typescript
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../src/domain/_shared/money.js';
import type { BienId, BailleurId, ComposantId } from '../../src/domain/_shared/identifiants.js';

export interface ComposantProps {
  id?: ComposantId;
  bienId: BienId;
  type: 'terrain' | 'gros_oeuvre' | 'toiture_facade' | 'installations_techniques' | 'agencements_interieurs' | 'mobilier';
  montantHt: Money;
  dateAcquisition: Temporal.PlainDate;
  origineKind: 'initial' | 'amelioration' | 'acquisition_mobilier';
  ticketId?: TicketTravauxId | null;
  dateSortie?: Temporal.PlainDate | null;
  motifSortie?: 'vente' | 'mise_au_rebut' | 'sinistre' | 'autre' | null;
}

export function unComposantGrosOeuvre(overrides: Partial<ComposantProps> = {}): ComposantProps {
  return {
    bienId: overrides.bienId ?? (crypto.randomUUID() as BienId),
    type: 'gros_oeuvre',
    montantHt: overrides.montantHt ?? Money.fromEuros(200_000),
    dateAcquisition: overrides.dateAcquisition ?? Temporal.PlainDate.from('2026-01-01'),
    origineKind: overrides.origineKind ?? 'initial',
    ticketId: overrides.ticketId ?? null,
    dateSortie: overrides.dateSortie ?? null,
    motifSortie: overrides.motifSortie ?? null,
    ...overrides,
  };
}
```

---

## Shared Patterns — Cross-cutting concerns

### Authentication
**Source :** AUCUNE — l'app est single-user mono-utilisateur (CLAUDE.md "Principes directeurs §2").
**Apply to :** TOUTES routes Phase 5.
**Notes :** ne PAS introduire de middleware d'auth, de session.userId, ni de check JWT. Vérifier que les routes Phase 5 répliquent l'absence d'auth de `src/web/routes/encaissements.ts`.

### Gestion des erreurs (domaine + route)
**Source :** `src/domain/encaissements/erreurs.ts` (familles d'erreurs typées) + `src/web/routes/encaissements.ts:173-196` (try/catch + check `instanceof`).
**Apply to :** TOUS les use cases Phase 5 + leurs routes.

**Excerpt domaine** :

```typescript
// src/domain/fiscalite/erreurs.ts (à créer)
export class PrerequisCloturalNonSatisfaits extends Error {
  constructor(public readonly bloquants: string[]) {
    super(`Clôture impossible : ${bloquants.length} prérequis non satisfaits`);
    this.name = 'PrerequisCloturalNonSatisfaits';
  }
}
export class DeclarationFigeeException extends Error {
  constructor() {
    super('Déclaration clôturée — créer une DeclarationCorrigee pour modifier');
    this.name = 'DeclarationFigeeException';
  }
}
export class ComposantsSommeIncoherente extends Error { /* … */ }
export class RevenusFoyerManquants extends Error { /* … */ }
```

**Excerpt route try/catch** (encaissements.ts:173-196) :

```typescript
} catch (err) {
  if (err instanceof PrerequisCloturalNonSatisfaits) {
    return reply.view('pages/fiscalite/wizard-cloture/etape-1.ejs', {
      prerequis: err.bloquants,
      // … pas de re-throw : on re-affiche l'étape 1 avec la checklist
    });
  }
  if (err instanceof DeclarationFigeeException) {
    return reply.code(409).send('Cette déclaration est clôturée. Créez une déclaration corrigée.');
  }
  throw err;  // 500 pour erreurs inattendues
}
```

### Validation (Zod aux frontières HTTP)
**Source :** `src/web/schemas/encaissement-schemas.ts` + `src/web/routes/encaissements.ts:117-138`.
**Apply to :** TOUS les schemas `src/web/schemas/fiscalite-schemas.ts`.

**Excerpt** (encaissement-schemas.ts:1-23) :

```typescript
import { z } from 'zod';

export const qualifierJustificatifSchema = z.object({
  justificatifId: z.string().uuid('Identifiant invalide'),
  qualification: z.enum(['entretien_reparation', 'amelioration', 'charge_courante_periodique', 'non_deductible'], {
    errorMap: () => ({ message: 'Sélectionnez une catégorie' }),
  }),
});

export const cloturerExerciceSchema = z.object({
  exercice: z.coerce.number().int().min(2020).max(2100),
  regimeChoisi: z.enum(['micro_bic', 'reel']).optional(),
  revenusFoyerEuros: z.coerce.number().min(0).optional(),
});

export const composantSchema = z.object({
  type: z.enum(['terrain', 'gros_oeuvre', 'toiture_facade', 'installations_techniques', 'agencements_interieurs', 'mobilier']),
  montantHtEuros: z.coerce.number().refine((n) => n > 0, 'Le montant HT doit être > 0 €'),
  dateAcquisition: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ'),
});
```

### Money en BigInt centimes — règle absolue
**Source :** `src/domain/_shared/money.ts:9-178`.
**Apply to :** TOUS calculs fiscaux.
**Anti-pattern :** `CONTEXT.md §<anti_patterns> §1` "Float pour les montants fiscaux — TOUJOURS Money en BigInt centimes. Aucun nombre à virgule flottante dans `domain/fiscalite/`."

**Excerpt — usage type pour amortissement** :

```typescript
// 200_000 € sur 40 ans : annuité pleine = 5_000 €
// Prorata 292 jours sur 365 : 5_000 × 292/365 = 4_000 € (banker's rounding)
const annuitePleine = montantHt.multiplyByRatio(1n, BigInt(dureeAns));   // 200_000_00n / 40n
const joursDetention = BigInt(joursEntreDeuxDates(dateDebut, dateFin));
const dotation = annuitePleine.multiplyByFraction(joursDetention, 365n);  // banker's rounding par défaut
```

### Tests builders (DRY)
**Source :** `tests/_builders/encaissements.ts:40-58`.
**Apply to :** `tests/_builders/fiscalite.ts` (créer pour Phase 5).
**Convention :** une fonction par scénario typique (`unComposantGrosOeuvre`, `uneDeclarationCloturee`, `unTicketAmelioration`, `unJustificatifNonQualifie`).

### Hexagonal strict — dependency-cruiser
**Source :** CONTEXT.md §code_context "Hexagonal DDD strict — `dependency-cruiser` interdit les imports infra dans `domain/`".
**Apply to :** TOUS fichiers `src/domain/fiscalite/`.
**Check :** AUCUN `import … from '../../infrastructure/…'` ou `… from 'kysely'` dans `src/domain/fiscalite/`. Tous les repositories sont des **ports** (interfaces) dans `src/domain/fiscalite/*-repository.ts`. Les adapters vivent dans `src/infrastructure/repositories/`.

---

## No Analog Found

| Fichier | Role | Raison |
|---|---|---|
| (aucun) | — | — |

**Tous les fichiers Phase 5 ont un analog clair Phase 1–4.** La phase est volontairement modélisée pour réutiliser les patterns éprouvés (single-user, hexagonal, soft-delete + append-only, BDD outside-in, Money BigInt, EJS+Pico).

Cas particuliers à signaler au planner :

- Les **5 partials widgets pédagogiques** (`partial-widget-tf-teom`, `partial-widget-syndic`, `partial-widget-split-biens`, `partial-prerequis-cloture`, `partial-comparatif-regime`) n'ont pas d'analog 1:1 visuel — ils combinent `partial-ticket-pj-section.ejs` (form inline + tableau) + `partial-inventaire-warnings.ejs` (checklist). Le planner doit composer.
- Le port `RegleFiscaleProvider` est conceptuellement analog à `Clock` (port d'injection sans état) mais joue un rôle de lookup versionné par année — il faut une interface simple `pour(annee: number): RegleFiscale2026 | RegleFiscale2027 | …`.

---

## Metadata

**Analog search scope :**
- `src/domain/{_shared,encaissements,documents,travaux,patrimoine,identite,locatif}/`
- `src/application/{encaissements,documents,travaux,locatif,identite}/`
- `src/infrastructure/{db,repositories}/`
- `src/web/{routes,schemas,views/partials,views/pages}/`
- `tests/{unit,integration,bdd/features,bdd/step_definitions,_builders}/`
- `migrations/0001` à `0010_phase4_documents_travaux.sql`

**Files scanned :** 60+ fichiers Phase 1–4 lus pour extraire les patterns canoniques.

**Pattern extraction date :** 2026-05-20.

**Sources doctrine respectées :**
- CLAUDE.md (ubiquitous language FR, V1 LMNP, single-user, audit-friendly)
- practices/DDD.md (hexagonal, bounded contexts, agrégats, factory)
- practices/SOFTWARE_CRAFTSMANSHIP.md (SOLID, CI gates)
- practices/BDD_PRACTICES.md (BDD outside-in, 100 % couverture fiscale, cas exception dédié)
- 05-UI-SPEC.md (12 surfaces S1–S12, tokens app.css, WCAG 2.1 AA)

# Phase 6 — Liasse 2031 & CFE — Pattern Map

**Mapped:** 2026-06-02
**Files analyzed:** ~50 nouveaux fichiers (domaine, application, infra, web, tests)
**Analogs found:** 100 % (exact ou role-match) — Phase 6 reproduit intégralement les patterns Phases 1-5
**Langue:** Français

> Carte des patterns à cloner. Aucune décision nouvelle. Toutes les sections ci-dessous proviennent du code existant — copier le pattern, adapter la sémantique. Les analogs critiques (`RegleFiscaleProvider`, `RecapFiscalBuilder`, `TicketTravaux`, banner IRL, route `exports.ts`) sont **miroirs exacts**.

---

## File Classification

### Bloc 1 — Domaine `_shared` (extension minimale)

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `src/domain/_shared/identifiants.ts` *(extension)* | domain-value-object | `src/domain/_shared/identifiants.ts` (existant) | exact | Brand type `string & { __brand: 'DeclarationCfeId' }` + `nouveauDeclarationCfeId()` via `crypto.randomUUID()` |

### Bloc 2 — Domaine `fiscalite/` agrégat CFE

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `src/domain/fiscalite/declaration-cfe.ts` | domain-agrégat racine | `src/domain/travaux/ticket-travaux.ts` (référence `BienId` par identifiant, factory + invariants + copy-on-write) + `src/domain/fiscalite/declaration-annuelle.ts` (factory `creer()`, `InvariantViolated`, brand type) | exact | Factory `DeclarationCfe.creer()` + `InvariantViolated` + invariants statut↔dates + `modifier()` copy-on-write avec pattern `'field' in patch` pour nullables |
| `src/domain/fiscalite/declaration-cfe-repository.ts` | domain-port | `src/domain/fiscalite/declaration-annuelle-repository.ts` | exact | Port `enregistrer(decl, trxArg?: unknown) / trouverParId / trouverParBienMillesime / listerParBien` |
| `src/domain/fiscalite/statut-cfe.ts` *(union type)* | domain-value-object | constantes inline `STATUTS_TICKET_VALIDES` dans `ticket-travaux.ts` (L25-30) | role-match | Union type 5 valeurs + tableau `STATUTS_CFE_VALIDES: readonly StatutCfe[]` |
| `src/domain/fiscalite/erreurs.ts` *(extension)* | domain-event/error | `src/domain/fiscalite/erreurs.ts` existant (L20-25 `RegleFiscaleAbsente`) | exact | Classes `MappingLiasseAbsent extends Error` + `DeclarationCfeIntrouvable extends Error` + `this.name` explicite |

### Bloc 3 — Domaine `fiscalite/liasse/` (port mapping + builder PDF)

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `src/domain/fiscalite/liasse/mapping-liasse-2026.ts` | domain-value-object (data file millésime) | `src/domain/fiscalite/regles/regles-2026.ts` | **exact (miroir)** | Constantes `as const` + JSDoc avec sources juridiques cerfa + interface `MappingLiasse2026` |
| `src/domain/fiscalite/liasse/mapping-liasse-provider.ts` | domain-port + impl en mémoire | `src/domain/fiscalite/regles/regle-fiscale-provider.ts` | **exact (miroir)** | Interface `pour(millesime: number)` + `Map<number, MappingLiasse2026>` + fail-fast `throw MappingLiasseAbsent(millesime)` |
| `src/domain/fiscalite/liasse/brouillon-liasse-builder.ts` | domain-port (builder PDF) | `src/domain/fiscalite/recap-fiscal-builder.ts` | **exact (miroir)** | Interface `construire(dto: BrouillonLiasseDto): unknown` — retour `unknown` pour préserver pureté domaine |
| `src/domain/fiscalite/liasse/case-liasse.ts` *(types DTO)* | domain-value-object | `src/domain/fiscalite/amortissement-exercice.ts` (VO read-model immuable) | role-match | Interfaces `CaseLiasseDto`, `SectionLiasse`, `AnnexeLiasse`, `BrouillonLiasseDto`, `SourceDto`, types unions stricts pour annexes (`'2031-SD' \| '2033-A' \| '2033-B' \| '2033-C' \| '2033-D' \| '2042-C-PRO'`) |
| `src/domain/fiscalite/reconciliation.ts` | domain-value-object (fonction pure) | absent — nouveau concept mais signature inspirée de fonctions pures `amortissement-exercice.ts` + `Money.egale/soustraire` | partial | Fonction pure `reconcilier(snapshot, sourcesVivantes): ResultatReconciliation` — aucune dépendance Clock, aucun import infra |

### Bloc 4 — Application use cases

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `src/application/fiscalite/generer-brouillon-liasse.ts` | application-use-case cross-BC | `src/application/fiscalite/exporter-pdf-recap.ts` (orchestration multi-repos + builder + port + fail-fast) | exact | DI deps interface + `throw DeclarationIntrouvable` + agrège snapshot + sources vivantes + `reconcilier()` |
| `src/application/fiscalite/exporter-pdf-brouillon-liasse.ts` | application-use-case | `src/application/fiscalite/exporter-pdf-recap.ts` | **exact** | Charge entités → build via port `BrouillonLiasseBuilder.construire(dto)` → `pdfRenderer.genererBuffer(docDef)` |
| `src/application/fiscalite/exporter-csv-brouillon-liasse.ts` | application-use-case | `src/application/fiscalite/exporter-csv-fiscal.ts` | **exact** | UTF-8 BOM `'﻿'` + séparateur `;` + `Money.enEuros()` (mitigation CSV injection T-05-07-04) — étendu avec colonne `sources` |
| `src/application/fiscalite/enregistrer-declaration-cfe.ts` | application-use-case (POST create) | `src/application/fiscalite/creer-declaration-corrigee.ts` | exact | Charge entités → factory `DeclarationCfe.creer()` → `cfeRepo.enregistrer()` |
| `src/application/fiscalite/modifier-declaration-cfe.ts` | application-use-case (POST update) | `src/application/locatif/appliquer-indexation-irl.ts` (copy-on-write + repo enregistrer) | role-match | Charge déclaration → `.modifier(patch)` → enregistre nouvelle version (CFE n'est PAS append-only — édition permise) |
| `src/application/fiscalite/lister-declarations-cfe-avec-alerte.ts` | application-use-case (listing + Clock) | `src/web/routes/fiscalite/racine.ts` L47-95 (lecture conditionnelle + `Clock`) | role-match | Liste via `cfeRepo` + calcule `joursAvantEcheance(d.dateEcheancePaiement, clock)` + filtre `estAlerteActive()` |

### Bloc 5 — Infrastructure

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `src/infrastructure/repositories/declaration-cfe-repository-sqlite.ts` | infrastructure-repository | `src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts` | **exact** | `versDomaine / versRow + transaction()` + type `Row` + `Kysely<DB> \| Transaction<DB>` + `.toSqliteInteger()` Money + `Temporal.PlainDate.from(rowText)` |
| `src/infrastructure/pdf/brouillon-liasse-doc-def.ts` | infrastructure-adapter (fonction pure pdfmake) | `src/infrastructure/pdf/recap-fiscal-doc-def.ts` | exact | Fonction pure `construireBrouillonLiasse(dto): TDocumentDefinitions` |
| `src/infrastructure/pdf/brouillon-liasse-builder-pdfmake.ts` | infrastructure-adapter (port impl) | `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` | **exact (miroir)** | Classe qui implémente port domaine, délègue à fonction pure `construire*` |
| `migrations/0023_phase6_declaration_cfe.sql` | infrastructure-config | `migrations/0016_phase5_declaration_annuelle.sql` | exact | `CREATE TABLE IF NOT EXISTS` + colonnes `TEXT NOT NULL` IDs + `INTEGER NOT NULL` centimes Money + `CHECK (statut IN (...))` + `UNIQUE (bien_id, millesime)` + dates ISO `TEXT NOT NULL` |
| `src/infrastructure/db/kysely-types.ts` *(extension)* | infrastructure-config | `kysely-types.ts` existant (interface `DeclarationsAnnuellesTable`) | exact | Interface `DeclarationsCfeTable` avec types stricts `TEXT \| INTEGER \| null` |

### Bloc 6 — Web (routes Fastify + Zod)

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `src/web/routes/fiscalite/liasse.ts` | web-route (GET liasse HTML/PDF/CSV) | `src/web/routes/fiscalite/exports.ts` | **exact** | Pattern route + Zod params + try/catch erreurs typées + `contentDispositionFilename()` RFC 6266 + `.type('application/pdf' \| 'text/csv; charset=utf-8' \| 'text/html')` |
| `src/web/routes/biens/cfe.ts` *(routes GET/POST CFE)* | web-route (CRUD CFE) | `src/web/routes/fiscalite/cloture.ts` (GET/POST + Zod + redirect + reply.view) | exact | Body parse + Zod safeParse + use case + render formulaire si erreur + redirect + bannière success en session |
| `src/web/schemas/cfe-schemas.ts` | web-config (Zod schemas) | `src/web/schemas/fiscalite-schemas.ts` (L102-108 `saisirRevenusFoyerSchema`, L117-119 `cloturerExerciceSchema`) | exact | `z.object({...})` + `z.enum(STATUTS_CFE)` + `z.coerce.number().min(2020).max(2030)` + `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` |

### Bloc 7 — Web (vues EJS + partials + helpers)

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `src/web/views/pages/fiscalite/brouillon-liasse.ejs` | web-view | `src/web/views/pages/fiscalite/recap-annuel.ejs` (layout + breadcrumbs + sections + tableaux) | exact | `<%- include('../../../partials/layout-debut', { titre, breadcrumbs, navActive: 'fiscalite' }) %>` + sections sémantiques + `partial-bandeau-*` |
| `src/web/views/pages/biens/cfe/nouvelle.ejs` | web-view (form création) | `src/web/views/pages/fiscalite/activer-fiscalite.ejs` | role-match | Layout + `form-field.ejs` × 5 + CTA primary + lien Annuler secondary |
| `src/web/views/pages/biens/cfe/editer.ejs` | web-view (form édition) | `src/web/views/pages/locataires/formulaire.ejs` (mode='edition') | role-match | Idem `nouvelle.ejs` avec valeurs pré-remplies depuis `DeclarationCfe` chargée |
| `src/web/views/partials/partial-bandeau-brouillon-liasse.ejs` | web-view-partial (S1 UI-SPEC) | `src/web/views/partials/partial-indexation-banner.ejs` | exact | `<aside role="status" aria-live="polite" style="...">` + icône `aria-hidden="true"` + fond `--couleur-accent-bg` |
| `src/web/views/partials/partial-bandeau-rectificative.ejs` | web-view-partial (S6) | `src/web/views/partials/banniere-warning.ejs` | exact | Pattern `if (locals.message)` + `role="status"` + fond `--couleur-warning-bg` + `bord gauche 4px` |
| `src/web/views/partials/partial-bandeau-reconciliation.ejs` | web-view-partial (S5 CRITIQUE) | `src/web/views/partials/partial-indexation-banner.ejs` (banner contextuel conditionnel) + `banniere-warning.ejs` (variantes) | role-match | `<aside role="alert" aria-live="assertive">` + fond `--couleur-destructive-bg` + lien drill-down — rendu seulement si `nbPiecesModifiees > 0` |
| `src/web/views/partials/partial-tableau-liasse-section.ejs` | web-view-partial (S2) | `src/web/views/partials/data-table.ejs` (4 colonnes + sticky thead + zébrures) | exact | `<%- include('data-table', { ariaLabel: 'Annexe 2033-B — Compte de résultat', colonnes, lignes }) %>` |
| `src/web/views/partials/partial-drill-down-sources.ejs` | web-view-partial (S4) | absent (innovation Phase 6) — pattern `<details>` natif | partial | `<details><summary role="button" class="secondary">Voir N sources</summary><ul>...</ul></details>` — 0 JS framework |
| `src/web/views/partials/partial-bandeau-cfe-echeance.ejs` | web-view-partial (S10 banner J-30) | `src/web/views/partials/partial-indexation-banner.ejs` | **exact (clone)** | `<aside role="status" aria-live="polite">` (J-30→J-7) ou `<aside role="alert" aria-live="assertive">` (J+1+) + gradient warning→destructive |
| `src/web/views/partials/partial-carte-cfe.ejs` | web-view-partial (S8 card) | `src/web/views/partials/partial-composant-row.ejs` (carte avec en-tête + détails + actions) | role-match | Section `<article>` ou `<div>` + badge statut + date + Money formatée + lien Modifier `.row-actions` |
| `src/web/views/partials/partial-badge-statut-cfe.ejs` | web-view-partial | `src/web/views/partials/partial-badge-qualification.ejs` (badge coloré + icône doublant texte) | exact | `<span class="badge badge-{couleur}" aria-label="...">{icône} {libellé}</span>` — couleur selon statut, icône ✓⚠✕ `aria-hidden="true"` |
| `src/web/views/partials/partial-aide-cfe.ejs` | web-view-partial (S9 pédagogie) | `src/web/views/partials/partial-onboarding-banner.ejs` | role-match | `<details><summary>Aide</summary><div>...<a href="https://impots.gouv.fr/contacts" target="_blank" rel="noopener noreferrer">...</a></div></details>` |
| `src/web/helpers/formater-case-liasse.ts` | web-helper | `src/web/helpers/content-disposition.ts` + helpers Phase 5 `format-money.ts` | role-match | Fonction pure exportée : `formaterCaseLiasse(numero: string): string` retourne HTML monospace 14px |
| `src/web/helpers/formater-statut-cfe.ts` | web-helper | helper Phase 5 `formater-categorie-charge.ts` (mapping enum → libellé fr) | role-match | `formaterStatutCfe(statut: StatutCfe): string` — switch ou Record |
| `src/web/helpers/formater-millesime-cfe.ts` | web-helper | helper `formater-annee-fiscale.ts` | role-match | `formaterMillesimeCfe(millesime: number): string` → `"CFE {millesime}"` |
| `src/web/helpers/jours-avant-echeance.ts` | web-helper (Clock) | absent direct — pattern Phase 3 banner IRL D-90 | partial | `joursAvantEcheance(date: Temporal.PlainDate, clock: Clock): number` via `clock.aujourdhui().until(date, { largestUnit: 'day' }).days` |

### Bloc 8 — Tests BDD + builders + fakes

| Nouveau fichier | Rôle | Plus proche analog | Match | Pattern clé |
|---|---|---|---|---|
| `tests/bdd/features/brouillon-liasse-reel.feature` | test-feature | `tests/bdd/features/fiscalite-cloture.feature` | exact | `Feature: ...` + `Background:` + tags `@phase6 @fis-05` + `Scenario:` Given/When/Then en français |
| `tests/bdd/features/brouillon-liasse-micro.feature` | test-feature | `tests/bdd/features/fiscalite-micro-bic.feature` | exact | Idem — focus 2042 C PRO `5NI` |
| `tests/bdd/features/liasse-rectificative.feature` | test-feature | `tests/bdd/features/fiscalite-declaration-corrigee.feature` | exact | Scénario sur `DeclarationCorrigee` + bandeau motif + originale intacte |
| `tests/bdd/features/liasse-tracabilite.feature` | test-feature | `tests/bdd/features/fiscalite-exports.feature` | role-match | Scénario drill-down + scénario réconciliation snapshot ≠ vivant + filtrage `QUALIFICATIONS_DEDUCTIBLES` |
| `tests/bdd/features/mapping-liasse-versionne.feature` | test-feature | scénario fail-fast in `fiscalite-cloture.feature` (`RegleFiscaleAbsente`) | role-match | `Given exercice 2027 Then MappingLiasseAbsent levée` |
| `tests/bdd/features/cfe-suivi-declaratif.feature` | test-feature | `tests/bdd/features/fiscalite-lmp-detection.feature` (statuts + transitions) | role-match | Scénarios par statut CFE (5 valeurs) + invariants statut↔dates |
| `tests/bdd/features/cfe-alerte-echeance.feature` | test-feature | scénarios IRL banner D-90 Phase 3 | role-match | 5 scénarios déterministes via `Clock` fixe : J-15+`non_deposee` → warning ; J-5+`payee` → aucun ; J+10+`non_deposee` → destructive |
| `tests/bdd/step_definitions/brouillon-liasse.steps.ts` | test-step-definitions | step_definitions Phase 5 `fiscalite-cloture.steps.ts` | exact | `Given('...', ...) / When('...', ...) / Then('...', ...)` + `this.world.X` |
| `tests/bdd/step_definitions/cfe.steps.ts` | test-step-definitions | idem | exact | idem |
| `tests/_builders/fiscalite.ts` *(extension)* | test-builder | `tests/_builders/fiscalite.ts` (existant L34-85) | exact | Functions `uneDeclarationCfe(overrides) / unMappingLiasse2026(overrides)` retournant entité domaine pré-construite |
| `tests/unit/fiscalite/declaration-cfe.test.ts` | test-unit | `tests/unit/fiscalite/declaration-annuelle.test.ts` | exact | Vitest `describe / it / expect` + fact-check sur factory + invariants |
| `tests/unit/fiscalite/reconciliation.test.ts` | test-unit | + `fast-check` propriétés sur `Money` (Phase 5 plan) | role-match | Tests déterministes + propriétés `@fast-check/vitest` sur `reconcilier()` (idempotence, commutativité) |
| `tests/integration/repositories/declaration-cfe-repository-sqlite.test.ts` | test-integration | `tests/integration/repositories/declaration-annuelle-repository-sqlite.test.ts` | exact | DB éphémère + round-trip `creer → enregistrer → trouverParId` + assert égalité valeurs Money/Temporal |

---

## Pattern Assignments

### Pattern critique 1 — Port versionné `MappingLiasseProvider` (miroir exact `RegleFiscaleProvider`)

**Source code à cloner :** `src/domain/fiscalite/regles/regle-fiscale-provider.ts` + `src/domain/fiscalite/regles/regles-2026.ts`

**Excerpt — Port (regle-fiscale-provider.ts L21-63) :**
```typescript
export interface RegleFiscaleProvider {
  /**
   * @throws {RegleFiscaleAbsente} si l'année n'est pas couverte
   */
  pour(annee: number): RegleFiscale2026;
}

export class RegleFiscaleProviderEnMemoire implements RegleFiscaleProvider {
  private readonly _regles: Map<number, RegleFiscale2026>;

  constructor() {
    this._regles = new Map<number, RegleFiscale2026>([
      [2026, REGLES_2026],
      [2027, REGLES_2026], // même révision triennale 2026-2028
      [2028, REGLES_2026],
    ]);
  }

  pour(annee: number): RegleFiscale2026 {
    const regles = this._regles.get(annee);
    if (!regles) {
      throw new RegleFiscaleAbsente(annee);
    }
    return regles;
  }
}
```

**Excerpt — Data file (regles-2026.ts L48-65 + L77-139) :**
```typescript
export interface RegleFiscale2026 {
  /** Seuil recettes micro-BIC longue durée — CGI art. 50-0 */
  readonly SEUIL_MICRO_BIC_LONGUE_DUREE: Money;
  // ...
}

export const REGLES_2026: RegleFiscale2026 = {
  SEUIL_MICRO_BIC_LONGUE_DUREE: Money.fromCentimes(8_360_000n),
  // ...
} as const;
```

**À reproduire pour Phase 6 (`mapping-liasse-provider.ts` + `mapping-liasse-2026.ts`) :**

1. Interface `MappingLiasseProvider` avec méthode unique `pour(millesime: number): MappingLiasse2026`.
2. Classe `MappingLiasseProviderEnMemoire` avec `Map<number, MappingLiasse2026>` — **MAIS différence critique** : un seul millésime couvert au démarrage (`[2026, MAPPING_LIASSE_2026]`) car le cerfa peut changer chaque année (vs. seuils fiscaux triennaux). JSDoc cite explicitement R1.1 RISKS.md "revue chaque janvier post-LF".
3. Fail-fast `throw new MappingLiasseAbsent(millesime)` (cf. `RegleFiscaleAbsente` L20-25).
4. Data file `mapping-liasse-2026.ts` : interface `MappingLiasse2026` + constante exportée `as const` + JSDoc avec sources (URL impots.gouv.fr + numéros de cerfa officiels).

---

### Pattern critique 2 — Port `BrouillonLiasseBuilder` (miroir exact `RecapFiscalBuilder`)

**Source code à cloner :** `src/domain/fiscalite/recap-fiscal-builder.ts` + `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts`

**Excerpt — Port domaine (recap-fiscal-builder.ts L28-48) :**
```typescript
export interface RecapFiscalBuilder {
  /**
   * Le type concret retourné est `TDocumentDefinitions` (pdfmake),
   * volontairement masqué en `unknown` pour préserver la pureté du
   * domaine (CLAUDE.md règle hexagonale, miroir de PdfRenderer.genererBuffer).
   */
  construire(
    decl: DeclarationAnnuelle,
    bailleur: Bailleur,
    biens: Bien[],
    tableauxAmort: AmortissementExercice[],
  ): unknown;
}
```

**Excerpt — Adapter infrastructure (recap-fiscal-builder-pdfmake.ts L22-31) :**
```typescript
export class RecapFiscalBuilderPdfmake implements RecapFiscalBuilder {
  construire(
    decl: DeclarationAnnuelle,
    bailleur: Bailleur,
    biens: Bien[],
    tableauxAmort: AmortissementExercice[],
  ): unknown {
    return construireRecapFiscal(decl, bailleur, biens, tableauxAmort);
  }
}
```

**À reproduire pour Phase 6 :**

1. `src/domain/fiscalite/liasse/brouillon-liasse-builder.ts` — Interface `BrouillonLiasseBuilder { construire(dto: BrouillonLiasseDto): unknown }`. **Signature plus simple que `RecapFiscalBuilder`** car le DTO est déjà construit côté application (cross-BC agrégation est dans le use case).
2. `src/infrastructure/pdf/brouillon-liasse-builder-pdfmake.ts` — Classe qui implémente le port, délègue à `construireBrouillonLiasse(dto)` fonction pure (dans `brouillon-liasse-doc-def.ts`).
3. Réutiliser `pdf-renderer-pdfmake.ts` existant pour `genererBuffer(docDef: unknown): Promise<Buffer>` — **zéro modification**.

---

### Pattern critique 3 — Agrégat racine `DeclarationCfe` (référence `BienId` par identifiant, factory + invariants)

**Source code à cloner :** `src/domain/travaux/ticket-travaux.ts` (référence `BienId` par identifiant — pattern à reproduire EXACTEMENT)

**Excerpt — Imports + brand types (ticket-travaux.ts L1-19) :**
```typescript
import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauTicketTravauxId,
  type BienId,
  type TicketTravauxId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
```

**Excerpt — Constants + Props (ticket-travaux.ts L23-31, L47-65) :**
```typescript
export type StatutTicket = 'ouvert' | 'en_cours' | 'clos' | 'annule';

export const STATUTS_TICKET_VALIDES: readonly StatutTicket[] = [
  'ouvert', 'en_cours', 'clos', 'annule',
] as const;

export interface TicketTravauxProps {
  id?: TicketTravauxId;
  bienId: BienId;
  // ...
}
```

**Excerpt — Factory + invariants (ticket-travaux.ts L124-171) :**
```typescript
static creer(
  props: TicketTravauxProps,
  today: Temporal.PlainDate,
): TicketTravaux {
  if (props.titre.trim().length === 0) {
    throw new InvariantViolated('Le titre du ticket est obligatoire.');
  }
  // ... autres invariants
  const id = props.id ?? nouveauTicketTravauxId();
  return new TicketTravaux(id, { ... });
}
```

**Excerpt — `'field' in patch` pattern (DeclarationAnnuelle.ts pour champs nullables, RESEARCH.md L498-510) :**
```typescript
modifier(patch: Partial<...>): DeclarationCfe {
  return DeclarationCfe.creer({
    id: this.id,
    bienId: this.bienId,
    millesime: this.millesime,
    statut: 'statut' in patch ? patch.statut as StatutCfe : this.statut,
    dateDepotDeclaration: 'dateDepotDeclaration' in patch
      ? patch.dateDepotDeclaration as Temporal.PlainDate | null
      : this.dateDepotDeclaration,
    // ... pattern `'field' in patch` (pas `??`) pour permettre l'effacement explicite avec null
  });
}
```

**À reproduire pour Phase 6 — `declaration-cfe.ts` :**

1. **Imports identiques** : `Temporal`, `InvariantViolated`, brand types `BienId`/`DeclarationCfeId` depuis `_shared/identifiants.ts`, `Money`.
2. **Type `StatutCfe`** union strict 5 valeurs (`'non_deposee' | 'deposee' | 'exoneree_premiere_annee' | 'exoneree_commune' | 'payee'`) + tableau `STATUTS_CFE_VALIDES`.
3. **Référence `BienId` par identifiant** — pas un sous-agrégat de `Bien` (D-CFE6.2). Cycle de vie indépendant + queryable séparément pour banner J-30.
4. **Factory `DeclarationCfe.creer()` avec invariants** :
   - `millesime ∈ [2020, 2030]` (intervalle raisonnable, plus permissif que `exercice > 0` car CFE prospective).
   - `statut === 'deposee'` → `dateDepotDeclaration` REQUIRED.
   - `statut === 'payee'` → `dateDepotDeclaration` + `montantAvisCentimes` REQUIRED.
5. **`modifier()` copy-on-write avec pattern `'field' in patch`** — appris Phase 5 plan 01 `bailleur.ts` (évite l'écrasement silencieux quand patch contient `null` explicite pour effacer).
6. **Aucune méthode d'annulation** — CFE n'est pas append-only strict comme `DeclarationAnnuelle`, l'édition permise (transitions de statut normales).

---

### Pattern critique 4 — Banner J-30 (clone exact banner IRL Phase 3 D-90)

**Source code à cloner :** `src/web/views/partials/partial-indexation-banner.ejs`

**Excerpt complet (partial-indexation-banner.ejs) :**
```ejs
<aside role="status" aria-live="polite" style="background: var(--pico-table-row-stripped-background-color); padding: 16px; border-left: 4px solid var(--pico-primary); margin-bottom: 24px;">
  <strong>Révision IRL disponible</strong> depuis le <%= formatDate(dateAnniversaire) %>.
  <a href="/baux/<%= bailId %>/indexer" role="button">Lancer la révision IRL</a>
</aside>
```

**Helper Clock pattern à cloner (RESEARCH.md L518-538) :**
```typescript
// src/web/helpers/jours-avant-echeance.ts
import { Temporal } from '@js-temporal/polyfill';
import type { Clock } from '../../domain/_shared/clock.js';

export function joursAvantEcheance(
  dateEcheance: Temporal.PlainDate,
  clock: Clock,
): number {
  return Temporal.PlainDate.compare(dateEcheance, clock.aujourdhui()) === 0
    ? 0
    : clock.aujourdhui().until(dateEcheance, { largestUnit: 'day' }).days;
}
```

**À reproduire pour Phase 6 — `partial-bandeau-cfe-echeance.ejs` :**

1. **Trois variantes** dans le même partial selon `joursRestants` :
   - J-30 à J-8 : `role="status"` + `--couleur-warning-bg` + `--couleur-warning`.
   - J-7 à J-0 : `role="status"` + même couleur + icône ⚠ visible.
   - J+1 et plus : `role="alert"` + `aria-live="assertive"` + `--couleur-destructive-bg`.
2. **Affichage conditionnel côté route** — calculer `estAlerteActive(d, clock)` AVANT le render. Statut `payee` / `exoneree_*` → banner masqué (pitfall 5 RESEARCH.md L887-901).
3. **Lien externe accent** "Régler la CFE sur impots.gouv.fr" → `target="_blank" rel="noopener noreferrer"`.
4. **Zéro JS** — render conditionnel server-side seulement.

---

### Pattern critique 5 — Route export PDF/CSV (miroir exact `exports.ts`)

**Source code à cloner :** `src/web/routes/fiscalite/exports.ts`

**Excerpt complet — Helper RFC 6266 (exports.ts L44-47) :**
```typescript
function contentDispositionFilename(nomFichier: string): string {
  const encoded = encodeURIComponent(nomFichier);
  return `attachment; filename="${nomFichier}"; filename*=UTF-8''${encoded}`;
}
```

**Excerpt — Pattern route CSV (exports.ts L59-81) :**
```typescript
app.get<{ Params: { id: string } }>(
  '/fiscalite/declarations/:id/csv',
  async (req, reply) => {
    const declarationId = req.params.id as DeclarationAnnuelleId;

    try {
      const { contenu, nomFichier } = await exporterCsvFiscal(
        { declarationId },
        { declRepo },
      );

      return reply
        .type('text/csv; charset=utf-8')
        .header('Content-Disposition', contentDispositionFilename(nomFichier))
        .send(contenu);
    } catch (err) {
      if (err instanceof DeclarationIntrouvable) {
        return reply.status(404).type('text/plain').send('Déclaration introuvable.');
      }
      throw err;
    }
  },
);
```

**Excerpt — CSV body avec mitigation injection (exporter-csv-fiscal.ts L59-117) :**
```typescript
const BOM = '﻿';
const SEP = ';';
const lignes: string[] = [];

lignes.push(`Type${SEP}Montant en euros${SEP}Détail`);
lignes.push(`Recettes annuelles${SEP}${decl.recettesTotales.enEuros()}${SEP}`);
// ... Money.enEuros() (Intl.NumberFormat fr-FR) — mitigation CSV injection T-05-07-04
const contenu = BOM + lignes.join('\n');
```

**À reproduire pour Phase 6 — `src/web/routes/fiscalite/liasse.ts` :**

1. **Trois endpoints GET** : `/fiscalite/declarations/:id/liasse` (HTML), `.../liasse.pdf` (PDF), `.../liasse.csv` (CSV).
2. **Helper `contentDispositionFilename()`** : préférer la version étendue de `src/web/helpers/content-disposition.ts` (`encodeFilenameRFC6266()`) qui gère NFD + ASCII fallback robuste.
3. **CSV étendu Phase 6** : ajouter colonne `sources` listant les IDs (séparés par `|`) — extension du pattern `exporter-csv-fiscal.ts`.
4. **Try/catch** sur `DeclarationIntrouvable` (404), `MappingLiasseAbsent` (422 page d'erreur dédiée — réutilise `pages/erreur.ejs`).
5. **`Content-Type`** : `application/pdf`, `text/csv; charset=utf-8`, `text/html`.

---

### Pattern critique 6 — Repository SQLite append-only (miroir exact `DeclarationAnnuelleRepositorySqlite`)

**Source code à cloner :** `src/infrastructure/repositories/declaration-annuelle-repository-sqlite.ts`

**Excerpt — Type Row + DbOrTrx (L29-45) :**
```typescript
type DbOrTrx = Kysely<DB> | Transaction<DB>;

type Row = {
  id: string;
  bailleur_id: string;
  exercice: number;
  regime_applique: 'micro_bic' | 'reel';
  // ...
  cloture_le: string;  // ISO 8601
};
```

**Excerpt — `enregistrer` avec transaction optionnelle (L61-82) :**
```typescript
async enregistrer(decl: DeclarationAnnuelle, trxArg?: unknown): Promise<void> {
  const db = (trxArg as DbOrTrx | undefined) ?? this.db;
  await db
    .insertInto('declarations_annuelles')
    .values({
      id: decl.id,
      bailleur_id: decl.bailleurId,
      exercice: decl.exercice,
      recettes_totales_centimes: decl.recettesTotales.toSqliteInteger(),
      // ...
      cloture_le: decl.clotureLe.toString(),
    })
    .execute();
  // PAS de .onConflict() — append-only strict (D-FIS-G4.2)
}
```

**Excerpt — `versDomaine` mapping (L121-143) :**
```typescript
private versDomaine(row: Row): DeclarationAnnuelle {
  return DeclarationAnnuelle.creer({
    id: row.id as DeclarationAnnuelleId,
    bailleurId: row.bailleur_id as BailleurId,
    exercice: row.exercice,
    recettesTotales: Money.fromCentimes(BigInt(row.recettes_totales_centimes)),
    // ...
    clotureLe: Temporal.PlainDate.from(row.cloture_le),
    seuilLmpRecettes: REGLES_2026.SEUIL_LMP_RECETTES,
  });
}
```

**À reproduire pour Phase 6 — `declaration-cfe-repository-sqlite.ts` :**

1. **Type `Row`** strict avec colonnes Kysely : `id: string, bien_id: string, millesime: number, statut: string, date_depot_declaration: string | null, montant_avis_centimes: number | null, date_echeance_paiement: string`.
2. **`enregistrer(decl, trxArg?: unknown)`** avec pattern `(trxArg as DbOrTrx | undefined) ?? this.db` — **MAIS différence majeure** : CFE n'est PAS append-only strict. Utiliser `.onConflict((oc) => oc.column('id').doUpdateSet({...}))` ou pattern `upsert` séparé pour permettre `modifier()`.
3. **`versDomaine(row): DeclarationCfe`** : `Money.fromCentimes(BigInt(row.montant_avis_centimes ?? 0))` (ou `null` si centimes null), `Temporal.PlainDate.from(row.date_echeance_paiement)`.
4. **`trouverParBienMillesime(bienId, millesime)`** (équivalent `trouverParBailleurExercice`) — utilisé pour upsert idempotent.
5. **`listerParBien(bienId)`** retourne `DeclarationCfe[]` triées par `millesime DESC`.

---

### Pattern critique 7 — Use case orchestrateur cross-BC (miroir `exporter-pdf-recap.ts`)

**Source code à cloner :** `src/application/fiscalite/exporter-pdf-recap.ts`

**Excerpt — Interface deps + commande + résultat (L42-57) :**
```typescript
export interface ExporterPdfRecapCommande {
  declarationId: DeclarationAnnuelleId;
}

export interface ExporterPdfRecapDeps {
  declRepo: DeclarationAnnuelleRepository;
  bailleurRepo: BailleurRepository;
  bienRepo: BienRepository;
  tableauAmortRepo: TableauAmortissementRepository;
  recapFiscalBuilder: RecapFiscalBuilder;
}

export interface ExporterPdfRecapResultat {
  buffer: Buffer;
  nomFichier: string;
}
```

**Excerpt — Orchestration (L65-103) :**
```typescript
export async function exporterPdfRecap(
  commande: ExporterPdfRecapCommande,
  deps: ExporterPdfRecapDeps,
  pdfRenderer: PdfRenderer,
): Promise<ExporterPdfRecapResultat> {
  const { declRepo, bailleurRepo, bienRepo, tableauAmortRepo, recapFiscalBuilder } = deps;

  // 1. Charger la déclaration
  const decl = await declRepo.trouverParId(declarationId);
  if (decl === null) throw new DeclarationIntrouvablePdf(declarationId);

  // 2. Charger bailleur, biens, tableauxAmort en parallèle
  const bailleur = await bailleurRepo.trouver();
  if (bailleur === null) throw new BailleurIntrouvable();
  const biens = await bienRepo.listerTous();
  const tableauxAmort = await Promise.all(
    biens.map((b) => tableauAmortRepo.listerParBienExercice(b.id, decl.exercice)),
  ).then((listes) => listes.flat());

  // 3. Construire la TDocumentDefinitions via le port
  const docDef = recapFiscalBuilder.construire(decl, bailleur, biens, tableauxAmort);

  // 4. Générer le buffer PDF
  const buffer = await pdfRenderer.genererBuffer(docDef);

  const nomFichier = `recap-fiscal-${decl.exercice}.pdf`;
  return { buffer, nomFichier };
}
```

**À reproduire pour Phase 6 — `generer-brouillon-liasse.ts` :**

1. **Deps interface** : `declRepo`, `declCorrigeeRepo` (rectificative), `mappingProvider: MappingLiasseProvider`, `recettesRepo`, `chargesRepo`, `tableauAmortRepo` (toutes Phase 5 read-only).
2. **Orchestration** :
   - Charger snapshot `DeclarationAnnuelle` ou `DeclarationCorrigee` selon présence param.
   - Résoudre mapping `mappingProvider.pour(decl.exercice)` — fail-fast `MappingLiasseAbsent`.
   - Agréger sources vivantes via `recettesRepo.sommeRecettesAnnuelles(bailleurId, exercice)`, `chargesRepo.sommeChargesParCategorie(bailleurId, exercice)`, `tableauAmortRepo.listerParBienExercice(bienId, exercice)`.
   - **Filtrer `QUALIFICATIONS_DEDUCTIBLES`** (pitfall 7 RESEARCH.md L909-914).
   - Appeler `reconcilier(snapshotMap, sourcesVivantesMap)`.
   - Construire `BrouillonLiasseDto` (annexes 2031-SD + 2033-A/B/C/D ou 2042 C PRO selon `regimeApplique`).
3. **Valeurs des cases = TOUJOURS snapshot** (anti-pattern Phase 5 #3, D-T6.4) — sources vivantes uniquement pour drill-down + réconciliation.

---

### Pattern critique 8 — Erreurs typées domaine (miroir `RegleFiscaleAbsente`)

**Source code à cloner :** `src/domain/fiscalite/erreurs.ts`

**Excerpt — Pattern erreur (L20-25 + L42-47) :**
```typescript
export class RegleFiscaleAbsente extends Error {
  constructor(annee: number) {
    super(`Règles fiscales absentes : année ${annee} hors plage versionnée (2026-2028). Ajouter regles-${Math.ceil(annee / 3) * 3}.ts à la prochaine révision triennale.`);
    this.name = 'RegleFiscaleAbsente';
  }
}

export class DeclarationFigeeException extends Error {
  constructor() {
    super('Déclaration clôturée — créer une DeclarationCorrigee pour modifier les qualifications');
    this.name = 'DeclarationFigeeException';
  }
}
```

**À ajouter Phase 6 (étendre `erreurs.ts` Fiscalité) :**
```typescript
export class MappingLiasseAbsent extends Error {
  constructor(millesime: number) {
    super(`Mapping liasse absent : millésime ${millesime} non couvert. Le cerfa peut changer chaque année (LF) — vérifier le PDF officiel impots.gouv.fr et créer mapping-liasse-${millesime}.ts. (R1.1 RISKS.md)`);
    this.name = 'MappingLiasseAbsent';
  }
}

export class DeclarationCfeIntrouvable extends Error {
  constructor(public readonly id: string) {
    super(`Déclaration CFE introuvable : ${id}`);
    this.name = 'DeclarationCfeIntrouvable';
  }
}
```

---

### Pattern critique 9 — Migration SQLite (miroir `0016_phase5_declaration_annuelle.sql`)

**Source code à cloner :** `migrations/0016_phase5_declaration_annuelle.sql`

**Excerpt complet :**
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS declarations_annuelles (
  id                             TEXT NOT NULL PRIMARY KEY,
  bailleur_id                    TEXT NOT NULL REFERENCES bailleur(id),
  exercice                       INTEGER NOT NULL,
  regime_applique                TEXT NOT NULL CHECK (regime_applique IN ('micro_bic', 'reel')),
  recettes_totales_centimes      INTEGER NOT NULL,
  -- ...
  cloture_le                     TEXT NOT NULL,
  UNIQUE (bailleur_id, exercice)
);

COMMIT;
```

**À reproduire — `migrations/0023_phase6_declaration_cfe.sql` :**
```sql
BEGIN;

CREATE TABLE IF NOT EXISTS declarations_cfe (
  id                             TEXT NOT NULL PRIMARY KEY,
  bien_id                        TEXT NOT NULL REFERENCES biens(id),
  millesime                      INTEGER NOT NULL,
  statut                         TEXT NOT NULL CHECK (statut IN (
    'non_deposee',
    'deposee',
    'exoneree_premiere_annee',
    'exoneree_commune',
    'payee'
  )),
  date_depot_declaration         TEXT NULL,
  montant_avis_centimes          INTEGER NULL,
  date_echeance_paiement         TEXT NOT NULL,
  UNIQUE (bien_id, millesime)
);

COMMIT;
```

Note : `UNIQUE (bien_id, millesime)` — une seule déclaration CFE par bien × millésime (upsert idempotent).

---

### Pattern critique 10 — Réconciliation snapshot vs vivant (fonction pure)

**Source code à étudier (RESEARCH.md L564-616) — concept nouveau Phase 6 mais styles déjà éprouvés :**

```typescript
// src/domain/fiscalite/reconciliation.ts
import { Money } from '../_shared/money.js';

export interface EcartReconciliationParCase {
  readonly caseId: string;
  readonly valeurSnapshot: Money;
  readonly valeurVivante: Money;
  readonly ecart: Money;
}

export interface ResultatReconciliation {
  readonly cohérent: boolean;
  readonly nbPiecesModifiees: number;
  readonly ecartsParCase: ReadonlyArray<EcartReconciliationParCase>;
}

export function reconcilier(
  snapshot: ReadonlyMap<string, Money>,
  sourcesVivantes: ReadonlyMap<string, Money>,
): ResultatReconciliation {
  const ecarts: EcartReconciliationParCase[] = [];
  for (const [caseId, valeurSnap] of snapshot) {
    const valeurViv = sourcesVivantes.get(caseId) ?? Money.zero();
    if (!valeurSnap.egale(valeurViv)) {
      ecarts.push({
        caseId,
        valeurSnapshot: valeurSnap,
        valeurVivante: valeurViv,
        ecart: valeurViv.soustraire(valeurSnap),
      });
    }
  }
  return {
    cohérent: ecarts.length === 0,
    nbPiecesModifiees: ecarts.length,
    ecartsParCase: ecarts,
  };
}
```

**Caractéristiques** :
- **Fonction pure** : aucune dépendance (pas de Clock, pas de repo).
- **Tolérance strict 0 centime** (Money BigInt comparaison exacte). Si V1.1 montre des faux positifs → relâcher à `|ecart| ≤ 1 centime`.
- **Anti-pattern absolu** : NE JAMAIS retourner la valeur vivante comme "valeur corrigée". Le résultat est un signal, pas une nouvelle valeur (D-T6.4 + Phase 5 anti-patterns #3 + #4).
- **Couverture BDD 100 %** : scénarios dédiés pour `Σ vivant > snapshot`, `Σ vivant < snapshot`, `Σ vivant = snapshot`.

---

## Shared Patterns (cross-cutting)

### Imports critiques (toujours en tête)

```typescript
import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauDeclarationCfeId,
  type BienId,
  type DeclarationCfeId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import type { Clock } from '../_shared/clock.js';
```

### Money — règles non négociables

| Règle | Source |
|---|---|
| BigInt centimes partout dans domain/fiscalite/ | D-09 Phase 1, `regles-2026.ts` JSDoc |
| Construction : `Money.fromCentimes(8_360_000n)` ou `Money.fromEuros(83_600)` | `regles-2026.ts` L83 |
| Mitigation CSV injection : `Money.enEuros()` (Intl.NumberFormat fr-FR) → `"800,50 €"` jamais `=`/`@`/`+`/`-` | `exporter-csv-fiscal.ts` JSDoc + T-05-07-04 |
| Comparaison : `.egale()`, `.lt()`, `.superieurA()`, jamais `===` | `declaration-annuelle.ts` L101 |
| Arithmétique : `.additionner()`, `.soustraire()`, `.multiplyByFraction(num, den)` | `regles-2026.ts` JSDoc |
| Sérialisation SQLite : `.toSqliteInteger()` (number ≤ 2^53 acceptable V1) | `declaration-annuelle-repository-sqlite.ts` L70 |

### Temporal — règles non négociables

| Règle | Source |
|---|---|
| `Temporal.PlainDate` partout (pas Date JS) | D-12 Phase 1 |
| Round-trip SQLite : `.toString()` (ISO) ↔ `Temporal.PlainDate.from(rowText)` | `declaration-annuelle-repository-sqlite.ts` L78 + L138 |
| Comparaison : `Temporal.PlainDate.compare(a, b)` (retourne -1/0/1) | `ticket-travaux.ts` L134, L194 |
| Différence en jours : `dateA.until(dateB, { largestUnit: 'day' }).days` | RESEARCH.md L536 (`joursAvantEcheance`) |
| `Clock` injecté pour déterminisme BDD (jamais `Temporal.Now.plainDateISO()` direct dans le domaine) | `clock.ts` L7-9 |

### Brand types (TypeScript pattern)

| Pattern | Source |
|---|---|
| `export type DeclarationCfeId = string & { readonly __brand: 'DeclarationCfeId' };` | `identifiants.ts` L4 |
| `export function nouveauDeclarationCfeId(): DeclarationCfeId { return crypto.randomUUID() as DeclarationCfeId; }` | `identifiants.ts` L11-13 |
| Validation : `UUID_V4_REGEX` (à réutiliser si guard nécessaire) | `identifiants.ts` L9 |

### Factory + Invariants (pattern obligatoire)

| Étape | Source |
|---|---|
| `private constructor(id, props)` — pas d'instanciation directe | `ticket-travaux.ts` L105-122 |
| `static creer(props): X` — seul point d'entrée | `declaration-annuelle.ts` L94 |
| Validations avant `new X(...)` — `throw new InvariantViolated('...')` | `declaration-annuelle.ts` L95-117 |
| ID auto-généré si absent : `const id = props.id ?? nouveauX();` | `ticket-travaux.ts` L153 |
| `toProps()` pour sérialisation tests + audit trail | `declaration-annuelle.ts` L137 |
| Copy-on-write `.modifier(patch)` → `return X.creer({ ...this.toProps(), ...patch });` | `bailleur.ts` (Phase 5) + RESEARCH.md L492-507 |

### Zod schemas (aux frontières HTTP UNIQUEMENT)

| Pattern | Source |
|---|---|
| `z.object({...})` + `safeParse(body)` | `bien-schemas.ts` (Phase 1) |
| Dates ISO : `z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ requis')` | `fiscalite-schemas.ts` L17, L147 |
| Money (euros → centimes côté serveur) : `z.coerce.number().min(0.01)` | `fiscalite-schemas.ts` L83 |
| Enum statut : `z.enum(['non_deposee', 'deposee', ...])` | `fiscalite-schemas.ts` L51 |
| Borne millésime : `z.coerce.number().int().min(2020).max(2030)` | `fiscalite-schemas.ts` L95-96 (exercice) |
| **JAMAIS de Zod dans le domaine** — invariants via `InvariantViolated` | D-15 Phase 1 + CLAUDE.md règle hexagonale |

### Layout EJS + helpers

```ejs
<%- include('../../../partials/layout-debut', {
  titre: 'Brouillon liasse fiscale ' + declaration.exercice,
  breadcrumbs: breadcrumbs,
  navActive: 'fiscalite'
}) %>

<%- include('../../../partials/sidebar-nav', { navActive: 'fiscalite' }) %>

<section aria-label="Brouillon liasse fiscale <%= declaration.exercice %>">
  <!-- contenu -->
</section>

<%- include('../../../partials/layout-fin') %>
```

| Helper | Signature | Source |
|---|---|---|
| `formatMoney(money: Money): string` | retourne `"800,50 €"` | Phase 5 helper existant |
| `formatDate(date: Temporal.PlainDate): string` | retourne `"15/12/2026"` | Phase 5 helper existant |
| `formaterCaseLiasse(numero: string): string` | retourne HTML monospace 14px | **NOUVEAU Phase 6** |
| `formaterStatutCfe(statut: StatutCfe): string` | mapping libellé fr | **NOUVEAU Phase 6** |
| `joursAvantEcheance(date, clock): number` | calcul Clock-aware | **NOUVEAU Phase 6** |

---

## Anti-patterns à NE PAS reproduire (interdictions absolues)

### Du domaine

1. **NE JAMAIS** importer `pdfmake`, `kysely`, `fastify`, `fs`, `path`, `zod`, ou tout module Node natif dans `src/domain/fiscalite/` → CLAUDE.md "Domaine pur — Ports & Adapters strict" + `dependency-cruiser` exit 0.
2. **NE JAMAIS** créer un sous-agrégat `Bien.declarationsCfe[]` → `DeclarationCfe` est agrégat racine BC Fiscalité (D-CFE6.2) avec référence `BienId` par identifiant — pattern `TicketTravaux → BienId`.
3. **NE JAMAIS** hardcoder un numéro de case cerfa dans un use case ou une vue EJS → toujours via `mappingProvider.pour(millesime)` (D-L6.3, pitfall 1 RESEARCH.md L854-859).
4. **NE JAMAIS** muter un snapshot Phase 5 (`DeclarationAnnuelle`, `DeclarationCorrigee`, `AmortissementExercice`) — append-only strict (D-FIS-G4.2, pitfall 4 RESEARCH.md L879-884).
5. **NE JAMAIS** recalculer une valeur de case dans la vue UI → la valeur affichée vient TOUJOURS du snapshot, la fonction `reconcilier()` produit un signal pas une nouvelle valeur (D-T6.4, anti-pattern Phase 5 #3, pitfall 2 RESEARCH.md L862-866).
6. **NE JAMAIS** créer un cron / setInterval / daemon pour le banner CFE J-30 → calcul à la demande via `Clock` injecté (D-CFE6.5, pattern Phase 3 D-90).

### De l'application

7. **NE JAMAIS** inclure des charges `non_qualifie` ou `non_deductible` dans la somme des sources vivantes (pitfall 7 RESEARCH.md L909-914) → filtrer via `QUALIFICATIONS_DEDUCTIBLES = ['entretien_reparation', 'amelioration', 'charge_courante_periodique']`.
8. **NE JAMAIS** auto-appliquer un mapping antérieur silencieusement (ex : générer 2027 avec MAPPING_LIASSE_2026) → fail-fast `MappingLiasseAbsent` obligatoire (pitfall 6 RESEARCH.md L902-907).
9. **NE JAMAIS** calculer la base imposable CFE → relève de la commune via SIE (D-CFE6.4, R4.3 RISKS.md pédagogie sans fausse précision).
10. **NE JAMAIS** reproduire le formulaire 1447-C-SD case-par-case (D-CFE6.1) → l'app trace uniquement statut / dates / montant, pas un assistant de remplissage.

### De l'infrastructure / web

11. **NE JAMAIS** créer un bouton "Re-calculer" sur le bandeau de réconciliation (D-T6.4, UI-SPEC §S5) — le snapshot est immuable par décision D-FIS-G4.2.
12. **NE JAMAIS** afficher le banner J-30 si statut `payee` / `exoneree_premiere_annee` / `exoneree_commune` (pitfall 5 RESEARCH.md L887-901) — filtrer dans `estAlerteActive()` AVANT render.
13. **NE JAMAIS** introduire de nouveau token CSS / nouvelle font / nouvelle couleur (UI-SPEC §Design System verrouillé) — réutiliser strictement `--couleur-accent`, `--couleur-warning`, `--couleur-destructive`, `--couleur-success` Phase 4 UI-1.3.
14. **NE JAMAIS** importer un schéma Zod dans le domaine (D-15) — Zod **uniquement** dans `web/schemas/cfe-schemas.ts`.
15. **NE JAMAIS** générer un CSV sans BOM UTF-8 + séparateur `;` + `Money.enEuros()` (mitigation injection T-05-07-04) — réutiliser le pattern `exporter-csv-fiscal.ts`.

### Du scope

16. **NE JAMAIS** implémenter les annexes 2033-E (CVAE) / 2033-F (capital social) / 2033-G (filiales) → V1.1 ou exclues (D-A6.1).
17. **NE JAMAIS** implémenter la déclaration modificative CFE 1447-M-SD → V1.1.
18. **NE JAMAIS** implémenter l'export EDI-TDFC ou la télédéclaration → V2 (EDI-01).
19. **NE JAMAIS** implémenter la liasse différentielle avant/après (D-L6.5) → V1 reste sur "même format + bandeau motif".
20. **NE JAMAIS** implémenter le dashboard consolidé des échéances (CFE + IRL + diagnostics) → Phase 7 (DAS-02). Phase 6 ne pose que le banner CFE contextuel.

---

## No Analog Found

Fichiers Phase 6 sans analog exact dans Phases 1-5 (le planner peut s'appuyer sur RESEARCH.md §Pattern 5 et §Cerfa Case Mapping pour les figer) :

| Fichier | Rôle | Raison | Stratégie |
|---|---|---|---|
| `src/domain/fiscalite/reconciliation.ts` | domain-fonction-pure | Concept nouveau Phase 6 (réconciliation snapshot vs vivant) | Pattern stylé `reconcilier(snapshot, vivant): ResultatReconciliation` détaillé RESEARCH.md L564-616. Fonction pure, aucune dépendance. |
| `src/domain/fiscalite/liasse/case-liasse.ts` *(types DTO)* | domain-types | Types DTO traçabilité spécifiques Phase 6 | Inspiration : interfaces VO existantes `AmortissementExercice.ts` (immuabilité + types unions stricts). |
| `src/web/views/partials/partial-drill-down-sources.ejs` | web-view-partial | Innovation Phase 6 (HTML `<details>` natif, 0 JS) | Pas d'analog direct. Pattern HTML5 natif : `<details><summary role="button">Voir N sources</summary>...</details>`. |
| `src/web/views/partials/partial-bandeau-reconciliation.ejs` | web-view-partial CRITIQUE audit | Concept nouveau (signal D-T6.4) | Pas d'analog direct. Composé : `<aside role="alert" aria-live="assertive">` + fond `--couleur-destructive-bg` + lien drill-down (anti-pattern : pas de bouton "Re-calculer"). |

---

## Metadata

**Analog search scope:**
- `src/domain/{_shared,fiscalite,travaux,locatif,identite,patrimoine,encaissements,documents}/`
- `src/application/fiscalite/`
- `src/infrastructure/{repositories,pdf,db}/`
- `src/web/{routes,views,helpers,schemas}/`
- `migrations/`
- `tests/{_builders,bdd/features,unit,integration}/`

**Files scanned:** ~120 fichiers TypeScript + EJS + SQL.

**Pattern extraction date:** 2026-06-02

**Total nouveaux fichiers Phase 6 cartographiés :** ~50 (8 blocs).

**Coverage :**
- Exact match (pattern miroir) : 22 fichiers
- Role match : 21 fichiers
- Partial / nouveaux concepts : 7 fichiers

---

## PATTERN MAPPING COMPLETE

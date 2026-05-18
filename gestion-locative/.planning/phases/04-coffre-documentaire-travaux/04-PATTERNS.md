# Phase 4: Coffre documentaire & Travaux — Pattern Map

**Mapped:** 2026-05-18
**Files analyzed:** 53 (32 src + 9 EJS + 4 helpers + 8 tests/builders/features)
**Analogs found:** 53/53 (exact ou role-match — projet 100 % couvert par Phases 1-3)

> Convention : tous les chemins sont relatifs à `/Users/valentinshodo/Projects/toolbox/gestion-locative/`.

---

## File Classification

### Domain layer — BC Documents (12 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/domain/_shared/identifiants.ts` (extension) | utility | transform | `src/domain/_shared/identifiants.ts` lines 36-54 (Phase 3 extension pattern) | exact (extension du fichier lui-même) |
| `src/domain/documents/justificatif.ts` | model (agrégat racine) | transform | `src/domain/encaissements/quittance.ts` | exact (mêmes props : ID + chemin fichier + dates + soft-delete) |
| `src/domain/documents/justificatif-repository.ts` | model (port) | CRUD | `src/domain/encaissements/quittance-repository.ts` | exact |
| `src/domain/documents/stockage-justificatifs.ts` | model (port file I/O) | file-I/O | `src/domain/encaissements/pdf-renderer.ts` (port interface pure) + sémantique `StockageFichierLocal` adapter | role-match (nouveau port domain par D-106) |
| `src/domain/documents/convertisseur-image.ts` | model (port) | transform | `src/domain/encaissements/pdf-renderer.ts` (même structure : interface pure 1 méthode, isolation lib externe) | role-match |
| `src/domain/documents/erreurs.ts` (nouveau) | utility | transform | `src/domain/encaissements/erreurs.ts` | exact (classes d'erreur métier) |
| `src/application/documents/uploader-justificatif.ts` | service (use case) | file-I/O + CRUD | `src/application/encaissements/generer-quittance.ts` | exact (mêmes 3 étapes : valide → transaction → écriture fichier hors transaction avec compensation) |
| `src/application/documents/mettre-justificatif-en-corbeille.ts` | service (use case) | transform | `src/application/encaissements/annuler-quittance.ts` | exact (soft-delete copy-on-write + Clock) |
| `src/application/documents/restaurer-justificatif.ts` | service (use case) | transform | `src/application/encaissements/annuler-encaissement.ts` (idem soft-delete inverse) | role-match |
| `src/application/documents/purger-justificatif.ts` | service (use case) | file-I/O + CRUD | `src/application/encaissements/generer-quittance.ts` (transaction + cleanup fichier) + `Diagnostic.estExpire(today)` (port Clock + comparaison date) | role-match (combinaison de patterns) |
| `src/application/documents/rechercher-justificatifs.ts` | service (use case) | CRUD | `src/application/encaissements/lister-impayes.ts` (filtres optionnels) | role-match |
| `src/application/documents/lire-justificatif.ts` | service (use case) | CRUD | `src/application/encaissements/lister-encaissements.ts` | role-match (lookup simple) |
| `src/application/documents/modifier-justificatif.ts` | service (use case) | transform | `src/application/locatif/modifier-bail.ts` (patch métadonnées) | role-match |

### Domain layer — BC Travaux (7 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/domain/travaux/ticket-travaux.ts` | model (agrégat racine) | transform | `src/domain/encaissements/encaissement.ts` (soft-delete `annule_le`) + `src/domain/locatif/etat-des-lieux.ts` (type discriminant, statuts) | exact (combo des deux : soft-delete + statut enum) |
| `src/domain/travaux/ticket-travaux-repository.ts` | model (port) | CRUD | `src/domain/encaissements/encaissement-repository.ts` | exact |
| `src/domain/travaux/erreurs.ts` | utility | transform | `src/domain/encaissements/erreurs.ts` | exact |
| `src/application/travaux/creer-ticket-travaux.ts` | service (use case) | CRUD | `src/application/encaissements/creer-encaissement.ts` | exact (vérifie existence bien → crée agrégat → persiste) |
| `src/application/travaux/ajouter-pj-ticket.ts` | service (use case) | CRUD | `src/application/encaissements/creer-encaissement.ts` (cross-aggregate lookup) — **pas d'analog 100 % parfait** : c'est une jointure N:N nouvelle pour la base de code | role-match (combiner BienRepo lookup + jointure SQL directe) |
| `src/application/travaux/clore-ticket-travaux.ts` | service (use case) | transform | `src/application/encaissements/annuler-quittance.ts` (transition copy-on-write) | exact |
| `src/application/travaux/annuler-ticket-travaux.ts` | service (use case) | transform | `src/application/encaissements/annuler-encaissement.ts` | exact |
| `src/application/travaux/lister-tickets-par-bien.ts` | service (use case) | CRUD | `src/application/encaissements/lister-encaissements.ts` | exact |
| `src/application/travaux/lire-ticket.ts` | service (use case) | CRUD | `src/application/encaissements/lister-impayes.ts` (lookup par id) | role-match |

### Infrastructure layer (4 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/infrastructure/storage/stockage-justificatifs-local.ts` | service (adapter file I/O) | file-I/O | `src/infrastructure/storage/stockage-fichier-local.ts` | exact (port spécifique à porter — anti-path-traversal WR-03 ligne 39-81 à copier) |
| `src/infrastructure/image/convertisseur-image-sharp.ts` | service (adapter) | transform | `src/infrastructure/pdf/pdf-renderer-pdfmake.ts` (nouveau dossier `image/`, lib externe wrappée) | role-match |
| `src/infrastructure/repositories/justificatif-repository-sqlite.ts` | service (adapter repo) | CRUD | `src/infrastructure/repositories/quittance-repository-sqlite.ts` (chemins fichier + soft-delete) + `src/infrastructure/repositories/encaissement-repository-sqlite.ts` (Money + soft-delete) | exact (mix soft-delete `quittance` + Money centimes `encaissement`) |
| `src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts` | service (adapter repo) | CRUD | `src/infrastructure/repositories/encaissement-repository-sqlite.ts` | exact (Money + soft-delete `annule_le`) |
| `migrations/0010_phase4_documents_travaux.sql` | config (migration SQL) | batch | `migrations/0008_phase3_edl.sql` + `migrations/0005_phase2_quittance.sql` | exact (3 tables + index, idempotent CREATE IF NOT EXISTS, BEGIN/COMMIT) |

> **Note nomenclature migration** : Phases 1-3 ont consommé `0001` → `0009`. La prochaine migration Phase 4 sera donc `0010_phase4_documents_travaux.sql` (et non `0004_*` comme indiqué initialement par erreur dans CONTEXT — confirmé par l'inventaire `migrations/`).

### Web layer — Routes (3 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/web/routes/coffre.ts` | route | request-response | `src/web/routes/quittances.ts` (CRUD + filtres + download PDF) + `src/web/routes/diagnostics.ts` (form Zod + redirect + extraireErreurs) | exact |
| `src/web/routes/justificatifs.ts` | route | request-response + streaming | `src/web/routes/quittances.ts` lignes 164-186 (`GET /quittances/:id/pdf` streaming buffer + Content-Disposition) | exact (download endpoint identique) |
| `src/web/routes/travaux.ts` | route | request-response | `src/web/routes/etats-des-lieux.ts` (routes contextuelles par parent `/baux/:id/edl/*`) + `src/web/routes/diagnostics.ts` (form + extraireErreurs) | exact |

### Web layer — Schemas Zod (2 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/web/schemas/justificatif-schemas.ts` | utility (validation) | transform | `src/web/schemas/diagnostic-schemas.ts` (enum + superRefine pour invariants conditionnels) + `src/web/schemas/edl-schemas.ts` (form complexe) | exact (mix enum + superRefine pour invariant ≥1 non-null `bienId`/`locataireId`) |
| `src/web/schemas/ticket-travaux-schemas.ts` | utility (validation) | transform | `src/web/schemas/encaissement-schemas.ts` (Money + Temporal + enum) | exact |

### Web layer — EJS pages (10 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/web/views/pages/coffre/liste.ejs` | component (vue liste) | transform | `src/web/views/pages/quittances/liste.ejs` (table + empty state + format helpers) + `src/web/views/pages/biens/liste.ejs` (data-table partial) | exact |
| `src/web/views/pages/coffre/corbeille.ejs` | component (vue liste filtrée) | transform | `src/web/views/pages/quittances/liste.ejs` (mêmes patterns avec `inclureAnnulees:true`) | role-match |
| `src/web/views/pages/coffre/upload.ejs` | component (form multipart) | transform | `src/web/views/pages/biens/diagnostics/formulaire.ejs` (form 1 colonne + Zod erreurs preservés) | role-match (à compléter par UI-SPEC §Upload flow) |
| `src/web/views/pages/justificatifs/detail.ejs` | component (vue fiche) | transform | `src/web/views/pages/quittances/fiche.ejs` (méta + actions + PDF download) | exact |
| `src/web/views/pages/justificatifs/modifier.ejs` | component (form édition) | transform | `src/web/views/pages/biens/formulaire.ejs` mode `modification` (lignes 1-19, 21-66) | exact |
| `src/web/views/pages/travaux/liste.ejs` | component (vue liste contextuelle) | transform | sections "Diagnostics" de `src/web/views/pages/biens/detail.ejs` lignes 119-195 (section list contextuelle d'un Bien) | exact |
| `src/web/views/pages/travaux/nouveau.ejs` | component (form 1 page) | transform | `src/web/views/pages/biens/diagnostics/formulaire.ejs` (form simple + Zod) | exact |
| `src/web/views/pages/travaux/detail.ejs` | component (vue fiche multi-section) | transform | `src/web/views/pages/baux/edl/entree.ejs` (méta + sections + bouton annuler) | role-match |

### Web layer — EJS partials (7 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/web/views/partials/partial-badge-statut-ticket.ejs` | component (badge inline) | transform | `src/web/views/partials/partial-badge-dpe.ejs` | exact (UI-SPEC §UI-1.4 confirme clone) |
| `src/web/views/partials/partial-upload-form.ejs` | component (fieldset form) | transform | `src/web/views/partials/partial-edl-form.ejs` + `src/web/views/partials/form-field.ejs` | role-match |
| `src/web/views/partials/partial-justificatif-row.ejs` | component (table row) | transform | `src/web/views/partials/partial-diagnostic-row.ejs` (row + helpers + style row-warning) | exact |
| `src/web/views/partials/partial-ticket-row.ejs` | component (table row) | transform | `src/web/views/partials/partial-diagnostic-row.ejs` | exact |
| `src/web/views/partials/partial-filters-coffre.ejs` | component (form GET filtres) | transform | aucun analog direct — **No Analog Found** (forms GET stylés Pico — voir UI-SPEC §Filter behavior) | partial-match |
| `src/web/views/partials/partial-ticket-pj-section.ejs` | component (section sur fiche) | transform | section "Lots" `src/web/views/pages/biens/detail.ejs` lignes 78-117 (sous-table + form inline) | role-match |
| `src/web/views/partials/partial-justificatif-preview.ejs` | component (preview fichier) | transform | aucun analog direct — **No Analog Found** (D-117 `<a target="_blank">` + `<img>` selon MIME — pattern UI-SPEC §File view) | partial-match |

### Helpers (3 fichiers)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `src/helpers/format-type-justificatif.ts` | utility | transform | `src/helpers/format-type-diagnostic.ts` (enum → label FR via Record) | exact |
| `src/helpers/format-statut-ticket.ts` | utility | transform | `src/helpers/format-statut-diagnostic.ts` (enum → label FR avec contexte) | exact |
| `src/helpers/format-taille-fichier.ts` | utility | transform | `src/helpers/format-money.ts` (number → string formaté FR) | role-match (octets → "1.2 Mo") |

### Tests (8 fichiers — sélection des plus stratégiques)

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `tests/_builders/documents.ts` | test (builder) | transform | `tests/_builders/encaissements.ts` (mêmes signatures `unXValide(overrides)` + props pour le repo) | exact |
| `tests/_builders/travaux.ts` | test (builder) | transform | `tests/_builders/encaissements.ts` | exact |
| `tests/bdd/features/coffre.feature` | test (BDD) | event-driven | `tests/bdd/features/diagnostics.feature` (tag `@phase4 @doc-01 @doc-02 @doc-03` + Given/When/Then idiomatique) | exact |
| `tests/bdd/features/travaux.feature` | test (BDD) | event-driven | `tests/bdd/features/diagnostics.feature` | exact |
| `tests/unit/documents/justificatif.test.ts` | test (unit) | transform | `tests/unit/encaissements/quittance.test.ts` (factory invariants) | exact |
| `tests/unit/travaux/ticket-travaux.test.ts` | test (unit) | transform | `tests/unit/encaissements/encaissement.test.ts` | exact |
| `tests/integration/repositories/justificatif-repository-sqlite.test.ts` | test (integration) | CRUD | `tests/integration/repositories/quittance-repository-sqlite.test.ts` | exact |
| `tests/integration/storage/stockage-justificatifs-local.test.ts` | test (integration) | file-I/O | `tests/integration/storage/stockage-fichier-local.test.ts` (path-traversal, immutabilité, slugify) | exact |

---

## Pattern Assignments

### `src/domain/_shared/identifiants.ts` (extension — utility)

**Analog:** lui-même, lignes 35-81 (pattern d'extension Phase 3 puis Phase 2).

**Imports pattern** (déjà en place — Phase 4 ne touche pas les imports) :
```typescript
// Aucune nouvelle import — UUIDv4 via crypto global (Node 22 LTS, D-08/D-09)
```

**Core pattern to copy** (lignes 36-54 — Phase 3 extension) :
```typescript
// Phase 3 — identifiants nouveaux sous-agrégats
export type DiagnosticId = string & { readonly __brand: 'DiagnosticId' };

export function nouveauDiagnosticId(): DiagnosticId {
  return crypto.randomUUID() as DiagnosticId;
}

// Phase 3 plan 02 — EtatDesLieux agrégat racine (LOC-03)
export type EtatDesLieuxId = string & { readonly __brand: 'EtatDesLieuxId' };

export function nouveauEtatDesLieuxId(): EtatDesLieuxId {
  return crypto.randomUUID() as EtatDesLieuxId;
}
```

**À ajouter Phase 4** (sémantique identique) :
```typescript
// Phase 4 — BC Documents (agrégat racine D-102)
export type JustificatifId = string & { readonly __brand: 'JustificatifId' };
export function nouveauJustificatifId(): JustificatifId {
  return crypto.randomUUID() as JustificatifId;
}

// Phase 4 — BC Travaux (agrégat racine D-112)
export type TicketTravauxId = string & { readonly __brand: 'TicketTravauxId' };
export function nouveauTicketTravauxId(): TicketTravauxId {
  return crypto.randomUUID() as TicketTravauxId;
}

// Phase 4 — Chemin relatif retourné par StockageJustificatifs.ecrire (D-106)
export type CheminRelatif = string & { readonly __brand: 'CheminRelatif' };
```

---

### `src/domain/documents/justificatif.ts` (model — agrégat racine, transform)

**Analog:** `src/domain/encaissements/quittance.ts` (95 lignes — agrégat racine avec ID + chemin fichier + dates + soft-delete par copy-on-write).

**Imports pattern** (lignes 1-5) :
```typescript
import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauQuittanceId, type QuittanceId, type EcheanceLoyerId } from '../_shared/identifiants.js';
import { QuittanceDejaAnnulee } from './erreurs.js';
```

**Factory + InvariantViolated pattern** (lignes 32-67 — DP-101 D-103 invariant ≥1 non-null) :
```typescript
export class Quittance {
  readonly id: QuittanceId;
  readonly echeanceId: EcheanceLoyerId;
  readonly numero: string;
  readonly cheminFichierRelatif: string;
  readonly emiseLe: Temporal.PlainDate;
  readonly annuleeLe: Temporal.PlainDate | null;
  readonly raisonAnnulation: string | null;

  private constructor(id: QuittanceId, props: Omit<QuittanceProps, 'id'>) {
    this.id = id;
    this.echeanceId = props.echeanceId;
    /* ... */
  }

  static creer(props: QuittanceProps): Quittance {
    if (!NUMERO_REGEX.test(props.numero)) {
      throw new InvariantViolated(
        `Numéro de quittance invalide : "${props.numero}". Format attendu : AAAA-NNN (ex. 2026-001)`,
      );
    }
    const id = props.id ?? nouveauQuittanceId();
    return new Quittance(id, { /* props */ });
  }
}
```

**Soft-delete copy-on-write pattern** (lignes 69-92) — à reproduire pour `Justificatif.mettreEnCorbeille()` et `Justificatif.restaurer()` :
```typescript
annuler(raison: string, annuleeLe: Temporal.PlainDate): Quittance {
  if (this.annuleeLe !== null) {
    throw new QuittanceDejaAnnulee();
  }
  return Quittance.creer({
    id: this.id,
    /* ... props inchangées ... */
    annuleeLe,
    raisonAnnulation: raison,
  });
}

estActive(): boolean {
  return this.annuleeLe === null;
}
```

**Add Phase 4 specifics** :
- Renommer `annuleeLe`/`raisonAnnulation` → `corbeilleLe`/`raisonCorbeille` (D-109).
- Ajouter méthode `peutEtrePurge(today: Temporal.PlainDate): boolean` (D-109 — comparer `today` à `creeLe.add({ years: 10 })`).
- Invariant `creer()` : `bienId !== null || locataireId !== null` (D-103) → `throw new InvariantViolated('Le document doit être rattaché à un bien ou à un locataire.')`.
- Invariant `creer()` : `mimeType ∈ {pdf, jpeg, png, webp}` (D-105 HEIC interdit en domaine puisque converti côté infra).
- Invariant `creer()` : `tailleOctets > 0 && tailleOctets <= 50 * 1024 * 1024` (D-105).

---

### `src/domain/documents/justificatif-repository.ts` (model — port, CRUD)

**Analog:** `src/domain/encaissements/quittance-repository.ts` (24 lignes — port repo simple).

**Core pattern** (lignes 1-24 — copier intégralement, adapter les types) :
```typescript
import type { EcheanceLoyerId, QuittanceId } from '../_shared/identifiants.js';
import type { Quittance } from './quittance.js';

export interface QuittanceRepository {
  enregistrer(quittance: Quittance, trx?: unknown): Promise<void>;
  trouverParId(id: QuittanceId | string): Promise<Quittance | null>;
  trouverActiveParEcheance(echeanceId: EcheanceLoyerId | string): Promise<Quittance | null>;
  listerToutes(opts?: { inclureAnnulees?: boolean }): Promise<Quittance[]>;
  prochainNumero(annee: number, trx?: unknown): Promise<string>;
}
```

**Add Phase 4 methods** (D-110 recherche facettée) :
```typescript
export interface JustificatifRepository {
  enregistrer(justificatif: Justificatif, trx?: unknown): Promise<void>;
  trouverParId(id: JustificatifId | string): Promise<Justificatif | null>;
  rechercher(filtres: {
    search?: string;       // LIKE sur titre, notes, nomFichierOriginal
    bienId?: BienId | null;
    locataireId?: LocataireId | null;
    anneeFiscale?: number;
    type?: TypeJustificatif;
    inclureCorbeille?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Justificatif[]; total: number }>;
  listerCorbeille(): Promise<Justificatif[]>;
  supprimerDefinitivement(id: JustificatifId, trx?: unknown): Promise<void>;
}
```

---

### `src/domain/documents/stockage-justificatifs.ts` (model — port file I/O)

**Analog:** `src/domain/encaissements/pdf-renderer.ts` (port interface pure — domaine ignore lib) + sémantique anti-path-traversal portée de `src/infrastructure/storage/stockage-fichier-local.ts`.

**Pattern à appliquer** (interface pure, pas d'import infra) :
```typescript
import type { CheminRelatif, JustificatifId } from '../_shared/identifiants.js';

export interface StockageJustificatifs {
  /**
   * Écrit un fichier de justificatif sur disque (immutable — flag wx).
   * Retourne le chemin relatif à la base de stockage.
   */
  ecrire(
    annee: number,
    justificatifId: JustificatifId,
    slug: string,
    ext: string,
    bytes: Buffer,
  ): Promise<CheminRelatif>;

  lire(cheminRelatif: CheminRelatif): Promise<Buffer>;

  supprimer(cheminRelatif: CheminRelatif): Promise<void>;
}
```

> **D-106 explicite** : ne PAS étendre `StockageFichierLocal` Phase 2. Le port est nouveau, dédié au BC Documents. Seul le **mécanisme anti-path-traversal** (`stockage-fichier-local.ts` lignes 39-81) est copié dans l'adapter `StockageJustificatifsLocal`.

---

### `src/domain/documents/convertisseur-image.ts` (model — port)

**Analog:** `src/domain/encaissements/pdf-renderer.ts` (port pure 1 méthode, lib externe via adapter).

**Pattern** (DP-22 confirmé) :
```typescript
export type MimeTypeImage = 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp';

export interface ConvertisseurImage {
  /**
   * Convertit HEIC → JPEG. Pour les autres formats : passe-through (retourne bytes inchangés).
   * Le domaine ne connaît jamais sharp / heif-converter.
   */
  convertirVersJpegSiNecessaire(bytes: Buffer, mimeSource: MimeTypeImage): Promise<{
    bytes: Buffer;
    mimeFinal: 'image/jpeg' | 'image/png' | 'image/webp';
  }>;
}
```

---

### `src/domain/travaux/ticket-travaux.ts` (model — agrégat racine, transform)

**Analog principal:** `src/domain/encaissements/encaissement.ts` (soft-delete `annuleLe` + `raisonAnnulation` + copy-on-write).
**Analog secondaire (statut discriminant):** `src/domain/locatif/etat-des-lieux.ts` lignes 6-14 (`TypeEDL = 'entree' | 'sortie'` + `TYPES_EDL_VALIDES` array + validation `includes()`).

**Pattern statut enum** (à reproduire pour `StatutTicket`) :
```typescript
// FROM etat-des-lieux.ts:12-14
export type TypeEDL = 'entree' | 'sortie';
const TYPES_EDL_VALIDES: TypeEDL[] = ['entree', 'sortie'];

// Validation dans creer() (etat-des-lieux.ts:53-55) :
if (!TYPES_EDL_VALIDES.includes(props.type)) {
  throw new InvariantViolated(`Type EDL invalide : "${props.type}". Valeurs acceptées : entree, sortie`);
}
```

**Pattern soft-delete copy-on-write** (encaissement.ts:84-93) :
```typescript
annuler(raison: string, annuleLe: Temporal.PlainDate): Encaissement {
  if (this.annuleLe !== null) {
    throw new InvariantViolated('Cet encaissement est déjà annulé');
  }
  return Encaissement.creer({
    ...this.toProps(),
    annuleLe,
    raisonAnnulation: raison,
  });
}
```

**Add Phase 4 specifics** :
- Statuts : `'ouvert' | 'en_cours' | 'clos' | 'annule'` (D-112).
- Méthode `clore(coutReelTtc: Money, dateCloture: Temporal.PlainDate): TicketTravaux` (transition `ouvert/en_cours → clos`).
- Invariants : `titre` non vide ; `dateOuverture <= today` ; `bienId` fourni.
- Pas de champ `nature` (D-115).

---

### `src/infrastructure/storage/stockage-justificatifs-local.ts` (service — adapter file I/O)

**Analog:** `src/infrastructure/storage/stockage-fichier-local.ts` (157 lignes — pattern complet à reproduire).

**Imports pattern** (lignes 1-5) :
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';

import { FichierIntrouvable } from '../../domain/encaissements/erreurs.js'; // ⚠️ Phase 4 : créer dans documents/erreurs.ts
```

**Méthode `ecrire` pattern** (lignes 22-27) :
```typescript
async ecrireQuittance(annee: number, nomFichier: string, buffer: Buffer): Promise<string> {
  const cheminAbsolu = path.join(this.baseDir, 'quittances', String(annee), nomFichier);
  await fs.mkdir(path.dirname(cheminAbsolu), { recursive: true });
  await fs.writeFile(cheminAbsolu, buffer, { flag: 'wx' });  // ← immutabilité D-63
  return path.join('quittances', String(annee), nomFichier);
}
```

**Anti-path-traversal pattern WR-03** (lignes 39-81 — à copier intégralement) :
```typescript
async lireQuittance(cheminRelatif: string): Promise<Buffer> {
  if (cheminRelatif.includes('\0')) {
    throw new FichierIntrouvable(cheminRelatif);
  }

  const cheminAbsolu = path.resolve(this.baseDir, cheminRelatif);
  const baseDirResolu = path.resolve(this.baseDir);
  if (!cheminAbsolu.startsWith(baseDirResolu + path.sep) && cheminAbsolu !== baseDirResolu) {
    throw new FichierIntrouvable(cheminRelatif);
  }

  let cheminReel: string;
  let baseDirReel: string;
  try {
    baseDirReel = await fs.realpath(baseDirResolu);
    cheminReel = await fs.realpath(cheminAbsolu);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') throw new FichierIntrouvable(cheminRelatif);
    throw err;
  }
  if (!cheminReel.startsWith(baseDirReel + path.sep) && cheminReel !== baseDirReel) {
    throw new FichierIntrouvable(cheminRelatif);
  }

  try {
    const data = await fs.readFile(cheminReel);
    return Buffer.from(data);
  } catch (err: unknown) {
    const nodeErr = err as NodeJS.ErrnoException;
    if (nodeErr.code === 'ENOENT') throw new FichierIntrouvable(cheminRelatif);
    throw err;
  }
}
```

**Slugify pattern static** (lignes 145-155) :
```typescript
static slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
```

**Phase 4 specifics** :
- Sous-dossier : `'justificatifs'` (vs `'quittances'`/`'avenants'`).
- Path : `documents/justificatifs/{annee_fiscale}/{justificatifId}-{slug}.{ext}` (D-106).
- Ajouter méthode `supprimer(cheminRelatif)` (D-109 purge après 10 ans).
- Réécrire `FichierIntrouvable` dans `domain/documents/erreurs.ts` (séparation BC stricte) — ne pas réutiliser l'erreur du BC Encaissements.

---

### `src/infrastructure/repositories/justificatif-repository-sqlite.ts` (service — adapter repo, CRUD)

**Analog principal:** `src/infrastructure/repositories/quittance-repository-sqlite.ts` (123 lignes — chemin fichier + soft-delete + transaction).
**Analog secondaire:** `src/infrastructure/repositories/encaissement-repository-sqlite.ts` (Money INTEGER cents + soft-delete `annule_le`).

**Imports pattern** (quittance-repository-sqlite.ts:1-9) :
```typescript
import { Temporal } from '@js-temporal/polyfill';
import type { Kysely, Transaction } from 'kysely';
import { sql } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { QuittanceRepository } from '../../domain/encaissements/quittance-repository.js';
import { Quittance } from '../../domain/encaissements/quittance.js';
import { formatNumeroQuittance } from '../../helpers/format-numero-quittance.js';
import type { EcheanceLoyerId, QuittanceId } from '../../domain/_shared/identifiants.js';

type DbOrTrx = Kysely<DB> | Transaction<DB>;

type QuittanceRow = {
  id: string;
  echeance_id: string;
  numero: string;
  chemin_fichier_relatif: string;
  emise_le: string;
  annulee_le: string | null;
  raison_annulation: string | null;
};
```

**Pattern `enregistrer` + onConflict (upsert soft-delete)** (lignes 26-48) :
```typescript
async enregistrer(quittance: Quittance, trxArg?: unknown): Promise<void> {
  const db = (trxArg as DbOrTrx | undefined) ?? this.db;
  await db
    .insertInto('quittance')
    .values({
      id: quittance.id,
      /* ... champs ... */
      emise_le: quittance.emiseLe.toString(),          // ← Temporal → TEXT ISO
      annulee_le: quittance.annuleeLe?.toString() ?? null,
      raison_annulation: quittance.raisonAnnulation ?? null,
    })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({                    // ← upsert pour soft-delete
        annulee_le: quittance.annuleeLe?.toString() ?? null,
        raison_annulation: quittance.raisonAnnulation ?? null,
      }),
    )
    .execute();
}
```

**Pattern Money INTEGER cents** (encaissement-repository-sqlite.ts:34-36 + 106-112) :
```typescript
// ÉCRITURE :
montant_centimes: encaissement.montant.toSqliteInteger(),  // BigInt → number JS-safe (WR-05)

// LECTURE versDomaine :
const centimes = row.montant_centimes;
const montant = centimes >= 0
  ? Money.fromCentimes(BigInt(centimes))
  : Money.compensateur(Money.fromCentimes(BigInt(-centimes)));
```

**Pattern PlainDate roundtrip** (quittance-repository-sqlite.ts:112-122) :
```typescript
private versDomaine(row: QuittanceRow): Quittance {
  return Quittance.creer({
    id: row.id as QuittanceId,
    echeanceId: row.echeance_id as EcheanceLoyerId,
    /* ... */
    emiseLe: Temporal.PlainDate.from(row.emise_le),                                  // ← String → PlainDate
    annuleeLe: row.annulee_le ? Temporal.PlainDate.from(row.annulee_le) : null,
    raisonAnnulation: row.raison_annulation ?? null,
  });
}
```

**Phase 4 specifics** :
- Méthode `rechercher` avec SQL LIKE (D-110) — Kysely : `query.where('titre', 'like', `%${search}%`)` + filtres facettés conditionnels + `query.limit(20).offset((page-1)*20)`.
- Soft-delete : `corbeille_le` + `raison_corbeille` (D-109 — équivalent `annulee_le` mais nommage métier).
- Pas de `prochainNumero` (les justificatifs n'ont pas de séquence métier — UUID seul).
- Méthode `supprimerDefinitivement(id, trx)` (purge 10 ans D-109).

---

### `src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts` (service — adapter repo, CRUD)

**Analog:** `src/infrastructure/repositories/encaissement-repository-sqlite.ts` (123 lignes — Money + soft-delete `annule_le`).

Copier intégralement le pattern, adapter les noms :
- Table `tickets_travaux` (et table jointure `ticket_justificatifs` pour D-113 — N:N).
- Money pour `cout_estime_ttc_centimes`, `cout_reel_ttc_centimes` (nullables tous deux).
- Soft-delete `annule_le` (réutilisation du nom exact, cohérent avec encaissement).
- Statut `'ouvert' | 'en_cours' | 'clos' | 'annule'` — `CHECK statut IN (...)` côté SQL.

**Jointure N:N table `ticket_justificatifs`** : implémenter méthodes dédiées sur le repository Ticket (pas un agrégat).
```typescript
async lierJustificatif(ticketId: TicketTravauxId, justificatifId: JustificatifId): Promise<void> {
  await this.db.insertInto('ticket_justificatifs').values({ ticket_id: ticketId, justificatif_id: justificatifId })
    .onConflict((oc) => oc.doNothing()).execute();
}

async delierJustificatif(ticketId: TicketTravauxId, justificatifId: JustificatifId): Promise<void> { /* DELETE */ }

async listerJustificatifsLies(ticketId: TicketTravauxId): Promise<JustificatifId[]> { /* SELECT */ }
```

---

### `migrations/0010_phase4_documents_travaux.sql` (config — migration)

**Analog principal:** `migrations/0008_phase3_edl.sql` (table + JSON + soft-delete + index partiel unique).
**Analog secondaire:** `migrations/0005_phase2_quittance.sql` (chemin fichier + soft-delete + index partiel).

**Pattern preamble + transaction** (0008:1-7, 0005:1-6) :
```sql
-- Migration 0010 — Phase 4 : Documents (DOC-01, DOC-02, DOC-03) + Travaux (INC-01)
-- Conventions identiques 0001-0009 :
--   - Identifiants UUID v4 TEXT PRIMARY KEY
--   - Dates en TEXT ISO 8601 (Temporal.PlainDate.toString())
--   - Montants en INTEGER centimes (Money.toSqliteInteger)
--   - Soft-delete via corbeille_le / annule_le
-- Décisions : D-102 D-103 D-104 D-106 D-108 D-109 D-110 D-112 D-113

BEGIN TRANSACTION;

-- ... tables ici ...

COMMIT;
```

**Pattern table principale** (0007:21-30 + 0005:7-19) :
```sql
CREATE TABLE IF NOT EXISTS justificatifs (
  id                  TEXT PRIMARY KEY,
  type                TEXT NOT NULL CHECK (type IN (
    'facture', 'ticket_caisse', 'bail_signe', 'edl_signe',
    'diagnostic_pdf', 'attestation', 'piece_locataire',
    'releve_bancaire', 'autre'
  )),
  date_document       TEXT NOT NULL,                  -- ISO 8601
  titre               TEXT NOT NULL,
  montant_ttc_centimes INTEGER NULL,                  -- nullable (D-108)
  chemin_fichier      TEXT NOT NULL,
  nom_fichier_original TEXT NOT NULL,
  mime_type           TEXT NOT NULL CHECK (mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  taille_octets       INTEGER NOT NULL CHECK (taille_octets > 0 AND taille_octets <= 52428800),
  bien_id             TEXT NULL REFERENCES bien(id),
  locataire_id        TEXT NULL REFERENCES locataire(id),
  notes               TEXT NULL,
  cree_le             TEXT NOT NULL,                  -- saisi via Clock (D-107)
  corbeille_le        TEXT NULL,
  raison_corbeille    TEXT NULL,
  -- D-103 invariant double-barre (Zod côté HTTP + InvariantViolated côté domaine + CHECK ici)
  CHECK (bien_id IS NOT NULL OR locataire_id IS NOT NULL)
);
```

**Pattern index** (0005:21-28 + 0008:30-37) :
```sql
-- D-110 recherche facettée :
CREATE INDEX IF NOT EXISTS idx_justificatifs_bien ON justificatifs(bien_id) WHERE corbeille_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_justificatifs_locataire ON justificatifs(locataire_id) WHERE corbeille_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_justificatifs_date_document ON justificatifs(date_document) WHERE corbeille_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_justificatifs_type ON justificatifs(type) WHERE corbeille_le IS NULL;
CREATE INDEX IF NOT EXISTS idx_justificatifs_corbeille ON justificatifs(corbeille_le);
```

**Pattern table N:N pivot** (pas d'analog exact — `bail_lots` Phase 1 est le plus proche ; voir `kysely-types.ts:108-111`) :
```sql
CREATE TABLE IF NOT EXISTS ticket_justificatifs (
  ticket_id      TEXT NOT NULL REFERENCES tickets_travaux(id) ON DELETE CASCADE,
  justificatif_id TEXT NOT NULL REFERENCES justificatifs(id),  -- pas CASCADE : D-113 cascade asymétrique
  PRIMARY KEY (ticket_id, justificatif_id)
);
```

---

### `src/web/routes/coffre.ts` (route — request-response)

**Analog principal:** `src/web/routes/quittances.ts` (218 lignes — CRUD complet : liste, fiche, download fichier, action `annuler`).
**Analog secondaire:** `src/web/routes/diagnostics.ts` (104 lignes — form Zod + `extraireErreurs` + re-render avec valeurs préservées).

**Imports pattern** (quittances.ts:1-25) :
```typescript
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';
import type { ConvertisseurImage } from '../../domain/documents/convertisseur-image.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { JustificatifId } from '../../domain/_shared/identifiants.js';
import { uploaderJustificatif } from '../../application/documents/uploader-justificatif.js';
import { /* erreurs documents */ } from '../../domain/documents/erreurs.js';
import { uploadJustificatifSchema, /* ... */ } from '../schemas/justificatif-schemas.js';
```

**Pattern plugin + opts** (quittances.ts:26-41) :
```typescript
export async function plugin(
  app: FastifyInstance,
  opts: {
    justificatifRepo: JustificatifRepository;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
    stockage: StockageJustificatifs;
    convertisseurImage: ConvertisseurImage;
    clock: Clock;
    db: Kysely<DB>;
  },
): Promise<void> {
```

**Pattern GET liste + bannière session** (quittances.ts:44-73) :
```typescript
app.get('/coffre', async (req, reply) => {
  const banniereSuccess = req.session.banniereSuccess ?? null;
  const banniereWarning = req.session.banniereWarning ?? null;
  if (banniereSuccess) req.session.banniereSuccess = undefined;
  if (banniereWarning) req.session.banniereWarning = undefined;

  // Lire filtres depuis query string
  const search = (req.query as Record<string, string>).search ?? '';
  const bienId = (req.query as Record<string, string>).bien || null;
  // ... autres filtres

  const { items, total } = await opts.justificatifRepo.rechercher({ search, bienId, /* ... */ });

  return reply.view('pages/coffre/liste.ejs', {
    items,
    total,
    filtres: { search, bienId, /* ... */ },
    navActive: 'coffre',                // ← UI-SPEC §UI-2
    banniereSuccess,
    banniereWarning,
  });
});
```

**Pattern POST upload + erreur handling** (quittances.ts:76-120) :
```typescript
app.post('/coffre/upload', async (req, reply) => {
  // ⚠️ multipart : ne PAS utiliser req.body — utiliser req.file() de @fastify/multipart
  const data = await req.file();
  if (!data) {
    req.session.banniereWarning = 'Aucun fichier reçu.';
    return reply.redirect('/coffre/upload');
  }

  // Lire fields textuels (data.fields) + file (data.file stream)
  const buffer = await data.toBuffer();
  // ... parse fields avec Zod ...

  try {
    const { justificatifId } = await uploaderJustificatif(/* commande */, /* deps */);
    req.session.banniereSuccess = 'Document ajouté.';
    return reply.redirect(`/justificatifs/${justificatifId}`);
  } catch (err) {
    if (err instanceof FormatNonAccepte) { /* 415 + redirect with erreur */ }
    if (err instanceof FichierTropVolumineux) { /* 413 */ }
    if (err instanceof MimeMismatch) { /* 422 + UI-6.2 verbatim */ }
    app.log.error(err, 'Erreur upload justificatif');
    /* ... */
  }
});
```

**Pattern download streaming** (quittances.ts:164-186 — à reproduire dans `routes/justificatifs.ts`) :
```typescript
app.get('/justificatifs/:id/fichier', async (req, reply) => {
  const { id } = req.params as { id: string };
  const j = await opts.justificatifRepo.trouverParId(id as JustificatifId);
  if (!j) return reply.code(404).send('Document introuvable.');
  if (j.corbeilleLe !== null) return reply.code(410).send('Document en corbeille.');

  try {
    const buffer = await opts.stockage.lire(j.cheminFichier);
    return reply
      .header('Content-Type', j.mimeType)
      .header('Content-Disposition', `attachment; filename="${j.nomFichierOriginal}"`)
      .send(buffer);
  } catch (err) {
    if (err instanceof FichierIntrouvable) return reply.code(404).send('Fichier introuvable.');
    throw err;
  }
});
```

---

### `src/web/routes/travaux.ts` (route — request-response)

**Analog:** `src/web/routes/etats-des-lieux.ts` (343 lignes — routes contextuelles `/baux/:id/edl/*` + form + bannière warning).

**Pattern routes contextuelles imbriquées** (etats-des-lieux.ts:32-55) :
```typescript
// GET /biens/:id/travaux — liste
app.get('/biens/:id/travaux', async (req, reply) => {
  const { id } = req.params as { id: string };
  const bien = await opts.bienRepo.trouverParId(id as BienId);
  if (!bien) return reply.code(404).send("Ce bien n'existe pas.");
  const tickets = await opts.ticketRepo.listerParBien(id as BienId);
  return reply.view('pages/travaux/liste.ejs', { bien, tickets, navActive: 'biens' });
});

// GET /travaux/nouveau?bienId=… — formulaire
// POST /biens/:id/travaux — create
// GET /travaux/:id — fiche détail
// POST /travaux/:id/clore — transition statut
// POST /travaux/:id/annuler — soft-delete
// POST /travaux/:id/justificatifs — lier justificatif (table N:N)
```

**Pattern declaration order — `nouveau` AVANT `:id`** (diagnostics.ts:27-46 + etats-des-lieux.ts:39-41 commentaire) :
```typescript
// IMPORTANT : Déclaré avant le POST pour éviter capture du segment "nouveau" comme id futur.
app.get('/travaux/nouveau', /* ... */);
app.get('/travaux/:id', /* ... */);
```

---

### `src/web/schemas/justificatif-schemas.ts` (utility — validation)

**Analog principal:** `src/web/schemas/diagnostic-schemas.ts` (enum + `.superRefine` pour invariants conditionnels).
**Analog secondaire:** `src/web/schemas/edl-schemas.ts` (form complexe + `normaliserInventaireFormBody`).

**Pattern enum + superRefine** (diagnostic-schemas.ts:1-32) :
```typescript
import { z } from 'zod';

export const uploadJustificatifSchema = z
  .object({
    titre: z.string().trim().min(1, 'Le titre est obligatoire.'),
    type: z.enum(
      ['facture', 'ticket_caisse', 'bail_signe', 'edl_signe', 'diagnostic_pdf',
       'attestation', 'piece_locataire', 'releve_bancaire', 'autre'],
      { errorMap: () => ({ message: 'Le type de document est obligatoire.' }) },
    ),
    dateDocument: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ.')
      .refine((s) => {
        const d = Temporal.PlainDate.from(s);
        return Temporal.PlainDate.compare(d, Temporal.Now.plainDateISO()) <= 0;
      }, 'La date du document ne peut pas être dans le futur.'),
    bienId: z.string().uuid().optional().nullable(),
    locataireId: z.string().uuid().optional().nullable(),
    montantTtcCentimes: z.coerce.number().int().nonnegative().optional().nullable(),
    notes: z.string().trim().max(2000).optional().nullable(),
    rattachement: z.enum(['bien', 'locataire', 'bien_et_locataire']),  // UI-SPEC UI-4.2
  })
  .superRefine((data, ctx) => {
    // D-103 : invariant ≥1 non-null bienId OU locataireId (selon rattachement choisi)
    if (data.rattachement === 'bien' && !data.bienId) {
      ctx.addIssue({ code: 'custom', path: ['bienId'], message: 'Le bien à rattacher est obligatoire.' });
    }
    if (data.rattachement === 'locataire' && !data.locataireId) {
      ctx.addIssue({ code: 'custom', path: ['locataireId'], message: 'Le locataire à rattacher est obligatoire.' });
    }
    if (data.rattachement === 'bien_et_locataire' && (!data.bienId || !data.locataireId)) {
      ctx.addIssue({ code: 'custom', path: ['_global'], message: 'Le document doit être rattaché à un bien ET à un locataire.' });
    }
  });
```

---

### `src/helpers/format-type-justificatif.ts` (utility — transform)

**Analog:** `src/helpers/format-type-diagnostic.ts` (16 lignes — copier exactement).

**Pattern complet** (format-type-diagnostic.ts:1-16) :
```typescript
import type { TypeJustificatif } from '../domain/documents/justificatif.js';

const LABELS_TYPE_JUSTIFICATIF: Record<TypeJustificatif, string> = {
  facture: 'Facture',
  ticket_caisse: 'Ticket de caisse',
  bail_signe: 'Bail signé',
  edl_signe: 'État des lieux signé',
  diagnostic_pdf: 'Diagnostic (PDF)',
  attestation: 'Attestation',
  piece_locataire: 'Pièce locataire',
  releve_bancaire: 'Relevé bancaire',
  autre: 'Autre',
};

export function formaterTypeJustificatif(type: TypeJustificatif): string {
  return LABELS_TYPE_JUSTIFICATIF[type];
}
```

> **Injection EJS** : ajouter dans `src/main.ts:135-150` (le hook `preHandler`) à côté de `formaterTypeDiagnostic`.

---

### `src/web/views/partials/partial-badge-statut-ticket.ejs` (component — badge inline)

**Analog:** `src/web/views/partials/partial-badge-dpe.ejs` (22 lignes — UI-SPEC §UI-1.4 confirme clone).

**Pattern complet** (partial-badge-dpe.ejs:1-22) :
```ejs
<%
/*
 * partial-badge-statut-ticket.ejs — Badge statut ticket coloré avec aria-label (WCAG 1.4.1 + 1.4.3).
 * Variable attendue : statut ('ouvert' | 'en_cours' | 'clos' | 'annule')
 * UI-SPEC §UI-1.4 — 4 variantes mappées sur palette UI-1.3.
 */
const statutMap = {
  ouvert:   { bg: 'var(--couleur-accent-bg)',      fg: 'var(--couleur-accent)',      label: 'ouvert' },
  en_cours: { bg: 'var(--couleur-warning-bg)',     fg: 'var(--couleur-warning)',     label: 'en cours' },
  clos:     { bg: 'var(--couleur-success-bg)',     fg: 'var(--couleur-success)',     label: 'clos' },
  annule:   { bg: 'var(--couleur-neutre-bg)',      fg: 'var(--couleur-neutre)',      label: 'annulé' },
};
const item = statutMap[statut] || statutMap.annule;
%><span
  style="background: <%= item.bg %>; color: <%= item.fg %>; padding: 2px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap;"
  aria-label="Statut : <%= item.label %>"
><%= item.label %></span>
```

---

### `tests/_builders/documents.ts` (test — builder)

**Analog:** `tests/_builders/encaissements.ts` (174 lignes — `unX(overrides)` pattern + `OverridesX` interface).

**Pattern complet** (encaissements.ts:82-95) :
```typescript
export function unJustificatifValide(overrides: OverridesJustificatif = {}): JustificatifProps {
  return {
    id: overrides.id,
    type: overrides.type ?? 'facture',
    dateDocument: overrides.dateDocument ?? Temporal.PlainDate.from('2026-05-01'),
    titre: overrides.titre ?? 'Facture test',
    montantTtc: overrides.montantTtc !== undefined ? overrides.montantTtc : Money.fromEuros(120),
    cheminFichier: overrides.cheminFichier ?? ('justificatifs/2026/test-uuid-facture.pdf' as CheminRelatif),
    nomFichierOriginal: overrides.nomFichierOriginal ?? 'facture-test.pdf',
    mimeType: overrides.mimeType ?? 'application/pdf',
    tailleOctets: overrides.tailleOctets ?? 12345,
    bienId: overrides.bienId !== undefined ? overrides.bienId : (crypto.randomUUID() as BienId),
    locataireId: overrides.locataireId !== undefined ? overrides.locataireId : null,
    notes: overrides.notes ?? null,
    creeLe: overrides.creeLe ?? Temporal.PlainDate.from('2026-05-01'),
    corbeilleLe: overrides.corbeilleLe !== undefined ? overrides.corbeilleLe : null,
    raisonCorbeille: overrides.raisonCorbeille !== undefined ? overrides.raisonCorbeille : null,
  };
}

export function unJustificatifAvecBienSeul(overrides = {}) {
  return unJustificatifValide({ ...overrides, locataireId: null });
}
export function unJustificatifAvecLocataireSeul(overrides = {}) {
  return unJustificatifValide({ ...overrides, bienId: null, locataireId: crypto.randomUUID() as LocataireId });
}
export function unJustificatifEnCorbeille(overrides = {}) {
  return unJustificatifValide({ ...overrides, corbeilleLe: Temporal.PlainDate.from('2026-05-10'), raisonCorbeille: 'Doublon' });
}
```

---

### `tests/bdd/features/coffre.feature` (test — BDD)

**Analog:** `tests/bdd/features/diagnostics.feature` (44 lignes — tags `@pat-03 @phase3` + Given/When/Then concis).

**Pattern complet** (diagnostics.feature:1-22) :
```gherkin
@doc-01 @doc-02 @doc-03 @phase4
Feature: Coffre documentaire — upload, recherche, rétention 10 ans

  Background:
    Given l'application est prête pour Phase 4 avec clock fixe "2026-05-18"
    And un Bien Phase 4 existe à l'adresse "10 rue du Coffre, 75001 Paris"

  @doc-01
  Scenario: Upload PDF facture rattaché à un Bien
    When le bailleur soumet POST /coffre/upload avec un fichier PDF "facture-peinture.pdf" type=facture bienId=:id
    Then il est redirigé vers la fiche du justificatif
    And la page affiche "Document ajouté."
    And la table justificatifs contient 1 ligne avec type=facture bien_id=:id

  @doc-01
  Scenario: Upload rejeté sans rattachement (D-103)
    When le bailleur soumet POST /coffre/upload sans bienId ni locataireId
    Then la réponse a le statut 200
    And la page affiche "Le document doit être rattaché à un bien ou à un locataire."
    And aucun justificatif n'est créé en base

  @doc-03
  Scenario: Purge refusée avant 10 ans
    Given un Justificatif créé le 2025-01-01 sur ce Bien
    When le bailleur soumet POST /justificatifs/:id/purger
    Then la page affiche "Conservation légale obligatoire jusqu'au 01/01/2035"
    And le justificatif est toujours présent en base
```

---

## Shared Patterns (Cross-cutting)

### Pattern 1 — Hexagonal strict (domaine pur, aucun import infra)

**Source:** `practices/DDD.md` + tous les fichiers `src/domain/**/*.ts`
**Apply to:** Tous les fichiers `src/domain/documents/*.ts` et `src/domain/travaux/*.ts`

**Règle dependency-cruiser à ajouter** (cohérent CONTEXT §Integration Points) :
```javascript
// .dependency-cruiser.js — ajouter règles BC Documents et Travaux
{
  name: 'no-tech-in-documents',
  from: { path: '^src/domain/documents' },
  to: { path: 'node_modules/(kysely|fastify|better-sqlite3|sharp|@fastify/multipart)' },
},
{
  name: 'no-tech-in-travaux',
  from: { path: '^src/domain/travaux' },
  to: { path: 'node_modules/(kysely|fastify|better-sqlite3|sharp|@fastify/multipart)' },
}
```

---

### Pattern 2 — Factory + InvariantViolated

**Source:** `src/domain/_shared/erreurs.ts:1-6` + tous les agrégats `creer()` (Quittance, Encaissement, EtatDesLieux, BailIndexation, Diagnostic, Bien, Lot, Locataire, Bail).
**Apply to:** `Justificatif.creer()`, `TicketTravaux.creer()`.

```typescript
export class InvariantViolated extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvariantViolated';
  }
}

// USAGE TYPE :
static creer(props: XProps): X {
  if (/* invariant violé */) {
    throw new InvariantViolated('Message factuel non paternaliste (UI-SPEC UI-6.2 verbatim).');
  }
  const id = props.id ?? nouveauXId();
  return new X(id, props);
}
```

---

### Pattern 3 — Soft-delete copy-on-write (variations)

**Source:** `src/domain/encaissements/quittance.ts:74-92` (annuleeLe + raisonAnnulation) + `src/domain/encaissements/encaissement.ts:84-93` (annuleLe + raisonAnnulation)
**Apply to:**
- `Justificatif` : `corbeilleLe` + `raisonCorbeille` (D-109, variation Phase 4).
- `TicketTravaux` : `annuleLe` (réutilisation directe du nom encaissement — cohérence vocabulaire).

```typescript
mettreEnCorbeille(raison: string, today: Temporal.PlainDate): Justificatif {
  if (this.corbeilleLe !== null) {
    throw new InvariantViolated('Ce document est déjà dans la corbeille.');
  }
  return Justificatif.creer({ ...this.toProps(), corbeilleLe: today, raisonCorbeille: raison });
}

restaurer(): Justificatif {
  if (this.corbeilleLe === null) {
    throw new InvariantViolated('Ce document n\'est pas dans la corbeille.');
  }
  return Justificatif.creer({ ...this.toProps(), corbeilleLe: null, raisonCorbeille: null });
}

peutEtrePurge(today: Temporal.PlainDate): boolean {
  const datePurgePossible = this.creeLe.add({ years: 10 });
  return Temporal.PlainDate.compare(today, datePurgePossible) >= 0;
}
```

---

### Pattern 4 — Repository Kysely (versDomaine + versRow + transaction)

**Source:** `src/infrastructure/repositories/quittance-repository-sqlite.ts` (canonical) + `src/infrastructure/repositories/encaissement-repository-sqlite.ts` (Money cents).
**Apply to:** `JustificatifRepositorySqlite`, `TicketTravauxRepositorySqlite`.

**Conventions strictes (Phases 1-3 établies)** :
- `versDomaine(row)` privé : Row → entité (lecture).
- Champs `_le` (dates) : `Temporal.PlainDate.from(row.x)`.
- Champs `_centimes` (Money) : `Money.fromCentimes(BigInt(row.x))` ou `Money.fromCentimes(BigInt(Math.round(row.x)))` si SUM.
- `enregistrer(entity, trx?)` : `INSERT ... ON CONFLICT(id) DO UPDATE SET <champs-mutables>` pour upsert soft-delete.
- Type `DbOrTrx = Kysely<DB> | Transaction<DB>` + `const db = (trxArg as DbOrTrx | undefined) ?? this.db;`.

---

### Pattern 5 — Use case orchestration (cross-aggregate)

**Source:** `src/application/encaissements/generer-quittance.ts:61-182` (use case avec transaction + compensation).
**Apply to:** `uploaderJustificatif` (transaction `INSERT justificatifs` + écriture fichier hors transaction + compensation copy-on-write si erreur disque).

**Pattern strict** :
1. Lookups + validations métier AVANT la transaction.
2. Transaction Kysely : opérations BD seulement.
3. Hors transaction : écriture fichier physique avec `try/catch` qui compense (mette en corbeille la ligne BD si écriture échoue).
4. Log `[CRITICAL]` si compensation échoue (double erreur — cf. generer-quittance.ts:166-172).

---

### Pattern 6 — Route Fastify avec session bannières

**Source:** `src/web/routes/quittances.ts:44-72` (lecture + nettoyage bannières) + `src/web/routes/etats-des-lieux.ts` (bannière warning sur erreurs métier).
**Apply to:** Toutes les routes `coffre.ts`, `justificatifs.ts`, `travaux.ts`.

```typescript
app.get('/route', async (req, reply) => {
  const banniereSuccess = req.session.banniereSuccess ?? null;
  const banniereWarning = req.session.banniereWarning ?? null;
  if (banniereSuccess) req.session.banniereSuccess = undefined;
  if (banniereWarning) req.session.banniereWarning = undefined;
  /* ... */
});
```

---

### Pattern 7 — Helpers EJS via preHandler injection

**Source:** `src/main.ts:135-150` (hook preHandler injectant les helpers dans `reply.locals`).
**Apply to:** Étendre cette injection avec `formaterTypeJustificatif`, `formaterStatutTicket`, `formaterTailleFichier`, `formaterAnneeFiscale`.

```typescript
// src/main.ts:135-150 (à modifier Phase 4)
app.addHook('preHandler', async (_req, reply) => {
  const today = clock.aujourdhui();
  reply.locals = {
    ...(reply.locals ?? {}),
    formatDate,
    formatMoney,
    formatPeriode,
    formaterClasseDpe,
    formaterTypeDiagnostic,
    formaterStatutDiagnostic,
    formaterTypeItemInventaire,
    formaterEtatItem,
    formaterRaisonNonApplication,
    // Phase 4 — DP-25
    formaterTypeJustificatif,
    formaterStatutTicket,
    formaterTailleFichier,
    formaterAnneeFiscale,
    today,
  };
});
```

---

### Pattern 8 — EJS layout split + partials reusables

**Source:** `src/web/views/partials/layout-debut.ejs` + `src/web/views/partials/layout-fin.ejs` + tous les fichiers `src/web/views/pages/**/*.ejs`
**Apply to:** Toutes les nouvelles vues Phase 4.

```ejs
<%- include('../../partials/layout-debut', {
  titre: 'Coffre documentaire',
  breadcrumbs: [{ label: 'Coffre documentaire' }],
  navActive: 'coffre'                   // ← UI-SPEC §UI-2 (Phase 4 nouveau navActive)
}) %>

<%- include('../../partials/warning-live', { warning: locals.banniereWarning }) %>

<h1>…</h1>
<!-- contenu -->

<%- include('../../partials/layout-fin') %>
```

---

### Pattern 9 — Confirm-dialog pour actions destructive

**Source:** `src/web/views/partials/confirm-dialog.ejs` + `src/web/views/pages/biens/liste.ejs:45-53` (usage).
**Apply to:** "Mettre en corbeille", "Purger définitivement", "Annuler le ticket".

```ejs
<button type="button" class="destructif" data-open-dialog="dialog-corbeille-<%= j.id %>">Mettre en corbeille</button>
<%- include('../../partials/confirm-dialog', {
  id: 'dialog-corbeille-' + j.id,
  formAction: '/justificatifs/' + j.id + '/corbeille',
  message: 'Ce document sera déplacé vers la corbeille. Vous pourrez le restaurer depuis /coffre/corbeille.',
  confirmLabel: 'Mettre en corbeille',
  cancelLabel: 'Annuler'
}) %>
```

---

### Pattern 10 — Tests : BDD outside-in + builders + integration repos

**Source:**
- BDD : `tests/bdd/features/diagnostics.feature` (Gherkin succinct).
- Builders : `tests/_builders/encaissements.ts` (signature `unX(overrides)` + interface `OverridesX`).
- Unit : `tests/unit/encaissements/quittance.test.ts:1-50` (factory invariants).
- Integration : `tests/integration/repositories/quittance-repository-sqlite.test.ts` (versDomaine roundtrip).
- Storage : `tests/integration/storage/stockage-fichier-local.test.ts:25-144` (path-traversal, immutabilité wx, slugify).

**Apply to:** Tous les tests Phase 4. Couverture cible : **100 % logique métier** (D-109 rétention 10 ans = logique réglementaire impérative → 100 %).

---

## No Analog Found

Files with no close match in the codebase (planner should use RESEARCH.md patterns instead) :

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/web/views/partials/partial-filters-coffre.ejs` | component | transform | Aucun listing existant n'a de filtres facettés `<form method="GET">` avec persistance via query string (UI-SPEC §Filter behavior — pattern à inventer cf. UI-3.2 / UI-3.3) |
| `src/web/views/partials/partial-justificatif-preview.ejs` | component | transform | Aucun aperçu inline image dans le code base ; D-117 `<a target="_blank">` PDF + `<img>` JPG conditionnel selon MIME — voir UI-SPEC §File view |
| `src/web/views/partials/partial-upload-form.ejs` (multipart) | component | streaming | Aucun formulaire multipart dans Phases 1-3 (les seuls fichiers générés sont produits côté serveur — pdfmake). `@fastify/multipart` à introduire. **Researcher's responsibility** pour le snippet exact. |
| `src/infrastructure/image/convertisseur-image-sharp.ts` | service | transform | Aucune lib image dans le projet. `sharp` ou `heif-converter` à introduire (DP-22). Pattern adapter standard (cf. `pdf-renderer-pdfmake.ts`) mais lib inédite. |
| `src/application/documents/uploader-justificatif.ts` — partie magic-bytes | service | streaming | Pas de validation magic-bytes existante. `file-type` npm ou validation maison 8-12 octets (DP-21). **Researcher's responsibility** pour le snippet. |
| `src/application/travaux/ajouter-pj-ticket.ts` — opération sur table N:N | service | CRUD | Aucune table N:N gérée par un use case dans Phases 1-3 (`bail_lots` est créée à la création du `Bail` agrégat, pas via un use case dédié). Pattern à concevoir : `repo.lierJustificatif(ticketId, justificatifId)` méthode directe sur le repo Ticket. |

---

## Metadata

**Analog search scope:**
- `src/domain/**/*.ts` (28 fichiers) — patterns DDD pur, factories, invariants
- `src/infrastructure/repositories/*.ts` (12 fichiers) — patterns Kysely + Money/PlainDate roundtrip
- `src/infrastructure/storage/*.ts` (1 fichier) — pattern WR-03 anti-path-traversal
- `src/web/routes/*.ts` (14 fichiers) — patterns Fastify plugin + session bannières
- `src/web/schemas/*.ts` (11 fichiers) — patterns Zod + superRefine
- `src/web/views/partials/*.ejs` (24 fichiers) — patterns composants UI
- `src/web/views/pages/**/*.ejs` (30 fichiers) — patterns layout pages
- `src/helpers/*.ts` (12 fichiers) — patterns Record<enum, string> + format français
- `tests/_builders/*.ts` (4 fichiers) — patterns builders
- `tests/bdd/features/*.feature` (16 fichiers) — patterns Gherkin
- `migrations/*.sql` (9 fichiers) — patterns DDL idempotent

**Files scanned:** ~161 fichiers
**Pattern extraction date:** 2026-05-18

**Key takeaways pour le planner :**

1. **Phase 4 est 100 % cohérente avec les patterns Phases 1-3.** Aucun nouveau paradigme architectural à inventer. Le projet est dans un état excellent pour copier-coller-adapter.
2. **3 nouveautés techniques** à introduire avec discipline d'isolation hexagonale :
   - `@fastify/multipart` (route layer seul — pas dans le domaine).
   - `sharp` ou équivalent HEIC (adapter infra `convertisseur-image-sharp.ts` derrière port `ConvertisseurImage`).
   - `file-type` ou magic-bytes maison (utilisable directement dans `uploader-justificatif.ts` use case via fonction pure).
3. **Pattern d'extension Phase 3 (sous-agrégat Diagnostic dans Bien) à NE PAS rejouer** : D-102 / D-112 sont clairs, `Justificatif` et `TicketTravaux` sont des **agrégats racines indépendants**. Suivre le pattern Quittance / Encaissement (agrégats racines de plein droit, repos dédiés).
4. **Réutilisation du port `Clock` Phase 1** : indispensable pour `peutEtrePurge(today)` (rétention 10 ans D-109) et `dateDocument` année fiscale dérivée (D-107).
5. **UI : zéro composant nouveau au sens design system.** Pico.css classless, partials déjà inventoriés (UI-SPEC §Component Inventory). Phase 4 = 7 nouveaux partials, tous clonés sur des analogs existants.
6. **Migration numbering** : `0010_phase4_documents_travaux.sql` (correctif vs `0004` initialement cité dans le prompt) — les migrations 0001-0009 sont consommées.

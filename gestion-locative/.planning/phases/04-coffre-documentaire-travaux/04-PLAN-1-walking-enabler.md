---
phase: 04-coffre-documentaire-travaux
plan: 01
plan_id: 04-01
type: execute
wave: 1
status: planned
created: 2026-05-18
depends_on: []
files_modified:
  # Domain BC Documents
  - src/domain/_shared/identifiants.ts
  - src/domain/documents/justificatif.ts
  - src/domain/documents/justificatif-repository.ts
  - src/domain/documents/stockage-justificatifs.ts
  - src/domain/documents/convertisseur-image.ts
  - src/domain/documents/erreurs.ts
  # Application
  - src/application/documents/uploader-justificatif.ts
  - src/application/documents/mettre-justificatif-en-corbeille.ts
  - src/application/documents/lire-justificatif.ts
  - src/application/documents/valider-magic-bytes.ts
  # Infrastructure
  - src/infrastructure/storage/stockage-justificatifs-local.ts
  - src/infrastructure/image/convertisseur-image-sharp.ts
  - src/infrastructure/repositories/justificatif-repository-sqlite.ts
  - migrations/0010_phase4_documents_travaux.sql
  - src/infrastructure/db/kysely-types.ts
  # Web
  - src/web/routes/coffre.ts
  - src/web/schemas/justificatif-schemas.ts
  - src/web/views/pages/coffre/liste.ejs
  - src/web/views/pages/coffre/upload.ejs
  - src/web/views/pages/justificatifs/detail.ejs
  - src/web/views/partials/partial-upload-form.ejs
  - src/web/views/partials/partial-justificatif-row.ejs
  - src/web/views/partials/partial-justificatif-preview.ejs
  - src/web/views/partials/sidebar-nav.ejs
  - src/main.ts
  # Helpers
  - src/helpers/format-type-justificatif.ts
  - src/helpers/format-taille-fichier.ts
  - src/helpers/format-annee-fiscale.ts
  # Tests
  - tests/_builders/documents.ts
  - tests/bdd/features/coffre.feature
  - tests/bdd/steps/coffre.steps.ts
  - tests/unit/documents/justificatif.test.ts
  - tests/unit/documents/valider-magic-bytes.test.ts
  - tests/integration/repositories/justificatif-repository-sqlite.test.ts
  - tests/integration/storage/stockage-justificatifs-local.test.ts
  - tests/integration/image/convertisseur-image-sharp.test.ts
  # Tooling
  - package.json
  - .dependency-cruiser.js
autonomous: true
requirements: [DOC-01, DOC-03]
user_setup: []
tags: [phase-4, documents, upload, multipart, retention-10y, BC-documents, walking-enabler]

must_haves:
  truths:
    - "L'utilisateur peut uploader un PDF/JPG/PNG/HEIC/WebP via POST /coffre/upload et obtenir un redirect vers /justificatifs/:id avec bannière 'Document ajouté.'"
    - "Le fichier physique est persisté sous documents/justificatifs/{annee}/{justificatifId}-{slug}.{ext} avec flag wx (immutable)"
    - "HEIC est converti côté serveur en JPEG avant persistance (D-105) — le mimeType stocké n'est jamais 'image/heic'"
    - "Un upload sans bienId ni locataireId est refusé avec 'Le document doit être rattaché à un bien ou à un locataire.' (D-103)"
    - "Un upload > 50 Mo est rejeté HTTP 413 avec 'Fichier trop volumineux. La taille maximale est 50 Mo.'"
    - "Un upload avec MIME header ≠ magic-bytes est rejeté avec 'Le fichier ne correspond pas au format annoncé. Le téléversement a été refusé pour des raisons de sécurité.' (D-118)"
    - "L'utilisateur peut visualiser un PDF/WebP via <a target='_blank' rel='noopener noreferrer'> et un JPG/PNG inline <img> (D-117)"
    - "L'utilisateur peut soft-deleter un justificatif — la row reste, corbeille_le est rempli, le fichier physique reste sur disque (D-109)"
    - "Justificatif.peutEtrePurge(today) retourne false si today < creeLe + 10 ans, true sinon (D-109)"
    - "La sidebar contient une entrée racine 'Coffre documentaire' active sur /coffre et /justificatifs/:id (UI-2.1)"
    - "Empty state coffre vide affiche 'Aucun justificatif pour le moment' + CTA 'Ajouter un document' (D-119)"
  artifacts:
    - path: "src/domain/documents/justificatif.ts"
      provides: "Agrégat racine Justificatif (D-102)"
      contains: "class Justificatif"
      min_lines: 80
    - path: "src/domain/documents/stockage-justificatifs.ts"
      provides: "Port domain stockage (D-106) — interface pure"
      contains: "interface StockageJustificatifs"
    - path: "src/domain/documents/convertisseur-image.ts"
      provides: "Port domain conversion HEIC (D-105)"
      contains: "interface ConvertisseurImage"
    - path: "src/infrastructure/storage/stockage-justificatifs-local.ts"
      provides: "Adapter local avec anti-path-traversal WR-03"
      contains: "documents/justificatifs"
    - path: "src/infrastructure/image/convertisseur-image-sharp.ts"
      provides: "Adapter HEIC → JPEG via sharp"
    - path: "src/infrastructure/repositories/justificatif-repository-sqlite.ts"
      provides: "Repository Kysely (versDomaine + versRow + transaction)"
    - path: "migrations/0010_phase4_documents_travaux.sql"
      provides: "Tables justificatifs + tickets_travaux + ticket_justificatifs + indexes (3 tables atomique)"
      contains: "CREATE TABLE IF NOT EXISTS justificatifs"
    - path: "src/web/routes/coffre.ts"
      provides: "Routes POST /coffre/upload, GET /justificatifs/:id, GET /justificatifs/:id/fichier"
      exports: ["plugin"]
    - path: "src/web/schemas/justificatif-schemas.ts"
      provides: "Zod schemas avec superRefine D-103"
      contains: ".superRefine"
    - path: "src/web/views/pages/coffre/upload.ejs"
      provides: "Form upload natif avec fieldset rattachement (UI-4.1, UI-4.2)"
    - path: "src/web/views/pages/justificatifs/detail.ejs"
      provides: "Fiche détail 1 colonne (UI-4.3)"
    - path: "src/web/views/partials/sidebar-nav.ejs"
      provides: "Entrée 'Coffre documentaire' niveau racine (UI-2.1)"
      contains: "Coffre documentaire"
    - path: "tests/bdd/features/coffre.feature"
      provides: "Scénarios BDD @phase4 @doc-01 @doc-03"
      contains: "@phase4"
  key_links:
    - from: "src/web/routes/coffre.ts"
      to: "src/application/documents/uploader-justificatif.ts"
      via: "use case invocation in POST /coffre/upload handler"
      pattern: "uploaderJustificatif\\("
    - from: "src/application/documents/uploader-justificatif.ts"
      to: "src/infrastructure/storage/stockage-justificatifs-local.ts"
      via: "port StockageJustificatifs injecté par main.ts"
      pattern: "stockage\\.ecrire\\("
    - from: "src/application/documents/uploader-justificatif.ts"
      to: "src/application/documents/valider-magic-bytes.ts"
      via: "pure function call avant persistance"
      pattern: "validerMagicBytes\\("
    - from: "src/application/documents/uploader-justificatif.ts"
      to: "src/infrastructure/image/convertisseur-image-sharp.ts"
      via: "port ConvertisseurImage injecté"
      pattern: "convertirVersJpegSiNecessaire\\("
    - from: "src/web/views/pages/coffre/liste.ejs"
      to: "src/web/views/partials/partial-justificatif-row.ejs"
      via: "include partial pour chaque ligne"
      pattern: "partial-justificatif-row"
    - from: "src/web/views/pages/justificatifs/detail.ejs"
      to: "src/web/views/partials/partial-justificatif-preview.ejs"
      via: "include partial preview MIME-aware (D-117)"
      pattern: "partial-justificatif-preview"
    - from: "src/main.ts"
      to: "@fastify/multipart"
      via: "register plugin avec limits.fileSize: 52428800"
      pattern: "@fastify/multipart"
---

<objective>
Walking enabler Phase 4 : livrer le **slice vertical minimal** "uploader → voir → mettre en corbeille" pour les justificatifs (BC Documents), avec invariants D-103 / D-105 / D-118 / D-109 vérifiés bout-en-bout. Ce plan seed tous les artefacts partagés de Phase 4 (identifiants, migration 0010 complète couvrant les 3 tables, ports, adapters, helpers, sidebar nav, multipart, dependency-cruiser rules).

**Purpose:** Permettre à un bailleur LMNP de centraliser sa première facture/bail/diagnostic dès la fin de Wave 1, avec persistance locale durable et garde de rétention 10 ans déjà en place. Tout le reste (recherche facettée, corbeille UX, modifier metadata, Travaux) s'empilera dans les waves suivantes sans rejouer la fondation.

> **Note 1 — UI-1.3 refactor `app.css` DÉJÀ FAIT (NE PAS REJOUER).** Le refactor `public/styles/app.css` (extraction `:root { --couleur-* }` + remplacement des hex hardcodés par `var(--couleur-*)`) est **DÉJÀ implémenté et commité** dans `4744774` ("docs(04): UI design contract — réécriture après discussion explicite (22 gray areas)" — UI restart précédent, même session que la production de l'UI-SPEC). Le refactor UI-3.4 (`.row-actions { visibility: hidden }` supprimé) est aussi déjà fait dans le même commit. **AUCUNE task de Phase 4 ne touche `public/styles/app.css` ni les CSS row-actions** — vérifier en début de wave :
> - `grep -E "^(:root|\s+--couleur-)" public/styles/app.css | head` doit lister les 10 tokens présents.
> - `grep -n "visibility: hidden" public/styles/app.css` doit retourner 0 résultat (refactor UI-3.4 confirmé).
>
> Les nouveaux partials Phase 4 (`partial-justificatif-row.ejs`, `partial-badge-statut-ticket.ejs`, formulaires upload, etc.) consomment **directement** les tokens existants `var(--couleur-accent|warning|destructive|success|neutre|*-bg)` — jamais de hex inline.

> **Note 2 — Lourd en nouveaux fichiers (~40), recommandations pratiques.** Ce plan ouvre 2 BCs (Documents en complet + Travaux scaffolding via migration globale), 6 ports/interfaces, 6 adapters, 5 routes web, 3 EJS pages, 3 partials, 3 helpers, 7 suites de tests. Charge cognitive significative pour l'executor — recommandations :
> - Lire `04-PATTERNS.md` en début de phase pour intérioriser les analogs (chaque nouveau fichier est mappé sur un fichier existant Phase 1-3).
> - Travailler task-by-task séquentiellement sans backtracking : Task 1 (RED) → Task 2 (GREEN domain/infra) → Task 3 (Wire).
> - Ne PAS interleaver les couches : finir le RED (toutes les suites de tests + stubs minimaux compilables) avant d'écrire la première ligne de production.
> - Si la fatigue cognitive monte au-delà de ~50 % du contexte au milieu de Task 2 : commit les fichiers stables (domain + ports + interfaces), reset le contexte, reprendre Task 2 en lisant uniquement les analogs PATTERNS pertinents.

**Output:**
- BC Documents complet (agrégat Justificatif, ports StockageJustificatifs + ConvertisseurImage, repo SQLite, use cases upload + mettre-corbeille + lire).
- Migration 0010 globale (3 tables + indexes — couvre aussi tickets_travaux + ticket_justificatifs pour préparer 04-03 sans migration corrective).
- 5 routes Fastify (`GET /coffre`, `GET /coffre/upload`, `POST /coffre/upload`, `GET /justificatifs/:id`, `GET /justificatifs/:id/fichier`, `POST /justificatifs/:id/corbeille`).
- 3 EJS pages + 3 partials + sidebar nav update.
- 3 helpers (formaterTypeJustificatif, formaterTailleFichier, formaterAnneeFiscale).
- 7 scénarios BDD `@phase4` (5 `@doc-01` + 2 `@doc-03`) verts.
- 100 % couverture unit sur la logique réglementaire (peutEtrePurge D-109).
</objective>

<execution_context>
@/Users/valentinshodo/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/04-coffre-documentaire-travaux/04-CONTEXT.md
@.planning/phases/04-coffre-documentaire-travaux/04-UI-SPEC.md
@.planning/phases/04-coffre-documentaire-travaux/04-PATTERNS.md
@practices/BDD_PRACTICES.md
@practices/DDD.md
@practices/SOFTWARE_CRAFTSMANSHIP.md

# Source analogs à étudier AVANT d'écrire (canonical patterns from PATTERNS.md)
@src/domain/_shared/identifiants.ts
@src/domain/_shared/erreurs.ts
@src/domain/_shared/clock.ts
@src/domain/_shared/money.ts
@src/domain/encaissements/quittance.ts
@src/domain/encaissements/quittance-repository.ts
@src/domain/encaissements/encaissement.ts
@src/domain/encaissements/erreurs.ts
@src/domain/encaissements/pdf-renderer.ts
@src/infrastructure/storage/stockage-fichier-local.ts
@src/infrastructure/repositories/quittance-repository-sqlite.ts
@src/infrastructure/repositories/encaissement-repository-sqlite.ts
@src/infrastructure/db/kysely-types.ts
@src/web/routes/quittances.ts
@src/web/schemas/diagnostic-schemas.ts
@src/web/views/partials/sidebar-nav.ejs
@src/web/views/partials/data-table.ejs
@src/web/views/partials/form-field.ejs
@src/web/views/partials/confirm-dialog.ejs
@src/web/views/partials/banniere-success.ejs
@src/web/views/partials/empty-state.ejs
@src/web/views/partials/layout-debut.ejs
@src/web/views/partials/partial-badge-dpe.ejs
@src/web/views/partials/partial-diagnostic-row.ejs
@src/helpers/format-type-diagnostic.ts
@src/helpers/format-money.ts
@src/main.ts
@migrations/0005_phase2_quittance.sql
@migrations/0008_phase3_edl.sql
@migrations/0009_phase3_bail_indexations.sql
@tests/_builders/encaissements.ts
@tests/bdd/features/diagnostics.feature
@tests/unit/encaissements/quittance.test.ts
@tests/integration/repositories/quittance-repository-sqlite.test.ts
@tests/integration/storage/stockage-fichier-local.test.ts
@.dependency-cruiser.js

<interfaces>
<!-- Key contracts à exporter par CE plan (consumés par 04-02 et 04-03). -->

src/domain/_shared/identifiants.ts (extension Phase 4) :
```typescript
export type JustificatifId = string & { readonly __brand: 'JustificatifId' };
export function nouveauJustificatifId(): JustificatifId;

export type TicketTravauxId = string & { readonly __brand: 'TicketTravauxId' };
export function nouveauTicketTravauxId(): TicketTravauxId;

export type CheminRelatif = string & { readonly __brand: 'CheminRelatif' };
```

src/domain/documents/justificatif.ts :
```typescript
export type TypeJustificatif =
  | 'facture' | 'ticket_caisse' | 'bail_signe' | 'edl_signe'
  | 'diagnostic_pdf' | 'attestation' | 'piece_locataire'
  | 'releve_bancaire' | 'autre';

export type MimeJustificatif =
  | 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';

export const LABELS_TYPE_JUSTIFICATIF: Record<TypeJustificatif, string>;

export interface JustificatifProps {
  id?: JustificatifId;
  type: TypeJustificatif;
  dateDocument: Temporal.PlainDate;
  titre: string;
  montantTtc: Money | null;
  cheminFichier: CheminRelatif;
  nomFichierOriginal: string;
  mimeType: MimeJustificatif;
  tailleOctets: number;
  bienId: BienId | null;
  locataireId: LocataireId | null;
  notes: string | null;
  creeLe: Temporal.PlainDate;
  corbeilleLe: Temporal.PlainDate | null;
  raisonCorbeille: string | null;
}

export class Justificatif {
  readonly id: JustificatifId;
  // ... tous les champs readonly
  static creer(props: JustificatifProps): Justificatif;
  mettreEnCorbeille(raison: string, today: Temporal.PlainDate): Justificatif;
  restaurer(): Justificatif;
  peutEtrePurge(today: Temporal.PlainDate): boolean;
  anneeFiscale(): number;
  toProps(): JustificatifProps;
}
```

src/domain/documents/justificatif-repository.ts :
```typescript
export interface JustificatifRepository {
  enregistrer(justificatif: Justificatif, trx?: unknown): Promise<void>;
  trouverParId(id: JustificatifId | string): Promise<Justificatif | null>;
  rechercher(filtres: {
    search?: string;
    bienId?: BienId | string | null;
    locataireId?: LocataireId | string | null;
    anneeFiscale?: number;
    type?: TypeJustificatif;
    typeIn?: TypeJustificatif[];     // Phase 4 wave 2 — restriction multi-types (D-120 fiche Locataire) — exposé dès Wave 1 future-proof
    inclureCorbeille?: boolean;
    page?: number;
    pageSize?: number;
  }): Promise<{ items: Justificatif[]; total: number }>;
  listerCorbeille(): Promise<Justificatif[]>;
  supprimerDefinitivement(id: JustificatifId, trx?: unknown): Promise<void>;
}
```
**Note interface evolution** : le champ `typeIn?: TypeJustificatif[]` est exposé **dès Wave 1** (future-proof pour D-120 fiche Locataire). L'implémentation côté `JustificatifRepositorySqlite` doit accepter le paramètre dès Wave 1 (Kysely `.where('type', 'in', typeIn)` si fourni — passer le filtre dans l'adapter même si aucun use case Wave 1 ne l'utilise). Wave 2 consommera ce paramètre via `lister-justificatifs-par-locataire.ts` **sans extension d'interface**.

src/domain/documents/stockage-justificatifs.ts (port pure D-106) :
```typescript
export interface StockageJustificatifs {
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

src/domain/documents/convertisseur-image.ts (port pure D-105) :
```typescript
export type MimeTypeImage = 'image/jpeg' | 'image/png' | 'image/heic' | 'image/webp';

export interface ConvertisseurImage {
  convertirVersJpegSiNecessaire(
    bytes: Buffer,
    mimeSource: MimeTypeImage,
  ): Promise<{
    bytes: Buffer;
    mimeFinal: 'image/jpeg' | 'image/png' | 'image/webp';
  }>;
}
```

src/application/documents/valider-magic-bytes.ts :
```typescript
export type MimeDetecte = 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

export function validerMagicBytes(
  bytes: Buffer,
  mimeAnnonce: string,
): { ok: true; mimeFinal: MimeDetecte } | { ok: false; raison: 'mismatch' | 'format-non-accepte' };
```

src/domain/documents/erreurs.ts :
```typescript
export class FichierIntrouvable extends Error { constructor(public cheminRelatif: string); }
export class JustificatifIntrouvable extends Error { constructor(public id: string); }
export class FormatNonAccepte extends Error {}
export class FichierTropVolumineux extends Error {}
export class MimeMismatch extends Error {}
export class DocumentDejaEnCorbeille extends Error {}
export class DocumentNonEnCorbeille extends Error {}
export class PurgeAvantDixAnsRefusee extends Error {
  constructor(public datePurgePossible: Temporal.PlainDate, message: string);
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 — RED: BDD outside-in scénarios + builders + identifiants/migration scaffolding + tests</name>
  <files>
    src/domain/_shared/identifiants.ts,
    src/domain/documents/erreurs.ts,
    src/domain/documents/justificatif.ts (stub minimal),
    src/domain/documents/justificatif-repository.ts (interface),
    src/domain/documents/stockage-justificatifs.ts (interface),
    src/domain/documents/convertisseur-image.ts (interface),
    src/application/documents/valider-magic-bytes.ts (stub),
    migrations/0010_phase4_documents_travaux.sql,
    src/infrastructure/db/kysely-types.ts,
    tests/_builders/documents.ts,
    tests/bdd/features/coffre.feature,
    tests/unit/documents/justificatif.test.ts,
    tests/unit/documents/valider-magic-bytes.test.ts,
    tests/integration/repositories/justificatif-repository-sqlite.test.ts,
    tests/integration/storage/stockage-justificatifs-local.test.ts,
    tests/integration/image/convertisseur-image-sharp.test.ts,
    package.json,
    .dependency-cruiser.js
  </files>
  <behavior>
    Test contracts (RED — must fail before any production logic) :

    **Cucumber `coffre.feature` (tag @phase4 @doc-01 @doc-03)** — 7 scénarios :
    1. @doc-01 Upload PDF facture rattaché à un Bien → redirect /justificatifs/:id + bannière "Document ajouté." + 1 row table justificatifs avec type=facture bien_id=:id.
    2. @doc-01 Upload rejeté sans rattachement (D-103) → message "Le document doit être rattaché à un bien ou à un locataire." + 0 row.
    3. @doc-01 Upload rejeté MIME ≠ magic-bytes (D-118) → POST .pdf renommé depuis image JPG → "Le fichier ne correspond pas au format annoncé. Le téléversement a été refusé pour des raisons de sécurité."
    4. @doc-01 Upload > 50 Mo (D-105) → HTTP 413 + "Fichier trop volumineux. La taille maximale est 50 Mo."
    5. @doc-01 Upload HEIC converti en JPEG (D-105) → row mime_type=image/jpeg, extension fichier .jpg sur disque.
    6. @doc-03 Soft-delete réversible (D-109) → row reste, corbeille_le rempli, fichier physique inchangé.
    7. @doc-03 peutEtrePurge avant 10 ans renvoie false (D-109) — couvert principalement par unit test mais référencé en feature pour traçabilité réglementaire.

    **Unit `justificatif.test.ts`** :
    - creer() lance InvariantViolated avec verbatim UI-6.2 "Le document doit être rattaché à un bien ou à un locataire." si bienId ET locataireId null (D-103).
    - creer() lance InvariantViolated si mimeType ∉ {application/pdf, image/jpeg, image/png, image/webp} — en particulier image/heic interdit en domaine (post-conversion infra D-105).
    - creer() lance InvariantViolated si tailleOctets ≤ 0 ou > 52428800.
    - mettreEnCorbeille(raison, today) retourne nouvelle instance avec corbeilleLe=today, raisonCorbeille=raison ; throw si déjà en corbeille.
    - restaurer() retourne nouvelle instance avec corbeilleLe=null, raisonCorbeille=null ; throw si pas en corbeille.
    - peutEtrePurge(today) : 3 cas — today = creeLe + 10 ans - 1 jour → false ; today = creeLe + 10 ans → true ; today = creeLe + 10 ans + 1 jour → true.
    - anneeFiscale() retourne dateDocument.year (D-107).

    **Unit `valider-magic-bytes.test.ts`** (D-118) :
    - %PDF- (5 bytes header 0x25 0x50 0x44 0x46 0x2D) → ok mimeFinal='application/pdf'.
    - 0xFF 0xD8 0xFF → image/jpeg.
    - 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A → image/png.
    - RIFF (0..3) + WEBP (8..11) → image/webp.
    - ftypheic / ftypheix / ftypmif1 / ftypmsf1 à offset 4 → image/heic.
    - Buffer aléatoire → { ok: false, raison: 'format-non-accepte' }.
    - Magic JPG mais mimeAnnonce='application/pdf' → { ok: false, raison: 'mismatch' }.

    **Integration `justificatif-repository-sqlite.test.ts`** :
    - enregistrer + trouverParId roundtrip (Money centimes, PlainDate, mimeType, les 3 combinaisons rattachement bienSeul/locataireSeul/lesDeux).
    - rechercher LIKE case-insensitive sur titre, notes, nomFichierOriginal (3 assertions séparées).
    - rechercher filtres facettés bienId / locataireId / type / anneeFiscale isolés et combinés.
    - rechercher avec `typeIn: ['piece_locataire','releve_bancaire','attestation','autre']` (future-proof D-120 — paramètre implémenté Wave 1, consommé Wave 2) : retourne uniquement les justificatifs dont le type est dans la liste.
    - rechercher pagination page=1 size=20 sur 25 items → 20 items + total=25 ; page=2 → 5 items.
    - upsert via onConflict(id) sur soft-delete : enregistrer 2 fois change corbeille_le sans dupliquer.
    - listerCorbeille retourne uniquement corbeille_le ≠ null.
    - supprimerDefinitivement hard-delete la row.

    **Integration `stockage-justificatifs-local.test.ts`** :
    - ecrire(annee, id, slug, ext, bytes) crée fichier sous baseDir/documents/justificatifs/{annee}/{id}-{slug}.{ext} avec flag 'wx'. Deuxième écriture même chemin → throw EEXIST (immutabilité).
    - lire(cheminRelatif) retourne Buffer identique octet pour octet.
    - supprimer(cheminRelatif) supprime physiquement le fichier (D-109 purge).
    - WR-03 anti-path-traversal : `..` dans chemin → FichierIntrouvable ; NUL byte (\0) → FichierIntrouvable ; symlink escape → FichierIntrouvable (3 cas).
    - slugify : caractères accentués normalisés (NFD + suppression marks), ≤ 80 chars, fallback "document" si vide après normalisation.

    **Integration `convertisseur-image-sharp.test.ts`** :
    - HEIC fixture → JPEG buffer non vide + mimeFinal='image/jpeg'.
    - JPEG/PNG/WebP passe-through : bytes inchangés (Buffer.equals), mimeFinal identique au mimeSource.
    - HEIC corrompu → erreur explicite propagée (pas crash serveur).
  </behavior>
  <action>
    Étendre `src/domain/_shared/identifiants.ts` selon pattern d'extension Phase 3 (PATTERNS §identifiants.ts) — ajouter les brand types `JustificatifId`, `TicketTravauxId`, `CheminRelatif` et les générateurs `nouveauJustificatifId`, `nouveauTicketTravauxId`. NE PAS toucher aux types existants (Phase 1-3).

    Créer `src/domain/documents/erreurs.ts` avec les classes : FichierIntrouvable (porte cheminRelatif), JustificatifIntrouvable (porte id), FormatNonAccepte, FichierTropVolumineux, MimeMismatch, DocumentDejaEnCorbeille, DocumentNonEnCorbeille, PurgeAvantDixAnsRefusee (porte datePurgePossible + message verbatim UI-6.2 incluant date formatée FR). NE PAS réutiliser les erreurs du BC Encaissements — séparation BC stricte (D-106).

    Créer des stubs minimaux compilables pour `src/domain/documents/justificatif.ts` (export Justificatif class avec creer/mettreEnCorbeille/restaurer/peutEtrePurge/anneeFiscale/toProps qui throw "Not implemented"), `justificatif-repository.ts` (interface seule), `stockage-justificatifs.ts` (interface seule), `convertisseur-image.ts` (interface seule), `src/application/documents/valider-magic-bytes.ts` (export fonction qui throw "Not implemented"). Ces stubs servent à faire compiler les tests RED.

    Créer la migration `migrations/0010_phase4_documents_travaux.sql` selon analogs `0005_phase2_quittance.sql` + `0008_phase3_edl.sql` (PATTERNS §migration). Header commenté référençant D-102 D-103 D-104 D-106 D-108 D-109 D-110 D-112 D-113. Une seule transaction BEGIN/COMMIT. Contenu :
    - Table `justificatifs` (id TEXT PK, type TEXT NOT NULL CHECK in 9 valeurs énumérées D-104, date_document TEXT ISO, titre TEXT NOT NULL, montant_ttc_centimes INTEGER NULL, chemin_fichier TEXT NOT NULL, nom_fichier_original TEXT NOT NULL, mime_type TEXT NOT NULL CHECK in pdf/jpeg/png/webp, taille_octets INTEGER NOT NULL CHECK > 0 AND ≤ 52428800, bien_id TEXT NULL REFERENCES bien(id), locataire_id TEXT NULL REFERENCES locataire(id), notes TEXT NULL, cree_le TEXT NOT NULL, corbeille_le TEXT NULL, raison_corbeille TEXT NULL, **CHECK (bien_id IS NOT NULL OR locataire_id IS NOT NULL)** per D-103 défense en profondeur).
    - Table `tickets_travaux` (id TEXT PK, bien_id TEXT NOT NULL REFERENCES bien(id), titre TEXT NOT NULL, description TEXT NOT NULL, date_ouverture TEXT NOT NULL, date_cloture TEXT NULL, statut TEXT NOT NULL CHECK in ('ouvert','en_cours','clos','annule'), cout_estime_ttc_centimes INTEGER NULL, cout_reel_ttc_centimes INTEGER NULL, notes TEXT NULL, cree_le TEXT NOT NULL, annule_le TEXT NULL, **raison_annulation TEXT NULL**). Champ `raison_annulation` ajouté dès la migration 0010 pour cohérence avec Pattern 3 soft-delete + Phase 2 encaissement (évite migration corrective 0011 en wave 3). **AUCUN champ `nature`** (D-115 explicite — qualification fiscale différée Phase 5 BC Fiscalité).
    - Table N:N `ticket_justificatifs` (ticket_id TEXT NOT NULL REFERENCES tickets_travaux(id) ON DELETE CASCADE, justificatif_id TEXT NOT NULL REFERENCES justificatifs(id), **pas de CASCADE sur justificatif** per D-113 cascade asymétrique — rétention 10 ans D-109 prime sur la suppression d'un ticket. PRIMARY KEY (ticket_id, justificatif_id)).
    - Indexes (partiels où pertinent, cohérent D-110) : idx_justificatifs_bien (partial WHERE corbeille_le IS NULL), idx_justificatifs_locataire (partial), idx_justificatifs_date_document (partial), idx_justificatifs_type (partial), idx_justificatifs_corbeille (sur corbeille_le pour /coffre/corbeille rapide), idx_tickets_travaux_bien (partial WHERE annule_le IS NULL), idx_tickets_travaux_statut (partial).

    Étendre `src/infrastructure/db/kysely-types.ts` avec 3 row types matchant la migration : `JustificatifsRow`, `TicketsTravauxRow` (incluant `raison_annulation: string | null`), `TicketJustificatifsRow`. Ajouter ces tables au type DB exporté.

    Créer `tests/_builders/documents.ts` selon analog `tests/_builders/encaissements.ts` (PATTERNS §builders). Builders :
    - `unJustificatifValide(overrides)` retourne JustificatifProps complet avec defaults raisonnables (type=facture, dateDocument=2026-05-01, titre='Facture test', montantTtc=Money.fromEuros(120), cheminFichier='justificatifs/2026/uuid-slug.pdf' as CheminRelatif, mimeType='application/pdf', tailleOctets=12345, bienId=randomUUID() as BienId, locataireId=null, creeLe=2026-05-01).
    - `unJustificatifAvecBienSeul(overrides)` : locataireId=null forcé.
    - `unJustificatifAvecLocataireSeul(overrides)` : bienId=null, locataireId fourni forcé.
    - `unJustificatifEnCorbeille(overrides)` : corbeilleLe=2026-05-10, raisonCorbeille='Doublon'.
    - `unJustificatifAncienDixAns(today, overrides)` : creeLe = today.subtract({years:10}) — pour tester peutEtrePurge à la limite.

    Écrire `tests/bdd/features/coffre.feature` (PATTERNS §coffre.feature analog diagnostics.feature) avec tag header `@phase4 @doc-01 @doc-03` et 7 scénarios listés en behavior. Background fixe une clock à 2026-05-18 + un Bien créé via builder.

    Écrire les 5 suites de tests (unit + integration) listées en behavior — toutes assertions concrètes, valeurs explicites, AAA (Arrange/Act/Assert) avec ligne blanche, AUCUN if/for dans les tests (utiliser test.each pour paramétrer si besoin). Les tests doivent **compiler** mais **échouer** (RED) car les stubs throw "Not implemented".

    Étendre `package.json` `dependencies` : `@fastify/multipart ^9` (compat Fastify v5 / Node 22 LTS), `sharp ^0.33` (vérifier prebuild HEIF — sinon documenter en commentaire que `vips` system dep requis via mise local — référencer DP-22), `file-type ^19` (ESM pur — installé par anticipation, mais non importé en domaine ni dans la fonction pure validerMagicBytes ; utilisable côté infra plus tard si nécessaire). Lancer `pnpm install` après ajout.

    Étendre `.dependency-cruiser.js` avec 3 règles (PATTERNS §Pattern 1) :
    - `no-tech-in-documents` : `from { path: '^src/domain/documents' } to { path: 'node_modules/(kysely|fastify|@fastify/multipart|better-sqlite3|sharp|file-type)' }` sévérité error.
    - `no-tech-in-travaux` : idem `^src/domain/travaux`.
    - `travaux-can-reference-port-justificatif` : autorise `src/domain/travaux/**` à importer `src/domain/documents/justificatif-repository.ts` (port) mais PAS les adapters (`src/infrastructure/repositories/justificatif-repository-sqlite.ts`).

    Faire en sorte que `pnpm typecheck` et `pnpm lint` passent en RED (les tests échouent mais le code compile + lint est propre).
  </action>
  <verify>
    <automated>pnpm install &amp;&amp; pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; sqlite3 :memory: ".read migrations/0010_phase4_documents_travaux.sql" &amp;&amp; pnpm depcruise src --config .dependency-cruiser.js &amp;&amp; pnpm cucumber-js --tags @phase4 --dry-run | grep -E "(@doc-01|@doc-03)" | wc -l | grep -q "^7$" &amp;&amp; (pnpm vitest run tests/unit/documents tests/integration/repositories/justificatif-repository-sqlite.test.ts tests/integration/storage/stockage-justificatifs-local.test.ts tests/integration/image/convertisseur-image-sharp.test.ts 2>&amp;1 | grep -E "(FAIL|Tests.*failed)" | grep -v "0 failed")</automated>
  </verify>
  <done>
    typecheck + lint passent (0 erreur, 0 warning).
    Migration 0010 applique cleanly sur sqlite :memory:.
    dependency-cruiser exit 0 (règles BC Documents/Travaux respectées sur les stubs).
    Cucumber dry-run liste 7 scénarios `@phase4` (5 @doc-01 + 2 @doc-03).
    Vitest : tests unit + integration échouent (RED) — assertion failures, pas erreurs d'import.
    Brand types JustificatifId, TicketTravauxId, CheminRelatif exportés.
    Erreurs documents/erreurs.ts exportées.
    Migration 0010 inclut le champ `raison_annulation TEXT NULL` sur tickets_travaux.
    package.json contient @fastify/multipart, sharp, file-type. pnpm-lock.yaml updated.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 — GREEN: Domain Justificatif + ports + adapters + use case uploaderJustificatif</name>
  <files>
    src/domain/documents/justificatif.ts,
    src/domain/documents/justificatif-repository.ts,
    src/domain/documents/stockage-justificatifs.ts,
    src/domain/documents/convertisseur-image.ts,
    src/application/documents/valider-magic-bytes.ts,
    src/application/documents/uploader-justificatif.ts,
    src/application/documents/mettre-justificatif-en-corbeille.ts,
    src/application/documents/lire-justificatif.ts,
    src/infrastructure/storage/stockage-justificatifs-local.ts,
    src/infrastructure/image/convertisseur-image-sharp.ts,
    src/infrastructure/repositories/justificatif-repository-sqlite.ts
  </files>
  <behavior>
    Référencés Task 1 (mêmes tests, doivent maintenant tous passer GREEN).

    Précisions complémentaires testables :
    - Justificatif.creer valide MIME ∈ {application/pdf, image/jpeg, image/png, image/webp} (image/heic interdit en domaine — converti côté infra D-105).
    - JustificatifRepositorySqlite.rechercher : SQL LIKE paramétré via Kysely (bind params — pas de concat string).
    - StockageJustificatifsLocal.ecrire slugifie via NFD + remove marks + replace non-alphanumeric par '-' + trim '-' + max 80 chars + fallback "document" si vide (DP-27).
    - uploaderJustificatif compensation : si stockage.ecrire jette ENOENT/EACCES après commit trx, le use case soft-delete la row insérée et propage l'erreur initiale. Si compensation échoue elle aussi, log `[CRITICAL]` avec les deux erreurs.
    - ConvertisseurImageSharp HEIC corrompu : sharp jette → use case wrap en erreur métier explicite.
  </behavior>
  <action>
    Implémenter `src/domain/documents/justificatif.ts` selon analog `src/domain/encaissements/quittance.ts` + extension Phase 4 (PATTERNS §justificatif.ts) :
    - Class Justificatif avec props readonly (cf. interfaces).
    - Constructor privé.
    - Factory `static creer(props)` validant D-103 (≥1 bienId/locataireId non-null, message UI-6.2 verbatim "Le document doit être rattaché à un bien ou à un locataire."), MIME ∈ ensemble fermé (4 valeurs post-conversion infra), tailleOctets > 0 && ≤ 52428800.
    - `mettreEnCorbeille(raison, today)` copy-on-write (Pattern 3 PATTERNS §Shared) : throw DocumentDejaEnCorbeille si corbeilleLe !== null ; sinon retourne new Justificatif.creer({ ...this.toProps(), corbeilleLe: today, raisonCorbeille: raison }).
    - `restaurer()` symétrique : throw DocumentNonEnCorbeille si corbeilleLe === null.
    - `peutEtrePurge(today)` : `Temporal.PlainDate.compare(today, this.creeLe.add({years: 10})) >= 0` (D-109).
    - `anneeFiscale()` : `this.dateDocument.year` (D-107).
    - `toProps()` privé retourne JustificatifProps.
    - Constante exportée `LABELS_TYPE_JUSTIFICATIF` (D-104 — labels FR pour les 9 valeurs).

    Implémenter `src/domain/documents/justificatif-repository.ts` : interface complète (cf. interfaces) — méthodes `enregistrer`, `trouverParId`, `rechercher`, `listerCorbeille`, `supprimerDefinitivement`.

    Implémenter `src/domain/documents/stockage-justificatifs.ts` (port pur D-106 — 3 méthodes ecrire/lire/supprimer).

    Implémenter `src/domain/documents/convertisseur-image.ts` (port pur D-105 — 1 méthode convertirVersJpegSiNecessaire).

    Implémenter `src/application/documents/valider-magic-bytes.ts` (D-118 — fonction PURE, aucun import infrastructure) :
    - Lit les ≤ 12 premiers octets du Buffer en arguments.
    - Détecte : %PDF- (5 bytes) → application/pdf ; 0xFF 0xD8 0xFF → image/jpeg ; 0x89 PNG signature (8 bytes) → image/png ; RIFF + WEBP croisé → image/webp ; ftypheic/ftypheix/ftypmif1/ftypmsf1 à offset 4 (4 bytes) → image/heic.
    - Si format inconnu → `{ ok: false, raison: 'format-non-accepte' }`.
    - Si magic ≠ mimeAnnonce → `{ ok: false, raison: 'mismatch' }` (D-118 : magic gagne).
    - Sinon `{ ok: true, mimeFinal }`.

    Implémenter `src/application/documents/uploader-justificatif.ts` selon Pattern 5 (PATTERNS §Shared, analog `src/application/encaissements/generer-quittance.ts`) :
    - Signature : `uploaderJustificatif(commande, deps)` où `commande = { titre, type, dateDocument, bienId?, locataireId?, notes?, montantTtc?, fichier: { buffer, nomOriginal, mimeAnnonce } }` et `deps = { justificatifRepo, bienRepo, locataireRepo, stockage, convertisseurImage, clock, db }`.
    - Étape 1 (hors trx) — vérifications référentielles : si bienId fourni, bienRepo.trouverParId (throw "Bien introuvable." si null) ; idem locataireRepo.
    - Étape 2 (hors trx) — validation MIME : `validerMagicBytes(buffer, mimeAnnonce)` → si `format-non-accepte` throw FormatNonAccepte ("Format non accepté. Formats autorisés : PDF, JPG, PNG, HEIC, WebP." UI-6.2) ; si `mismatch` throw MimeMismatch (verbatim UI-6.2).
    - Étape 3 (hors trx) — conversion image : si mimeDetecte ∈ {image/jpeg, image/png, image/heic, image/webp}, appel `convertisseurImage.convertirVersJpegSiNecessaire(buffer, mimeDetecte)` qui retourne `{ bytes, mimeFinal }`. Sinon (application/pdf) passe-through `{ bytes: buffer, mimeFinal: 'application/pdf' as const }`. Wrap try/catch pour propager erreur HEIC corrompu.
    - Étape 4 (hors trx) — préparation chemin : extension = '.pdf' | '.jpg' | '.png' | '.webp' (jamais '.heic'). justificatifId = nouveauJustificatifId(). slug = StockageJustificatifsLocal.slugify(titre). anneeFiscale = dateDocument.year (D-107).
    - Étape 5 (trx Kysely) : Justificatif.creer avec props complètes (cheminFichier pré-calculé comme `documents/justificatifs/${anneeFiscale}/${justificatifId}-${slug}${ext}` as CheminRelatif). `justificatifRepo.enregistrer(justificatif, trx)`. Commit.
    - Étape 6 (hors trx) : `stockage.ecrire(anneeFiscale, justificatifId, slug, ext.replace('.',''), bytes)`. Si erreur ENOENT/EACCES/EEXIST : compensation via `mettreJustificatifEnCorbeille({id, raison: 'Échec écriture disque'}, clock.aujourdhui())`. Si compensation throw elle aussi, log `[CRITICAL]` avec les deux erreurs + propagation de l'erreur initiale.
    - Retourne `{ justificatifId, cheminFichier }`.

    Implémenter `src/application/documents/mettre-justificatif-en-corbeille.ts` : signature `({ id, raison }, { justificatifRepo, clock })` → lookup (throw JustificatifIntrouvable) → `.mettreEnCorbeille(raison, clock.aujourdhui())` → `repo.enregistrer` (upsert).

    Implémenter `src/application/documents/lire-justificatif.ts` : `({ id }, { justificatifRepo, stockage })` → lookup (throw JustificatifIntrouvable) → si `corbeille_le !== null` throw `DocumentDejaEnCorbeille` (sera mappé en 410 côté route en Task 3) → retourne `{ justificatif, bytes: await stockage.lire(j.cheminFichier) }`.

    Implémenter `src/infrastructure/storage/stockage-justificatifs-local.ts` (PATTERNS §stockage-justificatifs-local.ts) :
    - Constructor `(baseDir: string)` — baseDir par défaut `path.join(os.homedir(), '.local', 'share', 'gestion-locative')` ou env `GESTION_LOCATIVE_HOME`.
    - `ecrire(annee, justificatifId, slug, ext, bytes)` : path = `documents/justificatifs/${annee}/${justificatifId}-${slug}.${ext}`. `await fs.mkdir(dirname(absolu), { recursive: true })`. `await fs.writeFile(absolu, bytes, { flag: 'wx' })`. Retourne le chemin relatif (string casté CheminRelatif).
    - `lire(cheminRelatif)` : WR-03 anti-path-traversal copié intégralement de `src/infrastructure/storage/stockage-fichier-local.ts` (NUL byte check, path.resolve check baseDir prefix, realpath check), ENOENT → throw FichierIntrouvable (depuis `domain/documents/erreurs.ts`, PAS `domain/encaissements/erreurs.ts` — séparation BC).
    - `supprimer(cheminRelatif)` : même check WR-03 puis `await fs.unlink(absolu)`.
    - Static `slugify(input)` per PATTERNS §slugify pattern (NFD, suppression marks, replace [^a-z0-9]+ → '-', trim '-', slice 0..80, fallback 'document' si empty).

    Implémenter `src/infrastructure/image/convertisseur-image-sharp.ts` :
    - `convertirVersJpegSiNecessaire(bytes, mimeSource)` : si mimeSource === 'image/heic' → `await sharp(bytes).jpeg({ quality: 85 }).toBuffer()` retourne `{ bytes: jpegBuffer, mimeFinal: 'image/jpeg' }`. Sinon (jpeg/png/webp) passe-through `{ bytes, mimeFinal: mimeSource }`. Try/catch sharp pour wrap erreur métier explicite (ne pas crash serveur).

    Implémenter `src/infrastructure/repositories/justificatif-repository-sqlite.ts` (Pattern 4 PATTERNS §Shared, analog quittance-repository-sqlite + encaissement-repository-sqlite pour Money) :
    - DbOrTrx type, `enregistrer` avec onConflict('id').doUpdateSet sur les champs mutables (corbeille_le, raison_corbeille, titre, montant_ttc_centimes, notes — chemin/mime/taille/cree_le immuables).
    - `trouverParId(id)`.
    - `rechercher(filtres)` Kysely query builder : conditional `.where`. SQL LIKE sur titre/notes/nom_fichier_original via `.where(eb => eb.or([eb('titre', 'like', `%${s}%`), eb('notes', 'like', `%${s}%`), eb('nom_fichier_original', 'like', `%${s}%`)]))` — bind params via Kysely (jamais concat string). Filtres équivalence pour bienId/locataireId/type. **`typeIn?: TypeJustificatif[]` → `.where('type', 'in', typeIn)` si fourni** (future-proof Wave 2 D-120 — implémenté dès Wave 1 dans l'adapter pour stabilité de l'interface). anneeFiscale → `strftime('%Y', date_document) = ?`. `inclureCorbeille=false` par défaut (where corbeille_le is null). Pagination `.limit(pageSize).offset((page-1)*pageSize)`. Total via query séparée `count(*)`.
    - `listerCorbeille()` retourne where corbeille_le IS NOT NULL ORDER BY corbeille_le DESC.
    - `supprimerDefinitivement(id, trx?)` hard-delete.
    - `versDomaine(row)` / `versRow(j)` selon Pattern 4 (Money roundtrip `Money.fromCentimes(BigInt(row.montant_ttc_centimes))` lecture ; `Number(j.montantTtc.toCentimes())` écriture ; PlainDate roundtrip `Temporal.PlainDate.from(row.x).toString()`).

    Faire passer 100 % des tests Task 1.
  </action>
  <verify>
    <automated>pnpm vitest run tests/unit/documents tests/integration/repositories/justificatif-repository-sqlite.test.ts tests/integration/storage/stockage-justificatifs-local.test.ts tests/integration/image/convertisseur-image-sharp.test.ts --reporter=verbose &amp;&amp; pnpm depcruise src --config .dependency-cruiser.js &amp;&amp; pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; pnpm vitest run --coverage tests/unit/documents/justificatif.test.ts 2>&amp;1 | grep -E "justificatif.ts.*100"</automated>
  </verify>
  <done>
    100 % des tests `tests/unit/documents/*.test.ts` verts (factory invariants D-103/D-105, peutEtrePurge D-109, copy-on-write soft-delete).
    100 % des tests integration repo + storage + image verts.
    `pnpm depcruise src` exit 0 — séparation BC stricte (aucun import infra dans `src/domain/documents/**`).
    `pnpm typecheck && pnpm lint` exit 0 (0 warning).
    Couverture `src/domain/documents/justificatif.ts` = 100 % (logique réglementaire impérative D-109, SOFTWARE_CRAFTSMANSHIP §8).
    Aucun fichier HEIC/JPEG/PDF résiduel dans tmp après tests (cleanup afterEach).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 — Wire: routes Fastify + EJS pages + sidebar + main.ts + Cucumber GREEN</name>
  <files>
    src/web/routes/coffre.ts,
    src/web/schemas/justificatif-schemas.ts,
    src/web/views/pages/coffre/liste.ejs,
    src/web/views/pages/coffre/upload.ejs,
    src/web/views/pages/justificatifs/detail.ejs,
    src/web/views/partials/partial-upload-form.ejs,
    src/web/views/partials/partial-justificatif-row.ejs,
    src/web/views/partials/partial-justificatif-preview.ejs,
    src/web/views/partials/sidebar-nav.ejs,
    src/helpers/format-type-justificatif.ts,
    src/helpers/format-taille-fichier.ts,
    src/helpers/format-annee-fiscale.ts,
    src/main.ts,
    tests/bdd/steps/coffre.steps.ts
  </files>
  <behavior>
    Les 7 scénarios `@phase4` (5 `@doc-01` + 2 `@doc-03`) Cucumber doivent passer GREEN bout-en-bout :
    - Upload PDF facture → 302 redirect /justificatifs/:id + session.banniereSuccess = "Document ajouté." + row en BD + fichier physique sur disque.
    - Upload sans rattachement → 200 re-render upload.ejs avec aria-invalid + verbatim UI-6.2 D-103.
    - Upload MIME ≠ magic → 422 + verbatim UI-6.2 D-118.
    - Upload > 50 Mo → 413 + verbatim UI-6.2.
    - Upload HEIC → BD mime_type=image/jpeg, fichier disque `.jpg`.
    - Soft-delete → row reste, corbeille_le rempli, fichier physique inchangé.
    - peutEtrePurge < 10 ans = false (vérifié via assertion sur l'agrégat instancié dans le step).

    Step definitions Cucumber utilisent `app.inject` (Fastify) pour simuler HTTP, jamais real HTTP server.
  </behavior>
  <action>
    Implémenter `src/web/schemas/justificatif-schemas.ts` (PATTERNS §schémas, analog diagnostic-schemas.ts) :
    - `uploadJustificatifSchema` Zod :
      - `titre`: z.string().trim().min(1, 'Le titre est obligatoire.').max(200).
      - `type`: z.enum(['facture','ticket_caisse','bail_signe','edl_signe','diagnostic_pdf','attestation','piece_locataire','releve_bancaire','autre'], { errorMap: () => ({ message: 'Le type de document est obligatoire.' }) }).
      - `dateDocument`: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ.').refine(s => Temporal.PlainDate.compare(Temporal.PlainDate.from(s), Temporal.Now.plainDateISO()) <= 0, 'La date du document ne peut pas être dans le futur.').
      - `bienId`: z.string().uuid().optional().nullable().
      - `locataireId`: z.string().uuid().optional().nullable().
      - `montantTtcCentimes`: z.coerce.number().int().nonnegative().optional().nullable().
      - `notes`: z.string().trim().max(2000).optional().nullable().
      - `rattachement`: z.enum(['bien','locataire','bien_et_locataire']).
    - `.superRefine` (D-103) : si rattachement='bien' && !bienId → addIssue path:['bienId'] message "Le bien à rattacher est obligatoire." ; idem rattachement='locataire' && !locataireId → "Le locataire à rattacher est obligatoire." ; idem rattachement='bien_et_locataire' && (!bienId || !locataireId) → "Le document doit être rattaché à un bien ET à un locataire."

    Implémenter `src/web/routes/coffre.ts` (PATTERNS §coffre.ts, analog quittances.ts) :
    - Plugin signature : `async function plugin(app, opts: { justificatifRepo, bienRepo, locataireRepo, stockage, convertisseurImage, clock, db })`.
    - `GET /coffre` : Pattern 6 (PATTERNS §Shared — bannières session lecture/cleanup). Récupère biens + locataires pour les dropdowns (préparation 04-02 — listes chargées même si filtres pas branchés en wave 1). Appelle `justificatifRepo.rechercher({ page: 1, pageSize: 20 })` sans filtres en wave 1. Récupère aussi `repo.listerCorbeille().length` pour le compteur "Corbeille (N)" affiché conditionnellement (N > 0). Render `pages/coffre/liste.ejs` avec `{ items, total, biens, locataires, filtres: {}, navActive: 'coffre', nbCorbeille, banniereSuccess, banniereWarning }`.
    - `GET /coffre/upload` : récupère biens + locataires, render `pages/coffre/upload.ejs` avec `{ biens, locataires, navActive: 'coffre', erreurs: null, valeurs: {} }`.
    - `POST /coffre/upload` : `const data = await req.file()` (@fastify/multipart) → si null bannière warning + redirect /coffre/upload. Sinon `buffer = await data.toBuffer()`. Reconstruit le body texte depuis `data.fields` (chaque field est `{ value }`). Zod parse → si erreurs, re-render `upload.ejs` avec valeurs + erreurs + status 200. Appel `uploaderJustificatif`. Try/catch :
      - FormatNonAccepte → 415, re-render upload.ejs avec erreur "Format non accepté. Formats autorisés : PDF, JPG, PNG, HEIC, WebP."
      - FichierTropVolumineux (ou Fastify FST_REQ_FILE_TOO_LARGE) → 413, re-render avec "Fichier trop volumineux. La taille maximale est 50 Mo." (Fastify multipart émet déjà 413 si limits dépassée — handler global ou local).
      - MimeMismatch → 422, re-render avec "Le fichier ne correspond pas au format annoncé. Le téléversement a été refusé pour des raisons de sécurité."
      - InvariantViolated → 200, re-render avec err.message (déjà verbatim UI-6.2).
      - Sinon : `req.session.banniereSuccess = 'Document ajouté.'` + 302 redirect `/justificatifs/${justificatifId}`.
    - `GET /justificatifs/:id` : lookup (404 si null avec message "Document introuvable.") → si corbeille redirect /coffre avec warning "Ce document est en corbeille." (en wave 1 — wave 2 ajoutera la route /coffre/corbeille proper). Récupère bien/locataire pour les liens. Render `pages/justificatifs/detail.ejs` avec `{ justificatif, bien, locataire, navActive: 'coffre' }`.
    - `GET /justificatifs/:id/fichier` (PATTERNS §download streaming, analog quittances.ts:164-186) : lookup (404), si corbeille 410. `buffer = await stockage.lire(j.cheminFichier)`. Reply.header Content-Type=j.mimeType, Content-Disposition `attachment; filename="${j.nomFichierOriginal}"`. `reply.send(buffer)`. Catch FichierIntrouvable → 404 "Fichier introuvable."
    - `POST /justificatifs/:id/corbeille` : Zod body `{ raison: z.string().trim().min(1).max(500).optional() }` (raison optionnelle pour V1 — peut être 'Soft-delete utilisateur'). Appel `mettreJustificatifEnCorbeille({ id, raison: body.raison ?? 'Mise en corbeille' })`. `req.session.banniereSuccess = 'Document déplacé vers la corbeille.'` → 302 redirect `/coffre`. Catch JustificatifIntrouvable → 404.

    Implémenter `src/web/views/pages/coffre/liste.ejs` (UI-3.1 minimal — filtres facettés full ajoutés en 04-02) :
    - Include `partial-layout-debut` avec `{ titre: 'Coffre documentaire', breadcrumbs: [{label:'Coffre documentaire'}], navActive: 'coffre' }`.
    - Include `partial-banniere-success` si banniereSuccess.
    - Header section : `<h1>Coffre documentaire</h1>` + flex container avec `<a href="/coffre/corbeille">Corbeille (<%= nbCorbeille %>)</a>` conditionnel (nbCorbeille > 0) + `<a href="/coffre/upload" role="button">Ajouter un document</a>` styled `var(--couleur-accent)`.
    - Si `items.length === 0` : include `partial-empty-state` avec heading "Aucun justificatif pour le moment" + body "Commencez par téléverser une facture, un bail signé ou un diagnostic." + CTA "Ajouter un document" → /coffre/upload (D-119 verbatim).
    - Sinon : `<table aria-label="Justificatifs">` avec `<thead>` 7 cols (Date | Type | Titre | Bien | Locataire | Montant | Actions) puis `<tbody>` boucle `items` → include `partial-justificatif-row` avec `{ j: item }`.
    - Pas de filtres facettés ni pagination en 04-01 (placeholder commenté "Filtres ajoutés en 04-02 plan").
    - Include `partial-layout-fin`.

    Implémenter `src/web/views/pages/coffre/upload.ejs` (UI-4.1) :
    - Layout (navActive='coffre', breadcrumbs `[{label:'Coffre documentaire', href:'/coffre'}, {label:'Ajouter un document'}]`).
    - `<h1>Ajouter un document</h1>`.
    - `<form enctype="multipart/form-data" method="POST" action="/coffre/upload">` avec inclusion `partial-upload-form` + biens/locataires/erreurs/valeurs.
    - `<button type="submit">Téléverser le document</button>` + lien Annuler vers /coffre.

    Implémenter `src/web/views/partials/partial-upload-form.ejs` (UI-4.1 ordre exact + UI-4.2 fieldset) :
    - Champ fichier en premier : `<label for="fichier">Fichier</label><input id="fichier" name="fichier" type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" required aria-describedby="fichier-hint"><p id="fichier-hint">PDF, JPG, PNG, HEIC, WebP — max 50 Mo</p>`.
    - Erreur générique sur le fichier si erreurs.fichier : `<small class="error-msg"><%= erreurs.fichier %></small>`.
    - Champ `<input id="titre" name="titre" type="text" required value="<%= valeurs.titre || '' %>">` + label "Titre" + aria-invalid + .error-msg conditionnel.
    - Champ `<input id="dateDocument" name="dateDocument" type="date" required value="<%= valeurs.dateDocument || '' %>">` + label "Date du document".
    - Champ `<select id="type" name="type" required>` + label "Type" — boucle 9 options enum LABELS_TYPE_JUSTIFICATIF avec selected si valeurs.type === option.
    - Fieldset UI-4.2 : `<fieldset><legend>Rattacher à</legend>` + 3 `<label><input type="radio" name="rattachement" value="bien|locataire|bien_et_locataire" required <% if valeurs.rattachement === ... %>checked<% } %>> Un Bien | Un Locataire | Un Bien et un Locataire</label>` + `</fieldset>`.
    - Dropdowns conditionnels : `<div class="field-rattachement-bien"><label for="bienId">Bien</label><select id="bienId" name="bienId">` option "Choisir..." + boucle biens. Idem locataires. Affichage conditionnel via CSS-only (`form:has(input[name="rattachement"][value="bien"]:checked) .field-rattachement-bien { display: block }` etc — fallback visibles permanents si CSS `:has` non supporté).
    - Champ `<input id="montantTtcCentimes" name="montantTtcCentimes" type="number" step="0.01" min="0" value="<%= valeurs.montantTtcCentimes || '' %>">` + label "Montant TTC (€)" (optionnel — placeholder "Optionnel").
    - Champ `<textarea id="notes" name="notes" maxlength="2000"><%= valeurs.notes || '' %></textarea>` + label "Notes" (optionnel).

    Implémenter `src/web/views/pages/justificatifs/detail.ejs` (UI-4.3 layout 1 colonne) :
    - Layout (navActive='coffre', breadcrumbs `[{label:'Coffre documentaire', href:'/coffre'}, {label: justificatif.titre}]`).
    - `<h1><%= justificatif.titre %></h1>`.
    - Section méta : `<dl>` avec dt/dd : Type (`formaterTypeJustificatif(j.type)`), Date document (`formatDate(j.dateDocument)`), Bien (lien `/biens/:id` ou "—"), Locataire (lien `/locataires/:id` ou "—"), Montant TTC (`formatMoney(j.montantTtc)` ou "—"), Taille fichier (`formaterTailleFichier(j.tailleOctets)`), Année fiscale (`formaterAnneeFiscale(j.anneeFiscale())`), Notes (texte ou "—").
    - Actions inline (UI-3.4 always-visible) :
      - `<a href="/justificatifs/<%= j.id %>/fichier" target="_blank" rel="noopener noreferrer">Télécharger<span class="sr-only">(s'ouvre dans un nouvel onglet)</span></a>` (D-117 + UI-6.3 a).
      - `<a href="/justificatifs/<%= j.id %>/modifier">Modifier</a>` (route implémentée en 04-02 — laisser le lien — 404 acceptable en wave 1).
      - Bouton "Mettre en corbeille" via include `partial-confirm-dialog` : message "Ce document sera déplacé vers la corbeille. Vous pourrez le restaurer depuis /coffre/corbeille." + confirm label "Mettre en corbeille" styled destructive + autofocus sur Annuler. Form action `/justificatifs/<%= j.id %>/corbeille` method POST.
    - Section preview pleine largeur : `<h2>Aperçu</h2>` + include `partial-justificatif-preview` avec `{ mimeType: j.mimeType, id: j.id, titre: j.titre }`.

    Implémenter `src/web/views/partials/partial-justificatif-preview.ejs` (D-117 + UI-6.3 a) :
    - Si `mimeType` ∈ ('image/jpeg', 'image/png') : `<img src="/justificatifs/<%= id %>/fichier" alt="<%= titre %>" style="max-width: 100%; height: auto;">`.
    - Sinon (application/pdf, image/webp) : `<a href="/justificatifs/<%= id %>/fichier" target="_blank" rel="noopener noreferrer">Ouvrir le fichier <span class="sr-only">(s'ouvre dans un nouvel onglet)</span></a>`.

    Implémenter `src/web/views/partials/partial-justificatif-row.ejs` (UI-3.1 7 colonnes + UI-3.4 always-visible) :
    - `<tr>` avec 7 `<td>` : `formatDate(j.dateDocument)`, `formaterTypeJustificatif(j.type)`, `<a href="/justificatifs/${j.id}"><%= j.titre %></a>`, bien (lien `/biens/:id` ou "—"), locataire (lien `/locataires/:id` ou "—"), montant (`formatMoney` ou "—"), actions.
    - `<td class="row-actions" style="color: var(--pico-muted-color); text-align: right;">` : `<a target="_blank" rel="noopener noreferrer">Télécharger</a>` + `<a href="/justificatifs/${j.id}">Voir</a>` + bouton "Mettre en corbeille" avec confirm-dialog inline. Min touch target 44x44.

    Mettre à jour `src/web/views/partials/sidebar-nav.ejs` (UI-2.1 + UI-2.2 + UI-2.3) :
    - Lire le contenu actuel. Identifier la position entre Baux et Encaissements.
    - Insérer `<li><a href="/coffre" <% if (navActive === 'coffre') { %>aria-current="page"<% } %>>Coffre documentaire</a></li>` entre l'entrée Baux et l'entrée Encaissements (entrée plate UI-2.3, pas de dropdown).
    - AUCUNE entrée racine "Travaux" (D-114 — accessible uniquement depuis fiche Bien — UI-2.1 confirmé).

    Créer les 3 helpers (PATTERNS §helpers) :
    - `src/helpers/format-type-justificatif.ts` : importer TypeJustificatif depuis `domain/documents/justificatif.ts`. Record `LABELS_TYPE_JUSTIFICATIF` avec les 9 labels FR (Facture, Ticket de caisse, Bail signé, État des lieux signé, Diagnostic (PDF), Attestation, Pièce locataire, Relevé bancaire, Autre). Export `formaterTypeJustificatif(type): string`.
    - `src/helpers/format-taille-fichier.ts` : `formaterTailleFichier(octets: number): string` → "X octets" si < 1024 ; "X,Y ko" si < 1024² ; "X,Y Mo" si < 1024³ ; "X,Y Go" sinon. Locale fr-FR (virgule décimale), 1 décimale.
    - `src/helpers/format-annee-fiscale.ts` : `formaterAnneeFiscale(annee: number): string` retourne `"Année fiscale ${annee}"`.

    Mettre à jour `src/main.ts` (Pattern 7 PATTERNS §Shared) :
    - `import multipart from '@fastify/multipart';` + register : `await app.register(multipart, { limits: { fileSize: 52428800, files: 1, fields: 20 } });` (D-105 + D-116).
    - Instancier `const stockageJustificatifs = new StockageJustificatifsLocal(/* baseDir from env or default */);`.
    - Instancier `const convertisseurImage = new ConvertisseurImageSharp();`.
    - Instancier `const justificatifRepo = new JustificatifRepositorySqlite(db);`.
    - `await app.register(pluginCoffre, { justificatifRepo, bienRepo, locataireRepo, stockage: stockageJustificatifs, convertisseurImage, clock, db });`.
    - Étendre le hook preHandler (lignes 135-150 du fichier existant — PATTERNS §Pattern 7) avec `formaterTypeJustificatif`, `formaterTailleFichier`, `formaterAnneeFiscale` dans `reply.locals` Object.assign — additif aux helpers Phase 1-3.

    Créer `tests/bdd/steps/coffre.steps.ts` (step definitions Cucumber) :
    - Given clock fige '2026-05-18' — instancie `ClockFige` (cf. tests existants).
    - Given application est prête — build app via `await buildApp(deps)` avec migrations 0001..0010 appliquées sur DB :memory: + dossier tmp pour stockage.
    - Given un Bien existe à l'adresse "X" — utilise `unBienValide` + `bienRepo.enregistrer`.
    - When le bailleur soumet POST /coffre/upload avec ... — `await app.inject({ method: 'POST', url: '/coffre/upload', payload: formData, headers: { 'content-type': 'multipart/form-data; boundary=...' } })`. Construction du body multipart via util ou form-data lib.
    - Then redirect URL — `expect(response.statusCode).toBe(302); expect(response.headers.location).toMatch(...)`.
    - Then page affiche "X" — re-inject GET sur la redirect URL + assertion sur body HTML.
    - Then table justificatifs contient N rows — `db.selectFrom('justificatifs').selectAll().execute()` + assertion length + champs.
    - Then aucun justificatif créé — assertion count = 0.

    Cleanup afterEach : supprimer le dossier tmp de stockage.
  </action>
  <verify>
    <automated>pnpm vitest run &amp;&amp; pnpm cucumber-js --tags @phase4 &amp;&amp; pnpm depcruise src --config .dependency-cruiser.js &amp;&amp; pnpm typecheck &amp;&amp; pnpm lint</automated>
  </verify>
  <done>
    7/7 scénarios `@phase4` Cucumber verts.
    `GET /coffre` rend empty state ou liste minimale (vérifié via app.inject + assertion HTML).
    `POST /coffre/upload` happy path : 302 → /justificatifs/:id + bannière "Document ajouté." + row insérée + fichier physique présent sous `documents/justificatifs/2026/{id}-{slug}.pdf`.
    Upload HEIC : fichier physique en `.jpg`, row mime=image/jpeg.
    Sidebar contient l'entrée "Coffre documentaire" active sur /coffre + /justificatifs/:id (assert HTML).
    `pnpm typecheck && pnpm lint && pnpm depcruise` exit 0.
    Couverture rapport `pnpm vitest run --coverage` ≥ 100 % sur `src/domain/documents/justificatif.ts` (logique métier impérative D-109 — SOFTWARE_CRAFTSMANSHIP §8).
    Suite unitaire complète en moins de 30 secondes (BDD §10).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → POST /coffre/upload | Fichier binaire untrusted + form text fields untrusted |
| client → GET /justificatifs/:id/fichier | chemin relatif lu depuis BD — risque path traversal côté FS |
| disk → @fastify/multipart | fichier disque (préfacture) → buffer mémoire |
| Buffer → sharp adapter | HEIC bytes potentiellement malformés |

## STRIDE Threat Register

| Threat ID | Cat | Component | Disposition | Mitigation Plan |
|-----------|-----|-----------|-------------|-----------------|
| T-04-01 | S | POST /coffre/upload (rattachement) | mitigate | Zod schema valide UUID FK ; uploaderJustificatif vérifie existence Bien/Locataire AVANT trx via bienRepo.trouverParId / locataireRepo.trouverParId |
| T-04-02 | T | POST /coffre/upload (MIME spoofing) | mitigate | `validerMagicBytes(buffer, mimeAnnonce)` croisé avec Content-Type ; magic gagne (D-118) ; rejet MimeMismatch HTTP 422 verbatim UI-6.2 |
| T-04-03 | D | POST /coffre/upload (taille fichier) | mitigate | `@fastify/multipart` `limits.fileSize=52428800` → HTTP 413 immédiat avant lecture complète. `limits.files=1`, `limits.fields=20` |
| T-04-04 | I | GET /justificatifs/:id/fichier (path traversal) | mitigate | `StockageJustificatifsLocal.lire` applique WR-03 : NUL byte check + path.resolve check baseDir prefix + realpath check (copié intégralement de Phase 2) |
| T-04-05 | I | GET /justificatifs/:id/fichier (corbeille leak) | mitigate | Route renvoie 410 si `j.corbeille_le !== null` — pas de leak fichier soft-deleted via URL directe |
| T-04-06 | E | upload renamed extension (.exe → .pdf) | mitigate | validerMagicBytes rejette format-non-accepte ; aucune exécution serveur du fichier uploadé (read-only sur disque, jamais require/import) |
| T-04-07 | R | soft-delete corbeille traçabilité | accept | V1 mono-user local-first — pas d'audit-log dédié. `corbeille_le` + `raison_corbeille` en BD suffisent (audit-friendly cohérent VISION.md) |
| T-04-08 | T | sharp parse HEIC corrompu | mitigate | Adapter ConvertisseurImageSharp try/catch sharp + propage erreur métier explicite ; aucun crash worker. sharp libvips est sandboxé (DoS borné par fileSize limit) |
| T-04-09 | I | Logs incluent buffer raw upload | mitigate | logger pino exclut le buffer dans uploaderJustificatif (log uniquement id, mimeFinal, tailleOctets — jamais bytes) |
</threat_model>

<verification>
- `pnpm vitest run` — 100 % vert (unit + integration).
- `pnpm cucumber-js --tags @phase4` — 7/7 scénarios verts.
- `pnpm typecheck` — exit 0.
- `pnpm lint` — exit 0, 0 warning (SOFTWARE_CRAFTSMANSHIP §8).
- `pnpm depcruise src --config .dependency-cruiser.js` — exit 0 (BC Documents/Travaux respectées).
- Migration appliquée sur DB :memory: sans erreur.
- `pnpm vitest run --coverage` — couverture ≥ 100 % sur `src/domain/documents/justificatif.ts`.
- Suite unitaire complète < 30 s, suite intégrale < 2 min (BDD §10).
- Smoke test manuel : démarrer `pnpm dev`, naviguer /coffre → upload PDF de 10 ko → voir fiche détail → vérifier fichier physique présent sous `~/.local/share/gestion-locative/documents/justificatifs/2026/`.
</verification>

<success_criteria>
- L'utilisateur peut uploader un fichier PDF/JPG/PNG/HEIC/WebP via `/coffre/upload` et le voir persisté en BD + sur disque.
- L'invariant ≥1 non-null bienId/locataireId est appliqué côté Zod (HTTP), côté `Justificatif.creer()` (domaine), ET côté SQL CHECK (DB) — défense en profondeur D-103.
- La validation magic-bytes croise avec MIME header ; magic gagne en cas de conflit (D-118).
- Les fichiers HEIC sont convertis serveur en JPEG avant persistance — jamais stockés en HEIC (D-105).
- Le port `StockageJustificatifs` est strictement dédié BC Documents (D-106 — pas d'extension de `StockageFichierLocal`).
- 7/7 scénarios BDD `@phase4` verts (`@doc-01` + `@doc-03`).
- 100 % couverture unit sur `src/domain/documents/justificatif.ts` (logique réglementaire impérative D-109).
- Sidebar contient une entrée racine "Coffre documentaire" entre Baux et Encaissements (UI-2.1).
- 0 warning ESLint, 0 erreur typecheck, 0 violation dependency-cruiser.
- Migration 0010 globale couvre les 3 tables Phase 4 (justificatifs + tickets_travaux + ticket_justificatifs) — pas de migration corrective en wave 2/3.
</success_criteria>

<output>
After completion, create `.planning/phases/04-coffre-documentaire-travaux/04-01-SUMMARY.md` selon le template `~/.claude/get-shit-done/templates/summary.md` avec :
- `affects` : `[BC Documents (création), BC Travaux (tables seedées), web routes, sidebar nav, migrations, helpers EJS]`
- `provides` : `[port StockageJustificatifs, port ConvertisseurImage, Justificatif aggregate, JustificatifRepository (sqlite), validerMagicBytes pure fn, route /coffre /coffre/upload /justificatifs/:id /justificatifs/:id/fichier /justificatifs/:id/corbeille, sidebar entry 'Coffre documentaire', helpers DP-25 (formaterTypeJustificatif, formaterTailleFichier, formaterAnneeFiscale), migration 0010 with 3 tables + indexes, raison_annulation column on tickets_travaux]`
- `patterns` : `[Pattern 5 use case orchestration with compensation, Pattern 3 soft-delete copy-on-write, WR-03 anti-path-traversal copied for BC Documents, Multipart upload with @fastify/multipart limits.fileSize, Pure function magic-bytes validation, BDD outside-in 7 scenarios]`
- `decisions` : `[D-102 (Justificatif aggregate root), D-103 (polymorphic 2-FK invariant 3-layer defense), D-104 (TypeJustificatif enum 9 values), D-105 (formats PDF/JPG/PNG/HEIC/WebP + 50MB + ConvertisseurImage port), D-106 (StockageJustificatifs dedicated port), D-107 (anneeFiscale derived from dateDocument.year), D-108 (Justificatif fields), D-109 (peutEtrePurge gate 10y + soft-delete), D-115 (no nature field on tickets_travaux), D-116 (native file input), D-117 (anchor target=_blank or inline img), D-118 (magic-bytes wins), D-119 (1 empty state — coffre vide), UI-1.1 thru UI-1.3 regression-checked, UI-2.1 (sidebar entry between Baux and Encaissements), UI-3.4 (row actions always-visible regression-checked), UI-4.1 (upload form order), UI-4.2 (fieldset rattachement), UI-4.3 (single column fiche), UI-6.1/UI-6.2/UI-6.3 verbatim]`
- `commits` : list of commits produced.
- `tests_added` : `[unit/documents/justificatif.test.ts, unit/documents/valider-magic-bytes.test.ts, integration/repositories/justificatif-repository-sqlite.test.ts, integration/storage/stockage-justificatifs-local.test.ts, integration/image/convertisseur-image-sharp.test.ts, bdd/features/coffre.feature 7 scenarios]`
</output>

---
phase: 04-coffre-documentaire-travaux
plan: 03
plan_id: 04-03
type: execute
wave: 3
status: planned
created: 2026-05-18
depends_on: ["04-01", "04-02"]
files_modified:
  # Domain BC Travaux
  - src/domain/travaux/ticket-travaux.ts
  - src/domain/travaux/ticket-travaux-repository.ts
  - src/domain/travaux/erreurs.ts
  # Application
  - src/application/travaux/creer-ticket-travaux.ts
  - src/application/travaux/lister-tickets-par-bien.ts
  - src/application/travaux/lire-ticket.ts
  - src/application/travaux/clore-ticket-travaux.ts
  - src/application/travaux/annuler-ticket-travaux.ts
  - src/application/travaux/ajouter-pj-ticket.ts
  - src/application/travaux/delier-pj-ticket.ts
  # Infrastructure
  - src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts
  # Web
  - src/web/routes/travaux.ts
  - src/web/schemas/ticket-travaux-schemas.ts
  - src/web/views/pages/travaux/liste.ejs
  - src/web/views/pages/travaux/nouveau.ejs
  - src/web/views/pages/travaux/detail.ejs
  - src/web/views/partials/partial-badge-statut-ticket.ejs
  - src/web/views/partials/partial-ticket-row.ejs
  - src/web/views/partials/partial-ticket-pj-section.ejs
  - src/web/views/pages/biens/detail.ejs
  - src/web/routes/biens.ts
  - src/main.ts
  # Documentation (CLAUDE.md non-negotiable — docs in same commit as code change)
  - README.md
  # Helpers
  - src/helpers/format-statut-ticket.ts
  # Tests
  - tests/bdd/features/travaux.feature
  - tests/bdd/steps/travaux.steps.ts
  - tests/_builders/travaux.ts
  - tests/unit/travaux/ticket-travaux.test.ts
  - tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts
autonomous: true
requirements: [INC-01]
user_setup: []
tags: [phase-4, travaux, tickets, BC-travaux, n-to-n, pieces-jointes, fiche-bien]

must_haves:
  truths:
    - "L'utilisateur peut créer un TicketTravaux rattaché à un Bien (titre, description, dateOuverture, coutEstimeTtc?, notes?) via POST /biens/:id/travaux → redirect /travaux/:id (D-114)"
    - "L'utilisateur peut ajouter une pièce jointe au ticket via le panneau PJ sur /travaux/:id — soit upload nouveau Justificatif (lié au bienId du ticket), soit attach un Justificatif existant cohérent en bienId (D-113)"
    - "L'utilisateur peut clore un ticket via POST /travaux/:id/clore avec dateCloture + coutReelTtc → statut devient 'clos' + bannière 'Ticket clôturé.' (D-114)"
    - "L'utilisateur peut annuler un ticket via POST /travaux/:id/annuler → annule_le rempli + statut 'annule'"
    - "Sur la fiche Bien (GET /biens/:id), une section 'Travaux' affiche les tickets ouverts/en_cours + lien 'Voir tous les tickets (N)' → /biens/:id/travaux + CTA 'Nouveau ticket' (UI-5.4)"
    - "Badge statut ticket coloré (UI-1.4) avec aria-label='Statut : {label}' — 4 variantes (ouvert/en_cours/clos/annule)"
    - "Empty state tickets vides (D-119 verbatim) : 'Aucun ticket pour ce Bien' + 'Le premier ticket sert souvent à tracer la mise en service du logement.' + CTA 'Nouveau ticket'"
    - "Aucun champ `nature` sur tickets_travaux (D-115 strictement honoré — qualification fiscale différée Phase 5 BC Fiscalité)"
    - "Cascade asymétrique D-113 : DELETE ticket → DELETE rows ticket_justificatifs MAIS Justificatifs liés restent (rétention 10 ans D-109 prime)"
    - "Workflow clore : refuse si coutReelTtc absent (TransitionInvalide + verbatim UI-6.2 'Le coût réel TTC est obligatoire pour clore le ticket.')"
    - "Transitions statut manuelles : ouvert/en_cours → clos OK ; clos → clos throw ; annule → clos throw (D-114 pas d'auto-transition)"
    - "README.md créé/mis à jour avec sections Features + Routes documentant les 11 nouvelles routes Phase 4 (/coffre, /coffre/upload, /coffre/corbeille, /justificatifs/:id, /justificatifs/:id/fichier, /justificatifs/:id/modifier, /justificatifs/:id/corbeille, /justificatifs/:id/restaurer, /justificatifs/:id/purger, /biens/:id/travaux, /travaux/nouveau, /travaux/:id, /travaux/:id/clore, /travaux/:id/annuler, /travaux/:id/justificatifs, /travaux/:id/justificatifs/:jid/delier) + 2 nouveaux BCs (Documents + Travaux) + rétention 10 ans D-109 — règle non-négociable CLAUDE.md docs-in-same-commit-as-code respectée à la fin du wave 3" 
  artifacts:
    - path: "src/domain/travaux/ticket-travaux.ts"
      provides: "Agrégat racine TicketTravaux (D-112)"
      contains: "class TicketTravaux"
      min_lines: 70
    - path: "src/domain/travaux/ticket-travaux-repository.ts"
      provides: "Port repo + méthodes N:N (lierJustificatif, delierJustificatif, listerJustificatifsLies)"
      contains: "lierJustificatif"
    - path: "src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts"
      provides: "Adapter Kysely + N:N pivot ticket_justificatifs (D-113 cascade asymétrique)"
      contains: "ticket_justificatifs"
    - path: "src/web/routes/travaux.ts"
      provides: "Plugin Fastify routes travaux (contextuelles /biens/:id/travaux + standalone /travaux/:id)"
      exports: ["plugin"]
    - path: "src/web/views/partials/partial-badge-statut-ticket.ejs"
      provides: "Badge statut 4 variantes (UI-1.4 clone partial-badge-dpe)"
      contains: "Statut :"
    - path: "src/web/views/pages/travaux/detail.ejs"
      provides: "Fiche 3 sections (UI-5.3 — Méta / Pièces jointes / Clôture inline)"
      contains: "Pièces jointes"
    - path: "src/web/views/pages/biens/detail.ejs"
      provides: "Section 'Travaux' augmentée (UI-5.4 — ajoutée APRÈS section Documents de 04-02)"
      contains: "Voir tous les tickets"
    - path: "src/web/views/partials/partial-ticket-pj-section.ejs"
      provides: "Panneau Pièces jointes avec upload inline + lien attach existant (UI-5.3)"
    - path: "src/application/travaux/ajouter-pj-ticket.ts"
      provides: "Use case dual-mode (upload nouveau ou attach existant) avec cohérence bienId"
    - path: "README.md"
      provides: "Documentation projet — sections Features + Routes mises à jour à la fin de Phase 4 (règle non-négociable CLAUDE.md Documentation hygiene)"
      contains: "Coffre documentaire" 
  key_links:
    - from: "src/web/routes/travaux.ts"
      to: "src/application/travaux/ajouter-pj-ticket.ts"
      via: "POST /travaux/:id/justificatifs handler"
      pattern: "ajouterPJTicket"
    - from: "src/application/travaux/ajouter-pj-ticket.ts"
      to: "src/application/documents/uploader-justificatif.ts"
      via: "réutilisation upload pour nouveau Justificatif lié bienId du ticket"
      pattern: "uploaderJustificatif"
    - from: "src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts"
      to: "ticket_justificatifs"
      via: "méthodes lierJustificatif/delierJustificatif/listerJustificatifsLies"
      pattern: "ticket_justificatifs"
    - from: "src/web/views/pages/biens/detail.ejs"
      to: "GET /biens/:id/travaux"
      via: "lien 'Voir tous les tickets (N)'"
      pattern: "/biens/.*/travaux"
    - from: "src/web/views/pages/travaux/detail.ejs"
      to: "src/web/views/partials/partial-ticket-pj-section.ejs"
      via: "include partial section Pièces jointes"
      pattern: "partial-ticket-pj-section"
---

<objective>
Implémente le BC Travaux complet (INC-01) — agrégat `TicketTravaux`, repository Kysely avec **pivot N:N `ticket_justificatifs`** (D-113 cascade asymétrique), workflow CRUD complet (création, clôture, annulation), gestion des pièces jointes en dual-mode (upload nouveau ou attach existant), et augmentation de la fiche Bien avec une section "Travaux" (UI-5.4).

**Purpose:** Permettre au bailleur de tracer chaque incident/travaux sur un Bien (remplacement chauffe-eau, peinture, fuite) avec coût estimé puis coût réel à la clôture, et d'attacher devis/factures comme pièces jointes — réutilisant l'infrastructure justificatifs livrée en wave 1 (uploaderJustificatif, magic-bytes, conversion HEIC, anti-path-traversal). Phase 4 = stocker + indexer + retrouver. La **qualification fiscale** (réparation/entretien/amélioration) arrivera Phase 5 dans un BC `Fiscalité` séparé sans toucher à `tickets_travaux` (D-115 strictement honoré : aucun champ `nature` introduit).

**Output:**
- BC Travaux complet (agrégat TicketTravaux, repo SQLite, 7 use cases).
- Pivot N:N `ticket_justificatifs` opérationnel avec cascade asymétrique D-113 testée.
- 7 routes Fastify (`GET /biens/:id/travaux`, `GET /travaux/nouveau`, `POST /biens/:id/travaux`, `GET /travaux/:id`, `POST /travaux/:id/clore`, `POST /travaux/:id/annuler`, `POST /travaux/:id/justificatifs`, `POST /travaux/:id/justificatifs/:jid/delier`).
- 3 EJS pages + 3 partials.
- 1 helper (formaterStatutTicket).
- Section "Travaux" sur fiche Bien (UI-5.4).
- 12 scénarios BDD `@phase4 @inc-01` verts.
- 100 % couverture domain TicketTravaux + use cases (logique workflow).
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
@.planning/phases/04-coffre-documentaire-travaux/04-01-SUMMARY.md
@.planning/phases/04-coffre-documentaire-travaux/04-02-SUMMARY.md
@practices/BDD_PRACTICES.md
@practices/DDD.md
@practices/SOFTWARE_CRAFTSMANSHIP.md

# Source analogs canoniques (PATTERNS.md)
@src/domain/encaissements/encaissement.ts
@src/domain/encaissements/encaissement-repository.ts
@src/domain/locatif/etat-des-lieux.ts
@src/domain/_shared/identifiants.ts
@src/domain/_shared/erreurs.ts
@src/domain/_shared/money.ts
@src/infrastructure/repositories/encaissement-repository-sqlite.ts
@src/web/routes/etats-des-lieux.ts
@src/web/routes/diagnostics.ts
@src/web/schemas/encaissement-schemas.ts
@src/web/views/pages/biens/detail.ejs
@src/web/views/partials/partial-badge-dpe.ejs
@src/web/views/partials/partial-diagnostic-row.ejs
@src/web/views/partials/empty-state.ejs
@src/web/views/partials/confirm-dialog.ejs
@src/web/views/partials/data-table.ejs
@src/helpers/format-statut-diagnostic.ts

# Artefacts produits en 04-01 (réutilisés ici)
@src/domain/_shared/identifiants.ts
@src/domain/documents/justificatif.ts
@src/domain/documents/justificatif-repository.ts
@src/application/documents/uploader-justificatif.ts
@migrations/0010_phase4_documents_travaux.sql
@src/main.ts

<interfaces>
<!-- Contracts livrés par CE plan -->

src/domain/travaux/ticket-travaux.ts :
```typescript
export type StatutTicket = 'ouvert' | 'en_cours' | 'clos' | 'annule';
export const STATUTS_TICKET_VALIDES: StatutTicket[] =
  ['ouvert', 'en_cours', 'clos', 'annule'];

export interface TicketTravauxProps {
  id?: TicketTravauxId;
  bienId: BienId;
  titre: string;
  description: string;
  dateOuverture: Temporal.PlainDate;
  dateCloture: Temporal.PlainDate | null;
  statut: StatutTicket;
  coutEstimeTtc: Money | null;
  coutReelTtc: Money | null;
  notes: string | null;
  creeLe: Temporal.PlainDate;
  annuleLe: Temporal.PlainDate | null;
  raisonAnnulation: string | null;
}

export class TicketTravaux {
  readonly id: TicketTravauxId;
  // ... tous les champs readonly
  static creer(props: TicketTravauxProps): TicketTravaux;
  clore(coutReelTtc: Money, dateCloture: Temporal.PlainDate): TicketTravaux;
  annuler(raison: string, annuleLe: Temporal.PlainDate): TicketTravaux;
  toProps(): TicketTravauxProps;
}
```

src/domain/travaux/ticket-travaux-repository.ts :
```typescript
export interface TicketTravauxRepository {
  enregistrer(ticket: TicketTravaux, trx?: unknown): Promise<void>;
  trouverParId(id: TicketTravauxId | string): Promise<TicketTravaux | null>;
  listerParBien(
    bienId: BienId | string,
    opts?: { inclureAnnules?: boolean; statuts?: StatutTicket[] },
  ): Promise<TicketTravaux[]>;
  // N:N pivot D-113
  lierJustificatif(
    ticketId: TicketTravauxId,
    justificatifId: JustificatifId,
    trx?: unknown,
  ): Promise<void>;
  delierJustificatif(
    ticketId: TicketTravauxId,
    justificatifId: JustificatifId,
    trx?: unknown,
  ): Promise<void>;
  listerJustificatifsLies(
    ticketId: TicketTravauxId,
  ): Promise<JustificatifId[]>;
}
```

src/domain/travaux/erreurs.ts :
```typescript
export class TicketIntrouvable extends Error { constructor(public id: string); }
export class TransitionInvalide extends Error {}
export class CoutReelManquantPourClore extends Error {}
export class TicketDejaAnnule extends Error {}
export class PJIncoherenteBien extends Error {}
```

src/application/travaux/ajouter-pj-ticket.ts :
```typescript
export interface AjouterPJCommande {
  ticketId: TicketTravauxId | string;
  // Mode 1 — upload nouveau Justificatif (réutilise pipeline 04-01)
  fichier?: {
    buffer: Buffer;
    nomOriginal: string;
    mimeAnnonce: string;
    titre: string;
    type: TypeJustificatif;
    dateDocument: Temporal.PlainDate;
    montantTtc?: Money | null;
    notes?: string | null;
  };
  // Mode 2 — attach Justificatif existant
  justificatifId?: JustificatifId | string;
}

export function ajouterPJTicket(
  cmd: AjouterPJCommande,
  deps: {
    ticketRepo: TicketTravauxRepository;
    justificatifRepo: JustificatifRepository;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
    stockage: StockageJustificatifs;
    convertisseurImage: ConvertisseurImage;
    clock: Clock;
    db: Kysely<DB>;
  },
): Promise<{ justificatifId: JustificatifId }>;
// Throws :
//  - TicketIntrouvable si ticket inexistant
//  - InvariantViolated si ni fichier ni justificatifId fourni
//  - PJIncoherenteBien si justificatifId fourni mais Justificatif.bienId !== ticket.bienId
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 — RED: BDD @inc-01 + tests unit/integration + builders Travaux</name>
  <files>
    tests/bdd/features/travaux.feature,
    tests/bdd/steps/travaux.steps.ts,
    tests/_builders/travaux.ts,
    tests/unit/travaux/ticket-travaux.test.ts,
    tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts,
    src/domain/travaux/ticket-travaux.ts (stub),
    src/domain/travaux/ticket-travaux-repository.ts (interface),
    src/domain/travaux/erreurs.ts (new)
  </files>
  <behavior>
    Cucumber `travaux.feature` (tag header `@phase4 @inc-01`) — 12 scénarios :

    1. Créer ticket happy path — POST /biens/:id/travaux avec titre/description/dateOuverture (2026-05-18)/coutEstime (1200€) → 302 redirect /travaux/:newId + bannière "Ticket créé." + row tickets_travaux statut='ouvert', cout_estime_ttc_centimes=120000.
    2. Refus création si titre vide — POST avec titre="" → 200 re-render formulaire + verbatim "Le titre du ticket est obligatoire." + aria-invalid sur champ titre + 0 row créée.
    3. Refus création si description vide — verbatim "La description est obligatoire."
    4. Refus création si dateOuverture future — POST dateOuverture=2026-12-31 (today=2026-05-18) → verbatim "La date d'ouverture ne peut pas être dans le futur."
    5. Refus création si bienId inexistant — POST sur /biens/{uuid-inconnu}/travaux → 404 "Bien introuvable."
    6. Ajouter PJ via upload nouveau Justificatif — POST /travaux/:id/justificatifs avec multipart file (PDF 5ko) + titre/type/dateDocument → bannière "Pièce jointe ajoutée au ticket." + row ticket_justificatifs créée + row justificatifs créée avec bienId = ticket.bienId.
    7. Ajouter PJ via attach Justificatif existant — créer Justificatif rattaché au même Bien, POST /travaux/:id/justificatifs avec query `?justificatifId=:jid` (sans file) → row ticket_justificatifs créée (idempotent via onConflict.doNothing).
    8. Refus attach PJ si Justificatif rattaché à autre Bien — créer Justificatif sur Bien B1, ticket sur Bien B2, POST attach → verbatim "Pièce jointe doit être rattachée au même bien que le ticket." + 0 nouvelle row dans ticket_justificatifs.
    9. Délier PJ — POST /travaux/:id/justificatifs/:jid/delier → bannière "Pièce jointe retirée du ticket." + row ticket_justificatifs supprimée MAIS row justificatifs reste (rétention 10 ans D-113 cascade asymétrique).
    10. Clôture happy path — POST /travaux/:id/clore avec dateCloture=2026-06-01 + coutReelTtcCentimes=125000 → bannière "Ticket clôturé." + row statut='clos', date_cloture, cout_reel_ttc_centimes.
    11. Refus clôture sans coût réel — POST /travaux/:id/clore avec dateCloture seul → verbatim "Le coût réel TTC est obligatoire pour clore le ticket." + statut inchangé.
    12. Annuler ticket — POST /travaux/:id/annuler avec raison="Plus pertinent" → bannière "Ticket annulé." + row annule_le rempli + raison_annulation rempli + statut='annule'.
    13. Cascade asymétrique D-113 — créer ticket avec 2 PJ liées, DELETE FROM tickets_travaux WHERE id=:id (via SQL direct dans le test integration) → vérifier 0 rows ticket_justificatifs pour ce ticket MAIS 2 rows justificatifs conservées (rétention 10 ans).
    14. Section Travaux fiche Bien (UI-5.4) — créer Bien + 3 tickets (1 ouvert, 1 en_cours, 1 clos) → GET /biens/:id → section "Travaux" affiche les 2 tickets ouverts/en_cours + lien "/biens/:id/travaux" + lien "Voir tous les tickets (3)" + CTA "Nouveau ticket".
    15. Empty state tickets vides — créer Bien sans ticket → GET /biens/:id → section "Travaux" affiche empty state D-119 verbatim "Aucun ticket pour ce Bien" + body "Le premier ticket sert souvent à tracer la mise en service du logement." + CTA "Nouveau ticket".

    **Unit `tests/unit/travaux/ticket-travaux.test.ts`** :
    - creer() invariants : titre vide → InvariantViolated "Le titre du ticket est obligatoire." ; description vide → "La description est obligatoire." ; dateOuverture future → "La date d'ouverture ne peut pas être dans le futur." ; bienId absent (en TS strict, le type empêche déjà — tester côté Zod uniquement) ; statut inconnu → InvariantViolated avec liste statuts valides ; statut par défaut = 'ouvert' si props.statut omis.
    - clore(coutReelTtc, dateCloture) :
      - depuis 'ouvert' → instance statut='clos' + dateCloture + coutReelTtc.
      - depuis 'en_cours' → idem clos.
      - depuis 'clos' → throw TransitionInvalide "Ticket déjà clos."
      - depuis 'annule' → throw TransitionInvalide "Ticket annulé — impossible de clore."
      - dateCloture < dateOuverture → throw InvariantViolated "La date de clôture ne peut pas précéder la date d'ouverture."
    - annuler(raison, annuleLe) :
      - depuis n'importe quel statut sauf 'annule' → nouvelle instance statut='annule' + annuleLe + raisonAnnulation=raison.
      - depuis 'annule' → throw TicketDejaAnnule.

    **Integration `ticket-travaux-repository-sqlite.test.ts`** :
    - enregistrer + trouverParId roundtrip (Money centimes, PlainDate, statut enum, raison_annulation).
    - upsert via onConflict('id') change statut/date_cloture/cout_reel/annule_le/raison_annulation sans dupliquer.
    - listerParBien(bienId) par défaut exclut annule_le ≠ null ; avec `inclureAnnules=true` retourne tout.
    - listerParBien filtrer par statuts (ex: `{statuts: ['ouvert', 'en_cours']}` pour la section fiche Bien).
    - lierJustificatif insert dans pivot (deuxième appel sur même paire → onConflict.doNothing — idempotent).
    - delierJustificatif DELETE row pivot.
    - listerJustificatifsLies retourne JustificatifId[] triés par date_document DESC.
    - Cascade asymétrique D-113 : `DELETE FROM tickets_travaux WHERE id=:id` → 0 rows pivot pour ce ticket (CASCADE) ; rows justificatifs intactes (pas de CASCADE sur justificatif_id).

    **Builders `tests/_builders/travaux.ts`** :
    - `unTicketTravauxValide(overrides)` defaults (statut='ouvert', dateOuverture=2026-05-01, titre='Remplacement chauffe-eau', description='...', coutEstime=Money.fromEuros(1200), coutReel=null, creeLe=2026-05-01).
    - `unTicketTravauxEnCours(overrides)` : statut='en_cours'.
    - `unTicketTravauxClos(overrides)` : statut='clos', dateCloture=2026-06-01, coutReel=Money.fromEuros(1250).
    - `unTicketTravauxAnnule(overrides)` : statut='annule', annuleLe=2026-05-10, raisonAnnulation='Hors budget'.
  </behavior>
  <action>
    Créer `src/domain/travaux/erreurs.ts` avec les classes : TicketIntrouvable (porte id), TransitionInvalide, CoutReelManquantPourClore, TicketDejaAnnule, PJIncoherenteBien.

    Créer des stubs minimaux compilables :
    - `src/domain/travaux/ticket-travaux.ts` : class avec exports types (StatutTicket, STATUTS_TICKET_VALIDES, TicketTravauxProps) + class TicketTravaux exposant creer/clore/annuler/toProps qui throw "Not implemented".
    - `src/domain/travaux/ticket-travaux-repository.ts` : interface TicketTravauxRepository complète.

    Créer `tests/_builders/travaux.ts` selon analog `tests/_builders/encaissements.ts` (PATTERNS §builders).

    Écrire `tests/bdd/features/travaux.feature` avec les 15 scénarios listés (numérotés 1-15 ci-dessus — Background fixe clock 2026-05-18 + Bien créé). Tags `@phase4 @inc-01`.

    Créer `tests/bdd/steps/travaux.steps.ts` avec step definitions Cucumber (analog coffre.steps.ts livré en 04-01) :
    - Given clock + app + Bien créé.
    - When le bailleur soumet POST /biens/:id/travaux (avec form data) — `await app.inject({ method: 'POST', url: '/biens/${bien.id}/travaux', payload: {...} })`.
    - When le bailleur soumet POST /travaux/:id/justificatifs avec multipart — construction body multipart via form-data lib.
    - When le bailleur soumet POST /travaux/:id/justificatifs?justificatifId=:jid — query string sans body.
    - When le bailleur soumet POST /travaux/:id/clore avec dateCloture+coutReel.
    - When le bailleur soumet POST /travaux/:id/annuler avec raison.
    - Then redirect URL.
    - Then row tickets_travaux contient N lignes avec statut=X.
    - Then row ticket_justificatifs contient N lignes pour ticket=:id.
    - Then row justificatifs reste à N (cascade asymétrique).
    - Then la page affiche "X" / "section Travaux affiche N tickets" (inject GET fiche Bien + assertion HTML).
    - Then le bouton "Nouveau ticket" pointe vers /travaux/nouveau?bienId=:id.

    Écrire `tests/unit/travaux/ticket-travaux.test.ts` avec toutes les assertions listées en behavior (factory invariants + clore transitions 4 cas + annuler 2 cas + InvariantViolated dateCloture < dateOuverture).

    Écrire `tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts` avec :
    - enregistrer/trouverParId roundtrip complet (Money roundtrip, PlainDate roundtrip, raison_annulation null/non-null).
    - upsert via onConflict id.
    - listerParBien filtres (default exclut annulés, inclureAnnules=true, statuts: array filter).
    - lierJustificatif idempotent (2 appels même paire → 1 row).
    - delierJustificatif.
    - listerJustificatifsLies ORDER BY date_document DESC.
    - Cascade asymétrique D-113 (DELETE tickets_travaux → pivot supprimé, justificatifs intacts).

    Vérifier que tous les tests Task 1 échouent en RED (stubs throw Not implemented).
  </action>
  <verify>
    <automated>pnpm cucumber-js --tags @inc-01 --dry-run | grep -E "Scenario:" | wc -l | grep -qE "^(1[5-9]|2[0-9])$" &amp;&amp; pnpm typecheck &amp;&amp; (pnpm vitest run tests/unit/travaux tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts 2>&amp;1 | grep -E "(FAIL|failed)" | grep -v "0 failed")</automated>
  </verify>
  <done>
    Cucumber dry-run liste 15 scénarios `@inc-01`.
    Tests unit + integration RED (compile + assertion failures, pas erreurs d'import).
    Builders compilent.
    Stubs `src/domain/travaux/ticket-travaux.ts` + repo interface exportent les types attendus.
    `pnpm typecheck && pnpm lint` exit 0.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 — GREEN: domain TicketTravaux + 7 use cases + repository Kysely + pivot N:N</name>
  <files>
    src/domain/travaux/ticket-travaux.ts,
    src/domain/travaux/ticket-travaux-repository.ts,
    src/application/travaux/creer-ticket-travaux.ts,
    src/application/travaux/lister-tickets-par-bien.ts,
    src/application/travaux/lire-ticket.ts,
    src/application/travaux/clore-ticket-travaux.ts,
    src/application/travaux/annuler-ticket-travaux.ts,
    src/application/travaux/ajouter-pj-ticket.ts,
    src/application/travaux/delier-pj-ticket.ts,
    src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts
  </files>
  <behavior>
    Tous les tests unit + integration de Task 1 doivent passer GREEN.

    Précisions complémentaires testables :
    - `TicketTravaux.creer` n'accepte JAMAIS de champ `nature` — la signature TS ne l'expose pas (D-115 enforcement strict via type).
    - `ajouter-pj-ticket.ts` mode upload : appelle `uploaderJustificatif` avec `bienId = ticket.bienId` automatiquement (cohérence cross-aggregate).
    - `ajouter-pj-ticket.ts` mode attach : vérifie `justificatif.bienId === ticket.bienId` sinon throw PJIncoherenteBien avec verbatim "Pièce jointe doit être rattachée au même bien que le ticket." (UI-6.2 nouveau verbatim cohérent ton factuel).
    - `clore-ticket-travaux.ts` propage les erreurs domaine TransitionInvalide / CoutReelManquantPourClore (la dernière n'arrive jamais ici car Zod aura déjà bloqué le coutReel undefined — mais double check côté domaine si appel direct sans Zod).
  </behavior>
  <action>
    Implémenter `src/domain/travaux/ticket-travaux.ts` selon PATTERNS §ticket-travaux.ts :
    - Class avec props readonly (cf. interfaces) — **AUCUN champ `nature`** (D-115 enforcement type system).
    - Constructor privé.
    - Factory `static creer(props)` :
      - Si `props.titre.trim().length === 0` → throw InvariantViolated('Le titre du ticket est obligatoire.').
      - Si `props.description.trim().length === 0` → throw InvariantViolated('La description est obligatoire.').
      - Si `props.dateOuverture > today` (today injecté via Clock pour testabilité — alternative : compare à `Temporal.Now.plainDateISO()` dans le domaine si on accepte le compromis non-déterministe pour cet invariant simple ; choisir Clock injecté pour cohérence Pattern Phase 1 — recevoir today comme paramètre optionnel `props.today?: Temporal.PlainDate` ou ajouter méthode static `creer(props, today)`) → throw InvariantViolated('La date d'ouverture ne peut pas être dans le futur.').
        Décision planner : passer today comme paramètre explicite de creer pour testabilité — signature `static creer(props: TicketTravauxProps, today: Temporal.PlainDate): TicketTravaux`.
      - Si `props.statut` fourni et ∉ STATUTS_TICKET_VALIDES → throw InvariantViolated.
      - Default `statut = props.statut ?? 'ouvert'`.
      - id default `nouveauTicketTravauxId()`.
    - `clore(coutReelTtc, dateCloture, today)` (today pour invariant) :
      - Si statut === 'clos' → throw TransitionInvalide('Ticket déjà clos.').
      - Si statut === 'annule' → throw TransitionInvalide('Ticket annulé — impossible de clore.').
      - Si dateCloture < this.dateOuverture → throw InvariantViolated('La date de clôture ne peut pas précéder la date d'ouverture.').
      - Retourne TicketTravaux.creer({ ...this.toProps(), statut: 'clos', dateCloture, coutReelTtc }, today).
    - `annuler(raison, annuleLe, today)` :
      - Si this.annuleLe !== null → throw TicketDejaAnnule.
      - Retourne TicketTravaux.creer({ ...this.toProps(), statut: 'annule', annuleLe, raisonAnnulation: raison }, today).
    - `toProps()` privé exposé pour copy-on-write.

    Implémenter `src/domain/travaux/ticket-travaux-repository.ts` : interface complète (cf. interfaces) — 6 méthodes (enregistrer, trouverParId, listerParBien avec opts, lierJustificatif, delierJustificatif, listerJustificatifsLies).

    Implémenter `src/application/travaux/creer-ticket-travaux.ts` :
    - Signature `creerTicketTravaux({ bienId, titre, description, dateOuverture, coutEstimeTtc?, notes? }, { ticketRepo, bienRepo, clock })`.
    - Lookup `bienRepo.trouverParId(bienId)` → throw "Bien introuvable." (Error class générique BienIntrouvable du BC Patrimoine si exposée, sinon Error simple).
    - `TicketTravaux.creer({ bienId, titre, description, dateOuverture, dateCloture: null, statut: 'ouvert', coutEstimeTtc: coutEstimeTtc ?? null, coutReelTtc: null, notes: notes ?? null, creeLe: clock.aujourdhui(), annuleLe: null, raisonAnnulation: null }, clock.aujourdhui())`.
    - `repo.enregistrer(ticket)` upsert.
    - Retourne `{ ticketId }`.

    Implémenter `src/application/travaux/lister-tickets-par-bien.ts` :
    - Signature `listerTicketsParBien({ bienId, statuts?, inclureAnnules? }, { ticketRepo })`.
    - Délègue à `ticketRepo.listerParBien(bienId, { statuts, inclureAnnules })`.

    Implémenter `src/application/travaux/lire-ticket.ts` :
    - Lookup (throw TicketIntrouvable si null).
    - Récupère `justificatifIds = await ticketRepo.listerJustificatifsLies(id)`.
    - Pour chaque justificatifId : `await justificatifRepo.trouverParId(jid)` → assemble liste Justificatif[].
    - Récupère `bien = bienRepo.trouverParId(ticket.bienId)`.
    - Retourne `{ ticket, bien, justificatifs }`.

    Implémenter `src/application/travaux/clore-ticket-travaux.ts` :
    - Lookup (throw TicketIntrouvable).
    - `.clore(coutReelTtc, dateCloture, clock.aujourdhui())` (propage TransitionInvalide / InvariantViolated).
    - `repo.enregistrer` upsert.
    - Retourne `{ ticket: closure }`.

    Implémenter `src/application/travaux/annuler-ticket-travaux.ts` :
    - Lookup, `.annuler(raison, clock.aujourdhui(), clock.aujourdhui())`, upsert.

    Implémenter `src/application/travaux/ajouter-pj-ticket.ts` (Pattern 5 cross-aggregate use case PATTERNS §Shared) :
    - Lookup ticket (throw TicketIntrouvable).
    - Si ni `fichier` ni `justificatifId` fournis → throw InvariantViolated('Fournir un fichier OU un justificatifId existant.').
    - Si `fichier` fourni :
      - Construire commande pour uploaderJustificatif : `{ titre: fichier.titre, type: fichier.type, dateDocument: fichier.dateDocument, bienId: ticket.bienId, locataireId: null, notes: fichier.notes, montantTtc: fichier.montantTtc, fichier: { buffer: fichier.buffer, nomOriginal: fichier.nomOriginal, mimeAnnonce: fichier.mimeAnnonce } }`.
      - Appel `const { justificatifId: newJid } = await uploaderJustificatif(commande, deps)`.
      - `await ticketRepo.lierJustificatif(ticket.id, newJid)`.
      - Retourne `{ justificatifId: newJid }`.
    - Sinon (`justificatifId` fourni) :
      - Lookup `justificatif = justificatifRepo.trouverParId(justificatifId)` → throw JustificatifIntrouvable.
      - Vérifier `justificatif.bienId === ticket.bienId` (cast string comparaison via String() pour brand types).
      - Si non égal → throw PJIncoherenteBien('Pièce jointe doit être rattachée au même bien que le ticket.').
      - `await ticketRepo.lierJustificatif(ticket.id, justificatif.id)` (idempotent — onConflict.doNothing côté repo).
      - Retourne `{ justificatifId: justificatif.id }`.

    Implémenter `src/application/travaux/delier-pj-ticket.ts` :
    - Lookup ticket (throw TicketIntrouvable).
    - `await ticketRepo.delierJustificatif(ticketId, justificatifId)`.
    - Note importante : la row dans `justificatifs` reste intacte (D-113 cascade asymétrique — rétention 10 ans).

    Implémenter `src/infrastructure/repositories/ticket-travaux-repository-sqlite.ts` (Pattern 4 PATTERNS §Shared, analog encaissement-repository-sqlite + extensions N:N) :
    - Types Row, DbOrTrx.
    - `enregistrer(ticket, trx?)` : INSERT avec onConflict('id').doUpdateSet sur statut, date_cloture, cout_estime_ttc_centimes, cout_reel_ttc_centimes, notes, annule_le, raison_annulation. Immuables : bien_id, titre, description, date_ouverture, cree_le.
    - `trouverParId(id)`.
    - `listerParBien(bienId, opts)` : Kysely conditional where. Default `where('annule_le', 'is', null)` sauf si `inclureAnnules=true`. Si `statuts` fourni : `.where('statut', 'in', statuts)`. ORDER BY date_ouverture DESC.
    - `lierJustificatif(ticketId, justificatifId, trx?)` : INSERT INTO ticket_justificatifs (ticket_id, justificatif_id) VALUES (?, ?) ON CONFLICT(ticket_id, justificatif_id) DO NOTHING.
    - `delierJustificatif(ticketId, justificatifId, trx?)` : DELETE FROM ticket_justificatifs WHERE ticket_id=? AND justificatif_id=?.
    - `listerJustificatifsLies(ticketId)` : `SELECT j.id FROM justificatifs j JOIN ticket_justificatifs tj ON tj.justificatif_id = j.id WHERE tj.ticket_id = ? ORDER BY j.date_document DESC`. Retourne `JustificatifId[]`.
    - `versDomaine(row)` / `versRow(t)` selon Pattern 4 (Money roundtrip — `Money.fromCentimes(BigInt(row.cout_estime_ttc_centimes))` si !== null sinon null ; PlainDate roundtrip).

    Faire passer 100 % des tests Task 1.
  </action>
  <verify>
    <automated>pnpm vitest run tests/unit/travaux tests/integration/repositories/ticket-travaux-repository-sqlite.test.ts --reporter=verbose &amp;&amp; pnpm depcruise src --config .dependency-cruiser.js &amp;&amp; pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; (pnpm vitest run --coverage tests/unit/travaux 2&gt;&amp;1 | grep -E "ticket-travaux.ts.*100") &amp;&amp; ! grep -nE "(^|[^a-zA-Z])nature($|[^a-zA-Z])" src/domain/travaux/ticket-travaux.ts</automated>
  </verify>
  <done>
    100 % tests unit + integration verts.
    `grep -nE "(^|[^a-zA-Z])nature($|[^a-zA-Z])" src/domain/travaux/ticket-travaux.ts` exit 1 (D-115 strictement honoré — aucun champ `nature` dans le domaine Travaux).
    N:N pivot ticket_justificatifs opérationnel (lier idempotent + delier + lister + cascade asymétrique D-113 vérifiée).
    Couverture `src/domain/travaux/ticket-travaux.ts` = 100 % (4 transitions clore + 2 transitions annuler + invariants creer).
    `pnpm depcruise && pnpm typecheck && pnpm lint` exit 0 (BC Travaux peut importer port JustificatifRepository — règle dependency-cruiser autorisée en 04-01).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 — Wire UI: routes Fastify travaux + EJS pages + section Travaux fiche Bien + main.ts + Cucumber GREEN</name>
  <files>
    src/web/routes/travaux.ts,
    src/web/schemas/ticket-travaux-schemas.ts,
    src/web/views/pages/travaux/liste.ejs,
    src/web/views/pages/travaux/nouveau.ejs,
    src/web/views/pages/travaux/detail.ejs,
    src/web/views/partials/partial-badge-statut-ticket.ejs,
    src/web/views/partials/partial-ticket-row.ejs,
    src/web/views/partials/partial-ticket-pj-section.ejs,
    src/web/views/pages/biens/detail.ejs,
    src/web/routes/biens.ts,
    src/helpers/format-statut-ticket.ts,
    src/main.ts
  </files>
  <behavior>
    Les 15 scénarios `@phase4 @inc-01` Cucumber doivent passer GREEN.

    Comportements UI clés :
    - Route declaration order : `GET /travaux/nouveau` AVANT `GET /travaux/:id` (PATTERNS §travaux.ts — éviter capture du segment "nouveau" comme :id).
    - Section "Travaux" sur fiche Bien rendue APRÈS section "Documents" ajoutée en 04-02 (ordre des sections : Phase 1/2/3 d'abord, puis Documents, puis Travaux).
    - Badge statut ticket dans toutes les listes (UI-1.4) avec aria-label "Statut : {label}".
    - Touch target ≥ 44x44px pour tous les boutons (WCAG 2.5.5).
    - Fiche ticket sections h2 dans l'ordre UI-5.3 : Méta → Pièces jointes → Clôture (si applicable).
  </behavior>
  <action>
    Implémenter `src/web/schemas/ticket-travaux-schemas.ts` (PATTERNS §schémas analog encaissement-schemas) :
    - `creerTicketSchema` : titre (min 1 max 200 trim, msg "Le titre du ticket est obligatoire."), description (min 1 max 5000 trim, msg "La description est obligatoire."), dateOuverture (regex ISO + refine ≤ today, msg "La date d'ouverture ne peut pas être dans le futur."), coutEstimeTtcCentimes (coerce int nonnegative optional nullable), notes (trim max 2000 optional nullable).
    - `cloreTicketSchema` : dateCloture (regex ISO + refine), coutReelTtcCentimes (coerce int nonnegative — **required** avec msg "Le coût réel TTC est obligatoire pour clore le ticket.").
    - `annulerTicketSchema` : raison (trim min 1 max 500).
    - `ajouterPJExistantSchema` (query string) : justificatifId (uuid).

    Implémenter `src/web/routes/travaux.ts` (PATTERNS §travaux.ts analog etats-des-lieux.ts) :
    - Plugin signature : `async function plugin(app, opts: { ticketRepo, bienRepo, locataireRepo, justificatifRepo, stockage, convertisseurImage, clock, db })`.
    - `GET /biens/:id/travaux` : bienRepo.trouverParId (404 si null avec "Bien introuvable."), `tickets = await listerTicketsParBien({ bienId: bien.id }, { ticketRepo })`. Render `pages/travaux/liste.ejs` avec `{ bien, tickets, navActive: 'biens' }`.
    - **`GET /travaux/nouveau` AVANT `GET /travaux/:id`** (declaration order matters per analog diagnostics.ts:27-46) : query `bienId` requis (Zod uuid), `bien = bienRepo.trouverParId(bienId)` → 404 si null. Render `pages/travaux/nouveau.ejs` avec `{ bien, erreurs: null, valeurs: {}, navActive: 'biens' }`.
    - `POST /biens/:id/travaux` : Zod parse `creerTicketSchema`. Si erreurs → re-render nouveau.ejs avec valeurs + erreurs. Sinon → `creerTicketTravaux({ bienId: id, titre, description, dateOuverture, coutEstimeTtc: montantCentimes ? Money.fromCentimes(BigInt(montantCentimes)) : null, notes }, deps)`. `req.session.banniereSuccess = 'Ticket créé.'`. 302 redirect `/travaux/${ticketId}`. Catch BienIntrouvable → 404.
    - `GET /travaux/:id` : `{ ticket, bien, justificatifs } = await lireTicket({ id }, deps)`. Render `pages/travaux/detail.ejs` avec `{ ticket, bien, justificatifs, today: clock.aujourdhui(), navActive: 'biens' }`.
    - `POST /travaux/:id/clore` : Zod parse cloreTicketSchema. `await cloreTicketTravaux({ id, dateCloture: PlainDate.from(dateCloture), coutReelTtc: Money.fromCentimes(BigInt(coutReelTtcCentimes)) }, deps)`. Bannière "Ticket clôturé." → 302 redirect /travaux/:id. Catch TransitionInvalide → 400 + bannière warning verbatim (rare).
    - `POST /travaux/:id/annuler` : Zod parse annulerTicketSchema. `await annulerTicketTravaux({ id, raison }, deps)`. Bannière "Ticket annulé." → 302 redirect `/biens/${ticket.bienId}/travaux`.
    - `POST /travaux/:id/justificatifs` : 2 modes :
      - Si content-type multipart (multipart/form-data) → `data = await req.file()`, lire fields → construire `cmd.fichier = { buffer, nomOriginal, mimeAnnonce, titre, type, dateDocument, montantTtc, notes }` → `ajouterPJTicket(cmd, deps)`. Bannière "Pièce jointe ajoutée au ticket."
      - Si query `?justificatifId=:jid` (form-urlencoded ou query) → `ajouterPJTicket({ ticketId: id, justificatifId: jid }, deps)`. Bannière "Pièce jointe ajoutée au ticket." Catch PJIncoherenteBien → bannière warning + redirect /travaux/:id.
    - `POST /travaux/:id/justificatifs/:jid/delier` : `await delierPJTicket({ ticketId: id, justificatifId: jid }, deps)`. Bannière "Pièce jointe retirée du ticket." → 302 redirect /travaux/:id.

    Implémenter `src/web/views/partials/partial-badge-statut-ticket.ejs` (UI-1.4 clone PATTERNS §partial-badge-statut-ticket) :
    - Map `{ ouvert: { bg: 'var(--couleur-accent-bg)', fg: 'var(--couleur-accent)', label: 'ouvert' }, en_cours: { bg: 'var(--couleur-warning-bg)', fg: 'var(--couleur-warning)', label: 'en cours' }, clos: { bg: 'var(--couleur-success-bg)', fg: 'var(--couleur-success)', label: 'clos' }, annule: { bg: 'var(--couleur-neutre-bg)', fg: 'var(--couleur-neutre)', label: 'annulé' } }`.
    - `<span style="background: <%= item.bg %>; color: <%= item.fg %>; padding: 2px 6px; border-radius: 4px; font-weight: 600; white-space: nowrap;" aria-label="Statut : <%= item.label %>"><%= item.label %></span>`.

    Implémenter `src/web/views/partials/partial-ticket-row.ejs` (UI-5.2) :
    - `<tr>` 7 `<td>` : titre (lien `/travaux/:id`), badge statut via include partial-badge-statut-ticket, dateOuverture (formatDate), dateCloture (formatDate ou "—"), coutEstime (formatMoney ou "—"), coutReel (formatMoney ou "—"), actions (lien "Voir" + bouton "Annuler" avec confirm-dialog conditionnel si statut !== 'annule').

    Implémenter `src/web/views/pages/travaux/liste.ejs` (UI-5.2) :
    - Layout (navActive='biens', breadcrumbs `[{label:'Biens', href:'/biens'}, {label:bien.adresse, href:`/biens/${bien.id}`}, {label:'Travaux'}]`).
    - `<h1>Travaux — <%= bien.adresse %></h1>`.
    - Header section : `<a href="/travaux/nouveau?bienId=<%= bien.id %>" role="button">Nouveau ticket</a>`.
    - Si tickets.length === 0 : include `partial-empty-state` "Aucun ticket pour ce Bien" + body "Le premier ticket sert souvent à tracer la mise en service du logement." + CTA "Nouveau ticket" → /travaux/nouveau?bienId=:id (D-119 verbatim).
    - Sinon : `<table aria-label="Tickets travaux">` thead 7 cols (Titre | Statut | Ouverture | Clôture | Coût estimé | Coût réel | Actions) + tbody boucle `<%- include('../../partials/partial-ticket-row', { ticket: t }) %>`.

    Implémenter `src/web/views/pages/travaux/nouveau.ejs` :
    - Layout + breadcrumbs `[..., {label:'Travaux', href:`/biens/${bien.id}/travaux`}, {label:'Nouveau'}]`.
    - `<h1>Nouveau ticket — <%= bien.adresse %></h1>`.
    - `<form method="POST" action="/biens/<%= bien.id %>/travaux">` form 1 page :
      - titre (input text required maxlength 200, préfill).
      - description (textarea required maxlength 5000, préfill).
      - dateOuverture (date required, default today via valeur EJS).
      - coutEstimeTtcCentimes (number step="0.01" optional, label "Coût estimé TTC (€)").
      - notes (textarea optional maxlength 2000).
    - `<button type="submit">Créer le ticket</button>` + `<a href="/biens/<%= bien.id %>/travaux">Annuler</a>`.

    Implémenter `src/web/views/pages/travaux/detail.ejs` (UI-5.3 — 3 sections 1 colonne) :
    - Layout + breadcrumbs `[..., {label:'Travaux', href:`/biens/${bien.id}/travaux`}, {label: ticket.titre}]`.
    - `<h1><%= ticket.titre %> <%- include('../../partials/partial-badge-statut-ticket', { statut: ticket.statut }) %></h1>`.

    - Section h2 "Méta" : `<dl>` description (texte multi-ligne préservé via `<%- ticket.description.replace(/\n/g, '<br>') %>` ou `<pre>`), bien (lien), dateOuverture, dateCloture (si !== null), coutEstime (formatMoney ou "—"), coutReel (si !== null formatMoney), notes (texte).

    - Section h2 "Pièces jointes" : include `partial-ticket-pj-section` avec `{ ticket, justificatifs }`.

    - Section h2 "Clôture" conditionnelle (`if (ticket.statut === 'ouvert' || ticket.statut === 'en_cours')`) :
      - Form `<form method="POST" action="/travaux/<%= ticket.id %>/clore">` inline :
        - dateCloture (date required, default today).
        - coutReelTtcCentimes (number step="0.01" required, label "Coût réel TTC (€)").
      - `<button type="submit">Clore le ticket</button>`.

    - Section "Actions" h2 (conditionnelle si statut !== 'annule') :
      - `<button data-open-dialog="dialog-annuler-<%= ticket.id %>" class="destructif">Annuler le ticket</button>` + include `partial-confirm-dialog` avec form action `/travaux/<%= ticket.id %>/annuler` + champ caché raison ou champ visible textarea selon UX choice (V1 : champ caché simple "Annulation utilisateur" ou input pour personnaliser — choisir input text required min 1 max 500 dans le confirm-dialog).

    Implémenter `src/web/views/partials/partial-ticket-pj-section.ejs` (UI-5.3 panneau PJ) :
    - Si justificatifs.length === 0 : empty-state "Aucune pièce jointe" + body "Ajoutez un devis ou une facture pour ce ticket." + CTA "Ajouter une pièce jointe" inline scrollant vers le form ci-dessous (D-119 verbatim).
    - Sinon : `<table aria-label="Pièces jointes">` 4 cols (Date | Type | Titre lien `/justificatifs/:id` | Actions). Action "Retirer" via `<form method="POST" action="/travaux/<%= ticket.id %>/justificatifs/<%= j.id %>/delier" style="display:inline"><button type="submit">Retirer</button></form>`.
    - Sous la table (toujours visible) : form upload inline `<form enctype="multipart/form-data" method="POST" action="/travaux/<%= ticket.id %>/justificatifs">` :
      - input file (accept liste 5 formats), titre, dateDocument, type select, montant optionnel, notes optionnel — **PAS de fieldset Rattacher** (bienId implicite = ticket.bienId, D-103 satisfait automatiquement côté ajouter-pj-ticket.ts).
      - `<button type="submit">Ajouter une pièce jointe</button>`.

    Étendre `src/web/views/pages/biens/detail.ejs` :
    - Nouvelle section h2 "Travaux" (UI-5.4) APRÈS la section "Documents" de 04-02 (ordre des sections : Phase 1/2/3 d'abord (Lots, Diagnostics, Baux), puis Documents de 04-02, puis Travaux de 04-03).
    - Si `ticketsBien.total === 0` : empty-state verbatim "Aucun ticket pour ce Bien" + body "Le premier ticket sert souvent à tracer la mise en service du logement." + CTA "Nouveau ticket" → `/travaux/nouveau?bienId=<%= bien.id %>` (D-119).
    - Sinon : table compacte tickets ouverts/en_cours (4 cols : Titre lien + Statut badge + Ouverture + Coût estimé) max 5 rows + footer `<a href="/biens/<%= bien.id %>/travaux">Voir tous les tickets (<%= ticketsBien.total %>)</a>` + `<a href="/travaux/nouveau?bienId=<%= bien.id %>" role="button">Nouveau ticket</a>`.

    Étendre `src/web/routes/biens.ts` (handler GET /biens/:id) :
    - Appel `const ticketsOuverts = await listerTicketsParBien({ bienId: bien.id, statuts: ['ouvert', 'en_cours'] }, { ticketRepo });` + `const totalTickets = (await listerTicketsParBien({ bienId: bien.id, inclureAnnules: true }, { ticketRepo })).length;` (alternative perf : ajouter `compterParBien(bienId)` au repo si nécessaire — V1 utiliser .length suffit).
    - Passer `ticketsBien = { items: ticketsOuverts, total: totalTickets }` au template.

    Créer `src/helpers/format-statut-ticket.ts` (PATTERNS §helpers analog format-statut-diagnostic.ts) :
    - `Record<StatutTicket, string>` : `{ ouvert: 'Ouvert', en_cours: 'En cours', clos: 'Clos', annule: 'Annulé' }`.
    - Export `formaterStatutTicket(statut: StatutTicket): string`.

    Mettre à jour `src/main.ts` :
    - Instancier `const ticketRepo = new TicketTravauxRepositorySqlite(db);`.
    - Register plugin travaux : `await app.register(pluginTravaux, { ticketRepo, bienRepo, locataireRepo, justificatifRepo, stockage: stockageJustificatifs, convertisseurImage, clock, db });`.
    - Passer `ticketRepo` aux opts du plugin biens existant (pour que routes/biens.ts puisse appeler listerTicketsParBien).
    - Étendre preHandler `reply.locals` Object.assign avec `formaterStatutTicket` (additif).

    Implémenter step definitions Cucumber manquantes dans `travaux.steps.ts` (assertion badge HTML, assertion section fiche Bien, assertion rows pivot, assertion cascade asymétrique via SQL direct). Faire passer les 15 scénarios `@phase4 @inc-01`.

    **Documentation update (CLAUDE.md non-négociable — docs in same commit as code change)** :
    - Créer ou mettre à jour `README.md` à la racine du projet (`/Users/valentinshodo/Projects/toolbox/gestion-locative/README.md`).
    - Sections obligatoires à inclure / mettre à jour :
      - **Présentation projet** (rappel VISION : LMNP local-first mono-user audit-friendly).
      - **Architecture** : 6 bounded contexts (Patrimoine, Locatif, Encaissements, **Documents** (nouveau Phase 4), **Travaux** (nouveau Phase 4), Fiscalité prévu Phase 5). Référencer `practices/DDD.md`.
      - **Stack** (rappel synthétique : TS strict, Node 22 LTS, Fastify, EJS, better-sqlite3, Kysely, Vitest, Cucumber, Pico.css).
      - **Features V1** (statut par phase) :
        - Phase 1 Activation Bien/Locataire/Bail (Complete)
        - Phase 2 Quittancement (Complete)
        - Phase 3 Conformité du bail (Complete)
        - **Phase 4 Coffre documentaire & Travaux** (statut courant) : DOC-01 upload Justificatif + DOC-02 recherche facettée + DOC-03 rétention 10 ans (hard-block purge avant date) + INC-01 tickets travaux avec PJ.
      - **Routes web Phase 4** (table récap) :
        - `GET /coffre` — liste filtrée du coffre (search + bien + locataire + année + type, pagination 20).
        - `GET /coffre/upload` + `POST /coffre/upload` — upload Justificatif (multipart, formats PDF/JPG/PNG/HEIC/WebP, max 50 Mo, magic-bytes validés, HEIC converti JPEG).
        - `GET /coffre/corbeille` — liste soft-deleted + restaurer + purger conditionnelle (gate 10 ans).
        - `GET /justificatifs/:id` — fiche détail.
        - `GET /justificatifs/:id/fichier` — download fichier physique.
        - `GET /justificatifs/:id/modifier` + `POST /justificatifs/:id/modifier` — édition metadata (titre, type, date, montant, notes — fichier immutable).
        - `POST /justificatifs/:id/corbeille` — soft-delete.
        - `POST /justificatifs/:id/restaurer` — restauration depuis corbeille.
        - `POST /justificatifs/:id/purger` — hard-delete (refusé si avant 10 ans).
        - `GET /biens/:id/travaux` — liste tickets d'un Bien.
        - `GET /travaux/nouveau?bienId=:id` + `POST /biens/:id/travaux` — création ticket.
        - `GET /travaux/:id` — fiche ticket (méta + PJ + clôture inline).
        - `POST /travaux/:id/clore` — transition vers statut clos (date + coût réel obligatoires).
        - `POST /travaux/:id/annuler` — soft-delete ticket.
        - `POST /travaux/:id/justificatifs` — ajouter PJ (upload OU attach existant).
        - `POST /travaux/:id/justificatifs/:jid/delier` — retirer PJ.
      - **Stockage local** : `~/.local/share/gestion-locative/documents/justificatifs/{annee}/{id}-{slug}.{ext}` (override possible via `GESTION_LOCATIVE_HOME`).
      - **Rétention légale** : 10 ans (art. L102 B + L169 LPF — exercices déficitaires LMNP). Purge bloquée avant échéance, gate domain `Justificatif.peutEtrePurge(today)`.
      - **Tests** : `pnpm vitest run` (unit + integration) + `pnpm cucumber-js --tags @phase4` (37 scénarios BDD).
      - **Commandes utiles** : `pnpm dev`, `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm depcruise src`.
    - **NE PAS** documenter d'éléments différés (drag&drop V2, OCR V1.1+, FTS5 V2, etc.) — le README reflète **uniquement** le périmètre livré (cf. `04-CONTEXT.md` `<deferred>`).
    - Pas de tâche séparée — c'est une sub-step de cette Task 3 (Wire). Le fichier est créé en utilisant Write/Edit tool, jamais via heredoc bash.
    - Si `docs/specs/` est créé dans une future phase, ce README pointera vers celui-ci. Aujourd'hui (Phase 4) il est inexistant — pas de mise à jour requise.
  </action>
  <verify>
    <automated>pnpm vitest run &amp;&amp; pnpm cucumber-js --tags @phase4 &amp;&amp; pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; pnpm depcruise src --config .dependency-cruiser.js &amp;&amp; ! grep -nE "(^|[^a-zA-Z])nature($|[^a-zA-Z])" src/domain/travaux/</automated>
  </verify>
  <done>
    7 (wave 1) + 15 (wave 2) + 15 (wave 3) = 37 scénarios `@phase4` Cucumber verts.
    Fiche Bien affiche 3 sections cumulées : Phase 1/2/3 (existantes) + Documents (04-02) + Travaux (04-03) dans l'ordre.
    Empty state D-119 verbatim sur Travaux fiche Bien.
    Helper `formaterStatutTicket` injecté dans preHandler.
    Aucun fichier `src/domain/travaux/**` ne contient le mot `nature` (D-115 strictement honoré).
    Badge statut affiche aria-label "Statut : ..." (4 variantes UI-1.4 testées via assertion HTML).
    Workflow Cucumber complet : créer ticket → ajouter PJ via upload + via attach → clore → annuler (testé sur tickets séparés).
    0 warning ESLint, 0 erreur typecheck, depcruise propre (BC Travaux peut importer port JustificatifRepository mais pas adapter).
    `README.md` créé/mis à jour à la racine du projet — vérifiable par `test -f README.md && grep -E "Coffre documentaire|Travaux|Phase 4" README.md` (les 3 marqueurs présents). Conforme à la règle CLAUDE.md "Documentation hygiene — docs in same commit as code change".
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → POST /biens/:id/travaux | titre/description/dates/coûts untrusted |
| client → POST /travaux/:id/justificatifs | dual-mode (upload binaire OU justificatifId existant) — risques croisés |
| client → POST /travaux/:id/clore | transitions état + coût réel untrusted |
| DB → tickets_travaux DELETE | cascade asymétrique D-113 (pivot supprimé mais pas justificatifs) |

## STRIDE Threat Register

| Threat ID | Cat | Component | Disposition | Mitigation Plan |
|-----------|-----|-----------|-------------|-----------------|
| T-04-18 | T | POST /biens/:id/travaux | mitigate | Zod creerTicketSchema valide les bornes + bienRepo.trouverParId avant Ticket.creer (BienIntrouvable → 404) |
| T-04-19 | T | POST /travaux/:id/clore | mitigate | Zod cloreTicketSchema force coutReelTtcCentimes required (UI-6.2 verbatim) ; domain .clore() re-vérifie transitions statut (4 cas testés) |
| T-04-20 | I | GET /travaux/:id | accept | V1 mono-user — pas de leak inter-user à protéger |
| T-04-21 | T | POST /travaux/:id/justificatifs (upload) | mitigate | Réutilise tout le pipeline upload sécurisé de 04-01 : Zod + magic-bytes + conversion HEIC + limits.fileSize ; ajoute cohérence bienId automatique (jamais d'override possible côté client) |
| T-04-22 | T | POST /travaux/:id/justificatifs?justificatifId=:jid (attach) | mitigate | Use case ajouter-pj-ticket vérifie justificatif.bienId === ticket.bienId AVANT insertion pivot → throw PJIncoherenteBien si mismatch |
| T-04-23 | E | DELETE FROM tickets_travaux côté SQL (admin) | accept | V1 pas d'UI delete ticket (annuler softdelete suffit). Cascade asymétrique D-113 documentée — ne purge JAMAIS les Justificatifs (rétention 10 ans D-109 prime) |
| T-04-24 | D | listerJustificatifsLies sur ticket avec 1000+ PJ | accept | Local-first mono-user — un ticket aura typiquement 1-10 PJ. Pas de pagination V1 (V2 si besoin) |
| T-04-25 | R | annuler ticket sans raison | mitigate | Zod annulerTicketSchema force raison min 1 char trim — audit-friendly via raison_annulation persisté |
</threat_model>

<verification>
- `pnpm vitest run` — 100 % vert.
- `pnpm cucumber-js --tags @phase4` — 37 scénarios verts (7 + 15 + 15).
- `pnpm typecheck && pnpm lint && pnpm depcruise src` — exit 0.
- Coverage `pnpm vitest run --coverage` : `src/domain/travaux/ticket-travaux.ts` = 100 %.
- D-115 enforcement : `grep -rE "(^|[^a-zA-Z])nature($|[^a-zA-Z])" src/domain/travaux/` retourne 0 résultats.
- **Documentation (CLAUDE.md non-négociable)** : `test -f README.md && grep -E "Coffre documentaire|Travaux|Phase 4" README.md | wc -l | grep -qE "^([3-9]|[1-9][0-9])$"` — README.md existe et contient au moins 3 occurrences des marqueurs Phase 4.
- Smoke test manuel : sur app live, créer ticket sur un Bien, ajouter une PJ upload PDF, attach un Justificatif existant cohérent, tenter attach Justificatif d'autre Bien (refus visible), clore le ticket avec coût réel, voir le ticket dans liste avec badge "clos", retourner sur fiche Bien voir section Travaux vide (clos pas listé) + lien "Voir tous les tickets (1)".
</verification>

<success_criteria>
- L'utilisateur peut créer un TicketTravaux rattaché à un Bien avec coût estimé.
- L'utilisateur peut ajouter ≥1 pièce jointe au ticket (upload nouveau ou attach existant cohérent en bienId).
- L'utilisateur peut clore un ticket avec date + coût réel (refus si coût réel manquant — verbatim UI-6.2).
- L'utilisateur peut annuler un ticket avec raison persistée.
- Section "Travaux" sur fiche Bien affiche tickets ouverts/en_cours + CTA "Nouveau ticket".
- Badge statut coloré avec aria-label "Statut : ..." (4 variantes UI-1.4).
- Cascade asymétrique D-113 vérifiée : DELETE ticket → pivot supprimé, justificatifs intacts.
- AUCUN champ `nature` dans `src/domain/travaux/**` (D-115 enforcement strict).
- 37 scénarios BDD `@phase4` verts (cumul des 3 plans).
- 100 % couverture sur `src/domain/travaux/ticket-travaux.ts` (logique workflow + transitions).
- 0 warning ESLint, 0 erreur typecheck, depcruise propre.
- Helper `formaterStatutTicket` injecté dans preHandler (Pattern 7 PATTERNS §Shared).
- `README.md` documenté (sections Features + Routes + Architecture + Stockage local + Rétention légale) — règle CLAUDE.md "Documentation hygiene" respectée à la fin du wave 3 (last-wave commit groups docs avec code, donc Phase 4 ship complet).
</success_criteria>

<output>
After completion, create `.planning/phases/04-coffre-documentaire-travaux/04-03-SUMMARY.md` selon le template `~/.claude/get-shit-done/templates/summary.md` avec :
- `affects` : `[BC Travaux (création complète), web routes biens (ext: section Travaux), EJS biens/detail.ejs (section Travaux ajoutée APRÈS section Documents), main.ts (register plugin travaux + ticketRepo + helper formaterStatutTicket), table pivot ticket_justificatifs (déjà créée wave 1 via migration 0010, utilisée ici), README.md (créé/mis à jour — CLAUDE.md docs-hygiene)]`
- `provides` : `[Agrégat TicketTravaux + repository SQLite + pivot N:N ticket_justificatifs, 7 use cases (creer, lister-par-bien, lire, clore, annuler, ajouter-pj dual-mode, delier-pj), 7 routes Fastify travaux contextuelles + standalone, partial-badge-statut-ticket (UI-1.4), partial-ticket-row, partial-ticket-pj-section (UI-5.3 panneau PJ), helper formaterStatutTicket, section Travaux sur fiche Bien (UI-5.4), README.md sections Features + Routes + Architecture + Stockage + Rétention légale documentant l'ensemble du périmètre Phase 4]`
- `patterns` : `[Pattern 3 soft-delete copy-on-write (annule_le), Pattern 4 repository Kysely + N:N pivot avec idempotent onConflict.doNothing, Pattern 5 use case cross-aggregate (ajouter-pj-ticket réutilise uploaderJustificatif), Pattern 7 helper EJS preHandler, partial-badge clone UI-1.4 (analog partial-badge-dpe)]`
- `decisions` : `[D-112 (TicketTravaux agrégat racine BC Travaux), D-113 (N:N pivot ticket_justificatifs + cascade asymétrique), D-114 (workflow 1 page meta + panneau PJ + clôture inline + transitions manuelles), D-115 (PAS de champ nature — qualification fiscale différée Phase 5 strictement honoré + assertion grep), D-119 (empty state ticket vide verbatim), UI-1.4 (badge statut 4 variantes), UI-5.2 (colonnes liste tickets), UI-5.3 (fiche 3 sections), UI-5.4 (section Travaux fiche Bien), UI-6.1/UI-6.2/UI-6.3 verbatim CTAs/erreurs/A11y]`
- `commits` : list of commits produced.
- `tests_added` : `[bdd 15 scenarios @inc-01, unit ticket-travaux invariants creer + 4 transitions clore + 2 transitions annuler, integration repo TicketTravaux roundtrip + N:N pivot lier idempotent + delier + lister + cascade asymétrique D-113]`
</output>

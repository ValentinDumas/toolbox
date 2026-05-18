# Phase 4: Coffre documentaire & Travaux — Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Note:** Discussion interactive (4 batches AskUserQuestion). Chaque gray area a été arbitrée explicitement par l'utilisateur. Remplace la v1 auto (`04-CONTEXT.v1-auto.bak.md`) générée sans validation utilisateur.

<domain>
## Phase Boundary

La Phase 4 livre **deux capacités complémentaires** sur le périmètre administratif du bailleur LMNP :

1. **Coffre documentaire (DOC-01, DOC-02, DOC-03)** — l'utilisateur upload des `Justificatif`s (factures, tickets de caisse, baux signés scannés, EDL papier signés, diagnostics PDF émis par un pro, attestations), les rattache à un `Bien` et/ou un `Locataire`, les retrouve par `Bien` / `Locataire` / année fiscale, et le système garantit une rétention de **10 ans** (durée légale de prescription en matière fiscale, art. L169 LPF pour exercices déficitaires + art. L102 B LPF pour pièces comptables).
2. **Tickets travaux / incidents (INC-01)** — l'utilisateur crée un `TicketTravaux` rattaché à un `Bien` avec un coût, une description, un statut, et au moins une pièce jointe (devis ou facture) qui devient un `Justificatif` du coffre.

**REQs couverts (4)** : DOC-01 (upload + rattachement), DOC-02 (recherche par Bien/Locataire/année), DOC-03 (rétention 10 ans), INC-01 (ticket avec PJ + coût).

**Bounded contexts touchés** :
- **Nouveau BC `Documents`** — agrégat racine `Justificatif`, nouveau port `StockageJustificatifs` dédié (séparation stricte par BC, pas une extension du `StockageFichierLocal` de Phase 2 — cf. D-106).
- **Nouveau BC `Travaux`** — agrégat racine séparé `TicketTravaux`, référence `BienId` par identifiant (pas inclusion). Cycle de vie indépendant du `Bien`, dashboard cross-Bien attendu Phase 7.
- **Pas de modification** des BC existants (Patrimoine, Locatif, Encaissements) — Phase 4 est purement additive.

**Strictement hors périmètre Phase 4** (rappels — ne pas attraper en scope creep) :
- **OCR / extraction automatique** → V1.1+.
- **Catégorisation automatique** par règles ou ML → V1.1+.
- **Tags libres** (folksonomy) → V2.
- **Recherche full-text dans le contenu des PDFs** → V2 (FTS5).
- **Vue agrégée des documents générés par l'app** (quittances, avis échéance, avenants IRL) → **Phase 7 Dashboard** (cf. D-110). Phase 4 ne touche pas aux livrables des phases antérieures.
- **Devis et facturation sortants** → hors V1 LMNP.
- **Workflow d'approbation / signature électronique** → V2.
- **Sync cloud / backup automatique** → V2 (R3.1 RISKS.md, phase BAK dédiée).
- **Notifications J-30 / J-7** sur l'expiration d'un Justificatif → Phase 7.
- **Catégorisation fiscale des charges** → Phase 5. Phase 4 = stocker + indexer + retrouver. Phase 5 = qualifier fiscalement via un VO `CategorisationFiscaleTravaux` dans son propre BC `Fiscalité` (cf. D-115).
- **Agrégation cross-Bien dashboard** → Phase 7.
- **Rattachement multi-Lots** (factures de copropriété ventilées) → V1.1+. V1 = rattachement Bien unique.
- **Sous-agrégat structuré `DossierLocataire`** (catégories CAF / garant / assurance) → V2 (cf. D-117). V1 = simple filtrage par `type` de Justificatif.
- **Multi-bailleur, SCI, gestion déléguée** → jamais (V1 mono-user).
- **Saisie d'une dépense récurrente** → V1.1+.
- **Comptabilisation en partie double** → Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Décisions verrouillées en amont (PROJECT.md / ROADMAP.md / Phases 1-3 — non rediscutées)

- **DV-01 → DV-07** (PROJECT.md) : LMNP location meublée longue durée, local-first SQLite, DDD hexagonal strict, ubiquitous language français, BDD outside-in 100% couverture fiscale, MVP vertical slices, 6 bounded contexts.
- **D-01 → D-27** (Phase 1) : Stack TS strict + Node 22 LTS + Fastify + EJS + better-sqlite3 + Kysely + Vitest + Cucumber + fast-check + Money bigint cents + Temporal API + Zod + pdfmake + Pico.css + ESLint + Prettier + dependency-cruiser + pnpm + pino + tsx + Mise.
- **D-28 → D-50** (Phase 1) : Périmètre entités Bien/Lot/Locataire/Bail figé ; standards UI/UX/A11y opposables (WCAG 2.1 AA, 1 dominant/écran, spacing 8 px, forms 1 colonne label-au-dessus + validation au blur, destructive = confirmation).
- **D-51 → D-74** (Phase 2) : `Bail.actif_depuis`, `Bail.jour_echeance`, `EcheanceLoyer` snapshot, soft-delete + compensateur, Quittance numérotée AAAA-NNN, Bailleur singleton mono-user. **D-63 stockage fichiers PDF local** `~/.../gestion-locative/documents/{type}/{annee}/...` → **pattern de référence** pour Phase 4 (mais nouveau port dédié — cf. D-106).
- **D-75 → D-101** (Phase 3) : Diagnostics sous-agrégat Bien, EDL agrégat avec discriminant entrée/sortie, IRL workflow 5 étapes, gel DPE F/G blocage dur, checklist mobilier 12 items, PDF avenant IRL stocké `documents/avenants/{annee}/`.
- **Patterns Phase 1-2-3 à rejouer Phase 4** : factory `X.creer()` + `InvariantViolated`, brand types pour identifiants, builders `tests/_builders/`, TDD outside-in (BDD rouge → tests unit/integration rouges → green), repository `versDomaine`/`versRow` + `transaction()`, use case multi-repos pour cross-aggregate, EJS layout split `debut`/`fin`, partials configurables via `locals`, preHandler limité aux helpers pure, Money INTEGER cents (BigInt domaine), Temporal.PlainDate ↔ TEXT ISO, JSON inline pour VOs imbriqués, soft-delete avec `annule_le` + `raison_annulation`.

### Modèle Justificatif (DOC-01)

- **D-102** : **`Justificatif` = agrégat racine du nouveau BC `Documents`**. Identité propre `JustificatifId` (brand type), persistance dédiée table `justificatifs`, `JustificatifRepository`. Pas un sous-agrégat — cycle de vie indépendant, requêtable cross-Bien et cross-Locataire, rétention propre 10 ans. *Décidé par l'utilisateur (batch 1) — option recommandée DDD pure.*
- **D-103** : **Rattachement polymorphique via 2 FK nullables**. `Justificatif { bienId: BienId | null, locataireId: LocataireId | null, ... }`. **Invariant : au moins l'un des deux non-null**, validé par `Justificatif.creer()` → `InvariantViolated` sinon. Cas typiques :
  - Facture travaux d'un appartement → `bienId` seul.
  - CNI / fiche de paie d'un candidat → `locataireId` seul.
  - Bail signé scanné → les deux remplis (Bien × Locataire).
  - Cas N:N (copro ventilée par lot) → **différé V1.1+** (cf. `<deferred>`). V1 = 1 rattachement principal.
  *Décidé par l'utilisateur (batch 1) — option recommandée.*
- **D-104** : **Catégorisation par enum fixe versionnable LF annuelle** (cohérent D-77 Phase 3) :
  ```ts
  TypeJustificatif =
    | 'facture'            // facture fournisseur (travaux, entretien, gestion, assurance, taxe foncière, etc.)
    | 'ticket_caisse'      // dépense de faible montant (matériel mobilier, fournitures)
    | 'bail_signe'         // PDF du bail signé (scan papier)
    | 'edl_signe'          // PDF de l'EDL contradictoire signé (scan)
    | 'diagnostic_pdf'     // PDF du DPE/gaz/élec/ERP émis par le pro
    | 'attestation'        // attestation d'assurance, attestation de TVA, CFE, etc.
    | 'piece_locataire'    // CNI, fiche paie, contrat travail, avis impo (dossier locataire)
    | 'releve_bancaire'    // relevé bancaire utile pour rapprochement Encaissements
    | 'autre';             // catégorisation libre par notes
  ```
  Constante `LABELS_TYPE_JUSTIFICATIF: Record<TypeJustificatif, string>` pour l'affichage. **Tags libres = V2.** *Décidé par l'utilisateur (batch 1).*
- **D-105** : **Formats acceptés V1 : PDF, JPG, PNG, HEIC, WebP. Taille max 50 Mo.**
  - **HEIC convertie côté serveur en JPEG** via un **port domain `ConvertisseurImage`** (interface pure : `convertirVersJpeg(bytes, mimeSource): Promise<bytes>`) + un **adapter d'infra** wrappant `sharp` ou `heif-converter` (cf. DP-22). Le domaine ne connaît jamais la lib. Même pattern d'isolation que `StockageFichierLocal` Phase 2.
  - Le `Justificatif` persiste **toujours** le format de sortie (PDF ou JPEG ou PNG ou WebP — jamais HEIC), pour garantir lecture universelle 10 ans.
  - Validation MIME côté HTTP via **magic-bytes + Content-Type croisés** (cf. D-114).
  - Taille max 50 Mo matérialisée par `@fastify/multipart` `limits.fileSize` → rejet HTTP 413 immédiat.
  - Limite d'espace disque agrégée non surveillée V1 (mono-user local-first).
  *Décidé par l'utilisateur (batch 1) — choix étendu HEIC/WebP + 50 Mo.*
- **D-106** : **Stockage = nouveau port domain `StockageJustificatifs` dédié au BC `Documents`** (pas une extension de `StockageFichierLocal` de Phase 2 — séparation stricte par bounded context). Interface pure :
  ```ts
  interface StockageJustificatifs {
    ecrire(annee: number, justificatifId: JustificatifId, slug: string, ext: string, bytes: Buffer): Promise<CheminRelatif>;
    lire(cheminRelatif: CheminRelatif): Promise<Buffer>;
    supprimer(cheminRelatif: CheminRelatif): Promise<void>;
  }
  ```
  L'**adapter d'infra** `StockageJustificatifsLocal` réutilise le mécanisme anti-path-traversal éprouvé par `StockageFichierLocal` (WR-03 Phase 2) — copie/extraction du même garde. Chemin physique : `~/.../gestion-locative/documents/justificatifs/{annee_fiscale}/{justificatifId}-{slug}.{ext}`. Le `justificatifId` évite les collisions ; le slug reste lisible si l'utilisateur ouvre le dossier dans Finder. *Décidé par l'utilisateur (batch 2) — option "nouveau port dédié" (DDD strict).*
- **D-107** : **Champ `dateDocument: Temporal.PlainDate` obligatoire** (= date d'émission de la facture / signature du bail / ticket, saisie par l'utilisateur — **pas** la date d'upload). L'**année fiscale est dérivée** : `anneeFiscale = dateDocument.year` (exercice fiscal LMNP = année civile par défaut). Pas de champ stocké séparément : recalcul à la lecture / index SQLite sur `date_document`. Méthode domaine `Justificatif.anneeFiscale(): number` exposée pour DOC-02.
- **D-108** : **Champs métier du `Justificatif`** :
  ```
  Justificatif {
    id: JustificatifId,
    type: TypeJustificatif,
    dateDocument: Temporal.PlainDate,
    titre: string,                  // libellé court ("Facture peinture salon")
    montantTtc: Money | null,       // optionnel (un bail signé n'a pas de montant)
    cheminFichier: CheminRelatif,   // retourné par StockageJustificatifs
    nomFichierOriginal: string,
    mimeType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',  // (HEIC convertie → jpeg)
    tailleOctets: number,           // gardes + stats
    bienId: BienId | null,
    locataireId: LocataireId | null,
    notes: string | null,
    cree_le: Temporal.PlainDate,
    corbeille_le: Temporal.PlainDate | null,
    raison_corbeille: string | null,
  }
  ```

### Rétention 10 ans (DOC-03)

- **D-109** : **Soft-delete corbeille + hard-block purge avant 10 ans**.
  - "Supprimer" un `Justificatif` → soft-delete : `corbeille_le` rempli, `raison_corbeille` saisie. Fichier physique conservé, row conservée.
  - "Restaurer depuis corbeille" → `corbeille_le = null`.
  - "Purger définitivement" → domain service `Justificatif.peutEtrePurge(today)` retourne `false` si `today < cree_le + 10 ans`. Use case refuse avec message factuel : *"Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date."*. Si `peutEtrePurge() === true`, la purge supprime la row + le fichier physique via `StockageJustificatifs.supprimer()`.
  - **Pas de purge automatique** V1 (pas de cron). L'utilisateur déclenche manuellement chaque purge (audit-friendly — rien de silencieux).
  - Tous les types de `Justificatif` suivent la même règle 10 ans V1. Discrimination par type (ex: ticket_caisse < 6 ans) = V2 si besoin réel.
  - Le port `Clock` (Phase 1) est indispensable pour les tests de rétention (avant date / pile / après).
  *Décidé par l'utilisateur (batch 2) — option recommandée.*

### Recherche (DOC-02)

- **D-110** : **Recherche V1 = SQL LIKE sur métadonnées + filtres facettés**.
  - `LIKE` sur `titre`, `notes`, `nomFichierOriginal`.
  - Filtres facettés (dropdowns) : `bienId` / `locataireId` / `anneeFiscale` / `type`.
  - Pas de FTS5 V1 (mono-user < 10 000 docs typique). FTS5 = V2 (cf. `<deferred>`).
  - Index SQLite sur `bienId`, `locataireId`, `dateDocument`, `type`, `corbeille_le` (composites selon usage — détail au planner).
  - Pagination 20 lignes (pattern Phase 1 D-41 listings).
  *Décidé par l'utilisateur (batch 2) — option recommandée.*
- **D-111** : **Page coffre `/coffre`** = page principale du BC Documents.
  - Sidebar gauche : entrée "Coffre documentaire" en niveau racine.
  - Filtres en haut : champ recherche libre + dropdowns Bien / Locataire / Année / Type.
  - Liste centrale tableau (date | type | titre | bien | locataire | montant | actions).
  - Actions : "Ouvrir" (cf. D-113), "Voir détails" (page dédiée), "Supprimer" (soft-delete avec confirmation, pattern D-46 Phase 1).
  - Page séparée `/coffre/corbeille` listant les soft-deleted avec actions "Restaurer" / "Purger" (conditionnée à D-109).
  - **Pas de vue `/coffre/generes`** Phase 4 — l'agrégation des documents générés (quittances, avis échéance, avenants IRL) est différée **Phase 7 Dashboard** (cf. `<deferred>` + D-110 v1 abandonnée).
  *Décidé par l'utilisateur (batch 2) — option "pas d'inclusion Phase 4" (YAGNI strict, vertical-slice, recommandée).*

### Tickets travaux (INC-01)

- **D-112** : **`TicketTravaux` = agrégat racine du nouveau BC `Travaux`**. Identité propre `TicketTravauxId`, persistance table `tickets_travaux`, `TicketTravauxRepository`. Référence `BienId` par identifiant (pas inclusion). Cycle de vie indépendant du `Bien`, dashboard cross-Bien préparé Phase 7.
  ```
  TicketTravaux {
    id: TicketTravauxId,
    bienId: BienId,                  // FK obligatoire
    titre: string,                   // "Remplacement chauffe-eau cuisine"
    description: string,             // texte long
    dateOuverture: Temporal.PlainDate,
    dateCloture: Temporal.PlainDate | null,
    statut: 'ouvert' | 'en_cours' | 'clos' | 'annule',
    coutEstimeTtc: Money | null,
    coutReelTtc: Money | null,
    notes: string | null,
    cree_le: Temporal.PlainDate,
    annule_le: Temporal.PlainDate | null,
  }
  ```
  **Pas de champ `nature`** dans Phase 4 — la qualification fiscale (reparation / entretien / amélioration) appartient au BC `Fiscalité` Phase 5 (cf. D-115). *Décidé par l'utilisateur (batch 3) — option "BC séparé".*
- **D-113** : **Liaison Ticket ↔ Justificatif via table N:N dédiée `ticket_justificatifs`**.
  - Un ticket peut avoir N pièces jointes (devis, factures, photos avant/après).
  - Un justificatif peut exister **sans** ticket (cas usuel : facture isolée).
  - Le justificatif lié à un ticket est rattaché au `bienId` du ticket (cohérent D-103).
  - **Cascade asymétrique** : suppression d'un ticket ne supprime pas les justificatifs (D-109 rétention 10 ans prime). Les `ticket_justificatifs` correspondants sont purgés (jointure pure).
  *Décidé par l'utilisateur (batch 3) — option recommandée.*
- **D-114** : **Workflow ticket = création 1 page (méta) puis panneau "Pièces jointes" sur fiche détail**.
  - `GET /biens/:id/travaux` : liste des tickets du bien (tableau).
  - `POST /biens/:id/travaux` : création — formulaire 1 page (titre, description, date ouverture, coût estimé) → redirect vers fiche détail.
  - `GET /travaux/:id` : fiche détail avec sections "Méta", "Pièces jointes" (panneau réutilisant le flow upload Justificatif), "Historique" (notes timestampées).
  - Clôture : champ date clôture + coût réel + bouton "Clore" → transition statut `clos`.
  - Statuts manuels (`ouvert | en_cours | clos | annule`) — pas d'auto-transition V1.
  - Cohérent UX Phase 1 (Hick : 1 question / écran).
  *Décidé par l'utilisateur (batch 3) — option recommandée.*

### Anticipation Phase 5 (fiscalité)

- **D-115** : **Phase 4 = stocker + indexer + retrouver. Phase 5 = qualifier fiscalement (BC séparé).**
  - Le champ `nature` (reparation / entretien / amelioration) **n'est PAS ajouté** à la table `tickets_travaux` en Phase 4. DDD strict : ce vocabulaire est fiscal (CGI : amortissable vs déductible courant), pas opérationnel travaux.
  - **Phase 5 introduira un VO `CategorisationFiscaleTravaux`** dans son propre BC `Fiscalité`, référencent `TicketTravauxId` par identifiant. **Aucun couplage retour** : la table `tickets_travaux` n'est jamais modifiée. Pas de re-saisie sur les tickets existants Phase 4 (Phase 5 proposera des défauts heuristiques basés sur libellé/montant).
  - Les `Justificatif`s de type `'facture'` et les `TicketTravaux` seront **scannés Phase 5** pour proposer une catégorisation (charge courante / charge à amortir / non déductible). Phase 4 prépare le terrain : `type`, `dateDocument`, `montantTtc`, `bienId`, `notes` sont les champs que Phase 5 lira.
  - **Aucune logique fiscale en Phase 4** (cohérent vertical-slice + DDD).
  *Décidé par l'utilisateur (batch 3) — option "différer Phase 5" (DDD pur + Vision sobre).*

### UI / A11y / Sécurité

- **D-116** : **UI upload = `<input type="file">` natif, 1 fichier à la fois, `<progress>` natif**.
  - Pas de drag&drop V1, pas de JS custom, pas de multi-upload.
  - Label explicite avec formats acceptés ("PDF, JPG, PNG, HEIC, WebP — max 50 Mo").
  - Erreur Zod côté serveur affichée sous le champ (Pico.css `aria-invalid="true"`).
  - Indicateur de chargement (`<progress>` natif) pendant l'upload.
  - Upload synchrone (redirection après succès).
  - **V2 priorité HAUTE** : drag&drop + multi-upload (cf. `<deferred>` — déjà flaggé prioritaire par l'utilisateur).
  *Décidé par l'utilisateur (batch 4) — option recommandée + note priorité V2.*
- **D-117** : **Visualisation des fichiers stockés = `<a href="…" target="_blank" rel="noopener">`** — ouverture dans le visualiseur natif du navigateur.
  - PDF / HEIC (convertis → JPEG) / WebP : ouverts en nouvel onglet (visualiseur OS, a11y mature, zoom/recherche/impression natifs).
  - JPG / PNG : aperçu inline via `<img alt="{titre du Justificatif}">` sur la fiche détail.
  - **Pas d'iframe PDF inline** V1 (a11y variable, focus piégeux).
  - **Pas de thumbnails serveur** V1 (over-engineering — Phase 7 dashboard pourra ajouter si besoin de vignettes en liste).
  - **Audit-friendly** : le fichier visualisé est strictement identique octet pour octet au fichier persisté (preuve juridique inchangée).
  *Décidé par l'utilisateur (batch 4) — option recommandée (frontend pratiques + Vision + DDD).*
- **D-118** : **Validation sécurité upload = magic-bytes côté serveur + MIME header croisés**.
  - Vérification des premiers octets : `%PDF-`, `\xFF\xD8` (JPG), `\x89PNG`, `RIFF...WEBP`, `ftypheic|ftypheix|ftypmif1|ftypmsf1` (HEIC).
  - Lib `file-type` (npm, ESM pur) recommandée — OU validation maison sur 8-12 premiers octets si on veut éviter une dépendance (cf. DP-21).
  - En cas de conflit `Content-Type` HTTP ≠ magic-bytes → **magic-bytes gagne** (protection upload renommé).
  - Cohérent OWASP A04:2021 (Insecure Design).
  - Rejet HTTP 413 si > 50 Mo via `@fastify/multipart` `limits.fileSize: 50 * 1024 * 1024`.
  *Décidé par l'utilisateur (batch 4) — option recommandée.*
- **D-119** : **Empty states explicites** (pattern UX Phase 1) :
  - Coffre vide : "Aucun justificatif pour le moment. Commencez par uploader une facture, un bail signé ou un diagnostic." + CTA "Ajouter un document".
  - Coffre filtré vide : "Aucun document ne correspond à ces filtres."
  - Corbeille vide : "Aucun document supprimé."
  - Tickets vides : "Aucun ticket pour ce bien. Le premier ticket sert souvent à tracer la mise en service du logement."

### Dossier locataire (REQ LOC-01 partiellement reporté en Phase 4)

- **D-120** : **Dossier locataire = simple filtrage par `type` de Justificatif**.
  - Un `Locataire` peut avoir N `Justificatif`s rattachés via `locataireId` (D-103).
  - Sur la fiche `Locataire` (Phase 1), section "Documents" listant les justificatifs filtrables par `type ∈ {piece_locataire, releve_bancaire, attestation, autre}`.
  - **Pas de sous-agrégat `DossierLocataire`** V1. Pas de catégories CAF / garant / assurance structurées V1.
  - DDD : pas de cycle de vie distinct du `Locataire` → pas d'agrégat racine justifié. Pas d'invariants propres ("CNI + fiche paie obligatoires" = workflow d'agence, hors V1 mono-user).
  - Vision LMNP V1 mono-user particulier : pas de workflow de sélection candidat structuré. Si une future phase ajoute la **sélection de candidat** (V2 ROADMAP), elle introduira **alors** un agrégat `DossierCandidat` propre.
  - **RGPD** compatible : soft-delete + corbeille + purge à 10 ans = mêmes mécanismes que les autres `Justificatif`s.
  *Décidé par l'utilisateur (batch 4) — option "simple filtrage" (DDD pur + Vision sobre).*

### Décisions différées au `gsd-plan-phase 4`

- **DP-21** : Choix exact lib magic-bytes côté serveur (`file-type` npm vs validation maison 8-12 octets).
- **DP-22** : Choix exact lib conversion HEIC → JPEG (`sharp` avec HEIF compilé, ou `heif-converter`, ou autre adapter Node natif). Vérifier disponibilité macOS/Linux du build prebuilt.
- **DP-23** : Découpage exact des migrations SQLite Phase 4 (recommandation : `0004_phase4_documents_travaux.sql` couvrant `justificatifs`, `tickets_travaux`, `ticket_justificatifs` + index — ou plusieurs migrations atomiques selon plan).
- **DP-24** : Choix exact des routes Fastify (recommandation : `GET /coffre`, `GET /coffre/corbeille`, `GET/POST /coffre/upload`, `GET /justificatifs/:id`, `GET /justificatifs/:id/fichier`, `POST /justificatifs/:id/corbeille`, `POST /justificatifs/:id/restaurer`, `DELETE /justificatifs/:id`, `GET /biens/:id/travaux`, `POST /biens/:id/travaux`, `GET /travaux/:id`, `POST /travaux/:id/clore`, `POST /travaux/:id/justificatifs`).
- **DP-25** : Helpers EJS Phase 4 (`formaterTypeJustificatif`, `formaterStatutTicket`, `formaterTailleFichier` octets → "1.2 Mo", `formaterAnneeFiscale`).
- **DP-26** : Politique exacte de capture du `mimeType` côté HTTP (recommandation : croiser `Content-Type` multipart + magic-bytes ; conflit → magic-bytes gagne).
- **DP-27** : Slugification exacte du nom de fichier de stockage (recommandation : slug ASCII alphanumérique + tirets, max 80 caractères, fallback `document` si vide).
- **DP-28** : Politique de pagination (recommandation : 20 lignes par défaut, query string `?page=`).
- **DP-29** : Structure des partials EJS Phase 4 (`partial-justificatif-row`, `partial-upload-form`, `partial-ticket-row`, `partial-filters-coffre`).

### Claude's Discretion (à trancher par le planner / executor)

- Libellés, placeholders et messages d'erreur précis (en accord avec UX_DESIGN.md tone).
- Choix entre N migrations atomiques vs 1 migration globale Phase 4.
- Layout exact de la sidebar avec entrée "Coffre documentaire".
- Convention nom téléchargement (`Content-Disposition: attachment; filename="{nomFichierOriginal}"`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (`gsd-phase-researcher`, `gsd-planner`, `gsd-ui-researcher`, `gsd-executor`) MUST read these avant de planifier ou implémenter.**

### Domaine produit / projet

- `.planning/PROJECT.md` — contraintes verrouillées (audit-friendly, local-first, mono-user), bounded contexts (`Documents` et `Travaux` à instancier ici), key decisions, hors-périmètre.
- `.planning/REQUIREMENTS.md` — REQs DOC-01, DOC-02, DOC-03, INC-01 (V1).
- `.planning/ROADMAP.md` §Phase 4 — goal, success criteria, dépendances (Phases 1, 2, 3).
- `.planning/STATE.md` — état d'avancement.
- `VISION.md` — autonomie, sobriété, local-first, single-user, audit-friendly.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD : cible, périmètre MVP, principes UX.

### Phases 1-3 (artefacts à respecter)

- `.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md` — décisions D-01 → D-50 (stack technique, brand types, standards UI/UX/A11y, factory + InvariantViolated, builders, EJS layout, preHandler pure, helpers format).
- `.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md` — patterns établis (Money cents, Temporal roundtrip, JSON inline pour VOs imbriqués, repository transaction, Cucumber/Zod surprises).
- `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-CONTEXT.md` — **D-63 stockage PDF local** (pattern de référence pour le nouveau port `StockageJustificatifs` — anti-path-traversal WR-03 à porter), D-73 régénération échéances futures (pattern cascade), Bailleur singleton, soft-delete + compensateur.
- `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md` — D-87 (PDF EDL différé Phase 4 confirmé), D-93 avenants stockés `documents/avenants/{annee}/` (cohérent extension Phase 4 `documents/justificatifs/{annee}/`).
- `src/infrastructure/storage/stockage-fichier-local.ts` — **pattern de référence** (anti-path-traversal WR-03) à reproduire dans l'adapter `StockageJustificatifsLocal`. **Pas étendu directement** — nouveau port dédié BC `Documents` (D-106).
- `src/domain/encaissements/quittance.ts` + `src/infrastructure/repositories/quittance-repository-sqlite.ts` — pattern de référence pour `JustificatifRepository` et `TicketTravauxRepository`.

### Domaine fiscal / juridique

- `LMNP.md` — base de connaissances fiscale LMNP. Pertinent Phase 4 pour rétention 10 ans (art. L169 LPF + art. L102 B LPF) et **préparation Phase 5** (anticipation : Phase 4 expose `type` et `montantTtc` que Phase 5 utilisera ; Phase 5 introduira son propre VO `CategorisationFiscaleTravaux`).
- `LOCATION_MEUBLEE_REGLES.md` §11 — documents à conserver 10 ans (diagnostics, EDL, avenants, baux). **Fondement direct** de D-109.
- **Art. L102 B LPF** — obligation de conservation des pièces comptables.
- **Art. L169 LPF** — prescription du droit de reprise = 3 ans ordinaire mais **10 ans en cas d'omission ou exercice déficitaire** (pertinent LMNP réel déficitaire les premières années).
- **RGPD** — durée de conservation pièces `Locataire` cohérente avec prescription comptable, à condition de purger sur demande après 10 ans (D-109 purge manuelle).

### Pratiques d'ingénierie (opposables)

- `practices/DDD.md` — bounded contexts (`Documents`, `Travaux`), agrégats racines, ports & adapters, ubiquitous language français, anti-patterns. `Justificatif` = agrégat racine BC Documents (D-102) ; `TicketTravaux` = agrégat racine BC Travaux (D-112). Nouveau port `StockageJustificatifs` (D-106) + nouveau port `ConvertisseurImage` (D-105).
- `practices/BDD_PRACTICES.md` — outside-in, pyramide tests, cas obligatoires §8 : invariant `≥1 non-null bienId/locataireId`, validation magic-bytes (sécurité), rétention 10 ans (blocage purge avant date), soft-delete réversible, conversion HEIC → JPEG. Port `Clock` Phase 1 indispensable pour tests rétention.
- `practices/SOFTWARE_CRAFTSMANSHIP.md` — SOLID, KISS/DRY/YAGNI, gates CI §8 : 0 warning, ≥80 % coverage, 100 % logique métier, cyclomatic < 10, suite unitaire < 30 s. Rétention 10 ans = logique réglementaire impérative → 100 % couverture.
- `practices/BEHAVIOR.md` — code of conduct par session : posture sceptique. Phase 4 = 2 sous-domaines indépendants (Documents / Travaux) parallélisables en plans après walking enabler.

### Pratiques UI / UX / Accessibilité (opposables)

- `practices/UI_DESIGN.md` — Gestalt, hiérarchie visuelle (1 dominant/écran : liste filtrée du coffre, ou fiche détail du ticket), color (rouge = corbeille/purger/erreur, ambre = warning rétention, vert = ajout réussi), typography, spacing 8 px, data tables (D-111), feedback states (`<progress>` upload, banniere-success).
- `practices/UX_DESIGN.md` — Hick / Fitts / Miller / Jakob / Doherty, flow & navigation (sidebar ajout "Coffre"), forms (upload = 1 colonne, label-au-dessus, validation au blur ; ticket = 1 page validation au submit), error handling (rejet upload = message explicite + format rappelé), empty states (D-119), affordance (boutons distincts visuellement), cognitive load (filtres facettés vs recherche libre = 2 modes non confondus), trust & transparency (message factuel avant purge).
- `practices/ACCESSIBILITY.md` — WCAG 2.1 AA : POUR principles, contrast 4.5:1, keyboard nav (upload tabulable, liste filtrable au clavier, confirm dialogs focusables), semantic HTML, ARIA sparingly (`aria-live` pour "Upload réussi" / "Restauration effectuée"), forms (input file label explicite + formats listés), tables, `prefers-reduced-motion`, testing checklist.

### Risques & contraintes

- `RISKS.md` — registre pertinent Phase 4 :
  - **R1.1** (surveillance fiscale annuelle) — `TypeJustificatif` (D-104) revue chaque janvier.
  - **R3.1** (backup/restore) — **directement pertinent** : `documents/justificatifs/` doit être inclus dans tout futur backup (phase BAK). Perte d'un fichier = perte de preuve fiscale 10 ans → criticité maximale.
  - **R4.3** (pédagogie fiscale) — D-109 message blocage purge explique la raison légale (factuel, non paternaliste).
  - **R5.1** (maintenance règles fiscales) — `TypeJustificatif` versionnée.
- `CLAUDE.md` — règles non négociables projet (V1 LMNP meublé, audit-friendly, hors périmètre), §Documentation hygiene (doc commitée avec le code dans la même PR).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phases 1-3)

- **`src/domain/_shared/identifiants.ts`** — Brand types. **À étendre** Phase 4 avec `JustificatifId`, `TicketTravauxId` + générateurs `nouveauJustificatifId()`, `nouveauTicketTravauxId()`. Également `CheminRelatif` brand type pour le retour de `StockageJustificatifs.ecrire()`.
- **`src/domain/_shared/erreurs.ts`** — `InvariantViolated`. Réutilisé tel quel pour les invariants Phase 4 (au moins bienId OU locataireId, MIME accepté, format autorisé, rétention 10 ans).
- **`src/domain/_shared/clock.ts`** — port `Clock`. Indispensable Phase 4 pour rétention 10 ans (D-109) et année fiscale dérivée (D-107).
- **`src/domain/_shared/money.ts`** — VO Money BigInt centimes. Réutilisé tel quel pour `Justificatif.montantTtc`, `TicketTravaux.coutEstimeTtc`, `coutReelTtc`.
- **`src/domain/patrimoine/bien.ts`** + `bien-repository.ts` — Lecture seule Phase 4 (vérifier existence du bien lors création ticket / rattachement justificatif). Pas de modification.
- **`src/domain/locatif/locataire.ts`** — Lecture seule Phase 4 (vérifier existence pour rattachement).
- **`src/infrastructure/storage/stockage-fichier-local.ts`** — **pattern de référence à reproduire**. Le mécanisme anti-path-traversal (WR-03) est éprouvé et doit être porté tel quel dans `StockageJustificatifsLocal` (nouveau fichier `src/infrastructure/storage/stockage-justificatifs-local.ts`).
- **`src/infrastructure/db/database.ts`** — `ConnexionDb`. Réutilisé pour les nouvelles tables.
- **`src/infrastructure/repositories/quittance-repository-sqlite.ts`** — pattern référence pour `JustificatifRepository` et `TicketTravauxRepository` (versDomaine/versRow, transaction, Money roundtrip, PlainDate roundtrip).
- **`src/web/views/partials/`** — partials Phase 1/2/3 (form-field, data-table, confirm-dialog, sidebar-nav, breadcrumbs, empty-state, banniere-success). **Réutilisés** sur `/coffre`, `/coffre/corbeille`, `/biens/:id/travaux`, `/travaux/:id`, formulaire upload.
- **`src/helpers/format-*.ts`** — helpers existants. **À étendre** avec `formaterTypeJustificatif`, `formaterStatutTicket`, `formaterTailleFichier`, `formaterAnneeFiscale` (cf. DP-25).

### Established Patterns (Phases 1-3)

- **Hexagonal strict** : `domain/documents/justificatif.ts`, `domain/travaux/ticket-travaux.ts` (nouveaux dossiers) **sans aucun import technique**. Vérifié par dependency-cruiser (ajouter règles : `documents` peut dépendre de `_shared` + référencer `BienId`/`LocataireId` ; `travaux` peut dépendre de `_shared` + référencer `BienId` + le port `JustificatifRepository` pour le use case "ajouter PJ").
- **Factory + InvariantViolated** : `Justificatif.creer(props)` valide ≥1 de bienId/locataireId non-null, MIME ∈ {pdf, jpeg, png, webp} (après conversion HEIC), `tailleOctets > 0` et `<= 50 * 1024 * 1024`. `TicketTravaux.creer(props)` valide `titre` non vide, `dateOuverture <= today`, `bienId` fourni.
- **Brand types** : `JustificatifId`, `TicketTravauxId`, `CheminRelatif`.
- **Builders** : `unJustificatifValide`, `unJustificatifAvecBienSeul`, `unJustificatifAvecLocataireSeul`, `unJustificatifEnCorbeille`, `unTicketTravauxValide`, `unTicketTravauxClos` dans `tests/_builders/`.
- **TDD outside-in** : chaque plan d'exécution démarre par BDD Cucumber `@phase4` rouge → tests unit/integration rouges → green.
- **Repository pattern** : `versDomaine(row)` + `versRow(entity)` + `transaction()` lors d'opérations multi-table. Use case `UploaderJustificatif` = transaction (insert `justificatifs` + écriture fichier physique via `StockageJustificatifs`) avec compensation en cas d'échec écriture disque.
- **Use cases multi-repos** :
  - `UploaderJustificatif(BienRepository | LocataireRepository, JustificatifRepository, StockageJustificatifs, ConvertisseurImage, Clock, MagicBytesValidator)`.
  - `CreerTicketTravaux(BienRepository, TicketTravauxRepository, Clock)`.
  - `AjouterPJTicket(TicketTravauxRepository, JustificatifRepository)` (relation N:N via `ticket_justificatifs`).
  - `MettreJustificatifEnCorbeille`, `RestaurerJustificatif`, `PurgerJustificatif` (cette dernière utilise `Clock` pour `peutEtrePurge(today)`).
- **Migration SQLite** : fichier `0004_phase4_*.sql` exécuté via `sqlite.exec()` (DP-23).
- **Money roundtrip SQLite** : `Number(money.toCentimes())` écriture, `Money.fromCentimes(BigInt(row.x))` lecture (`montant_ttc_centimes`, `cout_estime_ttc_centimes`, `cout_reel_ttc_centimes`).
- **Temporal.PlainDate roundtrip** : `.toString()` (TEXT ISO) écriture, `Temporal.PlainDate.from(row.x)` lecture (`date_document`, `cree_le`, `corbeille_le`, `date_ouverture`, `date_cloture`).
- **Soft-delete pattern** : `corbeille_le` + `raison_corbeille` (Justificatif) — variation du pattern Phase 2 (`annule_le` + `raison_annulation`). `annule_le` réutilisé tel quel pour `TicketTravaux`.
- **Schema Zod + fastify-type-provider-zod** : nouveaux fichiers `justificatif-schemas.ts`, `ticket-travaux-schemas.ts`. Validation upload multipart via `@fastify/multipart`.
- **Layout EJS split** : `layout-debut.ejs` + `layout-fin.ejs` réutilisés.
- **preHandler pure** : helpers de format injectés ; pas d'état stateful.

### Integration Points

- **Sidebar nav** (`src/web/views/partials/sidebar-nav.ejs`) — ajouter entrée "Coffre documentaire" en niveau racine (positionnement à arbitrer planner). Lien "Travaux" sur la fiche `Bien` (contextuel — pas en sidebar racine).
- **Fiche Bien** (`src/web/views/pages/biens/[id].ejs`) — ajouter sections "Documents" (N justificatifs rattachés, lien vers coffre filtré) et "Travaux" (N tickets, lien vers `/biens/:id/travaux` + CTA "Nouveau ticket").
- **Fiche Locataire** (`src/web/views/pages/locataires/[id].ejs`) — ajouter section "Documents" (justificatifs rattachés filtrables par `type ∈ {piece_locataire, releve_bancaire, attestation, autre}` — cf. D-120).
- **Pas de section "Documents générés"** sur la fiche `Bail` Phase 4 (vue agrégée différée Phase 7 — cf. D-111).
- **Multipart Fastify** — ajouter `@fastify/multipart` dans `package.json`. Limit `fileSize: 50 * 1024 * 1024` matérialise D-105. Configurer dans le plugin Fastify principal.
- **Migration SQLite** — `0004_phase4_documents_travaux.sql` (DP-23) crée 3 tables (`justificatifs`, `tickets_travaux`, `ticket_justificatifs`) + index. Phase 4 purement additive (pas d'ALTER sur tables existantes).
- **Dependency-cruiser** — ajouter règles :
  - `domain/documents/*` ne peut dépendre que de `domain/_shared/*` + types `BienId` / `LocataireId`.
  - `domain/travaux/*` peut dépendre de `domain/_shared/*` + `BienId` + le port `JustificatifRepository` (port uniquement, jamais adapter).
  - `infrastructure/storage/stockage-justificatifs-local.ts` peut dépendre du port `StockageJustificatifs` et de Node `fs/promises`.
  - `infrastructure/image/convertisseur-image-*.ts` peut dépendre du port `ConvertisseurImage` et de `sharp` (ou autre lib HEIC).

</code_context>

<specifics>
## Specific Ideas

- **Nouveau port `StockageJustificatifs` dédié** (D-106) explicitement préféré à l'extension de `StockageFichierLocal` Phase 2 — séparation stricte par bounded context (DDD pur). L'anti-path-traversal de Phase 2 est porté (copié) dans l'adapter local du nouveau port, pas partagé via héritage.
- **Nouveau port `ConvertisseurImage`** (D-105) pour la conversion HEIC → JPEG — domaine ignore la lib (`sharp` ou `heif-converter`), adapter d'infra isolé. Même discipline d'isolation que `StockageJustificatifs`.
- **Pattern soft-delete** (`corbeille_le` + `raison_corbeille` pour Justificatif, `annule_le` pour TicketTravaux) — variation du pattern Phase 2.
- **Pattern enum versionné LF annuelle** (D-77 Phase 3) appliqué à `TypeJustificatif` (D-104) — surveillance R1.1.
- **Pas de champ `nature` sur TicketTravaux** (D-115) — la qualification fiscale arrivera Phase 5 via un VO dans BC `Fiscalité`, sans toucher la table `tickets_travaux`. DDD strict : chaque BC porte son langage. Le coût de "re-saisie" est nul puisque Phase 5 calcule des défauts heuristiques.
- **Rattachement polymorphique 2 FK nullables + invariant** (D-103) choisi vs N:N pivot — simplicité V1, couvre 100 % des cas DOC-01. N:N copro = déféré V1.1+.
- **Vue agrégée des documents générés différée Phase 7** (D-111) — vertical-slice + YAGNI. La Phase 4 livre uniquement le coffre des uploads. Le dashboard Phase 7 fera l'agrégation propre (quittances + avis + avenants + uploads par année / par bien).
- **Hard-block sur purge avant 10 ans + soft-delete réversible** (D-109) — protection juridique du bailleur + audit-friendly.
- **Magic-bytes + MIME header croisés côté serveur** (D-118) — OWASP A04:2021. Magic gagne en cas de conflit.
- **Visualisation `<a target="_blank">`** (D-117) — visualiseur natif du navigateur, audit-friendly (fichier identique au persisté), zero JS custom, a11y mature.
- **Drag&drop + multi-upload V2 priorité HAUTE** — explicitement flaggé par l'utilisateur en batch 4. À surveiller dès qu'un signal d'usage le justifie (mass upload de scans, bailleur scannant 1 année d'un coup).

</specifics>

<deferred>
## Deferred Ideas

Idées soulevées pendant l'analyse qui n'entrent pas dans le périmètre Phase 4. Ne pas perdre.

### V1.1 / V1.x

- **OCR / extraction de données** (ExtractionOCR PROJECT.md) — lecture automatique TVA / fournisseur / montant. V1.1+ une fois le volume justifie l'effort.
- **Catégorisation automatique** (règles ou ML léger) sur libellé + nom fichier + OCR. V1.1+.
- **Fusion auto multi-pages PDF** (plusieurs JPG → 1 PDF). V1.1+.
- **Rattachement multi-Lots / copropriété** (facture copro ventilée par lot avec quote-part). V1.1+.
- **Override utilisateur des libellés et types** (admin UI pour ajouter un `TypeJustificatif`). V1.x (cohérent D-100 Phase 3).
- **Dépenses récurrentes** (assurance annuelle, taxe foncière, frais bancaires) avec génération auto d'un Justificatif "attendu" + relance saisie. V1.1+.

### V2

- **Drag&drop + multi-upload** — **PRIORITÉ HAUTE V2** (utilisateur l'a explicitement flaggé). Sélection multiple via `<input multiple>` ou drag&drop avec progression par fichier + gestion d'échec partiel. À planifier dès Phase V2.
- **Recherche full-text dans le contenu des PDFs** (FTS5 + texte extrait OCR). Conjoint avec OCR.
- **Recherche par tags libres** (folksonomy au lieu d'enum fixe).
- **Discrimination de rétention par type** (ex: ticket_caisse 6 ans, releve_bancaire 6 ans, facture/bail/diagnostic 10 ans). V1 = uniformément 10 ans.
- **Agrégat `Fournisseur` / artisan** avec historique des factures par fournisseur (CRM léger bailleur).
- **Sous-agrégat structuré `DossierCandidat`** (catégories CAF / garant / assurance) couplé à un workflow de sélection candidat (V2 ROADMAP).
- **Sync cloud / backup automatique** (Dropbox, Google Drive, S3). Phase BAK dédiée.
- **Workflow d'approbation / signature électronique** sur les Justificatifs. V2 ou jamais (incompatible mono-user).
- **Iframe PDF inline ou thumbnails serveur** (D-117 v1 abandonnée) si un signal d'usage le justifie (mauvaise UX du nouvel onglet sur certains workflows).
- **Conversion d'autres formats exotiques** (TIFF, DOCX, ODT) — V1 ne supporte que PDF/JPG/PNG/HEIC/WebP.

### Phase 5

- **Qualification fiscale des charges** via un VO `CategorisationFiscaleTravaux` (et équivalent pour Justificatifs de type `facture`) dans le BC `Fiscalité`. Référence `TicketTravauxId` / `JustificatifId` par identifiant — aucune modification de `tickets_travaux` ni `justificatifs`. Phase 5 calcule des défauts heuristiques (libellé + montant + type) pour proposer une catégorisation (charge courante déductible / charge à amortir par composant / non déductible).
- **Agrégation recettes + charges Phase 5** : lit les `Encaissement`s (Phase 2) + les `Justificatif`s de type `facture` + les `TicketTravaux` (avec `coutReelTtc`) par année fiscale et par bien.

### Phase 7

- **Vue agrégée des documents générés** (`/coffre/generes` ou intégrée au Dashboard) — quittances, avis échéance, avenants IRL, futures mises en demeure, exposés par année / par bien / par locataire dans une vue read-model unique. D-111 a explicitement reporté ce besoin Phase 7.
- **Notifications J-30 / J-7** sur l'expiration des Justificatifs proche de 10 ans ("le document {titre} pourra être purgé dans 30 jours").
- **Dashboard "tickets travaux en cours" cross-Bien.**
- **Dashboard "documents par bien / par année"** avec totaux (nombre, somme montants TTC).
- **Statistiques de purge** (combien de docs purgés cette année, espace disque libéré).

### Phase BAK (future, non roadmappée V1)

- **Backup automatique** du dossier `~/.../gestion-locative/documents/` (incluant `quittances/`, `avis-echeance/`, `relances-pdf/`, `avenants/`, **`justificatifs/`** ajouté Phase 4) + dump SQLite. Externalisation utilisateur (clé USB, NAS, cloud). Le périmètre du backup doit explicitement inclure `documents/justificatifs/`.

</deferred>

---

*Phase: 4-Coffre documentaire & Travaux*
*Context gathered: 2026-05-18*
*16 gray areas arbitrées en discussion interactive (4 batches AskUserQuestion). Cf. `04-DISCUSSION-LOG.md` pour la chronologie.*

# Phase 4: Coffre documentaire & Travaux - Context

**Gathered:** 2026-05-18
**Status:** Ready for planning
**Note:** Discussion conduite en mode auto-spirit (instruction utilisateur "work without stopping for clarifying questions"). Chaque gray area a été résolue par le choix raisonnable par défaut, documenté ci-dessous avec sa justification. À ré-arbitrer en `gsd-plan-phase` ou ici si l'utilisateur veut challenger.

<domain>
## Phase Boundary

La Phase 4 livre **deux capacités complémentaires** sur le périmètre administratif du bailleur LMNP :

1. **Coffre documentaire (DOC-01, DOC-02, DOC-03)** — l'utilisateur upload des `Justificatif`s (factures, tickets de caisse, baux signés scannés, EDL papier signés, diagnostics PDF émis par un pro, attestations), les rattache à un `Bien` et/ou un `Locataire`, les retrouve par `Bien` / `Locataire` / année fiscale, et le système garantit une rétention de **10 ans** (durée légale de prescription en matière fiscale, art. L169 LPF pour exercices déficitaires + art. L102 B LPF pour pièces comptables).
2. **Tickets travaux / incidents (INC-01)** — l'utilisateur crée un `TicketTravaux` rattaché à un `Bien` avec un coût, une description, un statut, et au moins une pièce jointe (devis ou facture) qui devient un `Justificatif` du coffre.

**REQs couverts (4)** : DOC-01 (upload + rattachement), DOC-02 (recherche par Bien/Locataire/année), DOC-03 (rétention 10 ans), INC-01 (ticket avec PJ + coût).

**Bounded contexts touchés** :
- **Nouveau BC `Documents`** (cf. PROJECT.md §Bounded contexts) — agrégat racine `Justificatif`. Adapter de stockage : extension de `StockageFichierLocal` (Phase 2 D-63) avec nouveaux sous-dossiers (`justificatifs/`, `travaux/`).
- **Nouveau BC `Travaux`** (n'existait pas dans la table PROJECT.md — à ajouter en passing) OU **rattachement à `Patrimoine`** comme sous-agrégat de `Bien`. **Décision D-105** : agrégat séparé `TicketTravaux` dans **nouveau BC `Travaux`**, référence le `BienId` par identifiant (pas inclusion). Justification : cycle de vie indépendant du `Bien`, liste cross-Bien attendue Phase 7 (Dashboard), historique long terme distinct des invariants patrimoniaux.
- **Pas de modification** des BC existants (Patrimoine, Locatif, Encaissements) — Phase 4 est purement additive.

**Strictement hors périmètre Phase 4** (rappels — ne pas attraper en scope creep) :
- **OCR / extraction automatique** (lecture de la TVA d'une facture, du nom du fournisseur, du montant) → V1.1+ (cf. ExtractionOCR mentionné PROJECT.md mais non scopé V1).
- **Catégorisation automatique** par règles ou ML → V1.1+. V1 = saisie utilisateur (enum fixe).
- **Tags libres** (folksonomy) → V2.
- **Recherche full-text dans le contenu des PDFs** → V2 (FTS5 sur métadonnées seulement V1).
- **Devis et facturation sortants** (générer un devis travaux à signer par un artisan) → hors périmètre LMNP V1 ; le bailleur reçoit des devis, il n'en émet pas.
- **Workflow d'approbation / signature électronique** → V2.
- **Sync cloud / backup automatique** (Dropbox, S3, GCS) → V2 (R3.1 RISKS.md, mais pas dans Phase 4 — viendra avec une phase BAK).
- **Notifications J-30 / J-7** sur l'expiration d'un Justificatif (ex: facture < 10 ans à archiver) → Phase 7.
- **Catégorisation fiscale des charges** (charges déductibles régime réel : amortissables, courantes, foncières, financières) → Phase 5. Phase 4 = stocker, indexer, retrouver. Phase 5 = qualifier fiscalement.
- **Agrégation cross-Bien dans une vue dashboard** → Phase 7.
- **Rattachement multi-Lots** (factures de copropriété ventilées par lot) → V1.1+. V1 = rattachement Bien uniquement.
- **Multi-bailleur, SCI, gestion déléguée** → jamais (V1 mono-user).
- **Pièces administratives du Locataire** (CNI, fiche de paie, contrat de travail, avis d'imposition) — bien que mentionnées Phase 1 (différées Phase 4 cf. note REQ LOC-01), elles entrent **partiellement** dans Phase 4 : un `Justificatif` peut être rattaché à un `Locataire` (DOC-01 explicite). Mais la **structuration dossier locataire** (catégories CAF, garant, assurance) reste légère V1 (enum simple). Cf. D-110.
- **Saisie d'une dépense récurrente** (assurance annuelle, taxe foncière, frais bancaires) avec récurrence automatique → V1.1+. V1 = 1 dépense = 1 ticket OU 1 justificatif manuel.
- **Comptabilisation en partie double** des dépenses → Phase 5.

</domain>

<decisions>
## Implementation Decisions

### Décisions verrouillées en amont (PROJECT.md / ROADMAP.md / Phases 1-3 — non rediscutées)

- **DV-01 → DV-07** (PROJECT.md) : LMNP location meublée longue durée uniquement, local-first SQLite, DDD hexagonal strict (domaine pur), ubiquitous language français, BDD outside-in 100% couverture fiscale, MVP vertical slices, 6 bounded contexts.
- **D-01 → D-27** (Phase 1 — `01-CONTEXT.md`) : Stack TS strict + Node 22 LTS + Fastify + EJS + better-sqlite3 + Kysely + Vitest + Cucumber + fast-check + Money bigint cents + Temporal API + Zod + pdfmake + Pico.css + ESLint + Prettier + dependency-cruiser + pnpm + pino + tsx + Mise.
- **D-28 → D-50** (Phase 1) : Périmètre entités Bien/Lot/Locataire/Bail figé ; standards UI/UX/A11y opposables (WCAG 2.1 AA, 1 dominant/écran, spacing 8 px, forms 1 colonne label-au-dessus + validation au blur, destructive = confirmation).
- **D-51 → D-74** (Phase 2 — `02-CONTEXT.md`) : `Bail.actif_depuis`, `Bail.jour_echeance` (1..28), `EcheanceLoyer` snapshot complet, soft-delete + compensateur, Quittance numérotée AAAA-NNN, Bailleur singleton mono-user. **D-63 stockage fichiers PDF local** dans `~/.../gestion-locative/documents/{type}/{annee}/...` → **directement réutilisé Phase 4**.
- **D-75 → D-101** (Phase 3 — `03-CONTEXT.md`) : Diagnostics sous-agrégat Bien, EDL agrégat avec discriminant entrée/sortie, IRL workflow 5 étapes, gel DPE F/G blocage dur, checklist mobilier 12 items, **PDF avenant IRL stocké `documents/avenants/{annee}/`** → cohérent extension Phase 4.
- **Patterns Phase 1-2-3 à rejouer Phase 4** : factory `X.creer()` + `InvariantViolated`, brand types pour identifiants, builders `tests/_builders/`, TDD outside-in (BDD rouge → tests unit/integration rouges → green), repository `versDomaine`/`versRow` + `transaction()`, use case multi-repos pour cross-aggregate, EJS layout split `debut`/`fin`, partials configurables via `locals`, preHandler limité aux helpers pure, Money INTEGER cents (BigInt domaine), Temporal.PlainDate ↔ TEXT ISO, JSON inline pour VOs imbriqués, soft-delete avec `annule_le` + `raison_annulation`.

### Modèle Justificatif (DOC-01)

- **D-102** : **`Justificatif` = agrégat racine du nouveau BC `Documents`** (entité avec identité propre `JustificatifId`, persistance dédiée table `justificatifs`, `JustificatifRepository`). Pas un sous-agrégat — cycle de vie indépendant, requêtable cross-Bien et cross-Locataire, retention propre.
- **D-103** : **Rattachement polymorphique optionnel via 2 FK nullables** : `Justificatif { bienId: BienId | null, locataireId: LocataireId | null, ... }`. Invariant : **au moins l'un des deux** non null. Cas typiques :
  - Facture travaux d'un appartement → `bienId` seul.
  - CNI ou fiche de paie d'un candidat locataire → `locataireId` seul.
  - Bail signé scanné → les deux remplis (bail = Bien × Locataire).
  - Cas N:N (factures de copropriété ventilées par lot) → **V1.1+** (déféré). V1 = 1 rattachement principal.
- **D-104** : **Catégorisation par enum fixe** versionnable LF annuelle (cohérent D-77 Phase 3) :
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
  Constante `LABELS_TYPE_JUSTIFICATIF: Record<TypeJustificatif, string>` pour l'affichage. **Tags libres = V2**.
- **D-105** : **Champ `dateDocument: Temporal.PlainDate` obligatoire** (= date d'émission de la facture, du ticket, de signature du bail, etc., saisie par l'utilisateur — pas la date d'upload). L'**année fiscale est dérivée** automatiquement : `anneeFiscale = dateDocument.year` (pour LMNP, l'exercice fiscal est l'année civile par défaut — pas de comptabilité décalée). Pas de champ stocké : recalcul à la lecture / index SQLite sur `date_document`. Méthode `Justificatif.anneeFiscale(): number` exposée pour DOC-02.
- **D-106** : **Champs métier du `Justificatif`** :
  ```
  Justificatif {
    id: JustificatifId,
    type: TypeJustificatif,
    dateDocument: Temporal.PlainDate,
    titre: string,                  // libellé court (ex: "Facture peinture Phase 4 - Repeindre salon")
    montantTtc: Money | null,       // optionnel (un bail signé n'a pas de montant)
    cheminFichier: string,          // chemin relatif retourné par StockageFichierLocal
    nomFichierOriginal: string,     // nom d'origine côté user (ex: "facture_durand.pdf")
    mimeType: 'application/pdf' | 'image/jpeg' | 'image/png',
    tailleOctets: number,           // pour gardes (limite 20 Mo) et stats
    bienId: BienId | null,
    locataireId: LocataireId | null,
    notes: string | null,           // note libre utilisateur (recherche LIKE V1)
    cree_le: Temporal.PlainDate,
    corbeille_le: Temporal.PlainDate | null,  // soft-delete (cf. D-109)
    raison_corbeille: string | null,
  }
  ```
- **D-107** : **Formats acceptés V1 : PDF, JPG, PNG**. Pas de fusion auto multi-pages (= V1.1+). Pas de conversion HEIC (= V2 — l'utilisateur convertit avant upload). Validation MIME côté HTTP via Zod + magic-bytes (vérifie que le PDF commence par `%PDF-`, JPG par `\xFF\xD8`, PNG par `\x89PNG`) pour bloquer les fichiers déguisés (sécurité — protection contre upload d'exécutable renommé). **Taille max 20 Mo par fichier** (Phase 4) — au-delà = rejet HTTP 413 avec message clair. La limite agrégée (espace disque total) n'est pas surveillée V1 (mono-user local-first).
- **D-108** : **Stockage extension de `StockageFichierLocal`** (Phase 2 D-63) — ajout de méthodes `ecrireJustificatif(annee, hash, extension, buffer)` et `lireJustificatif(cheminRelatif)`. Chemin : `~/.../gestion-locative/documents/justificatifs/{annee_fiscale}/{justificatifId}-{nomSlug}.{ext}`. Le `justificatifId` dans le nom évite les collisions ; le nom slugifié reste lisible pour le bailleur qui ouvrirait le dossier dans Finder. Réutilise le mécanisme anti-path-traversal déjà testé (WR-03 Phase 2).

### Rétention 10 ans (DOC-03)

- **D-109** : **Soft-delete avec corbeille + hard-block sur purge avant 10 ans**.
  - L'utilisateur peut "supprimer" un `Justificatif` → soft-delete : `corbeille_le` rempli, raison saisie (`raison_corbeille`). Le fichier physique reste sur disque, la row reste en BD.
  - Bouton "Restaurer depuis corbeille" annule le soft-delete (`corbeille_le = null`).
  - Bouton "Purger définitivement" : domain service `Justificatif.peutEtrePurge(today)` retourne `false` si `today < cree_le + 10 ans` → use case **refuse** la purge avec message clair : *"Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date."*. Si `peutEtrePurge() === true`, la purge supprime la row + le fichier physique.
  - **Pas de purge automatique** V1 (pas de cron). L'utilisateur déclenche manuellement chaque purge (audit-friendly — rien de silencieux).
  - Tous les types de `Justificatif` suivent la même règle 10 ans V1 (uniformité — la doctrine LMNP recommande de tout conserver). Discrimination par type (ex: ticket_caisse < 6 ans) = V2 si besoin réel.
- **D-110** : **`dossier_locataire` reste léger V1**. Pas de sous-agrégat séparé : un `Locataire` peut avoir N `Justificatif`s rattachés via `locataireId`, filtrables par `type ∈ {'piece_locataire', 'releve_bancaire', 'autre'}`. La structuration en catégories (justificatif d'identité / revenus / garant / assurance) reste future. V1 = un seul tag enum + notes libres.

### Recherche (DOC-02)

- **D-111** : **Recherche V1 = filtrage SQL LIKE sur métadonnées** (`titre`, `notes`, `nomFichierOriginal`) + **filtres facettés** par `bienId` / `locataireId` / `anneeFiscale` / `type`. Pas de FTS5 V1 (la complexité dépasse le besoin pour un mono-user avec < 10 000 docs typique). Index SQLite sur `bienId`, `locataireId`, `dateDocument`, `type` (composites selon usage). Pagination 20 lignes (= pattern Phase 1 D-41 listings).
- **D-112** : **Page coffre `/coffre`** = page principale du nouveau BC Documents. Sidebar gauche : entrée "Coffre documentaire". Filtres en haut (recherche texte + dropdowns Bien / Locataire / Année / Type). Liste centrale tableau (date | type | titre | bien | locataire | montant | actions). Action "Ouvrir" = télécharge le fichier via `<a href="/justificatifs/:id/fichier" target="_blank">`. Action "Voir détails" = page dédiée avec aperçu (PDF inline via `<iframe>` ou `<img>` pour images, fallback "Ouvrir dans un nouvel onglet"). Action "Supprimer" = soft-delete avec confirmation (pattern D-46 Phase 1 destructive=confirm). Page séparée `/coffre/corbeille` listant les soft-deleted avec actions "Restaurer" / "Purger" (cette dernière conditionnée à D-109).
- **D-113** : **Vue unifiée "tous les documents" incluant les documents générés par l'app** (Quittances Phase 2, Avis d'échéance Phase 2, Avenants IRL Phase 3, futures mises en demeure). Phase 4 livre une **vue dédiée** `/coffre/generes` qui liste ces documents (déjà persistés dans leurs tables propres `quittances`, `avis_echeance`, `bail_indexations`) via une **query d'agrégation read-model** (pas de duplication BD, pas de migration). Schéma : type | date | bien | locataire | montant | lien fichier. **Pas de fusion physique** — chaque type reste dans sa propre table (les use cases d'émission restent inchangés). Le coffre = vue agrégée. Cohérent avec audit-friendly (la quittance reste un livrable Encaissements, le coffre ne fait qu'exposer).

### Tickets travaux (INC-01)

- **D-114** : **`TicketTravaux` = agrégat racine du nouveau BC `Travaux`** (entité avec identité propre `TicketTravauxId`, persistance table `tickets_travaux`, `TicketTravauxRepository`). **Pas** un sous-agrégat de `Bien` — cycle de vie indépendant, requêtable cross-Bien (Phase 7 dashboard), historique long terme distinct.
  ```
  TicketTravaux {
    id: TicketTravauxId,
    bienId: BienId,                  // FK obligatoire
    titre: string,                   // ex: "Remplacement chauffe-eau cuisine"
    description: string,             // texte long
    dateOuverture: Temporal.PlainDate,
    dateCloture: Temporal.PlainDate | null,
    statut: 'ouvert' | 'en_cours' | 'clos' | 'annule',
    coutEstimeTtc: Money | null,     // avant intervention
    coutReelTtc: Money | null,       // après facture
    nature: 'reparation' | 'entretien' | 'amelioration' | 'autre',  // pour Phase 5 (amortissable vs déductible courant)
    notes: string | null,
    cree_le: Temporal.PlainDate,
    annule_le: Temporal.PlainDate | null,  // soft-delete pattern Phase 2
  }
  ```
- **D-115** : **Liaison Ticket ↔ Justificatif via table dédiée `ticket_justificatifs` (N:N)**. Un ticket peut avoir N pièces jointes (devis, plusieurs factures, photos avant/après). Un justificatif **peut** être lié à un ticket (cas devis/facture travaux) mais reste autonome (existence indépendante — peut exister sans ticket). Le justificatif est rattaché au `bienId` (D-103) cohérent avec le ticket. Cascade : suppression d'un ticket ne supprime pas les justificatifs (D-109 protection 10 ans).
- **D-116** : **Workflow ticket** : page `/biens/:id/travaux` (liste des tickets du bien) + page dédiée `/travaux/:id`. Création en 1 page (titre, description, date ouverture, nature, coût estimé) ; les pièces jointes s'ajoutent ensuite via un panneau "Pièces jointes" sur la fiche détail (réutilise le flow upload Justificatif). Clôture = saisie de la date de clôture + coût réel + bouton "Clore". Le statut transite manuellement (pas d'auto).
- **D-117** : **Champ `nature` versionné LF annuelle** (cohérent D-77, D-104). Sert d'**indicateur préparatoire Phase 5** :
  - `'reparation'` / `'entretien'` → typiquement **charge courante déductible** (régime réel).
  - `'amelioration'` → potentiellement **amortissable** (composant).
  - L'utilisateur peut choisir librement V1 (pas de règle dure). Phase 5 utilisera ce champ comme **suggestion** lors de la qualification fiscale, pas comme contrainte.
- **D-118** : **Pas de notion de "fournisseur" / "artisan" V1**. Le nom du fournisseur reste dans le champ `description` ou `notes` du ticket / `titre` du justificatif. Agrégat `Fournisseur` avec historique (utile pour CRM bailleur) = **V2**.

### Catégorisation fiscale (anticipation Phase 5)

- **D-119** : **Phase 4 = stocker + indexer + retrouver. Phase 5 = qualifier fiscalement.** Les `Justificatif`s de type `'facture'` et les `TicketTravaux` seront **scannés Phase 5** par un domain service pour proposer une catégorisation fiscale (charge courante déductible, charge à amortir par composant, charge non déductible). Phase 4 prépare le terrain : `type`, `dateDocument`, `montantTtc`, `bienId`, `nature` (pour ticket), `notes` sont les champs que Phase 5 lira. **Aucune logique fiscale Phase 4** (cohérent vertical-slice).

### A11y et UI (cohérent D-44 → D-50)

- **D-120** : **Upload accessible** : `<input type="file">` natif (pas de drag&drop V1 — drag&drop = V2 avec fallback). Label explicite, message d'erreur côté serveur affiché sous le champ (Zod + Pico.css `aria-invalid="true"`). Indicateur de chargement (`<progress>` natif) pendant l'upload — pas de spinner JS custom (cohérent local-first + sobre). Upload synchrone V1 (un fichier à la fois, redirection après succès). Multi-upload = V2.
- **D-121** : **Lecture PDF accessible** : ouverture en nouvel onglet via `<a target="_blank" rel="noopener">` (le visualiseur PDF natif du navigateur a sa propre a11y). Pas d'iframe PDF inline V1 (problèmes a11y, accessibilité variable selon visualiseur). Pour les images (JPG/PNG), `<img alt="{titre du Justificatif}">` avec alt = libellé saisi.
- **D-122** : **Empty state explicite** : "Aucun justificatif pour ce bien. Commencez par uploader une facture, un bail signé ou un diagnostic." + CTA "Ajouter un document". Pareil pour la corbeille ("Aucun document supprimé.") et les tickets travaux ("Aucun ticket pour ce bien. Le premier ticket sert souvent à tracer la mise en service du logement.").
- **D-123** : **Formats acceptés affichés explicitement** dans le label de l'input ("PDF, JPG, PNG — max 20 Mo"). Erreur Zod si MIME non conforme : "Format non supporté. Acceptés : PDF, JPG, PNG."

### Décisions différées au `gsd-plan-phase 4`

- **DP-21** : Découpage exact des migrations SQLite Phase 4 (recommandation : `0004_phase4_justificatifs.sql` couvrant `justificatifs`, `tickets_travaux`, `ticket_justificatifs` — ou plusieurs migrations atomiques par plan selon le découpage des plans). Inclure index sur `bien_id`, `locataire_id`, `date_document`, `type`, `corbeille_le`.
- **DP-22** : Choix exact des routes Fastify (recommandation : `GET /coffre`, `GET /coffre/corbeille`, `GET /coffre/generes`, `GET/POST /coffre/upload`, `GET /justificatifs/:id`, `GET /justificatifs/:id/fichier`, `POST /justificatifs/:id/corbeille`, `POST /justificatifs/:id/restaurer`, `DELETE /justificatifs/:id`, `GET /biens/:id/travaux`, `GET /travaux/:id`, `POST /biens/:id/travaux`, `POST /travaux/:id/clore`, `POST /travaux/:id/justificatifs`).
- **DP-23** : Choix exact de la librairie validation magic-bytes côté serveur (recommandation : `file-type` npm — pure ESM, déterministe, pas de fork — OU validation maison sur les 8 premiers octets si on veut éviter une dépendance).
- **DP-24** : Choix de la stratégie de hash des fichiers stockés (recommandation : pas de hash — `justificatifId` UUID suffit pour l'unicité ; pas de dédup V1).
- **DP-25** : Helpers EJS Phase 4 (`formaterTypeJustificatif`, `formaterNatureTicket`, `formaterStatutTicket`, `formaterTailleFichier`).
- **DP-26** : Politique exacte de capture du `mimeType` côté HTTP (recommandation : croiser le header `Content-Type` du multipart + magic-bytes ; en cas de conflit, magic-bytes gagne — protection upload renommé).
- **DP-27** : Limite multipart Fastify (recommandation : `@fastify/multipart` avec `limits: { fileSize: 20 * 1024 * 1024 }` pour matérialiser D-107 — rejet côté serveur immédiat sans buffer complet).
- **DP-28** : Format SQL du champ `inventaire` n'est pas concerné (Phase 3) ; pour Phase 4, format Money roundtrip = INTEGER cents (réutilisation Phase 1).
- **DP-29** : Structure des partials EJS Phase 4 (`partial-justificatif-row`, `partial-upload-form`, `partial-ticket-row`, `partial-filters-coffre`).

### Claude's Discretion (à trancher par le planner / executor)

- Convention de nommage exact des routes Fastify Phase 4.
- Choix précis des libellés, placeholders et messages d'erreur.
- Slugification exacte du nom de fichier de stockage (recommandation : slug ASCII alphanumérique + tirets, max 80 caractères, fallback `document` si vide).
- Politique de pagination (recommandation : 20 lignes par défaut, query string `?page=`).
- Convention du nom du fichier d'avenant côté téléchargement (réutilisation `Content-Disposition: attachment; filename="{nomFichierOriginal}"`).
- Layout exact de la sidebar avec ajout entrée "Coffre" (sous Dashboard) et "Travaux" (sous chaque Bien).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (`gsd-phase-researcher`, `gsd-planner`, `gsd-ui-researcher`, `gsd-executor`) MUST read these before planning or implementing.**

### Domaine produit / projet

- `.planning/PROJECT.md` — contraintes verrouillées (audit-friendly, local-first, mono-user), bounded contexts (notamment `Documents` à instancier ici), key decisions, hors-périmètre.
- `.planning/REQUIREMENTS.md` — REQs DOC-01, DOC-02, DOC-03, INC-01 (V1).
- `.planning/ROADMAP.md` §Phase 4 — goal, success criteria, dépendances (Phases 1, 2, 3).
- `VISION.md` — autonomie, sobriété, local-first, single-user, audit-friendly.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD : cible, périmètre MVP, principes UX.

### Phases 1-3 (artefacts à respecter)

- `.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md` — décisions D-01 → D-50 (stack technique, brand types, standards UI/UX/A11y, factory + InvariantViolated, builders, EJS layout, preHandler pure, helpers format).
- `.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md` — patterns établis (Money cents, Temporal roundtrip, JSON inline pour VOs imbriqués, repository transaction, Cucumber/Zod surprises).
- `.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-CONTEXT.md` — **D-63 stockage PDF local `~/.../gestion-locative/documents/{type}/{annee}/...`** (à réutiliser tel quel), **D-73 régénération échéances futures** (pattern de cascade), Bailleur singleton, soft-delete + compensateur.
- `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md` — D-87 PDF EDL = différé Phase 4 (confirme scope Phase 4 vue agrégée des documents générés), D-93 avenants stockés `documents/avenants/{annee}/` (cohérent extension Phase 4 `documents/justificatifs/{annee}/`).
- `src/infrastructure/storage/stockage-fichier-local.ts` — adapter `StockageFichierLocal` à **étendre** (ajout `ecrireJustificatif` / `lireJustificatif`). Mécanisme anti-path-traversal (WR-03) déjà éprouvé — à réutiliser.
- `src/domain/encaissements/quittance.ts` et `src/infrastructure/repositories/quittance-repository-sqlite.ts` — pattern de référence pour le repository `JustificatifRepository`.

### Domaine fiscal / juridique

- `LMNP.md` — base de connaissances fiscale LMNP. Pertinent Phase 4 pour la **rétention 10 ans** (art. L169 LPF exercices déficitaires, art. L102 B LPF pièces comptables) et anticipation Phase 5 (charges déductibles / amortissables — D-117 champ `nature` du ticket).
- `LOCATION_MEUBLEE_REGLES.md` §11 — documents à conserver 10 ans (diagnostics, EDL, avenants, baux). **Fondement direct** de D-109 rétention 10 ans.
- **Art. L102 B LPF (Livre des procédures fiscales)** — obligation de conservation des pièces comptables pendant 6 ans côté commercial, **mais 10 ans en pratique pour le LMNP** (CGI + doctrine BOFIP-BIC-DECLA pour la possibilité de vérification + plus-value LF 2025 qui exige la trace de l'évolution des amortissements).
- **Art. L169 LPF** — prescription du droit de reprise de l'administration fiscale = 3 ans ordinaire mais **10 ans en cas d'omission ou exercice déficitaire** (pertinent LMNP réel souvent déficitaire les premières années).
- **RGPD** — durée de conservation des pièces concernant le `Locataire` : la rétention 10 ans est cohérente avec la durée de prescription comptable, à condition de **purger sur demande** (cf. D-109 purge manuelle après 10 ans). Pas de RGPD explicite V1 — single-user local-first limite l'exposition.

### Pratiques d'ingénierie (opposables)

- `DDD.md` — bounded contexts (instanciation des BC `Documents` et `Travaux`), agrégats racines, ports & adapters, ubiquitous language français, anti-patterns. Le `Justificatif` = agrégat racine du BC Documents ; le `TicketTravaux` = agrégat racine du BC Travaux.
- `BDD_PRACTICES.md` — outside-in, pyramide tests, **cas obligatoires §8** à appliquer Phase 4 : invariant `au moins bienId OU locataireId`, validation magic-bytes (sécurité), rétention 10 ans (blocage purge avant date), soft-delete réversible, vue agrégée `/coffre/generes` (idempotence). Le port `Clock` Phase 1 = indispensable pour les tests de rétention.
- `SOFTWARE_CRAFTSMANSHIP.md` — SOLID, Clean Code, KISS/DRY/YAGNI, **gates CI bloquants §8** : 0 warning, ≥80 % coverage, 100 % logique métier, cyclomatic < 10, suite unitaire < 30 s. La rétention 10 ans = logique réglementaire impérative → 100 % couverture (cas avant, cas après, cas pile, soft-delete, restauration, purge bloquée, purge autorisée).
- `BEHAVIOR.md` — code of conduct par session : posture sceptique, speed levers. Phase 4 = 2 sous-domaines indépendants (Documents / Travaux) parallélisables en plans après le walking enabler.

### Pratiques UI / UX / Accessibilité (opposables)

- `UI_DESIGN.md` — Gestalt, hiérarchie visuelle (1 dominant/écran : la liste filtrée du coffre, ou la fiche détail du ticket), color (rouge = corbeille / purger / erreur, ambre = warning rétention, vert = ajout réussi), typography, spacing 8 px, **data tables** (page coffre + page travaux suivent standards Phase 1 D-41), **feedback states** (upload en cours via `<progress>`, succès via banniere-success existant).
- `UX_DESIGN.md` — Hick / Fitts / Miller / Jakob / Doherty laws, flow & navigation (sidebar gauche fixe — ajout entrée "Coffre" et lien "Travaux" sous chaque Bien), **forms** (upload Justificatif = 1 colonne, label-au-dessus, validation au blur ; ticket = 1 page, validation au submit), **error handling** (rejet upload = message explicite sous le champ + format accepté rappelé), **empty states** (D-122), affordance (boutons "Ouvrir", "Voir détails", "Supprimer", "Restaurer", "Purger" distincts visuellement), cognitive load (filtres facettés vs recherche libre — 2 modes complémentaires non confondus), **trust & transparency** (message explicite avant purge : "Conservation légale jusqu'au {date}").
- `ACCESSIBILITY.md` — WCAG 2.1 AA : POUR principles, contrast 4.5:1, keyboard nav (upload tabulable, liste filtrable au clavier, dialogs confirmation focusables), semantic HTML, ARIA (sparingly — `aria-live` pour le message "Upload réussi" et "Restauration effectuée"), **forms** (input file avec label explicite et formats listés D-123), **tables** (liste coffre, corbeille, tickets travaux), `prefers-reduced-motion` respecté, testing checklist (cf. patterns Phase 1 + a11y audit Phase 3 D-?).

### Risques & contraintes

- `RISKS.md` — registre pertinent Phase 4 :
  - **R1.1** (surveillance fiscale annuelle) — durée rétention D-109 et types Justificatif D-104 doivent être revus annuellement.
  - **R2.1** (alertes échéances) — pas directement pertinent Phase 4 ; Phase 7 ajoutera J-30 / J-7 sur expiration justificatifs si besoin.
  - **R3.1 (backup/restore)** — **directement pertinent** : les fichiers physiques Phase 4 (~/.../documents/justificatifs/) doivent être inclus dans tout futur backup. Documenté ici pour que la future phase BAK n'oublie pas le nouveau sous-dossier. La perte d'un fichier = perte d'une preuve fiscale 10 ans → criticité maximale.
  - **R4.3** (pédagogie fiscale) — D-109 message de blocage purge explicite la raison légale (pas paternaliste, factuel).
  - **R5.1** (maintenance règles fiscales) — la liste `TypeJustificatif` (D-104) et `nature` (D-117) sont versionnées et revues chaque janvier.
- `CLAUDE.md` — règles non négociables projet (V1 LMNP meublé, audit-friendly, hors périmètre), §Documentation hygiene (doc commitée avec le code dans la même PR).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (Phases 1-3)

- **`src/domain/_shared/identifiants.ts`** — Brand types. **À étendre** Phase 4 avec `JustificatifId`, `TicketTravauxId` + leurs générateurs `nouveauJustificatifId()`, `nouveauTicketTravauxId()`.
- **`src/domain/_shared/erreurs.ts`** — `InvariantViolated`. Réutilisé tel quel pour les invariants Phase 4 (au moins bienId OU locataireId, MIME accepté, rétention 10 ans).
- **`src/domain/_shared/clock.ts`** — port `Clock`. Indispensable Phase 4 pour la rétention 10 ans (D-109) et l'année fiscale dérivée (D-105).
- **`src/domain/_shared/money.ts`** — VO Money en BigInt centimes. Réutilisé tel quel pour `Justificatif.montantTtc`, `TicketTravaux.coutEstimeTtc`, `coutReelTtc`.
- **`src/domain/patrimoine/bien.ts`** — Agrégat `Bien`. **Pas de modification Phase 4** (Travaux référence par `BienId` sans inclusion). Lecture seule pour vérifier l'existence du bien lors de la création d'un ticket / rattachement justificatif.
- **`src/domain/patrimoine/bien-repository.ts`** — port. Lecture seule Phase 4 (méthode `chercher(bienId)` existante suffit).
- **`src/domain/locatif/locataire.ts`** — Agrégat `Locataire`. Lecture seule Phase 4 (vérifier existence pour rattachement).
- **`src/infrastructure/storage/stockage-fichier-local.ts`** — adapter `StockageFichierLocal`. **À étendre** : ajout `ecrireJustificatif(annee, justificatifId, slug, ext, buffer)` et `lireJustificatif(cheminRelatif)`. Le mécanisme anti-path-traversal (WR-03) est déjà éprouvé et doit être conservé.
- **`src/infrastructure/db/database.ts`** — `ConnexionDb`. Réutilisé pour les nouvelles tables (`justificatifs`, `tickets_travaux`, `ticket_justificatifs`).
- **`src/infrastructure/repositories/quittance-repository-sqlite.ts`** — pattern de référence pour `JustificatifRepository` (versDomaine/versRow, transaction, Money roundtrip, PlainDate roundtrip).
- **`src/web/views/partials/`** — partials Phase 1/2/3 (form-field, data-table, confirm-dialog, sidebar-nav, breadcrumbs, empty-state, banniere-success). **Réutilisés** pour `/coffre`, `/coffre/corbeille`, `/coffre/generes`, `/biens/:id/travaux`, `/travaux/:id`, `/coffre/upload`.
- **`src/helpers/format-*.ts`** — helpers existants. **À étendre** avec `formaterTypeJustificatif`, `formaterNatureTicket`, `formaterStatutTicket`, `formaterTailleFichier` (octets → "1.2 Mo"), `formaterAnneeFiscale` (DP-25).

### Established Patterns (Phases 1-3)

- **Hexagonal strict** : `domain/documents/justificatif.ts`, `domain/travaux/ticket-travaux.ts` (nouveaux dossiers) sans aucun import technique. Vérifié par dependency-cruiser (ajouter règles : `documents` peut dépendre de `_shared` + référencer `BienId`/`LocataireId` ; `travaux` peut dépendre de `_shared` + référencer `BienId` + repository `JustificatifRepository` pour le use case "ajouter PJ au ticket").
- **Factory + InvariantViolated** : `Justificatif.creer(props)` valide au moins l'un de `bienId`/`locataireId`, MIME accepté, `tailleOctets > 0` et `<= 20*1024*1024`. `TicketTravaux.creer(props)` valide `titre` non vide, `dateOuverture <= today`, `bienId` fourni.
- **Brand types** : `JustificatifId = string & { readonly __brand: 'JustificatifId' }`. Idem `TicketTravauxId`.
- **Builders** : `unJustificatifValide`, `unJustificatifAvecBienSeul`, `unJustificatifAvecLocataireSeul`, `unTicketTravauxValide`, `unTicketTravauxClos` dans `tests/_builders/`.
- **TDD outside-in** : chaque plan exécution démarre par BDD Cucumber `@phase4` rouge puis tests unit/integration rouges, puis vert.
- **Repository pattern** : `versDomaine(row)` + `versRow(entity)` + `transaction()` lors d'opérations multi-table (use case `UploaderJustificatif` : insert `justificatifs` + écriture fichier physique = 1 transaction logique avec compensation en cas d'échec écriture disque).
- **Use case multi-repos** : `UploaderJustificatif(BienRepository | LocataireRepository, JustificatifRepository, StockageFichierLocal, Clock, magicBytesValidator)`. `CreerTicketTravaux(BienRepository, TicketTravauxRepository, Clock)`. `AjouterPJTicket(TicketTravauxRepository, JustificatifRepository)` (relation N:N via table `ticket_justificatifs`).
- **Migration ALTER** : pattern Phase 3 (fichier `0004_phase4_*.sql` exécuté via `sqlite.exec()`).
- **Money roundtrip SQLite** : `Number(money.toCentimes())` écriture, `Money.fromCentimes(BigInt(row.x))` lecture (réutilisé pour `montant_ttc_centimes`, `cout_estime_ttc_centimes`, `cout_reel_ttc_centimes`).
- **Temporal.PlainDate roundtrip** : `.toString()` (TEXT ISO) écriture, `Temporal.PlainDate.from(row.x)` lecture (utilisé pour `date_document`, `cree_le`, `corbeille_le`, `date_ouverture`, `date_cloture`).
- **Soft-delete pattern** : Phase 2 (`annule_le` + `raison_annulation`) → réutilisé pour `corbeille_le` + `raison_corbeille` (Justificatif) et `annule_le` (TicketTravaux).
- **Stockage fichiers PDF local** : `~/.../gestion-locative/documents/{type}/{annee}/...` (D-63 Phase 2) → extension `documents/justificatifs/{annee}/`. **Pas de stockage `documents/tickets/`** : les pièces jointes d'un ticket sont stockées comme `Justificatif` standard (cohérent D-115).
- **Schema Zod + fastify-type-provider-zod** : nouveaux fichiers `justificatif-schemas.ts`, `ticket-travaux-schemas.ts`. Validation upload multipart via `@fastify/multipart`.
- **Layout EJS split** : `layout-debut.ejs` + `layout-fin.ejs` pour toutes les nouvelles pages. Réutiliser tel quel.
- **preHandler pure** : seuls les helpers de format injectés. Toute donnée stateful gérée route par route.

### Integration Points

- **Sidebar nav** (`src/web/views/partials/sidebar-nav.ejs`) — ajouter entrée "Coffre documentaire" en niveau racine (entre "Quittances" et "Dashboard"), avec sous-entrée "Corbeille" et "Documents générés". Ajouter lien "Travaux" sur la fiche `Bien` (pas en sidebar racine — contextuel au bien).
- **Fiche Bien** (`src/web/views/pages/biens/[id].ejs`) — ajouter une section "Documents" (N justificatifs rattachés, lien vers coffre filtré sur ce bien) et "Travaux" (N tickets, lien vers `/biens/:id/travaux` + CTA "Nouveau ticket").
- **Fiche Locataire** (`src/web/views/pages/locataires/[id].ejs`) — ajouter une section "Documents" (N justificatifs rattachés, lien vers coffre filtré sur ce locataire).
- **Fiche Bail** (`src/web/views/pages/baux/[id].ejs`) — ajouter une section "Documents générés" (quittances émises + avis échéance + avenants IRL) liée à `bail_id`. Cette section est une **vue de read-model** (pas de nouveau Justificatif), cohérent D-113.
- **Multipart Fastify** — ajouter `@fastify/multipart` dans `package.json` (= dépendance nouvelle Phase 4). Limit `fileSize: 20 * 1024 * 1024` matérialise D-107. Configurer dans le plugin Fastify principal.
- **Migration SQLite** — fichier `0004_phase4_init.sql` (recommandation DP-21) crée 3 tables (`justificatifs`, `tickets_travaux`, `ticket_justificatifs`) + index. Pas d'ALTER sur tables existantes (Phase 4 = purement additive).
- **Dependency-cruiser** — ajouter règles pour les nouveaux dossiers domain : `documents/*` ne peut dépendre que de `_shared/*` et des types `BienId`/`LocataireId` ; `travaux/*` peut dépendre de `_shared/*`, `BienId`, `JustificatifRepository` (port uniquement, pas d'adapter).

</code_context>

<specifics>
## Specific Ideas

- **Pattern `StockageFichierLocal` Phase 2 (D-63)** explicitement réutilisé pour le stockage des `Justificatif`s — pas de nouvelle abstraction d'I/O, seulement de nouvelles méthodes.
- **Pattern soft-delete Phase 2 (`annule_le` + `raison_annulation`)** explicitement réutilisé pour `corbeille_le` + `raison_corbeille` (D-109) — cohérence des conventions de naming.
- **Pattern enum versionné LF annuelle (D-77 Phase 3)** explicitement appliqué à `TypeJustificatif` (D-104) et `NatureTicket` (D-117) — surveillance R1.1 RISKS.md.
- **Rattachement polymorphique optionnel (D-103)** explicitement choisi (vs N:N pivot table) — simplicité V1, suffit pour les usages identifiés. La N:N (factures de copropriété ventilées) = déféré V1.1+.
- **Vue agrégée des documents générés (D-113)** explicitement choisie plutôt qu'une duplication BD — préserve l'origine des PDFs (Quittance reste un livrable Encaissements) tout en offrant une expérience "coffre unifiée".
- **Tickets travaux = agrégat séparé (D-114)** explicitement choisi (vs sous-agrégat de Bien) — cycle de vie indépendant + dashboard cross-Bien Phase 7.
- **Champ `nature` du ticket dès Phase 4 (D-117)** explicitement ajouté pour préparer Phase 5 — coût de migration moindre maintenant qu'au moment de la qualification fiscale.
- **Hard-block sur purge avant 10 ans + soft-delete réversible (D-109)** explicitement choisi (vs purge libre) — protection juridique du bailleur + audit-friendly (rien de silencieux).
- **Magic-bytes validation côté serveur (D-107)** explicitement ajouté (vs validation MIME seule) — sécurité (upload renommé `.pdf` qui serait un exécutable). Cohérent pratiques OWASP A04:2021 (Insecure Design) sur upload de fichiers.
- **PDF inline = `<a target="_blank">` (D-121)** explicitement choisi (vs `<iframe>` inline) — a11y du visualiseur natif > a11y d'iframe variable.

</specifics>

<deferred>
## Deferred Ideas

Idées soulevées pendant l'analyse qui n'entrent pas dans le périmètre Phase 4. Ne pas perdre.

### V1.1 / V1.x

- **OCR / extraction de données** (ExtractionOCR mentionné PROJECT.md) — lecture automatique de la TVA, du fournisseur, du montant sur une facture. V1.1+ une fois le volume justifie l'effort.
- **Catégorisation automatique** (règles ou ML léger) — sur la base du nom du fichier ou de l'OCR. V1.1+.
- **Multi-upload** (sélection multiple via `<input multiple>` ou drag&drop avec progression par fichier). V1.1+.
- **Fusion auto multi-pages PDF** (uploader plusieurs JPG → 1 PDF). V1.1+.
- **Conversion HEIC → JPG côté serveur** (iPhone photos). V2.
- **Rattachement multi-Lots** (facture de copropriété ventilée par lot avec quote-part). V1.1+.
- **Override utilisateur des libellés et types** (admin UI pour ajouter un `TypeJustificatif`). V1.x cohérent avec D-100 Phase 3 (V1.x pour items inventaire).
- **Dépenses récurrentes** (assurance annuelle, taxe foncière) avec génération auto d'un Justificatif "attendu" + relance saisie. V1.1+.
- **Recherche full-text dans le contenu des PDFs** (FTS5 + texte extrait OCR). V2 conjointement avec OCR.
- **Recherche par tags libres** (folksonomy au lieu d'enum fixe). V2.
- **Agrégat `Fournisseur`** avec historique des factures par fournisseur (CRM léger bailleur). V2.

### V2

- **Discrimination de rétention par type** (ex: ticket_caisse < 6 ans, releve_bancaire 6 ans, facture/bail/diagnostic 10 ans). V2 — V1 = uniformément 10 ans.
- **Sync cloud / backup automatique** (Dropbox, Google Drive, S3). V2 (R3.1 RISKS.md) — viendra avec une phase BAK dédiée.
- **Workflow d'approbation / signature électronique** sur les Justificatifs (utile pour un bailleur particulier mais multi-administrateur — pas single-user). V2 ou jamais (incompatible mono-user).
- **Devis et facturation sortants** (générer un devis travaux à signer par un artisan). Hors périmètre LMNP V1 ; le bailleur reçoit des devis, il n'en émet pas. V2 si besoin.

### Phase 5+

- **Qualification fiscale des charges** (charge courante déductible vs amortissable par composant vs non déductible). Phase 5. Phase 4 prépare via `Justificatif.type` et `TicketTravaux.nature`.
- **Suggestion automatique de catégorie fiscale** sur la base du type + nature + libellé. Phase 5 ou ultérieur.

### Phase 7

- **Notifications J-30 / J-7** sur l'expiration des Justificatifs proche de 10 ans (J-30 = "le document {titre} pourra être purgé dans 30 jours"). Phase 7 (Dashboard & Notifications).
- **Dashboard "documents par bien / par année"** avec totaux (nombre, somme des montants TTC). Phase 7 cross-Bien.
- **Dashboard "tickets travaux en cours"** cross-Bien. Phase 7.
- **Dashboard "tickets travaux par nature"** (préparation amortissement vs charge). Phase 7.

### Phase BAK (future, non roadmappée V1)

- **Backup automatique** du dossier `~/.../gestion-locative/documents/` (incluant les sous-dossiers `quittances/`, `avis-echeance/`, `relances-pdf/`, `avenants/`, **`justificatifs/`** ajouté Phase 4) + dump SQLite. Externalisation utilisateur (clé USB, NAS, cloud). Hors périmètre Phase 4 mais le périmètre du backup doit explicitement inclure `documents/justificatifs/`.

</deferred>

---

*Phase: 4-Coffre documentaire & Travaux*
*Context gathered: 2026-05-18*

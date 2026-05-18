---
phase: 04-coffre-documentaire-travaux
plan: 02
plan_id: 04-02
type: execute
wave: 2
status: planned
created: 2026-05-18
depends_on: ["04-01"]
files_modified:
  # Application
  - src/application/documents/rechercher-justificatifs.ts
  - src/application/documents/lister-corbeille.ts
  - src/application/documents/restaurer-justificatif.ts
  - src/application/documents/purger-justificatif.ts
  - src/application/documents/modifier-justificatif.ts
  - src/application/documents/lister-justificatifs-par-bien.ts
  - src/application/documents/lister-justificatifs-par-locataire.ts
  # Web
  - src/web/routes/coffre.ts
  - src/web/schemas/justificatif-schemas.ts
  - src/web/views/pages/coffre/liste.ejs
  - src/web/views/pages/coffre/corbeille.ejs
  - src/web/views/pages/justificatifs/modifier.ejs
  - src/web/views/partials/partial-filters-coffre.ejs
  - src/web/views/pages/biens/detail.ejs
  - src/web/views/pages/locataires/detail.ejs
  - src/web/routes/biens.ts
  - src/web/routes/locataires.ts
  - src/main.ts
  # Tests
  - tests/bdd/features/coffre.feature
  - tests/bdd/steps/coffre.steps.ts
  - tests/unit/documents/justificatif.test.ts
  - tests/integration/repositories/justificatif-repository-sqlite.test.ts
  - tests/_builders/documents.ts
autonomous: true
requirements: [DOC-01, DOC-02, DOC-03]
user_setup: []
tags: [phase-4, documents, recherche, corbeille, purge, retention-10y, fiches-augmentees]

must_haves:
  truths:
    - "Sur GET /coffre, l'utilisateur peut filtrer par search (LIKE titre/notes/nomFichier), bien, locataire, anneeFiscale, type — 5 filtres simultanés combinables (D-110)"
    - "La pagination affiche 20 lignes par page + URL ?page=N + boutons précédent/suivant + total compte total des matches (DP-28)"
    - "Lien 'Effacer les filtres' visible conditionnellement si au moins un filtre actif"
    - "GET /coffre/corbeille affiche les justificatifs soft-deleted avec colonnes date_corbeille | type | titre | bien | locataire | date_purge_possible | actions (UI-5.1)"
    - "Bouton 'Purger définitivement' est disabled + aria-disabled='true' + title='Disponible le {date}' si today < creeLe + 10 ans (D-109 + UI-5.1)"
    - "POST /justificatifs/:id/purger refuse avec verbatim UI-6.2 'Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date.' si peutEtrePurge=false (D-109)"
    - "POST /justificatifs/:id/restaurer remet corbeille_le=null + bannière 'Document restauré.'"
    - "POST /justificatifs/:id/purger autorisée : hard-delete row + fichier physique si peutEtrePurge=true ; bannière 'Document supprimé définitivement.'"
    - "Sur la fiche Bien (GET /biens/:id), une section 'Documents' affiche les 5 derniers justificatifs rattachés + lien 'Voir tous les documents de ce Bien (N)' → /coffre?bien=:id (UI-5.4)"
    - "Sur la fiche Locataire (GET /locataires/:id), une section 'Documents' avec filtres type ∈ {piece_locataire, releve_bancaire, attestation, autre} + 5 derniers (D-120 + UI-5.4)"
    - "Empty states corrects : coffre filtré vide, corbeille vide, documents Bien/Locataire vides — 4 contextes D-119 verbatim"
    - "GET /justificatifs/:id/modifier permet d'éditer titre, type, dateDocument, montantTtc, notes (champs immutables : fichier, mimeType, tailleOctets, cheminFichier — UI-4.4)"
  artifacts:
    - path: "src/application/documents/purger-justificatif.ts"
      provides: "Use case purge avec gate D-109 hard-block + cleanup fichier"
      contains: "peutEtrePurge"
    - path: "src/web/views/pages/coffre/corbeille.ejs"
      provides: "Vue corbeille avec actions Restaurer + Purger conditionnelle (UI-5.1)"
      contains: "date_purge_possible"
    - path: "src/web/views/pages/justificatifs/modifier.ejs"
      provides: "Form édition metadata (UI-4.4)"
    - path: "src/web/views/partials/partial-filters-coffre.ejs"
      provides: "Form GET filtres facettés (UI-3.2)"
      contains: 'method="GET"'
    - path: "src/web/views/pages/biens/detail.ejs"
      provides: "Section 'Documents' augmentée (UI-5.4)"
      contains: "Documents de ce Bien"
    - path: "src/web/views/pages/locataires/detail.ejs"
      provides: "Section 'Documents' augmentée avec filtre type D-120"
      contains: "piece_locataire"
    - path: "src/application/documents/modifier-justificatif.ts"
      provides: "Use case patch metadata (réutilise factory pour re-valider invariants)"
    - path: "src/application/documents/lister-justificatifs-par-bien.ts"
      provides: "Use case liste 5 derniers + total"
    - path: "src/application/documents/lister-justificatifs-par-locataire.ts"
      provides: "Use case avec filtre type ∈ enum D-120"
  key_links:
    - from: "src/web/views/pages/coffre/liste.ejs"
      to: "src/web/views/partials/partial-filters-coffre.ejs"
      via: "include partial filters"
      pattern: "partial-filters-coffre"
    - from: "src/web/views/pages/coffre/corbeille.ejs"
      to: "POST /justificatifs/:id/purger"
      via: "form action conditionnelle (button disabled si avant 10 ans)"
      pattern: "/justificatifs/.*/purger"
    - from: "src/application/documents/purger-justificatif.ts"
      to: "Justificatif.peutEtrePurge"
      via: "domain gate avant hard-delete"
      pattern: "peutEtrePurge"
    - from: "src/web/views/pages/biens/detail.ejs"
      to: "GET /coffre?bien=:id"
      via: "lien 'Voir tous les documents de ce Bien (N)'"
      pattern: "/coffre\\?bien="
    - from: "src/web/views/pages/locataires/detail.ejs"
      to: "GET /coffre?locataire=:id"
      via: "lien 'Voir tous les documents de ce Locataire'"
      pattern: "/coffre\\?locataire="
    - from: "src/web/routes/biens.ts"
      to: "src/application/documents/lister-justificatifs-par-bien.ts"
      via: "appel use case dans handler GET /biens/:id"
      pattern: "listerJustificatifsParBien"
    - from: "src/web/routes/locataires.ts"
      to: "src/application/documents/lister-justificatifs-par-locataire.ts"
      via: "appel use case dans handler GET /locataires/:id"
      pattern: "listerJustificatifsParLocataire"
---

<objective>
Complète le BC Documents avec **recherche facettée** (DOC-02), **gestion corbeille + purge gate 10 ans** (DOC-03 UX), **édition metadata** (DOC-01 extras), et **fiches augmentées Bien (Documents) + Locataire (Documents D-120)** (UI-5.4).

**Purpose:** Permettre au bailleur de retrouver rapidement n'importe quel document via 5 filtres combinables (search libre + bien + locataire + année fiscale + type), de gérer le cycle de vie soft-delete → restauration → purge avec garde réglementaire 10 ans visible à l'écran, d'éditer les métadonnées sans toucher au fichier physique, et de consulter les justificatifs depuis le contexte d'un Bien ou d'un Locataire.

**Output:**
- 7 nouveaux use cases (rechercher, lister-corbeille, restaurer, purger, modifier, lister-par-bien, lister-par-locataire).
- 6 nouvelles routes (`GET /coffre/corbeille`, `GET /justificatifs/:id/modifier`, `POST /justificatifs/:id/modifier`, `POST /justificatifs/:id/restaurer`, `POST /justificatifs/:id/purger`, **+ branchement** complet des filtres facettés sur `GET /coffre` existant).
- **Note interface stability** : la port `JustificatifRepository` (Wave 1) inclut **déjà** `typeIn?: TypeJustificatif[]` — Wave 2 ne fait que CONSOMMER cette interface, **aucune extension d'interface domain** ici. Le BC Documents reste stable depuis Wave 1.
- 2 nouvelles EJS pages (`coffre/corbeille.ejs`, `justificatifs/modifier.ejs`) + 1 partial (`partial-filters-coffre.ejs`).
- 2 EJS fiches augmentées (`biens/detail.ejs`, `locataires/detail.ejs`).
- 12 scénarios BDD `@phase4` supplémentaires (`@doc-02` + `@doc-03` extras) verts.
- Couverture domain purgerJustificatif = 100 % (logique réglementaire D-109 — 3 cas : pas en corbeille, avant 10 ans, après 10 ans).
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
@practices/BDD_PRACTICES.md
@practices/DDD.md
@practices/SOFTWARE_CRAFTSMANSHIP.md
@practices/UX_DESIGN.md
@practices/ACCESSIBILITY.md

# Source artefacts produits par 04-01 (à respecter)
@src/domain/documents/justificatif.ts
@src/domain/documents/justificatif-repository.ts
@src/domain/documents/stockage-justificatifs.ts
@src/domain/documents/erreurs.ts
@src/application/documents/uploader-justificatif.ts
@src/application/documents/mettre-justificatif-en-corbeille.ts
@src/application/documents/lire-justificatif.ts
@src/infrastructure/repositories/justificatif-repository-sqlite.ts
@src/web/routes/coffre.ts
@src/web/schemas/justificatif-schemas.ts
@src/web/views/pages/coffre/liste.ejs
@src/web/views/pages/coffre/upload.ejs
@src/web/views/pages/justificatifs/detail.ejs
@src/web/views/partials/partial-upload-form.ejs
@src/web/views/partials/partial-justificatif-row.ejs
@src/web/views/partials/partial-justificatif-preview.ejs
@src/web/views/partials/sidebar-nav.ejs
@src/helpers/format-type-justificatif.ts
@src/helpers/format-annee-fiscale.ts
@src/main.ts
@tests/bdd/features/coffre.feature
@tests/bdd/steps/coffre.steps.ts
@tests/_builders/documents.ts

# Source artefacts existants (fiches à augmenter)
@src/web/views/pages/biens/detail.ejs
@src/web/views/pages/locataires/detail.ejs
@src/web/routes/biens.ts
@src/web/routes/locataires.ts

# Analogs pour purge (cleanup transactionnel)
@src/application/encaissements/generer-quittance.ts

<interfaces>
<!-- Contracts ajoutés par CE plan -->

src/application/documents/rechercher-justificatifs.ts :
```typescript
export interface FiltresCoffre {
  search?: string;
  bienId?: BienId | string | null;
  locataireId?: LocataireId | string | null;
  anneeFiscale?: number;
  type?: TypeJustificatif;
  page?: number;
  pageSize?: number;
}

export function rechercherJustificatifs(
  filtres: FiltresCoffre,
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ items: Justificatif[]; total: number; page: number; pageSize: number }>;
```

src/application/documents/purger-justificatif.ts :
```typescript
export function purgerJustificatif(
  cmd: { id: JustificatifId | string },
  deps: { justificatifRepo: JustificatifRepository; stockage: StockageJustificatifs; clock: Clock; db: Kysely<DB> },
): Promise<void>;
// Throws :
//  - JustificatifIntrouvable si lookup échoue
//  - InvariantViolated('Le document n'est pas en corbeille — soft-delete d'abord.') si corbeille_le === null
//  - PurgeAvantDixAnsRefusee (porte datePurgePossible) si peutEtrePurge=false
```

src/application/documents/modifier-justificatif.ts :
```typescript
export interface PatchJustificatif {
  titre?: string;
  type?: TypeJustificatif;
  dateDocument?: Temporal.PlainDate;
  montantTtc?: Money | null;
  notes?: string | null;
}

export function modifierJustificatif(
  cmd: { id: JustificatifId | string; patch: PatchJustificatif },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ justificatif: Justificatif }>;
// Réutilise Justificatif.creer({ ...this.toProps(), ...patch }) — re-valide invariants D-103.
// Champs immuables : cheminFichier, mimeType, tailleOctets, nomFichierOriginal, creeLe, bienId, locataireId.
```

src/application/documents/restaurer-justificatif.ts :
```typescript
export function restaurerJustificatif(
  cmd: { id: JustificatifId | string },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ justificatif: Justificatif }>;
// Throws DocumentNonEnCorbeille si corbeille_le === null
```

src/application/documents/lister-justificatifs-par-bien.ts :
```typescript
export function listerJustificatifsParBien(
  cmd: { bienId: BienId | string; pageSize?: number },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ items: Justificatif[]; total: number }>;
// Default pageSize=5 (section fiche Bien)
```

src/application/documents/lister-justificatifs-par-locataire.ts :
```typescript
export const TYPES_AUTORISES_LOCATAIRE: TypeJustificatif[] =
  ['piece_locataire', 'releve_bancaire', 'attestation', 'autre'];

export function listerJustificatifsParLocataire(
  cmd: { locataireId: LocataireId | string; type?: TypeJustificatif; pageSize?: number },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ items: Justificatif[]; total: number }>;
// Si type fourni : doit être dans TYPES_AUTORISES_LOCATAIRE (sinon throw InvariantViolated). D-120.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 — RED: BDD @doc-02 + @doc-03 extras + unit/integration tests</name>
  <files>
    tests/bdd/features/coffre.feature,
    tests/bdd/steps/coffre.steps.ts,
    tests/unit/documents/justificatif.test.ts,
    tests/integration/repositories/justificatif-repository-sqlite.test.ts,
    tests/_builders/documents.ts
  </files>
  <behavior>
    Nouveaux scénarios `@phase4` (12 au total) :

    **@doc-02 (recherche)** :
    1. Recherche LIKE sur titre — 3 justificatifs avec titres distincts ("Facture peinture salon", "Bail signé locataire X", "Diagnostic gaz") → GET /coffre?search=peinture → 1 résultat.
    2. Recherche LIKE sur notes — search="urgence" matche un justificatif dont notes="Travaux d'urgence" → 1 résultat.
    3. Recherche LIKE sur nomFichierOriginal — search="2026-04" matche `facture-2026-04-15.pdf`.
    4. Filtre facetté bienId isolé — 2 biens, 4 justificatifs (2/bien), GET /coffre?bien=:id1 → 2 résultats du bon bien.
    5. Filtre combiné bien + type — GET /coffre?bien=:id&type=facture → intersection stricte (justificatifs facture rattachés au bien).
    6. Filtre anneeFiscale — justificatifs dateDocument 2025-12-31, 2026-01-01, 2026-12-31 → GET /coffre?annee=2026 → 2 résultats.
    7. Pagination — créer 25 justificatifs, GET /coffre?page=1 → 20 items + total=25 dans le body ; GET /coffre?page=2 → 5 items.
    8. Empty state filtré — GET /coffre?type=ticket_caisse sans data → "Aucun document ne correspond à ces filtres." + lien "Effacer les filtres".
    9. Section Documents fiche Bien — créer Bien + 7 justificatifs rattachés (mix types) → GET /biens/:id → section "Documents" affiche 5 derniers (ORDER BY dateDocument DESC) + lien "Voir tous les documents de ce Bien (7)" → /coffre?bien=:id.
    10. Section Documents fiche Locataire (D-120) — créer Locataire + 5 justificatifs (1 piece_locataire, 1 releve_bancaire, 1 attestation, 1 autre, **1 facture qui NE doit PAS apparaître par défaut**) → GET /locataires/:id → section "Documents" affiche les 4 autorisés. Vérifier que les 4 types autorisés sont listés en dropdown filtre + que "facture" n'apparaît PAS dans les options du filtre.

    **@doc-03 (corbeille + purge UX)** :
    11. Soft-delete + affichage corbeille — POST /justificatifs/:id/corbeille (déjà couvert wave 1) → GET /coffre/corbeille affiche le justificatif avec colonne date_purge_possible = creeLe + 10 ans formaté FR (ex: "18/05/2036").
    12. Purge bloquée avant 10 ans — Clock fige today=2026-05-18, justificatif creeLe=2026-05-18, POST /justificatifs/:id/purger → status 200 (re-render corbeille avec bannière warning) + verbatim "Conservation légale obligatoire jusqu'au 18/05/2036. Vous pourrez purger ce document à partir de cette date." + row toujours en BD + fichier toujours sur disque.
    13. Purge autorisée à 10 ans pile — Clock fige today=2036-05-18, justificatif creeLe=2026-05-18 (soft-delete préalable) → POST /justificatifs/:id/purger → 302 redirect /coffre/corbeille + bannière "Document supprimé définitivement." + 0 row en BD + 0 fichier sur disque.
    14. Restaurer — POST /justificatifs/:id/restaurer → 302 + bannière "Document restauré." + corbeille_le=NULL en BD.
    15. Modifier metadata — POST /justificatifs/:id/modifier titre="Nouveau titre" + notes="Nouvelles notes" + montantTtcCentimes=15000 → 302 + bannière "Document mis à jour." + row : titre/notes/montant_ttc_centimes modifiés MAIS chemin_fichier/mime_type/taille_octets/nom_fichier_original/cree_le inchangés.

    **Unit `justificatif.test.ts` (extras)** :
    - restaurer() happy path (instance avec corbeille_le rempli → restaurer → corbeille_le=null).
    - restaurer() throw DocumentNonEnCorbeille si déjà restauré.
    - peutEtrePurge(today) : 3 cas explicites — today = creeLe.add({years:10}).subtract({days:1}) → false ; today = creeLe.add({years:10}) → true ; today = creeLe.add({years:10}).add({days:1}) → true.
    - Modifier via creer({...this.toProps(), titre:'X'}) reste valid si invariants respectés ; throw si tentative de mettre bienId=null ET locataireId=null en patch (re-validation D-103).

    **Integration `justificatif-repository-sqlite.test.ts` (extras)** :
    - rechercher LIKE case-insensitive sur titre/notes/nomFichierOriginal (3 assertions).
    - rechercher filtres facettés bienId/locataireId/type/anneeFiscale chacun isolé puis 2 combinés puis 3 combinés.
    - Pagination 25 entries → page=1 size=20 retourne 20 + total=25 ; page=2 retourne 5.
    - listerCorbeille retourne ORDER BY corbeille_le DESC.
    - listerJustificatifsParBien limit=5 ORDER BY date_document DESC + total compte (sur 7 justificatifs).
    - listerJustificatifsParLocataire avec filtre type ∈ TYPES_AUTORISES_LOCATAIRE retourne correctement filtré ; avec type='facture' (non autorisé) → throw côté use case.

    **Builders extras** :
    - `unJustificatifAncienDixAns(today, overrides)` : `creeLe = today.subtract({years: 10})` — pour tester peutEtrePurge à la limite exacte.
    - `desJustificatifsPourPagination(n, overrides)` : génère n justificatifs avec titres incrémentés "Document 001"..."Document 025".
  </behavior>
  <action>
    Étendre `tests/bdd/features/coffre.feature` avec 15 nouveaux scénarios listés en behavior. Tags `@doc-02` ou `@doc-03` selon le sujet. Background commun avec wave 1 (clock fige + Bien).

    Étendre `tests/bdd/steps/coffre.steps.ts` avec :
    - Step Given "N justificatifs créés sur ce Bien" (boucle factory).
    - Step When "GET /coffre?search=..." (inject avec query string).
    - Step Then "la table justificatifs contient N rows" (déjà partiellement présent, étendre pour filtres).
    - Step Then "la page affiche la colonne date_purge_possible avec {date}".
    - Step Then "le justificatif est toujours présent en base" / "le justificatif est purgé de la base".
    - Step Then "le fichier physique a été supprimé" (assert `fs.access` rejects).
    - Step Then "le fichier physique est inchangé" (assert `fs.access` resolves + buffer identique).

    Étendre `tests/unit/documents/justificatif.test.ts` avec les 3 cas peutEtrePurge à la limite + restaurer + modifier-via-creer.

    Étendre `tests/integration/repositories/justificatif-repository-sqlite.test.ts` avec :
    - rechercher LIKE case-insensitive (3 assertions séparées).
    - Combinaisons filtres facettés (6 assertions).
    - Pagination 25 entries (2 assertions).
    - listerJustificatifsParBien + listerJustificatifsParLocataire (méthodes du repo OU appel use case selon design — privilégier méthode dédiée si le repo expose `rechercher` qui couvre déjà ; sinon ajouter méthodes dédiées).

    Étendre `tests/_builders/documents.ts` avec `unJustificatifAncienDixAns(today, overrides)` et `desJustificatifsPourPagination(n, overrides)`.

    Vérifier que les tests Task 1 échouent en RED (pas d'implémentation use cases / routes ajoutées encore).
  </action>
  <verify>
    <automated>pnpm cucumber-js --tags "@phase4 and (@doc-02 or @doc-03)" --dry-run | grep -E "Scenario:" | wc -l | grep -qE "^(1[5-9]|2[0-9])$" &amp;&amp; pnpm typecheck &amp;&amp; (pnpm vitest run tests/unit/documents tests/integration/repositories/justificatif-repository-sqlite.test.ts 2>&amp;1 | grep -E "(FAIL|failed)" | grep -v "0 failed")</automated>
  </verify>
  <done>
    Cucumber dry-run liste les 15 nouveaux scénarios `@doc-02` ou `@doc-03`.
    Tests unit + integration ajoutés en RED (assertion failures, pas erreurs d'import).
    `pnpm typecheck` exit 0 (stubs use cases OK).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 — GREEN: domain (peutEtrePurge limite) + 7 use cases + repo extras</name>
  <files>
    src/application/documents/rechercher-justificatifs.ts,
    src/application/documents/lister-corbeille.ts,
    src/application/documents/restaurer-justificatif.ts,
    src/application/documents/purger-justificatif.ts,
    src/application/documents/modifier-justificatif.ts,
    src/application/documents/lister-justificatifs-par-bien.ts,
    src/application/documents/lister-justificatifs-par-locataire.ts,
    src/infrastructure/repositories/justificatif-repository-sqlite.ts,
    src/domain/documents/justificatif.ts
  </files>
  <behavior>
    Tous les tests unit + integration de Task 1 doivent passer GREEN.

    Précisions complémentaires :
    - `purger-justificatif.ts` : 3 cas obligatoires testés via integration tests + BDD :
      1. corbeille_le === null → InvariantViolated("Le document n'est pas en corbeille — soft-delete d'abord.")
      2. peutEtrePurge=false → PurgeAvantDixAnsRefusee avec datePurgePossible + message verbatim UI-6.2 incluant date formatée FR.
      3. peutEtrePurge=true → trx { repo.supprimerDefinitivement } commit + hors trx { stockage.supprimer cleanup fichier ; si ENOENT log warning mais ne rollback pas — la row est déjà supprimée }.
    - `modifier-justificatif.ts` : réutilise Justificatif.creer pour re-valider invariants D-103 ; champs immuables (cheminFichier, mimeType, tailleOctets, nomFichierOriginal, creeLe) restent ceux de this.toProps() — ne peuvent JAMAIS être modifiés via patch (Zod schema le garantira aussi en Task 3).
    - `listerJustificatifsParLocataire` : throw InvariantViolated si type ∉ TYPES_AUTORISES_LOCATAIRE — la liste des 4 types est exportée comme constante.
  </behavior>
  <action>
    Vérifier que `src/domain/documents/justificatif.ts` (livré en 04-01) couvre déjà les 3 cas peutEtrePurge à la limite — si les tests Task 1 révèlent un edge case (ex: comparaison `>=` vs `>`), corriger le domaine. La signature attendue : `peutEtrePurge(today: Temporal.PlainDate): boolean` retourne true ssi `Temporal.PlainDate.compare(today, this.creeLe.add({years:10})) >= 0`.

    Implémenter `src/application/documents/rechercher-justificatifs.ts` :
    - Signature `rechercherJustificatifs(filtres, deps)` valide `page >= 1`, `pageSize >= 1 && <= 100` (cap raisonnable, default 20).
    - Délègue à `justificatifRepo.rechercher(filtres)`.
    - Retourne `{ items, total, page, pageSize }`.

    Implémenter `src/application/documents/lister-corbeille.ts` :
    - Délègue à `justificatifRepo.listerCorbeille()`.

    Implémenter `src/application/documents/restaurer-justificatif.ts` :
    - Lookup (throw JustificatifIntrouvable si null).
    - `.restaurer()` (throw DocumentNonEnCorbeille si pas en corbeille — domain).
    - `repo.enregistrer` (upsert).
    - Retourne `{ justificatif }`.

    Implémenter `src/application/documents/purger-justificatif.ts` (PATTERNS §Pattern 5 cleanup transactionnel) :
    - Lookup justificatif (throw JustificatifIntrouvable).
    - Si `justificatif.corbeilleLe === null` → throw InvariantViolated("Le document n'est pas en corbeille — soft-delete d'abord.").
    - `const today = clock.aujourdhui();` ; si `!justificatif.peutEtrePurge(today)` → calculer `datePurgePossible = justificatif.creeLe.add({years: 10})` + formater FR (helper format-date) → throw PurgeAvantDixAnsRefusee(datePurgePossible, `Conservation légale obligatoire jusqu'au ${dateFr}. Vous pourrez purger ce document à partir de cette date.`).
    - Sinon : trx Kysely `await db.transaction().execute(trx => repo.supprimerDefinitivement(id, trx))`. Hors trx : `try { await stockage.supprimer(justificatif.cheminFichier) } catch (err) { app.log.warn({ err, cheminFichier }, 'Cleanup fichier physique post-purge échoué — row déjà supprimée'); }` — pas de rollback car la row n'existe plus, on tolère un fichier orphelin réparable manuellement.

    Implémenter `src/application/documents/modifier-justificatif.ts` :
    - Lookup (throw JustificatifIntrouvable).
    - Construire `newProps = { ...justificatif.toProps(), ...patch }`. **Forcer les champs immuables** depuis `toProps()` : cheminFichier, mimeType, tailleOctets, nomFichierOriginal, creeLe, bienId, locataireId, corbeilleLe, raisonCorbeille — NE PAS les écraser même si patch les contient (def en profondeur).
    - `Justificatif.creer(newProps)` — re-valide tous les invariants D-103 (au cas où le patch toucherait à un champ qui rendrait le résultat invalide — improbable mais défense en profondeur).
    - `repo.enregistrer(modifie)` upsert.
    - Retourne `{ justificatif: modifie }`.

    Implémenter `src/application/documents/lister-justificatifs-par-bien.ts` :
    - Signature `listerJustificatifsParBien({ bienId, pageSize = 5 }, deps)`.
    - Délègue à `repo.rechercher({ bienId, pageSize, page: 1 })`.
    - Retourne `{ items, total }`.

    Implémenter `src/application/documents/lister-justificatifs-par-locataire.ts` :
    - Export const `TYPES_AUTORISES_LOCATAIRE: TypeJustificatif[] = ['piece_locataire', 'releve_bancaire', 'attestation', 'autre']` (D-120 verbatim).
    - Signature `listerJustificatifsParLocataire({ locataireId, type, pageSize = 5 }, deps)`.
    - Si `type` fourni : `if (!TYPES_AUTORISES_LOCATAIRE.includes(type)) throw new InvariantViolated('Type non autorisé sur fiche Locataire.')`.
    - Si `type` fourni : `repo.rechercher({ locataireId, type, pageSize, page: 1 })`.
    - Si pas de `type` : `repo.rechercher({ locataireId, typeIn: TYPES_AUTORISES_LOCATAIRE, pageSize, page: 1 })`. Le paramètre `typeIn` a été ajouté à la port `JustificatifRepository` **dès Wave 1** (cf. Plan 01 `<interfaces>` block + adapter `JustificatifRepositorySqlite.rechercher` implémentation Wave 1) — Wave 2 ne fait que CONSOMMER l'interface existante, aucune extension d'interface ici.
    - Retourne `{ items, total }`.

    Vérifier `src/infrastructure/repositories/justificatif-repository-sqlite.ts` (déjà implémenté Wave 1 — pas d'extension d'interface ici) :
    - Confirmer que `typeIn?: TypeJustificatif[]` est bien accepté par la signature `rechercher` (ajouté en Wave 1 dans la port + l'adapter par anticipation D-120).
    - Confirmer que l'implémentation Kysely `.where('type', 'in', typeIn)` est en place (test integration Wave 1 couvre déjà ce paramètre — cf. Plan 01 Task 1 behavior).
    - Vérifier que rechercher LIKE est case-insensitive (SQLite LIKE par défaut est case-insensitive sur ASCII — confirmer côté tests Wave 2 si besoin).

    Faire passer 100 % des tests unit + integration de Task 1.
  </action>
  <verify>
    <automated>pnpm vitest run tests/unit/documents tests/integration/repositories/justificatif-repository-sqlite.test.ts --reporter=verbose &amp;&amp; pnpm depcruise src --config .dependency-cruiser.js &amp;&amp; pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; pnpm vitest run --coverage tests/unit/documents/ 2>&amp;1 | grep -E "(justificatif.ts.*100|purger-justificatif.*100)"</automated>
  </verify>
  <done>
    100 % des tests unit + integration ajoutés en Task 1 verts.
    Couverture `src/application/documents/purger-justificatif.ts` = 100 % (3 branches : pas en corbeille / avant 10 ans / après 10 ans).
    Couverture `src/domain/documents/justificatif.ts` reste à 100 % (peutEtrePurge limite confirmée).
    `pnpm depcruise && pnpm typecheck && pnpm lint` exit 0.
    Constante `TYPES_AUTORISES_LOCATAIRE` exportée depuis `lister-justificatifs-par-locataire.ts` avec les 4 valeurs D-120 exactes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 — Wire UI: filtres /coffre + corbeille + modifier + fiches augmentées Bien/Locataire + Cucumber GREEN</name>
  <files>
    src/web/routes/coffre.ts,
    src/web/schemas/justificatif-schemas.ts,
    src/web/views/pages/coffre/liste.ejs,
    src/web/views/pages/coffre/corbeille.ejs,
    src/web/views/pages/justificatifs/modifier.ejs,
    src/web/views/partials/partial-filters-coffre.ejs,
    src/web/views/pages/biens/detail.ejs,
    src/web/views/pages/locataires/detail.ejs,
    src/web/routes/biens.ts,
    src/web/routes/locataires.ts,
    src/main.ts
  </files>
  <behavior>
    Tous les 15 scénarios `@doc-02` ou `@doc-03` ajoutés Task 1 doivent passer GREEN.

    Comportements UI clés :
    - Pagination conserve les autres query params dans les liens précédent/suivant.
    - Lien "Effacer les filtres" affiché seulement si au moins un filtre actif (search, bien, locataire, annee, type non vide).
    - Bouton "Purger définitivement" sur /coffre/corbeille est disabled si avant 10 ans avec `aria-disabled="true"` + `title="Disponible le {date}"` + cellule date `aria-describedby` pointant vers l'id de la cellule — touch target ≥ 44x44 même disabled (WCAG 2.5.5).
    - Modifier metadata : form ne contient PAS de champ fichier (immutable post-upload).
    - Fiche Bien : section "Documents" rendue APRÈS les sections Phase 1/2/3 existantes (ne PAS perturber l'ordre actuel).
    - Fiche Locataire : 4 liens horizontaux "Tous / Pièces locataire / Relevés bancaires / Attestations / Autres" comme filtre type (alternative V1 simple — pas de JS — UX-DESIGN forms 1 colonne respecté).
  </behavior>
  <action>
    Étendre `src/web/schemas/justificatif-schemas.ts` :
    - Ajouter `filtresCoffreSchema` : `z.object({ search: z.string().trim().max(200).optional(), bien: z.string().uuid().optional().or(z.literal('')), locataire: z.string().uuid().optional().or(z.literal('')), annee: z.coerce.number().int().min(1900).max(2200).optional(), type: z.enum([...9 valeurs]).optional().or(z.literal('')), page: z.coerce.number().int().min(1).default(1) })`.
    - Ajouter `modifierJustificatifSchema` : `z.object({ titre: z.string().trim().min(1, 'Le titre est obligatoire.').max(200), type: z.enum([...9 valeurs]), dateDocument: z.string().regex(...).refine(...), montantTtcCentimes: z.coerce.number().int().nonnegative().optional().nullable(), notes: z.string().trim().max(2000).optional().nullable() })` — **PAS de fichier, mimeType, tailleOctets, bienId, locataireId** (immutables post-upload).

    Étendre `src/web/routes/coffre.ts` :
    - `GET /coffre` : remplacer la version stub de wave 1 — `const filtres = filtresCoffreSchema.parse(req.query); const result = await rechercherJustificatifs(filtres, { justificatifRepo }); const nbCorbeille = (await listerCorbeille({}, { justificatifRepo })).length;` (optimisation possible avec count(*) dédié — pour V1 listerCorbeille.length suffit). Render `pages/coffre/liste.ejs` avec `{ items: result.items, total: result.total, page: result.page, pageSize: result.pageSize, biens, locataires, filtres, navActive: 'coffre', nbCorbeille, banniereSuccess, banniereWarning }`.
    - `GET /coffre/corbeille` : `const items = await listerCorbeille({}, { justificatifRepo }); const today = clock.aujourdhui();` → render `pages/coffre/corbeille.ejs` avec `{ items, today, navActive: 'coffre' }`.
    - `GET /justificatifs/:id/modifier` : lookup (404 si null, 410 si corbeille) → render `pages/justificatifs/modifier.ejs` avec valeurs préremplies + `{ erreurs: null, navActive: 'coffre' }`.
    - `POST /justificatifs/:id/modifier` : Zod parse `modifierJustificatifSchema` → si erreurs re-render modifier.ejs avec erreurs + valeurs. Sinon construire patch (PlainDate parse depuis string, Money depuis centimes) → `modifierJustificatif({ id, patch })`. Bannière "Document mis à jour." → 302 redirect `/justificatifs/:id`.
    - `POST /justificatifs/:id/restaurer` : `restaurerJustificatif({ id })`. Catch DocumentNonEnCorbeille → bannière warning "Ce document n'est pas en corbeille." Sinon bannière success "Document restauré." → 302 redirect `/coffre/corbeille`.
    - `POST /justificatifs/:id/purger` : `purgerJustificatif({ id })`. Catch PurgeAvantDixAnsRefusee → bannière warning avec err.message (verbatim UI-6.2) → 302 redirect /coffre/corbeille (l'utilisateur revoit la corbeille avec le justificatif toujours présent + bannière warning au-dessus). Catch InvariantViolated ("pas en corbeille") → bannière warning + redirect. Sinon bannière success "Document supprimé définitivement." → 302 redirect /coffre/corbeille.

    Implémenter `src/web/views/partials/partial-filters-coffre.ejs` (UI-3.2 + UI-3.3) :
    - `<form method="GET" action="/coffre" role="search" class="filtres-coffre" style="display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;">`.
    - Search : `<label for="filtre-search" class="sr-only">Recherche</label><input id="filtre-search" type="search" name="search" placeholder="Titre, notes, nom de fichier…" value="<%= filtres.search || '' %>" maxlength="200">`.
    - Select bien : `<label for="filtre-bien" class="sr-only">Bien</label><select id="filtre-bien" name="bien"><option value="">Tous les biens</option><% biens.forEach(b => { %><option value="<%= b.id %>" <% if (filtres.bien === b.id) { %>selected<% } %>><%= b.adresse %></option><% }) %></select>`.
    - Select locataire : similaire (nom complet en label).
    - Select annee : option "Toutes les années" + boucle 6 dernières années (2021..2026 ou plus selon today.year — dynamique).
    - Select type : option "Tous les types" + 9 options via `formaterTypeJustificatif`.
    - Submit `<button type="submit">Filtrer</button>`.
    - Lien conditionnel `<% if (Object.values(filtres).some(v => v && v !== '' && v !== 1)) { %><a href="/coffre">Effacer les filtres</a><% } %>` (exclut `page: 1` du test "filtres actifs").

    Étendre `src/web/views/pages/coffre/liste.ejs` :
    - Inclure `partial-filters-coffre` AVANT la table (entre header CTA et table).
    - Empty state : si `total === 0` && filtres actifs → message "Aucun document ne correspond à ces filtres" + body "Modifiez les filtres ou ajoutez de nouveaux documents." + lien "Effacer les filtres". Si `total === 0` && pas de filtres → empty state wave 1 ("Aucun justificatif pour le moment.").
    - Footer pagination : afficher si `total > pageSize`. Container avec `<nav aria-label="Pagination">` :
      - "Page X de Y" (Y = Math.ceil(total/pageSize)).
      - Lien "Précédent" → `/coffre?...&page=<%= page-1 %>` (disabled-style si page=1, via `aria-disabled` + lien désactivé).
      - Lien "Suivant" → `/coffre?...&page=<%= page+1 %>` (disabled-style si page >= ceil(total/pageSize)).
      - Préserver tous les autres query params dans les liens (helper `buildPaginationUrl(filtres, page)` côté template ou injecté).

    Implémenter `src/web/views/pages/coffre/corbeille.ejs` (UI-5.1) :
    - Layout (navActive='coffre', breadcrumbs `[{label:'Coffre documentaire', href:'/coffre'}, {label:'Corbeille'}]`).
    - `<h1>Corbeille</h1>` + texte explicatif court "Les documents soft-deleted sont conservés ici pendant 10 ans (rétention légale fiscale)."
    - Si `items.length === 0` : include `partial-empty-state` "La corbeille est vide" + body "Les documents supprimés apparaissent ici avant purge définitive." (pas de CTA — D-119 verbatim).
    - Sinon : `<table aria-label="Documents en corbeille">` avec `<thead>` 7 cols (Date corbeille | Type | Titre | Bien | Locataire | Date purge possible | Actions). `<tbody>` boucle items :
      - `<tr>` 7 `<td>` :
        - `<td><%= formatDate(j.corbeilleLe) %></td>`
        - `<td><%= formaterTypeJustificatif(j.type) %></td>`
        - `<td><a href="/justificatifs/<%= j.id %>"><%= j.titre %></a></td>`
        - `<td><%= j.bienId ? `<a href="/biens/${j.bienId}">...</a>` : '—' %></td>`
        - `<td><%= j.locataireId ? `<a href="/locataires/${j.locataireId}">...</a>` : '—' %></td>`
        - `<td id="purge-date-<%= j.id %>"><%= formatDate(j.creeLe.add({years:10})) %></td>`
        - `<td class="row-actions">` :
          - Bouton Restaurer : `<form method="POST" action="/justificatifs/<%= j.id %>/restaurer" style="display:inline"><button type="submit">Restaurer</button></form>`.
          - Bouton Purger conditionnel selon `today >= datePurgePossible` :
            - SI `today < datePurgePossible` : `<button type="button" disabled aria-disabled="true" title="Disponible le <%= formatDate(datePurgePossible) %>" aria-describedby="purge-date-<%= j.id %>" style="min-height: 44px; min-width: 44px;">Purger définitivement</button>` (WCAG 2.5.5 touch + 1.4.13 hover/focus).
            - SINON : bouton actif via `<button type="button" data-open-dialog="dialog-purge-<%= j.id %>" class="destructif">Purger définitivement</button>` + include `partial-confirm-dialog` avec `{ id: `dialog-purge-${j.id}`, formAction: `/justificatifs/${j.id}/purger`, message: 'Cette action est irréversible. Le fichier sera supprimé définitivement du disque.', confirmLabel: 'Purger définitivement', cancelLabel: 'Annuler' }`.

    Implémenter `src/web/views/pages/justificatifs/modifier.ejs` (UI-4.4) :
    - Layout + breadcrumbs.
    - `<h1>Modifier le document</h1>`.
    - `<p>Le fichier original (<%= j.nomFichierOriginal %>, <%= formaterTailleFichier(j.tailleOctets) %>, <%= j.mimeType %>) n'est pas modifiable. Pour remplacer le fichier, supprimez ce document et téléversez-en un nouveau.</p>` (transparency, R4.3 ton factuel).
    - `<form method="POST" action="/justificatifs/<%= j.id %>/modifier">` avec mêmes champs que upload SAUF fichier et fieldset rattachement :
      - titre (préfill), type (préfill selected), dateDocument (préfill), montantTtcCentimes (préfill), notes (préfill).
    - `<button type="submit">Mettre à jour</button>` + `<a href="/justificatifs/<%= j.id %>">Annuler</a>`.

    Étendre `src/web/views/pages/biens/detail.ejs` :
    - Nouvelle section h2 "Documents" (UI-5.4) APRÈS les sections Phase 1/2/3 existantes (Lots, Diagnostics, Baux — selon ordre actuel).
    - Si `documentsBien.total === 0` : include empty-state avec heading "Aucun document rattaché à ce Bien" + body "Téléversez factures, devis ou diagnostics depuis le coffre." + CTA "Ajouter un document" → `/coffre/upload` (D-119 verbatim).
    - Sinon : table compacte 5 lignes (Date | Type | Titre lien fiche /justificatifs/:id). En footer : `<a href="/coffre?bien=<%= bien.id %>">Voir tous les documents de ce Bien (<%= documentsBien.total %>)</a>`.

    Étendre `src/web/views/pages/locataires/detail.ejs` :
    - Nouvelle section h2 "Documents" (UI-5.4 + D-120).
    - Filtres type — 5 liens horizontaux (Tous / Pièces locataire / Relevés bancaires / Attestations / Autres) avec query string `?type=...` ; lien courant souligné via `aria-current="page"`.
    - Si `documentsLocataire.total === 0` pour le filtre courant : empty-state "Aucun document rattaché à ce Locataire" + body "Téléversez CNI, fiches de paie ou attestations depuis le coffre." + CTA "Ajouter un document".
    - Sinon : table compacte 5 lignes (Date | Type | Titre lien) + footer lien "Voir tous les documents de ce Locataire (<%= documentsLocataire.total %>)" → `/coffre?locataire=<%= locataire.id %>` (+ type si filtre courant).

    Étendre `src/web/routes/biens.ts` (handler GET /biens/:id) :
    - Appel `const documentsBien = await listerJustificatifsParBien({ bienId: bien.id, pageSize: 5 }, { justificatifRepo });`.
    - Passer `documentsBien` au template.

    Étendre `src/web/routes/locataires.ts` (handler GET /locataires/:id) :
    - Lire `req.query.type` ; valider via `z.enum(['piece_locataire','releve_bancaire','attestation','autre']).optional()`.
    - Appel `const documentsLocataire = await listerJustificatifsParLocataire({ locataireId: locataire.id, type, pageSize: 5 }, { justificatifRepo });`.
    - Passer `documentsLocataire` + `filtreTypeCourant` au template.

    Mettre à jour `src/main.ts` : injecter les nouvelles dépendances use cases dans les plugins biens et locataires (déjà en place — vérifier que `justificatifRepo` est bien passé aux routes biens/locataires existantes ; si non, l'ajouter aux opts respectives + au register).

    Implémenter les step definitions Cucumber manquantes dans `coffre.steps.ts` (formate FR date, assertion bouton disabled, assertion liens "Voir tous les documents", etc.). Faire passer les 15 scénarios `@doc-02` + `@doc-03`.
  </action>
  <verify>
    <automated>pnpm vitest run &amp;&amp; pnpm cucumber-js --tags @phase4 &amp;&amp; pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; pnpm depcruise src --config .dependency-cruiser.js</automated>
  </verify>
  <done>
    7 (wave 1) + 15 (wave 2) = 22 scénarios `@phase4` Cucumber verts.
    Toutes les fiches Bien et Locataire affichent leur section Documents augmentée.
    Filtres facettés fonctionnent avec URL params verbeux `?search=&bien=&locataire=&annee=&type=&page=`.
    Pagination /coffre 20/page avec liens préservant les filtres.
    Purge gate D-109 testée en BDD avec clock fige (avant 10 ans : bloquée + message verbatim ; à 10 ans pile : autorisée hard-delete).
    Bouton "Purger" disabled affiche `aria-disabled="true"` + `title="Disponible le {date}"` (assertion HTML).
    Modifier metadata laisse fichier physique + mimeType + tailleOctets inchangés (assertion BD).
    0 warning ESLint, 0 erreur typecheck, depcruise propre.
    Empty states 4 contextes D-119 verbatim (coffre filtré, corbeille, doc bien, doc locataire).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → GET /coffre (query params) | search/filtres untrusted strings |
| client → POST /justificatifs/:id/purger | déclenche hard-delete row + fichier |
| client → POST /justificatifs/:id/modifier | patch metadata — peut tenter de modifier champs immutables |

## STRIDE Threat Register

| Threat ID | Cat | Component | Disposition | Mitigation Plan |
|-----------|-----|-----------|-------------|-----------------|
| T-04-10 | T | GET /coffre filtres URL injection | mitigate | `filtresCoffreSchema` Zod valide enum type, UUID bienId/locataireId, year integer 1900..2200, page integer ≥1, search max 200 chars |
| T-04-11 | I | SQL injection via search LIKE | mitigate | Kysely paramétrise `where('titre', 'like', %${s}%)` — bind params, jamais string concat |
| T-04-12 | E | POST /justificatifs/:id/purger sans soft-delete préalable | mitigate | `purger-justificatif.ts` vérifie corbeille_le AVANT peutEtrePurge. Double check : route catch InvariantViolated et bannière warning si tentative |
| T-04-13 | E | POST /justificatifs/:id/purger contourner gate 10 ans | mitigate | Use case vérifie peutEtrePurge AVANT toute action. Gate domaine impossible à contourner via HTTP (la garde est dans `Justificatif.peutEtrePurge` ET dans `purger-justificatif.ts`). |
| T-04-14 | T | POST /justificatifs/:id/modifier tenter de modifier cheminFichier | mitigate | `modifier-justificatif.ts` force depuis `this.toProps()` les champs immuables (cheminFichier, mimeType, tailleOctets, nomFichierOriginal, creeLe, bienId, locataireId). Zod `modifierJustificatifSchema` n'expose pas ces champs au schéma HTTP. |
| T-04-15 | I | leak via GET /coffre/corbeille | accept | V1 mono-user local-first — pas de session multi-user à protéger |
| T-04-16 | D | GET /coffre sans filtre + DB volumineuse | accept | Local-first <10000 docs typique. Pagination 20 limite read. Optimisation FTS5 = V2 |
| T-04-17 | I | logs incluent metadata sensible (notes) | mitigate | Logger pino exclut le champ `notes` (peut contenir PII RGPD) sur les logs INFO ; uniquement en DEBUG. Audit-friendly conservé via BD. |
</threat_model>

<verification>
- `pnpm vitest run` — 100 % vert.
- `pnpm cucumber-js --tags @phase4` — 22/22 scénarios verts (7 wave 1 + 15 wave 2).
- `pnpm typecheck && pnpm lint && pnpm depcruise src` — exit 0.
- Coverage `pnpm vitest run --coverage` :
  - `src/domain/documents/justificatif.ts` = 100 %.
  - `src/application/documents/purger-justificatif.ts` = 100 % (3 branches).
- Smoke test manuel : sur app live, ajouter 25 justificatifs avec dateDocument variés, filtrer par bien + type, paginer, soft-delete 1 doc, voir dans corbeille avec date_purge_possible, tenter purge → bannière warning verbatim, attendre 10 ans (clock fige en test), purge OK, vérifier fichier disque supprimé.
</verification>

<success_criteria>
- L'utilisateur peut filtrer le coffre par 5 critères combinables (search + bien + locataire + année + type).
- La pagination 20/page préserve les filtres dans les liens.
- L'utilisateur peut consulter la corbeille avec date de purge possible visible.
- La purge avant 10 ans est bloquée avec message verbatim D-109 (UI-6.2 + R4.3 ton factuel).
- La purge après 10 ans hard-delete la row + cleanup fichier physique.
- L'utilisateur peut modifier les métadonnées (titre, type, date, montant, notes) sans toucher au fichier original.
- La fiche Bien affiche une section "Documents" (5 derniers + lien filtré).
- La fiche Locataire affiche une section "Documents" filtrable par 4 types autorisés (D-120 verbatim).
- 22 scénarios BDD `@phase4` verts.
- 100 % couverture sur `purger-justificatif.ts` et `justificatif.ts`.
- 0 warning ESLint, 0 erreur typecheck, depcruise propre.
- 4 empty states D-119 verbatim ajoutés (coffre filtré, corbeille, doc bien, doc locataire).
</success_criteria>

<output>
After completion, create `.planning/phases/04-coffre-documentaire-travaux/04-02-SUMMARY.md` selon le template `~/.claude/get-shit-done/templates/summary.md` avec :
- `affects` : `[web routes coffre (extension), web routes biens (extension), web routes locataires (extension), EJS biens/detail.ejs, EJS locataires/detail.ejs, EJS coffre/liste.ejs, JustificatifRepository.rechercher (typeIn extension)]`
- `provides` : `[7 use cases (rechercher, lister-corbeille, restaurer, purger, modifier, lister-par-bien, lister-par-locataire), constante TYPES_AUTORISES_LOCATAIRE, partial-filters-coffre, page corbeille avec gate purge conditionnel, page modifier metadata, section Documents fiche Bien, section Documents fiche Locataire avec filtre type]`
- `patterns` : `[gate domaine peutEtrePurge testée 3 branches, defense-en-profondeur champs immuables modifier-justificatif (Zod + use case toProps merge), pagination URL params verbeux (UI-3.3 user override), empty states 4 contextes D-119 verbatim, fiches augmentées (UI-5.4 pattern)]`
- `decisions` : `[D-109 (rétention 10 ans hard-block — TESTÉE 3 cas), D-110 (recherche SQL LIKE + facettes), D-111 (page /coffre/corbeille séparée), D-119 (4 empty states verbatim), D-120 (dossier locataire = filtrage par type — pas d'agrégat), UI-3.2 (filtres barre haute), UI-3.3 (URL params verbeux), UI-4.4 (modifier metadata sans fichier), UI-5.1 (corbeille colonnes + bouton purge disabled aria), UI-5.4 (section Documents fiche Bien + Locataire), UI-6.1/UI-6.2/UI-6.3 verbatim]`
- `commits` : list of commits produced.
- `tests_added` : `[bdd 15 scenarios @doc-02 + @doc-03, unit 4 cases peutEtrePurge limite + restaurer + modifier-via-creer, integration LIKE + facettes + pagination 25 + listerParBien + listerParLocataire avec type filter]`
</output>

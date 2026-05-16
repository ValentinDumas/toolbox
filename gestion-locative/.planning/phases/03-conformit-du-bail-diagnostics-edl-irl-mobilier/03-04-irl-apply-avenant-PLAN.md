---
phase: 03
plan: 04
plan_id: "03-04"
type: execute
wave: 4
depends_on: ["03-03"]
files_modified:
  - migrations/0009_phase3_bail_indexations.sql
  - src/infrastructure/db/kysely-types.ts                            # extends Phase 2
  - src/domain/_shared/identifiants.ts                               # extends Phase 1
  - src/domain/locatif/bail.ts                                       # extends 03-03 (adds appliquerIndexation + pivoterIrlReference)
  - src/domain/locatif/bail-indexation.ts
  - src/domain/locatif/bail-indexation-repository.ts
  - src/domain/locatif/erreurs.ts                                    # extends 03-03 (adds BailIndexationIntrouvable)
  - src/application/locatif/appliquer-indexation-irl.ts
  - src/application/locatif/renoncer-indexation-irl.ts
  - src/application/locatif/lister-bails-indexables.ts               # extends 03-03 (adds 12-mois lookback filter)
  - src/application/locatif/lister-indexations-bail.ts
  - src/infrastructure/repositories/bail-indexation-repository-sqlite.ts
  - src/infrastructure/pdf/avenant-irl-doc-def.ts
  - src/infrastructure/storage/stockage-fichier-local.ts             # extends Phase 2 (adds ecrireAvenant + lireAvenant)
  - src/web/schemas/indexation-schemas.ts                            # extends 03-03 (adds appliquer/renoncer schemas)
  - src/web/routes/indexations.ts                                    # extends 03-03 (adds POST appliquer + renoncer + GET avenant)
  - src/web/views/pages/baux/indexer/confirmation.ejs                # extends 03-03 (adds Appliquer + Renoncer buttons)
  - src/web/views/pages/baux/detail.ejs                              # extends 03-03 (adds IRL history table)
  - src/helpers/format-raison-non-application.ts
  - src/main.ts                                                      # extends Phase 1 (wire new use cases + repo)
  - tests/_builders/locatif.ts                                       # extends 03-03 (adds unBailIndexationValide)
  - tests/unit/locatif/bail-appliquer-indexation.test.ts
  - tests/unit/locatif/bail-indexation.test.ts
  - tests/unit/locatif/appliquer-indexation-irl.test.ts
  - tests/unit/locatif/renoncer-indexation-irl.test.ts
  - tests/unit/helpers/format-raison-non-application.test.ts
  - tests/integration/repositories/bail-indexation-repository-sqlite.test.ts
  - tests/integration/storage/stockage-fichier-local.test.ts         # extends Phase 2 (adds ecrireAvenant + lireAvenant tests T23-T26)
  - tests/integration/pdf/avenant-irl.test.ts
  - tests/bdd/features/indexation-irl-apply.feature
  - tests/bdd/step_definitions/indexation-irl.steps.ts               # extends 03-03 (adds LOC-04 apply steps)
autonomous: true
requirements: ["LOC-04"]

mvp_split_rationale: |
  Vertical slice LOC-04 partie application (étapes 4-5 du wizard + PDF avenant + table append-only).
  Split de 03-03 (simulation) car ce plan ajoute : nouvel agrégat (BailIndexation), nouvelle migration,
  PDF builder pdfmake (~30% contexte), use case transactionnel multi-repos avec compensation.
  Wave 4 — depend on 03-03 pour Bail.simulerIndexation (réutilisé dans appliquer) et le wizard layout.

must_haves:
  truths:
    - "BailIndexation est un agrégat append-only (D-96) — jamais d'UPDATE de loyer_avant_centimes, loyer_apres_centimes, irl_*, date_effet ; seulement INSERT (correction = nouvelle ligne)."
    - "BailIndexation.creer invariants : si indexationAppliquee === false → raisonNonApplication !== null ET loyerApres.egale(loyerAvant) ; raisonNonApplication ∈ {'gel_dpe', 'refus_bailleur', null}."
    - "Pas de méthode BailIndexation.annuler() — l'agrégat est immutable (D-96)."
    - "Bail.appliquerIndexation(irlNouveau: IRL, dateEffet: PlainDate): Bail méthode copy-on-write — pivot Bail.irlReference vers irlNouveau + Bail.loyerHc vers nouveau calculé (D-94 étapes 1-2). Throw GelLoyerClimatActif si this.estGelLoyer (defense en profondeur depuis le bail si possible — sinon vérifié au use case via Bien)."
    - "Use case appliquerIndexationIRL orchestre 5 effets en UNE transaction Kysely (D-94) : (1) bail.appliquerIndexation pivot, (2) régénération échéances futures pattern D-73 Phase 2 (filtre statut en_attente/partiellement_payee + periodeDebut >= dateEffet + pas d'encaissement actif), (3) BailIndexation.creer + bailIndexationRepo.enregistrer(trx) avec indexationAppliquee=true, (4) HORS transaction : génération PDF avenant + stockage local /documents/avenants/{annee}/avenant-{bailIdCourt}-{date}.pdf, (5) [03-05] retour de l'URL téléchargement."
    - "Use case renoncerIndexationIRL (D-95) : pivot Bail.irlReference (PAS Bail.loyerHc), BailIndexation.creer avec indexationAppliquee=false + raisonNonApplication='refus_bailleur' + loyerApres.egale(loyerAvant), PAS d'avenant PDF, PAS de régénération échéances. Transaction Kysely simple (1 update bail + 1 insert bail_indexations)."
    - "Pre-condition gel server-side : si Bien.estGelLoyer() → throw GelLoyerClimatActif AVANT toute transaction (defense en profondeur réutilise GelLoyerClimatActif créé 03-03). Aucun BailIndexation créé dans ce cas."
    - "Avenant PDF respecte les mentions obligatoires loi 89 art. 17-1 (D-93) : référence bail original, ancien loyer HC, IRL ancien + nouveau, nouveau loyer calculé, formule rappelée, date d'effet, lieux signature Bailleur + Locataire, footer 'Conformément à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989.'."
    - "Avenant PDF persisté immutable : `fs.writeFile(..., { flag: 'wx' })` — pattern Phase 2 quittance (D-63). Path : `${baseDir}/avenants/{annee}/avenant-{bailIdCourt}-{dateISO}.pdf`."
    - "Régénération échéances : préserve les échéances passées + payées (immutables, opposables fiscalement) — pattern strict D-73 Phase 2. Les nouvelles échéances utilisent le nouveau loyer."
    - "Table bail_indexations + UNIQUE INDEX sur (bail_id, date_effet) optionnel (évite double application accidentelle même jour). Query Phase 5 (liasse 2031 historique recettes)."
    - "Helper formaterRaisonNonApplication(raison: string | null) — 'gel_dpe' → 'Gel DPE', 'refus_bailleur' → 'Choix du bailleur', null → 'Appliquée' (UI-SPEC L341-343)."
    - "Fiche /baux/:id étendue : section <h2>Historique des indexations IRL</h2> avec table data-table colonnes [Date d'effet / IRL avant / IRL après / Loyer avant / Loyer après / Appliquée / Motif non-application / Avenant PDF]."
    - "Compensation : si génération PDF avenant échoue, la BailIndexation N'EST PAS rollback (append-only). Mais le bail.loyerHc + irlReference + échéances futures sont DÉJÀ COMMIT. Logger CRITICAL ; route GET /baux/:id/avenant/:annee tente regenerate à la volée si fichier absent (pattern Phase 2 quittance/:id/pdf)."
    - "BDD @loc-04 apply : 5 scenarios verts couvrant flow complet apply (5 effets + DB state), renoncer variant (pivot IRL sans loyer change), defense en profondeur gel, échéances futures régénérées avec nouveau loyer, avenant PDF stocké au bon path."
  artifacts:
    - path: "migrations/0009_phase3_bail_indexations.sql"
      provides: "Table bail_indexations append-only + index sur (bail_id, date_effet DESC)"
      contains: "CREATE TABLE IF NOT EXISTS bail_indexations"
    - path: "src/domain/locatif/bail-indexation.ts"
      provides: "Agrégat BailIndexation append-only + invariants (loyerApres si appliquée, raisonNonApplication si non)"
      exports: ["BailIndexation", "RaisonNonApplication"]
    - path: "src/domain/locatif/bail-indexation-repository.ts"
      provides: "Port BailIndexationRepository (enregistrer, trouverParId, listerParBail, dernierePourBail)"
      exports: ["BailIndexationRepository"]
    - path: "src/domain/locatif/bail.ts"
      provides: "Bail étendu : méthode appliquerIndexation(irlNouveau, dateEffet) copy-on-write — pivot loyer + irlRef"
      exports: ["Bail"]
    - path: "src/application/locatif/appliquer-indexation-irl.ts"
      provides: "Use case orchestration 5 effets transactionnels + PDF compensation (D-94)"
      exports: ["appliquerIndexationIRL"]
    - path: "src/application/locatif/renoncer-indexation-irl.ts"
      provides: "Use case renonciation (pivot IRL sans loyer change + ligne bail_indexations sans PDF) — D-95"
      exports: ["renoncerIndexationIRL"]
    - path: "src/application/locatif/lister-indexations-bail.ts"
      provides: "Use case read-only lister historique indexations pour un bail"
      exports: ["listerIndexationsBail"]
    - path: "src/infrastructure/repositories/bail-indexation-repository-sqlite.ts"
      provides: "Adapter Kysely append-only (enregistrer avec trxArg optionnel)"
      exports: ["BailIndexationRepositorySqlite"]
    - path: "src/infrastructure/pdf/avenant-irl-doc-def.ts"
      provides: "TDocumentDefinitions avenant IRL (mentions loi 89 art. 17-1 — D-93)"
      exports: ["construireAvenantIRL"]
    - path: "src/infrastructure/storage/stockage-fichier-local.ts"
      provides: "Méthodes ecrireAvenant + lireAvenant (symétriques aux ecrireQuittance/lireQuittance Phase 2)"
      exports: ["StockageFichierLocal"]
    - path: "src/helpers/format-raison-non-application.ts"
      provides: "Helper preHandler formaterRaisonNonApplication(raison) — DP-18"
      exports: ["formaterRaisonNonApplication"]
  key_links:
    - from: "src/application/locatif/appliquer-indexation-irl.ts"
      to: "src/application/encaissements/activer-bail.ts"
      via: "Pattern D-73 régénération échéances futures — filtre statut + periodeDebut >= dateEffet + pas d'encaissement actif, supprimerLot + enregistrerBatch via genererEcheancesPour(bailModifie)"
      pattern: "regenererEcheancesFutures"
    - from: "src/application/locatif/appliquer-indexation-irl.ts"
      to: "src/infrastructure/pdf/pdf-renderer-pdfmake.ts"
      via: "Hors transaction : pdfRenderer.genererBuffer(construireAvenantIRL(bail, locataire, bailleur, ...))"
      pattern: "genererBuffer"
    - from: "src/application/locatif/appliquer-indexation-irl.ts"
      to: "src/infrastructure/storage/stockage-fichier-local.ts"
      via: "stockage.ecrireAvenant(annee, nomFichier, buffer) après PDF — flag wx immutable"
      pattern: "ecrireAvenant"
    - from: "src/domain/locatif/bail-indexation.ts"
      to: "src/domain/_shared/irl.ts + money.ts"
      via: "Stocke IRL avant/après (trimestre+valeur plat) + Money avant/après centimes"
      pattern: "BailIndexationProps"
    - from: "src/web/routes/indexations.ts"
      to: "src/application/locatif/appliquer-indexation-irl.ts + renoncer-indexation-irl.ts"
      via: "POST /baux/:id/indexer/appliquer + POST /baux/:id/indexer/renoncer"
      pattern: "appliquerIndexationIRL / renoncerIndexationIRL"
---

<objective>
Vertical slice LOC-04 partie application : étapes 4-5 du wizard IRL (apply + renoncer) + PDF avenant + table append-only bail_indexations + régénération échéances futures (pattern D-73 Phase 2).

Purpose: LOC-04 complet — la révision IRL aboutit à un avenant juridiquement opposable (loi 89 art. 17-1) signable par les deux parties. La table append-only bail_indexations prépare Phase 5 (liasse 2031 traçabilité des recettes). La régénération des échéances futures applique le nouveau loyer aux périodes pas encore quittancées sans toucher aux échéances passées (immutables, déjà déclarées fiscalement).
Output: 2 routes (appliquer + renoncer) + PDF avenant pdfmake + GET avenant PDF download + historique indexations sur fiche Bail + 5 effets atomiques.
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-01-diagnostics-PLAN.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-03-irl-simulation-PLAN.md
@.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-04-PLAN.md
@.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md
@CLAUDE.md
@BDD_PRACTICES.md
@SOFTWARE_CRAFTSMANSHIP.md
@UI_DESIGN.md
@ACCESSIBILITY.md
@LOCATION_MEUBLEE_REGLES.md
@src/domain/_shared/identifiants.ts
@src/domain/_shared/clock.ts
@src/domain/_shared/money.ts
@src/domain/_shared/irl.ts
@src/domain/locatif/bail.ts
@src/domain/locatif/bail-repository.ts
@src/domain/locatif/locataire.ts
@src/domain/locatif/locataire-repository.ts
@src/domain/identite/bailleur.ts
@src/domain/identite/bailleur-repository.ts
@src/domain/encaissements/encaissement.ts
@src/domain/patrimoine/bien.ts
@src/domain/patrimoine/bien-repository.ts
@src/web/routes/indexations.ts
@src/web/views/pages/baux/indexer/saisie.ejs
@src/web/views/pages/baux/indexer/simulation.ejs
@src/web/views/partials/wizard-irl-layout.ejs
@src/main.ts
</context>

<interfaces>
Contrats clés (réutilisés depuis Phases 1/2 + 03-01/03-03) :

- `Bail.simulerIndexation(irlNouveau, classeDpeBien)` (créé 03-03) — réutilisé dans le use case appliquer pour calculer le nouveau loyer.
- `Bail.appliquerIndexation(irlNouveau, dateEffet)` (NOUVEAU 03-04) — copy-on-write Bail avec nouveau loyer + irlReference pivoté.
- `GelLoyerClimatActif` exception (créé 03-03) — réutilisée dans le use case appliquer.
- `Bien.estGelLoyer()` (créé 03-01) — réutilisé pour vérification pré-transaction.
- `Money.multiplyByRatio` (créé 03-03) — réutilisé via Bail.simulerIndexation.
- `Bailleur` singleton (Phase 2 D-67) — réutilisé pour le PDF avenant.
- `LocataireRepository`, `BailRepository`, `BienRepository`, `EncaissementRepository`, `EcheanceLoyerRepository` (Phases 1/2).
- `genererEcheancesPour(bail, actifDepuis, jourEcheance)` (Phase 2 activer-bail) — réutilisé pour régénération.
- `StockageFichierLocal` (Phase 2) — étendu avec `ecrireAvenant` + `lireAvenant`.
- `pdfRenderer.genererBuffer(docDef)` (Phase 2) — réutilisé.
- `Kysely<DB>` transaction pattern — `await db.transaction().execute(async (trx) => {...})` (Phase 2 generer-quittance).

Nouveaux contrats Phase 3-04 :

- `BailIndexationId = string & { __brand: 'BailIndexationId' }` + `nouveauBailIndexationId()`.
- `RaisonNonApplication = 'gel_dpe' | 'refus_bailleur'`.
- `BailIndexation` agrégat append-only :
  - Props : `{ id?: BailIndexationId; bailId: BailId; dateEffet: Temporal.PlainDate; irlAvant: IRL; irlApres: IRL; loyerAvant: Money; loyerApres: Money; indexationAppliquee: boolean; raisonNonApplication: RaisonNonApplication | null; creeLe?: Temporal.PlainDate }`.
  - Factory `creer(props)` invariants :
    - Si `indexationAppliquee === true` → `raisonNonApplication === null` sinon InvariantViolated. ET `loyerApres >= loyerAvant` (révision à la hausse ou IRL stable — pas de baisse via apply, baisse rare = pas de pivot ; si IRL baisse, le user choisit "Ne pas indexer" pour préserver le loyer).
    - Si `indexationAppliquee === false` → `raisonNonApplication !== null` ET `loyerApres.egale(loyerAvant)` sinon InvariantViolated.
    - `raisonNonApplication ∈ {'gel_dpe', 'refus_bailleur', null}`.
    - id défaut `nouveauBailIndexationId()`. `creeLe` défaut `Temporal.PlainDate` au moment de `creer` (mais c'est l'horodatage métier — l'adapter SQLite ajoute `cree_le DEFAULT CURRENT_TIMESTAMP` au niveau ligne, on peut soit propager soit ignorer dans le domaine).
  - **Pas de méthode `annuler()`** — append-only stricte. Correction = nouvelle ligne avec valeurs corrigées.
- `BailIndexationRepository` port :
  - `enregistrer(bi: BailIndexation, trxArg?: Kysely<DB> | Transaction<DB>): Promise<void>` — accepte transaction optionnelle (pattern Quittance 02-04 prochainNumero).
  - `trouverParId(id: BailIndexationId): Promise<BailIndexation | null>`.
  - `listerParBail(bailId: BailId): Promise<BailIndexation[]>` — order `date_effet DESC` (chronologique inverse).
  - `dernierePourBail(bailId: BailId): Promise<BailIndexation | null>` — `LIMIT 1` la plus récente (utilisé par lister-bails-indexables pour exclure les bails indexés < 12 mois).
- `Bail.appliquerIndexation(irlNouveau: IRL, dateEffet: Temporal.PlainDate): Bail` (NOUVEAU dans `src/domain/locatif/bail.ts`) :
  - Copy-on-write.
  - **PAS d'invariant gel ici** — c'est responsabilité du use case (le bail ne connaît pas Bien.classeDpe sans cross-aggregate read). Le use case throw avant d'appeler.
  - Calcul nouveau loyer : `const result = this.simulerIndexation(irlNouveau, null);` (`null` car gel déjà vérifié par le use case — on bypass le check ici en passant null).
  - `return Bail.creer({ ...this.toProps(), loyerHc: result.nouveauLoyerHc, irlReference: irlNouveau });`
- `appliquerIndexationIRL(commande, repos, infra, db): Promise<{ bailIndexationId: BailIndexationId; nouveauLoyerHc: Money; echeancesRegenerees: number; cheminFichierRelatifAvenant: string }>` :
  - `commande: { bailId: BailId; irlTrimestre: string; irlValeur: string; dateEffet?: Temporal.PlainDate }` — `dateEffet` défaut = `bail.dateAnniversaireProchaine(today).subtract({years: 1})` (la dernière atteinte).
  - `repos: { bailRepo, bienRepo, locataireRepo, bailleurRepo, echeanceLoyerRepo, encaissementRepo, bailIndexationRepo }`.
  - `infra: { pdfRenderer, stockage, clock }`.
  - `db: Kysely<DB>` (pour `db.transaction().execute(...)`).
  - Étapes :
    1. Lookup bail + bien + locataire + bailleur (throw BailIntrouvable / BienIntrouvable / LocataireIntrouvable / BailleurAbsent si absent).
    2. Construire `irlNouveau = IRL.creer({ trimestre, valeur })`.
    3. **Pre-condition gel** : `if (bien.estGelLoyer()) throw new GelLoyerClimatActif(bail.id, bien.classeDpe!);`.
    4. `const result = bail.simulerIndexation(irlNouveau, bien.classeDpe);` (devrait avoir `gelLoyer: false` car on a check 3).
    5. **Transaction Kysely** :
       - `const bailModifie = bail.appliquerIndexation(irlNouveau, dateEffet);`
       - `await bailRepo.enregistrer(bailModifie, trx);` — LOCKÉ : étendre `BailRepository.enregistrer` avec param `trxArg?: Kysely<DB> | Transaction<DB>` (pattern `QuittanceRepository` Phase 2 D-63). Justification : cohérence cross-aggregate transaction. NE PAS faire l'INSERT bail hors transaction (échec rollback impossible).
       - **Régénération échéances** (pattern strict D-73 Phase 2 — copier la logique de `modifier-bail-actif.ts` SI elle existe en Phase 2, sinon de `activer-bail.ts`) :
         - Lister échéances du bail.
         - Filtrer : `statut ∈ {'en_attente', 'partiellement_payee'} && periodeDebut >= dateEffet && !aDesEncaissementsActifs`.
         - `await echeanceLoyerRepo.supprimerLot(aRegenererIds);`
         - Régénérer via `genererEcheancesPour(bailModifie, ...)` (filtré par périodes correspondantes).
         - `await echeanceLoyerRepo.enregistrerBatch(nouvellesEcheances);`
       - `const bailIndexation = BailIndexation.creer({ bailId: bail.id, dateEffet, irlAvant: bail.irlReference, irlApres: irlNouveau, loyerAvant: bail.loyerHc, loyerApres: result.nouveauLoyerHc, indexationAppliquee: true, raisonNonApplication: null });`
       - `await bailIndexationRepo.enregistrer(bailIndexation, trx);`
    6. **HORS transaction (committée)** : génération PDF avenant + écriture fichier :
       - `const annee = dateEffet.year;`
       - `const bailIdCourt = bail.id.slice(0, 8);`
       - `const nomFichier = 'avenant-' + bailIdCourt + '-' + dateEffet.toString() + '.pdf';`
       - `const docDef = construireAvenantIRL(bailModifie, locataire, bailleur, irlNouveau, bail.irlReference, bail.loyerHc, result.nouveauLoyerHc, dateEffet);`
       - try `const buffer = await pdfRenderer.genererBuffer(docDef); await stockage.ecrireAvenant(annee, nomFichier, buffer);`
       - catch err → log CRITICAL ("PDF avenant échec — BailIndexation appliquée, fichier manquant — regenerate via GET /baux/:id/avenant/:annee"). Ne PAS rollback BailIndexation (append-only).
    7. Return `{ bailIndexationId: bailIndexation.id, nouveauLoyerHc: result.nouveauLoyerHc, echeancesRegenerees: aRegenererIds.length, cheminFichierRelatifAvenant: 'avenants/' + annee + '/' + nomFichier }`.
- `renoncerIndexationIRL(commande, repos, db): Promise<{ bailIndexationId: BailIndexationId }>` :
  - Lookup bail + bien (pour vérifier gel — si gel, le user devrait être bloqué AVANT au niveau UI ; mais defense en profondeur OK ici aussi : si gel, ne pas faire pivot non plus, throw GelLoyerClimatActif).
  - Mais sémantiquement : si le bail est en gel, le user n'aurait jamais accès à l'étape 4 "ne pas indexer" — la route GET /baux/:id/indexer renvoie gel-loyer.ejs. LOCKÉ : SI `bien.estGelLoyer()` → throw `GelLoyerClimatActif` (defense en profondeur cohérente avec `appliquer`).
  - `const irlNouveau = IRL.creer({...});`
  - **Transaction Kysely** (plus légère qu'apply) :
    - `const bailModifie = Bail.creer({ ...bail.toProps(), irlReference: irlNouveau });` (pivot IRL sans changer loyerHc — pas via appliquerIndexation car cette méthode change le loyer).
    - LOCKÉ : méthode dédiée `Bail.pivoterIrlReference(irlNouveau)` copy-on-write — voir Task 1 step 7 (lisibilité + traçabilité métier > ad-hoc dans use case).
    - `await bailRepo.enregistrer(bailModifie);`
    - `const bailIndexation = BailIndexation.creer({ bailId, dateEffet, irlAvant: bail.irlReference, irlApres: irlNouveau, loyerAvant: bail.loyerHc, loyerApres: bail.loyerHc, indexationAppliquee: false, raisonNonApplication: 'refus_bailleur' });`
    - `await bailIndexationRepo.enregistrer(bailIndexation, trx);`
  - **PAS de régénération échéances** (loyer inchangé).
  - **PAS de PDF avenant** (pas de hausse à formaliser).
  - Return `{ bailIndexationId }`.
- `Bail.pivoterIrlReference(irlNouveau: IRL): Bail` (NOUVEAU dans `src/domain/locatif/bail.ts`) :
  - Copy-on-write minimal : `Bail.creer({ ...this.toProps(), irlReference: irlNouveau })`.
  - Pas de calcul de loyer.
- `BailIndexationRepositorySqlite` :
  - Pattern QuittanceRepositorySqlite (Phase 2) : `enregistrer(bi, trxArg?)` avec `DbOrTrx` type alias.
  - **PAS d'`onConflict`** (append-only D-96 — pas d'update même metadata).
  - `versDomaine(row)` reconstruit avec `IRL.creer({ trimestre: row.irl_avant_trimestre, valeur: row.irl_avant_valeur })` et idem `apres` + `Money.fromCentimes(BigInt(row.loyer_avant_centimes))`.
- `construireAvenantIRL(bail: Bail, locataire: Locataire, bailleur: Bailleur, irlNouveau: IRL, irlAncien: IRL, loyerAvant: Money, loyerApres: Money, dateEffet: Temporal.PlainDate): TDocumentDefinitions` :
  - Pattern `construireQuittance` Phase 2.
  - Structure pdfmake :
    - Header : `'AVENANT À LA CONVENTION DE BAIL — Révision IRL'` titre centré + sous-titre `'Exercice ${dateEffet.year} — Bail du ${formatDate(bail.dateDebut)}'`.
    - 2 colonnes bailleur + locataire (nom, adresse, etc.).
    - Tableau 4 lignes : Ancien loyer HC / IRL référence (trimestre + valeur) / IRL nouveau (trimestre + valeur) / **Nouveau loyer HC** (gras + plus gros).
    - Mention italics : formule légale `loyerApres = loyerAvant × (irlNouveau.valeur / irlAncien.valeur)` rappelée pour transparence (UI-SPEC L324-330).
    - Date d'effet (formatée français) + "Les parties acceptent la révision ci-dessus.".
    - 2 colonnes signature : Bailleur (gauche) + Locataire (droite).
    - Footer : `'Conformément à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989.'`.
- `StockageFichierLocal.ecrireAvenant(annee, nomFichier, buffer)` : strictement symétrique à `ecrireQuittance`. Path `${baseDir}/avenants/${annee}/${nomFichier}`. Flag `wx` (immutable). Return chemin relatif.
- `StockageFichierLocal.lireAvenant(cheminRelatif)` : strictement symétrique à `lireQuittance`. Path traversal protection (NULL byte check + realpath boundary). Throw `FichierIntrouvable` si absent.
- Helper `formaterRaisonNonApplication(raison: RaisonNonApplication | null): string` :
  - `null` → 'Appliquée'.
  - `'gel_dpe'` → 'Gel DPE'.
  - `'refus_bailleur'` → 'Choix du bailleur'.
- Routes Fastify étendues :
  - `POST /baux/:id/indexer/appliquer` (étape 4 → 5 + redirect résultat) : appelle `appliquerIndexationIRL`, set `req.session.banniereSuccess = 'Révision IRL appliquée avec succès. Avenant disponible au téléchargement.';`, redirect `/baux/:id`.
  - `POST /baux/:id/indexer/renoncer` (étape 4 → redirect résultat) : appelle `renoncerIndexationIRL`, set `banniereSuccess = 'Révision IRL non appliquée — l\'IRL de référence est mis à jour pour la prochaine révision.';`, redirect `/baux/:id`.
  - `GET /baux/:id/avenant/:annee` (téléchargement PDF) : pattern Phase 2 `/quittances/:id/pdf`. Lookup `bailIndexationRepo.listerParBail(bailId)` puis filter `bi => bi.dateEffet.year === annee && bi.indexationAppliquee`. Si trouvé → `stockage.lireAvenant(cheminCalculé)` + `Content-Type: application/pdf` + `Content-Disposition: attachment; filename="avenant-..."`. Si fichier absent → catch `FichierIntrouvable` → 404 message "Régénérez l'avenant en relançant la révision".
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests rouges Wave 0 — BailIndexation + Bail.appliquerIndexation + Bail.pivoterIrlReference + appliquerIndexationIRL + renoncerIndexationIRL + helper + integration repo + PDF + BDD LOC-04 apply</name>
  <read_first>
    - src/domain/locatif/bail.ts (état après 03-03 — extension nécessaire pour appliquerIndexation + pivoterIrlReference)
    - src/domain/encaissements/encaissement.ts (analog agrégat append-only avec invariants stricts)
    - src/domain/encaissements/quittance.ts (analog agrégat avec invariants spécifiques par type)
    - src/application/encaissements/activer-bail.ts (analog use case multi-repo + genererEcheancesPour + pattern D-73 régénération)
    - src/application/encaissements/generer-quittance.ts (analog use case avec PDF + compensation hors transaction)
    - src/infrastructure/repositories/encaissement-repository-sqlite.ts (analog adapter append-only + trxArg optionnel)
    - src/infrastructure/repositories/quittance-repository-sqlite.ts (analog enregistrer avec trxArg)
    - src/infrastructure/pdf/quittance-doc-def.ts (analog pdfmake structure mentions légales)
    - src/infrastructure/storage/stockage-fichier-local.ts (analog ecrireQuittance + lireQuittance — modèle exact pour ecrireAvenant + lireAvenant)
    - tests/_builders/locatif.ts (analog unBailValide à étendre)
    - tests/unit/encaissements/quittance.test.ts (analog factory test pattern)
    - tests/integration/repositories/quittance-repository-sqlite.test.ts (analog integration roundtrip)
    - tests/integration/pdf/quittance.test.ts (analog test PDF buffer mentions légales)
    - tests/bdd/features/quittancement.feature (analog scenario format)
    - LOCATION_MEUBLEE_REGLES.md §Loi 89 art. 17-1 (formule + obligations avenant)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : bail-indexation.ts + bail.ts modifié 4 méthodes + appliquer-indexation-irl + bail-indexation-repository-sqlite + avenant-doc-def + stockage-fichier-local étendu)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-93, D-94, D-95, D-96)
    - Tests rouges Phase 2 plan 02-04 (generer-quittance pattern)
  </read_first>
  <behavior>
    - T1 bail-indexation.test : `BailIndexation.creer({ bailId, dateEffet, irlAvant, irlApres, loyerAvant: Money.fromCentimes(80000n), loyerApres: Money.fromCentimes(81920n), indexationAppliquee: true, raisonNonApplication: null })` → ne throw pas.
    - T2 bail-indexation.test : indexationAppliquee=true + raisonNonApplication='gel_dpe' → throw InvariantViolated('Une indexation appliquée ne peut pas avoir de raison de non-application').
    - T3 bail-indexation.test : indexationAppliquee=true + loyerApres < loyerAvant → throw InvariantViolated('Une indexation appliquée doit avoir un loyer après >= loyer avant').
    - T4 bail-indexation.test : indexationAppliquee=false + raisonNonApplication=null → throw InvariantViolated('Une indexation non appliquée doit avoir une raison de non-application').
    - T5 bail-indexation.test : indexationAppliquee=false + raisonNonApplication='refus_bailleur' + loyerApres !== loyerAvant → throw InvariantViolated('Une indexation non appliquée ne doit pas modifier le loyer').
    - T6 bail-indexation.test : indexationAppliquee=false + 'gel_dpe' + loyer égal → ne throw pas.
    - T7 bail-indexation.test : raisonNonApplication='autre' (hors enum) → throw InvariantViolated.
    - T8 bail-indexation.test : Pas de méthode annuler() — vérifier que `(BailIndexation.prototype as any).annuler === undefined`.
    - T9 bail-appliquer-indexation.test : `bail.appliquerIndexation(IRL{2025-T4, 145.47}, PlainDate('2026-05-01'))` (bail loyer 800, irlRef 142.06) → retourne nouveau Bail avec loyerHc calculé (~819.20€ banker) ET irlReference = IRL{2025-T4, 145.47}. Toutes autres props préservées (toProps roundtrip).
    - T10 bail-appliquer-indexation.test : `bail.pivoterIrlReference(IRL{2025-T4, 145.47})` → retourne nouveau Bail avec irlReference modifié, loyerHc INCHANGÉ.
    - T11 appliquer-indexation-irl.test : Mocker tous les repos. Bail loyer 800, Bien classeDpe='D'. → 1 BailIndexation enregistrée (mock spy), bail.loyerHc à jour, échéances futures régénérées (mock retourne 5 échéances en_attente future, le mock spy supprimerLot appelé avec 5 ids puis enregistrerBatch avec 5 nouvelles).
    - T12 appliquer-indexation-irl.test : Bien classeDpe='F' → throw GelLoyerClimatActif AVANT toute écriture (aucun spy enregistrer appelé).
    - T13 appliquer-indexation-irl.test : Bailleur absent → throw BailleurAbsent (réutilisé Phase 2 erreur).
    - T14 appliquer-indexation-irl.test : Échec PDF (mock pdfRenderer.genererBuffer throw) → BailIndexation, bail, échéances DÉJÀ commit (transaction OK). Log CRITICAL. Use case re-throw l'erreur (le caller voit l'échec).
    - T15 appliquer-indexation-irl.test : Échec écriture fichier (mock stockage.ecrireAvenant throw EEXIST) → idem T14 (DB intacte, log + re-throw).
    - T16 renoncer-indexation-irl.test : Mocker repos. Bail loyer 800, Bien classeDpe='D'. → 1 BailIndexation enregistrée avec indexationAppliquee=false + raisonNonApplication='refus_bailleur' + loyerApres===loyerAvant, bail.irlReference pivoté, bail.loyerHc INCHANGÉ, AUCUN spy supprimerLot ou enregistrerBatch (pas de régénération), AUCUN spy stockage (pas de PDF).
    - T17 renoncer-indexation-irl.test : Bien classeDpe='G' → throw GelLoyerClimatActif (pas d'enregistrement).
    - T18 format-raison-non-application.test : null → 'Appliquée' ; 'gel_dpe' → 'Gel DPE' ; 'refus_bailleur' → 'Choix du bailleur'.
    - T19 integration bail-indexation-repo : roundtrip BailIndexation via SQLite (IRL avant/après plat columns + Money centimes + bool indexationAppliquee + raisonNonApplication nullable).
    - T20 integration bail-indexation-repo : `enregistrer` 2× avec même id → seconde tentative throw constraint UNIQUE (append-only — pas d'upsert).
    - T21 integration bail-indexation-repo : `listerParBail(bailId)` retourne BailIndexation[] triées date_effet DESC.
    - T22 integration bail-indexation-repo : `dernierePourBail(bailId)` retourne la plus récente OR null si aucune.
    - T23 integration storage : `ecrireAvenant(2026, 'avenant-abc12345-2026-05-01.pdf', buffer)` crée le dossier `${baseDir}/avenants/2026/` et écrit le fichier. Retour chemin relatif 'avenants/2026/avenant-...'.
    - T24 integration storage : `ecrireAvenant` 2× même fichier → throw EEXIST (flag wx).
    - T25 integration storage : `lireAvenant('avenants/2026/...')` retourne le buffer. Inconnu → FichierIntrouvable.
    - T26 integration storage : `lireAvenant('../../../etc/passwd')` → path traversal bloqué (return FichierIntrouvable ou InvariantViolated selon implem — pattern Phase 2 lireQuittance).
    - T27 integration pdf avenant : construire docDef + genererBuffer → buffer commence par %PDF- + longueur > 1500 + contient 'AVENANT À LA CONVENTION DE BAIL' + 'article 17-1' + 'loi n° 89-462' + 'Révision IRL' + le nom du bailleur + le nom du locataire + le formule lisible.
    - T28 BDD @loc-04-apply "Apply flow complet" : Given Bail actif loyer 800 irlRef '2024-T4'/142.06, Bien DPE D, Locataire+Bailleur. ClockFixe '2026-05-15'. When POST /baux/:id/indexer/simuler avec '2025-T4'/145.47 puis POST /baux/:id/indexer/appliquer. Then : (a) bail.loyer_hc=81920 (ou valeur calculée banker), (b) bail.irl_reference={'2025-T4', '145.47'}, (c) bail_indexations contient 1 row indexationAppliquee=true, (d) echeance_loyer futures régénérées avec nouveau loyer, (e) fichier 'avenants/2026/avenant-...' existe sur disque, (f) banniereSuccess 'Révision IRL appliquée'.
    - T29 BDD @loc-04-apply "Renoncer flow" : Given idem. When POST /baux/:id/indexer/renoncer. Then : bail.loyer_hc INCHANGÉ (800), bail.irl_reference pivoté vers '2025-T4'/145.47, bail_indexations contient 1 row indexationAppliquee=false + raisonNonApplication='refus_bailleur', AUCUN fichier avenant créé, banniereSuccess 'Révision IRL non appliquée'.
    - T30 BDD @loc-04-apply "GET avenant PDF" : Given indexation appliquée 2026. When GET /baux/:id/avenant/2026. Then Content-Type application/pdf, Content-Disposition attachment, buffer body commence par %PDF-.
    - T31 BDD @loc-04-apply "Régénération échéances futures" : Given Bail actif avec 12 échéances générées (Phase 2), date courante 2026-05-15, échéances passées payées 1-5 + échéances futures 6-12 en_attente. When POST /baux/:id/indexer/appliquer avec date_effet=2026-05-01. Then échéances 1-5 INCHANGÉES (statut payée, loyer ancien), échéances 6-12 REGÉNÉRÉES (nouveau loyer 819.20 sur le total).
    - T32 BDD @loc-04-apply "Gel DPE bloque apply server-side" : Given Bien DPE F. When POST /baux/:id/indexer/appliquer (forcé via curl/inject). Then status 403, AUCUN BailIndexation créé, message gel loyer affiché.
  </behavior>
  <action>
    TDD outside-in. Créer EXCLUSIVEMENT les tests (rouges).

    1. ÉTENDRE `tests/_builders/locatif.ts` :
       - `uneBailIndexationAppliqueeValide(overrides = {})` : defaults `bailId: nouveauBailId(), dateEffet: PlainDate.from('2026-05-01'), irlAvant: IRL{2024-T4, 142.06}, irlApres: IRL{2025-T4, 145.47}, loyerAvant: Money.fromCentimes(80000n), loyerApres: Money.fromCentimes(81920n), indexationAppliquee: true, raisonNonApplication: null`.
       - `uneBailIndexationRenonceeValide(overrides = {})` : idem mais loyerApres===loyerAvant, indexationAppliquee=false, raisonNonApplication='refus_bailleur'.

    2. `tests/unit/locatif/bail-indexation.test.ts` (NOUVEAU) : T1-T8.

    3. `tests/unit/locatif/bail-appliquer-indexation.test.ts` (NOUVEAU) : T9-T10.

    4. `tests/unit/locatif/appliquer-indexation-irl.test.ts` (NOUVEAU) : T11-T15.

    5. `tests/unit/locatif/renoncer-indexation-irl.test.ts` (NOUVEAU) : T16-T17.

    6. `tests/unit/helpers/format-raison-non-application.test.ts` (NOUVEAU) : T18.

    7. `tests/integration/repositories/bail-indexation-repository-sqlite.test.ts` (NOUVEAU) : T19-T22.

    8. ÉTENDRE `tests/integration/storage/stockage-fichier-local.test.ts` (Phase 2) : T23-T26 pour ecrireAvenant/lireAvenant.

    9. `tests/integration/pdf/avenant-irl.test.ts` (NOUVEAU) : T27.

    10. `tests/bdd/features/indexation-irl-apply.feature` (NOUVEAU) : 5 scenarios tag `@loc-04-apply @phase3` (T28-T32).

    11. ÉTENDRE `tests/bdd/step_definitions/indexation-irl.steps.ts` (créé 03-03) avec Before/After `@loc-04-apply` + steps Given/When/Then propres apply (assertions DB sur bail_indexations + fichier disque + status code).

    Tests ÉCHOUENT. Commit : `test(03-04): tests rouges BailIndexation + Bail.appliquerIndexation/pivoterIrlReference + appliquer/renoncer use cases + storage avenant + PDF + LOC-04 apply (Wave 0)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm test 2>&1 | grep -E "FAIL|fail" | head -30 && ls tests/unit/locatif/bail-indexation.test.ts tests/unit/locatif/bail-appliquer-indexation.test.ts tests/unit/locatif/appliquer-indexation-irl.test.ts tests/unit/locatif/renoncer-indexation-irl.test.ts tests/unit/helpers/format-raison-non-application.test.ts tests/integration/repositories/bail-indexation-repository-sqlite.test.ts tests/integration/pdf/avenant-irl.test.ts tests/bdd/features/indexation-irl-apply.feature</automated>
  </verify>
  <done>
    - Tests Wave 0 rouges : 7 fichiers test + 1 feature BDD + extension steps + extension storage test + builders étendus.
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Domain (BailIndexation + Bail.appliquerIndexation + pivoterIrlReference) + adapter SQLite + use cases transactionnels + PDF builder + storage extension + migration 0009 + helper (passer unit + integration au vert)</name>
  <read_first>
    - src/domain/encaissements/encaissement.ts (analog agrégat append-only + soft-cancel — modèle pour invariants stricts)
    - src/domain/encaissements/quittance.ts (analog factory + annuler() — pour ne pas avoir annuler dans BailIndexation)
    - src/domain/locatif/bail.ts (état après 03-03 — appliquerIndexation + pivoterIrlReference à ajouter)
    - src/application/encaissements/activer-bail.ts (analog genererEcheancesPour + use case multi-repo)
    - src/application/encaissements/modifier-bail-actif.ts (analog pattern D-73 régénération échéances futures — SI EXISTE Phase 2)
    - src/application/encaissements/generer-quittance.ts (analog use case avec PDF + compensation + transaction Kysely)
    - src/infrastructure/repositories/encaissement-repository-sqlite.ts (analog append-only enregistrer + listerParEcheance)
    - src/infrastructure/repositories/quittance-repository-sqlite.ts (analog enregistrer avec trxArg + DbOrTrx type alias)
    - src/infrastructure/pdf/quittance-doc-def.ts (analog pdfmake structure)
    - src/infrastructure/pdf/avis-echeance-doc-def.ts (analog 2nd pdfmake doc-def — peut s'inspirer)
    - src/infrastructure/storage/stockage-fichier-local.ts (analog ecrireQuittance + lireQuittance — modèle exact pour les méthodes avenant)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections complètes 03-04)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-93 mentions PDF, D-94 5 effets, D-95 renoncer, D-96 table)
    - LOCATION_MEUBLEE_REGLES.md §Loi 89 art. 17-1 (formule + mentions avenant)
    - Tests rouges Task 1
  </read_first>
  <action>
    Créer/modifier dans cet ordre :

    1. `migrations/0009_phase3_bail_indexations.sql` :
       - En-tête commentaires alignés sur 0008.
       - `BEGIN TRANSACTION;`
       - `CREATE TABLE IF NOT EXISTS bail_indexations ( id TEXT PRIMARY KEY, bail_id TEXT NOT NULL REFERENCES bail(id), date_effet TEXT NOT NULL, irl_avant_trimestre TEXT NOT NULL, irl_avant_valeur TEXT NOT NULL, irl_apres_trimestre TEXT NOT NULL, irl_apres_valeur TEXT NOT NULL, loyer_avant_centimes INTEGER NOT NULL, loyer_apres_centimes INTEGER NOT NULL, indexation_appliquee INTEGER NOT NULL, raison_non_application TEXT NULL CHECK (raison_non_application IS NULL OR raison_non_application IN ('gel_dpe','refus_bailleur')), cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP );` — D-96.
       - `CREATE INDEX IF NOT EXISTS idx_bail_indexations_bail ON bail_indexations(bail_id, date_effet DESC);` — query Phase 5.
       - `COMMIT;`

    2. `src/infrastructure/db/kysely-types.ts` :
       - Ajouter `BailIndexationsTable { id: string; bail_id: string; date_effet: string; irl_avant_trimestre: string; irl_avant_valeur: string; irl_apres_trimestre: string; irl_apres_valeur: string; loyer_avant_centimes: number; loyer_apres_centimes: number; indexation_appliquee: 0 | 1; raison_non_application: 'gel_dpe' | 'refus_bailleur' | null; cree_le: string }` + ajouter `bail_indexations: BailIndexationsTable` à `DB`.

    3. `src/domain/_shared/identifiants.ts` (ÉTENDRE) :
       - Ajouter `BailIndexationId = string & { __brand: 'BailIndexationId' }`.
       - Ajouter `nouveauBailIndexationId(): BailIndexationId`.

    4. `src/domain/locatif/bail-indexation.ts` (NOUVEAU) :
       - Imports : `Temporal`, `InvariantViolated`, `BailId`, `BailIndexationId`, `nouveauBailIndexationId`, `Money`, `IRL`.
       - `export type RaisonNonApplication = 'gel_dpe' | 'refus_bailleur';`
       - `interface BailIndexationProps { id?: BailIndexationId; bailId: BailId; dateEffet: Temporal.PlainDate; irlAvant: IRL; irlApres: IRL; loyerAvant: Money; loyerApres: Money; indexationAppliquee: boolean; raisonNonApplication: RaisonNonApplication | null }`.
       - Classe `BailIndexation` readonly props + private constructor + `static creer(props)` :
         - Si `indexationAppliquee === true` ET `raisonNonApplication !== null` → throw InvariantViolated('Une indexation appliquée ne peut pas avoir de raison de non-application').
         - Si `indexationAppliquee === true` ET `props.loyerApres.lt(props.loyerAvant)` → throw InvariantViolated('Une indexation appliquée doit avoir un loyer après >= loyer avant (révision à la hausse ou IRL stable)').
         - Si `indexationAppliquee === false` ET `raisonNonApplication === null` → throw InvariantViolated('Une indexation non appliquée doit avoir une raison de non-application').
         - Si `indexationAppliquee === false` ET `!props.loyerApres.egale(props.loyerAvant)` → throw InvariantViolated('Une indexation non appliquée ne doit pas modifier le loyer').
         - Si `raisonNonApplication != null && !['gel_dpe','refus_bailleur'].includes(raisonNonApplication)` → throw InvariantViolated.
         - id défaut `nouveauBailIndexationId()`.
       - **Pas de méthode `annuler()`** — append-only D-96.

    5. `src/domain/locatif/bail-indexation-repository.ts` (NOUVEAU port) :
       - `export interface BailIndexationRepository { enregistrer(bi: BailIndexation, trxArg?: Kysely<DB> | Transaction<DB>): Promise<void>; trouverParId(id: BailIndexationId): Promise<BailIndexation | null>; listerParBail(bailId: BailId): Promise<BailIndexation[]>; dernierePourBail(bailId: BailId): Promise<BailIndexation | null> }`.
       - LOCKÉ : utiliser le type alias `DbOrTrx` (déjà exporté par `src/infrastructure/db/types.ts` — pattern `QuittanceRepository` Phase 2 02-04). Le port utilise donc `trxArg?: DbOrTrx` (évite import lourd Kysely dans le domaine).

    6. `src/domain/locatif/erreurs.ts` (ÉTENDRE) :
       - Ajouter `BailIndexationIntrouvable` (pattern existant).

    7. `src/domain/locatif/bail.ts` (MODIFIER — ajouter 2 méthodes APRÈS simulerIndexation créée 03-03) :
       - `appliquerIndexation(irlNouveau: IRL, dateEffet: Temporal.PlainDate): Bail` :
         - `const result = this.simulerIndexation(irlNouveau, null);` (gel pré-vérifié au use case ; null bypass le check).
         - `return Bail.creer({ ...this.toProps(), loyerHc: result.nouveauLoyerHc, irlReference: irlNouveau });`
         - (Pas d'usage de dateEffet ici — c'est métier au use case pour BailIndexation.dateEffet + régénération échéances).
       - `pivoterIrlReference(irlNouveau: IRL): Bail` :
         - `return Bail.creer({ ...this.toProps(), irlReference: irlNouveau });`

    8. `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts` (NOUVEAU) :
       - Pattern Encaissement + Quittance.
       - `enregistrer(bi, trxArg?)` : `const trx = trxArg ?? this.db;` puis `await trx.insertInto('bail_indexations').values({ id: bi.id, bail_id: bi.bailId, date_effet: bi.dateEffet.toString(), irl_avant_trimestre: bi.irlAvant.trimestre, irl_avant_valeur: bi.irlAvant.valeur, irl_apres_trimestre: bi.irlApres.trimestre, irl_apres_valeur: bi.irlApres.valeur, loyer_avant_centimes: bi.loyerAvant.toSqliteInteger(), loyer_apres_centimes: bi.loyerApres.toSqliteInteger(), indexation_appliquee: bi.indexationAppliquee ? 1 : 0, raison_non_application: bi.raisonNonApplication }).execute();` — PAS d'`onConflict` (append-only). Si même id réinséré → UNIQUE constraint violation (test T20).
       - `trouverParId(id)`, `listerParBail(bailId)` order date_effet DESC, `dernierePourBail(bailId)` limit 1 ordre date_effet DESC.
       - `versDomaine(row)` : `BailIndexation.creer({ id: row.id, bailId: row.bail_id, dateEffet: PlainDate.from(row.date_effet), irlAvant: IRL.creer({ trimestre: row.irl_avant_trimestre, valeur: row.irl_avant_valeur }), irlApres: IRL.creer({ trimestre: row.irl_apres_trimestre, valeur: row.irl_apres_valeur }), loyerAvant: Money.fromCentimes(BigInt(row.loyer_avant_centimes)), loyerApres: Money.fromCentimes(BigInt(row.loyer_apres_centimes)), indexationAppliquee: row.indexation_appliquee === 1, raisonNonApplication: row.raison_non_application });`.

    9. `src/infrastructure/pdf/avenant-irl-doc-def.ts` (NOUVEAU) :
       - `export function construireAvenantIRL(bail: Bail, locataire: Locataire, bailleur: Bailleur, irlNouveau: IRL, irlAncien: IRL, loyerAvant: Money, loyerApres: Money, dateEffet: Temporal.PlainDate): TDocumentDefinitions`.
       - Structure pdfmake conforme `quittance-doc-def.ts` :
         - `pageSize: 'A4'`, `pageMargins: [56, 56, 56, 80]`, `defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 }`.
         - Header `{ text: 'AVENANT À LA CONVENTION DE BAIL — Révision IRL', style: 'titreDoc', alignment: 'center' }` + sous-titre `'Exercice ' + dateEffet.year + ' — Bail du ' + formatDateLong(bail.dateDebut)`.
         - 2 colonnes bailleur (gauche) + locataire (droite) — adresses, noms.
         - Tableau 4 lignes : Ancien loyer HC / IRL référence (trimestre + valeur) / Nouvel IRL / Nouveau loyer HC (gras).
         - Paragraphe italics : `'Calcul : ' + loyerAvant.enEuros() + ' × (' + irlNouveau.valeur + ' / ' + irlAncien.valeur + ') = ' + loyerApres.enEuros() + ' — formule légale loi 89-462 art. 17-1.'`.
         - Date d'effet : `'Date d'effet : ' + formatDate(dateEffet)`.
         - Acceptation : `'Les parties acceptent la révision ci-dessus.'`.
         - Signature 2 colonnes : Bailleur (gauche, ligne pour signature) + Locataire (droite, ligne pour signature).
         - Footer : `{ text: 'Conformément à l\'article 17-1 de la loi n° 89-462 du 6 juillet 1989.', style: 'footer', alignment: 'center' }`.

    10. `src/infrastructure/storage/stockage-fichier-local.ts` (MODIFIER) :
        - Ajouter méthode `async ecrireAvenant(annee: number, nomFichier: string, buffer: Buffer): Promise<string>` strictement symétrique à `ecrireQuittance` (replace 'quittances' → 'avenants').
        - Ajouter méthode `async lireAvenant(cheminRelatif: string): Promise<Buffer>` strictement symétrique à `lireQuittance` (réutilise la même protection path traversal — NULL byte check + realpath boundary).
        - LOCKÉ : YAGNI — garder la duplication ecrireQuittance/ecrireAvenant pour 2 types. Phase 4 (Coffre documentaire) refactorisera en `ecrireDocument(type, annee, nomFichier, buffer)` si un 3e type apparaît.

    11. `src/application/locatif/appliquer-indexation-irl.ts` (NOUVEAU) :
        - Voir signature détaillée dans <interfaces>.
        - Réutiliser `genererEcheancesPour` de `src/application/encaissements/activer-bail.ts` (export public).
        - Pattern régénération D-73 : copier la logique exacte de Phase 2 `modifier-bail-actif.ts` (lignes 60-141 selon PATTERNS) — filtre statut + periodeDebut + pas d'encaissement actif, supprimerLot + enregistrerBatch.
        - Pattern PDF compensation : voir generer-quittance Phase 2 (essayer ; si échec → log CRITICAL ; ne PAS rollback bail_indexations append-only ; re-throw).
        - LOCKÉ : extraire un helper exporté `regenererEcheancesFuturesPourPivot(bailModifie, dateEffet, { echeanceLoyerRepo, encaissementRepo }, trx): Promise<number>` (retourne le compte d'échéances régénérées). Justification : la régénération sera également utile en Phase 5 (corrections de loyer) — pas de duplication inline dans appliquer-indexation-irl.ts.

    12. `src/application/locatif/renoncer-indexation-irl.ts` (NOUVEAU) :
        - Voir signature dans <interfaces>.
        - Use case léger : lookup + check gel + transaction (update bail.irl_reference via bail.pivoterIrlReference + insert bail_indexations).

    13. ÉTENDRE `src/application/locatif/lister-bails-indexables.ts` (créé 03-03) :
        - Maintenant que `BailIndexationRepository` existe, ajouter le filtre : pour chaque bail dont l'anniversaire est atteint, `const derniere = await bailIndexationRepo.dernierePourBail(bail.id); if (derniere && Temporal.PlainDate.compare(derniere.dateEffet, today.subtract({months: 12})) > 0) continue;` (exclure si dernière indexation < 12 mois).

    14. `src/application/locatif/lister-indexations-bail.ts` (NOUVEAU) :
        - `export async function listerIndexationsBail(bailId: BailId, bailIndexationRepo: BailIndexationRepository): Promise<BailIndexation[]> { return bailIndexationRepo.listerParBail(bailId); }`.

    15. `src/helpers/format-raison-non-application.ts` (NOUVEAU) :
        - `import type { RaisonNonApplication } from '../domain/locatif/bail-indexation.js';`
        - `const LABELS: Record<RaisonNonApplication, string> = { gel_dpe: 'Gel DPE', refus_bailleur: 'Choix du bailleur' };`
        - `export function formaterRaisonNonApplication(raison: RaisonNonApplication | null): string { return raison === null ? 'Appliquée' : LABELS[raison]; }`

    Vérifs : `pnpm tsc --noEmit` 0. `pnpm lint:deps` 0 (vérifier que `bail.ts` n'importe pas pdfmake — l'avenant builder est dans `infrastructure/`). Tests unit + integration verts.

    Commit : `feat(03-04): BailIndexation append-only + Bail.appliquerIndexation/pivoterIrlReference + use cases apply/renoncer + repo + PDF avenant + storage avenant + migration 0009 (LOC-04 apply domain + infra)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint:deps && pnpm test:unit run tests/unit/locatif/bail-indexation.test.ts tests/unit/locatif/bail-appliquer-indexation.test.ts tests/unit/locatif/appliquer-indexation-irl.test.ts tests/unit/locatif/renoncer-indexation-irl.test.ts tests/unit/helpers/format-raison-non-application.test.ts && pnpm test:integration run tests/integration/repositories/bail-indexation-repository-sqlite.test.ts tests/integration/storage/stockage-fichier-local.test.ts tests/integration/pdf/avenant-irl.test.ts</automated>
  </verify>
  <done>
    - Migration 0009 idempotente + Kysely types étendus.
    - BailIndexation agrégat append-only avec invariants stricts (pas de méthode annuler).
    - Bail.appliquerIndexation + pivoterIrlReference (2 méthodes copy-on-write).
    - BailIndexationRepositorySqlite (enregistrer trxArg + lookup variants).
    - Avenant PDF builder pdfmake conforme mentions loi 89 art. 17-1.
    - StockageFichierLocal étendu (ecrireAvenant + lireAvenant symétriques).
    - 2 use cases (appliquer transactionnel + renoncer léger) + extension listerBailsIndexables + listerIndexationsBail.
    - 1 helper preHandler.
    - Tests unit + integration VERTS.
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Routes wizard IRL étapes 4-5 + GET avenant PDF + vue confirmation.ejs + extension fiche Bail (historique indexations) + BDD LOC-04 apply verts</name>
  <read_first>
    - src/web/routes/indexations.ts (état après 03-03 — étendre avec apply/renoncer/avenant)
    - src/web/routes/quittances.ts (analog GET /quittances/:id/pdf pattern download)
    - src/web/views/pages/baux/indexer/simulation.ejs (créé 03-03 — bouton "Confirmer les valeurs" doit pointer vers confirmation.ejs OU directement vers POST appliquer si étape 4 est inline avec étape 3 — DÉCISION EXECUTOR)
    - src/web/views/pages/baux/indexer/saisie.ejs (créé 03-03)
    - src/web/views/pages/baux/detail.ejs (état après 03-02/03-03 — ajouter section Historique indexations)
    - src/web/views/partials/wizard-irl-layout.ejs (créé 03-03 — étapes 4 + 5 à exposer)
    - src/web/views/partials/data-table.ejs (analog pour table historique)
    - src/web/views/partials/confirm-dialog.ejs (analog modale confirmation potentielle)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md (sections : §LOC-04 wizard étapes 4-5 + Copywriting "Appliquer la révision" + "Ne pas indexer cette année" + paragraphe D-95 exact + Avenant PDF header + Historique indexations table + Empty States)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : routes/indexations + views confirmation + simulation)
    - Tests rouges BDD Task 1
  </read_first>
  <action>
    Créer/modifier :

    1. ÉTENDRE `src/web/schemas/indexation-schemas.ts` :
       - Ajouter `indexationConfirmationSchema = z.object({})` (formulaire vide — l'IRL est dans session.indexationDraft). Validation server-side via lookup session.
       - Pas de nouveau schema spécifique pour renoncer (réutilise indexationConfirmationSchema).

    2. ÉTENDRE `src/web/routes/indexations.ts` :
       - **POST /baux/:id/indexer/appliquer** :
         - Lookup bail + bien + indexationDraft (session).
         - Si !indexationDraft → redirect /baux/:id/indexer avec banniereWarning 'Veuillez saisir un IRL.'.
         - try `const { bailIndexationId, nouveauLoyerHc, cheminFichierRelatifAvenant } = await appliquerIndexationIRL({ bailId: id as BailId, irlTrimestre: indexationDraft.irlTrimestre, irlValeur: indexationDraft.irlValeur }, { bailRepo, bienRepo, locataireRepo, bailleurRepo, echeanceLoyerRepo, encaissementRepo, bailIndexationRepo }, { pdfRenderer, stockage, clock }, db);`
         - Clear `req.session.indexationDraft = undefined;`.
         - `req.session.banniereSuccess = 'Révision IRL appliquée avec succès. Nouveau loyer : ' + nouveauLoyerHc.enEuros() + '. Avenant disponible au téléchargement.';`
         - redirect `/baux/:id`.
         - Catch `GelLoyerClimatActif` → 403 + render gel-loyer.ejs.
         - Catch autre (InvariantViolated, etc.) → log + redirect /baux/:id/indexer avec banniereWarning err.message.
       - **POST /baux/:id/indexer/renoncer** :
         - Lookup bail + bien + indexationDraft.
         - Si !indexationDraft → redirect.
         - try `await renoncerIndexationIRL({ bailId: id as BailId, irlTrimestre, irlValeur }, { bailRepo, bienRepo, bailIndexationRepo }, db);`
         - Clear session.
         - `req.session.banniereSuccess = 'Révision IRL non appliquée — l\'IRL de référence est mis à jour pour la prochaine révision.';`
         - redirect `/baux/:id`.
         - Catch idem.
       - **GET /baux/:id/avenant/:annee** :
         - `const annee = parseInt(req.params.annee, 10);`
         - Lookup bail (404 si absent).
         - `const indexations = await bailIndexationRepo.listerParBail(bail.id);`
         - `const indexation = indexations.find(i => i.dateEffet.year === annee && i.indexationAppliquee);`
         - Si null → 404 'Aucun avenant pour cette année.'.
         - `const bailIdCourt = bail.id.slice(0, 8); const nomFichier = 'avenant-' + bailIdCourt + '-' + indexation.dateEffet.toString() + '.pdf'; const cheminRelatif = 'avenants/' + annee + '/' + nomFichier;`
         - try `const buffer = await stockage.lireAvenant(cheminRelatif);` puis `reply.header('Content-Type', 'application/pdf').header('Content-Disposition', 'attachment; filename="' + nomFichier + '"').send(buffer);`.
         - catch `FichierIntrouvable` → 404 'Fichier PDF avenant introuvable. Régénérez en relançant la révision IRL.'.

    3. `src/web/views/pages/baux/indexer/confirmation.ejs` (NOUVEAU — étape 4) :
       - layout-debut + wizard-irl-layout (currentStep: 4).
       - `<h1>Confirmer la révision IRL</h1>`.
       - Tableau récapitulatif (réutilise structure simulation.ejs ou inclut un partial commun).
       - Paragraphe D-95 EXACT wording UI-SPEC L311-313 : `<p><em>Vous pouvez renoncer à la révision annuelle. Le loyer reste inchangé. L'IRL de référence est tout de même mis à jour afin que la prochaine révision parte de la bonne base (sinon vous resteriez bloqué indéfiniment sur l'ancien indice).</em></p>`.
       - 2 formulaires côte à côte :
         - `<form method="POST" action="/baux/<%= bail.id %>/indexer/appliquer"><button type="submit">Appliquer la révision</button></form>`
         - `<form method="POST" action="/baux/<%= bail.id %>/indexer/renoncer"><button type="submit" class="secondary">Ne pas indexer cette année</button></form>`
       - `<a href="/baux/<%= bail.id %>/indexer" role="button" class="contrast">Retour</a>`.
       - layout-fin.

    4. ÉTENDRE `src/web/routes/indexations.ts` `POST /baux/:id/indexer/confirmer` (créée stub 03-03) pour render `confirmation.ejs` complet (étape 4 avec 2 boutons).

    5. ÉTENDRE `src/web/views/pages/baux/detail.ejs` :
       - Après section EDL (créée 03-02), ajouter section `<section aria-labelledby="indexations-heading"><h2 id="indexations-heading">Historique des indexations IRL</h2>` :
         - La route GET /baux/:id doit charger `const indexations = await bailIndexationRepo.listerParBail(bail.id);` et passer en locals.
         - Si `indexations.length === 0` → `<%- include('../partials/empty-state', { heading: 'Aucune révision IRL enregistrée', body: 'L\'indexation annuelle est une faculté du bailleur. Lancez la révision à la date anniversaire du bail.', ctaHref: '/baux/' + bail.id + '/indexer', ctaLabel: 'Lancer la révision' }) %>` (CTA conditionnel si bailIndexable).
         - Sinon : `<table role="table" aria-label="Historique des révisions IRL"><caption class="sr-only">Historique des révisions IRL</caption><thead><tr><th>Date d'effet</th><th>IRL avant</th><th>IRL après</th><th>Loyer avant</th><th>Loyer après</th><th>Appliquée</th><th>Avenant</th></tr></thead><tbody><% indexations.forEach(function(i) { %><tr><td><%= formatDate(i.dateEffet) %></td><td><%= formaterTrimestreIRL(i.irlAvant.trimestre) %> — <%= i.irlAvant.valeur %></td><td><%= formaterTrimestreIRL(i.irlApres.trimestre) %> — <%= i.irlApres.valeur %></td><td><%= formatMoney(i.loyerAvant) %></td><td><%= formatMoney(i.loyerApres) %></td><td><%= formaterRaisonNonApplication(i.raisonNonApplication) %></td><td><% if (i.indexationAppliquee) { %><a href="/baux/<%= bail.id %>/avenant/<%= i.dateEffet.year %>">Télécharger PDF</a><% } else { %>—<% } %></td></tr><% }); %></tbody></table>`
       - `</section>`

    6. ÉTENDRE `src/web/routes/baux.ts` :
       - GET /baux/:id : ajouter `const indexations = await opts.bailIndexationRepo.listerParBail(id as BailId);` (injecter bailIndexationRepo).

    7. ÉTENDRE `src/main.ts` :
       - Imports `BailIndexationRepositorySqlite`, `formaterRaisonNonApplication`.
       - Instancier `const bailIndexationRepo = new BailIndexationRepositorySqlite(db);`.
       - Hook preHandler : injecter `formaterRaisonNonApplication` dans reply.locals.
       - Étendre register de `baux` et `indexations` plugins avec `bailIndexationRepo`, `pdfRenderer`, `stockage`, `db`.
       - Étendre register avec `locataireRepo`, `bailleurRepo`, `echeanceLoyerRepo`, `encaissementRepo` (déjà existants Phase 2 — vérifier).

    8. ÉTENDRE `tests/bdd/step_definitions/indexation-irl.steps.ts` avec steps `@loc-04-apply`.

    Sécurité (cf. <threat_model>) :
    - Path traversal sur GET avenant : nomFichier construit à partir de `bail.id.slice(0,8)` (brand BailId — UUID v4) + `dateEffet.toString()` (ISO YYYY-MM-DD) — pas d'input user direct. + `stockage.lireAvenant` vérifie boundary (Phase 2 pattern).
    - PDF immutable : `fs.writeFile flag: 'wx'` (rejette si fichier existant — D-63).
    - Defense en profondeur gel : check Bien.estGelLoyer() au use case appliquer + renoncer (T-03-04-01).
    - Transaction atomique : 5 effets ou 0 effet (T-03-04-02).
    - Append-only : pas d'UPDATE bail_indexations sans nouvelle ligne (T-03-04-03).

    Vérifs : `pnpm test:bdd -- --tags @loc-04-apply` 5 scenarios VERTS. `pnpm test` complet VERT. `pnpm tsc --noEmit` 0. `pnpm lint` 0.

    Commit : `feat(03-04): routes appliquer/renoncer + GET avenant PDF + confirmation.ejs + historique indexations sur fiche Bail + BDD LOC-04 apply (vert)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && pnpm lint:deps && pnpm test && pnpm test:bdd -- --tags @loc-04-apply</automated>
  </verify>
  <done>
    - 3 routes (POST appliquer + POST renoncer + GET avenant PDF download).
    - confirmation.ejs étape 4 wizard avec 2 boutons + paragraphe D-95 exact + retour.
    - Extension simulation.ejs : bouton "Confirmer les valeurs" pointe vers POST /indexer/confirmer.
    - Section historique indexations sur fiche Bail + data-table avec téléchargement avenant.
    - main.ts wiring complet (3 nouveaux repos/services).
    - 5 scenarios BDD @loc-04-apply verts.
    - Tous tests existants toujours verts.
    - Commit créé.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigateur user → Fastify POST /baux/:id/indexer/appliquer | Aucun input direct (lookup session.indexationDraft) ; defense gel server-side |
| navigateur user → Fastify GET /baux/:id/avenant/:annee | Input `annee` parsé int (NaN rejeté) ; nom fichier construit serveur (pas d'input direct) |
| Fastify → SQLite (transaction Kysely 5 effets) | Tout ou rien (transaction.execute) |
| Fastify → pdfmake → filesystem (~/.../avenants/) | Path traversal critique — sanitisation BailId UUID + dateEffet ISO |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03-04-01 | Tampering | User force POST /baux/:id/indexer/appliquer avec Bien classeDpe=F (bypass UI gel) | HIGH | mitigate | Use case `appliquerIndexationIRL` check `bien.estGelLoyer()` AVANT toute transaction → throw `GelLoyerClimatActif`. Route catch → 403 + render gel-loyer.ejs. Tests T12 + T32. |
| T-03-04-02 | Integrity — transaction partielle | Crash après bail.enregistrer mais avant bail_indexations.enregistrer → bail loyer modifié sans trace | HIGH | mitigate | Tout opéré dans `db.transaction().execute(async (trx) => {...})` (5 effets) — atomique. Better-sqlite3 mono-process. Si crash → rollback automatique. |
| T-03-04-03 | Tampering | User modifie bail_indexations en DB directement → historique falsifié | LOW | accept | Mono-user V1. L'append-only est une convention applicative (CHECK constraints possibles mais ajoutent du noise). Si l'user modifie sa DB, c'est son audit. |
| T-03-04-04 | Path traversal | Construction nomFichier avenant — bailId.slice(0,8) ou dateEffet manipulé | HIGH | mitigate | BailId est brand type UUID v4 (Phase 1) — pas d'input user. dateEffet est `Temporal.PlainDate` (pas de string user). slugify whitelist en cas de doute. `lireAvenant` vérifie `resolved.startsWith(baseDir)` (pattern Phase 2). |
| T-03-04-05 | Integrity — écrasement PDF | 2 applications même bail/date → écrasement avenant | HIGH | mitigate | `fs.writeFile flag: 'wx'` rejette si existant. UNIQUE INDEX optionnel (bail_id, date_effet) sur bail_indexations (DÉCISION EXECUTOR : ajouter à la migration ou pas — cohérence avec append-only). Recommandation : oui, ajouter UNIQUE pour éviter double apply accidentel même jour. |
| T-03-04-06 | DoS — bail avec 100 indexations | Régénération scanne 100 échéances pour chaque indexation | LOW | accept | Mono-user, durée bail 12-36 mois. Max ~10 indexations sur la vie d'un bail. Acceptable. |
| T-03-04-07 | Integrity — échéances passées modifiées | Régénération D-73 supprime des échéances payées par erreur | HIGH | mitigate | Pattern strict D-73 Phase 2 : filtre `statut ∈ {'en_attente','partiellement_payee'} && periodeDebut >= dateEffet && !aDesEncaissementsActifs`. Tests T11 + T31 vérifient échéances passées intactes. |
| T-03-04-08 | Repudiation — avenant PDF perdu | Crash après commit DB mais avant écriture fichier → indexation DB sans PDF | MED | mitigate | Pattern compensation Phase 2 : log CRITICAL + route GET /baux/:id/avenant/:annee tente regenerate à la volée si fichier absent (alternative future). V1 : log + erreur 404 + message UI "Régénérez en relançant la révision". |
| T-03-04-09 | Information disclosure | Avenant PDF d'un autre bail accédé via GET /baux/X/avenant/2026 | LOW | accept | Mono-user V1. |
| T-03-04-10 | Tampering — IRL forcé après confirmation | User modifie session.indexationDraft (XSS) entre confirmer et appliquer | MED | mitigate | Session Fastify cookie SIGNÉ (Phase 1 D-18). Modification cliente → signature invalide → 403. |
</threat_model>

<verification>
- `pnpm tsc --noEmit` exit 0
- `pnpm lint` 0 warning
- `pnpm lint:deps` 0 violation (avenant-irl-doc-def.ts en infrastructure, pas importé par domain)
- `pnpm test:unit` VERT (BailIndexation, Bail.appliquerIndexation, use cases apply/renoncer, helper)
- `pnpm test:integration` VERT (repo append-only, storage avenant, PDF buffer mentions loi 89)
- `pnpm test:bdd -- --tags @loc-04-apply` 5 scenarios PASSED
- Migration 0009 idempotente
- Pas de régression Phase 1/2/3-01/3-02/3-03 : `pnpm test` complet VERT
- Money.multiplyByFraction toujours invariant 0 ≤ num ≤ den (non-régression critique)
- Avenant PDF contient toutes mentions loi 89 art. 17-1 (vérifié test buffer T27)
- Échéances passées + payées intactes après régénération (test T11 + T31)
- BailIndexation jamais update (test T20 + dependency-cruiser)
</verification>

<success_criteria>
- LOC-04 complet : workflow IRL 5 étapes opérationnel — banner, saisie, simulation, confirmation (Appliquer/Ne pas indexer), résultat + avenant PDF téléchargeable.
- D-93 satisfait : PDF avenant avec mentions obligatoires loi 89 art. 17-1.
- D-94 satisfait : 5 effets atomiques transactionnels (bail pivot + échéances régénérées + BailIndexation + PDF avenant + retour).
- D-95 satisfait : option "Ne pas indexer cette année" (pivot IRL sans changement loyer, pas de PDF, ligne BailIndexation marker).
- D-96 satisfait : table bail_indexations append-only avec query Phase 5.
- DP-18 helper formaterRaisonNonApplication ajouté (6e helper sur 6 — DP-18 entièrement résolu).
- Defense en profondeur LOC-05 : check Bien.estGelLoyer() côté serveur (T-03-04-01).
- Pattern D-73 Phase 2 réutilisé pour régénération échéances futures (T-03-04-07).
- Domain pur (vérifié dependency-cruiser).
- 6 helpers DP-18 complets dans le projet (formaterClasseDpe, formaterTypeDiagnostic, formaterStatutDiagnostic, formaterEtatItem, formaterTypeItemInventaire, formaterTrimestreIRL, formaterRaisonNonApplication — note : 7 helpers ajoutés au total, dépasse les 6 listés UI-SPEC, à voir avec le planner si on en consolide ; recommandation : conserver les 7).
</success_criteria>

<output>
After completion, create `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-04-SUMMARY.md` listant :
- 3 commits (tests rouges / domain+app+infra / web+BDD)
- Patterns établis : agrégat append-only sans annuler (BailIndexation), use case transactionnel multi-repos avec compensation hors transaction pour PDF, helper réutilisable régénération échéances futures (pour Phase 4+ travaux + ajustements bail), wizard EJS multi-étapes avec session draft, PDF builder pdfmake pattern, storage immutable avec path traversal protection
- Dépendances pour plans suivants : Phase 5 (fiscalité) consomme bail_indexations pour historique recettes liasse 2031 ; 03-05 (UI polish) audit accessibilité wizard IRL + section historique indexations
- Notes : 7 helpers preHandler créés au total (UI-SPEC listait 6, on ajoute formaterStatutDiagnostic pour cohérence avec partial-diagnostic-row)
</output>

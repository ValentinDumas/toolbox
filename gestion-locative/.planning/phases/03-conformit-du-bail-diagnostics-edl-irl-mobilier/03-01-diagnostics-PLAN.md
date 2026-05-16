---
phase: 03
plan: 01
plan_id: "03-01"
type: execute
wave: 1
depends_on: []
files_modified:
  - migrations/0007_phase3_diagnostics.sql
  - src/infrastructure/db/kysely-types.ts
  - src/domain/_shared/identifiants.ts
  - src/domain/_shared/duree-validite-diagnostic.ts
  - src/domain/patrimoine/diagnostic.ts
  - src/domain/patrimoine/bien.ts
  - src/domain/patrimoine/bien-repository.ts
  - src/domain/patrimoine/erreurs.ts
  - src/infrastructure/repositories/bien-repository-sqlite.ts
  - src/application/patrimoine/ajouter-diagnostic.ts
  - src/application/patrimoine/lister-diagnostics.ts
  - src/web/schemas/diagnostic-schemas.ts
  - src/web/routes/diagnostics.ts
  - src/web/views/pages/biens/diagnostics/formulaire.ejs
  - src/web/views/pages/biens/detail.ejs
  - src/web/views/partials/partial-badge-dpe.ejs
  - src/web/views/partials/partial-diagnostic-row.ejs
  - src/web/views/partials/empty-state.ejs
  - src/helpers/format-classe-dpe.ts
  - src/helpers/format-type-diagnostic.ts
  - src/helpers/format-statut-diagnostic.ts
  - src/main.ts
  - tests/_builders/patrimoine.ts
  - tests/unit/patrimoine/diagnostic.test.ts
  - tests/unit/patrimoine/bien-ajouter-diagnostic.test.ts
  - tests/unit/helpers/format-classe-dpe.test.ts
  - tests/unit/helpers/format-type-diagnostic.test.ts
  - tests/unit/helpers/format-statut-diagnostic.test.ts
  - tests/integration/repositories/bien-repository-sqlite-diagnostics.test.ts
  - tests/bdd/features/diagnostics.feature
  - tests/bdd/step_definitions/diagnostics.steps.ts
  - tests/_world/monde-phase3.ts
autonomous: true
requirements: ["PAT-03"]
user_setup: []

mvp_split_rationale: |
  Vertical slice PAT-03 : du formulaire HTML jusqu'à la persistance SQLite.
  Plan autonome (wave 1, aucune dépendance) — Diagnostic est un sous-agrégat
  pur de Bien (pattern Lot D-29 Phase 1). Pas d'EDL ni d'IRL ici — séparation
  stricte par REQ. Plan 03-02 (EDL/mobilier) et 03-03 (simulation IRL) dépendent
  de classeDpe créé ici pour D-92 (gel loyer).

must_haves:
  truths:
    - "L'utilisateur peut accéder à GET /biens/:id/diagnostics/nouveau et enregistrer un Diagnostic (type ∈ {dpe, gaz, elec, erp}) avec date_emission obligatoire."
    - "La date_expiration est calculée automatiquement par le domaine selon DUREES_VALIDITE (DPE 10 ans, gaz 6 ans, élec 6 ans, ERP null = illimitée) — D-77."
    - "Pour un Diagnostic de type 'dpe', le champ classe_dpe (A..G) est obligatoire et Bien.ajouterDiagnostic(d) synchronise automatiquement Bien.classeDpe avec d.classeDpe — DP-14 résolu."
    - "Diagnostic est un sous-agrégat de Bien (entité avec DiagnosticId, pas d'agrégat racine séparé, pas de DiagnosticRepository) — D-76."
    - "Diagnostics stockés dans une table dédiée 'diagnostics' avec FK bien_id (PAS JSON inline) — DP-15 résolu (queryability Phase 7 dashboard expirés)."
    - "Bien.diagnosticActif(type) retourne le Diagnostic non expiré le plus récent pour ce type, ou null — D-79."
    - "Bien.estGelLoyer() retourne true si classeDpe ∈ {F, G}, false sinon — D-92 (consommé Phase 3-03 par simulerIndexation)."
    - "L'historique complet des diagnostics est conservé (jamais de SUPPRIMER en V1) — D-79 (traçabilité plus-value LF 2025)."
    - "La fiche /biens/:id affiche une section <h2>Diagnostics</h2> avec table des diagnostics (Type / Date émission / Date expiration / Statut) triée par date_emission desc + bouton 'Ajouter un diagnostic'."
    - "Un diagnostic expiré affiche le badge rouge 'Expiré le {date}' + banniere-warning non bloquante en haut de section — D-80 (jamais bloquant)."
    - "Le badge DPE (partial-badge-dpe.ejs) utilise les 7 couleurs UI-SPEC L101-114 (A vert, B vert clair, C jaune-vert, D ambre, E orange, F rouge, G rouge foncé) + texte 'DPE {classe}' + aria-label — pair color+texte (WCAG 1.4.1)."
    - "Empty state si aucun diagnostic : heading + body + CTA 'Ajouter un diagnostic' — UI-SPEC §Empty States."
    - "BienRepository étendu : versDomaine reconstruit bien.diagnostics[] via SELECT diagnostics WHERE bien_id = ?, versRow persiste via purge + réinsertion atomique en transaction (pattern Lot 01-03)."
    - "BDD @pat-03 : 5 scenarios verts couvrant calcul date_expiration par type, classe_dpe auto-sync, historique préservé, badge expiré non bloquant, gel loyer (Bien.estGelLoyer())."
  artifacts:
    - path: "migrations/0007_phase3_diagnostics.sql"
      provides: "Table diagnostics + ALTER bien ADD classe_dpe + index expirations"
      contains: "CREATE TABLE IF NOT EXISTS diagnostics, ALTER TABLE bien ADD COLUMN classe_dpe"
    - path: "src/domain/_shared/duree-validite-diagnostic.ts"
      provides: "Constante DUREES_VALIDITE codée dans le domaine (versionneable LF annuelle R1.1)"
      exports: ["TypeDiagnostic", "DUREES_VALIDITE", "CLASSES_DPE", "ClasseDpe"]
    - path: "src/domain/patrimoine/diagnostic.ts"
      provides: "Sous-agrégat Diagnostic + factory creer() + invariants + estExpire(today)"
      exports: ["Diagnostic"]
    - path: "src/domain/patrimoine/bien.ts"
      provides: "Bien étendu : diagnostics[] + classeDpe + ajouterDiagnostic + diagnosticActif + estGelLoyer"
      exports: ["Bien"]
    - path: "src/application/patrimoine/ajouter-diagnostic.ts"
      provides: "Use case ajouterDiagnostic (lookup bien + Bien.ajouterDiagnostic + repo.enregistrer)"
      exports: ["ajouterDiagnostic"]
    - path: "src/application/patrimoine/lister-diagnostics.ts"
      provides: "Use case read-only listerDiagnostics(bienId) → Diagnostic[] triés date_emission desc"
      exports: ["listerDiagnostics"]
    - path: "src/web/routes/diagnostics.ts"
      provides: "Plugin Fastify : GET /biens/:id/diagnostics/nouveau, POST /biens/:id/diagnostics"
      exports: ["plugin"]
    - path: "src/web/views/partials/partial-badge-dpe.ejs"
      provides: "Badge DPE coloré avec aria-label (7 couleurs UI-SPEC L101-114)"
    - path: "src/helpers/format-classe-dpe.ts"
      provides: "Helper preHandler formaterClasseDpe(classe) — DP-18"
      exports: ["formaterClasseDpe"]
    - path: "src/helpers/format-type-diagnostic.ts"
      provides: "Helper preHandler formaterTypeDiagnostic(type) — DP-18"
      exports: ["formaterTypeDiagnostic"]
    - path: "src/helpers/format-statut-diagnostic.ts"
      provides: "Helper preHandler formaterStatutDiagnostic(dateExp, today) — DP-18"
      exports: ["formaterStatutDiagnostic"]
    - path: "tests/_world/monde-phase3.ts"
      provides: "Cucumber World Phase 3 — réutilisable plans 03-02..03-05"
      exports: ["MondePhase3"]
  key_links:
    - from: "src/domain/patrimoine/bien.ts"
      to: "src/domain/patrimoine/diagnostic.ts"
      via: "Bien.diagnostics: readonly Diagnostic[] + ajouterDiagnostic(d) copy-on-write"
      pattern: "ajouterDiagnostic"
    - from: "src/domain/patrimoine/bien.ts"
      to: "src/domain/_shared/duree-validite-diagnostic.ts"
      via: "Bien.classeDpe: ClasseDpe | null + Bien.estGelLoyer() === (classeDpe === 'F' || classeDpe === 'G')"
      pattern: "estGelLoyer"
    - from: "src/infrastructure/repositories/bien-repository-sqlite.ts"
      to: "src/domain/patrimoine/diagnostic.ts"
      via: "versDomaine SELECT diagnostics + versRow purge+réinsert dans transaction Kysely"
      pattern: "diagnostics_versDomaine"
    - from: "src/web/routes/diagnostics.ts"
      to: "src/application/patrimoine/ajouter-diagnostic.ts"
      via: "POST /biens/:id/diagnostics appelle ajouterDiagnostic({bienId, type, dateEmission, classeDpe?}, bienRepo)"
      pattern: "ajouterDiagnostic"
    - from: "src/web/views/pages/biens/detail.ejs"
      to: "src/web/views/partials/partial-badge-dpe.ejs"
      via: "<%- include('../../partials/partial-badge-dpe', { classe: bien.classeDpe }) %>"
      pattern: "partial-badge-dpe"
---

<objective>
Vertical slice PAT-03 : stockage des diagnostics (DPE, gaz, élec, ERP) avec calcul automatique de la date d'expiration selon la durée légale + synchronisation Bien.classeDpe au DPE ajouté. Première brique de la conformité juridique du bail meublé.

Purpose: PAT-03 satisfait l'obligation de DDT (dossier de diagnostic technique annexé au bail — loi 89-462 + Code de la construction L126-26 / R134-6 / R134-10). Le champ Bien.classeDpe alimente Phase 3-03 (gel loyer Climat F/G — décret 2022-1313 / LOC-05). L'historique complet (D-79) trace l'évolution énergétique avant/après travaux pour Phase 5 (amortissement par composant) et Phase 7 (plus-value LF 2025).
Output: Section Diagnostics sur la fiche Bien + formulaire ajout + badge DPE coloré + warning expiration non bloquant + Bien.estGelLoyer() consommable par 03-03.
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md
@.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md
@.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md
@CLAUDE.md
@BDD_PRACTICES.md
@SOFTWARE_CRAFTSMANSHIP.md
@DDD.md
@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md
@LOCATION_MEUBLEE_REGLES.md
@src/domain/_shared/identifiants.ts
@src/domain/_shared/clock.ts
@src/domain/_shared/erreurs.ts
@src/domain/patrimoine/bien.ts
@src/domain/patrimoine/lot.ts
@src/domain/patrimoine/bien-repository.ts
@src/domain/patrimoine/erreurs.ts
@src/infrastructure/repositories/bien-repository-sqlite.ts
@src/web/routes/biens.ts
@src/web/schemas/bien-schemas.ts
@src/web/views/pages/biens/detail.ejs
@src/web/views/pages/biens/formulaire.ejs
@src/web/views/partials/empty-state.ejs
@src/web/views/partials/banniere-warning.ejs
@src/web/views/partials/data-table.ejs
@src/web/views/partials/form-field.ejs
@src/helpers/format-date.ts
@src/helpers/format-money.ts
@src/main.ts
@migrations/0001_init.sql
@tests/_builders/patrimoine.ts
@tests/unit/patrimoine/bien.test.ts
</context>

<interfaces>
Contrats clés Phase 1 (réutilisés tels quels) :

- `BienId` (brand type) : déjà exporté depuis `src/domain/_shared/identifiants.ts` avec générateur `nouveauBienId()`. **À étendre** : ajouter `DiagnosticId` + `nouveauDiagnosticId()` selon le pattern existant `LotId` / `nouveauLotId()`.
- `Clock` port (`src/domain/_shared/clock.ts`) : `aujourdhui(): Temporal.PlainDate` — utilisé pour `Diagnostic.estExpire(today)` (déterminisme BDD).
- `Bien` factory : `Bien.creer({ id?, adresse, surface, type, anneeConstruction, lots, diagnostics?, classeDpe? })` doit accepter les nouveaux champs (defaults `[]` / `null`) sans casser Phase 1.
- `Bien.ajouterLot(lot)` (lines 81-90 actuel) : modèle copy-on-write — `ajouterDiagnostic` suit le même pattern.
- `InvariantViolated` (`src/domain/_shared/erreurs.ts`) : exception domain pour invariants violés.
- `BienIntrouvable` (`src/domain/patrimoine/erreurs.ts`) : déjà exportée Phase 1, réutilisée par le use case.

Nouveaux contrats Phase 3-01 (exposés aux plans suivants) :

- `TypeDiagnostic = 'dpe' | 'gaz' | 'elec' | 'erp'` (`src/domain/_shared/duree-validite-diagnostic.ts`).
- `ClasseDpe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'` (idem fichier).
- `DUREES_VALIDITE: Record<TypeDiagnostic, { annees: number | null }>` : `{ dpe: { annees: 10 }, gaz: { annees: 6 }, elec: { annees: 6 }, erp: { annees: null } }`.
- `Diagnostic` agrégat : props readonly `{ id: DiagnosticId, type: TypeDiagnostic, dateEmission: Temporal.PlainDate, dateExpiration: Temporal.PlainDate | null, classeDpe: ClasseDpe | null }`.
  - `Diagnostic.creer({ id?, type, dateEmission, classeDpe? })` :
    - Valide `type ∈ TypeDiagnostic`.
    - Si `type === 'dpe'` ET `classeDpe` absent → throw InvariantViolated('La classe DPE est obligatoire pour un diagnostic DPE').
    - Si `type !== 'dpe'` ET `classeDpe` présent → throw InvariantViolated('La classe DPE n\'est pertinente que pour le diagnostic DPE').
    - Calcule `dateExpiration` : `DUREES_VALIDITE[type].annees === null ? null : dateEmission.add({ years: DUREES_VALIDITE[type].annees })`.
    - `id` défaut `nouveauDiagnosticId()`.
  - `Diagnostic.estExpire(today: Temporal.PlainDate): boolean` : `dateExpiration !== null && Temporal.PlainDate.compare(today, dateExpiration) > 0`.
- `Bien` étendu :
  - `readonly diagnostics: ReadonlyArray<Diagnostic>` (défaut `[]`).
  - `readonly classeDpe: ClasseDpe | null` (défaut `null`).
  - `ajouterDiagnostic(d: Diagnostic): Bien` — copy-on-write via `Bien.creer({...this.toProps(), diagnostics: [...this.diagnostics, d], classeDpe: d.type === 'dpe' ? d.classeDpe : this.classeDpe })`. Synchronisation interne D-78/DP-14.
  - `diagnosticActif(type: TypeDiagnostic): Diagnostic | null` — `this.diagnostics.filter(d => d.type === type).sort((a, b) => Temporal.PlainDate.compare(b.dateEmission, a.dateEmission))[0] ?? null`.
  - `estGelLoyer(): boolean` — `this.classeDpe === 'F' || this.classeDpe === 'G'`.
  - Pas de `supprimerDiagnostic` V1 (D-79 historique).
- `ajouterDiagnostic(commande: { bienId, type, dateEmission, classeDpe? }, bienRepo: BienRepository): Promise<DiagnosticId>` — use case multi-step :
  1. `bien = await bienRepo.trouverParId(commande.bienId)` → throw `BienIntrouvable` si null.
  2. `diagnostic = Diagnostic.creer({...})` — peut throw `InvariantViolated`.
  3. `bienModifie = bien.ajouterDiagnostic(diagnostic)`.
  4. `await bienRepo.enregistrer(bienModifie)` — pattern existant Phase 1 (persistance complète de l'agrégat).
  5. Return `diagnostic.id`.
- `BienRepositorySqlite.enregistrer(bien)` (étendu) :
  - Lectures de la table `bien` : ajoute `classe_dpe` au SELECT, set sur `Bien.creer({...})`.
  - Écritures : INSERT/UPDATE bien + DELETE diagnostics WHERE bien_id = id + INSERT batch des diagnostics actuels.
  - Tout dans `db.transaction().execute(async (trx) => {...})` (pattern Lot 01-03 — purge + réinsert atomique).
  - `versDomaine(bienRow)` : appelle `await trx.selectFrom('diagnostics').where('bien_id', '=', bienRow.id).orderBy('date_emission', 'desc').selectAll().execute()` puis `Diagnostic.creer({...})` pour chaque row.
- Routes Fastify (`src/web/routes/diagnostics.ts`) :
  - `GET /biens/:id/diagnostics/nouveau` : lookup bien (404 si absent), render `pages/biens/diagnostics/formulaire.ejs` avec `{ bien, valeurs: {}, erreurs: {} }`.
  - `POST /biens/:id/diagnostics` : `safeParse(diagnosticCreationSchema)`. Si !success → re-render formulaire avec `erreurs`. Si success → try `await ajouterDiagnostic({...}, opts.bienRepo)` puis `req.session.banniereSuccess = "Diagnostic enregistré."` + redirect `/biens/:id`. Catch `InvariantViolated | BienIntrouvable` → re-render avec erreurs.
- Zod schema (`src/web/schemas/diagnostic-schemas.ts`) :
  ```
  diagnosticCreationSchema = z.object({
    type: z.enum(['dpe','gaz','elec','erp'], { errorMap: ... }),
    date_emission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, ...),
    classe_dpe: z.enum(['A','B','C','D','E','F','G']).optional(),
  }).superRefine((data, ctx) => {
    if (data.type === 'dpe' && !data.classe_dpe) ctx.addIssue({ code: 'custom', path: ['classe_dpe'], message: 'La classe DPE est obligatoire pour un diagnostic DPE.' });
    if (data.type !== 'dpe' && data.classe_dpe) ctx.addIssue({ code: 'custom', path: ['classe_dpe'], message: 'La classe DPE n\'est pertinente que pour le diagnostic DPE.' });
  })
  ```
- Helpers preHandler (injectés dans `reply.locals` via `app.addHook('preHandler', ...)` dans `main.ts`) :
  - `formaterClasseDpe(classe: ClasseDpe | null): string` — `null` → `'Non renseignée'`, sinon `'DPE ' + classe`. Pour le wording UI complet utiliser le partial `partial-badge-dpe.ejs` (avec couleur).
  - `formaterTypeDiagnostic(type: TypeDiagnostic): string` — `'dpe'` → `'DPE'`, `'gaz'` → `'Gaz'`, `'elec'` → `'Électricité'`, `'erp'` → `'ERP (risques et pollutions)'`.
  - `formaterStatutDiagnostic(dateExp: Temporal.PlainDate | null, today: Temporal.PlainDate): string` — `null` → `'Illimitée (ERP)'`, `dateExp < today` → `'Expiré le ' + formatDate(dateExp)`, sinon → `'Valide jusqu\'au ' + formatDate(dateExp)`. Le hook preHandler doit injecter `today = clock.aujourdhui()` pour que les vues l'appellent comme `formaterStatutDiagnostic(d.dateExpiration, today)`.
- Cucumber World Phase 3 (`tests/_world/monde-phase3.ts`) : pattern strict `MondePhase2` (Phase 2 plan 02-01). Champs : `sqlite`, `db`, `clockIso`, `app`, `bienId`, `bailId`, `diagnosticIds[]`. Tag isolation `Before({ tags: '@phase3' })`.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests rouges Wave 0 — Diagnostic domain + Bien.ajouterDiagnostic + helpers + integration repo + BDD PAT-03</name>
  <read_first>
    - src/domain/patrimoine/lot.ts (analog factory + InvariantViolated + brand id)
    - src/domain/patrimoine/bien.ts (analog ajouterLot copy-on-write + état actuel des invariants)
    - src/domain/_shared/clock.ts (port Clock + ClockFixe pour tests déterministes)
    - src/domain/_shared/identifiants.ts (analog nouveauLotId pattern + brand type)
    - tests/_builders/patrimoine.ts (analog unLotValide, unBienValide à étendre)
    - tests/unit/patrimoine/bien.test.ts (analog Bien factory test)
    - tests/unit/_shared/clock.test.ts (analog ClockFixe usage)
    - tests/unit/helpers/format-date.test.ts (analog helper test)
    - tests/integration/repositories/bien-repository-sqlite.test.ts (analog roundtrip Bien + Lot)
    - tests/bdd/features/quittancement.feature (analog Before/After tag isolation)
    - tests/bdd/step_definitions/quittancement.steps.ts (analog Cucumber World init pattern)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : src/domain/patrimoine/diagnostic.ts + bien.ts modifié + bien-repository-sqlite modifié + diagnostic-schemas + routes/diagnostics)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md (sections : §Color §DPE badge color map L101-114 + §Screen Inventory PAT-03 + §Empty States "Aucun diagnostic" + §Warning "Diagnostic expiré" + §Forms champs date_emission + type Diagnostic)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-75 à D-80 + DP-14 + DP-15 + DP-18 + canonical refs DPE 10 ans / gaz 6 / élec 6 / ERP null)
    - LOCATION_MEUBLEE_REGLES.md §7 DDT (dossier de diagnostic technique)
  </read_first>
  <behavior>
    - T1 diagnostic.test : `Diagnostic.creer({ type: 'dpe', dateEmission: PlainDate.from('2025-01-15'), classeDpe: 'D' })` retourne diagnostic avec `dateExpiration` égal à `PlainDate.from('2035-01-15')`.
    - T2 diagnostic.test : `Diagnostic.creer({ type: 'gaz', dateEmission: PlainDate.from('2025-01-15') })` retourne diagnostic avec `dateExpiration === PlainDate.from('2031-01-15')` (6 ans) et `classeDpe === null`.
    - T3 diagnostic.test : `Diagnostic.creer({ type: 'elec', dateEmission: PlainDate.from('2025-01-15') })` retourne `dateExpiration === PlainDate.from('2031-01-15')` (6 ans).
    - T4 diagnostic.test : `Diagnostic.creer({ type: 'erp', dateEmission: PlainDate.from('2025-01-15') })` retourne `dateExpiration === null` (D-77 illimité).
    - T5 diagnostic.test : `Diagnostic.creer({ type: 'dpe', dateEmission: PlainDate.from('2025-01-15') })` SANS classeDpe → throw InvariantViolated avec message contenant 'classe DPE est obligatoire'.
    - T6 diagnostic.test : `Diagnostic.creer({ type: 'gaz', dateEmission: PlainDate.from('2025-01-15'), classeDpe: 'D' })` → throw InvariantViolated avec message contenant 'pertinente que pour le diagnostic DPE'.
    - T7 diagnostic.test : `Diagnostic.creer({ type: 'xyz' as TypeDiagnostic, dateEmission: PlainDate.from('2025-01-15') })` → throw InvariantViolated (type hors enum).
    - T8 diagnostic.test : `d.estExpire(PlainDate.from('2026-01-15'))` quand `dateExpiration = PlainDate.from('2025-12-31')` → true.
    - T9 diagnostic.test : `d.estExpire(PlainDate.from('2026-01-15'))` quand `dateExpiration = PlainDate.from('2030-12-31')` → false.
    - T10 diagnostic.test : `d.estExpire(PlainDate.from('2099-01-15'))` quand `dateExpiration = null` (ERP) → false (validité illimitée).
    - T11 bien-ajouter-diagnostic.test : Bien sans diagnostics. `bien.ajouterDiagnostic(Diagnostic.creer({type:'dpe', dateEmission, classeDpe:'F'}))` → retourne nouveau Bien avec `diagnostics.length === 1` ET `classeDpe === 'F'` (auto-sync DP-14).
    - T12 bien-ajouter-diagnostic.test : Bien avec classeDpe='D'. `bien.ajouterDiagnostic(Diagnostic.creer({type:'gaz', dateEmission}))` → `classeDpe` reste 'D' (pas un DPE → pas de sync), `diagnostics.length === 1`.
    - T13 bien-ajouter-diagnostic.test : Bien avec classeDpe='D'. Ajouter 2 DPE successifs avec classes 'D' puis 'C' → `classeDpe === 'C'` (dernier DPE ajouté gagne, D-78).
    - T14 bien-ajouter-diagnostic.test : `bien.diagnosticActif('dpe')` avec 2 DPE (date_emission 2024-01-01 classe D, et 2025-06-01 classe C) → retourne le DPE 2025-06-01 (le plus récent, D-79).
    - T15 bien-ajouter-diagnostic.test : `bien.diagnosticActif('gaz')` quand aucun diagnostic gaz → null.
    - T16 bien-ajouter-diagnostic.test : `bien.estGelLoyer()` quand classeDpe=null → false ; classeDpe='E' → false ; classeDpe='F' → true ; classeDpe='G' → true (D-92).
    - T17 bien-ajouter-diagnostic.test : Bien avec `diagnostics: [d1, d2, d3]` après `bien.modifier({type:'maison'})` → diagnostics et classeDpe préservés (copy-on-write doit propager).
    - T18 format-classe-dpe.test : `formaterClasseDpe('F')` → `'DPE F'` ; `formaterClasseDpe(null)` → `'Non renseignée'`.
    - T19 format-type-diagnostic.test : 4 cas : 'dpe'→'DPE', 'gaz'→'Gaz', 'elec'→'Électricité', 'erp'→'ERP (risques et pollutions)'.
    - T20 format-statut-diagnostic.test : `formaterStatutDiagnostic(null, today)` → `'Illimitée (ERP)'` ; `formaterStatutDiagnostic(PlainDate('2024-12-31'), PlainDate('2026-05-16'))` → `'Expiré le 31/12/2024'` ; `formaterStatutDiagnostic(PlainDate('2030-12-31'), PlainDate('2026-05-16'))` → `'Valide jusqu\'au 31/12/2030'`.
    - T21 integration bien-repository-sqlite-diagnostics : Bien avec 3 diagnostics (DPE classe D + gaz + élec) → roundtrip `enregistrer` puis `trouverParId` → Bien identique (diagnostics récupérés triés date_emission desc, classeDpe='D' lu de la colonne bien.classe_dpe).
    - T22 integration bien-repository-sqlite-diagnostics : Bien avec 2 DPE successifs (2024-01 classe D, 2025-06 classe C) → ajouter en 2 enregistrer() puis trouverParId → Bien.classeDpe='C', diagnostics.length === 2.
    - T23 integration bien-repository-sqlite-diagnostics : Bien avec 1 DPE → modifier(`adresse`) sans toucher diagnostics → enregistrer → trouverParId : diagnostics préservés (transaction purge+réinsert atomique).
    - T24 BDD @pat-03 "Ajout diagnostic DPE met à jour classeDpe" : Given Bien sans diagnostic, ClockFixe '2026-05-16'. When POST /biens/:id/diagnostics avec type=dpe, date_emission=2025-01-15, classe_dpe=F. Then redirect /biens/:id avec banniereSuccess "Diagnostic enregistré.", DB bien.classe_dpe='F', DB diagnostics contient 1 row avec type='dpe' date_emission='2025-01-15' date_expiration='2035-01-15'.
    - T25 BDD @pat-03 "Diagnostic ERP a date_expiration null" : When POST /biens/:id/diagnostics avec type=erp, date_emission=2025-01-15. Then DB diagnostics row avec date_expiration NULL.
    - T26 BDD @pat-03 "DPE sans classe rejeté" : When POST /biens/:id/diagnostics avec type=dpe, date_emission=2025-01-15, SANS classe_dpe. Then status 200 (re-render formulaire avec erreur), aucun diagnostic créé en DB, le formulaire affiche "La classe DPE est obligatoire pour un diagnostic DPE.".
    - T27 BDD @pat-03 "Diagnostic expiré affiche badge expiré non bloquant" : Given Bien avec 1 DPE date_emission=2014-01-15 (expiré depuis 2024-01-15) classeDpe=D, ClockFixe '2026-05-16'. When GET /biens/:id. Then la page contient le texte "Expiré le 15/01/2024" ET un banniere-warning "Le diagnostic dpe a expiré" (non bloquant — pas de role=alert). PAS de redirect, pas de blocage du formulaire d'ajout.
    - T28 BDD @pat-03 "Historique complet préservé après remplacement DPE" : Given Bien avec 2 DPE (date_emission 2024-01-01 classe D, et 2025-06-01 classe C). When GET /biens/:id. Then la page contient 2 lignes diagnostics, classeDpe affiché='C' (le plus récent), pas de DELETE en DB.
  </behavior>
  <action>
    TDD outside-in. Créer EXCLUSIVEMENT les tests (rouges attendus).

    1. ÉTENDRE `tests/_builders/patrimoine.ts` :
       - Ajouter `unDiagnosticDpeValide(overrides = {})` : defaults `type: 'dpe'`, `dateEmission: PlainDate.from('2025-01-15')`, `classeDpe: 'D'`.
       - Ajouter `unDiagnosticGazValide(overrides = {})` : defaults `type: 'gaz'`, `dateEmission: PlainDate.from('2025-01-15')`.
       - Ajouter `unDiagnosticElecValide(overrides = {})` : idem 'elec'.
       - Ajouter `unDiagnosticErpValide(overrides = {})` : idem 'erp'.
       - Étendre `unBienValide(overrides = {})` pour accepter `overrides.diagnostics` et `overrides.classeDpe` (defaults `[]` et `null`).

    2. `tests/unit/patrimoine/diagnostic.test.ts` (NOUVEAU) : T1-T10. Imports `Diagnostic`, `InvariantViolated`, `Temporal`, builders.

    3. `tests/unit/patrimoine/bien-ajouter-diagnostic.test.ts` (NOUVEAU) : T11-T17.

    4. `tests/unit/helpers/format-classe-dpe.test.ts` (NOUVEAU) : T18.

    5. `tests/unit/helpers/format-type-diagnostic.test.ts` (NOUVEAU) : T19.

    6. `tests/unit/helpers/format-statut-diagnostic.test.ts` (NOUVEAU) : T20. Utiliser `Temporal.PlainDate.from(...)` pour today et dateExp.

    7. `tests/integration/repositories/bien-repository-sqlite-diagnostics.test.ts` (NOUVEAU) : T21-T23. Pattern Phase 1/2 — `applyMigrations(db, sqlite, MIGRATIONS_DIR)` puis insert + roundtrip. LOCKÉ : exécution séquentielle des phases — ROADMAP impose 1→2→3, donc au moment d'exécuter Phase 3 les migrations 0001 → 0006 de Phases 1+2 sont déjà livrées et appliquées en cascade par `applyMigrations` (pas de stub). Si un test Phase 3 isolé est lancé sans le pipeline complet, `applyMigrations` répétera 0001→0007 sur une DB vierge — idempotent.

    8. `tests/_world/monde-phase3.ts` (NOUVEAU) : pattern strict `MondePhase2` (Phase 2 plan 02-01). Champs : `sqlite: BetterSqlite3.Database`, `db: Kysely<DB>`, `clockIso: string`, `app: FastifyInstance`, `bienId?: BienId`. Méthodes utilitaires éventuelles (`insererBien()`).

    9. ÉTENDRE `tests/bdd/features/diagnostics.feature` (NOUVEAU) avec 5 scenarios tag `@pat-03 @phase3` (T24-T28). Background : `Given l'application est prête pour PAT-03 avec clock fixe "2026-05-16"` + `And un Bien Phase 3 existe à l'adresse "..."`.

    10. `tests/bdd/step_definitions/diagnostics.steps.ts` (NOUVEAU) : Before/After `@phase3` (init/teardown DB + app — pattern `quittancement.steps.ts` lignes 71-92). Steps Given/When/Then propres à PAT-03.

    Tests ÉCHOUENT. Commit : `test(03-01): tests rouges Diagnostic + Bien.ajouterDiagnostic + helpers + integration + PAT-03 (Wave 0)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative &amp;&amp; pnpm test 2>&amp;1 | grep -E "FAIL|fail" | head -25 ; ls tests/unit/patrimoine/diagnostic.test.ts tests/unit/patrimoine/bien-ajouter-diagnostic.test.ts tests/unit/helpers/format-classe-dpe.test.ts tests/unit/helpers/format-type-diagnostic.test.ts tests/unit/helpers/format-statut-diagnostic.test.ts tests/integration/repositories/bien-repository-sqlite-diagnostics.test.ts tests/bdd/features/diagnostics.feature tests/_world/monde-phase3.ts</automated>
  </verify>
  <done>
    - Tests Wave 0 rouges : 6 fichiers unit/integration + 1 feature BDD + 1 World Phase 3 + builders étendus.
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Domaine + repository + use cases + helpers + migration 0007 (passer unit + integration au vert)</name>
  <read_first>
    - src/domain/patrimoine/lot.ts (analog factory + invariants)
    - src/domain/patrimoine/bien.ts (état actuel — extension nécessaire des champs et méthodes)
    - src/domain/_shared/identifiants.ts (pattern brand types — où ajouter DiagnosticId)
    - src/infrastructure/repositories/bien-repository-sqlite.ts (état actuel — purge/reinsert Lot pattern, transaction)
    - src/infrastructure/db/kysely-types.ts (BienTable interface — ajouter classe_dpe + nouvelle table diagnostics)
    - src/infrastructure/db/database.ts (ConnexionDb + migrations)
    - src/application/patrimoine/ajouter-lot.ts (analog use case sub-aggregate add)
    - src/helpers/format-date.ts (analog helper)
    - src/main.ts (preHandler hook — où injecter les nouveaux helpers + today)
    - migrations/0001_init.sql (pattern SQL en-tête)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : duree-validite-diagnostic + diagnostic.ts + bien.ts modifié + bien-repository-sqlite modifié + migration 0007_phase3_init pattern + helpers format-*)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-77 DUREES_VALIDITE codée dans le domaine versionneable R1.1)
    - Tests rouges Task 1
  </read_first>
  <action>
    Créer/modifier dans cet ordre :

    1. `migrations/0007_phase3_diagnostics.sql` :
       - En-tête : commentaires alignés sur 0001_init.sql (conventions ISO dates, INTEGER centimes, UUID v4, datestamp).
       - `BEGIN TRANSACTION;`
       - `ALTER TABLE bien ADD COLUMN classe_dpe TEXT NULL CHECK (classe_dpe IS NULL OR classe_dpe IN ('A','B','C','D','E','F','G'));` — D-78.
       - `CREATE TABLE IF NOT EXISTS diagnostics ( id TEXT PRIMARY KEY, bien_id TEXT NOT NULL REFERENCES bien(id), type TEXT NOT NULL CHECK (type IN ('dpe','gaz','elec','erp')), date_emission TEXT NOT NULL, date_expiration TEXT NULL, classe_dpe TEXT NULL CHECK (classe_dpe IS NULL OR classe_dpe IN ('A','B','C','D','E','F','G')), cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP );` — DP-15.
       - `CREATE INDEX IF NOT EXISTS idx_diagnostics_bien ON diagnostics(bien_id);`
       - `CREATE INDEX IF NOT EXISTS idx_diagnostics_expiration ON diagnostics(date_expiration);` (queryability Phase 7).
       - `COMMIT;`

    2. `src/infrastructure/db/kysely-types.ts` : 
       - Étendre `BienTable` avec `classe_dpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null`.
       - Ajouter `DiagnosticsTable { id: string; bien_id: string; type: 'dpe' | 'gaz' | 'elec' | 'erp'; date_emission: string; date_expiration: string | null; classe_dpe: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | null; cree_le: string }` + ajouter `diagnostics: DiagnosticsTable` à `DB`.

    3. `src/domain/_shared/identifiants.ts` (ÉTENDRE) :
       - Ajouter `DiagnosticId = string & { readonly __brand: 'DiagnosticId' }` (pattern existant Phase 1).
       - Ajouter `nouveauDiagnosticId(): DiagnosticId` (utiliser `crypto.randomUUID()` comme les autres générateurs).

    4. `src/domain/_shared/duree-validite-diagnostic.ts` (NOUVEAU — shared kernel cross-BC Patrimoine + Locatif consumé par Bail.simulerIndexation 03-03 ; ClasseDpe placé en _shared évite cycle d'import locatif → patrimoine, lock revision iter 1 warning 6) :
       - `export type TypeDiagnostic = 'dpe' | 'gaz' | 'elec' | 'erp';`
       - `export type ClasseDpe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';`
       - `export const CLASSES_DPE: ClasseDpe[] = ['A','B','C','D','E','F','G'];`
       - `export const TYPES_DIAGNOSTIC: TypeDiagnostic[] = ['dpe','gaz','elec','erp'];`
       - `export const DUREES_VALIDITE: Record<TypeDiagnostic, { annees: number | null }> = { dpe: { annees: 10 }, gaz: { annees: 6 }, elec: { annees: 6 }, erp: { annees: null } };` — D-77 versionneable LF.
       - JSDoc : "Durées légales DPE 10 ans (CCH L126-26), gaz 6 ans (R134-6), élec 6 ans (R134-10), ERP illimité. Revue annuelle post-loi de finances (RISKS.md R1.1)."

    5. `src/domain/patrimoine/diagnostic.ts` (NOUVEAU) :
       - Imports : `Temporal`, `InvariantViolated`, `DiagnosticId`, `nouveauDiagnosticId`, `TypeDiagnostic`, `ClasseDpe`, `DUREES_VALIDITE`, `TYPES_DIAGNOSTIC`, `CLASSES_DPE`.
       - Interface `DiagnosticProps { id?: DiagnosticId; type: TypeDiagnostic; dateEmission: Temporal.PlainDate; classeDpe?: ClasseDpe | null }`.
       - Classe `Diagnostic` avec props readonly + private constructor + `static creer(props): Diagnostic` :
         - Valide `TYPES_DIAGNOSTIC.includes(props.type)` sinon `throw new InvariantViolated('Type de diagnostic invalide : "${type}"')`.
         - Si `type === 'dpe'` ET (`classeDpe == null` OU `!CLASSES_DPE.includes(classeDpe)`) → throw InvariantViolated('La classe DPE est obligatoire pour un diagnostic DPE').
         - Si `type !== 'dpe'` ET `classeDpe != null` → throw InvariantViolated('La classe DPE n\'est pertinente que pour le diagnostic DPE').
         - Calcule `dateExpiration` : `const annees = DUREES_VALIDITE[type].annees ; const dateExpiration = annees === null ? null : dateEmission.add({ years: annees });`.
         - id défaut `nouveauDiagnosticId()`.
         - Retourne `new Diagnostic(id, { type, dateEmission, dateExpiration, classeDpe: classeDpe ?? null })`.
       - Méthode `estExpire(today: Temporal.PlainDate): boolean` — `this.dateExpiration !== null && Temporal.PlainDate.compare(today, this.dateExpiration) > 0`.

    6. `src/domain/patrimoine/bien.ts` (MODIFIER) :
       - Étendre `BienProps` avec `diagnostics?: Diagnostic[]` et `classeDpe?: ClasseDpe | null`.
       - Étendre la classe `Bien` avec `readonly diagnostics: ReadonlyArray<Diagnostic>` et `readonly classeDpe: ClasseDpe | null`.
       - Dans `Bien.creer()` : valider `classeDpe` ∈ `CLASSES_DPE ∪ {null}` ; freeze `diagnostics` (`Object.freeze([...(props.diagnostics ?? [])])`). Constructeur initialise les deux.
       - `toProps()` propage les deux champs.
       - Méthode `ajouterDiagnostic(d: Diagnostic): Bien` :
         - Retourne `Bien.creer({ ...this.toProps(), diagnostics: [...this.diagnostics, d], classeDpe: d.type === 'dpe' ? (d.classeDpe ?? this.classeDpe) : this.classeDpe })`.
       - Méthode `diagnosticActif(type: TypeDiagnostic): Diagnostic | null` :
         - `return this.diagnostics.filter(d => d.type === type).sort((a, b) => Temporal.PlainDate.compare(b.dateEmission, a.dateEmission))[0] ?? null;`
       - Méthode `estGelLoyer(): boolean` — `return this.classeDpe === 'F' || this.classeDpe === 'G';` (D-92).
       - Pas de méthode `supprimerDiagnostic` V1 (D-79).

    7. `src/domain/patrimoine/erreurs.ts` (ÉTENDRE) :
       - Ajouter `DiagnosticIntrouvable extends Error` (pattern existant `BienIntrouvable`).

    8. `src/domain/patrimoine/bien-repository.ts` (port — pas de changement de signature pour 03-01).
       - Note : `trouverParId` continue de retourner `Bien | null` ; l'adapter doit reconstruire `diagnostics[]` (au sein de `versDomaine`).

    9. `src/infrastructure/repositories/bien-repository-sqlite.ts` (MODIFIER) :
       - `enregistrer(bien)` : envelopper dans `await this.db.transaction().execute(async (trx) => {...})`. 
         - INSERT/UPDATE `bien` (ajouter `classe_dpe: bien.classeDpe ?? null` au values).
         - DELETE existing lots (déjà existant pattern) + INSERT batch lots.
         - **NOUVEAU** : `await trx.deleteFrom('diagnostics').where('bien_id', '=', bien.id).execute();` (purge complète).
         - **NOUVEAU** : `if (bien.diagnostics.length > 0) await trx.insertInto('diagnostics').values(bien.diagnostics.map(d => ({ id: d.id, bien_id: bien.id, type: d.type, date_emission: d.dateEmission.toString(), date_expiration: d.dateExpiration?.toString() ?? null, classe_dpe: d.classeDpe ?? null }))).execute();`
       - `trouverParId(id)` / `lister()` / `versDomaine(row)` :
         - SELECT `bien` inclut `classe_dpe`.
         - APRÈS lookup `bien` (et `lots` existant), faire `const diagnosticsRows = await this.db.selectFrom('diagnostics').where('bien_id', '=', id).orderBy('date_emission', 'desc').selectAll().execute();`
         - Reconstruire `diagnostics: Diagnostic[]` via `Diagnostic.creer({ id: r.id as DiagnosticId, type: r.type as TypeDiagnostic, dateEmission: Temporal.PlainDate.from(r.date_emission), classeDpe: r.classe_dpe as ClasseDpe | null })` pour chaque row.
         - Passer `diagnostics` et `classeDpe: row.classe_dpe as ClasseDpe | null` à `Bien.creer({...})`.
         - **NOTE** : `Diagnostic.creer({...})` recalcule `dateExpiration` à partir de `dateEmission` + `DUREES_VALIDITE[type]` — c'est cohérent avec la valeur stockée (validation indirecte). Si jamais discordance → throw InvariantViolated → indicateur de corruption DB.

    10. `src/application/patrimoine/ajouter-diagnostic.ts` (NOUVEAU) :
        - `export async function ajouterDiagnostic(commande: { bienId: BienId; type: TypeDiagnostic; dateEmission: Temporal.PlainDate; classeDpe?: ClasseDpe }, bienRepo: BienRepository): Promise<DiagnosticId> { const bien = await bienRepo.trouverParId(commande.bienId); if (!bien) throw new BienIntrouvable(commande.bienId); const diagnostic = Diagnostic.creer({ type: commande.type, dateEmission: commande.dateEmission, classeDpe: commande.classeDpe ?? null }); const bienModifie = bien.ajouterDiagnostic(diagnostic); await bienRepo.enregistrer(bienModifie); return diagnostic.id; }`

    11. `src/application/patrimoine/lister-diagnostics.ts` (NOUVEAU) :
        - `export async function listerDiagnostics(bienId: BienId, bienRepo: BienRepository): Promise<Diagnostic[]> { const bien = await bienRepo.trouverParId(bienId); if (!bien) throw new BienIntrouvable(bienId); return [...bien.diagnostics]; }` (déjà triés date_emission desc par le repo).

    12. `src/helpers/format-classe-dpe.ts` (NOUVEAU) :
        - `import type { ClasseDpe } from '../domain/_shared/duree-validite-diagnostic.js';`
        - `export function formaterClasseDpe(classe: ClasseDpe | null): string { return classe === null ? 'Non renseignée' : 'DPE ' + classe; }`

    13. `src/helpers/format-type-diagnostic.ts` (NOUVEAU) :
        - `import type { TypeDiagnostic } from '../domain/_shared/duree-validite-diagnostic.js';`
        - `const LABELS_TYPE_DIAGNOSTIC: Record<TypeDiagnostic, string> = { dpe: 'DPE', gaz: 'Gaz', elec: 'Électricité', erp: 'ERP (risques et pollutions)' };`
        - `export function formaterTypeDiagnostic(type: TypeDiagnostic): string { return LABELS_TYPE_DIAGNOSTIC[type]; }`

    14. `src/helpers/format-statut-diagnostic.ts` (NOUVEAU) :
        - `import { Temporal } from '@js-temporal/polyfill';`
        - `import { formatDate } from './format-date.js';`
        - `export function formaterStatutDiagnostic(dateExp: Temporal.PlainDate | null, today: Temporal.PlainDate): string { if (dateExp === null) return 'Illimitée (ERP)'; if (Temporal.PlainDate.compare(today, dateExp) > 0) return 'Expiré le ' + formatDate(dateExp); return 'Valide jusqu\'au ' + formatDate(dateExp); }`

    15. ÉTENDRE `src/main.ts` :
        - Imports : `formaterClasseDpe`, `formaterTypeDiagnostic`, `formaterStatutDiagnostic`.
        - Hook preHandler : injecter dans `reply.locals` les trois helpers + `today: clock.aujourdhui()` (clock déjà disponible via `creerApp(db, { clock })` Phase 2 D-67).

    Vérifs : `pnpm tsc --noEmit` 0 erreur. `pnpm lint:deps` 0 violation (helpers et domaine restent purs).
    Tests unit + integration Wave 0 (non-BDD) DOIVENT être verts.

    Commit : `feat(03-01): Diagnostic sous-agrégat + Bien.ajouterDiagnostic + repo SQLite + use cases + helpers (PAT-03 domain)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative &amp;&amp; pnpm tsc --noEmit &amp;&amp; pnpm lint:deps &amp;&amp; pnpm test:unit run tests/unit/patrimoine/diagnostic.test.ts tests/unit/patrimoine/bien-ajouter-diagnostic.test.ts tests/unit/helpers/format-classe-dpe.test.ts tests/unit/helpers/format-type-diagnostic.test.ts tests/unit/helpers/format-statut-diagnostic.test.ts &amp;&amp; pnpm test:integration run tests/integration/repositories/bien-repository-sqlite-diagnostics.test.ts</automated>
  </verify>
  <done>
    - Migration 0007 idempotente avec ALTER bien + CREATE diagnostics + 2 indexes.
    - Diagnostic sous-agrégat + Bien étendu (diagnostics, classeDpe, ajouterDiagnostic, diagnosticActif, estGelLoyer).
    - BienRepositorySqlite étendu : transaction purge+réinsert diagnostics + lookup diagnostics dans versDomaine.
    - 2 use cases (ajouterDiagnostic, listerDiagnostics).
    - 3 helpers preHandler injectés (formaterClasseDpe, formaterTypeDiagnostic, formaterStatutDiagnostic + `today`).
    - Tests unit + integration VERTS.
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Routes + schema Zod + views (formulaire + section sur fiche Bien + partials) + BDD PAT-03 verts</name>
  <read_first>
    - src/web/routes/biens.ts (analog plugin Fastify + safeParse + extraireErreurs + redirect pattern)
    - src/web/schemas/bien-schemas.ts (analog Zod + errorMap)
    - src/web/views/pages/biens/detail.ejs (état actuel — section Lots à conserver, section Diagnostics à ajouter sous Lots)
    - src/web/views/pages/biens/formulaire.ejs (analog form + form-field partial)
    - src/web/views/partials/data-table.ejs (analog table générique)
    - src/web/views/partials/empty-state.ejs (analog empty state heading+body+CTA)
    - src/web/views/partials/banniere-warning.ejs (warning non bloquant)
    - src/web/views/partials/form-field.ejs (analog input + label + erreur inline)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md (sections : §Color §DPE badge color map L101-114 + §Screen Inventory PAT-03 + §Empty States + §Warning + §Forms + §Tables + §New Partials + §Route Map)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : routes/diagnostics + partial-badge-dpe + partial-diagnostic-row + diagnostic-schemas + pages/biens/diagnostics/formulaire)
    - Tests rouges Task 1 (BDD)
  </read_first>
  <action>
    Créer/modifier :

    1. `src/web/schemas/diagnostic-schemas.ts` (NOUVEAU) :
       - Import `z` et `'fastify-type-provider-zod'` selon pattern existant.
       - `export const diagnosticCreationSchema = z.object({ type: z.enum(['dpe', 'gaz', 'elec', 'erp'], { errorMap: () => ({ message: 'Type de diagnostic invalide.' }) }), date_emission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ.'), classe_dpe: z.enum(['A','B','C','D','E','F','G']).optional() }).superRefine((data, ctx) => { if (data.type === 'dpe' && !data.classe_dpe) { ctx.addIssue({ code: 'custom', path: ['classe_dpe'], message: 'La classe DPE est obligatoire pour un diagnostic DPE.' }); } if (data.type !== 'dpe' && data.classe_dpe) { ctx.addIssue({ code: 'custom', path: ['classe_dpe'], message: 'La classe DPE n\'est pertinente que pour le diagnostic DPE.' }); } });`

    2. `src/web/routes/diagnostics.ts` (NOUVEAU) :
       - `export async function plugin(app: FastifyInstance, opts: { bienRepo: BienRepository }): Promise<void>`.
       - `GET /biens/:id/diagnostics/nouveau` :
         - `const { id } = req.params as { id: string };`
         - `const bien = await opts.bienRepo.trouverParId(id as BienId);`
         - Si null → `return reply.code(404).view('pages/erreurs/404.ejs', {...})` OU `return reply.code(404).send('Bien introuvable')` (cohérent avec biens.ts existant — vérifier le pattern).
         - `return reply.view('pages/biens/diagnostics/formulaire.ejs', { bien, valeurs: {}, erreurs: {}, navActive: 'biens', breadcrumbs: [{url:'/biens', label:'Biens'},{url:'/biens/'+id, label: bien.adresse.enLigne()}, {label:'Ajouter un diagnostic'}] });`
       - `POST /biens/:id/diagnostics` :
         - `const body = req.body as Record<string, string>;`
         - `const parsed = diagnosticCreationSchema.safeParse(body);`
         - Si !success → `const erreurs = extraireErreurs(parsed.error.issues); const bien = await opts.bienRepo.trouverParId(id as BienId); return reply.view('pages/biens/diagnostics/formulaire.ejs', { bien, valeurs: body, erreurs, navActive: 'biens', breadcrumbs: [...] });` (extraireErreurs réutilisable de biens.ts ou copié).
         - Si success : `try { await ajouterDiagnostic({ bienId: id as BienId, type: parsed.data.type, dateEmission: Temporal.PlainDate.from(parsed.data.date_emission), classeDpe: parsed.data.classe_dpe ?? undefined }, opts.bienRepo); req.session.banniereSuccess = 'Diagnostic enregistré.'; return reply.redirect('/biens/' + id); } catch (err) { if (err instanceof BienIntrouvable) return reply.code(404).send(err.message); if (err instanceof InvariantViolated) { const bien = await opts.bienRepo.trouverParId(id as BienId); return reply.view('pages/biens/diagnostics/formulaire.ejs', { bien, valeurs: body, erreurs: { _global: err.message }, ... }); } throw err; }`

    3. `src/web/views/pages/biens/diagnostics/formulaire.ejs` (NOUVEAU) :
       - layout-debut avec titre 'Ajouter un diagnostic', breadcrumbs, navActive='biens'.
       - `<h1>Ajouter un diagnostic — <%= bien.adresse.enLigne() %></h1>`.
       - `<form method="POST" action="/biens/<%= bien.id %>/diagnostics" novalidate>` :
         - Champ `type` : `<label for="type">Type de diagnostic <span aria-hidden="true">*</span></label><select id="type" name="type" required><option value="">— Sélectionner —</option><option value="dpe" <%= valeurs.type === 'dpe' ? 'selected' : '' %>>DPE</option><option value="gaz">Gaz</option><option value="elec">Électricité</option><option value="erp">ERP (risques et pollutions)</option></select>` + erreur inline si `erreurs.type`.
         - Champ `date_emission` : utiliser `partial form-field.ejs` (`type='date'`, required) + erreur inline si `erreurs.date_emission`.
         - Champ `classe_dpe` : select `<select id="classe_dpe" name="classe_dpe"><option value="">— Sélectionner —</option><% ['A','B','C','D','E','F','G'].forEach(c => { %><option value="<%= c %>"><%= c %></option><% }) %></select>` + hint `<small>Obligatoire si type = DPE.</small>` + erreur inline `erreurs.classe_dpe`.
         - Bouton primaire `<button type="submit">Enregistrer le diagnostic</button>` + lien secondaire `<a href="/biens/<%= bien.id %>" role="button" class="secondary">Annuler</a>`.
       - layout-fin.

    4. ÉTENDRE `src/web/views/pages/biens/detail.ejs` :
       - Sous la section existante Lots (ou en bas selon la structure actuelle), ajouter une section `<section aria-labelledby="diagnostics-heading">` :
         - `<h2 id="diagnostics-heading">Diagnostics <%- include('../../partials/partial-badge-dpe', { classe: bien.classeDpe }) %></h2>`
         - **Banner warning si ≥1 diagnostic expiré** : `<% const expires = bien.diagnostics.filter(d => d.estExpire(today)); if (expires.length > 0) { %><%- include('../../partials/banniere-warning', { warning: 'Le diagnostic ' + formaterTypeDiagnostic(expires[0].type) + ' a expiré le ' + formatDate(expires[0].dateExpiration) + '. Pensez à le renouveler avant la prochaine relocation.' }) %><% } %>`
         - Si `bien.diagnostics.length === 0` → `<%- include('../../partials/empty-state', { heading: 'Aucun diagnostic enregistré', body: 'Les diagnostics obligatoires (DPE, gaz, électricité, ERP) doivent être annexés au bail.', ctaHref: '/biens/' + bien.id + '/diagnostics/nouveau', ctaLabel: 'Ajouter un diagnostic' }) %>`
         - Sinon : table `<table role="table" aria-label="Diagnostics du bien"><caption class="sr-only">Diagnostics du bien</caption><thead><tr><th>Type</th><th>Date d'émission</th><th>Date d'expiration</th><th>Statut</th></tr></thead><tbody><% bien.diagnostics.forEach(function(d){ %><%- include('../../partials/partial-diagnostic-row', { d, today, helpers: { formaterTypeDiagnostic, formatDate, formaterStatutDiagnostic } }) %><% }) %></tbody></table>` + bouton `<a href="/biens/<%= bien.id %>/diagnostics/nouveau" role="button">Ajouter un diagnostic</a>`.

    5. `src/web/views/partials/partial-badge-dpe.ejs` (NOUVEAU) :
       - Mapping inline des 8 cas (A,B,C,D,E,F,G,null) selon UI-SPEC L101-114 exact (background + text color WCAG 4.5:1 vérifié).
       - Pattern : `<% const map = { A: { bg:'#16a34a', fg:'#ffffff', label:'DPE A' }, B: { bg:'#4ade80', fg:'#166534', label:'DPE B' }, C: { bg:'#a3e635', fg:'#365314', label:'DPE C' }, D: { bg:'#fbbf24', fg:'#78350f', label:'DPE D' }, E: { bg:'#f97316', fg:'#ffffff', label:'DPE E' }, F: { bg:'#dc2626', fg:'#ffffff', label:'DPE F — Gel loyer Climat' }, G: { bg:'#991b1b', fg:'#ffffff', label:'DPE G — Gel loyer Climat' } }; const item = classe ? map[classe] : { bg:'#6b7280', fg:'#ffffff', label:'DPE non renseigné' }; %><span style="background: <%= item.bg %>; color: <%= item.fg %>; padding: 2px 6px; border-radius: 4px; font-weight:600; margin-left: 8px;" aria-label="Classe DPE : <%= classe ?? 'non renseignée' %>"><%= item.label %></span>`.
       - JSDoc commentaire EJS au-dessus précisant que `classe` peut être null.

    6. `src/web/views/partials/partial-diagnostic-row.ejs` (NOUVEAU) :
       - Variables EJS : `d` (Diagnostic), `today` (Temporal.PlainDate), `helpers: { formaterTypeDiagnostic, formatDate, formaterStatutDiagnostic }`.
       - `<tr<% if (d.estExpire(today)) { %> class="row-warning"<% } %>><td><%= helpers.formaterTypeDiagnostic(d.type) %><% if (d.type === 'dpe' && d.classeDpe) { %> — <%= d.classeDpe %><% } %></td><td><%= helpers.formatDate(d.dateEmission) %></td><td><%= d.dateExpiration === null ? '—' : helpers.formatDate(d.dateExpiration) %></td><td<% if (d.estExpire(today)) { %> style="color: #dc2626;"<% } %>><%= helpers.formaterStatutDiagnostic(d.dateExpiration, today) %></td></tr>`
       - Couleur rouge texte + classe row-warning — accessibilité : couleur + texte combinés (jamais seule).

    7. ÉTENDRE `src/main.ts` :
       - Imports : `plugin as diagnosticsPlugin` depuis `./web/routes/diagnostics.js`.
       - Enregistrer après `biensPlugin` : `await app.register(diagnosticsPlugin, { bienRepo });`

    8. ÉTENDRE `tests/bdd/step_definitions/diagnostics.steps.ts` avec les steps nécessaires (Given Bien existe + ClockFixe / When POST /biens/.../diagnostics + champs / Then DB diagnostics row + page contient texte + redirect + banniere). Réutiliser `unBienValide`, `bienRepo.enregistrer`, `app.inject` (pattern Phase 2).

    Sécurité (cf. <threat_model>) :
    - SQL injection : Kysely paramétrise (vérification dependency-cruiser).
    - XSS : EJS `<%= %>` autoescape par défaut. Vérifier qu'aucun `<%- %>` n'injecte de string user (les `include` sont OK car partials internes).
    - Inputs : Zod superRefine valide type ∈ enum, date format strict, classe_dpe ∈ enum. Pas de file upload Phase 3 (PDF EDL différé Phase 4).
    - Path traversal : pas de génération de fichier Phase 3-01 (différé 03-04 pour PDF avenant).

    Vérifs : `pnpm test:bdd -- --tags @pat-03` 5 scenarios VERTS. `pnpm test` tout VERT. `pnpm tsc --noEmit` 0 erreur. `pnpm lint` 0 warning.

    Commit : `feat(03-01): routes /biens/:id/diagnostics + formulaire + section sur fiche Bien + badge DPE + BDD PAT-03 (vert)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative &amp;&amp; pnpm tsc --noEmit &amp;&amp; pnpm lint &amp;&amp; pnpm lint:deps &amp;&amp; pnpm test &amp;&amp; pnpm test:bdd -- --tags @pat-03</automated>
  </verify>
  <done>
    - Routes GET/POST /biens/:id/diagnostics + formulaire avec validation Zod.
    - View detail.ejs étendue : section Diagnostics avec table, empty state, warning expiré, badge DPE coloré.
    - 2 nouveaux partials (partial-badge-dpe, partial-diagnostic-row).
    - main.ts enregistré.
    - 5 scenarios BDD @pat-03 verts.
    - Tous tests existants toujours verts (non-régression Phase 1/2).
    - Commit créé.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigateur user → Fastify POST /biens/:id/diagnostics | Inputs `type`, `date_emission`, `classe_dpe` — validés Zod côté HTTP + InvariantViolated côté domaine |
| Fastify → SQLite (transaction enregistrer bien) | Purge + réinsert atomique des diagnostics — pas de race en mono-process better-sqlite3 |
| Fastify → EJS render | XSS sur strings user (adresse bien, etc.) — EJS autoescape par défaut, `<%- %>` réservé aux includes partiaux |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03-01-01 | Tampering | Diagnostic DPE accepté sans classeDpe → bien.classeDpe reste null → Bien.estGelLoyer() faux négatif → contournement gel loyer F/G en 03-03 | HIGH | mitigate | Double barrière : Zod superRefine (`classe_dpe` requis si `type === 'dpe'`) côté HTTP + InvariantViolated dans `Diagnostic.creer()` côté domaine. Tests T5 + T26 vérifient. |
| T-03-01-02 | Tampering | Diagnostic type='gaz' avec classeDpe défini → DB corrompue (incohérence sémantique) | MED | mitigate | Zod superRefine rejette + InvariantViolated dans `Diagnostic.creer()`. Tests T6. |
| T-03-01-03 | Tampering | Diagnostic.classeDpe différent de Bien.classe_dpe (race ou intervention manuelle DB) → simulation IRL faussée | MED | accept | Mono-user V1, pas d'accès DB externe. `Bien.ajouterDiagnostic()` synchronise systématiquement. Si l'utilisateur édite la DB à la main, c'est son problème. |
| T-03-01-04 | Information disclosure | Diagnostic d'un autre Bien accédé via /biens/X/diagnostics (X arbitraire) | LOW | accept | Mono-user V1 — pas d'auth multi-comptes. RGPD : l'utilisateur a tous ses Biens, pas de fuite. |
| T-03-01-05 | Integrity — DELETE non guardé | enregistrer(bien) DELETE diagnostics WHERE bien_id = X. Si X mauvais → suppression d'autres diagnostics | LOW | mitigate | Transaction Kysely + `id` brand-typed BienId. Pas d'input user direct dans le WHERE (toujours `bien.id` issu du repo qui vient d'un lookup). |
| T-03-01-06 | DoS — bien avec 10000 diagnostics | enregistrer() purge + réinsert 10000 rows à chaque modification | LOW | accept | Mono-user, locatif personnel. 1 logement = ≤4 types × ~5 historiques sur 10 ans = ~20 rows max. Acceptable. |
| T-03-01-07 | XSS — adresse bien injectée dans `<h1>` partial-badge-dpe | EJS autoescape ON par défaut, mais si développeur utilise `<%- %>` par erreur sur user input | LOW | mitigate | Audit code review : `partial-badge-dpe.ejs` n'utilise que `<%= %>` sur `classe` enum (whitelist) ; pas d'input user dans le partial. |
</threat_model>

<verification>
- `pnpm tsc --noEmit` exit 0
- `pnpm lint` 0 warning
- `pnpm lint:deps` 0 violation (domaine pur — Diagnostic n'importe rien de technique)
- `pnpm test:unit` VERT (Diagnostic, Bien.ajouterDiagnostic, 3 helpers)
- `pnpm test:integration` VERT (bien-repository-sqlite-diagnostics roundtrip + transaction)
- `pnpm test:bdd -- --tags @pat-03` 5 scenarios PASSED
- Migration 0007 idempotente (relancer 2× → 0 erreur)
- Pas de régression Phase 1/2 : `pnpm test` complet VERT
- Bien.estGelLoyer() callable depuis le code (vérifiable Phase 3-03)
- Diagnostic.estExpire(today) callable depuis les vues via helper today injecté
</verification>

<success_criteria>
- PAT-03 satisfait : Diagnostics (DPE, gaz, élec, ERP) stockés avec date d'émission, date d'expiration calculée auto selon durée légale (D-77).
- D-75 satisfait : rattachement Bien uniquement V1 (pas par Lot).
- D-76 satisfait : Diagnostic sous-agrégat de Bien (pas de DiagnosticRepository).
- D-77 satisfait : DUREES_VALIDITE codée domaine versionneable LF (R1.1 RISKS.md).
- D-78 satisfait : Bien.classeDpe synchronisé auto à l'ajout d'un DPE (DP-14 résolu).
- D-79 satisfait : historique complet conservé, diagnosticActif(type) retourne le plus récent.
- D-80 satisfait : badge expiré + banniere-warning non bloquante (jamais redirect, jamais erreur HTTP).
- DP-14 résolu : `Bien.ajouterDiagnostic(d)` synchronise classeDpe quand type='dpe'.
- DP-15 résolu : table dédiée `diagnostics` (pas JSON inline) pour queryability Phase 7.
- DP-19 résolu : migrations Phase 3 découpées par plan (0007 diagnostics 03-01, 0008 EDL+mobilier 03-02, 0009 bail_indexations 03-04) — précédent Phase 2 (1 migration par plan, rollback simplifié par slice, aligné vertical-slice). Décision NON suivie : la recommandation initiale `0003_phase3_init.sql` (single transactionnel) — rationale : conformité avec le pattern Phase 2 + meilleur isolement par REQ.
- DP-18 partiellement résolu : 3 helpers sur 6 (formaterClasseDpe, formaterTypeDiagnostic, formaterStatutDiagnostic). Les 3 autres (formaterEtatItem, formaterTrimestreIRL, formaterRaisonNonApplication) couverts en 03-02 / 03-03 / 03-04 / 03-05.
- Bien.estGelLoyer() disponible — consommé Phase 3-03 (LOC-05 gel DPE F/G).
- Domain pur (Diagnostic + Bien étendu n'importent rien de technique — vérifié dependency-cruiser).
- Cucumber World Phase 3 réutilisable plans suivants.
</success_criteria>

<output>
After completion, create `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-01-SUMMARY.md` listant :
- 3 commits (tests rouges / domain+app+infra / web+BDD)
- Patterns établis Phase 3 : sous-agrégat Diagnostic (pattern Lot), purge+réinsert atomique en transaction pour les listes de sous-entités, DUREES_VALIDITE codée domaine versionneable LF, helpers preHandler avec injection `today` pour fonctions pures déterministes
- Dépendances pour plans suivants : Bien.estGelLoyer() consommé par 03-03 (LOC-05 gel), Bien.classeDpe affiché par 03-02 sur fiche Bail (banner gel conditionnel), partial-badge-dpe.ejs réutilisé 03-02/03-03, helpers DP-18 étendus en 03-02 (formaterEtatItem) / 03-03 (formaterTrimestreIRL) / 03-04 (formaterRaisonNonApplication)
- Notes éventuelles sur l'ordre d'exécution migrations 0001 → 0006 (Phase 2) → 0007 (Phase 3)
</output>

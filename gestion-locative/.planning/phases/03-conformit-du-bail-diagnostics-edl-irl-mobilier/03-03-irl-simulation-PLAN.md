---
phase: 03
plan: 03
plan_id: "03-03"
type: execute
wave: 3
depends_on: ["03-01"]
files_modified:
  - src/domain/_shared/money.ts
  - src/domain/locatif/bail.ts
  - src/domain/locatif/erreurs.ts
  - src/application/locatif/simuler-indexation-irl.ts
  - src/application/locatif/lister-bails-indexables.ts
  - src/web/schemas/indexation-schemas.ts
  - src/web/routes/indexations.ts
  - src/web/routes/baux.ts
  - src/web/views/pages/baux/indexer/saisie.ejs
  - src/web/views/pages/baux/indexer/simulation.ejs
  - src/web/views/pages/baux/indexer/gel-loyer.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/partials/partial-indexation-banner.ejs
  - src/web/views/partials/wizard-irl-layout.ejs
  - src/helpers/format-trimestre-irl.ts
  - src/main.ts
  - tests/_builders/locatif.ts
  - tests/unit/_shared/money-multiply-by-ratio.test.ts
  - tests/unit/locatif/bail-date-anniversaire.test.ts
  - tests/unit/locatif/bail-simuler-indexation.test.ts
  - tests/unit/locatif/lister-bails-indexables.test.ts
  - tests/unit/helpers/format-trimestre-irl.test.ts
  - tests/bdd/features/indexation-irl-simulation.feature
  - tests/bdd/features/gel-loyer-climat.feature
  - tests/bdd/step_definitions/indexation-irl.steps.ts
autonomous: true
requirements: ["LOC-04", "LOC-05"]

mvp_split_rationale: |
  Vertical slice combinée LOC-04 (partie simulation seulement) + LOC-05 (gel loyer Climat F/G).
  LOC-04 est splitté en 2 plans : 03-03 = simulation read-only (banner + saisie IRL + calcul + bloc gel)
  et 03-04 = application (avenant PDF + régénération échéances + table append-only).
  La séparation est justifiée par la **taille** : 03-04 ajoute un agrégat (BailIndexation), une migration,
  un PDF builder pdfmake, un use case transactionnel multi-repos avec compensation — chacun consomme
  20-30% contexte. Combiner serait > 50% target.
  Wave 3 — depend on 03-01 pour Bien.estGelLoyer(). Pas de dépendance sur 03-02 (EDL ne touche pas IRL).

must_haves:
  truths:
    - "Bail.dateAnniversaireProchaine(today: PlainDate) → PlainDate méthode pure du domaine (DP-20 résolu : méthode sur l'agrégat, pas service externe). Algorithme : N = ceil((today - dateDebut) / 1 year) puis return dateDebut.add({years: N}). Edge case today < dateDebut → return dateDebut.add({years: 1})."
    - "Bail.simulerIndexation(irlNouveau: IRL, classeDpeBien: ClasseDpe | null) → { nouveauLoyerHc: Money, gelLoyer: boolean, raison?: 'gel_dpe' } méthode pure du domaine. Si classeDpeBien ∈ {F, G} → { nouveauLoyerHc: this.loyerHc (inchangé), gelLoyer: true, raison: 'gel_dpe' } sans calcul."
    - "Sinon (DPE A-E ou null) : nouveauLoyerHc = this.loyerHc.multiplyByRatio(num, den, 'banker') où num = parseFloat(irlNouveau.valeur) × 100 (centièmes), den = parseFloat(this.irlReference.valeur) × 100. Banker's rounding sur les centimes du résultat final, pas d'accumulation (DP-16 résolu)."
    - "NOUVELLE méthode Money.multiplyByRatio(num: bigint, den: bigint, mode: 'banker' | 'floor' | 'ceil' = 'banker'): Money — accepte num > den (cas indexation hausse). Préserve invariant den > 0 et num >= 0. Banker's rounding identique à multiplyByFraction. NE PAS modifier multiplyByFraction existant (invariant num ≤ den critique pour Phase 2 prorata)."
    - "Banner révision IRL (partial-indexation-banner.ejs) affiché sur la fiche Bail si bail.actifDepuis !== null ET today >= dateAnniversaireProchaine ET aucune indexation appliquée dans les 12 derniers mois (D-90)."
    - "Page wizard IRL étape 2 (saisie) GET /baux/:id/indexer : si bien.estGelLoyer() === true → render gel-loyer.ejs (role='alert', bouton 'Compris' unique vers /baux/:id, PAS de formulaire saisie). Sinon → render saisie.ejs (formulaire 2 champs trimestre + valeur IRL)."
    - "Le bloc gel D-92 (LOC-05) est server-side : protection en profondeur, ne peut être contournée via POST direct (route POST /baux/:id/indexer/simuler vérifie estGelLoyer en serveur, throw GelLoyerClimatActif)."
    - "Page wizard IRL étape 3 (simulation) POST /baux/:id/indexer/simuler : appel Bail.simulerIndexation, render simulation.ejs avec tableau comparatif (loyer avant / IRL avant / IRL après / nouveau loyer / différence / formule explicite UI-SPEC L320-330). Si gelLoyer dans le résultat → redirect /baux/:id/indexer (re-render gel-loyer.ejs)."
    - "Workflow IRL = 5 étapes UI-SPEC : (1) banner sur fiche bail, (2) saisie IRL `/baux/:id/indexer`, (3) simulation `POST /baux/:id/indexer/simuler` render simulation.ejs, (4) confirmation render confirmation.ejs avec 2 boutons (Appliquer / Ne pas indexer), (5) résultat redirect après apply (étapes 4-5 sont 03-04)."
    - "Wizard step indicator : <ol aria-label='Étapes de la révision IRL'> avec <li aria-current='step'> sur l'étape courante. Sessions Fastify : req.session.indexationDraft = { irlTrimestre, irlValeur } entre étapes 2→3→4."
    - "Helper formaterTrimestreIRL('2026-T1') → '1er trimestre 2026' (DP-18). Format canonique domain '{YYYY}-T{N}' (regex Phase 1 IRL VO L4)."
    - "Zod indexationSaisieSchema accepte les DEUX formats trimestre : canonique '2026-T1' (préféré domain) ET UI-SPEC '1T2026' (français convention). Transform Zod normalise vers canonique avant de construire IRL.creer."
    - "lister-bails-indexables(today, repos, clock) → BailId[] : tous bails actifs avec today >= dateAnniversaireProchaine ET (aucune BailIndexation OR dernière > 12 mois). PRÉPARE 03-04 + 03-05 + Phase 7 dashboard cross-Bien."
    - "BDD @loc-04 (simulation) + @loc-05 (gel) : 6 scenarios verts couvrant détection anniversaire, calcul IRL banker (cas réel INSEE), gel DPE F bloque hard, gel DPE G idem, DPE A-E proceed, format trimestre."
  artifacts:
    - path: "src/domain/_shared/money.ts"
      provides: "NOUVELLE méthode Money.multiplyByRatio(num, den, mode) — accepte num > den, préserve multiplyByFraction existant"
      exports: ["Money"]
    - path: "src/domain/locatif/bail.ts"
      provides: "Bail étendu : dateAnniversaireProchaine + simulerIndexation"
      exports: ["Bail"]
    - path: "src/application/locatif/simuler-indexation-irl.ts"
      provides: "Use case read-only (lookup bail + bien + appel Bail.simulerIndexation) — vérifie gel server-side"
      exports: ["simulerIndexationIRL"]
    - path: "src/application/locatif/lister-bails-indexables.ts"
      provides: "Use case read-only — liste BailId[] avec anniversaire atteint et pas d'indexation récente"
      exports: ["listerBailsIndexables"]
    - path: "src/web/routes/indexations.ts"
      provides: "Routes Fastify wizard : GET /baux/:id/indexer + POST /baux/:id/indexer/simuler + POST /baux/:id/indexer/confirmer (étapes 2-4)"
      exports: ["plugin"]
    - path: "src/web/views/pages/baux/indexer/saisie.ejs"
      provides: "Wizard étape 2 — formulaire saisie IRL"
    - path: "src/web/views/pages/baux/indexer/simulation.ejs"
      provides: "Wizard étape 3 — tableau comparatif avec formule explicite + 2 boutons (Confirmer / Retour)"
    - path: "src/web/views/pages/baux/indexer/gel-loyer.ejs"
      provides: "Wizard étape 2-alt — bloc bloquant role='alert' DPE F/G + bouton Compris"
    - path: "src/web/views/partials/partial-indexation-banner.ejs"
      provides: "Partial banner cliquable conditionnel sur fiche Bail (D-90)"
    - path: "src/web/views/partials/wizard-irl-layout.ejs"
      provides: "Partial wizard layout dédié IRL avec step indicator ol/li 5 étapes"
    - path: "src/helpers/format-trimestre-irl.ts"
      provides: "Helper preHandler formaterTrimestreIRL(trimestre) — DP-18"
      exports: ["formaterTrimestreIRL"]
  key_links:
    - from: "src/domain/locatif/bail.ts"
      to: "src/domain/_shared/money.ts"
      via: "Bail.simulerIndexation utilise Money.multiplyByRatio (nouvelle méthode) pour IRL hausse"
      pattern: "multiplyByRatio"
    - from: "src/domain/locatif/bail.ts"
      to: "src/domain/_shared/duree-validite-diagnostic.ts"
      via: "Bail.simulerIndexation reçoit classeDpeBien: ClasseDpe | null — check gel F/G ; type partagé via shared kernel (résolution warning checker — pas de cycle locatif→patrimoine)"
      pattern: "ClasseDpe"
    - from: "src/application/locatif/simuler-indexation-irl.ts"
      to: "src/domain/patrimoine/bien.ts"
      via: "Use case lookup bien.estGelLoyer() (créé 03-01) avant tout calcul"
      pattern: "estGelLoyer"
    - from: "src/web/views/pages/baux/detail.ejs"
      to: "src/web/views/partials/partial-indexation-banner.ejs"
      via: "<% if (bailIndexable) { %><%- include('../../partials/partial-indexation-banner', {...}) %><% } %>"
      pattern: "partial-indexation-banner"
    - from: "src/web/routes/indexations.ts"
      to: "src/application/locatif/simuler-indexation-irl.ts"
      via: "POST /baux/:id/indexer/simuler appelle simulerIndexationIRL({bailId, irlTrimestre, irlValeur}, repos)"
      pattern: "simulerIndexationIRL"
---

<objective>
Vertical slice combinée LOC-04 partie simulation (banner anniversaire + saisie IRL + calcul + workflow étapes 2-3-4) + LOC-05 gel loyer Climat DPE F/G (blocage dur server-side).

Purpose: LOC-04 satisfait l'article 17-1 de la loi 89-462 (révision annuelle IRL — faculté du bailleur). LOC-05 satisfait le décret 2022-1313 (gel loyer Climat F/G — interdit toute hausse de loyer). Le calcul IRL utilise la formule légale `nouveau = ancien × (IRL_nouveau / IRL_ancien)` avec banker's rounding (DP-16 réutilise pattern Phase 2). La protection gel est **server-side** : un user qui forcerait POST direct est rejeté par le use case.
Output: Banner cliquable sur fiche Bail si anniversaire atteint + wizard 5 étapes (étapes 2-4 ici, 5 livrée 03-04) + bloc bloquant gel DPE F/G + nouvelle méthode Money.multiplyByRatio.
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
@.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md
@CLAUDE.md
@BDD_PRACTICES.md
@SOFTWARE_CRAFTSMANSHIP.md
@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md
@LOCATION_MEUBLEE_REGLES.md
@src/domain/_shared/identifiants.ts
@src/domain/_shared/clock.ts
@src/domain/_shared/money.ts
@src/domain/_shared/irl.ts
@src/domain/locatif/bail.ts
@src/domain/locatif/bail-repository.ts
@src/domain/patrimoine/bien.ts
@src/domain/patrimoine/bien-repository.ts
@src/infrastructure/repositories/bail-repository-sqlite.ts
@src/web/routes/baux.ts
@src/web/routes/wizard.ts
@src/web/schemas/bail-schemas.ts
@src/web/views/pages/baux/detail.ejs
@src/web/views/partials/wizard-layout.ejs
@src/web/views/partials/form-field.ejs
@src/web/views/partials/banniere-warning.ejs
@src/main.ts
@tests/_builders/locatif.ts
@tests/_builders/patrimoine.ts
@tests/unit/_shared/money.test.ts
@tests/unit/locatif/bail.test.ts
</context>

<interfaces>
Contrats clés Phase 1/3-01 (réutilisés) :

- `Money.multiplyByFraction(num, den, mode)` : EXISTANT, invariant `0 ≤ num ≤ den` — ne pas casser (utilisé Phase 2 prorata). **Ajouter** `multiplyByRatio(num, den, mode)` qui assouplit pour `num > den`.
- `IRL` VO : `IRL.creer({ trimestre: '2026-T1', valeur: '145.47' })`, `IRL.egale(other)`. Format domain canonique `^\d{4}-T[1-4]$` strict.
- `Bien.estGelLoyer()` (créé 03-01) : `classeDpe === 'F' || classeDpe === 'G'`.
- `Bien.classeDpe: ClasseDpe | null` (créé 03-01).
- `Clock` port : `aujourdhui(): Temporal.PlainDate`.
- `Bail.dateDebut: Temporal.PlainDate`, `Bail.dureeMois: number`, `Bail.loyerHc: Money`, `Bail.irlReference: IRL`, `Bail.actifDepuis: Temporal.PlainDate | null` (Phase 2).
- `BailIntrouvable`, `BienIntrouvable` exceptions (Phase 1).

Nouveaux contrats Phase 3-03 (exposés à 03-04 + 03-05) :

- `Money.multiplyByRatio(num: bigint, den: bigint, mode: 'banker' | 'floor' | 'ceil' = 'banker'): Money` — nouvelle méthode (NE PAS modifier multiplyByFraction). Invariants : `den > 0` sinon InvariantViolated, `num >= 0` sinon InvariantViolated. Pas de borne supérieure sur num (accepte hausse). Banker's rounding identique à multiplyByFraction. Tests dédiés `tests/unit/_shared/money-multiply-by-ratio.test.ts`.
- `Bail.dateAnniversaireProchaine(today: Temporal.PlainDate): Temporal.PlainDate` — méthode pure (read-only, no copy-on-write).
  - Si `today.compare(this.dateDebut) < 0` (today AVANT dateDebut → bail futur) → return `this.dateDebut.add({ years: 1 })`.
  - Sinon : `const diff = this.dateDebut.until(today, { largestUnit: 'years' }); const N = diff.years + (diff.months > 0 || diff.days > 0 ? 1 : 0); return this.dateDebut.add({ years: N === 0 ? 1 : N });`. **LOCKÉ** : utiliser Temporal.PlainDate API native (`until` + `add`) qui clamp correctement le 29 février bissextile vers le 28 février les années non bissextiles (comportement standard de Temporal — voir T15). Pas d'algorithme custom.
- `Bail.simulerIndexation(irlNouveau: IRL, classeDpeBien: ClasseDpe | null): { nouveauLoyerHc: Money; gelLoyer: boolean; raison?: 'gel_dpe' }` — méthode pure (read-only). Pas de mutation.
  - Si `classeDpeBien === 'F' || classeDpeBien === 'G'` → return `{ nouveauLoyerHc: this.loyerHc, gelLoyer: true, raison: 'gel_dpe' }`.
  - Sinon :
    - `const valeurAvant = parseFloat(this.irlReference.valeur);` `const valeurApres = parseFloat(irlNouveau.valeur);`
    - **Précision** : utiliser BigInt sur centièmes pour éviter le drift float : `const den = BigInt(Math.round(valeurAvant * 100));` `const num = BigInt(Math.round(valeurApres * 100));`
    - `const nouveauLoyerHc = this.loyerHc.multiplyByRatio(num, den, 'banker');`
    - Return `{ nouveauLoyerHc, gelLoyer: false }`.
- `GelLoyerClimatActif extends Error` (nouvelle erreur `src/domain/locatif/erreurs.ts`) : `constructor(bailId, classeDpe) { super('Gel loyer Climat actif (DPE ' + classeDpe + '). Toute hausse de loyer est interdite par le décret n° 2022-1313, prorogé. L\'indexation ne peut pas être appliquée.'); this.name = 'GelLoyerClimatActif'; this.classeDpe = classeDpe; }` — wording UI-SPEC L307.
- `simulerIndexationIRL(commande: { bailId: BailId; irlTrimestre: string; irlValeur: string }, repos: { bailRepo, bienRepo }): Promise<{ loyerAvant: Money; loyerApres: Money; irlAvant: IRL; irlApres: IRL; gelLoyer: boolean; classeDpeBien: ClasseDpe | null; formule: string }>` :
  1. `bail = await bailRepo.trouverParId(commande.bailId)` → throw BailIntrouvable si null.
  2. `bien = await bienRepo.trouverParId(bail.bienId)` → throw BienIntrouvable si null.
  3. `irlNouveau = IRL.creer({ trimestre: commande.irlTrimestre, valeur: commande.irlValeur })` (peut throw InvariantViolated sur format).
  4. `if (bien.estGelLoyer()) throw new GelLoyerClimatActif(bail.id, bien.classeDpe!);` (server-side defense in depth — la route UI a déjà filtré, mais ici on REJETTE si user contourne).
  5. `const result = bail.simulerIndexation(irlNouveau, bien.classeDpe);` — gelLoyer toujours false ici car on a throw avant.
  6. Return `{ loyerAvant: bail.loyerHc, loyerApres: result.nouveauLoyerHc, irlAvant: bail.irlReference, irlApres: irlNouveau, gelLoyer: false, classeDpeBien: bien.classeDpe, formule: bail.loyerHc.enEuros() + ' × (' + irlNouveau.valeur + ' / ' + bail.irlReference.valeur + ') = ' + result.nouveauLoyerHc.enEuros() }`.
- `listerBailsIndexables(repos: { bailRepo, bailIndexationRepo? }, clock: Clock): Promise<BailId[]>` :
  - `const today = clock.aujourdhui();`
  - `const bails = await bailRepo.lister();`
  - Filtrer : `bail.actifDepuis !== null && Temporal.PlainDate.compare(today, bail.dateAnniversaireProchaine(today).subtract({ years: 1 })) >= 0` → c'est-à-dire ≥ 1 an depuis dateDebut + N anniversaires précédents.
  - **LOCKÉ** : 03-03 retourne tous les bails dont l'anniversaire est atteint, SANS filtrer par "dernière indexation < 12 mois" (paramètre `bailIndexationRepo` optionnel et non utilisé en 03-03). En 03-04, étendre ce use case pour appeler `bailIndexationRepo.dernierePourBail(bail.id)` et exclure si `cree_le > today.subtract({ months: 12 })`. JSDoc sur la fonction doit mentionner explicitement la limitation 03-03 et la promesse 03-04.
- `Zod indexationSaisieSchema` (`src/web/schemas/indexation-schemas.ts`) :
  - `export const TRIMESTRE_CANONIQUE = /^\d{4}-T[1-4]$/;`
  - `export const TRIMESTRE_UI = /^[1-4]T\d{4}$/;`
  - `export const indexationSaisieSchema = z.object({ irl_trimestre: z.string().regex(/^(\d{4}-T[1-4]|[1-4]T\d{4})$/, 'Format trimestre attendu : YYYY-TN (ex 2026-T1) ou NTYYYY (ex 1T2026).').transform(v => /^[1-4]T\d{4}$/.test(v) ? v[2] + v[3] + v[4] + v[5] + '-T' + v[0] : v), irl_valeur: z.string().regex(/^\d+(\.\d+)?$/, 'La valeur IRL doit être un nombre positif (ex 145.47).') });`
- `wizard-irl-layout.ejs` partial : variables `currentStep: 1|2|3|4|5`, `bailId`, `breadcrumbs`. Rend `<nav aria-label='Étapes de la révision IRL'><ol><li aria-current='step' if step==current>1. Banner</li><li>2. Saisie</li>...</ol></nav><main>` + slot content (via `<%- contenu %>` ou pattern partial wrappers Phase 1 D-58 LEARNINGS layout-debut/layout-fin si plus simple).
- `partial-indexation-banner.ejs` partial : variables `bailId`, `dateAnniversaire`. Rend `<aside role='status' aria-live='polite' style='background: var(--pico-table-row-stripped-background-color); padding: 16px;'>Révision IRL disponible depuis le <%= formatDate(dateAnniversaire) %>. <a href='/baux/<%= bailId %>/indexer' role='button'>Lancer la révision IRL</a></aside>` (wording exact UI-SPEC L317).
- Helper `formaterTrimestreIRL(trimestre: string): string` — `const match = /^(\d{4})-T([1-4])$/.exec(trimestre); if (!match) return trimestre; const [, year, n] = match; return n + (n === '1' ? 'er' : 'e') + ' trimestre ' + year;` (ex: '2026-T1' → '1er trimestre 2026').
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests rouges Wave 0 — Money.multiplyByRatio + Bail.dateAnniversaireProchaine + Bail.simulerIndexation + simulerIndexationIRL + listerBailsIndexables + helper + BDD LOC-04 + LOC-05</name>
  <read_first>
    - src/domain/_shared/money.ts (multiplyByFraction existante — modèle pour multiplyByRatio)
    - src/domain/_shared/irl.ts (VO IRL existant)
    - src/domain/locatif/bail.ts (état actuel Phase 2 — extension méthodes nécessaire)
    - src/domain/patrimoine/bien.ts (état après 03-01 — estGelLoyer + classeDpe consommés ici)
    - src/domain/_shared/clock.ts (ClockFixe pour tests déterministes)
    - tests/_builders/locatif.ts (analog unBailValide)
    - tests/_builders/patrimoine.ts (analog unBienValide avec classeDpe)
    - tests/unit/_shared/money.test.ts (analog multiplyByFraction test — fast-check property tests)
    - tests/unit/locatif/bail.test.ts (analog Bail factory test)
    - tests/bdd/features/quittancement.feature (analog tag isolation + Before/After)
    - LOCATION_MEUBLEE_REGLES.md §3.3 (clauses obligatoires bail — IRL)
    - LMNP.md (anticipation Phase 5 — traçabilité historique pour amortissement)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : Money.multiplyByFraction + bail.ts modifié 4 nouvelles méthodes + simuler-indexation-irl + lister-bails-indexables + indexation-schemas)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md (sections : §LOC-04 §LOC-05 §Color §Wizard IRL navigation §Forms champs irl_* §Banners §Copywriting wording exact D-92 + D-90 + D-95 + Avenant + Simulation tableau)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-90, D-91, D-92, D-95, DP-16, DP-17, DP-20)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-01-diagnostics-PLAN.md (Cucumber World MondePhase3 réutilisé)
  </read_first>
  <behavior>
    - T1 money-multiply-by-ratio.test : `Money.fromCentimes(80000n).multiplyByRatio(14547n, 14206n, 'banker')` (loyer 800€ × IRL 145.47/142.06) → résultat exact banker. Calcul théorique : 80000 × 14547 / 14206 = 81920.45... → banker round to 81920 (pair) car .45 < .5. Vérifier valeur exacte selon math.
    - T2 money-multiply-by-ratio.test : `Money.fromCentimes(100n).multiplyByRatio(3n, 2n, 'banker')` (num > den : ratio 1.5) → 150 centimes (pas de reste).
    - T3 money-multiply-by-ratio.test : `Money.fromCentimes(100n).multiplyByRatio(5n, 4n, 'banker')` (ratio 1.25) → 125 centimes.
    - T4 money-multiply-by-ratio.test : `Money.fromCentimes(100n).multiplyByRatio(0n, 1n)` → 0 centimes.
    - T5 money-multiply-by-ratio.test : `Money.fromCentimes(100n).multiplyByRatio(1n, 0n)` → throw InvariantViolated('Le dénominateur du ratio doit être positif').
    - T6 money-multiply-by-ratio.test : `Money.fromCentimes(100n).multiplyByRatio(-1n, 2n)` → throw InvariantViolated('Le numérateur du ratio doit être positif ou nul').
    - T7 money-multiply-by-ratio.test : `multiplyByRatio` avec mode 'floor' et 'ceil' fonctionne (vérification arrondi).
    - T8 money-multiply-by-ratio.test (fast-check property) : `for all m, num >= 0, den > 0 : m.multiplyByRatio(num, den) ne throw pas + résultat <= m × num/den + 1 centime ET >= m × num/den - 1 centime` (banker écart ≤ 1c).
    - T9 money.test (non-régression) : `multiplyByFraction` existant continue de rejeter `num > den` (test existant + nouveau test explicite).
    - T10 bail-date-anniversaire.test : Bail dateDebut=2026-05-01. today=2026-04-01 (avant dateDebut) → dateAnniversaireProchaine = 2027-05-01 (+ 1 an).
    - T11 bail-date-anniversaire.test : Bail dateDebut=2026-05-01. today=2026-05-01 (jour J) → dateAnniversaireProchaine = 2027-05-01 (LOCKÉ : à dateDebut exact, l'anniversaire est dateDebut + 1 an — le bail commence, premier anniversaire = +1 an).
    - T12 bail-date-anniversaire.test : Bail dateDebut=2026-05-01. today=2027-05-01 (1 an plus tard, jour J) → dateAnniversaireProchaine = 2028-05-01 (le N précédent vient d'arriver, le prochain est +1 an).
    - T13 bail-date-anniversaire.test : Bail dateDebut=2026-05-01. today=2027-06-15 (1 an et 1.5 mois après) → dateAnniversaireProchaine = 2028-05-01.
    - T14 bail-date-anniversaire.test : Bail dateDebut=2026-05-01. today=2030-12-31 (4+ ans après) → dateAnniversaireProchaine = 2031-05-01.
    - T15 bail-date-anniversaire.test : Bail dateDebut=2024-02-29 (bissextile). today=2025-02-28 → dateAnniversaireProchaine = 2025-02-28 (LOCKÉ : Temporal.PlainDate.add({years:1}) sur 2024-02-29 retourne 2025-02-28 nativement par clamp du jour — comportement Temporal standard ; l'anniversaire est atteint à dateDebut+1y, qui est exactement today, donc on retourne ce jour-J comme "atteint maintenant" — cohérent avec T11 sémantique "atteint ≥ aujourd'hui").
    - T16 bail-simuler-indexation.test : Bail loyerHc=80000 centimes (800€), irlReference={trimestre:'2024-T4', valeur:'142.06'}. simulerIndexation(IRL{2025-T4, 145.47}, 'D') → { nouveauLoyerHc: ~81920 centimes, gelLoyer: false } (calcul exact à vérifier banker).
    - T17 bail-simuler-indexation.test : Même bail. simulerIndexation(IRL{2025-T4, 145.47}, 'F') → { nouveauLoyerHc: 80000 (inchangé), gelLoyer: true, raison: 'gel_dpe' }.
    - T18 bail-simuler-indexation.test : Même bail. simulerIndexation(IRL{2025-T4, 145.47}, 'G') → idem 'F' (gelLoyer: true).
    - T19 bail-simuler-indexation.test : Même bail. simulerIndexation(IRL{2025-T4, 145.47}, null) → { gelLoyer: false } (classeDpe null = pas de gel, traité comme A-E).
    - T20 bail-simuler-indexation.test : Bail avec IRL identique avant/après → ratio = 1 → nouveauLoyerHc === loyerHc (cas IRL stable).
    - T21 bail-simuler-indexation.test : Bail avec IRL_nouveau < IRL_ancien (baisse rare) → nouveauLoyerHc < loyerHc (ratio < 1 — vérifier que multiplyByRatio accepte).
    - T22 simuler-indexation-irl.test (use case) : Mocker bailRepo + bienRepo. Bien classeDpe=D, bail valide. → résultat avec loyerAvant=80000, loyerApres>80000, gelLoyer=false, formule string contenant '800,00 € × (145.47 / 142.06)'.
    - T23 simuler-indexation-irl.test : Bien classeDpe=F → throw GelLoyerClimatActif avec message exact UI-SPEC ('Gel loyer Climat actif (DPE F). Toute hausse de loyer est interdite...').
    - T24 simuler-indexation-irl.test : bailId inexistant → throw BailIntrouvable.
    - T25 simuler-indexation-irl.test : bienId inexistant → throw BienIntrouvable.
    - T26 simuler-indexation-irl.test : IRL format invalide '2026-Q1' (Q au lieu de T) → throw InvariantViolated (de IRL.creer).
    - T27 lister-bails-indexables.test : Mocker bailRepo.lister retourne 3 bails (A actif dateDebut 2025-01-01, B actif dateDebut 2026-01-01, C non actif dateDebut 2025-01-01). today=2026-06-01. → retourne `[A.id]` (B pas encore 1 an, C non actif).
    - T28 format-trimestre-irl.test : `formaterTrimestreIRL('2026-T1')` → '1er trimestre 2026'.
    - T29 format-trimestre-irl.test : `formaterTrimestreIRL('2026-T2')` → '2e trimestre 2026'.
    - T30 format-trimestre-irl.test : `formaterTrimestreIRL('2026-T3')` → '3e trimestre 2026'.
    - T31 format-trimestre-irl.test : `formaterTrimestreIRL('2026-T4')` → '4e trimestre 2026'.
    - T32 format-trimestre-irl.test : `formaterTrimestreIRL('invalid')` → 'invalid' (fallback non destructif).
    - T33 BDD @loc-04 "Banner révision IRL apparait à l'anniversaire" : Given Bail actif dateDebut 2025-05-01 loyerHc 800. ClockFixe '2026-05-15'. When GET /baux/:id. Then la page contient le texte "Révision IRL disponible depuis le 01/05/2026" + lien "Lancer la révision IRL".
    - T34 BDD @loc-04 "Banner absent avant anniversaire" : Given Bail actif dateDebut 2026-01-01. ClockFixe '2026-06-01' (5 mois après dateDebut). When GET /baux/:id. Then la page NE contient PAS "Révision IRL disponible".
    - T35 BDD @loc-04 "Wizard simulation calcul correct" : Given Bail actif dateDebut 2025-05-01 loyerHc 800 irlRef '2024-T4'/142.06, Bien classeDpe='D', ClockFixe '2026-05-15'. When GET /baux/:id/indexer puis POST /baux/:id/indexer/simuler avec irl_trimestre='2025-T4' irl_valeur='145.47'. Then la page render simulation.ejs avec : loyer avant '800,00 €', loyer après '819,21 €' (ou valeur exacte calculée banker), formule '800,00 € × (145.47 / 142.06)'.
    - T36 BDD @loc-05 "DPE F bloque hard" : Given Bail actif, Bien classeDpe='F'. When GET /baux/:id/indexer. Then la page render gel-loyer.ejs avec role='alert', texte 'Gel loyer Climat actif (DPE F)', bouton 'Compris', PAS de formulaire saisie IRL.
    - T37 BDD @loc-05 "DPE F bypass POST refusé" : Given Bail actif, Bien classeDpe='F'. When POST /baux/:id/indexer/simuler avec irl_trimestre+irl_valeur. Then la réponse est une page d'erreur OU redirect vers /baux/:id/indexer (gel-loyer.ejs), AUCUN calcul effectué (defense en profondeur D-92).
    - T38 BDD @loc-05 "DPE G bloque hard idem F" : symétrique T36 avec 'G'.
  </behavior>
  <action>
    TDD outside-in. Créer EXCLUSIVEMENT les tests (rouges).

    1. `tests/unit/_shared/money-multiply-by-ratio.test.ts` (NOUVEAU) : T1-T9.

    2. `tests/unit/locatif/bail-date-anniversaire.test.ts` (NOUVEAU) : T10-T15.

    3. `tests/unit/locatif/bail-simuler-indexation.test.ts` (NOUVEAU) : T16-T21.

    4. `tests/unit/locatif/simuler-indexation-irl.test.ts` (NOUVEAU) : T22-T26. Mocker bailRepo + bienRepo (vitest mock ou stubs manuels).

    5. `tests/unit/locatif/lister-bails-indexables.test.ts` (NOUVEAU) : T27. ClockFixe pour today déterministe.

    6. `tests/unit/helpers/format-trimestre-irl.test.ts` (NOUVEAU) : T28-T32.

    7. ÉTENDRE `tests/_builders/locatif.ts` :
       - `unBailIndexableValide(overrides = {})` : defaults loyerHc 80000n centimes, irlReference '2024-T4'/142.06, dateDebut '2025-05-01', actifDepuis '2025-05-01', dureeMois 12.

    8. ÉTENDRE `tests/_builders/patrimoine.ts` :
       - `unBienAvecDpeF(overrides = {})` : `unBienValide({...overrides, classeDpe: 'F'})`.
       - `unBienAvecDpeD(overrides = {})` : idem 'D'.

    9. `tests/bdd/features/indexation-irl-simulation.feature` (NOUVEAU) : 3 scenarios tag `@loc-04 @phase3` (T33-T35).

    10. `tests/bdd/features/gel-loyer-climat.feature` (NOUVEAU) : 3 scenarios tag `@loc-05 @phase3` (T36-T38).

    11. `tests/bdd/step_definitions/indexation-irl.steps.ts` (NOUVEAU) : Before/After `@loc-04 or @loc-05`. Steps Given Bail + Bien classeDpe / ClockFixe / When GET /POST/baux/:id/indexer* / Then la page contient X / status 200 / DB sans nouvel enregistrement.

    Tests ÉCHOUENT. Commit : `test(03-03): tests rouges Money.multiplyByRatio + Bail.dateAnniversaireProchaine + Bail.simulerIndexation + use case + helper + LOC-04 + LOC-05 (Wave 0)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm test 2>&1 | grep -E "FAIL|fail" | head -25 && ls tests/unit/_shared/money-multiply-by-ratio.test.ts tests/unit/locatif/bail-date-anniversaire.test.ts tests/unit/locatif/bail-simuler-indexation.test.ts tests/unit/locatif/simuler-indexation-irl.test.ts tests/unit/locatif/lister-bails-indexables.test.ts tests/unit/helpers/format-trimestre-irl.test.ts tests/bdd/features/indexation-irl-simulation.feature tests/bdd/features/gel-loyer-climat.feature</automated>
  </verify>
  <done>
    - Tests Wave 0 rouges : 6 fichiers unit + 2 features BDD + 1 steps file + builders étendus.
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Money.multiplyByRatio + Bail (dateAnniversaireProchaine + simulerIndexation) + erreurs + use cases + helper (passer unit au vert)</name>
  <read_first>
    - src/domain/_shared/money.ts (multiplyByFraction L148-178 — modèle copy-coller-adapter)
    - src/domain/locatif/bail.ts (état actuel — où insérer les méthodes après activer/desactiver)
    - src/domain/_shared/irl.ts (VO IRL — réutilisé tel quel)
    - src/domain/patrimoine/bien.ts (état après 03-01 — Bien.estGelLoyer + classeDpe disponibles)
    - src/domain/_shared/clock.ts (port utilisé par use cases)
    - src/helpers/format-date.ts (analog helper français)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : Money + Bail.simulerIndexation + Bail.dateAnniversaireProchaine + simuler-indexation-irl + lister-bails-indexables + format-trimestre-irl)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-91 algorithme étape 3, D-92 wording gel, DP-16 banker, DP-20 méthode sur agrégat)
    - LOCATION_MEUBLEE_REGLES.md §Loi 89 art. 17-1 (formule légale)
    - Tests rouges Task 1
  </read_first>
  <action>
    Créer/modifier dans cet ordre :

    1. `src/domain/_shared/money.ts` (MODIFIER) :
       - Ajouter méthode `multiplyByRatio(num: bigint, den: bigint, mode: 'banker' | 'floor' | 'ceil' = 'banker'): Money` APRÈS `multiplyByFraction` (NE PAS modifier multiplyByFraction).
       - Validation : `if (den <= 0n) throw new InvariantViolated('Le dénominateur du ratio doit être positif');` `if (num < 0n) throw new InvariantViolated('Le numérateur du ratio doit être positif ou nul');`.
       - Pas de borne supérieure sur num.
       - Algorithme : `const produit = this.centimes * num; const quotient = produit / den; const reste = produit % den;` puis logique de mode (floor / ceil / banker round-half-to-even) IDENTIQUE à multiplyByFraction.
       - JSDoc précisant : "Multiplie par un ratio num/den, accepte num > den (cas indexation IRL à la hausse). Différent de multiplyByFraction qui exige 0 ≤ num ≤ den (prorata). DP-16 Phase 3."

    2. `src/domain/locatif/erreurs.ts` (ÉTENDRE) :
       - Ajouter `export class GelLoyerClimatActif extends Error { readonly classeDpe: 'F' | 'G'; constructor(bailId: string, classeDpe: 'F' | 'G') { super('Gel loyer Climat actif (DPE ' + classeDpe + '). Toute hausse de loyer est interdite par le décret n° 2022-1313, prorogé. L\'indexation ne peut pas être appliquée.'); this.name = 'GelLoyerClimatActif'; this.classeDpe = classeDpe; } }` — wording exact UI-SPEC L307.

    3. `src/domain/locatif/bail.ts` (MODIFIER — ajouter 2 méthodes APRÈS desactiver) :
       - Import `import type { ClasseDpe } from '../_shared/duree-validite-diagnostic.js';` (LOCKÉ : 03-01 a placé le module en `domain/_shared/` pour éviter le cycle locatif → patrimoine ; voir 03-01 task 1 step 4 — shared kernel cross-BC justifié par 2 usages : `Bien.estGelLoyer` et `Bail.simulerIndexation`).
       - Méthode `dateAnniversaireProchaine(today: Temporal.PlainDate): Temporal.PlainDate` :
         - Pure, no copy-on-write.
         - Algorithme : `if (Temporal.PlainDate.compare(today, this.dateDebut) < 0) return this.dateDebut.add({ years: 1 });`
         - Sinon : `const diff = this.dateDebut.until(today, { largestUnit: 'years' });`
         - `const dateCetAnniversaire = this.dateDebut.add({ years: diff.years });`
         - Si `Temporal.PlainDate.compare(dateCetAnniversaire, today) > 0` → `return dateCetAnniversaire;` (anniversaire futur cette année).
         - Sinon `return this.dateDebut.add({ years: diff.years + 1 });` (cet anniversaire déjà passé OU exactement aujourd'hui, prochain dans 1 an).
       - Méthode `simulerIndexation(irlNouveau: IRL, classeDpeBien: ClasseDpe | null): { nouveauLoyerHc: Money; gelLoyer: boolean; raison?: 'gel_dpe' }` :
         - Pure read-only.
         - `if (classeDpeBien === 'F' || classeDpeBien === 'G') return { nouveauLoyerHc: this.loyerHc, gelLoyer: true, raison: 'gel_dpe' };`
         - `const valeurAvant = parseFloat(this.irlReference.valeur); const valeurApres = parseFloat(irlNouveau.valeur);`
         - `const den = BigInt(Math.round(valeurAvant * 100)); const num = BigInt(Math.round(valeurApres * 100));` (centièmes pour précision sans drift float).
         - `const nouveauLoyerHc = this.loyerHc.multiplyByRatio(num, den, 'banker');`
         - `return { nouveauLoyerHc, gelLoyer: false };`

    4. `src/application/locatif/simuler-indexation-irl.ts` (NOUVEAU) :
       - Voir signature dans <interfaces>.
       - **Defense en profondeur** : `if (bien.estGelLoyer()) throw new GelLoyerClimatActif(bail.id, bien.classeDpe!);` AVANT d'appeler `bail.simulerIndexation`.
       - Construire formule string lisible UI-SPEC L324-330.

    5. `src/application/locatif/lister-bails-indexables.ts` (NOUVEAU) :
       - Voir signature dans <interfaces>.
       - DOCUMENTER que la version 03-03 ne filtre PAS par "indexation < 12 mois" (BailIndexationRepository n'existe qu'en 03-04). Étendre en 03-04.

    6. `src/helpers/format-trimestre-irl.ts` (NOUVEAU) :
       - Voir implémentation dans <interfaces>.

    Vérifs : `pnpm tsc --noEmit` 0. `pnpm lint:deps` 0 (vérifier que l'import ClasseDpe ne crée pas de cycle). Tests unit verts.

    Commit : `feat(03-03): Money.multiplyByRatio + Bail.dateAnniversaireProchaine + Bail.simulerIndexation + GelLoyerClimatActif + use cases simuler/lister + helper trimestre (LOC-04 simulation + LOC-05 gel domain)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint:deps && pnpm test:unit run tests/unit/_shared/money-multiply-by-ratio.test.ts tests/unit/_shared/money.test.ts tests/unit/locatif/bail-date-anniversaire.test.ts tests/unit/locatif/bail-simuler-indexation.test.ts tests/unit/locatif/simuler-indexation-irl.test.ts tests/unit/locatif/lister-bails-indexables.test.ts tests/unit/helpers/format-trimestre-irl.test.ts</automated>
  </verify>
  <done>
    - Money.multiplyByRatio nouvelle méthode (multiplyByFraction préservée).
    - Bail.dateAnniversaireProchaine + Bail.simulerIndexation (2 méthodes pures).
    - GelLoyerClimatActif erreur domaine avec wording UI-SPEC exact.
    - 2 use cases (simulerIndexationIRL, listerBailsIndexables).
    - 1 helper preHandler formaterTrimestreIRL.
    - Tests unit VERTS, non-régression Phase 1/2 (multiplyByFraction toujours invariant 0 ≤ num ≤ den).
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Routes wizard IRL étapes 2-4 + schema Zod + views (saisie, simulation, confirmation, gel-loyer) + partial banner + wizard layout + extension fiche Bail + BDD LOC-04 + LOC-05 verts</name>
  <read_first>
    - src/web/routes/wizard.ts (analog multi-step + session.indexationDraft pattern + Session interface extension)
    - src/web/routes/baux.ts (état actuel — sera étendu pour lookup bailIndexable + Bien classeDpe)
    - src/web/schemas/bien-schemas.ts (analog Zod + transform helper)
    - src/web/views/partials/wizard-layout.ejs (analog wizard step indicator — modèle pour wizard-irl-layout)
    - src/web/views/pages/wizard/bien.ejs (analog wizard step view)
    - src/web/views/pages/baux/detail.ejs (état actuel — banner conditionnel à insérer)
    - src/web/views/partials/banniere-warning.ejs (analog aside role=alert)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md (sections : §LOC-04 wizard 5 étapes §LOC-05 gel bloquant §Color §Forms champs irl_* §Wizard navigation §Banners §Copywriting CTAs primaires + wording exact D-92 + D-90 §Route Map)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : routes/indexations + indexation-schemas + wizard-irl-layout + partial-indexation-banner + pages/baux/indexer/*)
    - Tests rouges BDD Task 1
  </read_first>
  <action>
    Créer/modifier :

    1. `src/web/schemas/indexation-schemas.ts` (NOUVEAU) :
       - `export const indexationSaisieSchema = z.object({ irl_trimestre: z.string().regex(/^(\d{4}-T[1-4]|[1-4]T\d{4})$/, 'Format trimestre attendu : 2026-T1 ou 1T2026.').transform(v => /^[1-4]T\d{4}$/.test(v) ? (v.slice(2) + '-T' + v[0]) : v), irl_valeur: z.string().regex(/^\d+(\.\d+)?$/, 'La valeur IRL doit être un nombre positif (ex 145.47).') });`
       - Helper `formaterTrimestreUIVersCanonique(s: string): string` exposé si réutilisé ailleurs.

    2. `src/web/routes/indexations.ts` (NOUVEAU) :
       - Étendre Session : `declare module 'fastify' { interface Session { indexationDraft?: { irlTrimestre: string; irlValeur: string } } }` (pattern wizard.ts).
       - `export async function plugin(app, opts: { bailRepo, bienRepo }): Promise<void>`.
       - `GET /baux/:id/indexer` (étape 2 OU bloc gel) :
         - Lookup bail (404 si absent), lookup bien (404 si absent).
         - Si `bien.estGelLoyer()` → `return reply.view('pages/baux/indexer/gel-loyer.ejs', { bail, bien, classeDpe: bien.classeDpe, navActive: 'baux', breadcrumbs: [...], currentStep: 2 });`
         - Sinon → `return reply.view('pages/baux/indexer/saisie.ejs', { bail, bien, valeurs: req.session.indexationDraft ?? {}, erreurs: {}, navActive: 'baux', breadcrumbs: [...], currentStep: 2 });`
       - `POST /baux/:id/indexer/simuler` (étape 3) :
         - Lookup bail + bien.
         - `const body = req.body; const parsed = indexationSaisieSchema.safeParse(body);`
         - Si !success → re-render saisie.ejs avec erreurs.
         - try `const result = await simulerIndexationIRL({ bailId: id as BailId, irlTrimestre: parsed.data.irl_trimestre, irlValeur: parsed.data.irl_valeur }, { bailRepo: opts.bailRepo, bienRepo: opts.bienRepo });`
         - `req.session.indexationDraft = { irlTrimestre: parsed.data.irl_trimestre, irlValeur: parsed.data.irl_valeur };`
         - `return reply.view('pages/baux/indexer/simulation.ejs', { bail, bien, result, currentStep: 3, breadcrumbs: [...], navActive: 'baux' });`
         - Catch `GelLoyerClimatActif` (defense en profondeur) → `return reply.code(403).view('pages/baux/indexer/gel-loyer.ejs', { bail, bien, classeDpe: bien.classeDpe, currentStep: 2 });`
         - Catch `InvariantViolated | BailIntrouvable | BienIntrouvable` → re-render saisie.ejs avec err.message.
       - `POST /baux/:id/indexer/confirmer` (étape 4) :
         - Lookup bail + bien + indexationDraft.
         - Si `!req.session.indexationDraft` → redirect /baux/:id/indexer.
         - Re-calculer simulation pour render confirmation.ejs avec 2 boutons (Appliquer = 03-04 / Ne pas indexer = 03-04). Note : confirmation.ejs sera créé en 03-04 (lui-même est lié au use case apply). En 03-03 on peut créer un stub `confirmation.ejs` minimal qui affiche le tableau + un message "Étape suivante : disponible en 03-04" SI on veut tester le flux complet wizard. OU bien différer entièrement 03-04. DÉCISION EXECUTOR : créer un stub confirmation.ejs minimal (le formulaire avec 2 buttons) qui POST vers `/baux/:id/indexer/appliquer` ou `/baux/:id/indexer/renoncer` (routes créées 03-04). En 03-03 ces 2 POST n'existent pas encore → 404 attendu. Tests BDD 03-03 s'arrêtent à l'étape 3.
       - Routes wizard `appliquer` et `renoncer` + GET avenant PDF = créées en 03-04.

    3. `src/web/views/partials/wizard-irl-layout.ejs` (NOUVEAU) :
       - Variables : `currentStep: 1|2|3|4|5`, `bailId`, `bailLocataireNom: string`.
       - `<nav aria-label="Étapes de la révision IRL"><ol><li<% if (currentStep === 1) { %> aria-current="step"<% } %>>1. Banner</li><li<% if (currentStep === 2) { %> aria-current="step"<% } %>>2. Saisie IRL</li><li<% if (currentStep === 3) { %> aria-current="step"<% } %>>3. Simulation</li><li<% if (currentStep === 4) { %> aria-current="step"<% } %>>4. Confirmation</li><li<% if (currentStep === 5) { %> aria-current="step"<% } %>>5. Résultat</li></ol></nav><p><small>Étape <%= currentStep %> sur 5</small></p>`
       - Précédé par layout-debut (titre passé en param) et suivi par layout-fin.

    4. `src/web/views/pages/baux/indexer/saisie.ejs` (NOUVEAU) :
       - `<%- include('../../partials/layout-debut', { titre: 'Révision IRL — saisie', breadcrumbs: [{url:'/baux', label:'Baux'}, {url:'/baux/'+bail.id, label: 'Bail '+bail.id.slice(0,8)}, {label:'Révision IRL'}], navActive: 'baux' }) %>`
       - `<%- include('../../partials/wizard-irl-layout', { currentStep: 2, bailId: bail.id }) %>`
       - `<h1>Saisir le nouvel IRL</h1>`
       - `<p>Récupérez la valeur IRL sur <a href="https://www.insee.fr/" target="_blank" rel="noopener">insee.fr</a>.</p>`
       - `<form method="POST" action="/baux/<%= bail.id %>/indexer/simuler" novalidate>`
       -   Champ irl_trimestre : `<label for="irl_trimestre">Trimestre IRL <span aria-hidden="true">*</span></label><input id="irl_trimestre" name="irl_trimestre" type="text" pattern="(\d{4}-T[1-4]|[1-4]T\d{4})" required value="<%= valeurs.irl_trimestre ?? '' %>" /><small>Format : 2026-T1 ou 1T2026</small>` + erreur inline.
       -   Champ irl_valeur : `<label for="irl_valeur">Valeur IRL <span aria-hidden="true">*</span></label><input id="irl_valeur" name="irl_valeur" type="number" step="0.01" min="1" required value="<%= valeurs.irl_valeur ?? '' %>" />` + erreur inline.
       -   `<button type="submit">Simuler la révision</button>` + `<a href="/baux/<%= bail.id %>" role="button" class="secondary">Annuler</a>`.
       - `</form>`
       - `<%- include('../../partials/layout-fin') %>`

    5. `src/web/views/pages/baux/indexer/simulation.ejs` (NOUVEAU) :
       - layout-debut + wizard-irl-layout (currentStep: 3).
       - `<h1>Simulation de la révision</h1>`
       - Tableau UI-SPEC L320-330 exact : `<table role="table" aria-label="Simulation révision IRL"><tr><th>Loyer actuel (HC)</th><td><%= formatMoney(result.loyerAvant) %></td></tr><tr><th>IRL de référence</th><td><%= formaterTrimestreIRL(result.irlAvant.trimestre) %> — <%= result.irlAvant.valeur %></td></tr><tr><th>Nouvel IRL saisi</th><td><%= formaterTrimestreIRL(result.irlApres.trimestre) %> — <%= result.irlApres.valeur %></td></tr><tr><th><strong>Nouveau loyer calculé (HC)</strong></th><td><strong><%= formatMoney(result.loyerApres) %></strong></td></tr><tr><th>Différence</th><td><%= /* calcul delta : result.loyerApres.soustraire(result.loyerAvant) en euros + signe */ %></td></tr><tr><th>Formule</th><td><%= result.formule %></td></tr></table>`
       - `<form method="POST" action="/baux/<%= bail.id %>/indexer/confirmer"><button type="submit">Confirmer les valeurs</button></form>`
       - `<a href="/baux/<%= bail.id %>/indexer" role="button" class="secondary">Retour</a>`
       - `<a href="/baux/<%= bail.id %>" role="button" class="contrast">Annuler</a>`
       - layout-fin.

    6. `src/web/views/pages/baux/indexer/gel-loyer.ejs` (NOUVEAU) :
       - layout-debut + wizard-irl-layout (currentStep: 2).
       - `<section role="alert" aria-live="assertive" autofocus tabindex="-1">`
       -   `<h1>Indexation impossible</h1>`
       -   `<p>Gel loyer Climat actif (DPE <%= classeDpe %>). Toute hausse de loyer est interdite par le décret n° 2022-1313, prorogé. L'indexation ne peut pas être appliquée.</p>`
       -   `<p><small>Référence : décret n° 2022-1313 du 13/10/2022, classes énergétiques F et G (Code de l'énergie L173-1-1).</small></p>`
       -   `<a href="/baux/<%= bail.id %>" role="button">Compris</a>`
       - `</section>`
       - layout-fin.

    7. `src/web/views/partials/partial-indexation-banner.ejs` (NOUVEAU) :
       - Variables : `bailId`, `dateAnniversaire: Temporal.PlainDate`, `helpers: { formatDate }`.
       - `<aside role="status" aria-live="polite" style="background: var(--pico-table-row-stripped-background-color); padding: 16px; border-left: 4px solid var(--pico-primary); margin-bottom: 24px;"><strong>Révision IRL disponible</strong> depuis le <%= helpers.formatDate(dateAnniversaire) %>. <a href="/baux/<%= bailId %>/indexer" role="button">Lancer la révision IRL</a></aside>` — wording exact UI-SPEC L317.

    8. ÉTENDRE `src/web/views/pages/baux/detail.ejs` :
       - **Avant** la section État des lieux (créée 03-02) : ajouter le banner conditionnel.
       - La route GET /baux/:id doit calculer `const bailIndexable = bail.actifDepuis && Temporal.PlainDate.compare(today, bail.dateAnniversaireProchaine(today).subtract({years: 1})) >= 0 && /* TODO 03-04 : pas d'indexation < 12 mois */ true;` et passer `bailIndexable` + `dateAnniversaire = bail.dateAnniversaireProchaine(today).subtract({years: 1})` (la dernière atteinte) en locals.
       - EJS : `<% if (bailIndexable) { %><%- include('../partials/partial-indexation-banner', { bailId: bail.id, dateAnniversaire, helpers: { formatDate } }) %><% } %>`

    9. ÉTENDRE `src/web/routes/baux.ts` :
       - GET /baux/:id : ajouter dans la route `const today = clock.aujourdhui(); const bien = await opts.bienRepo.trouverParId(bail.bienId); const bailIndexable = bail.actifDepuis !== null && Temporal.PlainDate.compare(today, bail.dateAnniversaireProchaine(today).subtract({ years: 1 })) >= 0; const dateAnniversaire = bail.dateAnniversaireProchaine(today).subtract({ years: 1 });` (la dernière date d'anniversaire ≤ today). Passer en locals.
       - Injecter `bienRepo` et `clock` dans le plugin opts si pas déjà.

    10. ÉTENDRE `src/main.ts` :
        - Imports `plugin as indexationsPlugin`.
        - Register : `await app.register(indexationsPlugin, { bailRepo, bienRepo });` (après baux plugin).
        - Étendre opts de baux plugin pour inclure `bienRepo` et `clock`.

    11. ÉTENDRE `tests/bdd/step_definitions/indexation-irl.steps.ts` avec steps nécessaires.

    Sécurité (cf. <threat_model>) :
    - Defense en profondeur LOC-05 : check Bien.estGelLoyer() côté UI ET côté use case (T-03-03-01 mitigation).
    - SQL injection : Kysely paramétrisé.
    - XSS : EJS autoescape.
    - Session hijacking : Fastify session (cookie httpOnly + signé) déjà géré Phase 1/2.
    - CSRF : pas de CSRF token Phase 1/2 (mono-user local). Idem ici.
    - Validation Zod stricte : regex trimestre + decimal positif.

    Vérifs : `pnpm test:bdd -- --tags "@loc-04 or @loc-05"` 6 scenarios VERTS. `pnpm test` complet VERT. `pnpm tsc --noEmit` 0. `pnpm lint` 0.

    Commit : `feat(03-03): routes /baux/:id/indexer wizard étapes 2-3 + schema Zod + 3 views + 2 partials + banner sur fiche Bail + BDD LOC-04 simulation + LOC-05 gel (vert)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && pnpm lint:deps && pnpm test && pnpm test:bdd -- --tags "@loc-04 or @loc-05"</automated>
  </verify>
  <done>
    - 3 routes /baux/:id/indexer (GET saisie/gel + POST simuler + POST confirmer stub).
    - Schema Zod indexationSaisieSchema (accepte 2 formats trimestre).
    - 3 views (saisie, simulation, gel-loyer) + 2 partials (banner, wizard-layout IRL).
    - Extension fiche Bail : banner conditionnel + lookup bailIndexable côté route.
    - main.ts wiring (plugin + extension opts baux).
    - 6 scenarios BDD @loc-04 + @loc-05 verts.
    - Tous tests existants toujours verts (non-régression Phase 1/2/3-01/3-02 + Money.multiplyByFraction préservé).
    - Commit créé.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigateur user → Fastify GET/POST /baux/:id/indexer/* | Inputs `irl_trimestre`, `irl_valeur` — validés Zod (regex stricts) + InvariantViolated dans IRL.creer |
| Fastify → use case simulerIndexationIRL | Defense en profondeur LOC-05 — check Bien.estGelLoyer() côté serveur (rejette même si UI contournée) |
| Fastify → SQLite (read-only en 03-03) | Aucune écriture en 03-03 (simulation pure) — read only |
| Fastify → session (indexationDraft) | Cookie httpOnly + signé (Fastify session Phase 1/2) — pas d'injection |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03-03-01 | Tampering | User force POST /baux/:id/indexer/simuler avec Bien classeDpe=F (bypass UI bloc gel) → si serveur ne re-vérifie pas, calcul effectué et flow continue | HIGH | mitigate | Use case simulerIndexationIRL fait `if (bien.estGelLoyer()) throw new GelLoyerClimatActif(...);` AVANT tout calcul. Route catch l'exception → 403 + render gel-loyer.ejs. Tests T23 + T37. |
| T-03-03-02 | Tampering | IRL valeur négative ou zéro forcée via POST → division par zéro dans Money.multiplyByRatio | MED | mitigate | IRL.creer regex `^\d+(\.\d+)?$` + `parseFloat > 0` (Phase 1). Money.multiplyByRatio throw InvariantViolated si den <= 0. Tests T5. |
| T-03-03-03 | Tampering | IRL trimestre format invalide '2026-T5' (mois inexistant) | LOW | mitigate | Zod regex `[1-4]` strict + IRL.creer regex `^\d{4}-T[1-4]$` strict (Phase 1). |
| T-03-03-04 | Information disclosure | User accède /baux/X/indexer pour bail X qui n'est pas le sien | LOW | accept | Mono-user V1. |
| T-03-03-05 | Repudiation | Simulation effectuée n'est pas tracée (pas d'audit) | LOW | accept | Phase 3-03 est lecture seule. L'apply (03-04) trace via BailIndexation append-only. |
| T-03-03-06 | Integrity | Drift float dans calcul IRL (parseFloat * 100 + Math.round) → écart 1 centime sur très grands montants | LOW | mitigate | Précision préservée via BigInt sur centièmes (`BigInt(Math.round(v * 100))`) + banker's rounding sur centimes du résultat. Pour loyers réalistes (< 10000€), aucun drift. Tests fast-check T8 vérifient écart ≤ 1c. |
| T-03-03-07 | DoS | User saisit IRL gigantesque (1e15) → calcul Money explose | LOW | mitigate | Money.fromCentimes throw InvariantViolated si > MAX_SAFE_INTEGER (Phase 1 toSqliteInteger). |
| T-03-03-08 | Tampering | Session `indexationDraft` modifiée côté client → POST confirmer reprend des valeurs falsifiées | MED | mitigate | Session Fastify cookie SIGNÉ (Phase 1 D-18). Le user ne peut pas modifier le contenu. Si tentative → signature invalide → 403. |
</threat_model>

<verification>
- `pnpm tsc --noEmit` exit 0
- `pnpm lint` 0 warning
- `pnpm lint:deps` 0 violation (Bail import ClasseDpe : si cycle détecté, déplacer ClasseDpe en `_shared/`)
- `pnpm test:unit` VERT (Money.multiplyByRatio, Bail.dateAnniversaireProchaine, Bail.simulerIndexation, use cases, helper)
- `pnpm test:bdd -- --tags "@loc-04 or @loc-05"` 6 scenarios PASSED
- Money.multiplyByFraction non régression (test existant Phase 2 + nouveau test explicite)
- Pas de régression Phase 1/2/3-01/3-02 : `pnpm test` complet VERT
- 03-04 peut consommer Bail.dateAnniversaireProchaine + Bail.simulerIndexation + listerBailsIndexables sans recreate
</verification>

<success_criteria>
- LOC-04 (partie simulation) satisfait : banner anniversaire + wizard saisie + simulation calcul correct banker.
- LOC-05 satisfait : gel DPE F/G bloque hard à l'UI (gel-loyer.ejs) ET au serveur (GelLoyerClimatActif throw).
- D-90 satisfait : banner sur fiche Bail à l'anniversaire.
- D-91 étapes 1-3 satisfaites (étapes 4-5 en 03-04).
- D-92 satisfait : blocage dur sans bypass possible.
- DP-16 résolu : banker's rounding via nouvelle Money.multiplyByRatio (préserve invariant existant multiplyByFraction).
- DP-17 routes : `/baux/:id/indexer`, `/baux/:id/indexer/simuler`, `/baux/:id/indexer/confirmer` créées.
- DP-18 helper formaterTrimestreIRL ajouté (5e helper sur 6).
- DP-20 résolu : `Bail.dateAnniversaireProchaine` méthode sur l'agrégat (pas service externe).
- Trimestre format divergence UI-SPEC vs domaine résolue : Zod transform accepte les 2 formats, normalise vers canonique YYYY-TN avant IRL.creer.
- Domain pur (vérifié dependency-cruiser).
</success_criteria>

<output>
After completion, create `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-03-SUMMARY.md` listant :
- 3 commits (tests rouges / domain+use cases+helper / web+BDD)
- Patterns établis : nouvelle méthode Money sans casser l'existante (additive change), méthodes pures sur agrégat consommées par use case lookup-orchestration, defense en profondeur cross-aggregate (Bien.estGelLoyer vérifié 2× UI+serveur), wizard layout EJS dédié métier, Zod transform format français vers canonique domain
- Dépendances pour plans suivants : 03-04 consomme `Bail.simulerIndexation`, `Bail.appliquerIndexation` (à créer 03-04), `listerBailsIndexables` (étend filtre 12 mois), `GelLoyerClimatActif`, vues étape 4-5 manquantes
- Notes éventuelles sur cycle d'import ClasseDpe locatif → patrimoine (potentiel déplacement vers _shared)
</output>

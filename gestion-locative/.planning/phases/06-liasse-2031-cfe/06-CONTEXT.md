# Phase 6: Liasse 2031 & CFE - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning
**Langue:** Français (project response_language)

<domain>
## Phase Boundary

Phase 6 consomme les snapshots fiscaux **immuables** produits par Phase 5
(`DeclarationAnnuelle`, `DeclarationCorrigee`, `AmortissementExercice`,
`Composant`, `VerdictLmp`) et délivre **deux capacités déclaratives** :

1. **Brouillon de la liasse 2031-SD + annexes 2033 (FIS-05)** — document
   *mapping case-par-case* (numéro de case cerfa + libellé officiel + valeur
   calculée) que le bailleur reporte sur sa télédéclaration impots.gouv.fr.
   Couvre le **régime réel** (liasse 2031-SD + annexes 2033-A/B/C/D) ET le
   **micro-BIC** (brouillon minimaliste 2042 C PRO). Exporté en vue HTML + PDF + CSV.
   Liasse **rectificative** dérivée de `DeclarationCorrigee` (même format).

2. **Suivi de la déclaration CFE (FIS-06)** — agrégat léger `DeclarationCfe`
   rattaché à un `Bien` : statut de la 1447-C-SD, exonérations, montant d'avis,
   échéance de paiement décembre + **alerte J-30** (banner). L'app NE reproduit
   PAS le formulaire 1447-C-SD (formulaire ponctuel complexe).

**REQs couverts (2)** : FIS-05 (liasse 2031-SD + annexes), FIS-06 (CFE 1447-C-SD + alerte).

**Bounded contexts touchés** :
- **`Fiscalité` (extension)** — nouveaux artefacts : brouillon liasse (read-model
  produit à la génération, pas d'agrégat persistant), `MappingLiasseProvider`
  (port versionné par année), nouvel agrégat racine `DeclarationCfe`.
- Aucune modification des snapshots Phase 5 (lecture seule). Aucune modification
  des BC Encaissements / Documents / Patrimoine (lecture seule pour la traçabilité).

### Strictement hors périmètre Phase 6 (ne pas attraper en scope creep)

- **Annexe 2033-E** (détermination valeur ajoutée / CVAE) → V1.1 si recettes > 152 500 € (rare LMNP).
- **Annexes 2033-F (capital social) et 2033-G (filiales)** → jamais (non applicables personne physique).
- **Reproduction du formulaire 1447-C-SD** (saisie assistée case-par-case du CFE) → hors scope (formulaire ponctuel).
- **Calcul de la base d'imposition CFE** → relève de la commune, jamais calculé par l'app.
- **Déclaration modificative CFE 1447-M-SD** → V1.1.
- **Télédéclaration / transmission EDI-TDFC** → V2 (EDI-01). Phase 6 produit un *brouillon*, jamais une transmission.
- **Calcul d'IR + prélèvements sociaux** sur le résultat → Phase 7 ou V1.1 (SIM-01).
- **Dashboard consolidé des échéances** (CFE, IRL, diagnostics) → Phase 7 (DAS). Phase 6 ne pose que le banner CFE contextuel.
- **Plus-value de cession** (réintégration amortissements LF 2025) → V1.1 (SIM-02).

</domain>

<decisions>
## Implementation Decisions

### Décisions verrouillées en amont (Phases 1-5 — non rediscutées)

- **DV-01 → DV-07** (PROJECT.md) : LMNP meublé longue durée, local-first SQLite,
  DDD hexagonal strict (domaine pur), ubiquitous language français, BDD outside-in
  100 % couverture fiscale, MVP vertical slices, 6 bounded contexts.
- **D-01 → D-27** (Phase 1) : stack TS strict / Node 22 / Fastify / EJS /
  better-sqlite3 + Kysely / Vitest / Cucumber / fast-check / **Money bigint centimes** /
  **Temporal API** / Zod / **pdfmake** / Pico.css / dependency-cruiser / pnpm.
- **D-LOCK-4** (Phase 5) : CFE explicitement reportée Phase 6.
- **D-FIS-G2.2** (Phase 5) : taxonomie 4 catégories de charges **déjà alignée 2033-A/B**
  (`qualification-fiscale.ts` documente le mapping ligne-à-ligne).
- **D-FIS-G1.1, G1.7** (Phase 5) : 6 composants BOFIP + read-model
  `AmortissementExercice` (lignes COMPOSANT + SYNTHESE_BIEN avec ARD cumulé) → alimentent 2033-C/D.
- **D-FIS-G4.2** (Phase 5) : snapshot par valeur, **append-only strict**, immuable.
- **D-FIS-G4.4** (Phase 5) : `DeclarationCorrigee` modélisée Phase 5 → **liasse rectificative générée Phase 6**.
- **D-FIS-G5.3** (Phase 5) : export CSV + PDF récap bailleur déjà livré
  (`RecapFiscalBuilder` port + `exporter-csv-fiscal.ts` + `exporter-pdf-recap.ts` +
  route `exports.ts`) — **pattern réutilisable, à ne pas dupliquer**.

### G1 — Format du brouillon liasse (FIS-05)

- **D-L6.1 — Mapping case-par-case (fidélité juridique + lisibilité).** Chaque case
  du cerfa est affichée : `{numéro de case officiel} + {libellé officiel} + {valeur calculée}`.
  Objectif explicite de l'utilisateur : *le plus fidèle juridiquement ET parlant pour le
  bailleur*. Document **distinct** du récap PDF Phase 5 (qui reste un aide-mémoire par
  sections) — orienté « prêt à reporter sur la télédéclaration ».
- **D-L6.2 — Couvre réel ET micro-BIC.** Régime réel → liasse 2031-SD + annexes
  2033-A/B/C/D. Micro-BIC → brouillon minimaliste 2042 C PRO (report des recettes brutes,
  ~1-2 cases). Le régime appliqué est lu depuis `DeclarationAnnuelle.regimeApplique`.
- **D-L6.3 — Mapping versionné par année.** Fichier `mapping-liasse-2026.ts` (pattern exact
  de `regles-2026.ts`) exporte la correspondance `{ caseId, libelléOfficiel, section, annexe, source }`.
  Port **`MappingLiasseProvider`** + impl en mémoire `MappingLiasseProviderEnMemoire`
  (miroir exact de `RegleFiscaleProvider` / `RegleFiscaleProviderEnMemoire`). Revu chaque
  janvier post-LF (R1.1 RISKS.md). Fail-fast si année non couverte.
- **D-L6.4 — Trois formats : vue HTML + PDF + CSV.** Vue HTML (`/fiscalite/declarations/:id/liasse`)
  = interface principale consultée *pendant* la saisie sur impots.gouv.fr. PDF = archivage.
  CSV = vérification expert-comptable, **complété avec le mapping case-par-case** (pas le
  simple récap CSV Phase 5). Réutilise `RecapFiscalBuilder`-style port + `PdfRenderer` +
  `contentDispositionFilename()` + pattern route `exports.ts`.
- **D-L6.5 — Liasse rectificative = même format, données corrigées.** Dérivée de
  `DeclarationCorrigee`. Bandeau visible « Liasse rectificative — motif : {motif} ». Pas de
  format différentiel (avant/après) en V1.

### G2 — Périmètre des annexes 2033 (FIS-05)

- **D-A6.1 — Annexes 2033-A, B, C, D uniquement.** Les 4 pertinentes pour un LMNP
  personne physique au réel. **2033-E** (CVAE, > 152 500 €) → reportée V1.1. **2033-F**
  (capital social) + **2033-G** (filiales) → exclues (sans objet personne physique).
- **D-A6.2 — 2033-A (bilan simplifié) = postes calculés uniquement.** Remplir seulement
  les cases que l'app sait calculer : immobilisations brutes (composants), amortissements
  cumulés, valeur nette comptable. Postes non modélisés (trésorerie, créances, dettes,
  emprunts) marqués « à compléter manuellement » avec aide contextuelle. Honnête + audit-friendly.
- **D-A6.3 — 2033-B (compte de résultat) = cœur du brouillon.** Recettes
  (`DeclarationAnnuelle.recettesTotales`), charges par qualification
  (`chargesQualifieesParCategorie`, déjà aligné via `qualification-fiscale.ts`), dotation
  d'amortissement (`dotationAmortissement`), résultat fiscal.
- **D-A6.4 — 2033-C (immobilisations) + 2033-D (ARD).** 2033-C ← `Composant` +
  `AmortissementExercice` (lignes COMPOSANT). 2033-D ← solde ARD de l'exercice dans la case
  + **tableau historique compact** (année | généré | consommé | cumul) lu depuis
  `AmortissementExercice` (lignes SYNTHESE_BIEN, ARD cumulé déjà matérialisé).

### G3 — Modèle CFE & alerte (FIS-06)

- **D-CFE6.1 — Suivi déclaratif, pas de reproduction du 1447-C-SD.** Agrégat *léger* qui
  trace l'état de l'obligation CFE, pas un assistant de remplissage du formulaire ponctuel.
- **D-CFE6.2 — Nouvel agrégat racine `DeclarationCfe` dans BC `Fiscalité`.** Vit dans
  `domain/fiscalite/`. Référence `BienId` **par identifiant** (même pattern que
  `TicketTravaux → BienId`), pas un sous-agrégat de `Bien` (cycle de vie indépendant,
  queryable séparément pour l'alerte). Brand type `DeclarationCfeId` + `nouveauDeclarationCfeId()`.
- **D-CFE6.3 — Données capturées.** `statut`, `dateDepotDeclaration` (1447-C-SD),
  `montantAvisCentimes: Money | null` (avis reçu de la commune), `dateEcheancePaiement`
  (décembre), `exercice`/`millesime`. Statuts : `non_deposee | deposee |
  exoneree_premiere_annee | exoneree_commune | payee`.
- **D-CFE6.4 — Exonérations = statut + aide pédagogique.** Aide contextuelle à la création :
  « Votre première année d'activité est exonérée de CFE ; l'année suivante vous recevrez un
  avis en octobre/novembre. » **Aucun calcul de base imposable** (relève de la commune — R4.3 pédagogie sans fausse précision).
- **D-CFE6.5 — Alerte = banner J-30 sur fiche Bien + page /fiscalite.** Même pattern que le
  banner IRL Phase 3 (D-90) : calcul à la demande via `Clock`, pas de cron. Satisfait le
  success-criteria FIS-06. **Phase 7** consolidera dans le dashboard global d'échéances (DAS-02).

### G4 — Traçabilité liasse → sources

- **D-T6.1 — Liens cliquables HTML + annotations PDF + colonne CSV.** Vue HTML : chaque case
  calculée est cliquable → détail des sources. PDF : note de bas de page avec le décompte.
  CSV : colonne `sources` avec les IDs. Audit-friendly (l'expert-comptable vérifie tout).
- **D-T6.2 — Granularité par case cerfa.** Ex : recettes → liste des `Encaissement`s ;
  charges déductibles → `Justificatif`s qualifiés ; dotation → lignes `AmortissementExercice`.
- **D-T6.3 — Read-model construit à la génération (use case cross-BC).** Un use case agrège
  les sources vivantes (Encaissements de l'exercice via `RecettesRepository`, Justificatifs
  qualifiés via `ChargesRepository`, `AmortissementExercice` via `TableauAmortissementRepository`).
  Cohérent avec la signature existante `RecapFiscalBuilder.construire(decl, bailleur, biens, tableauxAmort)`.
- **D-T6.4 — Snapshot fait foi + réconciliation visible (CRITIQUE audit).** La **valeur** de
  chaque case vient **toujours** du snapshot immuable (`DeclarationAnnuelle` /
  `DeclarationCorrigee`), jamais recalculée. Les sources vivantes servent **uniquement** au
  drill-down. Si `Σ sources vivantes ≠ valeur snapshot` → bandeau de réconciliation :
  « Données modifiées depuis la clôture du {date} — le brouillon reflète la clôture.
  {N} pièces ont changé depuis. » Respecte les anti-patterns Phase 5 #3 (pas de recalcul UI)
  et #4 (snapshot immuable).

### Claude's Discretion (à trancher par researcher / planner / executor)

- **Numéros de cases exacts** des cerfa 2031-SD / 2033-A/B/C/D / 2042 C PRO (millésime 2026)
  — **à vérifier par le researcher** sur les formulaires officiels / BOFIP avant de figer `mapping-liasse-2026.ts`.
- Découpage des migrations SQLite (recommandation : `0022_phase6_declaration_cfe.sql` —
  Phase 5 s'arrête à `0021`).
- Routes Fastify exactes (recommandation : `GET /fiscalite/declarations/:id/liasse`,
  `.../liasse.pdf`, `.../liasse.csv`, `GET/POST /biens/:id/cfe`).
- Helpers EJS (`formaterCaseLiasse`, `formaterStatutCfe`, `formaterMillesimeCfe`).
- Mise en page pdfmake du brouillon liasse (réutilise `pdf-renderer-pdfmake.ts`).
- Forme exacte du read-model de traçabilité (DTO par case).

### Folded Todos

*(aucun — `todo.match-phase 6` → todo_count = 0)*

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents (researcher, planner, ui-researcher, executor) MUST read these.**

### Domaine produit / projet
- `.planning/PROJECT.md` — contraintes (hexagonal, Money bigint, Temporal, audit-friendly, ubiquitous language fr), 6 BC.
- `.planning/REQUIREMENTS.md` — FIS-05, FIS-06 (V1) ; V1.1 SIM-01/02, EDI-01.
- `.planning/ROADMAP.md` §Phase 6 — goal + 4 success criteria (brouillon liasse exportable, traçabilité, CFE 1447-C-SD, alerte décembre) ; dépend de Phase 5.
- `VISION.md` — autonomie, sobriété, local-first, single-user, audit-friendly.
- `LOGICIEL_GESTION_LOCATIVE.md` — PRD (liasse 2031, CFE, KPIs).
- `CLAUDE.md` — règles non négociables (V1 LMNP, domaine pur, doc commitée avec le code).

### Domaine fiscal LMNP
- `LMNP.md` — base de connaissances fiscale (liasse 2031, régime réel, amortissements, CFE).
- `LOCATION_MEUBLEE_REGLES.md` — règles juridiques meublé.

### Sources juridiques cadre (à citer dans les tests BDD)
- **Formulaire cerfa 2031-SD** — déclaration de résultats BIC (régime réel).
- **Annexes 2033-A à D** — bilan simplifié (A), compte de résultat (B), immobilisations & amortissements (C), provisions & déficits / ARD (D).
- **Formulaire 2042 C PRO** — report micro-BIC (recettes brutes).
- **Formulaire 1447-C-SD** — déclaration initiale CFE.
- **CGI art. 1447 & s.** — Cotisation Foncière des Entreprises (champ, exonération première année).
- **CGI art. 39 / 39 B** — amortissements, ARD reportable (alimente 2033-C/D).
- **BOFIP-BIC-DECLA** — obligations déclaratives régime réel / micro.

### Artefacts Phases 1-5 à respecter
- `.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-CONTEXT.md` —
  D-FIS-G* (snapshot immuable, 6 composants, ARD read-model, `DeclarationCorrigee`,
  exports CSV/PDF, anti-patterns #3/#4). **Source la plus importante pour Phase 6.**
- `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md` —
  D-90 pattern banner d'échéance (réutilisé pour le banner CFE).
- `.planning/phases/04-coffre-documentaire-travaux/04-CONTEXT.md` —
  `TicketTravaux → BienId` par identifiant (pattern de référence pour `DeclarationCfe → BienId`).
- `.planning/phases/01-activation-bien-locataire-bail/01-LEARNINGS.md` —
  factory `creer()` + `InvariantViolated`, brand types, builders, repository versDomaine/versRow.

### Pratiques opposables
- `practices/DDD.md` — BC Fiscalité, agrégat racine `DeclarationCfe`, port `MappingLiasseProvider`, ubiquitous language fr.
- `practices/BDD_PRACTICES.md` — outside-in, **100 % couverture sur la logique fiscale** (mapping liasse = logique fiscale), scénario dédié par règle.
- `practices/SOFTWARE_CRAFTSMANSHIP.md` — gates CI (0 warning, ≥80 %, 100 % métier, cyclo < 10, suite < 30 s).
- `practices/UI_DESIGN.md`, `UX_DESIGN.md`, `ACCESSIBILITY.md` — WCAG 2.1 AA, data tables (liasse), banner d'échéance, helpers fr.
- `RISKS.md` — R1.1 (surveillance fiscale annuelle → `mapping-liasse-2026.ts` versionné), R4.3 (pédagogie CFE).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (NE PAS RÉ-IMPLÉMENTER)
- `src/domain/fiscalite/declaration-annuelle.ts` — snapshot immuable source des valeurs de
  cases (recettesTotales, chargesQualifieesParCategorie, dotationAmortissement, ardGenere/Consomme,
  regimeApplique, composantsSnapshot, statutLmnpLmp, clotureLe).
- `src/domain/fiscalite/declaration-corrigee.ts` — source de la liasse rectificative (motif + valeurs corrigées).
- `src/domain/fiscalite/amortissement-exercice.ts` — read-model lignes COMPOSANT (→ 2033-C) + SYNTHESE_BIEN (ARD cumulé → 2033-D).
- `src/domain/fiscalite/qualification-fiscale.ts` — enum 4 catégories **déjà aligné 2033-A/B** (mapping documenté dans le fichier) + `QUALIFICATIONS_DEDUCTIBLES`.
- `src/domain/fiscalite/regles/regle-fiscale-provider.ts` (+ `regles-2026.ts`) — **pattern exact à cloner** pour `MappingLiasseProvider` / `mapping-liasse-2026.ts` (port + impl en mémoire, fail-fast par année).
- `src/domain/fiscalite/recap-fiscal-builder.ts` — port pdfmake (`construire(decl, bailleur, biens, tableauxAmort): unknown`) ; modèle pour un `BrouillonLiasseBuilder`.
- `src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts` + `pdf-renderer-pdfmake.ts` — adapter pdfmake + renderer buffer.
- `src/application/fiscalite/exporter-csv-fiscal.ts` + `exporter-pdf-recap.ts` — use cases export (modèles pour les use cases liasse).
- `src/web/routes/fiscalite/exports.ts` — pattern route export + helper `contentDispositionFilename()` (RFC 6266) + mitigation CSV injection.
- Repositories sources : `recettes-repository.ts` (`sommeRecettesAnnuelles`), `charges-repository.ts`, `tableau-amortissement-repository.ts` — pour la traçabilité (sources vivantes).
- `src/domain/_shared/identifiants.ts` — **étendre** avec `DeclarationCfeId` + `nouveauDeclarationCfeId()` (pattern brand type + crypto.randomUUID).
- `src/domain/_shared/{money,clock,erreurs}.ts` — Money centimes, Clock (banner CFE J-30), InvariantViolated.

### Established Patterns (à respecter)
- **Hexagonal strict** : nouveaux fichiers `domain/fiscalite/declaration-cfe.ts`,
  `domain/fiscalite/liasse/mapping-liasse-2026.ts`, port builder — **zéro import technique**
  (dependency-cruiser). Le brouillon liasse retourne `unknown` pour la def pdfmake (miroir RecapFiscalBuilder).
- **Factory `X.creer()` + `InvariantViolated`** + brand type pour `DeclarationCfe`.
- **Append-only / lecture seule** : Phase 6 ne mute jamais les snapshots Phase 5.
- **Repository versDomaine/versRow + transaction()** pour `DeclarationCfeRepository` (SQLite).
- **Builders** `tests/_builders/fiscalite.ts` — étendre avec `declarationCfeBuilder`, fixtures de mapping liasse.
- **BDD outside-in 100 % fiscale** — `.feature` par règle (voir <specifics>).
- **EJS layout-debut/fin + partials + helpers fr** ; **Zod aux frontières HTTP** uniquement.

### Integration Points
- **Phase 5 → 6** : lecture `DeclarationAnnuelleRepository` / `DeclarationCorrigeeRepository` /
  `TableauAmortissementRepository` ; agrégation traçabilité via Recettes/Charges repositories.
- **Phase 1/4 → 6** : `DeclarationCfe` référence `BienId` ; banner CFE sur la fiche `Bien`.
- **Phase 6 → 7** : `DeclarationCfe` expose l'échéance décembre → consommée par le dashboard
  d'échéances Phase 7 (DAS-02). Le banner Phase 6 est contextuel ; Phase 7 consolide.
- **Migration** : `0022_phase6_declaration_cfe.sql` (table `declarations_cfe`). Le brouillon
  liasse ne crée pas de table (read-model à la génération).
- **Sidebar / fiche Bien** : entrée « Liasse fiscale » sous Fiscalité ; section « CFE » sur la fiche Bien.
</code_context>

<specifics>
## Specific Ideas

- **Mapping case-par-case explicitement préféré** (D-L6.1) à un aide-mémoire libre — l'utilisateur
  veut reconnaître à l'écran ce qu'il voit sur impots.gouv.fr (fidélité juridique + lisibilité).
- **`MappingLiasseProvider` calqué sur `RegleFiscaleProvider`** (D-L6.3) — versioning triennal/annuel
  cohérent, fail-fast par année, zéro modif des use cases au changement de millésime.
- **Snapshot fait foi + réconciliation** (D-T6.4) — le point d'attention audit le plus important :
  ne JAMAIS recalculer une valeur de case depuis les sources vivantes ; afficher un écart, jamais le masquer.
- **`DeclarationCfe` agrégat racine BC Fiscalité** (D-CFE6.2) — pas un sous-agrégat de Bien (DDD : la CFE est fiscale).
- **Cucumber `.feature` minimaux par règle** (BDD 100 % fiscale) :
  - `brouillon-liasse-reel.feature` (mapping 2031-SD + 2033-A/B/C/D depuis un snapshot réel).
  - `brouillon-liasse-micro.feature` (2042 C PRO depuis un snapshot micro).
  - `liasse-rectificative.feature` (depuis `DeclarationCorrigee` + bandeau motif).
  - `liasse-tracabilite.feature` (case → sources + réconciliation snapshot ≠ vivant).
  - `mapping-liasse-versionne.feature` (fail-fast année non couverte).
  - `cfe-suivi-declaratif.feature` (statuts + exonération première année).
  - `cfe-alerte-echeance.feature` (banner J-30 décembre, déterministe via Clock).
- **Helpers UI** : tableau case-par-case (numéro | libellé | valeur | sources), tooltip cerfa, badge statut CFE.

</specifics>

<deferred>
## Deferred Ideas

### V1.1
- **Annexe 2033-E (CVAE)** — si recettes > 152 500 € (rare LMNP).
- **Déclaration modificative CFE 1447-M-SD.**
- **SIM-01 / SIM-02** — simulateur micro vs réel, plus-value de cession (réintégration amortissements LF 2025).
- **Liasse différentielle (avant/après)** pour les rectificatives — V1 reste sur « même format + bandeau motif » (D-L6.5).
- **Calcul d'IR + prélèvements sociaux** sur le résultat fiscal.

### V2
- **EDI-01** — export/transmission EDI-TDFC (Phase 6 ne produit qu'un brouillon).
- **Assistant de remplissage 1447-C-SD** case-par-case (calcul de base imposable, etc.).
- **Override utilisateur du mapping** (admin UI pour ajuster les numéros de cases sans PR).

### Phase 7
- **Dashboard consolidé des échéances** (CFE + IRL + diagnostics + fin de bail) + notifications J-30/J-7 (DAS-02).
  Phase 6 ne pose que le banner CFE contextuel sur la fiche Bien.

### Reviewed Todos (not folded)
Aucun todo listé pour Phase 6 (`todo_count = 0`).

</deferred>

---

*Phase: 6-liasse-2031-cfe*
*Context gathered: 2026-05-28*
*Décisions capturées: 19 (G1 Liasse: 5, G2 Annexes: 4, G3 CFE: 5, G4 Traçabilité: 4) + rappels verrouillés Phases 1-5*

---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
plan: 10
type: execute
wave: 1
depends_on: []
files_modified:
  - src/application/fiscalite/cloturer-exercice.ts
  - src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts
  - src/infrastructure/pdf/recap-fiscal-doc-def.ts
  - tests/unit/fiscalite/cloturer-exercice.test.ts
  - tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts
  - tests/bdd/features/fiscalite-ard-multi-exercice.feature
autonomous: true
gap_closure: true
requirements:
  - FIS-04
tags:
  - fiscalite
  - ard
  - multi-bien
  - mono-bailleur
  - bigint-sum

must_haves:
  truths:
    - "Un appel a cloturerExercice avec N >= 1 biens actifs produit exactement UNE ligne SYNTHESE_BIEN inseree pour l'exercice (CR-03 ferme)"
    - "dernierArdCumuleBailleur(bailleurId, exercice) retourne l'ARD cumule du dernier exercice cloture sans multiplication par le nombre de biens"
    - "Aucun float n'intervient dans le SUM ard_cumule_disponible_centimes — fn.sum<string> + BigInt(string) (CR-01 derive ferme)"
    - "Le scenario BDD multi-bien atteste que l'ARD est correctement reporte a l'exercice N+1 (pas N x ARD)"
    - "Le PDF recap (table d'amortissement) affiche une ligne agregee bailleur — pas un bienId brut par ligne — conforme a la semantique V1 mono-bailleur D-LOCK-2"
  artifacts:
    - path: "src/application/fiscalite/cloturer-exercice.ts"
      provides: "Use case cloture qui insere UNE SYNTHESE_BIEN par exercice (porteur biensIds[0])"
      forbids: "for (const bienId of biensIds)"
    - path: "src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts"
      provides: "dernierArdCumuleBailleur sans float intermediaire"
      contains: "fn.sum<string>"
      forbids: "fn.sum<number>"
    - path: "src/infrastructure/pdf/recap-fiscal-doc-def.ts"
      provides: "Libelle table amortissement = 'Bailleur — exercice {N}' pour la ligne SYNTHESE_BIEN"
      contains: "Bailleur"
    - path: "tests/unit/fiscalite/cloturer-exercice.test.ts"
      provides: "Test multi-bien : 2 biens actifs → 1 seule SYNTHESE_BIEN"
      contains: "SYNTHESE_BIEN"
    - path: "tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts"
      provides: "Test multi-bien : dernierArdCumuleBailleur retourne la bonne valeur (pas N x ARD)"
    - path: "tests/bdd/features/fiscalite-ard-multi-exercice.feature"
      provides: "Scenario multi-bien : ARD propage exercice N → N+1 sans doublon"
  key_links:
    - from: "cloturerExercice.amortissementExercicesLignes (SYNTHESE_BIEN)"
      to: "AmortissementExercice unique par exercice"
      via: "if (biensIds.length > 0) push(... bienId: biensIds[0]! ...)"
      pattern: "biensIds\\[0\\]!"
    - from: "TableauAmortissementRepositorySqlite.dernierArdCumuleBailleur"
      to: "BigInt(row.total_centimes ?? '0')"
      via: "fn.sum<string>('ae.ard_cumule_disponible_centimes')"
      pattern: "fn\\.sum<string>"
    - from: "recap-fiscal-doc-def.amortBody"
      to: "Libelle bailleur agrege"
      via: "l => 'Bailleur — exercice ' + decl.exercice"
      pattern: "Bailleur"
---

<objective>
Gap closure CR-03 du verifier 2026-05-21 (BLOCKER) et CR-01 derive sur `dernierArdCumuleBailleur` (WARNING dans 05-VERIFICATION.md L172) : en V1 mono-bailleur (D-LOCK-2), l'ARD est un attribut **bailleur-level**, pas **bien-level**. La boucle `for (const bienId of biensIds)` de `cloturer-exercice.ts` L225-238 cree actuellement N lignes `SYNTHESE_BIEN` chacune portant l'`ardCumuleEnSortie` GLOBAL ; le SUM dans `dernierArdCumuleBailleur` multiplie alors l'ARD par le nombre de biens a l'exercice suivant. Le commentaire L223 ("Simplification V1 : resultat correct") est faux.

Fix V1 : une seule ligne `SYNTHESE_BIEN` par exercice, portee par `biensIds[0]!` comme bien porteur sentinelle. Le PDF recap utilise un libelle "Bailleur — exercice {N}" a la place de `l.bienId`. Le SUM dans `dernierArdCumuleBailleur` migre aussi vers `fn.sum<string>` + `BigInt(string)` (meme pattern CR-01) puisqu'on est dans le meme fichier.

Purpose : SC-3 (amortissement par composant + ARD propagation) et FIS-04 ne peuvent etre declares VERIFIED tant que l'ARD est double/N-tuple entre deux exercices d'un bailleur multi-biens.

Output :
- `cloturerExercice` insere UNE SYNTHESE_BIEN par exercice.
- `dernierArdCumuleBailleur` lit la chaine SUM SQLite en BigInt direct, sans float.
- Le PDF recap affiche un libelle bailleur agrege en V1.
- Nouveau test unitaire `cloturer-exercice` : 2 biens → 1 SYNTHESE_BIEN.
- Nouveau test integration `tableau-amortissement-repository` : 2 biens → ARD propage sans doublon.
- Nouveau scenario BDD multi-bien dans `fiscalite-ard-multi-exercice.feature` (BDD outside-in, BDD_PRACTICES.md "chaque exception du droit a son scenario dedie").
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md
@.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-CONTEXT.md
@.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-PATTERNS.md
@CLAUDE.md
@practices/BDD_PRACTICES.md

<interfaces>
Signatures publiques inchangees par ce plan :

- `TableauAmortissementRepository.enregistrerBatch(lignes, trxArg?)`
- `TableauAmortissementRepository.listerParBienExercice(bienId, exercice)`
- `TableauAmortissementRepository.dernierArdCumule(bienId, exerciceMax)`
- `TableauAmortissementRepository.dernierArdCumuleBailleur(bailleurId, exerciceMax)`
- `cloturerExercice(commande, repos, clock, regleFiscale, db)`
- `construireRecapFiscal(decl, bailleur, biens, tableauxAmort)` (deplace en port Plan 11 mais signature stable)

Migration 0019_phase5_amortissement_exercice.sql : contrainte UNIQUE (bien_id, composant_id, exercice). En passant a UNE SYNTHESE_BIEN par exercice avec composant_id = null et bien_id = biensIds[0], la contrainte UNIQUE reste satisfaite (un seul (bienId, null, exercice) au lieu de N).

Invariant `AmortissementExercice.creer` (factory) : composantId doit rester null pour typeLigne === 'SYNTHESE_BIEN'. Inchange.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 : Scenario BDD multi-bien + test unitaire cloturerExercice — RED</name>
  <files>tests/bdd/features/fiscalite-ard-multi-exercice.feature, tests/unit/fiscalite/cloturer-exercice.test.ts</files>

  <read_first>
    <file>tests/bdd/features/fiscalite-ard-multi-exercice.feature</file>
    <file>tests/unit/fiscalite/cloturer-exercice.test.ts</file>
    <file>src/application/fiscalite/cloturer-exercice.ts</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-CONTEXT.md</file>
    <file>practices/BDD_PRACTICES.md</file>
  </read_first>

  <behavior>
    Test unitaire `cloturer-exercice.test.ts` :
    - Etant donne un bailleur mono avec 2 biens actifs, chacun avec 1 composant amortissable (gros_oeuvre 200 000 €/40 ans, dateAcquisition 2026-01-01)
    - Quand `cloturerExercice({bailleurId, exercice: 2026, regimeChoisi: 'reel'}, repos, ...)` est invoque
    - Alors les lignes passees a `tableauAmortRepo.enregistrerBatch` contiennent **exactement UNE** ligne `typeLigne === 'SYNTHESE_BIEN'` (pas 2)
    - Et la ligne SYNTHESE_BIEN porte `ardCumuleDisponible = tableau.ardCumuleEnSortie` (ARD global du bailleur)
    - Et le `bienId` de cette SYNTHESE_BIEN est l'un des deux biensIds (porteur sentinelle, sans signification metier en V1)

    Scenario BDD multi-bien dans `fiscalite-ard-multi-exercice.feature` :
    - Etant donne un bailleur avec 2 biens A et B (composants gros_oeuvre 100 000 € / 40 ans chacun, dateAcquisition 2025-01-01)
    - Et l'exercice 2025 cloture en regime reel avec recettes 5 000 € (ARD genere non nul puisque resultat < dotation)
    - Quand le bailleur cloture l'exercice 2026 (regime reel, recettes 5 000 €)
    - Alors `dernierArdCumuleBailleur(bailleurId, 2025)` retourne l'ardCumuleEnSortie de 2025 (PAS 2 x ardCumuleEnSortie)
    - Et la declaration 2026 recoit cet ARD en entree (utilise par `calculerAmortissement` pour la propagation cross-exercice CGI 39 B)
  </behavior>

  <action>
    Etendre `tests/unit/fiscalite/cloturer-exercice.test.ts` avec un nouveau `it('CR-03 — multi-bien : un bailleur avec 2 biens actifs produit exactement UNE ligne SYNTHESE_BIEN par exercice', async () => {...})`. Strategie : utiliser le pattern de stubs deja en place dans ce fichier (Pick<...> sur les ports). Stub `composantRepo.listerActifsPourBailleur` retourne 2 composants sur 2 biens distincts ; stub `tableauAmortRepo.enregistrerBatch` capture l'argument `lignes` dans une variable locale (par exemple `let capturedLignes: AmortissementExercice[] = [];` puis `enregistrerBatch: async (lignes) => { capturedLignes = lignes; }`). Apres l'appel, filtrer les SYNTHESE_BIEN et asserter expect(syntheseLignes.length).toBe(1). Asserter aussi expect(syntheseLignes[0].typeLigne).toBe('SYNTHESE_BIEN') et expect(syntheseLignes[0].composantId).toBeNull().

    Etendre `tests/bdd/features/fiscalite-ard-multi-exercice.feature` avec un nouveau scenario `Scenario: CR-03 — Multi-bien — l'ARD est reporte a l'exercice N+1 sans doublon` au format francais Gherkin. Etapes principales :
    - "Etant donne l'application est prete pour la fiscalite LMNP avec clock fixe 2026-12-31"
    - "Et un Bailleur avec 2 biens A et B en regime reel, chacun avec un composant gros_oeuvre 100 000 €/40 ans date 2025-01-01"
    - "Et l'exercice 2025 est cloture avec recettes annuelles 5 000 € en regime reel"
    - "Quand le bailleur cloture l'exercice 2026 avec recettes annuelles 5 000 €"
    - "Alors la declaration 2026 recoit l'ARD cumule entrant exactement egal a l'ardCumuleEnSortie de 2025"
    - "Et la table amortissement_exercice contient exactement 1 ligne SYNTHESE_BIEN pour l'exercice 2025"
    - "Et la table amortissement_exercice contient exactement 1 ligne SYNTHESE_BIEN pour l'exercice 2026"

    Note : si certains steps n'existent pas dans `tests/bdd/step_definitions/fiscalite.steps.ts`, ne PAS les implementer dans ce plan (Task 1) — ils seront implementes au moment de l'execution. Le test BDD peut donc etre RED initialement par pending steps ; c'est coherent avec BDD outside-in.

    Tagguer la feature `@fis-04 @phase5 @gap-CR-03` pour tracabilite. Texte en francais strict (ubiquitous language CLAUDE.md, BDD_PRACTICES.md L1).
  </action>

  <verify>
    <automated>pnpm test tests/unit/fiscalite/cloturer-exercice.test.ts -- --run 2>&1 | tee /tmp/05-10-task1.log ; grep -E "CR-03" /tmp/05-10-task1.log</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "CR-03" tests/unit/fiscalite/cloturer-exercice.test.ts` retourne >= 1
    - `grep -c "SYNTHESE_BIEN" tests/unit/fiscalite/cloturer-exercice.test.ts` retourne >= 2
    - `grep -c "toBe(1)" tests/unit/fiscalite/cloturer-exercice.test.ts` retourne >= 1
    - `grep -c "CR-03\|Multi-bien" tests/bdd/features/fiscalite-ard-multi-exercice.feature` retourne >= 1
    - `pnpm typecheck` exit code 0
  </acceptance_criteria>

  <done>
    Le test unitaire `cloturer-exercice.test.ts` contient un scenario "CR-03 — multi-bien : 1 ligne SYNTHESE_BIEN" qui s'execute (probablement RED) ; la feature BDD `fiscalite-ard-multi-exercice.feature` contient un nouveau scenario multi-bien explicite ; typecheck propre.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 : Test integration multi-bien sur dernierArdCumuleBailleur — RED</name>
  <files>tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts</files>

  <read_first>
    <file>tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts</file>
    <file>src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts</file>
    <file>migrations/0019_phase5_amortissement_exercice.sql</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md</file>
  </read_first>

  <behavior>
    - Etant donne une base in-memory avec 2 biens A et B inseres
    - Et UNE ligne `SYNTHESE_BIEN` inseree pour l'exercice 2025 portee par bien A : `ard_cumule_disponible_centimes = 50000` (500 €)
    - Quand `repo.dernierArdCumuleBailleur(bailleurId, 2025)` est invoque
    - Alors le Money retourne satisfait .toCentimes() === 50_000n exactement (pas 100_000n)
    - Cas miroir : si on insere par erreur 2 lignes SYNTHESE_BIEN (pour reproduire l'ancien bug), le SUM retournerait 100_000n ; on n'insere QU'UNE LIGNE → l'assertion 50_000n prouve que `dernierArdCumuleBailleur` ne sur-additionne pas
    - Cas BigInt direct : inserer ard_cumule_disponible_centimes = 1n centime sur N=100 lignes SYNTHESE_BIEN du meme exercice (biens distincts pre-inseres), verifier que le SUM remonte un BigInt exact (verrouillage CR-01 derive)
  </behavior>

  <action>
    Etendre `tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts` avec un nouveau `describe('dernierArdCumuleBailleur — multi-bien (CR-03) + precision BigInt (CR-01 derive)', () => {...})` ou un nouvel `it` dans un describe existant.

    Test 1 : `it('CR-03 — une seule SYNTHESE_BIEN par exercice → dernierArdCumuleBailleur retourne ardCumuleEnSortie tel quel, pas multiplie par le nombre de biens', async () => {...})`. Setup : 2 biens A, B inseres dans `bien`. Insertion via repo (ou via le builder existant `AmortissementExercice.creer` + `enregistrerBatch`) d'UNE ligne SYNTHESE_BIEN pour exercice 2025, bien porteur = A, ardCumuleDisponible = Money.fromCentimes(50_000n). Appel `await repo.dernierArdCumuleBailleur(bailleurId, 2025)`. Assertion expect(result.toCentimes()).toBe(50_000n).

    Test 2 : `it('CR-01 derive — SUM sans float : 100 lignes SYNTHESE_BIEN de 1 centime sur biens distincts agrégent a 100n exact', async () => {...})`. Pre-inserer 100 biens en base. Inserer 100 lignes SYNTHESE_BIEN sur le MEME exercice (par exemple 2025), un par bien, chaque ardCumuleDisponible = Money.fromCentimes(1n). Appel `await repo.dernierArdCumuleBailleur(bailleurId, 2025)`. Assertion expect(result.toCentimes()).toBe(100n).

    Ne PAS dupliquer le setup `beforeEach` ; reutiliser le pattern deja en place (Database :memory: + appliquerToutesMigrations + insertion bailleur + biens).

    Note : la requete actuelle `dernierArdCumuleBailleur` filtre `exercice = exerciceMax` (egalite exacte). Le Test 2 est donc volontairement artificiel (apres fix Task 3, l'usage normal ne genere qu'UNE SYNTHESE_BIEN par exercice). Le test verrouille la **mecanique du SUM** en BigInt pur, independamment de la semantique metier — pour empecher un retour en arriere vers `fn.sum<number>` lors d'un refactor futur.
  </action>

  <verify>
    <automated>pnpm test tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts -- --run 2>&1 | tee /tmp/05-10-task2.log ; grep -E "CR-03|CR-01 derive|precision BigInt" /tmp/05-10-task2.log</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "CR-03" tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts` retourne >= 1
    - `grep -c "CR-01 derive\|precision BigInt" tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts` retourne >= 1
    - `grep -c "toBe(50_000n)" tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts` retourne >= 1
    - `grep -c "toBe(100n)" tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts` retourne >= 1
    - `pnpm typecheck` exit code 0
  </acceptance_criteria>

  <done>
    Le test d'integration contient 2 nouveaux scenarios prouvant que `dernierArdCumuleBailleur` (a) ne sur-additionne pas en cas mono-ligne et (b) parse les SUM en BigInt direct (pas via float). Compile sans erreur, peut etre RED en partie tant que Task 3 n'est pas fait.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 : Fix cloturer-exercice (1 SYNTHESE_BIEN) + dernierArdCumuleBailleur (BigInt) + PDF libelle — GREEN</name>
  <files>src/application/fiscalite/cloturer-exercice.ts, src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts, src/infrastructure/pdf/recap-fiscal-doc-def.ts</files>

  <read_first>
    <file>src/application/fiscalite/cloturer-exercice.ts</file>
    <file>src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts</file>
    <file>src/infrastructure/pdf/recap-fiscal-doc-def.ts</file>
    <file>src/domain/fiscalite/amortissement-exercice.ts</file>
    <file>migrations/0019_phase5_amortissement_exercice.sql</file>
    <file>tests/unit/fiscalite/cloturer-exercice.test.ts</file>
    <file>tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-CONTEXT.md</file>
  </read_first>

  <behavior>
    1. `cloturer-exercice.ts` n'utilise plus `for (const bienId of biensIds)` pour creer des SYNTHESE_BIEN — la boucle est remplacee par une garde `if (biensIds.length > 0) { ... push(...) }` qui pushe UNE ligne SYNTHESE_BIEN portee par `biensIds[0]!` (bien sentinelle), avec les memes champs ARD globaux du bailleur.
    2. Le commentaire L221-224 reflete la verite corrigee : ARD = attribut bailleur-level en V1 D-LOCK-2, pas bien-level. La "simplification" etait une erreur ; la nouvelle invariant est "1 SYNTHESE_BIEN par exercice par bailleur".
    3. `tableau-amortissement-repository-sqlite.ts` `dernierArdCumuleBailleur` n'utilise plus `fn.sum<number>` ni `Number(row.total_centimes)` — passage a `fn.sum<string>` + `BigInt(row.total_centimes ?? '0')`. Le clamp redondant `if (total === 0)` est supprime puisque `BigInt('0') === 0n` et `Money.fromCentimes(0n)` reste un Money.zero() conforme.
    4. `recap-fiscal-doc-def.ts` L99-103 : la table d'amortissement affiche pour chaque SYNTHESE_BIEN un libelle "Bailleur — exercice ${decl.exercice}" a la place du `l.bienId` brut (porteur sentinelle sans signification metier en V1). Les colonnes "Dotation theorique" et "ARD cumule dispo" restent inchangees.
    5. Tous les tests existants (Phase 5, 888 tests) restent verts.
    6. Les tests RED de Task 1 et Task 2 basculent en GREEN.
  </behavior>

  <action>
    Dans `src/application/fiscalite/cloturer-exercice.ts` :
    - Reecrire le bloc L221-239. Remplacer les 4 lignes de commentaire L221-224 ("Simplification V1") par 5 lignes commentaires qui expliquent la nouvelle invariant : SYNTHESE_BIEN bailleur-level (D-LOCK-2 mono-bailleur, CR-03 fix). En V1, l'ARD est un attribut du bailleur (pas du bien individuel). On cree UNE seule ligne SYNTHESE_BIEN par exercice, portee par biensIds[0] comme bien sentinelle. dernierArdCumuleBailleur SUM toutes les SYNTHESE_BIEN d'un exercice → resultat = ardCumuleEnSortie exact. Reference : 05-VERIFICATION.md CR-03 (BLOCKER) — la boucle for precedente creait N lignes → SUM x N.
    - Supprimer la boucle `for (const bienId of biensIds) { amortissementExercicesLignes.push(AmortissementExercice.creer({...})); }` (L225-238 originales).
    - La remplacer par une garde `if (biensIds.length > 0)` qui pushe UNE ligne via `AmortissementExercice.creer` avec : bienId = biensIds[0]! (non-null assertion justifiee par la garde), composantId = null, exercice, typeLigne = 'SYNTHESE_BIEN', dotationTheorique = Money.zero(), dotationAppliquee = Money.zero(), ardGenere = Money.zero(), ardCumuleDisponible = tableau.ardCumuleEnSortie, ardConsomme = tableau.ardConsomme.
    - Conserver la boucle COMPOSANT au-dessus (L202-219) inchangee.

    Dans `src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` `dernierArdCumuleBailleur` (L134-155) :
    - L142 : remplacer `eb.fn.sum<number>('ae.ard_cumule_disponible_centimes').as('total_centimes')` par `eb.fn.sum<string>('ae.ard_cumule_disponible_centimes').as('total_centimes')`.
    - L148-154 : remplacer le bloc final par : "if (!row || row.total_centimes === null) return Money.zero();" puis "return Money.fromCentimes(BigInt(row.total_centimes ?? '0'));". Supprimer definitivement `Number(row.total_centimes)`, le test `total === 0`, et toute conversion par `number`.
    - Conserver le JSDoc qui mentionne D-LOCK-2 / T-05-06-11 ; ajouter une note "// CR-01 derive (05-VERIFICATION.md L172) : SUM en chaine entiere, jamais en float.".

    Dans `src/infrastructure/pdf/recap-fiscal-doc-def.ts` (L91-103) :
    - L99-103 : remplacer le contenu du map. Au lieu de produire `[l.bienId, { text: l.dotationTheorique.enEuros(), alignment: 'right' as const }, { text: (l.ardCumuleDisponible ?? Money.zero()).enEuros(), alignment: 'right' as const }]`, produire `['Bailleur — exercice ' + decl.exercice, { text: l.dotationTheorique.enEuros(), alignment: 'right' as const }, { text: (l.ardCumuleDisponible ?? Money.zero()).enEuros(), alignment: 'right' as const }]`.
    - L95 (entete de colonne) : laisser le titre 'Bien' tel quel — la semantique de cette colonne en V1 est "ligne bailleur agregee" ; le contenu de la cellule porte l'information explicite. Reviser a la V1.1 multi-bien.

    NE PAS modifier la migration `0019_phase5_amortissement_exercice.sql` — la contrainte `UNIQUE (bien_id, composant_id, exercice)` reste compatible (un seul (biensIds[0], null, exercice) par appel).

    NE PAS modifier les autres routes/repos/use cases (`vue-consolidee-par-bien.ts`, `ard-propagation-multi-exercice.test.ts`, etc.) — verifier en grep qu'ils ne dependent pas de "N lignes SYNTHESE_BIEN par exercice". Si un test existant fait `expect(lignes.filter(...SYNTHESE_BIEN).length).toBe(N)` avec N != 1, le mettre a jour pour refleter la nouvelle invariant.
  </action>

  <verify>
    <automated>pnpm test tests/unit/fiscalite/cloturer-exercice.test.ts tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts -- --run 2>&1 | tee /tmp/05-10-task3.log ; pnpm typecheck 2>&1 | tee /tmp/05-10-task3-tsc.log ; grep -c "for (const bienId of biensIds)" src/application/fiscalite/cloturer-exercice.ts ; grep -c "fn.sum<number>" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts ; grep -c "Number(row.total_centimes)" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "for (const bienId of biensIds)" src/application/fiscalite/cloturer-exercice.ts` retourne 0
    - `grep -c "biensIds\[0\]!" src/application/fiscalite/cloturer-exercice.ts` retourne >= 1
    - `grep -c "fn.sum<number>" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` retourne 0
    - `grep -c "fn.sum<string>" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` retourne >= 1
    - `grep -c "Number(row.total_centimes)" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` retourne 0
    - `grep -c "BigInt(row.total_centimes" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts` retourne >= 1
    - `grep -c "Bailleur — exercice" src/infrastructure/pdf/recap-fiscal-doc-def.ts` retourne >= 1
    - `pnpm test tests/unit/fiscalite/cloturer-exercice.test.ts tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts -- --run` exit code 0
    - `pnpm typecheck` exit code 0
    - `pnpm test -- --run` exit code 0 (suite complete verte)
  </acceptance_criteria>

  <done>
    `cloturer-exercice.ts` n'a plus la boucle `for (const bienId of biensIds)` ; `dernierArdCumuleBailleur` utilise `fn.sum<string>` + `BigInt(string)` ; le PDF affiche un libelle "Bailleur — exercice {N}" ; les tests Task 1 + Task 2 sont GREEN ; toute la suite reste verte ; typecheck 0 erreur.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4 : Implementer (ou completer) les step definitions Cucumber multi-bien — GREEN BDD</name>
  <files>tests/bdd/step_definitions/fiscalite.steps.ts</files>

  <read_first>
    <file>tests/bdd/step_definitions/fiscalite.steps.ts</file>
    <file>tests/bdd/features/fiscalite-ard-multi-exercice.feature</file>
    <file>src/application/fiscalite/cloturer-exercice.ts</file>
    <file>src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts</file>
  </read_first>

  <behavior>
    - Les nouveaux steps Gherkin definis en Task 1 (multi-bien : 2 biens A et B, exercice 2025 cloture, etc.) ont une implementation dans `fiscalite.steps.ts`
    - Le scenario BDD multi-bien passe en GREEN apres execution
    - Les steps existants ne sont pas regresses
  </behavior>

  <action>
    Lire `tests/bdd/step_definitions/fiscalite.steps.ts` en entier et identifier les steps deja implementes (clock fixe, bailleur, biens, composants, cloture, recettes). Pour chaque step Gherkin du nouveau scenario CR-03 (Task 1) qui n'a PAS d'implementation existante, ajouter une nouvelle implementation @Given/@When/@Then. Specifiquement :
    - "un Bailleur avec 2 biens A et B en regime reel, chacun avec un composant gros_oeuvre 100 000 €/40 ans date 2025-01-01" → reutiliser le builder `unComposantGrosOeuvre` (tests/_builders/fiscalite.ts) et inserer 2 biens via repo
    - "l'exercice 2025 est cloture avec recettes annuelles 5 000 € en regime reel" → appeler `cloturerExercice` avec exercice 2025, recettes stubbed
    - "la declaration 2026 recoit l'ARD cumule entrant exactement egal a l'ardCumuleEnSortie de 2025" → comparer `dernierArdCumuleBailleur(bailleurId, 2025)` avec la valeur attendue (somme dotations 2 composants - resultatAvantAmortissement)
    - "la table amortissement_exercice contient exactement 1 ligne SYNTHESE_BIEN pour l'exercice 2025" → SELECT COUNT(*) FROM amortissement_exercice WHERE type_ligne = 'SYNTHESE_BIEN' AND exercice = 2025 → 1
    - "la table amortissement_exercice contient exactement 1 ligne SYNTHESE_BIEN pour l'exercice 2026" → SELECT COUNT(*) ... WHERE exercice = 2026 → 1

    Suivre la convention `enc02.steps.ts` (init in-memory + http session) listee dans 05-PATTERNS.md L117. Repliquer le `world` pattern (this.bailleurId, this.db, etc.) deja en place dans `fiscalite.steps.ts`.

    NE PAS dupliquer un step qui existe deja — si "Etant donne l'application est prete pour la fiscalite LMNP avec clock fixe ..." existe deja, le reutiliser.
  </action>

  <verify>
    <automated>pnpm test tests/bdd -- --run 2>&1 | tee /tmp/05-10-task4-bdd.log ; grep -E "CR-03|Multi-bien" /tmp/05-10-task4-bdd.log</automated>
  </verify>

  <acceptance_criteria>
    - `pnpm test tests/bdd -- --run` exit code 0 OU equivalent commande BDD du projet
    - Le scenario `CR-03 — Multi-bien — l'ARD est reporte a l'exercice N+1 sans doublon` apparait dans le rapport BDD comme PASSED
    - Aucun step `Pending` ou `Undefined` dans le rapport pour ce nouveau scenario
    - Aucun scenario BDD existant ne regresse
  </acceptance_criteria>

  <done>
    Le scenario BDD multi-bien est GREEN. Toutes les autres features BDD restent vertes. La couverture BDD 100% fiscale (BDD_PRACTICES.md L1) couvre maintenant le cas exception multi-bien D-LOCK-2.
  </done>
</task>

</tasks>

<verification>
1. Disparition du bug structural :
   ```
   grep -n "for (const bienId of biensIds)" src/application/fiscalite/cloturer-exercice.ts
   # attendu : 0 resultat
   ```

2. Disparition du pattern float :
   ```
   grep -n "fn.sum<number>" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts
   grep -n "Number(row.total_centimes)" src/infrastructure/repositories/tableau-amortissement-repository-sqlite.ts
   # attendu : 0 resultat pour les deux
   ```

3. Nouveau libelle PDF :
   ```
   grep -n "Bailleur — exercice" src/infrastructure/pdf/recap-fiscal-doc-def.ts
   # attendu : >= 1 resultat
   ```

4. Tests cibles :
   ```
   pnpm test tests/unit/fiscalite/cloturer-exercice.test.ts \
             tests/integration/repositories/tableau-amortissement-repository-sqlite.test.ts -- --run
   # attendu : exit 0, scenarios CR-03 verts
   ```

5. BDD multi-bien :
   ```
   pnpm test tests/bdd -- --run | grep -A2 "Multi-bien"
   # attendu : scenario passed
   ```

6. Suite complete + typecheck :
   ```
   pnpm test -- --run
   pnpm typecheck
   # attendu : exit 0 pour les deux
   ```

7. Re-verification du gap CR-03 dans 05-VERIFICATION.md :
   - Le gap "L'amortissement par composant n'est pas double-compte..." doit pouvoir basculer de `failed` a `verified` quand le verifier sera relance.
</verification>

<success_criteria>
- CR-03 du verifier (05-VERIFICATION.md, gap 2) ferme : une seule ligne SYNTHESE_BIEN par exercice, ARD propage exact en multi-biens.
- CR-01 derive sur `dernierArdCumuleBailleur` (WARNING) ferme : `fn.sum<string>` + `BigInt(string)`, plus de float.
- FIS-04 et SC-3 realignes : amortissement par composant + ARD reportable CGI 39 B correctement propage cross-exercice en multi-biens V1.
- D-LOCK-2 (mono-bailleur V1) refletee dans la semantique du PDF recap (libelle "Bailleur — exercice {N}").
- Nouveau test unitaire `cloturer-exercice` (CR-03 multi-bien) + nouveau test integration `tableau-amortissement-repository` (CR-03 + CR-01 derive) + nouveau scenario BDD multi-bien dans `fiscalite-ard-multi-exercice.feature` — tous verts.
- Suite complete verte (`pnpm test -- --run` exit 0). Typecheck propre (`pnpm typecheck` exit 0).
- Aucune signature publique modifiee.
</success_criteria>

<output>
Apres completion, creer `.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-10-gap-ard-multi-bien-synthese-SUMMARY.md` listant :
1. Diff du bloc SYNTHESE_BIEN dans cloturer-exercice.ts (boucle → garde + 1 push).
2. Diff de `dernierArdCumuleBailleur` (passage BigInt).
3. Diff du libelle dans recap-fiscal-doc-def.ts.
4. Liste des nouveaux tests (unit + integration + BDD) avec leur nom complet.
5. Resultat de pnpm test + typecheck.
6. Statut attendu du verifier sur les gaps 2 et derive CR-01.
</output>

---
phase: 05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement
plan: 09
type: execute
wave: 1
depends_on: []
files_modified:
  - src/infrastructure/repositories/recettes-repository-sqlite.ts
  - src/infrastructure/repositories/charges-repository-sqlite.ts
  - tests/integration/repositories/recettes-repository-sqlite.test.ts
  - tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts
  - tests/integration/repositories/charges-repository-sqlite.test.ts
  - tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts
autonomous: true
gap_closure: true
requirements:
  - FIS-03
tags:
  - fiscalite
  - precision
  - sqlite-sum
  - bigint

must_haves:
  truths:
    - "Aucun float ne transite entre le SUM SQLite et Money.fromCentimes() dans les deux repos cibles (CR-01 fermé)"
    - "100 encaissements de 1 centime agrègent à exactement 100 centimes (1.00 €) sans perte d'arrondi flottant"
    - "Les 4 méthodes SUM (recettes annuelles, recettes par bien, charges par catégorie, charges par bien) restituent un Money strictement égal à la somme entière des centimes en base"
    - "Le filtre `total <= 0` reste fonctionnel pour clamp les compensateurs négatifs à Money.zero()"
  artifacts:
    - path: "src/infrastructure/repositories/recettes-repository-sqlite.ts"
      provides: "Adapter SUM recettes annuelles en chaîne entière (sans float)"
      contains: "fn.sum<string>"
      forbids: "Math.round"
    - path: "src/infrastructure/repositories/charges-repository-sqlite.ts"
      provides: "Adapter SUM charges qualifiées en chaîne entière (sans float)"
      contains: "fn.sum<string>"
      forbids: "Math.round"
    - path: "tests/integration/repositories/recettes-repository-sqlite.test.ts"
      provides: "Régression précision : 100 × 0.01 € == 1.00 € exact"
      contains: "100"
    - path: "tests/integration/repositories/charges-repository-sqlite.test.ts"
      provides: "Régression précision : 100 × 0.01 € == 1.00 € exact"
      contains: "100"
  key_links:
    - from: "RecettesRepositorySqlite.sommeRecettesAnnuelles"
      to: "Money.fromCentimes(BigInt(result?.total ?? '0'))"
      via: "fn.sum<string>('e.montant_centimes')"
      pattern: "BigInt\\(result\\?\\.total \\?\\? '0'\\)"
    - from: "RecettesRepositorySqlite.sommeRecettesAnnuellesParBien"
      to: "Money.fromCentimes(BigInt(result?.total ?? '0'))"
      via: "fn.sum<string>('e.montant_centimes')"
      pattern: "BigInt\\(result\\?\\.total \\?\\? '0'\\)"
    - from: "ChargesRepositorySqlite.sommeChargesParCategorie"
      to: "Money.fromCentimes(BigInt(row.total ?? '0'))"
      via: "fn.sum<string>('montant_ttc_centimes')"
      pattern: "BigInt\\(row\\.total \\?\\? '0'\\)"
    - from: "ChargesRepositorySqlite.sommeChargesParBien"
      to: "Money.fromCentimes(BigInt(result?.total ?? '0'))"
      via: "fn.sum<string>('montant_ttc_centimes')"
      pattern: "BigInt\\(result\\?\\.total \\?\\? '0'\\)"
---

<objective>
Gap closure CR-01 du verifier 2026-05-21 : remplacer le pattern `BigInt(Math.round(fn.sum<number>(...)))` par `BigInt(result?.total ?? '0')` après `fn.sum<string>(...)` dans les deux repos d'agrégation fiscale (recettes et charges). La lecture SQLite traverse alors une chaîne entière au lieu d'un `number` flottant 64 bits, ce qui rétablit la règle non négociable du projet "jamais de float pour les montants fiscaux" (CLAUDE.md §Règles non négociables, anti-pattern #1 de 05-CONTEXT.md).

Purpose : SC-1 (agrégation recettes/charges) et FIS-03 ne peuvent être déclarés VERIFIED tant qu'un Math.round sur un SUM<number> peut faire perdre 1 centime au franchissement de la limite de précision IEEE 754 (>= 2^53 centimes ≈ 90 071 992 milliards d'euros, ou plus bas si la somme intermédiaire l'atteint).

Output : 4 méthodes corrigées (2 dans recettes-repo, 2 dans charges-repo), 4 fichiers de test mis à jour avec un scénario de régression "100 encaissements de 1 centime = 100 centimes" qui prouve l'absence de perte d'arrondi.
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
@practices/SOFTWARE_CRAFTSMANSHIP.md

<interfaces>
Signatures publiques inchangées par ce plan (refactor interne uniquement) :

```typescript
// src/domain/fiscalite/recettes-repository.ts (non modifié)
export interface RecettesRepository {
  sommeRecettesAnnuelles(bailleurId: BailleurId, annee: number): Promise<Money>;
  sommeRecettesAnnuellesParBien(bienId: BienId, annee: number): Promise<Money>;
}

// src/domain/fiscalite/charges-repository.ts (non modifié)
export interface ChargesRepository {
  sommeChargesParCategorie(bailleurId: BailleurId, annee: number): Promise<ChargesParCategorie>;
  sommeChargesParBien(bienId: BienId, annee: number): Promise<Money>;
}
```

Money.fromCentimes accepte un `bigint` ; `BigInt('123')` parse une chaîne décimale entière (et lève si la chaîne contient un point ou une notation exponentielle — ce qui ne se produit pas avec SUM SQLite typé string). Le retour de Kysely pour `fn.sum<string>('col').as('total')` est `{ total: string | null }` (mêmes contraintes que SQLite : INTEGER SUM reste exact tant qu'aucune branche de Kysely ne le convertit).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 : Régression test 100×0.01€ sur recettes-repository-sqlite — RED</name>
  <files>tests/integration/repositories/recettes-repository-sqlite.test.ts, tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts</files>

  <read_first>
    <file>tests/integration/repositories/recettes-repository-sqlite.test.ts</file>
    <file>tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts</file>
    <file>src/infrastructure/repositories/recettes-repository-sqlite.ts</file>
    <file>src/domain/_shared/money.ts</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md</file>
    <file>CLAUDE.md</file>
  </read_first>

  <behavior>
    - Étant donné 100 encaissements (ou échéances pour la variante par bien) actifs portant chacun montant_centimes = 1 (0.01 €) sur l'année 2026
    - Quand sommeRecettesAnnuelles(bailleurId, 2026) (resp. sommeRecettesAnnuellesParBien) est invoqué
    - Alors le Money retourné satisfait `result.toCentimes() === 100n` (strictement, sans Math.round masquant un float)
    - Et un nombre minimal d'insertions (>= 100 lignes) est suffisant — pas besoin de monter à 2^53 ; il s'agit d'une régression sur le pattern (fn.sum<number> + Math.round), pas sur l'overflow JS
  </behavior>

  <action>
    Étendre `tests/integration/repositories/recettes-repository-sqlite.test.ts` avec un nouveau `it('100 encaissements de 1 centime = 100 centimes exact, sans perte d\'arrondi flottant (CR-01)', async () => {...})` dans le `describe('RecettesRepositorySqlite.sommeRecettesAnnuelles', ...)` existant (déclaré L32). Le test : insère 100 lignes `encaissement` actives liées au bailleur via la chaîne `bail → echeance_loyer → encaissement` réutilisée par les tests existants L122, montantCentimes = 1n, date = '2026-06-15' ; appelle `await repo.sommeRecettesAnnuelles(bailleurId, 2026)` ; assert `expect(somme.toCentimes()).toBe(100n)`.

    Étendre `tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts` avec un test miroir ciblant `sommeRecettesAnnuellesParBien(bienId, 2026)`, même structure (100 encaissements rattachés à un bien unique via la chaîne bail.bien_id, montant 1 centime), assertion `expect(somme.toCentimes()).toBe(100n)`.

    Ces deux tests DOIVENT échouer initialement (RED) si exécutés sans toucher au code source — c'est attendu, ils prouvent que le pattern `BigInt(Math.round(...))` est vulnérable. (Sur un agrégat de 100 × 1n, Math.round renvoie le bon entier ; le test verrouille la sémantique pour empêcher un retour en arrière futur ET sert d'oracle pour le fix Task 2.) Note exécutionnaire : si le test passe en RED malgré l'absence de fix, c'est que la précision n'a pas été perdue sur ce volume — relancer après Task 2 confirme néanmoins qu'aucune branche ne convertit plus en number.

    Naming des `it()` : commencer par "régression CR-01 :" pour traçabilité avec 05-VERIFICATION.md.
  </action>

  <verify>
    <automated>pnpm test tests/integration/repositories/recettes-repository-sqlite -- --run 2>&1 | tee /tmp/05-09-task1.log ; grep -E "régression CR-01" /tmp/05-09-task1.log</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "régression CR-01" tests/integration/repositories/recettes-repository-sqlite.test.ts` retourne >= 1
    - `grep -c "régression CR-01" tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts` retourne >= 1
    - `grep -c "toBe(100n)" tests/integration/repositories/recettes-repository-sqlite.test.ts` retourne >= 1
    - `grep -c "toBe(100n)" tests/integration/repositories/recettes-repository-sqlite-par-bien.test.ts` retourne >= 1
    - Le test compile (`pnpm typecheck` exit code 0)
    - L'exécution du fichier de test ne lève AUCUNE erreur de setup (les éventuels échecs d'assertion sur les nouveaux scénarios sont acceptés en RED — ils basculeront en GREEN après Task 2)
  </acceptance_criteria>

  <done>
    Les 2 fichiers de tests d'intégration recettes contiennent un scénario "régression CR-01 : 100 encaissements de 1 centime = 100 centimes" qui s'exécute (peut échouer en RED — comportement attendu) et compile sans erreur typecheck.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 : Régression test 100×0.01€ sur charges-repository-sqlite — RED</name>
  <files>tests/integration/repositories/charges-repository-sqlite.test.ts, tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts</files>

  <read_first>
    <file>tests/integration/repositories/charges-repository-sqlite.test.ts</file>
    <file>tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts</file>
    <file>src/infrastructure/repositories/charges-repository-sqlite.ts</file>
    <file>src/domain/fiscalite/qualification-fiscale.ts</file>
    <file>src/domain/_shared/money.ts</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md</file>
  </read_first>

  <behavior>
    - Étant donné 100 justificatifs `qualification_fiscale = 'entretien_reparation'`, actifs, `montant_ttc_centimes = 1`, sur l'année 2026 (via `date_paiement` ou fallback `date_document`)
    - Quand sommeChargesParCategorie(bailleurId, 2026) est invoqué
    - Alors `result.entretien_reparation.toCentimes() === 100n` (exact)
    - Et pour la variante par bien : 100 justificatifs catégorie `charge_courante_periodique` rattachés au bienId, sommeChargesParBien(bienId, 2026) retourne un Money avec `toCentimes() === 100n`
  </behavior>

  <action>
    Étendre `tests/integration/repositories/charges-repository-sqlite.test.ts` (`describe('ChargesRepositorySqlite.sommeChargesParCategorie', ...)` L27) avec un nouveau `it('régression CR-01 : 100 justificatifs de 1 centime entretien_reparation = 100 centimes exact', async () => {...})`. Réutiliser le pattern d'insertion existant (justificatifs avec qualification_fiscale + date_paiement). Assertion : `expect(result.entretien_reparation.toCentimes()).toBe(100n)`.

    Étendre `tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts` avec un test miroir ciblant `sommeChargesParBien(bienId, 2026)` avec 100 justificatifs `charge_courante_periodique`, bien_id renseigné, assertion `expect(somme.toCentimes()).toBe(100n)`.

    Comme pour Task 1, ces tests verrouillent la sémantique exacte du SUM en BigInt : ils ne tolèrent aucun arrondi.
  </action>

  <verify>
    <automated>pnpm test tests/integration/repositories/charges-repository-sqlite -- --run 2>&1 | tee /tmp/05-09-task2.log ; grep -E "régression CR-01" /tmp/05-09-task2.log</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "régression CR-01" tests/integration/repositories/charges-repository-sqlite.test.ts` retourne >= 1
    - `grep -c "régression CR-01" tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts` retourne >= 1
    - `grep -c "toBe(100n)" tests/integration/repositories/charges-repository-sqlite.test.ts` retourne >= 1
    - `grep -c "toBe(100n)" tests/integration/repositories/charges-repository-sqlite-par-bien.test.ts` retourne >= 1
    - `pnpm typecheck` exit code 0
  </acceptance_criteria>

  <done>
    Les 2 fichiers de tests d'intégration charges contiennent un scénario "régression CR-01 : 100 justificatifs de 1 centime" sur leurs deux méthodes SUM, compilent sans erreur typecheck.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 : Fix précision SUM dans recettes-repository et charges-repository — GREEN</name>
  <files>src/infrastructure/repositories/recettes-repository-sqlite.ts, src/infrastructure/repositories/charges-repository-sqlite.ts</files>

  <read_first>
    <file>src/infrastructure/repositories/recettes-repository-sqlite.ts</file>
    <file>src/infrastructure/repositories/charges-repository-sqlite.ts</file>
    <file>src/domain/_shared/money.ts</file>
    <file>tests/integration/repositories/recettes-repository-sqlite.test.ts</file>
    <file>tests/integration/repositories/charges-repository-sqlite.test.ts</file>
    <file>CLAUDE.md</file>
    <file>.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-VERIFICATION.md</file>
  </read_first>

  <behavior>
    - Aucun appel à `fn.sum<number>(...)` ne subsiste dans les deux repos
    - Aucun appel à `Math.round(...)` ne subsiste dans les deux repos
    - `fn.sum<string>('e.montant_centimes')` et `fn.sum<string>('montant_ttc_centimes')` remplacent les variantes `<number>`
    - La conversion finale est `Money.fromCentimes(BigInt(<chaine> ?? '0'))`, où `<chaine>` est `result?.total` (executeTakeFirst) ou `row.total` (rows[].total dans la boucle de regroupement)
    - Le clamp `total <= 0 → Money.zero()` doit être adapté pour comparer une CHAÎNE (BigInt n'a pas l'opérateur `<=` avec un number direct ; comparer après conversion ou comparer la chaîne `=== '0'` puis le BigInt négatif)
    - Les 4 régressions Task 1+2 passent en GREEN
    - Les tests existants (888 actuels) restent verts
  </behavior>

  <action>
    Dans `src/infrastructure/repositories/recettes-repository-sqlite.ts` :
    - Méthode `sommeRecettesAnnuelles` (L27-48) : remplacer L32 `eb.fn.sum<number>('e.montant_centimes').as('total')` par `eb.fn.sum<string>('e.montant_centimes').as('total')`. Remplacer le bloc final (L41-47) par : parser `const totalStr = result?.total ?? '0';` puis `const totalBig = BigInt(totalStr);`. Conserver le clamp compensateurs : `if (totalBig <= 0n) return Money.zero();`. Retourner `Money.fromCentimes(totalBig)`. Supprimer définitivement `Math.round`, `Math.max`, et tout transit par `number`.
    - Méthode `sommeRecettesAnnuellesParBien` (L59-81) : appliquer exactement le même refactor à L64 et au bloc final L73-80.

    Dans `src/infrastructure/repositories/charges-repository-sqlite.ts` :
    - Méthode `sommeChargesParCategorie` (L33-71) : remplacer L37 `eb.fn.sum<number>('montant_ttc_centimes').as('total')` par `eb.fn.sum<string>('montant_ttc_centimes').as('total')`. Dans la boucle `for (const row of rows)` (L60-67), remplacer `const total = row.total ?? 0;` + `if (total > 0) { result[qualification] = Money.fromCentimes(BigInt(Math.round(total))); }` par : `const totalStr = row.total ?? '0'; const totalBig = BigInt(totalStr); if (totalBig > 0n) { result[qualification] = Money.fromCentimes(totalBig); }`.
    - Méthode `sommeChargesParBien` (L82-112) : remplacer L91 `eb.fn.sum<number>('montant_ttc_centimes').as('total')` par la variante `<string>`. Remplacer le bloc final L107-111 par : `const totalStr = result?.total ?? '0'; const totalBig = BigInt(totalStr); if (totalBig <= 0n) return Money.zero(); return Money.fromCentimes(totalBig);`. Supprimer `Math.round` et toute conversion par `number`.

    NE PAS modifier les signatures publiques, NE PAS modifier les imports (`Money`, `BailleurId`, `BienId` restent les seuls types nécessaires ; `Kysely`, `DB`, `RecettesRepository`, `ChargesRepository`, `QualificationFiscale`, `QUALIFICATIONS_VALIDES` aussi). NE PAS toucher aux JSDoc explicatives D-LOCK-2 / D-FIS-G2.11 (ajouter une note "Précision BigInt CR-01" en complément).

    Justification du choix `BigInt(string)` vs `BigInt(number)` : SQLite stocke `montant_centimes` en INTEGER (capacité 64 bits signés) ; le SUM préserve la précision INTEGER au niveau SQL. Le seul point de perte est le `JSON.parse` implicite côté Kysely quand le binding TS demande `<number>`. En demandant `<string>`, Kysely retourne la valeur sans la convertir en `number` flottant — `BigInt('1234')` est exact pour toute valeur entière.
  </action>

  <verify>
    <automated>pnpm test tests/integration/repositories/recettes-repository-sqlite tests/integration/repositories/charges-repository-sqlite -- --run 2>&1 | tee /tmp/05-09-task3.log ; pnpm typecheck 2>&1 | tee /tmp/05-09-task3-tsc.log ; grep -c "fn.sum<number>" src/infrastructure/repositories/recettes-repository-sqlite.ts src/infrastructure/repositories/charges-repository-sqlite.ts ; grep -c "Math.round" src/infrastructure/repositories/recettes-repository-sqlite.ts src/infrastructure/repositories/charges-repository-sqlite.ts</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "fn.sum<number>" src/infrastructure/repositories/recettes-repository-sqlite.ts` retourne 0
    - `grep -c "fn.sum<number>" src/infrastructure/repositories/charges-repository-sqlite.ts` retourne 0
    - `grep -c "Math.round" src/infrastructure/repositories/recettes-repository-sqlite.ts` retourne 0
    - `grep -c "Math.round" src/infrastructure/repositories/charges-repository-sqlite.ts` retourne 0
    - `grep -c "fn.sum<string>" src/infrastructure/repositories/recettes-repository-sqlite.ts` retourne >= 2
    - `grep -c "fn.sum<string>" src/infrastructure/repositories/charges-repository-sqlite.ts` retourne >= 2
    - `grep -c "BigInt(totalStr)" src/infrastructure/repositories/recettes-repository-sqlite.ts` retourne >= 2 (ou équivalent : recherche d'un parser BigInt(string), pas d'un BigInt(number))
    - `pnpm test tests/integration/repositories/recettes-repository-sqlite tests/integration/repositories/charges-repository-sqlite -- --run` exit code 0 (tous les tests existants + les 4 régressions CR-01 verts)
    - `pnpm typecheck` exit code 0
    - `pnpm test -- --run` exit code 0 (suite complète, 888+ tests verts)
  </acceptance_criteria>

  <done>
    Les 2 repos n'utilisent plus `fn.sum<number>` ni `Math.round` ; les 4 méthodes SUM passent par `fn.sum<string>` + `BigInt(string)` ; les 4 tests régression CR-01 sont GREEN ; toute la suite reste verte ; typecheck 0 erreur.
  </done>
</task>

</tasks>

<verification>
1. Lecture des fichiers source pour confirmer la disparition des deux anti-patterns :
   ```
   grep -n "fn.sum<number>\|Math.round" \
     src/infrastructure/repositories/recettes-repository-sqlite.ts \
     src/infrastructure/repositories/charges-repository-sqlite.ts
   # attendu : aucun résultat
   ```

2. Confirmation des nouveaux patterns :
   ```
   grep -n "fn.sum<string>" \
     src/infrastructure/repositories/recettes-repository-sqlite.ts \
     src/infrastructure/repositories/charges-repository-sqlite.ts
   # attendu : >= 4 résultats (2 par fichier)
   ```

3. Exécution des 4 tests de régression CR-01 :
   ```
   pnpm test tests/integration/repositories/recettes-repository-sqlite \
             tests/integration/repositories/charges-repository-sqlite -- --run
   # attendu : exit 0, 4 nouveaux it() "régression CR-01" verts
   ```

4. Suite complète + typecheck (pas de régression sur les 888 tests existants) :
   ```
   pnpm test -- --run
   pnpm typecheck
   # attendu : exit 0 pour les deux
   ```

5. Re-vérification du gap CR-01 dans 05-VERIFICATION.md :
   - Le gap "Le système agrège les recettes et les charges sans perte de précision arithmétique" doit pouvoir basculer de `failed` à `verified` quand le verifier sera relancé.
</verification>

<success_criteria>
- CR-01 du verifier (05-VERIFICATION.md, gap 1) fermé : aucun float intermédiaire ne transite entre le SUM SQLite et `Money.fromCentimes()` dans les deux repos cibles
- FIS-03 et SC-1 réalignés : agrégation recettes + charges exacte au centime près
- 4 régressions de précision (100 × 0.01 € = 1.00 €) ajoutées en `tests/integration/repositories/{recettes,charges}-repository-sqlite{,-par-bien}.test.ts`
- Suite complète verte (`pnpm test -- --run` exit 0)
- Typecheck propre (`pnpm typecheck` exit 0)
- Aucune signature publique modifiée — appelants (cloturerExercice, vue-consolidee-par-bien) intacts
</success_criteria>

<output>
Après complétion, créer `.planning/phases/05-fiscalit-lmnp-r-gimes-recettes-charges-amortissement/05-09-gap-money-sum-precision-SUMMARY.md` listant : (1) les diffs des 4 méthodes SUM, (2) les 4 nouveaux tests de régression, (3) la commande de vérification finale (`pnpm test -- --run && pnpm typecheck`), (4) le résultat de re-vérification du verifier sur le gap 1.
</output>

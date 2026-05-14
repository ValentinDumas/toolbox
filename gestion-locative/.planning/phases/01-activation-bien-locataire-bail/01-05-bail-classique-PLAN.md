---
phase: 01-activation-bien-locataire-bail
plan: 05
type: execute
wave: 4
depends_on: [01-03, 01-04]
files_modified:
  - src/domain/_shared/money.ts
  - src/domain/_shared/irl.ts
  - src/domain/locatif/cautionnement.ts
  - src/domain/locatif/bail.ts
  - src/domain/locatif/bail-repository.ts
  - src/infrastructure/repositories/bail-repository-sqlite.ts
  - src/application/locatif/creer-bail.ts
  - src/application/locatif/modifier-bail.ts
  - src/application/locatif/supprimer-bail.ts
  - src/application/locatif/lister-baux.ts
  - src/web/routes/baux.ts
  - src/web/schemas/bail-schemas.ts
  - src/web/views/pages/baux/liste.ejs
  - src/web/views/pages/baux/formulaire.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/pages/locataires/detail.ejs
  - src/main.ts
  - tests/_builders/locatif.ts
  - tests/unit/_shared/money.test.ts
  - tests/unit/_shared/irl.test.ts
  - tests/unit/locatif/bail.test.ts
  - tests/unit/locatif/cautionnement.test.ts
  - tests/integration/repositories/bail-repository-sqlite.test.ts
autonomous: true
requirements: [LOC-02]
tags: [locatif, bail, money, irl, cautionnement, ddd, invariants-fiscaux]

must_haves:
  truths:
    - "VO Money (bigint centimes) supporte création, addition, multiplication par scalar, comparaison, sérialisation toJSON."
    - "VO IRL { trimestre: string, valeur: string-decimal } valide trimestre non vide et valeur > 0."
    - "VO Cautionnement { type, garant, montantGaranti?, dateSignature, dureeEngagement } est rattaché au Bail (D-33)."
    - "Entité Bail encode invariants : duree_mois ≥ 12 (D-35), depot_garantie ≤ 2×loyer_hc (D-35), ≥1 lot_id appartenant au même bien_id (D-30), loyer_hc > 0, mode_charges ∈ {forfait, provisions}."
    - "L'utilisateur peut créer un Bail meublé classique en sélectionnant un Bien existant, un Locataire existant, ≥1 Lot du Bien, et saisissant tous les paramètres."
    - "L'utilisateur peut éditer, supprimer (soft-delete) un Bail."
    - "Empty state Baux respecte le prérequis : si 0 Bien OU 0 Locataire, le message UI-SPEC §Empty States §Baux prérequis affiche un CTA vers la création manquante."
    - "Pas de statut (brouillon/actif) Phase 1 — pure saisie (D-38). Pas de PDF (D-36 — Phase 1.5)."
    - "Validation HTTP via Zod, validation invariants via domaine."
    - "Pas d'indexation IRL active, pas de gel DPE, pas de checklist mobilier (D-37 + scope Phase 1)."
  artifacts:
    - path: "src/domain/_shared/money.ts"
      provides: "VO Money bigint centimes (zéro dépendance, aligné DDD.md §4.2)"
      exports: ["Money"]
    - path: "src/domain/_shared/irl.ts"
      provides: "VO IRL (trimestre + valeur)"
      exports: ["IRL"]
    - path: "src/domain/locatif/cautionnement.ts"
      provides: "VO Cautionnement attaché au Bail (D-33)"
      exports: ["Cautionnement", "TypeCautionnement", "Garant"]
    - path: "src/domain/locatif/bail.ts"
      provides: "Entité racine Bail + invariants D-35"
      exports: ["Bail", "ModeCharges"]
    - path: "src/infrastructure/repositories/bail-repository-sqlite.ts"
      provides: "Adapter SQLite + jointure bail_lots"
      exports: ["BailRepositorySqlite"]
  key_links:
    - from: "src/domain/locatif/bail.ts"
      to: "src/domain/_shared/money.ts"
      via: "loyer_hc, montant_charges, depot_garantie typés Money"
      pattern: "Money"
    - from: "src/application/locatif/creer-bail.ts"
      to: "src/domain/patrimoine/bien-repository.ts"
      via: "Vérifie que bien_id existe et lot_ids appartiennent au Bien (cross-aggregate read)"
      pattern: "trouverParId"
    - from: "src/web/routes/baux.ts"
      to: "src/web/schemas/bail-schemas.ts"
      via: "Zod parse body"
      pattern: "bailCreationSchema"
    - from: "src/infrastructure/repositories/bail-repository-sqlite.ts"
      to: "src/infrastructure/db/migrations/0001_init.sql (table bail_lots)"
      via: "INSERT bail_lots dans même transaction que bail"
      pattern: "bail_lots"
  notes:
    - "**Note exec :** plan dense — l'exécuteur peut splitter en 05a (domaine + adapter) / 05b (routes + EJS) si pression contexte."
---

<objective>
Livrer l'agrégat `Bail` meublé classique (LOC-02) — le **point d'orgue de la Phase 1** : c'est le composant qui relie un Bien (avec ses Lots) à un Locataire, avec tous les invariants juridiques V1 (durée ≥ 12 mois, dépôt ≤ 2×loyer, lots ≥1 du même bien).

**Slice MVP utilisateur :** En tant que bailleur, après avoir créé Bien et Locataire, je clique "Baux" dans la sidebar, je vois l'empty state "Aucun bail pour l'instant", je clique "Créer un bail", je remplis le formulaire (sélection Bien → checkboxes des Lots → sélection Locataire → durée 12 mois → loyer HC 800 € → charges 50 € forfait → dépôt 1600 € → IRL "2026-T1" / 145.47 → date début 01/06/2026 → cautionnement type physique avec garant complet) → clic "Enregistrer le bail" → ligne dans la liste avec adresse + locataire + loyer.

Purpose: Boucler le triangle Bien-Locataire-Bail (KPI Activation §5 ROADMAP). Coder les VOs critiques `Money` (bigint centimes) et `IRL` qui seront utilisés par Phases 2-6. Encoder les invariants du bail meublé (LOCATION_MEUBLEE_REGLES.md §3.1, §5).
Output: 3 VOs (`Money`, `IRL`, `Cautionnement`), entité `Bail`, port + adapter SQLite avec jointure `bail_lots`, 4 use cases, schemas Zod, 3 pages EJS, section "Baux associés" sur fiche Locataire, tests verts (unit Money/IRL/Bail/Cautionnement + integration BailRepository).
</objective>

<execution_context>
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/workflows/execute-plan.md
@/Users/valentinshodo/Projects/toolbox/gestion-locative/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md
@.planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md
@.planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md
@.planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md
@.planning/phases/01-activation-bien-locataire-bail/01-03-patrimoine-crud-SUMMARY.md
@.planning/phases/01-activation-bien-locataire-bail/01-04-locataire-crud-SUMMARY.md
@DDD.md
@BDD_PRACTICES.md
@LOCATION_MEUBLEE_REGLES.md

<interfaces>
<!-- Existant après plans 02-04 -->

Existant :
- `Bien.creer/modifier/...` (Plan 02-03) — `Bien.lots: ReadonlyArray<Lot>`
- `Locataire.creer/modifier/...` (Plan 04)
- `BienRepository.trouverParId(bienId): Promise<Bien | null>`
- `LocataireRepository.trouverParId(locataireId): Promise<Locataire | null>`
- Partials EJS form-field, data-table, confirm-dialog
- Helper `formatDate`

À créer dans ce plan :
- `Money` VO bigint centimes (D-16) — utilisé Phases 2-6 (loyers, charges, encaissements, amortissements)
- `IRL` VO { trimestre, valeur } (D-37) — utilisé Phase 3 (révision IRL)
- `Cautionnement` VO + sous-VO `Garant` (D-33)
- `Bail` entité racine
- `BailRepository` port + adapter SQLite (jointure `bail_lots`)
- Use cases CRUD + listerBaux
- Schemas Zod (parsing form-data Money en centimes, Date PlainDate, etc.)
- 3 pages EJS baux
- Section "Baux du locataire" sur `locataires/detail.ejs` (modifier le placeholder du plan 04)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests unit Money + IRL + Cautionnement + Bail + tests intégration BailRepository (rouges)</name>
  <files>
    tests/_builders/locatif.ts,
    tests/unit/_shared/money.test.ts,
    tests/unit/_shared/irl.test.ts,
    tests/unit/locatif/cautionnement.test.ts,
    tests/unit/locatif/bail.test.ts,
    tests/integration/repositories/bail-repository-sqlite.test.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-16 (Money), D-17 (Temporal), D-30, D-33, D-34, D-35, D-37 (IRL VO)
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §2 (invariants Bail), §6 (priorités Phase 1)
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Error States" (messages exacts dépôt > 2×, durée < 12, etc.)
    - LOCATION_MEUBLEE_REGLES.md §3.1 (bail classique 12 mois), §5 (dépôt 2×HC max)
    - BDD_PRACTICES.md §4, §9
    - tests/_builders/locatif.ts (étendre — créé plan 04 avec `unLocataireValide`)
  </read_first>
  <behavior>
    Builder `tests/_builders/locatif.ts` (extension) :
    - `unMontantValide(centimes?: bigint): Money` defaults 80_000n (800 €).
    - `unIrlValide(overrides?): IRL` defaults `{ trimestre: "2026-T1", valeur: "145.47" }`.
    - `uneCautionnementPhysique(overrides?): Cautionnement` defaults type physique avec garant complet.
    - `unBailValide(overrides?: Partial<...>): Bail` — defaults `{ locataire_id: ..., bien_id: ..., lot_ids: [<un seul>], type: 'classique', date_debut: PlainDate("2026-06-01"), duree_mois: 12, loyer_hc: 80_000n cents, mode_charges: 'forfait', montant_charges: 5_000n, depot_garantie: 80_000n, irl_reference: unIrlValide() }`.

    `tests/unit/_shared/money.test.ts` :
    - "Money.fromCentimes(80000n) retourne Money de 800 €" + `.toCentimes()` retourne 80000n
    - "Money.fromEuros(800) retourne 80000 centimes"
    - "Money.zero retourne 0n centimes"
    - "Money.fromCentimes(-1n) throw InvariantViolated (négatif refusé)"
    - "Money.fromCentimes(0n) accepté pour zéro" (zéro est une valeur licite — montant_charges peut être 0)
    - "addition : Money(800) + Money(50) === Money(850)"
    - "soustraction : Money(800) - Money(50) === Money(750)"
    - "soustraction : Money(50) - Money(800) throw InvariantViolated (résultat négatif)" — décision Phase 1 : Money est non-négatif, débit/crédit géré ailleurs
    - "multiplication par scalar 2 : Money(800) * 2 === Money(1600)"
    - "comparaison : Money(800).lte(Money(1600)) === true"
    - "égalité par valeur : Money(800).egale(Money(800)) === true"
    - "toJSON retourne number (centimes) pour sérialisation HTTP" (RESEARCH §8 pitfall 2 — bigint pas sérialisable JSON natif)
    - "formatter : Money(80050).enEuros() retourne '800,50 €'" (format français)

    `tests/unit/_shared/irl.test.ts` :
    - "IRL.creer('2026-T1', '145.47') ne throw pas"
    - "IRL.creer('', '145.47') throw (trimestre vide)"
    - "IRL.creer('2026-T1', '') throw (valeur vide)"
    - "IRL.creer('2026-T1', '0') throw (valeur ≤ 0)"
    - "IRL.creer('2026-T1', 'abc') throw (valeur pas un decimal)"
    - "IRL.creer('2026T1', ...) accepté ou throw selon format choisi" (préciser format : `YYYY-TN` recommandé — ou `YYYYTN`)
    - "égalité par valeur : 2 IRL identiques sont égaux"

    `tests/unit/locatif/cautionnement.test.ts` :
    - "Cautionnement.creer type='physique' avec garant complet" → ne throw pas
    - "Cautionnement.creer type='visale' sans garant (Visale = organisme)" → ne throw pas, garant optionnel
    - "Cautionnement.creer type hors enum" → throw
    - "Cautionnement.creer date_signature dans le futur" → throw (cautionnement signé avant ou à date du bail)
    - "Cautionnement.creer durée_engagement < 1 mois" → throw

    `tests/unit/locatif/bail.test.ts` (le plus important — invariants juridiques V1) :
    - "Bail.creer accepte un bail valide (12 mois, dépôt = loyer)" → ne throw pas
    - "Bail.creer rejette duree_mois = 11" → throw `InvariantViolated("Un bail meublé classique doit durer au moins 12 mois")` (LOCATION_MEUBLEE_REGLES.md §3.1)
    - "Bail.creer rejette duree_mois = 0" → throw
    - "Bail.creer accepte dépôt = 2×loyer_hc (limite inclusive)" → ne throw pas
    - "Bail.creer rejette dépôt = 2×loyer_hc + 1 centime" → throw `InvariantViolated("Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges")` (LOCATION_MEUBLEE_REGLES.md §5)
    - "Bail.creer rejette loyer_hc = 0 (Money zero)" → throw `InvariantViolated("Le loyer hors charges doit être supérieur à 0 €")`
    - "Bail.creer rejette lot_ids vide" → throw `InvariantViolated("Sélectionnez au moins un lot")`
    - "Bail.creer accepte mode_charges 'forfait' OU 'provisions'" → 2 tests
    - "Bail.creer rejette mode_charges 'autre'" → throw
    - "Bail.creer accepte cautionnement null (cautionnement optionnel V1)"
    - "Bail.creer accepte date_debut PlainDate dans le passé OU futur" (pas d'invariant temporel Phase 1)
    - "Bail.modifier({ loyer_hc: Money(1000) }) retourne nouvelle instance"
    - "Bail.modifier({ depot_garantie: 3×loyer_hc }) throw" (re-valide invariants)

    `tests/integration/repositories/bail-repository-sqlite.test.ts` :
    - "enregistrer + trouverParId roundtrip" : créer Bien + Locataire en DB, puis Bail avec 1 lot, enregistrer, trouverParId → entité reconstruite avec mêmes valeurs (loyer, dépôt, lot_ids, cautionnement)
    - "enregistrer un Bail avec 2 lots persiste les 2 rows dans `bail_lots`"
    - "enregistrer met à jour un Bail existant (idempotence)"
    - "listerTous exclut soft-deleted"
    - "supprimer (soft-delete) → trouverParId retourne null + rows `bail_lots` toujours présents" (acceptable Phase 1 — Plan 03 lot soft-delete cascade géré côté Bien)
    - Setup : créer tables via migration, instancier Bien+Locataire+Lot via repos respectifs, ensuite Bail.

    À ce stade : `pnpm test -- locatif` et `pnpm test -- _shared` **rouge**. Attendu.
  </behavior>
  <action>
    Étendre `tests/_builders/locatif.ts` avec les 4 builders : `unMontantValide`, `unIrlValide`, `uneCautionnementPhysique`, `unBailValide`.

    Créer les 5 fichiers de tests listés en behavior, avec les comportements précisés.

    Utiliser builders systématiquement — ne pas dupliquer les setups (BDD_PRACTICES.md §9, §12 anti-patterns).
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/_shared/ tests/unit/locatif/ tests/integration/repositories/bail-repository-sqlite.test.ts 2&gt;&amp;1 | grep -E "FAIL|Tests:" || true</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/_shared/money.test.ts` contient ≥ 12 tests.
    - `tests/unit/_shared/irl.test.ts` contient ≥ 6 tests.
    - `tests/unit/locatif/cautionnement.test.ts` contient ≥ 5 tests.
    - `tests/unit/locatif/bail.test.ts` contient ≥ 12 tests (TOUS les invariants D-35 + cas limite dépôt = 2× exact).
    - `tests/integration/repositories/bail-repository-sqlite.test.ts` contient ≥ 5 tests.
    - `tests/_builders/locatif.ts` exporte `unBailValide`, `unMontantValide`, `unIrlValide`, `uneCautionnementPhysique`.
    - `pnpm test -- --run tests/unit/locatif/bail.test.ts` exit ≠ 0 (rouge — Bail pas écrit).
  </acceptance_criteria>
  <done>Le contrat domaine `Bail` (LOC-02) et les VOs critiques (Money, IRL, Cautionnement) sont entièrement spécifiés en tests. Chaque invariant juridique V1 a son test dédié (BDD_PRACTICES.md §8 — exception du droit = scénario dédié).</done>
</task>

<task type="auto">
  <name>Task 2: VOs Money/IRL/Cautionnement + entité Bail + port + adapter SQLite + use cases</name>
  <files>
    src/domain/_shared/money.ts,
    src/domain/_shared/irl.ts,
    src/domain/locatif/cautionnement.ts,
    src/domain/locatif/bail.ts,
    src/domain/locatif/bail-repository.ts,
    src/infrastructure/repositories/bail-repository-sqlite.ts,
    src/application/locatif/creer-bail.ts,
    src/application/locatif/modifier-bail.ts,
    src/application/locatif/supprimer-bail.ts,
    src/application/locatif/lister-baux.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-16, D-17, D-33, D-34, D-35, DV-04
    - .planning/phases/01-activation-bien-locataire-bail/01-RESEARCH.md §2 (Bail invariants), §4 (schéma SQL `bail` + `bail_lots`), §6 (invariants Phase 1), §8 pitfall 2 (bigint JSON)
    - LOCATION_MEUBLEE_REGLES.md §3.1 (durée 12 mois), §4.3 (forfait/provisions), §5 (dépôt ≤ 2×)
    - DDD.md §4.2 (VO immutable), §4.3 (Agrégat)
    - tests/unit/_shared/money.test.ts, tests/unit/_shared/irl.test.ts, tests/unit/locatif/{cautionnement,bail}.test.ts (les contrats)
    - tests/integration/repositories/bail-repository-sqlite.test.ts
    - src/infrastructure/repositories/bien-repository-sqlite.ts (modèle d'adapter — créé plans 02-03)
  </read_first>
  <action>
    `src/domain/_shared/money.ts` — VO Money :
    - `class Money` avec `readonly centimes: bigint`.
    - Constructeur **privé** ; factories statiques publiques : `Money.fromCentimes(n: bigint): Money` (throw si n < 0n), `Money.fromEuros(n: number): Money` (multiplie par 100, arrondi à l'entier, idem garde non-négatif), `Money.zero(): Money`.
    - Méthodes : `additionner(other: Money): Money` (retourne `Money.fromCentimes(this.centimes + other.centimes)`), `soustraire(other): Money` (throw si résultat négatif), `multiplier(facteur: number | bigint): Money`, `egale(other): boolean`, `lte(other): boolean`, `lt(other): boolean`, `superieurA(other): boolean`.
    - Sérialisation : `toJSON(): number` retourne `Number(this.centimes)` (RESEARCH §8 pitfall 2). Documenter que cette conversion est sûre tant que valeur < Number.MAX_SAFE_INTEGER (9 quadrillions cents = bien au-dessus des cas réels).
    - Format : `enEuros(): string` retourne format français `"800,50 €"` via `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.
    - **Aucun import externe**, sauf `Intl` natif Node.

    `src/domain/_shared/irl.ts` — VO IRL :
    - `class IRL` avec `readonly trimestre: string` (format `YYYY-TN` où N ∈ {1,2,3,4} — regex `/^\d{4}-T[1-4]$/`), `readonly valeur: string` (decimal as string, regex `/^\d+(\.\d+)?$/`).
    - Factory `IRL.creer({ trimestre, valeur }): IRL` :
      - Trimestre non vide + match regex → throw si pas.
      - Valeur non vide + match regex decimal + parseFloat > 0 → throw si pas.
    - Méthode `egale(other: IRL): boolean`.
    - Méthode `toJSON(): { trimestre: string; valeur: string }`.

    `src/domain/locatif/cautionnement.ts` :
    - `type TypeCautionnement = 'physique' | 'visale' | 'gli'` (D-33).
    - `class Garant` (inline ou fichier dédié) : `readonly nom, prenom, email, telephone, adresse: Adresse` — factory similaire à Locataire pour validation identité.
    - `class Cautionnement` : `readonly type, garant: Garant | null, montantGaranti: Money | null, dateSignature: Temporal.PlainDate, dureeEngagement: number /* mois */`.
    - Factory `Cautionnement.creer({...})` :
      - `type ∈ TypeCautionnement` else throw.
      - Si `type === 'physique'`, `garant !== null` else throw (`physique = caution personnelle`).
      - Si `type === 'visale'`, garant peut être null (organisme).
      - `dureeEngagement ≥ 1` else throw.
      - `dateSignature ≤ Temporal.Now.plainDateISO()` else throw (signature ne peut pas être dans le futur).
    - `toJSON(): object` pour sérialisation SQL en colonne `cautionnement TEXT` (JSON inline — D-33 + RESEARCH §4).

    `src/domain/locatif/bail.ts` — Entité racine :
    - `type ModeCharges = 'forfait' | 'provisions'`.
    - `type TypeBail = 'classique'` (V1 seulement — D-34 ; étudiant/mobilité différé V2).
    - `class Bail` immutable :
      - Readonly : `id: BailId`, `locataireId: LocataireId`, `bienId: BienId`, `lotIds: ReadonlyArray<LotId>`, `type: TypeBail`, `dateDebut: Temporal.PlainDate`, `dureeMois: number`, `loyerHc: Money`, `modeCharges: ModeCharges`, `montantCharges: Money`, `depotGarantie: Money`, `irlReference: IRL`, `cautionnement: Cautionnement | null`.
      - Factory `Bail.creer({...})` :
        - `dureeMois >= 12` else throw `InvariantViolated("Un bail meublé classique doit durer au moins 12 mois")` (D-35, §3.1 LMR).
        - `loyerHc.superieurA(Money.zero())` else throw `InvariantViolated("Le loyer hors charges doit être supérieur à 0 €")`.
        - `depotGarantie.lte(loyerHc.multiplier(2n))` else throw `InvariantViolated("Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges (maximum : ${...} €)")` (UI-SPEC §"Error States" message EXACT — interpoler le calcul).
        - `lotIds.length >= 1` else throw `InvariantViolated("Sélectionnez au moins un lot pour ce bail")`.
        - `modeCharges ∈ ['forfait', 'provisions']` else throw.
        - **NB Phase 1 :** la vérification "lot_ids appartiennent tous au même bien_id" est faite au use case (cross-aggregate) — l'agrégat Bail ne peut pas vérifier seul sans accès au Bien.
    - Méthode `modifier(patch): Bail` immuable — re-valide invariants via factory.

    `src/domain/locatif/bail-repository.ts` — Port :
    - `interface BailRepository { enregistrer(bail: Bail): Promise<void>; trouverParId(id: BailId): Promise<Bail | null>; listerTous(): Promise<Bail[]>; listerParLocataire(locataireId: LocataireId): Promise<Bail[]>; supprimer(id: BailId): Promise<void>; }`.

    `src/infrastructure/repositories/bail-repository-sqlite.ts` :
    - `class BailRepositorySqlite implements BailRepository` (constructeur Kysely<DB>).
    - `enregistrer` : **transaction Kysely** :
      1. `INSERT INTO bail ... ON CONFLICT(id) DO UPDATE SET ...` (idempotent).
      2. `DELETE FROM bail_lots WHERE bail_id = ?` (purge ancienne jointure si update).
      3. `INSERT INTO bail_lots (bail_id, lot_id) VALUES ...` pour chaque lot_id.
    - `trouverParId` :
      - `SELECT * FROM bail WHERE id = ? AND supprime_le IS NULL`.
      - `SELECT lot_id FROM bail_lots WHERE bail_id = ?`.
      - Mapper row + lots → `Bail.creer(...)` (re-validation — défense en profondeur).
      - Désérialiser `cautionnement` JSON → `Cautionnement.creer({...})`.
      - Désérialiser `irl_trimestre` + `irl_valeur` → `IRL.creer({trimestre, valeur})`.
      - Désérialiser `loyer_hc` (INTEGER cents) → `Money.fromCentimes(BigInt(row.loyer_hc))`.
      - Désérialiser `date_debut` (TEXT ISO) → `Temporal.PlainDate.from(row.date_debut)`.
    - `listerTous` : `SELECT b.*, GROUP_CONCAT(bl.lot_id) AS lot_ids FROM bail b LEFT JOIN bail_lots bl ON b.id = bl.bail_id WHERE b.supprime_le IS NULL GROUP BY b.id ORDER BY b.cree_le DESC`.
    - `listerParLocataire(locataireId)` : idem avec `WHERE b.locataire_id = ? AND b.supprime_le IS NULL`.
    - `supprimer(id)` : `UPDATE bail SET supprime_le = CURRENT_TIMESTAMP WHERE id = ?`.

    Use cases (4 fichiers `src/application/locatif/`) :
    - `creerBail(commande, bailRepo, bienRepo, locataireRepo): Promise<BailId>` :
      1. `bien = bienRepo.trouverParId(commande.bienId)` → null=throw `BienIntrouvable`.
      2. `locataire = locataireRepo.trouverParId(commande.locataireId)` → null=throw `LocataireIntrouvable`.
      3. Vérifier que tous `commande.lotIds` ⊂ `bien.lots.map(l => l.id)` → sinon throw `InvariantViolated("Tous les lots doivent appartenir au même bien")` (D-30).
      4. Construire `Money.fromCentimes(BigInt(...))` pour loyer/charges/dépôt, `IRL.creer(...)`, `Cautionnement.creer(...)` si fourni.
      5. `Bail.creer({...})` (factory valide invariants D-35).
      6. `bailRepo.enregistrer(bail)`.
      7. Retourner `bail.id`.
    - `modifierBail(commande, bailRepo, ...)` : similaire — pattern Bien.modifier + repo.enregistrer.
    - `supprimerBail(id, bailRepo)`.
    - `listerBaux(bailRepo): Promise<Bail[]>`.

    Définir `class BailIntrouvable extends Error` si pas déjà fait dans `src/domain/locatif/erreurs.ts`.
  </action>
  <verify>
    <automated>pnpm test -- --run tests/unit/_shared/ tests/unit/locatif/ tests/integration/repositories/bail-repository-sqlite.test.ts &amp;&amp; pnpm lint:deps &amp;&amp; pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm test -- --run tests/unit/_shared/money.test.ts` exit 0 (≥ 12 verts).
    - `pnpm test -- --run tests/unit/_shared/irl.test.ts` exit 0 (≥ 6 verts).
    - `pnpm test -- --run tests/unit/locatif/cautionnement.test.ts` exit 0 (≥ 5 verts).
    - `pnpm test -- --run tests/unit/locatif/bail.test.ts` exit 0 (≥ 12 verts).
    - `pnpm test -- --run tests/integration/repositories/bail-repository-sqlite.test.ts` exit 0 (≥ 5 verts).
    - `pnpm lint:deps` exit 0.
    - `src/domain/_shared/money.ts` n'importe que `Intl` (natif) — assertion `grep -cE "import" src/domain/_shared/money.ts` ≤ 1 (potentiel import depuis erreurs.ts).
    - `src/domain/locatif/bail.ts` contient les 5 invariants en mots-clés : "12 mois", "loyer hors charges", "dépôt de garantie", "lot", "forfait" OR "provisions" (assertion: 4/5 greps passent au minimum).
    - `src/infrastructure/repositories/bail-repository-sqlite.ts` contient `bail_lots` ET `transaction` (jointure dans transaction).
  </acceptance_criteria>
  <done>VOs Money/IRL/Cautionnement testés à 100%, agrégat Bail encode les 5 invariants Phase 1 D-35, repo SQLite roundtrip Bail+lots+cautionnement+IRL+Money sans perte. Use case `creerBail` orchestre les 3 agrégats (Bien, Locataire, Bail) en respectant la frontière hexagonale (cross-aggregate read via repos, jamais via traversée directe — DDD.md §4.3).</done>
</task>

<task type="auto">
  <name>Task 3: Routes Fastify + Zod schemas + pages baux + intégration empty state prérequis + section "Baux" sur fiche Locataire</name>
  <files>
    src/web/routes/baux.ts,
    src/web/schemas/bail-schemas.ts,
    src/web/views/pages/baux/liste.ejs,
    src/web/views/pages/baux/formulaire.ejs,
    src/web/views/pages/baux/detail.ejs,
    src/web/views/pages/locataires/detail.ejs,
    src/main.ts
  </files>
  <read_first>
    - .planning/phases/01-activation-bien-locataire-bail/01-UI-SPEC.md §"Screen Inventory" (Liste/Formulaire Bail), §"Copywriting Contract", §"Empty States" §"Liste Baux (prérequis manquant)" + §"Liste Baux (0 baux mais prérequis OK)", §"Error States" (TOUS les messages bail)
    - .planning/phases/01-activation-bien-locataire-bail/01-SKELETON.md §"Routes Fastify"
    - .planning/phases/01-activation-bien-locataire-bail/01-CONTEXT.md D-18, D-35, D-37, D-43
    - src/web/routes/locataires.ts (modèle de plan 04)
    - src/web/views/pages/locataires/* (modèle de pages)
    - src/web/views/pages/locataires/detail.ejs (étendre section "Baux associés")
  </read_first>
  <action>
    `src/web/schemas/bail-schemas.ts` :
    - `bailCreationSchema = z.object({ bienId: z.string().uuid(), locataireId: z.string().uuid(), lotIds: z.array(z.string().uuid()).min(1), dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), dureeMois: z.coerce.number().int().min(12), loyerHcEuros: z.coerce.number().positive(), modeCharges: z.enum(['forfait', 'provisions']), montantChargesEuros: z.coerce.number().min(0), depotGarantieEuros: z.coerce.number().min(0), irlTrimestre: z.string().regex(/^\d{4}-T[1-4]$/), irlValeur: z.string().regex(/^\d+(\.\d+)?$/), cautionnementType: z.enum(['physique', 'visale', 'gli']).optional(), garantNom: z.string().optional(), garantPrenom: z.string().optional(), garantEmail: z.string().email().optional(), garantTelephone: z.string().optional(), garantRue: z.string().optional(), garantCodePostal: z.string().optional(), garantVille: z.string().optional(), cautionnementMontantGarantiEuros: z.coerce.number().optional(), cautionnementDateSignature: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), cautionnementDureeMois: z.coerce.number().int().optional() }).superRefine((data, ctx) => { if (data.depotGarantieEuros > 2 * data.loyerHcEuros) ctx.addIssue({ code: 'custom', path: ['depotGarantieEuros'], message: \`Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges (maximum : ${2 * data.loyerHcEuros} €)\` }); if (data.cautionnementType === 'physique' && (!data.garantNom || !data.garantPrenom || !data.garantEmail)) ctx.addIssue({ code: 'custom', path: ['garantNom'], message: 'Garant obligatoire pour cautionnement physique' }); })`.
    - Le mapping vers Money : route handler convertit `loyerHcEuros: 800` → `Money.fromEuros(800)` (centimes 80000).

    `src/web/views/pages/baux/liste.ejs` :
    - Layout shell, sidebar "Baux" actif.
    - **Branch empty state prérequis** (UI-SPEC §"Empty States" §"Liste Baux (prérequis manquant)") :
      - Si `locals.biensCount === 0 || locals.locatairesCount === 0` :
        - `<h1>Impossible de créer un bail</h1>`
        - `<p>Vous avez besoin d'au moins 1 bien et 1 locataire avant de créer un bail.</p>`
        - Si `biensCount === 0` : `<a href="/biens/nouveau" role="button">Créer un bien</a>`
        - Sinon (`locatairesCount === 0`) : `<a href="/locataires/nouveau" role="button">Créer un locataire</a>`
    - **Empty state baux normal** (0 baux mais prérequis OK) : `<h1>Aucun bail pour l'instant</h1>` + `<p>Reliez un bien à un locataire en créant votre premier bail meublé.</p>` + `<a href="/baux/nouveau" role="button">Créer un bail</a>`.
    - Sinon : data-table avec colonnes Locataire, Adresse du bien, Loyer HC (numeric), Date début, Durée, Actions.

    `src/web/views/pages/baux/formulaire.ejs` :
    - `<h1>` "Créer un bail" / "Modifier le bail".
    - Fieldset "Bien et Locataire" :
      - `<select name="bienId">` listant `locals.biens` (`<option value="<%= b.id %>"><%= b.adresse.enLigne() %></option>`).
      - `<select name="locataireId">` listant `locals.locataires`.
      - `<fieldset><legend>Lots concernés</legend>` : checkboxes des Lots du Bien sélectionné. **Progressive enhancement** : un script JS minimal écoute le changement de `<select name="bienId">` et fait un fetch `GET /api/biens/:id/lots-json` pour rafraîchir les checkboxes (à câbler — créer endpoint utilitaire JSON dans `routes/biens.ts`). En fallback no-JS : afficher tous les Lots de tous les Biens et le serveur filtre à la validation Zod custom.
        - **Alternative simpler V1** : étape pré-formulaire — `/baux/nouveau` accepte query `?bienId=...` ; si absent, écran de sélection ; si présent, formulaire avec les Lots de ce Bien hardcoded. Choisir cette voie pour rester YAGNI Phase 1.
    - Fieldset "Conditions financières" : loyer HC (input[type=number step=0.01]), mode charges (radio forfait/provisions), montant charges, dépôt garantie. Helper inline `<small>Maximum : <%= 2 * loyerHc %> €</small>`.
    - Fieldset "Période" : date début (type=date), durée mois.
    - Fieldset "IRL de référence" : trimestre (text placeholder "2026-T1"), valeur (text placeholder "145.47"). `<small>Récupérer la valeur sur insee.fr — sera utilisée pour la révision annuelle.</small>` (D-37).
    - Fieldset "Cautionnement (optionnel)" :
      - Radio type : physique / visale / gli / aucun (default).
      - Si physique : sous-fieldset Garant (nom, prénom, email, téléphone, adresse).
      - Date signature, durée engagement.
      - Montant garanti (optionnel).
      - Progressive enhancement JS pour show/hide la section selon le radio.
    - Bouton submit CTA EXACT : "Enregistrer le bail".

    `src/web/views/pages/baux/detail.ejs` :
    - `<h1>` `Bail de <%= locataire.prenom %> <%= locataire.nom %> au <%= bien.adresse.enLigne() %>`.
    - Sections : Identité (locataire), Bien (adresse + lots), Conditions financières, Période, IRL, Cautionnement (si présent).
    - Boutons "Modifier le bail" / "Supprimer le bail" (confirm-dialog).

    `src/web/views/pages/locataires/detail.ejs` (étendre plan 04 — remplacer la section stub par la vraie) :
    - Nouvelle section "Baux associés" : data-table partial listant `locals.baux` (issu de `BailRepository.listerParLocataire(id)`) — colonnes Adresse, Loyer, Date début, Durée. Si `baux.length === 0`, afficher `<p>Aucun bail pour ce locataire.</p>` + lien `<a href="/baux/nouveau?locataireId=:id">Créer un bail</a>` (préremplir locataire).

    `src/web/routes/baux.ts` :
    - GET `/baux` :
      - `biensCount = (await bienRepo.listerTous()).length`
      - `locatairesCount = (await locataireRepo.listerTous()).length`
      - `baux = await listerBaux(bailRepo)`
      - render liste.ejs avec `{ baux, biensCount, locatairesCount }`.
    - GET `/baux/nouveau` :
      - Vérifier prérequis : si biensCount === 0 OU locatairesCount === 0 → 302 `/baux` (la page liste affichera l'empty state prérequis).
      - Charger `biens = bienRepo.listerTous()`, `locataires = locataireRepo.listerTous()`.
      - Si query `?bienId=...` fourni, charger les Lots de ce Bien.
      - Render formulaire.ejs.
    - POST `/baux` : Zod `bailCreationSchema.safeParse(body)` → erreurs (re-render formulaire avec messages exact UI-SPEC §"Error States") OU `creerBail(...)` → 302 `/baux/:id` + flash success "Bail enregistré avec succès."
    - GET `/baux/:id` → `bailRepo.trouverParId` (+ charger bien, locataire pour l'affichage cross-aggregate via leurs repos) → render detail.ejs ou 404.
    - GET `/baux/:id/modifier` → render formulaire en mode 'edition' pré-rempli.
    - POST `/baux/:id/modifier` → Zod → `modifierBail` → 302 `/baux/:id`.
    - POST `/baux/:id/supprimer` → `supprimerBail` → 302 `/baux` + flash success.

    `src/main.ts` (étendre) :
    - Instancier `bailRepo = new BailRepositorySqlite(db)`.
    - Register routes `baux.ts` avec opts `{ bailRepo, bienRepo, locataireRepo }`.
    - Activer le lien sidebar "Baux".
  </action>
  <verify>
    <automated>pnpm typecheck &amp;&amp; pnpm lint &amp;&amp; pnpm test -- --run &amp;&amp; pnpm test:bdd</automated>
  </verify>
  <acceptance_criteria>
    - `pnpm typecheck` exit 0.
    - `pnpm lint` exit 0 (0 warning).
    - `pnpm test -- --run` exit 0 (tous tests plans 02-05 verts — au moins 50+ tests cumulés).
    - `pnpm test:bdd` exit 0 (carryover plan 02).
    - `pnpm lint:deps` exit 0.
    - `src/web/schemas/bail-schemas.ts` contient `superRefine` ou re-vérification dépôt ≤ 2× (assertion: `grep -q "2 \* data.loyerHcEuros" src/web/schemas/bail-schemas.ts`).
    - `src/web/views/pages/baux/liste.ejs` contient "Impossible de créer un bail" ET "Aucun bail pour l'instant" (assertion: 2 greps — gère les 2 empty states).
    - `src/web/views/pages/baux/formulaire.ejs` contient "Enregistrer le bail" (CTA EXACT).
    - `src/web/views/pages/baux/formulaire.ejs` contient au moins 4 `<fieldset>` (Bien+Locataire, Conditions financières, Période, IRL, Cautionnement).
    - `src/web/views/pages/locataires/detail.ejs` contient "Baux associés" (section ajoutée).
    - Test manuel : créer un Bien, un Locataire, puis un Bail → ligne visible dans `/baux` + section "Baux associés" sur fiche locataire affichée.
    - Test manuel : tenter dépôt = 3 × loyer → formulaire re-rendu avec message exact "Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges (maximum : XXX €)" (UI-SPEC §"Error States" EXACT).
    - Test manuel : tenter durée = 6 mois → message exact "Un bail meublé classique doit durer au moins 12 mois".
  </acceptance_criteria>
  <done>LOC-02 entièrement couvert — bail meublé classique créable, éditable, supprimable, avec tous les invariants V1 validés (durée ≥ 12, dépôt ≤ 2×, ≥ 1 lot, mode charges, IRL ref, cautionnement optionnel). Messages d'erreur UI-SPEC EXACTS. La fiche Locataire affiche les Baux associés. Le triangle Bien-Locataire-Bail boucle pour le KPI Activation (avant Plan 06 = wizard automatisé).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → POST /baux | Multi-aggregate write (Bien, Locataire, Bail) ; risque tampering des IDs + invariants financiers. |
| Use case → 3 repositories | Cross-aggregate read pour valider invariants D-30 (lot_ids appartiennent à bien_id). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-01 | Tampering | POST /baux body (loyer, dépôt) | mitigate | Double validation : Zod `superRefine` côté HTTP (calcul `2 * loyerHcEuros`) + invariant agrégat `Bail.creer` (Money.lte). |
| T-05-02 | Tampering | POST /baux body (bienId, locataireId, lotIds) | mitigate | Use case `creerBail` vérifie `bien_id` existe, `locataire_id` existe, `lot_ids ⊂ bien.lots` — throw avant persistance. |
| T-05-03 | Tampering | bigint Money en SQL | mitigate | Kysely paramétrise les requêtes ; conversion `BigInt(row.loyer_hc)` au lecture, `Number(money.centimes)` au write (TODO documenter ce point précis). |
| T-05-04 | Information Disclosure | Cautionnement JSON inline | accept | Mono-user local. Pas d'enjeu de fuite. JSON déchiffré dans la même DB. |
| T-05-05 | Repudiation | Modification bail sans audit log | accept | Soft-delete Phase 1 ; audit log différé (Phase 5/7). |
| T-05-06 | DoS | Form lots[] illimité | mitigate | Zod `.array(...).min(1).max(50)`. |
| T-05-07 | Elevation of Privilege | Pas d'auth Phase 1 | accept | DV-02 mono-user (cohérent T-01-06). |
</threat_model>

<verification>
- `pnpm typecheck` exit 0
- `pnpm lint` exit 0
- `pnpm test -- --run` exit 0 (≥ 50 tests cumulés verts : plans 02-05)
- `pnpm test:bdd` exit 0 (1 scenario carryover plan 02)
- `pnpm lint:deps` exit 0
- Test manuel cycle complet : créer Bien (1 Lot) + Locataire → naviguer `/baux` → empty state "Aucun bail pour l'instant" → "Créer un bail" → formulaire → soumission valide → flash success → ligne visible.
- Test manuel cas erreur : créer un bail avec dépôt = 3×loyer → erreur inline EXACT.
- Test manuel cas erreur : créer un bail avec durée = 6 → erreur inline EXACT.
- Test manuel : section "Baux associés" de la fiche Locataire affiche le bail créé.
- Test manuel prérequis : DB vide → `/baux` affiche "Impossible de créer un bail. Vous avez besoin d'au moins 1 bien et 1 locataire avant de créer un bail." avec CTA pointant vers `/biens/nouveau`.
- Coverage `src/domain/_shared/money.ts` = 100% (gate domain).
- Coverage `src/domain/locatif/bail.ts` = 100% (gate domain).
</verification>

<success_criteria>
LOC-02 entièrement couvert. Le triangle Bien-Locataire-Bail est fonctionnel. Toutes les invariants juridiques V1 du bail meublé classique (LOCATION_MEUBLEE_REGLES.md §3.1 + §5) sont **encodés et testés à 100 %** (gate domain coverage tient). Phase 2 (Quittancement) peut maintenant lire un Bail actif et déclencher la génération d'échéances. Phase 3 (Conformité) peut activer l'indexation IRL à partir de `Bail.irlReference`.

Le KPI Activation §5 ROADMAP est **techniquement atteint** : 1 Bien + 1 Locataire + 1 Bail visibles en liste persistée. Plan 06 ajoute le wizard guidé pour le premier lancement (parcours utilisateur fluide, pas seulement faisable).
</success_criteria>

<output>
Créer `.planning/phases/01-activation-bien-locataire-bail/01-05-bail-classique-SUMMARY.md`. Lister :
- Tests verts cumulés (avec breakdown par fichier)
- Confirmation coverage `src/domain/_shared/money.ts` = 100% et `src/domain/locatif/bail.ts` = 100%
- Snippet de la signature `creerBail` (use case multi-repos) — utile Plan 06 wizard
- Pattern de désérialisation Temporal.PlainDate ↔ string ISO et Money ↔ INTEGER cents (référence pour Phase 2+)
- Tous les messages UI-SPEC §"Error States" implémentés mot pour mot
</output>

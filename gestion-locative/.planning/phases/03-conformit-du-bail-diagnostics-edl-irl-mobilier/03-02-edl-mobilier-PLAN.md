---
phase: 03
plan: 02
plan_id: "03-02"
type: execute
wave: 2
depends_on: ["03-01"]
files_modified:
  - migrations/0008_phase3_edl.sql
  - src/infrastructure/db/kysely-types.ts
  - src/domain/_shared/identifiants.ts
  - src/domain/_shared/inventaire-item.ts
  - src/domain/locatif/etat-des-lieux.ts
  - src/domain/locatif/etat-des-lieux-repository.ts
  - src/domain/locatif/comparer-inventaires.ts
  - src/domain/locatif/bail.ts
  - src/domain/locatif/erreurs.ts
  - src/infrastructure/repositories/etat-des-lieux-repository-sqlite.ts
  - src/infrastructure/repositories/bail-repository-sqlite.ts
  - src/application/locatif/enregistrer-edl-entree.ts
  - src/application/locatif/enregistrer-edl-sortie.ts
  - src/application/locatif/lister-edl.ts
  - src/web/schemas/edl-schemas.ts
  - src/web/schemas/bail-schemas.ts
  - src/web/routes/etats-des-lieux.ts
  - src/web/routes/baux.ts
  - src/web/views/pages/baux/edl/entree.ejs
  - src/web/views/pages/baux/edl/sortie.ejs
  - src/web/views/pages/baux/edl/formulaire.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/pages/baux/formulaire.ejs
  - src/web/views/partials/partial-edl-form.ejs
  - src/web/views/partials/partial-inventaire-display.ejs
  - src/web/views/partials/partial-inventaire-warnings.ejs
  - src/helpers/format-etat-item.ts
  - src/helpers/format-type-item-inventaire.ts
  - src/main.ts
  - tests/_builders/locatif.ts
  - tests/unit/_shared/inventaire-item.test.ts
  - tests/unit/locatif/etat-des-lieux.test.ts
  - tests/unit/locatif/comparer-inventaires.test.ts
  - tests/unit/locatif/bail-mobilier.test.ts
  - tests/unit/locatif/enregistrer-edl.test.ts
  - tests/unit/helpers/format-etat-item.test.ts
  - tests/unit/helpers/format-type-item-inventaire.test.ts
  - tests/integration/repositories/etat-des-lieux-repository-sqlite.test.ts
  - tests/integration/repositories/bail-repository-sqlite-mobilier.test.ts
  - tests/bdd/features/edl.feature
  - tests/bdd/features/checklist-mobilier.feature
  - tests/bdd/step_definitions/edl.steps.ts
  - tests/bdd/step_definitions/checklist-mobilier.steps.ts
autonomous: true
requirements: ["LOC-03", "LOC-06"]
user_setup: []

mvp_split_rationale: |
  Vertical slice combinée LOC-03 (EDL contradictoire + Inventaire) + LOC-06 (checklist mobilier décret 2015-981).
  Combinées en un seul plan parce que D-81 + D-97 imposent une **structure unique InventaireItem partagée**
  entre Bail (mobilier minimaliste à la création) et EtatDesLieux (inventaire avec état + note).
  Les séparer dupliquerait l'enum TypeItemInventaire et la sérialisation JSON. Au prix d'un plan plus dense
  (3 tasks au lieu de 2-3 typique), on garantit la cohérence métier. Wave 2 — depend on 03-01 pour réutiliser
  le pattern partial-badge-dpe sur la fiche Bail (banner gel conditionnel à venir 03-03).

must_haves:
  truths:
    - "L'utilisateur peut enregistrer un EDL d'entrée via POST /baux/:id/edl/entree avec date_edl + contradictoire + dateSignature (conditionnelle) + 12 items du décret 2015-981 (présence + état + note)."
    - "L'utilisateur peut enregistrer un EDL de sortie via POST /baux/:id/edl/sortie avec les mêmes champs — type discriminant 'entree' | 'sortie' (D-82)."
    - "Invariant cross-aggregate D-89 : ≤1 EDL d'entrée actif + ≤1 EDL de sortie actif par bail. Correction = soft-delete (annuleLe + raisonAnnulation) + nouvel EDL."
    - "L'invariant ≤1 EDL actif par (bail, type) est doublement gardé : (1) use case rejette avec EDLEntreeExisteDeja / EDLSortieExisteDeja, (2) UNIQUE INDEX SQLite partiel sur (bail_id, type) WHERE annule_le IS NULL."
    - "Structure unique InventaireItem (D-81, D-97) partagée Bail.mobilier ET EtatDesLieux.inventaire — enum TypeItemInventaire codé en dur 12 valeurs ATOMIQUES décret 2015-981 (D-100) : literie, volets_occultants, plaques_cuisson, four_micro_ondes, refrigerateur_congelateur, vaisselle, ustensiles, table, sieges, etageres, luminaires, materiel_entretien."
    - "EtatDesLieux.inventaire stocké en JSON inline sur la colonne etat_des_lieux.inventaire (D-86, pattern Cautionnement Phase 1)."
    - "Bail.mobilier stocké en JSON inline sur la colonne bail.mobilier (ALTER bail) — réutilise la même sérialisation InventaireItem.toJSON."
    - "Si contradictoire=true, dateSignature obligatoire (invariant Domain). Si contradictoire=false, dateSignature null."
    - "Warning non bloquant D-85 : EDL de sortie créé alors qu'aucun EDL d'entrée actif n'existe → use case retourne `warnings: ['EDL_ENTREE_ABSENT']`."
    - "Warning non bloquant D-84 : EDL de sortie avec dateEdl < bail.dateDebut + bail.dureeMois (avant fin officielle) → `warnings: ['EDL_SORTIE_AVANT_FIN']`."
    - "Warning non bloquant D-98 : à la création/édition du Bail, si ≥1 item obligatoire du décret 2015-981 marqué present=false → message exact UI-SPEC 'Attention : {N} élément(s) obligatoire(s) du décret 2015-981 sont marqués absents. Le bail risque d'être requalifié en bail nu, entraînant un changement de régime fiscal'."
    - "Warning non bloquant D-98 : à la création de l'EDL d'entrée, si ≥1 item obligatoire marqué present=false → message UI-SPEC '{N} élément(s) du décret 2015-981 absents dans cet inventaire — risque de requalification du bail en bail non meublé.'"
    - "Domain service comparerInventaires(entree, sortie) → Warning[] (D-99, D-101) : warnings WARNING_ITEM_DISPARU (présent entrée + absent sortie) + WARNING_ITEM_DEGRADE (état dégradé bon→moyen, bon→dégradé, moyen→dégradé). Item absent entrée + présent sortie → ignoré."
    - "La fiche /baux/:id affiche une section <h2>État des lieux</h2> avec 0/1/2 EDL (liens vers /baux/:id/edl/entree et /baux/:id/edl/sortie) + warning si EDL entrée absent et bail actif."
    - "La page /baux/:id/edl/sortie affiche les warnings delta retournés par comparerInventaires (texte simple, pas de tableau côte à côte — vue diff différée Phase 4)."
    - "Le formulaire Bail (création + édition) contient un <fieldset><legend>Mobilier obligatoire (décret 2015-981)</legend> avec 12 checkboxes pré-cochées par défaut (Hick's Law — cas le plus courant). Soumission rend warning textuel si items manquants (jamais bloquant)."
    - "BDD @loc-03 + @loc-06 : 8 scenarios verts couvrant invariant ≤1+1, soft-delete + ré-enregistrement, conditionnel dateSignature, delta detection, mobilier requalification Bail + EDL, 12 items atomiques décret 2015-981 énumérés exactement (literie, volets_occultants, plaques_cuisson, four_micro_ondes, refrigerateur_congelateur, vaisselle, ustensiles, table, sieges, etageres, luminaires, materiel_entretien — pas de fusion, pas d'invention)."
  artifacts:
    - path: "migrations/0008_phase3_edl.sql"
      provides: "Table etat_des_lieux (avec inventaire JSON + soft-delete) + UNIQUE INDEX partiel + ALTER bail ADD mobilier TEXT NULL"
      contains: "CREATE TABLE IF NOT EXISTS etat_des_lieux, CREATE UNIQUE INDEX idx_edl_bail_type_actif, ALTER TABLE bail ADD COLUMN mobilier"
    - path: "src/domain/_shared/inventaire-item.ts"
      provides: "VO InventaireItem + TypeItemInventaire 12 valeurs + LABELS_ITEM_INVENTAIRE + TYPES_ITEM_OBLIGATOIRES + comparaison etat"
      exports: ["InventaireItem", "TypeItemInventaire", "EtatItem", "LABELS_ITEM_INVENTAIRE", "TYPES_ITEM_OBLIGATOIRES", "TYPES_ITEM_INVENTAIRE", "etatADegrade", "inventaireVidePour"]
    - path: "src/domain/locatif/etat-des-lieux.ts"
      provides: "Agrégat EtatDesLieux + factory + invariants (12 items, dateSignature si contradictoire) + soft-delete annuler()"
      exports: ["EtatDesLieux", "TypeEDL"]
    - path: "src/domain/locatif/etat-des-lieux-repository.ts"
      provides: "Port EtatDesLieuxRepository (enregistrer, trouverActifParBailEtType, listerParBail)"
      exports: ["EtatDesLieuxRepository"]
    - path: "src/domain/locatif/comparer-inventaires.ts"
      provides: "Domain service pur comparerInventaires(entree, sortie) → Warning[] (WARNING_ITEM_DISPARU + WARNING_ITEM_DEGRADE)"
      exports: ["comparerInventaires", "Warning", "WARNING_ITEM_DISPARU", "WARNING_ITEM_DEGRADE"]
    - path: "src/domain/locatif/bail.ts"
      provides: "Bail étendu : champ mobilier: InventaireItem[] (défaut []) + méthode verifierChecklistMobilier() → manquants"
      exports: ["Bail"]
    - path: "src/application/locatif/enregistrer-edl-entree.ts"
      provides: "Use case multi-repos (BailRepository + EtatDesLieuxRepository) — invariant cross-aggregate D-89 + warning D-98"
      exports: ["enregistrerEDLEntree"]
    - path: "src/application/locatif/enregistrer-edl-sortie.ts"
      provides: "Use case multi-repos — D-89 + D-84 + D-85 + comparerInventaires si entrée présente"
      exports: ["enregistrerEDLSortie"]
    - path: "src/web/routes/etats-des-lieux.ts"
      provides: "6 routes : GET/POST /baux/:id/edl/entree[/nouveau], GET/POST /baux/:id/edl/sortie[/nouveau]"
      exports: ["plugin"]
    - path: "src/web/views/partials/partial-edl-form.ejs"
      provides: "Partial formulaire EDL (fieldset 12 items, partagé entrée/sortie via locals.type)"
    - path: "src/web/views/partials/partial-inventaire-display.ejs"
      provides: "Partial affichage lecture-seule des 12 items (html print-friendly)"
    - path: "src/web/views/partials/partial-inventaire-warnings.ejs"
      provides: "Partial liste Warning[] avec aria-live='polite'"
    - path: "src/helpers/format-etat-item.ts"
      provides: "Helper preHandler formaterEtatItem(etat) — DP-18"
      exports: ["formaterEtatItem"]
    - path: "src/helpers/format-type-item-inventaire.ts"
      provides: "Helper preHandler formaterTypeItemInventaire(type) — DP-18"
      exports: ["formaterTypeItemInventaire"]
  key_links:
    - from: "src/domain/locatif/etat-des-lieux.ts"
      to: "src/domain/_shared/inventaire-item.ts"
      via: "EtatDesLieux.inventaire: ReadonlyArray<InventaireItem> + invariant length === 12"
      pattern: "InventaireItem"
    - from: "src/domain/locatif/bail.ts"
      to: "src/domain/_shared/inventaire-item.ts"
      via: "Bail.mobilier: ReadonlyArray<InventaireItem> + Bail.verifierChecklistMobilier() vérifie TYPES_ITEM_OBLIGATOIRES"
      pattern: "verifierChecklistMobilier"
    - from: "src/infrastructure/repositories/etat-des-lieux-repository-sqlite.ts"
      to: "src/domain/_shared/inventaire-item.ts"
      via: "JSON.stringify(inventaire.map(i => i.toJSON())) à l'écriture, JSON.parse + InventaireItem.creer à la lecture"
      pattern: "inventaire JSON inline"
    - from: "src/application/locatif/enregistrer-edl-sortie.ts"
      to: "src/domain/locatif/comparer-inventaires.ts"
      via: "Si EDL entrée actif existe, retourne warnings = comparerInventaires(entree, sortie)"
      pattern: "comparerInventaires"
    - from: "src/web/views/pages/baux/edl/formulaire.ejs"
      to: "src/web/views/partials/partial-edl-form.ejs"
      via: "<%- include('../../../partials/partial-edl-form', { type, valeurs, erreurs, helpers }) %> — partagé entrée/sortie"
      pattern: "partial-edl-form"
    - from: "src/web/views/pages/baux/formulaire.ejs"
      to: "src/domain/_shared/inventaire-item.ts"
      via: "Itère TYPES_ITEM_INVENTAIRE pour rendre 12 checkboxes pré-cochées par défaut"
      pattern: "TYPES_ITEM_INVENTAIRE"
---

<objective>
Vertical slice combinée LOC-03 (EtatDesLieux contradictoire + Inventaire mobilier) + LOC-06 (checklist mobilier obligatoire à la création/édition du Bail).

Purpose: LOC-03 satisfait l'article 3-2 de la loi 89-462 (EDL contradictoire). LOC-06 implémente le décret n°2015-981 (12 éléments obligatoires) — un manquement expose le bailleur à requalification en bail nu (régime fiscal foncier au lieu de BIC). Le domain service `comparerInventaires` (D-101) prépare la justification de la retenue sur dépôt de garantie (warnings textuels Phase 3, vue diff différée Phase 4).
Output: Pages EDL entrée/sortie avec inventaire 12 items, soft-delete + ré-enregistrement, warnings textuels delta sur EDL sortie, fieldset mobilier dans formulaire Bail, persistance JSON inline.
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
@DDD.md
@SOFTWARE_CRAFTSMANSHIP.md
@UI_DESIGN.md
@UX_DESIGN.md
@ACCESSIBILITY.md
@LOCATION_MEUBLEE_REGLES.md
@src/domain/_shared/identifiants.ts
@src/domain/_shared/clock.ts
@src/domain/_shared/erreurs.ts
@src/domain/locatif/bail.ts
@src/domain/locatif/bail-repository.ts
@src/domain/locatif/cautionnement.ts
@src/domain/locatif/locataire.ts
@src/domain/locatif/locataire-repository.ts
@src/domain/locatif/erreurs.ts
@src/infrastructure/repositories/bail-repository-sqlite.ts
@src/web/routes/baux.ts
@src/web/schemas/bail-schemas.ts
@src/web/views/pages/baux/detail.ejs
@src/web/views/pages/baux/formulaire.ejs
@src/web/views/partials/banniere-warning.ejs
@src/web/views/partials/form-field.ejs
@src/web/views/partials/empty-state.ejs
@src/web/views/partials/data-table.ejs
@src/main.ts
</context>

<interfaces>
Contrats clés Phase 1/3-01 (réutilisés) :

- `BailId`, `BienId`, `LocataireId` (brand types) — déjà exportés. **À étendre** : ajouter `EtatDesLieuxId` + `nouveauEtatDesLieuxId()`.
- `Bail` factory + `toProps()` + `modifier()` — pattern Phase 1 D-35 (durée ≥ 12, loyer > 0, dépôt ≤ 2 mois, etc.).
- `Cautionnement.toJSON()` (Phase 1 D-33) — modèle exact pour `InventaireItem.toJSON()` (sérialisation JSON inline).
- `BailRepositorySqlite` — déjà roundtrip Bail. **À étendre** : sérialisation/désérialisation `Bail.mobilier` JSON inline.
- `InvariantViolated` (`src/domain/_shared/erreurs.ts`).
- `BailIntrouvable` (`src/domain/locatif/erreurs.ts`).
- `Clock` port — pour `comparerInventaires` ? Non, comparaison est pure. Pour soft-delete `annuler(raison, annuleLe)` — `annuleLe` paramètre, pas Clock dans le domain.

Nouveaux contrats Phase 3-02 (exposés aux plans suivants) :

- `TypeItemInventaire = 'literie' | 'volets_occultants' | 'plaques_cuisson' | 'four_micro_ondes' | 'refrigerateur_congelateur' | 'vaisselle' | 'ustensiles' | 'table' | 'sieges' | 'etageres' | 'luminaires' | 'materiel_entretien'` — **12 valeurs atomiques exactes du décret n°2015-981 art. 25-4 loi 89-462** (D-100, source LOCATION_MEUBLEE_REGLES.md §2 lignes 13-28, AUTHORITATIVE). Lock revision iteration 1 BLOCKER 1 : aucune fusion (vaisselle ≠ ustensiles, table ≠ sieges), aucune invention (pas de cuisine_evier ni chauffage_eau_chaude — ces items n'apparaissent PAS dans le décret 2015-981).
- `LABELS_ITEM_INVENTAIRE: Record<TypeItemInventaire, string>` — libellés français lisibles (ex: 'literie' → 'Literie (matelas + couverture/couette)').
- `TYPES_ITEM_INVENTAIRE: TypeItemInventaire[]` — array énumérant les 12 valeurs (ordre canonique pour itération vues).
- `TYPES_ITEM_OBLIGATOIRES: TypeItemInventaire[]` — V1 = tous les 12 items sont obligatoires (D-100 décret). Si V1.x ajoute la distinction obligatoire/optionnel, ce sera un sous-ensemble.
- `EtatItem = 'bon' | 'moyen' | 'degrade' | null` — null acceptable si `present: false`.
- `InventaireItem` VO :
  - Props : `{ typeItem: TypeItemInventaire, present: boolean, etat: EtatItem, note: string | null }`.
  - Factory `creer(props)` : valide `typeItem ∈ TYPES_ITEM_INVENTAIRE`, valide `etat ∈ {bon, moyen, degrade, null}`, **valide `etat !== null` SI `present === true`** (sinon throw InvariantViolated('L\'état est requis si l\'item est présent')).
  - Méthode `toJSON()` : `{ typeItem, present, etat, note }` (forme plate).
- `etatADegrade(avant: EtatItem, apres: EtatItem): boolean` — function pure exportée : retourne `true` si transition est : bon→moyen, bon→dégradé, moyen→dégradé. Retourne `false` pour autres transitions (incluant amélioration ou identique).
- `inventaireVidePour(types: TypeItemInventaire[]): InventaireItem[]` — helper qui retourne `types.map(t => InventaireItem.creer({ typeItem: t, present: false, etat: null, note: null }))`. Usage par les builders et factory Bail.
- `inventaireCompletPresent(): InventaireItem[]` — helper qui retourne les 12 items tous `present: true` état `bon` (cas par défaut formulaire Bail — Hick's Law).
- `TypeEDL = 'entree' | 'sortie'` discriminant.
- `EtatDesLieux` agrégat racine :
  - Props : `{ id?: EtatDesLieuxId, bailId: BailId, type: TypeEDL, dateEdl: Temporal.PlainDate, contradictoire: boolean, dateSignature: Temporal.PlainDate | null, inventaire: InventaireItem[], annuleLe?: Temporal.PlainDate | null, raisonAnnulation?: string | null }`.
  - Factory `creer(props)` invariants :
    - `inventaire.length === 12` sinon throw InvariantViolated('L\'inventaire doit contenir exactement les 12 items du décret 2015-981').
    - `inventaire` doit couvrir TYPES_ITEM_INVENTAIRE exactement (un item par typeItem, pas de doublon, pas de manquant) sinon throw InvariantViolated('L\'inventaire doit couvrir les 12 typeItems du décret 2015-981 sans doublon').
    - Si `contradictoire === true` ET `dateSignature == null` → throw InvariantViolated('Un EDL contradictoire doit avoir une date de signature').
    - `type ∈ {'entree', 'sortie'}` sinon throw InvariantViolated.
    - id défaut `nouveauEtatDesLieuxId()`.
  - Méthode `annuler(raison: string, annuleLe: Temporal.PlainDate): EtatDesLieux` — copy-on-write soft-delete, pattern Encaissement Phase 2 (throw si déjà annulé).
  - Pas d'invariant cross-aggregate "≤1 EDL entrée par bail" — c'est au use case (D-89).
- `EtatDesLieuxRepository` (port) :
  - `enregistrer(edl: EtatDesLieux): Promise<void>` (upsert par id ; D-89 invariant assuré par use case + index unique partiel).
  - `trouverParId(id: EtatDesLieuxId): Promise<EtatDesLieux | null>`.
  - `trouverActifParBailEtType(bailId: BailId, type: TypeEDL): Promise<EtatDesLieux | null>` — filtre `annule_le IS NULL`.
  - `listerParBail(bailId: BailId): Promise<EtatDesLieux[]>` — inclut annulés (pour audit), trié `cree_le DESC`.
- `Warning` type (`src/domain/locatif/comparer-inventaires.ts`) :
  - `{ code: 'WARNING_ITEM_DISPARU' | 'WARNING_ITEM_DEGRADE', typeItem: TypeItemInventaire, message: string, contexte?: { etatAvant?: EtatItem, etatApres?: EtatItem } }`.
- `comparerInventaires(entree: EtatDesLieux, sortie: EtatDesLieux): Warning[]` — fonction pure :
  - Pour chaque `typeItem` de TYPES_ITEM_INVENTAIRE :
    - `itemEntree = entree.inventaire.find(i => i.typeItem === typeItem)!`
    - `itemSortie = sortie.inventaire.find(i => i.typeItem === typeItem)!`
    - Si `itemEntree.present && !itemSortie.present` → push `WARNING_ITEM_DISPARU` avec message UI-SPEC exact (`'${LABELS_ITEM_INVENTAIRE[typeItem]} : présent à l\'entrée, absent à la sortie. Vérifier une éventuelle retenue sur dépôt de garantie.'`).
    - Si `itemEntree.present && itemSortie.present && etatADegrade(itemEntree.etat, itemSortie.etat)` → push `WARNING_ITEM_DEGRADE` avec message UI-SPEC exact.
    - Sinon ignoré (item absent entrée + présent sortie → ignoré D-101).
- `Bail` étendu (méthode + champ) :
  - `readonly mobilier: ReadonlyArray<InventaireItem>` (défaut `[]`).
  - `Bail.creer({...})` accepte `mobilier?: InventaireItem[]` (defaults `[]`). Pas d'invariant bloquant si vide — c'est `verifierChecklistMobilier()` qui rapporte le warning.
  - `toProps()` propage `mobilier`.
  - Méthode `verifierChecklistMobilier(): { manquants: TypeItemInventaire[]; warning: string | null }` :
    - `if (this.mobilier.length === 0) return { manquants: [...TYPES_ITEM_OBLIGATOIRES], warning: 'Aucun mobilier renseigné — risque maximum de requalification.' };`
    - `const manquants = TYPES_ITEM_OBLIGATOIRES.filter(t => !this.mobilier.some(i => i.typeItem === t && i.present));`
    - `if (manquants.length === 0) return { manquants: [], warning: null };`
    - `else return { manquants, warning: 'Attention : ' + manquants.length + ' élément(s) obligatoire(s) du décret 2015-981 sont marqués absents. Le bail risque d\'être requalifié en bail nu, entraînant un changement de régime fiscal (revenus fonciers au lieu de BIC).' };` (wording exact UI-SPEC D-98).
- `enregistrerEDLEntree(commande, bailRepo, edlRepo): Promise<{ edlId: EtatDesLieuxId, warnings: string[] }>` :
  - Lookup `bail` (throw `BailIntrouvable` si null).
  - Lookup `edlActifEntree = await edlRepo.trouverActifParBailEtType(commande.bailId, 'entree')`.
  - Si non null → throw `EDLEntreeExisteDeja(commande.bailId)`.
  - Construire `inventaire = commande.inventaire.map(i => InventaireItem.creer(i))` (peut throw InvariantViolated).
  - `edl = EtatDesLieux.creer({ bailId, type:'entree', dateEdl, contradictoire, dateSignature, inventaire })`.
  - `await edlRepo.enregistrer(edl)`.
  - `warnings: string[] = []`. Si nombre items obligatoires absents > 0 → push warning D-98 wording UI-SPEC exact "{N} élément(s) du décret 2015-981 absents dans cet inventaire — risque de requalification du bail en bail non meublé.".
  - Return `{ edlId: edl.id, warnings }`.
- `enregistrerEDLSortie(commande, bailRepo, edlRepo): Promise<{ edlId, warnings, deltaWarnings: Warning[] }>` :
  - Lookup bail + EDL actif sortie. Si sortie actif → throw `EDLSortieExisteDeja(bailId)`.
  - Construire inventaire + EDL via `EtatDesLieux.creer({...type:'sortie'})`.
  - `await edlRepo.enregistrer(edl)`.
  - `warnings: string[] = []`.
  - **D-84** : Si `bail.actifDepuis !== null` ET `dateEdl < bail.dateDebut.add({months: bail.dureeMois})` → push 'EDL_SORTIE_AVANT_FIN' avec wording UI-SPEC exact.
  - **D-85** : `entreeActif = await edlRepo.trouverActifParBailEtType(bailId, 'entree')`. Si null → push 'EDL_ENTREE_ABSENT' avec wording UI-SPEC exact + `deltaWarnings: []`. Sinon → `deltaWarnings = comparerInventaires(entreeActif, edl)`.
  - Return `{ edlId, warnings, deltaWarnings }`.
- `BailRepositorySqlite` étendu :
  - À la lecture : `selectFrom('bail')` inclut `mobilier`. Désérialisation : `const mobilier = row.mobilier ? JSON.parse(row.mobilier).map((p: any) => InventaireItem.creer(p)) : [];`. Passer à `Bail.creer({..., mobilier})`.
  - À l'écriture : `mobilier: JSON.stringify(bail.mobilier.map(i => i.toJSON()))` ou `null` si vide.
- `EtatDesLieuxRepositorySqlite` (NOUVEAU) :
  - Pattern QuittanceRepositorySqlite (versDomaine + versRow + upsert via onConflict pour id).
  - Sérialisation `inventaire: JSON.stringify(edl.inventaire.map(i => i.toJSON()))`.
  - Bool SQLite : `contradictoire: edl.contradictoire ? 1 : 0`.
  - Désérialisation `versDomaine` : `const inventaire = JSON.parse(row.inventaire).map((p: any) => InventaireItem.creer(p));` + `contradictoire: row.contradictoire === 1`.
- Routes Fastify (`src/web/routes/etats-des-lieux.ts`) :
  - `GET /baux/:id/edl/entree` : lookup bail + EDL actif entrée. Si EDL → render `pages/baux/edl/entree.ejs` avec `{ bail, edl, helpers }`. Sinon → render avec `edl: null` (empty state CTA).
  - `GET /baux/:id/edl/entree/nouveau` : render `pages/baux/edl/formulaire.ejs` avec `{ type: 'entree', bail, valeurs: {}, erreurs: {}, inventaireDefaut: inventaireCompletPresent() }`.
  - `POST /baux/:id/edl/entree` : safeParse `edlCreationSchema` (utilise normaliserInventaireFormBody). Si !success → re-render. Sinon → `try { const { edlId, warnings } = await enregistrerEDLEntree({...}, bailRepo, edlRepo); req.session.banniereSuccess = 'EDL d\'entrée enregistré.'; if (warnings.length > 0) req.session.banniereWarning = warnings.join(' '); return reply.redirect('/baux/' + id + '/edl/entree'); } catch (err) { ... }`.
  - Routes symétriques pour `/edl/sortie/...`.
- Zod schema `edlCreationSchema` (`src/web/schemas/edl-schemas.ts`) :
  - Body : `{ date_edl: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), contradictoire: z.string().optional().transform(v => v === 'on'), date_signature: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }` + `inventaire: <array via normaliserInventaireFormBody>`.
  - Helper `normaliserInventaireFormBody(body)` : regex `/^inventaire\[(\d+)\]\.(.+)$/` (pattern Phase 1 `normaliserLotsFormBody`). Reconstitue `[{typeItem, present, etat, note}, ...]`.
  - `.superRefine` : si `contradictoire === true` ET `date_signature` absent → addIssue.
- Zod schema `bail-schemas.ts` (ÉTENDRE pour le mobilier) :
  - Ajouter `mobilier: z.array(z.string()).default([])` (les checkboxes cochées arrivent comme array de TypeItemInventaire strings ; les non cochées = absentes). Helper `mobilierVersInventaireItems(mobilier: string[]): InventaireItem[]` qui itère TYPES_ITEM_INVENTAIRE et pour chaque type, retourne InventaireItem.creer({ typeItem: t, present: mobilier.includes(t), etat: mobilier.includes(t) ? 'bon' : null, note: null }) — D-97 minimaliste (présence seulement, état défaut 'bon' si présent).
- Helpers preHandler :
  - `formaterEtatItem(etat: EtatItem): string` — 'bon'→'Bon', 'moyen'→'Moyen', 'degrade'→'Dégradé', null→'—'.
  - `formaterTypeItemInventaire(type: TypeItemInventaire): string` — `return LABELS_ITEM_INVENTAIRE[type];`.
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Tests rouges Wave 0 — InventaireItem + EtatDesLieux + comparerInventaires + Bail.verifierChecklistMobilier + enregistrerEDL + helpers + integration + BDD LOC-03/LOC-06</name>
  <read_first>
    - src/domain/locatif/cautionnement.ts (analog VO + toJSON serialisation)
    - src/domain/locatif/bail.ts (état actuel après 02-01 — extension mobilier nécessaire)
    - src/domain/encaissements/encaissement.ts (analog soft-delete annuleLe + raisonAnnulation)
    - src/domain/_shared/identifiants.ts (analog brand id pattern)
    - tests/_builders/locatif.ts (analog unBailValide à étendre, ajouter inventaire builders)
    - tests/unit/locatif/cautionnement.test.ts (analog VO test + serialisation)
    - tests/unit/locatif/bail.test.ts (analog Bail factory test)
    - tests/integration/repositories/bail-repository-sqlite.test.ts (analog roundtrip + JSON Cautionnement)
    - tests/bdd/features/quittancement.feature (analog tag isolation + Before/After)
    - LOCATION_MEUBLEE_REGLES.md §2 (liste exhaustive des 12 items obligatoires décret 2015-981)
    - LOCATION_MEUBLEE_REGLES.md §6 (EDL contradictoire loi 89 art. 3-2)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : inventaire-item.ts + etat-des-lieux.ts + comparer-inventaires + bail.ts modifié + etat-des-lieux-repository-sqlite + enregistrer-edl + edl-schemas)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md (sections : §LOC-03 §LOC-06 §New Partials §Forms §Copywriting messages exacts D-98 / D-85 / D-84 / WARNING_ITEM_DISPARU / WARNING_ITEM_DEGRADE)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-81, D-82, D-83, D-84, D-85, D-86, D-87, D-88, D-89, D-97, D-98, D-99, D-100, D-101)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-01-diagnostics-PLAN.md (réutilisation Cucumber World monde-phase3.ts)
  </read_first>
  <behavior>
    - T1 inventaire-item.test : `InventaireItem.creer({ typeItem: 'literie', present: true, etat: 'bon', note: null })` → ne throw pas, retourne VO.
    - T2 inventaire-item.test : `InventaireItem.creer({ typeItem: 'literie', present: false, etat: null, note: null })` → ne throw pas (absent → état null OK).
    - T3 inventaire-item.test : `InventaireItem.creer({ typeItem: 'literie', present: true, etat: null, note: null })` → throw InvariantViolated('L\'état est requis si l\'item est présent').
    - T4 inventaire-item.test : `InventaireItem.creer({ typeItem: 'xyz' as TypeItemInventaire, present: true, etat: 'bon', note: null })` → throw InvariantViolated (type hors enum).
    - T5 inventaire-item.test : `LABELS_ITEM_INVENTAIRE['literie']` est une string non vide pour les 12 typeItems (test itératif sur TYPES_ITEM_INVENTAIRE).
    - T6 inventaire-item.test : `TYPES_ITEM_INVENTAIRE.length === 12` ET pas de doublon ET strictement aligné LOCATION_MEUBLEE_REGLES.md §2 lignes 13-28 (décret 2015-981) — vérifie chacun des 12 atomic items présent : 'literie', 'volets_occultants', 'plaques_cuisson', 'four_micro_ondes', 'refrigerateur_congelateur', 'vaisselle', 'ustensiles', 'table', 'sieges', 'etageres', 'luminaires', 'materiel_entretien'. AUCUNE fusion (vaisselle ≠ ustensiles, table ≠ sieges) AUCUNE invention (cuisine_evier et chauffage_eau_chaude REJETÉS — pas dans le décret). Lock revision iter 1 BLOCKER 1.
    - T7 inventaire-item.test : `etatADegrade('bon', 'moyen') === true`, `etatADegrade('bon', 'degrade') === true`, `etatADegrade('moyen', 'degrade') === true`, `etatADegrade('bon', 'bon') === false`, `etatADegrade('degrade', 'bon') === false` (amélioration), `etatADegrade('moyen', 'moyen') === false`, `etatADegrade(null, 'bon') === false`.
    - T8 inventaire-item.test : `inventaireVidePour(TYPES_ITEM_INVENTAIRE).length === 12` ET tous `present: false`, `etat: null`.
    - T9 inventaire-item.test : `inventaireCompletPresent().length === 12` ET tous `present: true`, `etat: 'bon'`.
    - T10 inventaire-item.test : `item.toJSON()` retourne `{ typeItem, present, etat, note }` (forme plate).
    - T11 etat-des-lieux.test : `EtatDesLieux.creer({...inventaire: inventaireCompletPresent()})` → ne throw pas.
    - T12 etat-des-lieux.test : `EtatDesLieux.creer({...inventaire: [item1, item2]})` (length !== 12) → throw InvariantViolated.
    - T13 etat-des-lieux.test : `EtatDesLieux.creer({...inventaire: [item1, item1, ...11 autres]})` (doublon) → throw InvariantViolated.
    - T14 etat-des-lieux.test : `EtatDesLieux.creer({...contradictoire: true, dateSignature: null})` → throw InvariantViolated('Un EDL contradictoire doit avoir une date de signature').
    - T15 etat-des-lieux.test : `EtatDesLieux.creer({...contradictoire: true, dateSignature: PlainDate})` → ne throw pas.
    - T16 etat-des-lieux.test : `EtatDesLieux.creer({...contradictoire: false, dateSignature: null})` → ne throw pas (procédure huissier).
    - T17 etat-des-lieux.test : `EtatDesLieux.creer({...type: 'invalid' as TypeEDL})` → throw InvariantViolated.
    - T18 etat-des-lieux.test : `edl.annuler('Erreur saisie', PlainDate)` → retourne EDL avec annuleLe + raisonAnnulation set.
    - T19 etat-des-lieux.test : `edlDejaAnnule.annuler(...)` → throw InvariantViolated('Cet état des lieux est déjà annulé').
    - T20 comparer-inventaires.test : 2 EDL identiques (12 items présents état bon) → [] vide.
    - T21 comparer-inventaires.test : item literie présent entrée + absent sortie → 1 WARNING_ITEM_DISPARU avec typeItem='literie' + message contenant 'Literie' + 'présent à l\'entrée, absent à la sortie'.
    - T22 comparer-inventaires.test : item literie présent bon entrée + présent dégradé sortie → 1 WARNING_ITEM_DEGRADE avec contexte etatAvant='bon' etatApres='degrade'.
    - T23 comparer-inventaires.test : item literie absent entrée + présent bon sortie → 0 warning (ignoré, D-101).
    - T24 comparer-inventaires.test : item literie présent moyen entrée + présent bon sortie (amélioration) → 0 warning (etatADegrade retourne false).
    - T25 comparer-inventaires.test : 3 items dégradés simultanément → 3 warnings dans l'ordre TYPES_ITEM_INVENTAIRE.
    - T26 bail-mobilier.test : `Bail.creer({...mobilier: []})` → ne throw pas (champ optionnel).
    - T27 bail-mobilier.test : `Bail.creer({...mobilier: inventaireCompletPresent()})` → ne throw pas, `bail.mobilier.length === 12`.
    - T28 bail-mobilier.test : `bail.verifierChecklistMobilier()` quand `mobilier = []` → `{ manquants: [...12], warning: 'Aucun mobilier renseigné — risque maximum de requalification.' }`.
    - T29 bail-mobilier.test : `bail.verifierChecklistMobilier()` quand `mobilier = inventaireCompletPresent()` → `{ manquants: [], warning: null }`.
    - T30 bail-mobilier.test : `bail.verifierChecklistMobilier()` quand 11/12 items `present:true` + 1 `present:false` → `{ manquants: [le 1], warning: 'Attention : 1 élément(s) obligatoire(s) du décret 2015-981 sont marqués absents. Le bail risque d\'être requalifié en bail nu, entraînant un changement de régime fiscal (revenus fonciers au lieu de BIC).' }` (wording exact UI-SPEC).
    - T31 bail-mobilier.test : `bail.modifier({mobilier: nouveauMobilier})` → copy-on-write propage.
    - T32 enregistrer-edl.test : `enregistrerEDLEntree({bailId, dateEdl, contradictoire:true, dateSignature:PlainDate, inventaire:inventaireCompletPresent()}, bailRepo, edlRepo)` (bail existe, pas d'EDL entrée actif) → retourne `{edlId, warnings: []}`, edlRepo.enregistrer appelé 1×.
    - T33 enregistrer-edl.test : bailId inexistant → throw BailIntrouvable.
    - T34 enregistrer-edl.test : EDL entrée actif déjà existe → throw EDLEntreeExisteDeja.
    - T35 enregistrer-edl.test : EDL entrée avec 5 items obligatoires absents → warnings contient le message D-98 wording UI-SPEC "5 élément(s) du décret 2015-981 absents dans cet inventaire — risque de requalification du bail en bail non meublé." MAIS use case ne throw pas (non bloquant).
    - T36 enregistrer-edl-sortie.test : EDL sortie sans EDL entrée actif → `warnings` contient 'Pas d\'EDL d\'entrée enregistré pour ce bail — la comparaison entrée/sortie ne sera pas possible et la retenue sur dépôt sera plus difficile à justifier.' (wording UI-SPEC D-85 exact) + `deltaWarnings: []`.
    - T37 enregistrer-edl-sortie.test : EDL sortie avec EDL entrée actif présent → `deltaWarnings = comparerInventaires(entree, sortie)` (mockable, peut être [] si identiques).
    - T38 enregistrer-edl-sortie.test : EDL sortie avec `dateEdl < bail.dateDebut + bail.dureeMois` (bail 12 mois début 2026-01-01, dateEdl 2026-05-01) → warnings contient 'EDL de sortie enregistré avant la fin officielle du bail ({date_fin}) — vérifiez que vous avez bien la situation réelle.' (wording UI-SPEC D-84 exact).
    - T39 format-etat-item.test : 'bon'→'Bon', 'moyen'→'Moyen', 'degrade'→'Dégradé', null→'—'.
    - T40 format-type-item-inventaire.test : 12 cas pour les 12 typeItems (libellés français exacts LOCATION_MEUBLEE_REGLES.md §2) — chacun des 12 atomic items du décret 2015-981 (literie → materiel_entretien) doit avoir une assertion dédiée vérifiant le wording legal-faithful défini dans LABELS_ITEM_INVENTAIRE.
    - T41 integration etat-des-lieux-repo : roundtrip EDL via SQLite (12 items dans inventaire JSON, contradictoire bool 1/0, dateSignature optionnelle).
    - T42 integration etat-des-lieux-repo : `trouverActifParBailEtType(bailId, 'entree')` retourne le seul EDL entrée non annulé. Si 2 EDL entrée (1 annulé + 1 actif) → retourne l'actif.
    - T43 integration etat-des-lieux-repo : INSERT 2 EDL entrée non annulés → throw violation UNIQUE INDEX `idx_edl_bail_type_actif`.
    - T44 integration etat-des-lieux-repo : Soft-delete d'un EDL puis INSERT nouvel EDL même bail/type → OK (l'unique partial s'applique seulement aux non-annulés).
    - T45 integration bail-repository-sqlite-mobilier : roundtrip Bail avec `mobilier: inventaireCompletPresent()` → bail.mobilier identique après save+load.
    - T46 BDD @loc-03 "EDL entrée + sortie sans warning delta" : Given Bail activé, ClockFixe. When POST /baux/:id/edl/entree avec 12 items bon + contradictoire + dateSignature, puis POST /baux/:id/edl/sortie avec 12 items bon + contradictoire + dateSignature. Then 2 rows etat_des_lieux en DB, page /baux/:id/edl/sortie n'affiche AUCUN delta warning.
    - T47 BDD @loc-03 "Invariant ≤1 EDL entrée par bail" : Given EDL entrée déjà enregistré. When POST /baux/:id/edl/entree (2e tentative). Then status 200 avec banniereWarning "Un EDL d'entrée existe déjà pour ce bail." OU re-render formulaire avec erreur, DB contient toujours 1 seul EDL entrée actif.
    - T48 BDD @loc-03 "EDL sortie sans EDL entrée → warning non bloquant" : Given Bail activé sans EDL entrée. When POST /baux/:id/edl/sortie complet. Then redirect /baux/:id/edl/sortie avec banniereWarning contenant 'Pas d\'EDL d\'entrée enregistré', DB contient l'EDL sortie (création réussie, warning informatif uniquement).
    - T49 BDD @loc-03 "Delta inventaire — items disparu + dégradé" : Given EDL entrée 12 items bon, EDL sortie avec literie absent + plaques_cuisson dégradé. When GET /baux/:id/edl/sortie. Then la page contient 2 warnings : 'Literie : présent à l\'entrée, absent à la sortie' + 'Plaques de cuisson : état bon à l\'entrée → dégradé à la sortie'.
    - T50 BDD @loc-03 "Soft-delete EDL + ré-enregistrement" : Given EDL entrée actif. When POST /baux/:id/edl/entree/:edlId/annuler avec raison, puis POST /baux/:id/edl/entree (nouveau). Then DB contient 2 rows EDL entrée (1 annulé + 1 actif), `trouverActifParBailEtType` retourne le nouveau.
    - T51 BDD @loc-06 "Mobilier complet à la création Bail → 0 warning" : When POST /baux avec champs requis + 12 checkboxes mobilier cochées. Then redirect /baux/:id sans banniereWarning, DB bail.mobilier contient 12 items présents.
    - T52 BDD @loc-06 "Mobilier incomplet à la création Bail → warning non bloquant" : When POST /baux avec 11 checkboxes cochées (literie décochée). Then redirect /baux/:id avec banniereWarning contenant 'Attention : 1 élément(s) obligatoire(s) du décret 2015-981', DB bail créé quand même (présence de l'item literie=false), warning préservé via session.
    - T53 BDD @loc-06 "Edition Bail mobilier" : Given Bail existant avec mobilier complet. When POST /baux/:id avec 10 items cochés. Then DB bail.mobilier mis à jour (12 items, 10 présent + 2 absent), banniereWarning affiché sur fiche.
  </behavior>
  <action>
    TDD outside-in. Créer EXCLUSIVEMENT les tests (rouges).

    1. ÉTENDRE `tests/_builders/locatif.ts` :
       - `unInventaireItemValide(overrides = {})` : defaults `typeItem: 'literie'`, `present: true`, `etat: 'bon'`, `note: null`.
       - `inventaire12ItemsPresentsBon(): InventaireItem[]` : retourne `inventaireCompletPresent()`.
       - `inventaire12ItemsVides(): InventaireItem[]` : retourne `inventaireVidePour(TYPES_ITEM_INVENTAIRE)`.
       - `unEtatDesLieuxEntreeValide(overrides = {})` : defaults `bailId: nouveauBailId()`, `type: 'entree'`, `dateEdl: PlainDate.from('2026-05-01')`, `contradictoire: true`, `dateSignature: PlainDate.from('2026-05-01')`, `inventaire: inventaire12ItemsPresentsBon()`.
       - `unEtatDesLieuxSortieValide(overrides = {})` : idem `type: 'sortie'`, `dateEdl: PlainDate.from('2027-05-01')`.
       - ÉTENDRE `unBailValide(overrides = {})` : accepter `overrides.mobilier` (default `[]`).

    2. `tests/unit/_shared/inventaire-item.test.ts` (NOUVEAU) : T1-T10.

    3. `tests/unit/locatif/etat-des-lieux.test.ts` (NOUVEAU) : T11-T19.

    4. `tests/unit/locatif/comparer-inventaires.test.ts` (NOUVEAU) : T20-T25.

    5. `tests/unit/locatif/bail-mobilier.test.ts` (NOUVEAU) : T26-T31.

    6. `tests/unit/locatif/enregistrer-edl.test.ts` (NOUVEAU) : T32-T38. Mocker `bailRepo.trouverParId` + `edlRepo.trouverActifParBailEtType` + `edlRepo.enregistrer` (stubs manuels ou vitest mock).

    7. `tests/unit/helpers/format-etat-item.test.ts` (NOUVEAU) : T39.

    8. `tests/unit/helpers/format-type-item-inventaire.test.ts` (NOUVEAU) : T40.

    9. `tests/integration/repositories/etat-des-lieux-repository-sqlite.test.ts` (NOUVEAU) : T41-T44. Migrations 0001..0008 enchaînées.

    10. `tests/integration/repositories/bail-repository-sqlite-mobilier.test.ts` (NOUVEAU) : T45 (un test focalisé mobilier — le reste du roundtrip Bail est déjà couvert Phase 1).

    11. `tests/bdd/features/edl.feature` (NOUVEAU) : 5 scenarios tag `@loc-03 @phase3` (T46-T50).

    12. `tests/bdd/features/checklist-mobilier.feature` (NOUVEAU) : 3 scenarios tag `@loc-06 @phase3` (T51-T53).

    13. `tests/bdd/step_definitions/edl.steps.ts` (NOUVEAU) : Before/After `@loc-03` (réutilise `MondePhase3` créé 03-01, Cucumber World). Steps Given/When/Then propres aux scenarios EDL.

    14. `tests/bdd/step_definitions/checklist-mobilier.steps.ts` (NOUVEAU) : Before/After `@loc-06`. Steps mobilier + assertions DB sur `bail.mobilier`.

    Tests ÉCHOUENT. Commit : `test(03-02): tests rouges InventaireItem + EtatDesLieux + comparerInventaires + Bail.mobilier + enregistrerEDL + helpers + LOC-03 + LOC-06 (Wave 0)`.
  </action>
  <verify>
    <automated>pnpm test 2>&1 | grep -E "FAIL|fail" | head -30 && ls tests/unit/_shared/inventaire-item.test.ts tests/unit/locatif/etat-des-lieux.test.ts tests/unit/locatif/comparer-inventaires.test.ts tests/unit/locatif/bail-mobilier.test.ts tests/unit/locatif/enregistrer-edl.test.ts tests/unit/helpers/format-etat-item.test.ts tests/unit/helpers/format-type-item-inventaire.test.ts tests/integration/repositories/etat-des-lieux-repository-sqlite.test.ts tests/integration/repositories/bail-repository-sqlite-mobilier.test.ts tests/bdd/features/edl.feature tests/bdd/features/checklist-mobilier.feature</automated>
  </verify>
  <done>
    - Tests Wave 0 rouges : 9 fichiers unit/integration + 2 features BDD + 2 steps + builders étendus.
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Domaine (InventaireItem + EtatDesLieux + comparerInventaires + Bail étendu) + adapters SQLite + use cases + migration 0008 + helpers (passer unit + integration au vert)</name>
  <read_first>
    - src/domain/locatif/cautionnement.ts (analog toJSON + sérialisation JSON inline)
    - src/domain/locatif/bail.ts (état actuel — copy-on-write toProps pattern + invariants existants)
    - src/domain/encaissements/encaissement.ts (analog soft-delete annuler() + raisonAnnulation)
    - src/domain/_shared/identifiants.ts (pattern brand id — où ajouter EtatDesLieuxId)
    - src/infrastructure/repositories/bail-repository-sqlite.ts (analog JSON inline Cautionnement + roundtrip — où ajouter mobilier)
    - src/infrastructure/repositories/encaissement-repository-sqlite.ts (analog adapter pattern + onConflict pour upsert)
    - src/infrastructure/db/kysely-types.ts (où ajouter EtatDesLieuxTable + ALTER BailTable)
    - src/infrastructure/db/database.ts (migrations exec)
    - src/application/encaissements/activer-bail.ts (analog use case multi-repos + invariant cross-aggregate)
    - LOCATION_MEUBLEE_REGLES.md §2 (liste exhaustive 12 items obligatoires — CRITIQUE pour TypeItemInventaire enum)
    - LOCATION_MEUBLEE_REGLES.md §6 (EDL contradictoire loi 89 art. 3-2)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : inventaire-item + etat-des-lieux + bail-indexation analog soft-delete + bail.ts modifié + etat-des-lieux-repository-sqlite + comparer-inventaires + enregistrer-edl + migration 0007)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-CONTEXT.md (D-81 à D-101)
    - Tests rouges Task 1
  </read_first>
  <action>
    Créer/modifier dans cet ordre :

    1. `migrations/0008_phase3_edl.sql` :
       - En-tête : commentaires alignés sur 0007_phase3_diagnostics.sql.
       - `BEGIN TRANSACTION;`
       - `ALTER TABLE bail ADD COLUMN mobilier TEXT NULL;` -- D-97 JSON array d'InventaireItem (Bail crée Phase 1, étendu Phase 2 avec actif_depuis + jour_echeance, étendu Phase 3 avec mobilier).
       - `CREATE TABLE IF NOT EXISTS etat_des_lieux ( id TEXT PRIMARY KEY, bail_id TEXT NOT NULL REFERENCES bail(id), type TEXT NOT NULL CHECK (type IN ('entree','sortie')), date_edl TEXT NOT NULL, contradictoire INTEGER NOT NULL DEFAULT 0, date_signature TEXT NULL, inventaire TEXT NOT NULL, annule_le DATETIME NULL, raison_annulation TEXT NULL, cree_le DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP );` — D-82, D-86.
       - `CREATE INDEX IF NOT EXISTS idx_edl_bail ON etat_des_lieux(bail_id);`
       - `CREATE UNIQUE INDEX IF NOT EXISTS idx_edl_bail_type_actif ON etat_des_lieux(bail_id, type) WHERE annule_le IS NULL;` — D-89 invariant DB-level (≤1 EDL actif par (bail, type)).
       - `COMMIT;`

    2. `src/infrastructure/db/kysely-types.ts` :
       - Étendre `BailTable` avec `mobilier: string | null` (JSON sérialisé).
       - Ajouter `EtatDesLieuxTable { id: string; bail_id: string; type: 'entree' | 'sortie'; date_edl: string; contradictoire: 0 | 1; date_signature: string | null; inventaire: string; annule_le: string | null; raison_annulation: string | null; cree_le: string }` + ajouter `etat_des_lieux: EtatDesLieuxTable` à `DB`.

    3. `src/domain/_shared/identifiants.ts` (ÉTENDRE) :
       - Ajouter `EtatDesLieuxId = string & { readonly __brand: 'EtatDesLieuxId' }`.
       - Ajouter `nouveauEtatDesLieuxId(): EtatDesLieuxId`.

    4. `src/domain/_shared/inventaire-item.ts` (NOUVEAU) :
       - Imports : `InvariantViolated`.
       - Types : `TypeItemInventaire` — UNION EXACTE des 12 valeurs atomiques :
         `'literie' | 'volets_occultants' | 'plaques_cuisson' | 'four_micro_ondes' | 'refrigerateur_congelateur' | 'vaisselle' | 'ustensiles' | 'table' | 'sieges' | 'etageres' | 'luminaires' | 'materiel_entretien'` (décret 2015-981, LOCATION_MEUBLEE_REGLES.md lignes 13-28 — AUTHORITATIVE, ne PAS inventer ni fusionner, lock revision iter 1 BLOCKER 1).
       - `LABELS_ITEM_INVENTAIRE: Record<TypeItemInventaire, string>` — libellés français legal-faithful exacts (1:1 avec décret 2015-981) :
         `{ literie: 'Literie avec couette ou couverture', volets_occultants: 'Dispositif d\'occultation des fenêtres (chambres)', plaques_cuisson: 'Plaques de cuisson', four_micro_ondes: 'Four ou four à micro-ondes', refrigerateur_congelateur: 'Réfrigérateur et congélateur (ou compartiment freezer ≤ -6 °C)', vaisselle: 'Vaisselle nécessaire à la prise des repas', ustensiles: 'Ustensiles de cuisine', table: 'Table', sieges: 'Sièges', etageres: 'Étagères de rangement', luminaires: 'Luminaires', materiel_entretien: 'Matériel d\'entretien ménager adapté au logement' }`.
       - `TYPES_ITEM_INVENTAIRE: TypeItemInventaire[]` — array énumérant les 12 dans l'ordre canonique du décret 2015-981 (literie → materiel_entretien comme ci-dessus).
       - `TYPES_ITEM_OBLIGATOIRES: TypeItemInventaire[]` — V1 = `[...TYPES_ITEM_INVENTAIRE]` (les 12 sont tous obligatoires).
       - `EtatItem = 'bon' | 'moyen' | 'degrade' | null`.
       - `ETATS_VALIDES: EtatItem[] = ['bon', 'moyen', 'degrade', null];`
       - Interface `InventaireItemProps { typeItem: TypeItemInventaire; present: boolean; etat: EtatItem; note: string | null }`.
       - Classe `InventaireItem` readonly props + private constructor + `static creer(props): InventaireItem` :
         - Valide `TYPES_ITEM_INVENTAIRE.includes(typeItem)` sinon throw InvariantViolated('Type d\'item d\'inventaire invalide : "${typeItem}"').
         - Valide `ETATS_VALIDES.includes(etat)` sinon throw InvariantViolated('État d\'item invalide : "${etat}"').
         - Si `present === true` ET `etat === null` → throw InvariantViolated('L\'état est requis si l\'item est présent').
         - Si `present === false` ET `etat !== null` → tolérer mais set `etat=null` en interne pour cohérence (sémantique : item absent ⇒ état non pertinent ; pas d'invariant strict pour éviter les erreurs UI si le user décoche après avoir rempli un état). Lock revision iter 1 warning 7.
         - Retourne `new InventaireItem({ typeItem, present, etat: present ? etat : null, note: note ?? null })`.
       - Méthode `toJSON()` : `{ typeItem: this.typeItem, present: this.present, etat: this.etat, note: this.note }`.
       - Fonction exportée `etatADegrade(avant: EtatItem, apres: EtatItem): boolean` :
         - Si `avant === null || apres === null` → false.
         - Map `RANG_ETAT = { bon: 0, moyen: 1, degrade: 2 }`.
         - Retourne `RANG_ETAT[apres] > RANG_ETAT[avant]`.
       - Fonction exportée `inventaireVidePour(types: TypeItemInventaire[]): InventaireItem[]` — itère types, retourne `InventaireItem.creer({ typeItem: t, present: false, etat: null, note: null })`.
       - Fonction exportée `inventaireCompletPresent(): InventaireItem[]` — itère TYPES_ITEM_INVENTAIRE, retourne `InventaireItem.creer({ typeItem: t, present: true, etat: 'bon', note: null })`.
       - JSDoc précisant source juridique : "Conforme décret n°2015-981 du 31/07/2015 + LOCATION_MEUBLEE_REGLES.md §2. Revue annuelle si décret modifié (R1.1 RISKS.md)."

    5. `src/domain/locatif/erreurs.ts` (ÉTENDRE) :
       - Ajouter `EtatDesLieuxIntrouvable`, `EDLEntreeExisteDeja(bailId)`, `EDLSortieExisteDeja(bailId)`, `EDLDejaAnnule`. Pattern existant `BailIntrouvable`.

    6. `src/domain/locatif/etat-des-lieux.ts` (NOUVEAU) :
       - Imports : `Temporal`, `InvariantViolated`, brand ids, `InventaireItem`, `TYPES_ITEM_INVENTAIRE`, erreurs locales.
       - `TypeEDL = 'entree' | 'sortie';`
       - Interface `EtatDesLieuxProps { id?: EtatDesLieuxId; bailId: BailId; type: TypeEDL; dateEdl: Temporal.PlainDate; contradictoire: boolean; dateSignature: Temporal.PlainDate | null; inventaire: InventaireItem[]; annuleLe?: Temporal.PlainDate | null; raisonAnnulation?: string | null }`.
       - Classe `EtatDesLieux` readonly + `static creer(props)` :
         - Valide `type ∈ {'entree', 'sortie'}` sinon InvariantViolated.
         - Valide `inventaire.length === 12` sinon InvariantViolated('L\'inventaire doit contenir exactement les 12 items du décret 2015-981').
         - Valide `new Set(inventaire.map(i => i.typeItem)).size === 12 && inventaire.every(i => TYPES_ITEM_INVENTAIRE.includes(i.typeItem))` sinon InvariantViolated('L\'inventaire doit couvrir les 12 typeItems du décret 2015-981 sans doublon').
         - Si `contradictoire === true` ET `dateSignature == null` → InvariantViolated('Un EDL contradictoire doit avoir une date de signature').
         - id défaut `nouveauEtatDesLieuxId()`.
       - `toProps()` propage tous les champs.
       - Méthode `annuler(raison, annuleLe): EtatDesLieux` — pattern Encaissement (throw `EDLDejaAnnule` si annuleLe != null).

    7. `src/domain/locatif/etat-des-lieux-repository.ts` (NOUVEAU port) :
       - `export interface EtatDesLieuxRepository { enregistrer(edl: EtatDesLieux): Promise<void>; trouverParId(id: EtatDesLieuxId): Promise<EtatDesLieux | null>; trouverActifParBailEtType(bailId: BailId, type: TypeEDL): Promise<EtatDesLieux | null>; listerParBail(bailId: BailId): Promise<EtatDesLieux[]> }`.

    8. `src/domain/locatif/comparer-inventaires.ts` (NOUVEAU domain service) :
       - Imports : `EtatDesLieux`, `InventaireItem`, `TypeItemInventaire`, `TYPES_ITEM_INVENTAIRE`, `LABELS_ITEM_INVENTAIRE`, `etatADegrade`.
       - `export type Warning = { code: 'WARNING_ITEM_DISPARU' | 'WARNING_ITEM_DEGRADE'; typeItem: TypeItemInventaire; message: string; contexte?: { etatAvant?: EtatItem; etatApres?: EtatItem } };`
       - `export const WARNING_ITEM_DISPARU = 'WARNING_ITEM_DISPARU';` `export const WARNING_ITEM_DEGRADE = 'WARNING_ITEM_DEGRADE';`
       - `export function comparerInventaires(entree: EtatDesLieux, sortie: EtatDesLieux): Warning[]` :
         - `const warnings: Warning[] = [];`
         - `for (const typeItem of TYPES_ITEM_INVENTAIRE) { const itemEntree = entree.inventaire.find(i => i.typeItem === typeItem)!; const itemSortie = sortie.inventaire.find(i => i.typeItem === typeItem)!; if (itemEntree.present && !itemSortie.present) { warnings.push({ code: 'WARNING_ITEM_DISPARU', typeItem, message: LABELS_ITEM_INVENTAIRE[typeItem] + ' : présent à l\'entrée, absent à la sortie. Vérifier une éventuelle retenue sur dépôt de garantie.' }); } else if (itemEntree.present && itemSortie.present && etatADegrade(itemEntree.etat, itemSortie.etat)) { warnings.push({ code: 'WARNING_ITEM_DEGRADE', typeItem, message: LABELS_ITEM_INVENTAIRE[typeItem] + ' : état ' + itemEntree.etat + ' à l\'entrée → ' + itemSortie.etat + ' à la sortie. Vérifier une éventuelle retenue sur dépôt de garantie.', contexte: { etatAvant: itemEntree.etat, etatApres: itemSortie.etat } }); } }`
         - `return warnings;`
       - 100% couverture (logique métier D-101).

    9. `src/domain/locatif/bail.ts` (MODIFIER) :
       - Étendre `BailProps` avec `mobilier?: InventaireItem[]` (défaut `[]`).
       - Étendre `ModifierBailPatch` avec `mobilier?: InventaireItem[]`.
       - Étendre `Bail` classe : `readonly mobilier: ReadonlyArray<InventaireItem>` (constructeur : `Object.freeze([...(props.mobilier ?? [])])`).
       - `Bail.creer()` : pas d'invariant bloquant sur mobilier (LOC-06 D-98 = warning, pas erreur). Constructeur initialise.
       - `toProps()` propage `mobilier: [...this.mobilier]`.
       - `modifier(patch)` propage `mobilier: patch.mobilier ?? this.mobilier`.
       - Méthode `verifierChecklistMobilier(): { manquants: TypeItemInventaire[]; warning: string | null }` (wording exact UI-SPEC D-98 — voir <interfaces> ci-dessus).

    10. `src/infrastructure/repositories/bail-repository-sqlite.ts` (MODIFIER) :
        - À l'écriture : ajouter `mobilier: bail.mobilier.length > 0 ? JSON.stringify(bail.mobilier.map(i => i.toJSON())) : null` au values du `insertInto('bail').values({...}).onConflict(...)`.
        - À la lecture : `selectFrom('bail')` inclut `mobilier`. Désérialisation : helper privé `mobilierDepuisJson(json: string | null): InventaireItem[]` qui `JSON.parse + .map(InventaireItem.creer)` ou `[]` si null. Passer à `Bail.creer({...mobilier})`.

    11. `src/infrastructure/repositories/etat-des-lieux-repository-sqlite.ts` (NOUVEAU) :
        - Class `EtatDesLieuxRepositorySqlite` implements `EtatDesLieuxRepository` avec constructor(db: Kysely<DB>).
        - `enregistrer(edl)` : `await this.db.insertInto('etat_des_lieux').values({ id: edl.id, bail_id: edl.bailId, type: edl.type, date_edl: edl.dateEdl.toString(), contradictoire: edl.contradictoire ? 1 : 0, date_signature: edl.dateSignature?.toString() ?? null, inventaire: JSON.stringify(edl.inventaire.map(i => i.toJSON())), annule_le: edl.annuleLe?.toString() ?? null, raison_annulation: edl.raisonAnnulation ?? null }).onConflict(oc => oc.column('id').doUpdateSet({ annule_le: edl.annuleLe?.toString() ?? null, raison_annulation: edl.raisonAnnulation ?? null })).execute();`
        - `trouverParId(id)` : standard.
        - `trouverActifParBailEtType(bailId, type)` : `selectFrom('etat_des_lieux').selectAll().where('bail_id', '=', bailId).where('type', '=', type).where('annule_le', 'is', null).executeTakeFirst();` puis `versDomaine`.
        - `listerParBail(bailId)` : sans filtre annule_le (inclut annulés pour audit), order `cree_le DESC`.
        - `versDomaine(row)` : reconstruit `EtatDesLieux.creer({...inventaire: JSON.parse(row.inventaire).map(p => InventaireItem.creer(p)), contradictoire: row.contradictoire === 1, dateSignature: row.date_signature ? Temporal.PlainDate.from(row.date_signature) : null, annuleLe: row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null, raisonAnnulation: row.raison_annulation})`.

    12. `src/application/locatif/enregistrer-edl-entree.ts` (NOUVEAU) :
        - Voir signature dans <interfaces>. Lookup bail + invariant cross-aggregate + InventaireItem.creer + EtatDesLieux.creer + edlRepo.enregistrer + warning si items obligatoires absents (compte les `mobilier obligatoire avec present=false` dans l'inventaire).
        - Wording warning exact UI-SPEC D-98 EDL entrée : '{N} élément(s) du décret 2015-981 absents dans cet inventaire — risque de requalification du bail en bail non meublé.'

    13. `src/application/locatif/enregistrer-edl-sortie.ts` (NOUVEAU) :
        - Lookup bail + invariant + InventaireItem.creer + EtatDesLieux.creer + enregistrer.
        - Warning D-84 si dateEdl < bail.dateDebut + bail.dureeMois.
        - Warning D-85 si pas d'EDL entrée actif.
        - Sinon `deltaWarnings = comparerInventaires(entreeActif, edlSortie)`.

    14. `src/application/locatif/lister-edl.ts` (NOUVEAU) :
        - `export async function listerEDL(bailId, edlRepo): Promise<{ entree: EtatDesLieux | null, sortie: EtatDesLieux | null }>` : lookup les 2 actifs en parallèle, retourne tuple.

    15. `src/helpers/format-etat-item.ts` (NOUVEAU) :
        - `import type { EtatItem } from '../domain/_shared/inventaire-item.js';`
        - `const LABELS_ETAT: Record<Exclude<EtatItem, null>, string> = { bon: 'Bon', moyen: 'Moyen', degrade: 'Dégradé' };`
        - `export function formaterEtatItem(etat: EtatItem): string { return etat === null ? '—' : LABELS_ETAT[etat]; }`

    16. `src/helpers/format-type-item-inventaire.ts` (NOUVEAU) :
        - `import { LABELS_ITEM_INVENTAIRE, type TypeItemInventaire } from '../domain/_shared/inventaire-item.js';`
        - `export function formaterTypeItemInventaire(type: TypeItemInventaire): string { return LABELS_ITEM_INVENTAIRE[type]; }`

    17. ÉTENDRE `src/main.ts` :
        - Imports : `EtatDesLieuxRepositorySqlite`, `plugin as etatsDesLieuxPlugin`, `formaterEtatItem`, `formaterTypeItemInventaire`.
        - Instancier `const edlRepo = new EtatDesLieuxRepositorySqlite(db);`.
        - Hook preHandler : injecter les 2 nouveaux helpers dans `reply.locals`.
        - Register plugin (sera fait Task 3).

    Vérifs : `pnpm tsc --noEmit` 0. `pnpm lint:deps` 0 (domaine pur). Tests unit + integration verts.

    Commit : `feat(03-02): InventaireItem + EtatDesLieux + comparerInventaires + Bail.mobilier + repo SQLite + use cases + migration 0008 (LOC-03 + LOC-06 domain)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint:deps && pnpm test:unit run tests/unit/_shared/inventaire-item.test.ts tests/unit/locatif/etat-des-lieux.test.ts tests/unit/locatif/comparer-inventaires.test.ts tests/unit/locatif/bail-mobilier.test.ts tests/unit/locatif/enregistrer-edl.test.ts tests/unit/helpers/format-etat-item.test.ts tests/unit/helpers/format-type-item-inventaire.test.ts && pnpm test:integration run tests/integration/repositories/etat-des-lieux-repository-sqlite.test.ts tests/integration/repositories/bail-repository-sqlite-mobilier.test.ts</automated>
  </verify>
  <done>
    - Migration 0008 idempotente avec CREATE etat_des_lieux + UNIQUE INDEX partiel + ALTER bail ADD mobilier.
    - InventaireItem VO + 12 typeItems décret 2015-981 + helpers (etatADegrade, inventaireVidePour, inventaireCompletPresent).
    - EtatDesLieux agrégat + soft-delete annuler() + 12 items strict.
    - comparerInventaires domain service pur 100% couvert.
    - Bail étendu (mobilier + verifierChecklistMobilier).
    - BailRepositorySqlite étendu (mobilier JSON inline).
    - EtatDesLieuxRepositorySqlite nouveau (JSON inventaire, upsert id, lookups).
    - 3 use cases (entree, sortie, lister).
    - 2 helpers preHandler.
    - Tests unit + integration VERTS.
    - Commit créé.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Routes (etats-des-lieux + baux étendu) + schemas Zod + views (formulaire EDL partagé entrée/sortie + section EDL sur fiche Bail + fieldset mobilier sur formulaire Bail + 3 partials) + BDD LOC-03 + LOC-06 verts</name>
  <read_first>
    - src/web/routes/biens.ts (analog plugin Fastify + normaliserLotsFormBody pattern à transposer pour normaliserInventaireFormBody)
    - src/web/routes/baux.ts (analog — sera étendu pour fieldset mobilier dans POST/PUT /baux)
    - src/web/schemas/bien-schemas.ts (analog Zod + normaliserLotsFormBody helper)
    - src/web/schemas/bail-schemas.ts (état actuel — sera étendu pour mobilier)
    - src/web/views/pages/baux/detail.ejs (état actuel — section EDL à ajouter + banner EDL entrée absent)
    - src/web/views/pages/baux/formulaire.ejs (état actuel — fieldset mobilier à insérer)
    - src/web/views/partials/empty-state.ejs (analog CTA empty state)
    - src/web/views/partials/banniere-warning.ejs (warning non bloquant)
    - src/web/views/partials/form-field.ejs (analog input + label)
    - src/web/views/partials/data-table.ejs (analog table — usage potentiel pour liste EDL)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-UI-SPEC.md (sections : §LOC-03 §LOC-06 §New Partials §Forms §Tables §Banners §Copywriting CTAs primaires §Empty States §Route Map)
    - .planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md (sections : routes/etats-des-lieux + edl-schemas + partial-edl-form + partial-inventaire-display + partial-inventaire-warnings + views/baux/edl/*)
    - Tests rouges BDD Task 1
  </read_first>
  <action>
    Créer/modifier :

    1. `src/web/schemas/edl-schemas.ts` (NOUVEAU) :
       - `export const edlCreationSchema = z.object({ date_edl: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date attendu : AAAA-MM-JJ.'), contradictoire: z.string().optional().transform(v => v === 'on'), date_signature: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date attendu : AAAA-MM-JJ.').optional().or(z.literal('')), inventaire: z.array(z.object({ typeItem: z.string(), present: z.string().optional().transform(v => v === 'on'), etat: z.enum(['bon','moyen','degrade']).optional().or(z.literal('')), note: z.string().optional() })) }).superRefine((data, ctx) => { if (data.contradictoire && !data.date_signature) ctx.addIssue({ code: 'custom', path: ['date_signature'], message: 'La date de signature est obligatoire pour un EDL contradictoire.' }); });`
       - `export function normaliserInventaireFormBody(body: Record<string, string | string[]>): unknown[]` : regex `/^inventaire\[(\d+)\]\.(.+)$/` strict ; reconstruit objets `{typeItem, present, etat, note}` triés par index. Pattern strict Phase 1 `normaliserLotsFormBody`.

    2. ÉTENDRE `src/web/schemas/bail-schemas.ts` :
       - Ajouter champ `mobilier: z.union([z.string(), z.array(z.string())]).optional().transform(v => v === undefined ? [] : Array.isArray(v) ? v : [v])` (pattern Phase 1 `lotIds`).
       - Helper `mobilierVersInventaireItems(typesPresents: string[]): InventaireItem[]` qui itère `TYPES_ITEM_INVENTAIRE` et pour chaque type, fait `InventaireItem.creer({ typeItem: t, present: typesPresents.includes(t), etat: typesPresents.includes(t) ? 'bon' : null, note: null })` — D-97 minimaliste.

    3. `src/web/routes/etats-des-lieux.ts` (NOUVEAU) :
       - `export async function plugin(app, opts: { bailRepo, edlRepo }): Promise<void>`.
       - `GET /baux/:id/edl/entree` :
         - Lookup bail (404 si absent).
         - `const edl = await opts.edlRepo.trouverActifParBailEtType(bailId, 'entree');`
         - Render `pages/baux/edl/entree.ejs` avec `{ bail, edl, type: 'entree', navActive: 'baux', breadcrumbs: [...] }`.
       - `GET /baux/:id/edl/entree/nouveau` :
         - Lookup bail (404 si absent).
         - Render `pages/baux/edl/formulaire.ejs` avec `{ bail, type: 'entree', valeurs: { contradictoire: 'on' }, erreurs: {}, inventaireDefaut: inventaireCompletPresent() }` (defaults : 12 items présents bon, contradictoire coché par défaut — Hick's Law).
       - `POST /baux/:id/edl/entree` :
         - `const body = req.body; const inventaireRaw = normaliserInventaireFormBody(body); const parsed = edlCreationSchema.safeParse({ ...body, inventaire: inventaireRaw });`
         - Si !success → re-render formulaire avec erreurs.
         - try `const { edlId, warnings } = await enregistrerEDLEntree({ bailId: id as BailId, dateEdl: PlainDate.from(parsed.data.date_edl), contradictoire: parsed.data.contradictoire, dateSignature: parsed.data.date_signature ? PlainDate.from(parsed.data.date_signature) : null, inventaire: parsed.data.inventaire }, opts.bailRepo, opts.edlRepo);`
         - `req.session.banniereSuccess = 'EDL d\'entrée enregistré.';`
         - `if (warnings.length > 0) req.session.banniereWarning = warnings.join(' ');`
         - redirect `/baux/${id}/edl/entree`.
         - Catch `EDLEntreeExisteDeja` → re-render formulaire avec erreur "Un EDL d'entrée existe déjà pour ce bail.". Catch `InvariantViolated` → re-render avec err.message.
       - 3 routes symétriques pour `/edl/sortie/...` (utilise `enregistrerEDLSortie`).
       - **POST /baux/:id/edl/:type/:edlId/annuler** : soft-delete (lookup, throw EDLDejaAnnule si déjà, edl.annuler(raison, today) + edlRepo.enregistrer + banniereSuccess + redirect).

    4. `src/web/views/pages/baux/edl/formulaire.ejs` (NOUVEAU) :
       - layout-debut titre `EDL d'${type} — ${bail.id.slice(0,8)}`, breadcrumbs `[Baux, ${bailId}, EDL ${type}, Nouveau]`, navActive='baux'.
       - `<h1>État des lieux d'<%= type === 'entree' ? 'entrée' : 'sortie' %></h1>`.
       - `<form method="POST" action="/baux/<%= bail.id %>/edl/<%= type %>" novalidate>` :
         - Champ `date_edl` partial form-field type=date required.
         - Champ `contradictoire` checkbox + label `<input type="checkbox" id="contradictoire" name="contradictoire" <% if (valeurs.contradictoire === 'on') { %>checked<% } %>><label for="contradictoire">EDL contradictoire (les deux parties signent)</label>`.
         - Champ `date_signature` partial form-field type=date (conditionnellement visible via JS minimal inline `style="display: <%= valeurs.contradictoire === 'on' ? 'block' : 'none' %>"`).
         - `<%- include('../../../partials/partial-edl-form', { type, inventaireDefaut, helpers: { formaterTypeItemInventaire }, erreurs }) %>`
         - Boutons : `<button type="submit">Enregistrer l'état des lieux</button>` + `<a href="/baux/<%= bail.id %>" role="button" class="secondary">Annuler</a>`.
       - layout-fin.

    5. `src/web/views/pages/baux/edl/entree.ejs` (NOUVEAU) :
       - layout-debut titre `EDL d'entrée — ${bail.id.slice(0,8)}`, breadcrumbs, navActive='baux'.
       - `<h1>État des lieux d'entrée</h1>`.
       - Si `edl === null` → `<%- include('../../partials/empty-state', { heading: "Aucun état des lieux d'entrée", body: "L'état des lieux d'entrée est obligatoire. Son absence présume le logement en bon état, ce qui peut nuire au bailleur lors de la restitution du dépôt.", ctaHref: '/baux/' + bail.id + '/edl/entree/nouveau', ctaLabel: "Enregistrer l'EDL d'entrée" }) %>`.
       - Sinon : `<dl>` metadata (date, contradictoire, dateSignature si non null) + `<%- include('../../partials/partial-inventaire-display', { inventaire: edl.inventaire, helpers: { formaterTypeItemInventaire, formaterEtatItem } }) %>`.
       - layout-fin.

    6. `src/web/views/pages/baux/edl/sortie.ejs` (NOUVEAU) :
       - Identique entree.ejs MAIS si `edl !== null` ET `edlEntreeActif !== null` → calcul `const deltaWarnings = comparerInventaires(edlEntreeActif, edl);` puis `<%- include('../../partials/partial-inventaire-warnings', { warnings: deltaWarnings, helpers }) %>`.
       - Si `edl !== null` ET `edlEntreeActif === null` → banniere-warning D-85 wording UI-SPEC exact.
       - Implémentation locked : `deltaWarnings` calculé côté route handler GET /baux/:id/edl/sortie (lookup `edlEntreeActif` via `edlRepo.trouverActifParBailEtType` + appel `comparerInventaires(edlEntreeActif, edl)`) et passé en locals : `reply.view('...', { edl, edlEntreeActif, deltaWarnings, helpers: { formaterTypeItemInventaire, formaterEtatItem } })`. La fonction `comparerInventaires` reste dans le domaine et n'est pas exposée aux helpers EJS. Lock revision iter 1 warning 7.

    7. `src/web/views/partials/partial-edl-form.ejs` (NOUVEAU) :
       - Variables : `type` ('entree' | 'sortie'), `inventaireDefaut: InventaireItem[]`, `helpers: { formaterTypeItemInventaire }`, `erreurs`.
       - `<fieldset><legend>Inventaire mobilier (décret 2015-981) — 12 items obligatoires</legend>`
       - `<% inventaireDefaut.forEach(function(item, idx) { %>`
       -   `<div class="inventaire-item">`
       -     `<input type="hidden" name="inventaire[<%= idx %>].typeItem" value="<%= item.typeItem %>" />`
       -     `<input type="checkbox" id="item-<%= idx %>-present" name="inventaire[<%= idx %>].present" <% if (item.present) { %>checked<% } %> />`
       -     `<label for="item-<%= idx %>-present"><%= helpers.formaterTypeItemInventaire(item.typeItem) %></label>`
       -     `<label for="item-<%= idx %>-etat">État :</label>`
       -     `<select id="item-<%= idx %>-etat" name="inventaire[<%= idx %>].etat"><option value="">— Sélectionner —</option><option value="bon" <% if (item.etat === 'bon') { %>selected<% } %>>Bon</option><option value="moyen" <% if (item.etat === 'moyen') { %>selected<% } %>>Moyen</option><option value="degrade" <% if (item.etat === 'degrade') { %>selected<% } %>>Dégradé</option></select>`
       -     `<label for="item-<%= idx %>-note">Note :</label>`
       -     `<textarea id="item-<%= idx %>-note" name="inventaire[<%= idx %>].note" rows="2"><%= item.note ?? '' %></textarea>`
       -   `</div>`
       - `<% }); %>`
       - `</fieldset>`

    8. `src/web/views/partials/partial-inventaire-display.ejs` (NOUVEAU) :
       - Variables : `inventaire: InventaireItem[]`, `helpers: { formaterTypeItemInventaire, formaterEtatItem }`.
       - `<table role="table" aria-label="Inventaire mobilier (12 items décret 2015-981)"><caption class="sr-only">Inventaire mobilier</caption><thead><tr><th>Item</th><th>Présent</th><th>État</th><th>Note</th></tr></thead><tbody>`
       - `<% inventaire.forEach(function(i) { %><tr><td><%= helpers.formaterTypeItemInventaire(i.typeItem) %></td><td><%= i.present ? 'Oui' : 'Non' %></td><td><%= helpers.formaterEtatItem(i.etat) %></td><td><%= i.note ?? '—' %></td></tr><% }); %></tbody></table>`

    9. `src/web/views/partials/partial-inventaire-warnings.ejs` (NOUVEAU) :
       - Variables : `warnings: Warning[]`, optionnels `helpers`.
       - `<% if (warnings.length > 0) { %><aside role="status" aria-live="polite" class="warning-zone"><h3>Différences observées entre l'entrée et la sortie</h3><ul><% warnings.forEach(function(w) { %><li><strong><%= w.code === 'WARNING_ITEM_DISPARU' ? '⚠ Item disparu' : '⚠ Item dégradé' %></strong> — <%= w.message %></li><% }); %></ul></aside><% } %>`

    10. ÉTENDRE `src/web/views/pages/baux/detail.ejs` :
        - Ajouter section `<section aria-labelledby="edl-heading"><h2 id="edl-heading">État des lieux</h2>` :
          - `<% if (edlEntreeActif) { %><dl><dt>EDL d'entrée</dt><dd><a href="/baux/<%= bail.id %>/edl/entree">Voir l'EDL d'entrée du <%= formatDate(edlEntreeActif.dateEdl) %></a></dd></dl><% } else { %><%- include('../../partials/empty-state', { heading: "Aucun EDL d'entrée", body: "...", ctaHref: '/baux/' + bail.id + '/edl/entree/nouveau', ctaLabel: "Enregistrer l'EDL d'entrée" }) %><% } %>`
          - Idem pour `edlSortieActif`.
          - Note d'implémentation : la route GET /baux/:id charge `edlEntreeActif` et `edlSortieActif` via `edlRepo.trouverActifParBailEtType` et les passe en locals (locked iter 1 — cohérent avec Step 12 ci-dessous qui étend la route).
        - `</section>`.

    11. ÉTENDRE `src/web/views/pages/baux/formulaire.ejs` :
        - Insérer (avant les boutons submit) un `<fieldset><legend>Mobilier obligatoire (décret 2015-981)</legend>`.
        - `<% TYPES_ITEM_INVENTAIRE.forEach(function(t) { %><div><input type="checkbox" id="mobilier-<%= t %>" name="mobilier" value="<%= t %>" <% if ((valeurs.mobilier ?? TYPES_ITEM_INVENTAIRE).includes(t)) { %>checked<% } %> /><label for="mobilier-<%= t %>"><%= helpers.formaterTypeItemInventaire(t) %></label></div><% }); %>`
        - Note : default tous cochés (Hick's Law D-98 minimisation friction — cas le plus courant).
        - `</fieldset>`
        - Implémentation locked : exposer `TYPES_ITEM_INVENTAIRE` (array constant) ET `formaterTypeItemInventaire` (helper) via le hook `preHandler` global (cohérent avec injection des autres helpers DP-18 dans main.ts step 17). Le hook ajoute `reply.locals.TYPES_ITEM_INVENTAIRE = TYPES_ITEM_INVENTAIRE` et `reply.locals.formaterTypeItemInventaire = formaterTypeItemInventaire`. Lock revision iter 1 warning 7.

    12. ÉTENDRE `src/web/routes/baux.ts` :
        - GET /baux/:id : ajouter `const edlEntreeActif = await opts.edlRepo.trouverActifParBailEtType(id as BailId, 'entree'); const edlSortieActif = ...;` (injecter `edlRepo` dans opts). Passer en locals.
        - POST /baux : après parsing schema, appeler `mobilierVersInventaireItems(parsed.data.mobilier)` puis passer `mobilier` à `creerBail`.
        - POST /baux/:id (édition) : idem pour `modifierBail`.
        - Après création/édition réussie, appeler `bail.verifierChecklistMobilier()` ; si warning non null, set `req.session.banniereWarning`.
        - Routes Fastify de baux étendues pour appeler `edlRepo` — l'injection edlRepo dans le plugin doit être propagée depuis main.ts.

    13. ÉTENDRE `src/main.ts` :
        - Imports `plugin as etatsDesLieuxPlugin`.
        - Register après baux plugin : `await app.register(etatsDesLieuxPlugin, { bailRepo, edlRepo });`
        - Étendre l'injection de baux plugin : ajouter `edlRepo` en opts.

    14. ÉTENDRE `tests/bdd/step_definitions/edl.steps.ts` et `tests/bdd/step_definitions/checklist-mobilier.steps.ts` avec steps nécessaires (HTTP via app.inject + assertions DB + parsing HTML response).

    Sécurité (cf. <threat_model>) :
    - SQL injection : Kysely paramétrisé.
    - XSS : EJS autoescape `<%= %>`.
    - Inputs Zod : `typeItem ∈ enum`, `etat ∈ enum`, `date format` strict, `superRefine` cohérence contradictoire/dateSignature.
    - Race condition cross-aggregate D-89 : double barrière (use case throw + UNIQUE INDEX partiel SQLite).
    - Pas de path traversal Phase 3-02 (pas de PDF, différé 03-04).

    Vérifs : `pnpm test:bdd -- --tags @loc-03` 5 scenarios VERTS. `pnpm test:bdd -- --tags @loc-06` 3 scenarios VERTS. `pnpm test` complet VERT. `pnpm tsc --noEmit` 0. `pnpm lint` 0.

    Commit : `feat(03-02): routes /baux/:id/edl/* + schemas Zod + views formulaire + partials + section EDL sur fiche Bail + fieldset mobilier formulaire Bail + BDD LOC-03 + LOC-06 (vert)`.
  </action>
  <verify>
    <automated>cd /Users/valentinshodo/Projects/toolbox/gestion-locative && pnpm tsc --noEmit && pnpm lint && pnpm lint:deps && pnpm test && pnpm test:bdd -- --tags "@loc-03 or @loc-06"</automated>
  </verify>
  <done>
    - 7 routes /baux/:id/edl/* (GET entrée + GET nouveau + POST + GET sortie + GET nouveau + POST + POST annuler).
    - Schemas Zod (edl + bail étendu) + normaliserInventaireFormBody helper.
    - 3 nouvelles views (formulaire, entree, sortie) + extension detail.ejs (section EDL) + extension formulaire.ejs (fieldset mobilier).
    - 3 nouveaux partials (partial-edl-form, partial-inventaire-display, partial-inventaire-warnings).
    - Routes baux.ts étendues (edlRepo injecté + mobilier dans create/edit + warning verifierChecklistMobilier).
    - main.ts wiring complet.
    - 8 scenarios BDD @loc-03 + @loc-06 verts.
    - Tous tests existants toujours verts (non-régression Phase 1/2/3-01).
    - Commit créé.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| navigateur user → Fastify POST /baux/:id/edl/* | Inputs date_edl, contradictoire, dateSignature, inventaire[N].* — validés Zod côté HTTP + InvariantViolated côté domaine |
| navigateur user → Fastify POST /baux (édition mobilier) | Inputs mobilier[] checkbox array — validés Zod transform |
| Fastify → SQLite (race 2 EDL entrée simultanés) | UNIQUE INDEX partiel garantit l'invariant DB-level même en cas de bug applicatif |
| Fastify → EJS render | XSS sur strings user (note item, raison annulation) — EJS autoescape par défaut |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-03-02-01 | Tampering | 2 EDL entrée actifs créés simultanément (race ou bug use case) → invariant D-89 violé | HIGH | mitigate | Double barrière : (1) use case `enregistrerEDLEntree` lookup `trouverActifParBailEtType` puis throw EDLEntreeExisteDeja ; (2) UNIQUE INDEX SQLite partiel `idx_edl_bail_type_actif` WHERE annule_le IS NULL → throw violation contrainte si race contournée. Tests T43 + T47. |
| T-03-02-02 | Tampering | Inventaire incomplet (length !== 12) accepté par l'agrégat → comparerInventaires throw au runtime | HIGH | mitigate | Invariant `EtatDesLieux.creer` : `inventaire.length === 12` ET couvre exactement TYPES_ITEM_INVENTAIRE. Tests T12, T13. Le formulaire EJS garantit 12 lignes (boucle sur inventaireDefaut). |
| T-03-02-03 | Tampering | EDL contradictoire sans dateSignature accepté → opposabilité juridique perdue | MED | mitigate | Invariant `EtatDesLieux.creer` `contradictoire === true → dateSignature !== null`. Zod `.superRefine` côté HTTP. Tests T14. |
| T-03-02-04 | Tampering | Bail.mobilier corrompu (JSON malformé en DB) → BailRepositorySqlite throw au load | MED | mitigate | `JSON.parse` enveloppé + `InventaireItem.creer` re-valide chaque item ; en cas de corruption → InvariantViolated remonte clairement. DB intègre seulement si l'app écrit (mono-user). |
| T-03-02-05 | Information disclosure | EDL d'un autre bail accédé via /baux/:id/edl/entree (id arbitraire) | LOW | accept | Mono-user V1. Le user a tous ses baux. |
| T-03-02-06 | XSS | Note item inventaire (input user free text) rendue dans `<td>` ou `<textarea>` | MED | mitigate | EJS `<%= %>` autoescape (`<` `>` `&` `'` `"`). `<textarea><%= item.note %></textarea>` sécurisé. Audit code review : interdire `<%- %>` sur strings user. |
| T-03-02-07 | Integrity | Soft-delete EDL : annuleLe set sans raisonAnnulation → audit trail incomplet | LOW | mitigate | `EtatDesLieux.annuler(raison, annuleLe)` exige `raison: string` non-null (signature TS). Use case `annulerEDL` (futur) validera Zod min 3 chars (pattern Phase 2 annulerQuittance). |
| T-03-02-08 | Tampering | Bail créé sans mobilier (mobilier=[]) → exposition fiscale (requalification bail nu) | MED | accept | Avertissement non bloquant D-98 (loi laisse le choix au bailleur d'assumer le risque). Wording UI-SPEC explicite ("changement de régime fiscal"). Tests T28, T30, T52. |
</threat_model>

<verification>
- `pnpm tsc --noEmit` exit 0
- `pnpm lint` 0 warning
- `pnpm lint:deps` 0 violation (domaine pur InventaireItem + EtatDesLieux + comparerInventaires sans import technique)
- `pnpm test:unit` VERT (InventaireItem, EtatDesLieux, comparerInventaires, Bail.mobilier, enregistrerEDL, helpers)
- `pnpm test:integration` VERT (etat-des-lieux-repository-sqlite roundtrip + UNIQUE INDEX, bail-repository-sqlite-mobilier)
- `pnpm test:bdd -- --tags "@loc-03 or @loc-06"` 8 scenarios PASSED
- Migration 0008 idempotente
- Pas de régression Phase 1/2/3-01 : `pnpm test` complet VERT
- comparerInventaires 100% couverture (logique métier D-101)
- TYPES_ITEM_INVENTAIRE.length === 12 et aligné LOCATION_MEUBLEE_REGLES.md §2 (vérifié visuellement + test T6)
</verification>

<success_criteria>
- LOC-03 satisfait : EDL d'entrée + EDL de sortie contradictoires avec inventaire mobilier annexé, soft-delete + ré-enregistrement.
- LOC-06 satisfait : checklist 12 items décret 2015-981 vérifiée à la création/édition du Bail, warning textuel non bloquant si items absents.
- D-81 satisfait : structure unique InventaireItem partagée Bail + EDL.
- D-82 satisfait : un seul agrégat EtatDesLieux avec type discriminant.
- D-83 satisfait : contradictoire: boolean + dateSignature: PlainDate | null (huissier différé).
- D-84 + D-85 satisfaits : warnings non bloquants (EDL sortie avant fin / EDL entrée absent).
- D-86 satisfait : inventaire JSON inline sur etat_des_lieux.
- D-89 satisfait : ≤1 EDL actif par (bail, type) — double barrière use case + index unique partiel.
- D-97 + D-98 satisfaits : mobilier minimaliste sur Bail + warning requalification.
- D-99 satisfait : sémantique double `present` selon type EDL gérée par `comparerInventaires`.
- D-100 satisfait : enum TypeItemInventaire codée 12 valeurs décret 2015-981.
- D-101 satisfait : domain service comparerInventaires inclus Phase 3, vue diff différée Phase 4.
- DP-18 partiellement résolu : 2 helpers sur 6 ajoutés (formaterEtatItem + formaterTypeItemInventaire).
- Domain pur (vérifié dependency-cruiser).
</success_criteria>

<output>
After completion, create `.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-02-SUMMARY.md` listant :
- 3 commits (tests rouges / domain+app+infra / web+BDD)
- Patterns établis : VO InventaireItem partagée 2 agrégats (Bail + EDL), enum codée domaine versionneable décret, JSON inline pour VOs list (pattern Cautionnement étendu), UNIQUE INDEX partiel SQLite pour invariants cross-aggregate au niveau DB, domain service pur testable 100%, formulaire avec sous-formulaires templated via partial commun (entrée/sortie discriminé par locals.type)
- Dépendances pour plans suivants : 03-03 (workflow IRL) consomme `Bail.dateAnniversaireProchaine` (à créer 03-03) ET `Bien.estGelLoyer()` (créé 03-01) — pas de dépendance directe à 03-02 ; 03-05 (UI polish) audit la section EDL sur fiche Bail (a11y, sidebar nav)
- Notes sur l'ordre migrations : 0001 (Phase 1) → 0002..0006 (Phase 2) → 0007 (03-01 diagnostics) → 0008 (03-02 EDL)
</output>

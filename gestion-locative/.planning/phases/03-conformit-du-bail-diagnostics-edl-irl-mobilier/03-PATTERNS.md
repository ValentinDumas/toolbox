# Phase 3: Conformité du bail — Diagnostics, EDL, IRL, Mobilier — Pattern Map

**Mapped:** 2026-05-16
**Files analyzed:** 38 (new) + 7 (modified/extended)
**Analogs found:** 38 / 38 (exact ou role-match)

> **Lecture downstream :** `gsd-planner` consomme ce fichier pour rédiger chaque action de plan en référençant l'analogie + l'excerpt à copier.

---

## File Classification

| Nouveau / Modifié | Rôle | Data Flow | Analog | Match |
|---|---|---|---|---|
| `src/domain/_shared/identifiants.ts` (modifié) | shared VO | n/a | self — pattern Phase 1 D-29/D-44 | extend |
| `src/domain/patrimoine/diagnostic.ts` | sub-aggregate | request-response | `src/domain/patrimoine/lot.ts` | exact |
| `src/domain/patrimoine/duree-validite-diagnostic.ts` | constante domaine | n/a | (constante isolée — pas d'analog direct, voir notes) | new |
| `src/domain/patrimoine/bien.ts` (modifié) | aggregate root | request-response | self — ajout `diagnostics[]` + `classeDpe` + méthodes | extend |
| `src/domain/patrimoine/bien-repository.ts` (modifié) | port | request-response | self — ajout signature future Phase 7 | extend |
| `src/domain/patrimoine/erreurs.ts` (modifié) | erreurs BC | n/a | `src/domain/locatif/erreurs.ts` | exact |
| `src/domain/locatif/inventaire-item.ts` | VO + enum + LABELS | n/a | `src/domain/locatif/cautionnement.ts` (Garant interface) | role-match |
| `src/domain/locatif/etat-des-lieux.ts` | aggregate root | request-response + JSON inline VOs | `src/domain/locatif/bail.ts` + `cautionnement.ts` (JSON inline) + `encaissement.ts` (soft-cancel) | hybrid |
| `src/domain/locatif/etat-des-lieux-repository.ts` | port | request-response | `src/domain/encaissements/encaissement-repository.ts` | exact |
| `src/domain/locatif/bail-indexation.ts` | append-only event-like | event-driven | `src/domain/encaissements/encaissement.ts` (append-only + soft-cancel via raison) | exact |
| `src/domain/locatif/bail-indexation-repository.ts` | port | event-driven | `src/domain/encaissements/encaissement-repository.ts` | exact |
| `src/domain/locatif/bail.ts` (modifié) | aggregate root | CRUD | self — ajout 4 méthodes (dateAnniversaireProchaine, simulerIndexation, appliquerIndexation, verifierChecklistMobilier) | extend |
| `src/domain/locatif/comparer-inventaires.ts` | domain service | transform | (pas d'analog 1:1 — voir notes ; pattern proche : `genererEcheancesPour` Phase 2) | new |
| `src/domain/locatif/erreurs.ts` (modifié) | erreurs BC | n/a | self — pattern Phase 1/2 | extend |
| `migrations/0007_phase3_init.sql` | migration SQL | n/a | `migrations/0002_phase2_bailleur_bail_ext.sql` (ALTER + CREATE en 1 fichier) + `0004` (event-like append-only) | exact |
| `src/infrastructure/db/kysely-types.ts` (modifié) | infra types | n/a | self — ajout `BienTable.classe_dpe`, 3 nouvelles tables | extend |
| `src/infrastructure/repositories/bien-repository-sqlite.ts` (modifié) | adapter Kysely | CRUD | self — extension transaction multi-table (pattern Lot purge+réinsertion) | extend |
| `src/infrastructure/repositories/etat-des-lieux-repository-sqlite.ts` | adapter Kysely | CRUD + JSON | `src/infrastructure/repositories/bail-repository-sqlite.ts` (JSON cautionnement) + `quittance-repository-sqlite.ts` (versDomaine + versRow) | hybrid |
| `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts` | adapter Kysely | append-only | `src/infrastructure/repositories/encaissement-repository-sqlite.ts` | exact |
| `src/infrastructure/pdf/avenant-doc-def.ts` | pdfmake builder | request-response | `src/infrastructure/pdf/quittance-doc-def.ts` (mentions loi 89 + bailleur/locataire) | exact |
| `src/infrastructure/storage/stockage-fichier-local.ts` (modifié) | adapter FS | request-response | self — ajout méthode `ecrireAvenant` symétrique à `ecrireQuittance` | extend |
| `src/application/patrimoine/ajouter-diagnostic.ts` | use case | CRUD | `src/application/patrimoine/ajouter-lot.ts` | exact |
| `src/application/locatif/enregistrer-edl.ts` | use case multi-repos | request-response | `src/application/encaissements/activer-bail.ts` (multi-repo, invariant cross-aggregate) | role-match |
| `src/application/locatif/simuler-indexation-irl.ts` | use case pure (read-only) | transform | `src/application/encaissements/lister-echeances.ts` (read-only orchestration) | role-match |
| `src/application/locatif/appliquer-indexation-irl.ts` | use case multi-repos transactionnel | event-driven + CRUD | `src/application/locatif/modifier-bail-actif.ts` (D-73 régénération échéances futures) + `generer-quittance.ts` (PDF + compensation) | hybrid |
| `src/application/locatif/renoncer-indexation-irl.ts` | use case | event-driven | `src/application/encaissements/annuler-encaissement.ts` (append-only, sans PDF) | role-match |
| `src/web/schemas/diagnostic-schemas.ts` | Zod schema HTTP | n/a | `src/web/schemas/bien-schemas.ts` | exact |
| `src/web/schemas/edl-schemas.ts` | Zod schema HTTP + checkbox array | n/a | `src/web/schemas/bien-schemas.ts` (`normaliserLotsFormBody`) | exact |
| `src/web/schemas/indexation-schemas.ts` | Zod schema HTTP | n/a | `src/web/schemas/bien-schemas.ts` | exact |
| `src/web/routes/diagnostics.ts` | route plugin Fastify | request-response | `src/web/routes/biens.ts` (CRUD avec nested sous-agrégat Lot) | exact |
| `src/web/routes/etats-des-lieux.ts` | route plugin Fastify | request-response | `src/web/routes/biens.ts` + `quittances.ts` (lookup + redirect + bannières) | hybrid |
| `src/web/routes/indexations.ts` | route plugin Fastify wizard | request-response | `src/web/routes/wizard.ts` (multi-step + session) + `quittances.ts` (PDF download) | hybrid |
| `src/web/views/pages/biens/diagnostics/formulaire.ejs` | EJS form | n/a | `src/web/views/pages/biens/formulaire.ejs` | exact |
| `src/web/views/pages/baux/edl/formulaire.ejs` | EJS form (checklist 12 items) | n/a | `src/web/views/pages/biens/detail.ejs` (data-table + form Ajouter Lot) | role-match |
| `src/web/views/pages/baux/edl/entree.ejs`, `sortie.ejs` | EJS détail | n/a | `src/web/views/pages/baux/detail.ejs` (dl + sections) | exact |
| `src/web/views/pages/baux/indexer/saisie.ejs`, `simulation.ejs`, `confirmation.ejs` | EJS wizard | n/a | `src/web/views/partials/wizard-layout.ejs` + `pages/wizard/bien.ejs` | exact |
| `src/web/views/partials/partial-badge-dpe.ejs` | partial inline | n/a | (nouveau — pas d'analog ; pattern Pico.css inline style) | new |
| `src/web/views/partials/partial-diagnostic-row.ejs` | partial row | n/a | `src/web/views/partials/data-table.ejs` (utilisation) — partial dédié au row si réutilisation | role-match |
| `src/web/views/partials/partial-edl-form.ejs` | partial form | n/a | `src/web/views/partials/form-field.ejs` (forme) | role-match |
| `src/web/views/partials/partial-inventaire-display.ejs` | partial liste | n/a | `src/web/views/pages/baux/detail.ejs` (section dl) | role-match |
| `src/web/views/partials/partial-inventaire-warnings.ejs` | partial warnings | n/a | `src/web/views/partials/banniere-warning.ejs` (réutilisation) | exact |
| `src/web/views/partials/partial-indexation-banner.ejs` | partial banner | n/a | `src/web/views/partials/banniere-warning.ejs` (variant aside cliquable) | role-match |
| `src/web/views/partials/sidebar-nav.ejs` (modifié) | navigation | n/a | self — pas d'ajout top-level Phase 3 (cf. UI-SPEC §Sidebar) | none |
| `src/helpers/format-classe-dpe.ts`, `format-type-diagnostic.ts`, `format-etat-item.ts`, `format-trimestre-irl.ts`, `format-statut-diagnostic.ts`, `format-raison-non-application.ts` | helpers preHandler | n/a | `src/helpers/format-date.ts` + `format-money.ts` | exact |
| `tests/_builders/patrimoine.ts` (modifié) — `unDiagnosticValide` | builder | n/a | self — pattern `unLotValide` | extend |
| `tests/_builders/locatif.ts` (modifié) — `unEtatDesLieuxEntreeValide`, `unEtatDesLieuxSortieValide`, `unInventaireItemValide`, `uneBailIndexationValide` | builders | n/a | `tests/_builders/locatif.ts` (`unBailValide`) | exact |
| `tests/unit/patrimoine/diagnostic.test.ts` | unit | n/a | `tests/unit/locatif/cautionnement.test.ts` (factory + invariants) | exact |
| `tests/unit/locatif/etat-des-lieux.test.ts` | unit | n/a | `tests/unit/locatif/cautionnement.test.ts` + `bail.test.ts` | exact |
| `tests/unit/locatif/bail-indexation.test.ts` | unit | n/a | `tests/unit/locatif/cautionnement.test.ts` | exact |
| `tests/unit/locatif/comparer-inventaires.test.ts` | unit (domain service) | n/a | (pattern interne — voir notes) | new |
| `tests/bdd/features/diagnostics.feature`, `edl.feature`, `indexation-irl.feature`, `gel-loyer-climat.feature`, `checklist-mobilier.feature` | BDD scenarios | n/a | `tests/bdd/features/enc02-activation-bail.feature` | exact |
| `tests/bdd/step_definitions/*.steps.ts` | BDD steps | n/a | `tests/bdd/step_definitions/enc02.steps.ts` | exact |
| `src/main.ts` (modifié) | wiring app | n/a | self — instanciation des 3 nouveaux repos + enregistrement des 3 plugins | extend |

---

## Pattern Assignments

### `src/domain/patrimoine/diagnostic.ts` (sub-aggregate, factory + invariants)

**Analog:** `src/domain/patrimoine/lot.ts` (sub-aggregate de `Bien`, factory + InvariantViolated, brand id).

**Pourquoi :** D-76 énonce explicitement « Pattern identique à `Lot` (Phase 1 D-29) ». `Lot` est le seul autre sous-agrégat de `Bien`, même cardinality (N par `Bien`), même style factory `creer()` + validation enum.

**Imports + Brand id pattern** (lot.ts lignes 1-3) :
```ts
import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauLotId, type LotId } from '../_shared/identifiants.js';

export type TypeLot = 'appartement' | 'parking' | 'cave' | 'local_commercial' | 'terrasse' | 'autre';
```

**Factory + invariant guards** (lot.ts lignes 31-49) :
```ts
static creer(props: LotProps): Lot {
  if (!props.designation.trim()) {
    throw new InvariantViolated("La désignation du lot ne peut pas être vide");
  }

  const typesValides: TypeLot[] = ['appartement', 'parking', 'cave', 'local_commercial', 'terrasse', 'autre'];
  if (!typesValides.includes(props.type)) {
    throw new InvariantViolated(`Le type de lot "${props.type}" est invalide`);
  }

  if (TYPES_LOT_AVEC_SURFACE_OBLIGATOIRE.includes(props.type)) {
    if (props.surface == null || props.surface <= 0) {
      throw new InvariantViolated(`La surface est obligatoire et doit être > 0 pour un lot de type "${props.type}"`);
    }
  }

  const id = props.id ?? nouveauLotId();
  return new Lot(id, { designation: props.designation, surface: props.surface, type: props.type, etage: props.etage });
}
```

**Déviations attendues pour `Diagnostic`** :
- Champs : `id: DiagnosticId`, `type: TypeDiagnostic ('dpe'|'gaz'|'elec'|'erp')`, `dateEmission: Temporal.PlainDate`, `dateExpiration: Temporal.PlainDate | null` (calculée).
- Constante `DUREES_VALIDITE` importée depuis `./duree-validite-diagnostic.ts` (D-77).
- `dateExpiration` est **calculée** dans `creer()` : `props.dateEmission.add({ years: DUREES_VALIDITE[type].annees })` si non null, sinon `null` (ERP = validité illimitée).
- Invariant `dateEmission ≤ today` à vérifier via `Clock` injecté (cf. discussion `Cautionnement.creer` qui utilise `Temporal.Now.plainDateISO()` — préférer le port `Clock` pour testabilité, suivre `BDD_PRACTICES.md` port Clock).
- Méthode helper `estExpire(today: Temporal.PlainDate): boolean` (utile pour D-80 affichage badge).

---

### `src/domain/patrimoine/bien.ts` (modifié — sub-aggregate management + classeDpe)

**Analog:** `src/domain/patrimoine/bien.ts` (self — pattern existant `ajouterLot`/`supprimerLot` copy-on-write avec validation via `Bien.creer()`).

**Copy-on-write add pattern** (bien.ts lignes 81-90) :
```ts
ajouterLot(lot: Lot): Bien {
  return Bien.creer({
    id: this.id,
    adresse: this.adresse,
    surface: this.surface,
    type: this.type,
    anneeConstruction: this.anneeConstruction,
    lots: [...this.lots, lot],
  });
}
```

**Déviations attendues pour `ajouterDiagnostic`** (DP-14) :
- Signature : `ajouterDiagnostic(d: Diagnostic): Bien`.
- **Synchronisation interne** : si `d.type === 'dpe'`, mettre à jour `classeDpe` à partir de `d.classeDpe` (l'enum DPE doit être un champ du `Diagnostic` pour les DPE, ou passé via méthode dédiée `Bien.ajouterDpe(d, classe)`). Recommandation : `Diagnostic.dpe(props)` factory variant avec `props.classeDpe` requis, et `Bien.ajouterDiagnostic(d)` pull `d.classeDpe` si `type === 'dpe'`.
- Méthode `diagnosticActif(type: TypeDiagnostic): Diagnostic | null` : filter `diagnostics.filter(d => d.type === type).sort(byDateEmissionDesc)[0] ?? null` (D-79).
- Méthode `estGelLoyer(): boolean` : `return this.classeDpe === 'F' || this.classeDpe === 'G'` (D-92).
- Ajouter dans `creer()` la validation : `classeDpe ∈ {A..G, null}` (enum strict).
- **Pas** de `supprimerDiagnostic` V1 (historique conservé D-79).

---

### `src/domain/locatif/inventaire-item.ts` (VO + enum + LABELS_ITEM_INVENTAIRE)

**Analog:** `src/domain/locatif/cautionnement.ts` (VO inline avec garant, sérialisation `toJSON()` pour stockage en colonne TEXT).

**Pourquoi :** D-86 explicite « Pattern Cautionnement Phase 1 (D-33) ». `InventaireItem[]` sera stocké comme JSON inline sur la table `etat_des_lieux`, exactement comme `Cautionnement` sur `bail.cautionnement`.

**Garant interface pattern** (cautionnement.ts lignes 11-17) :
```ts
export interface Garant {
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
  readonly telephone: string;
  readonly adresse: Adresse;
}
```

**toJSON sérialisation pattern** (cautionnement.ts lignes 77-99) :
```ts
toJSON(): object {
  return {
    type: this.type,
    garant: this.garant
      ? {
          nom: this.garant.nom,
          ...
        }
      : null,
    montantGaranti: this.montantGaranti ? Number(this.montantGaranti.toCentimes()) : null,
    dateSignature: this.dateSignature.toString(),
    dureeEngagement: this.dureeEngagement,
  };
}
```

**Déviations attendues pour `InventaireItem`** :
- **VO simple** (pas de classe avec méthodes complexes — juste un type + factory `creer()` + `toJSON()` + helper de comparaison `etatADegrade(autre)`).
- Enum `TypeItemInventaire` codé en dur (D-100) avec 12 valeurs (décret 2015-981) : `'literie' | 'volets_rideaux' | 'plaques_cuisson' | 'four_micro_ondes' | 'refrigerateur_congelateur' | 'vaisselle' | 'ustensiles_cuisine' | 'table_sieges' | 'etageres_rangement' | 'luminaires' | 'materiel_entretien' | 'autre'` (consulter `LOCATION_MEUBLEE_REGLES.md` §2 pour la liste exacte).
- Map `LABELS_ITEM_INVENTAIRE: Record<TypeItemInventaire, string>` à côté de l'enum, format français lisible.
- Validation `etat` requise si `present: true` (cf. UI-SPEC §Forms : "Required si present: true"), libre si `present: false`.

---

### `src/domain/locatif/etat-des-lieux.ts` (aggregate root avec discriminant type + JSON inline VOs)

**Analogs** (hybride) :
1. **Aggregate factory + invariants** : `src/domain/locatif/bail.ts` (factory `creer()` + `toProps()` + `modifier()` copy-on-write avec ré-validation).
2. **JSON inline VOs** : `src/domain/locatif/cautionnement.ts` (sérialisation pour stockage TEXT).
3. **Soft-cancel via champ nullable + raison** : `src/domain/encaissements/encaissement.ts` (`annuleLe`, `raisonAnnulation`, méthode `annuler()`).

**Factory + toProps pattern** (bail.ts lignes 103-160 puis 162-181) :
```ts
static creer(props: BailProps): Bail {
  // D-35 §3.1 — durée minimale 12 mois pour un bail meublé classique
  if (props.dureeMois < 12) {
    throw new InvariantViolated('Un bail meublé classique doit durer au moins 12 mois');
  }
  // ... autres invariants ...
  const id = props.id ?? nouveauBailId();
  return new Bail(id, { ... });
}

private toProps(): BailProps {
  return { id: this.id, locataireId: this.locataireId, ... };
}
```

**Soft-cancel copy-on-write pattern** (encaissement.ts lignes 84-93) :
```ts
annuler(raison: string, annuleLe: Temporal.PlainDate): Encaissement {
  if (this.annuleLe !== null) {
    throw new InvariantViolated('Cet encaissement est déjà annulé');
  }
  return Encaissement.creer({
    ...this.toProps(),
    annuleLe,
    raisonAnnulation: raison,
  });
}
```

**Déviations attendues pour `EtatDesLieux`** :
- Champs : `id: EtatDesLieuxId`, `bailId: BailId`, `type: 'entree' | 'sortie'` (discriminant — D-82), `dateEdl: Temporal.PlainDate`, `contradictoire: boolean`, `dateSignature: Temporal.PlainDate | null`, `inventaire: InventaireItem[]`, `annuleLe: Temporal.PlainDate | null`, `raisonAnnulation: string | null`.
- Invariants `creer()` :
  - `inventaire.length === 12` (les 12 items du décret, même si certains `present: false`) — D-81.
  - `dateSignature !== null` si `contradictoire === true`.
  - `type ∈ {'entree', 'sortie'}`.
  - **PAS** d'invariant cross-aggregate "≤1 EDL entrée + ≤1 EDL sortie par bail" — c'est au use case (D-89).
- Méthode `comparerAvec(autre: EtatDesLieux): Warning[]` qui délègue au domain service `comparerInventaires(this, autre)` (D-101). Note : la méthode peut rester sur `EtatDesLieux` ou se trouver dans le service — au planner de trancher mais préférer le **domain service externe** pour symétrie avec `genererEcheancesPour` (Phase 2 utilise des fonctions libres dans `application/` mais le domaine `_shared/` est valide aussi).
- `annuler(raison, date)` copy-on-write — pattern Encaissement (D-89 correction = soft-delete + nouvel EDL).

---

### `src/domain/locatif/bail-indexation.ts` (append-only event-like)

**Analog:** `src/domain/encaissements/encaissement.ts` (agrégat append-only, jamais d'UPDATE sur montants, soft-cancel via colonne nullable).

**Pourquoi :** D-96 précise « Append-only (jamais d'UPDATE) ». `Encaissement` a exactement la même contrainte (« PAS de supprimer — D-60 impose le soft-delete via annule_le. PAS d'UPDATE montant — correction via compensateur »). Même cardinality N:1 (un Bail → N indexations / une Echeance → N encaissements).

**Append-only factory** (encaissement.ts lignes 56-78) :
```ts
static creer(props: EncaissementProps): Encaissement {
  if (!MODES_VALIDES.includes(props.mode)) {
    throw new InvariantViolated(...);
  }
  if (props.montant.egale(Money.zero())) {
    throw new InvariantViolated('Un Encaissement ne peut pas être de 0 €');
  }
  const id = props.id ?? nouveauEncaissementId();
  return new Encaissement(id, { ... });
}
```

**Déviations attendues pour `BailIndexation`** :
- Champs (D-96) : `id: BailIndexationId`, `bailId: BailId`, `dateEffet: Temporal.PlainDate`, `irlAvant: IRL`, `irlApres: IRL`, `loyerAvant: Money`, `loyerApres: Money`, `indexationAppliquee: boolean`, `raisonNonApplication: 'gel_dpe' | 'refus_bailleur' | null`, `creeLe: Temporal.PlainDate`.
- Invariants `creer()` :
  - Si `indexationAppliquee === true` : `loyerApres > loyerAvant` (révision à la hausse) OU `loyerApres === loyerAvant` (cas où l'indice n'a pas bougé) — vérifier loi 89.
  - Si `indexationAppliquee === false` : `raisonNonApplication !== null` et `loyerApres.egale(loyerAvant)` (loyer inchangé en cas de renonciation D-95).
  - `raisonNonApplication ∈ {'gel_dpe', 'refus_bailleur', null}` (D-96).
- **Pas de méthode `annuler()`** (immutable — D-96 append-only stricte). Correction = nouvelle ligne d'indexation, jamais d'UPDATE.

---

### `src/domain/locatif/bail.ts` (modifié — 4 nouvelles méthodes)

**Analog:** `src/domain/locatif/bail.ts` self (pattern Phase 2 `activer`/`desactiver` copy-on-write avec `toProps()`).

**Phase 2 copy-on-write pattern** (bail.ts lignes 209-226) :
```ts
activer(actifDepuis: Temporal.PlainDate, jourEcheance: number): Bail {
  return Bail.creer({
    ...this.toProps(),
    actifDepuis,
    jourEcheance,
  });
}

desactiver(): Bail {
  return Bail.creer({
    ...this.toProps(),
    actifDepuis: null,
  });
}
```

**Déviations attendues pour les 4 nouvelles méthodes Phase 3** :

1. **`dateAnniversaireProchaine(today: Temporal.PlainDate): Temporal.PlainDate`** (DP-20)
   - Pure : pas d'effet de bord, pas d'accès `Clock` (le `today` est paramètre).
   - Algorithme : `N = ceil((today - this.dateDebut) / 1 year)` puis `return this.dateDebut.add({ years: N })`.
   - Edge case : si `today < this.dateDebut` (bail futur), retourner `this.dateDebut.add({ years: 1 })` (premier anniversaire).
   - Pas de copy-on-write (méthode read-only).

2. **`simulerIndexation(irlNouveau: IRL, classeDpeBien: ClasseDpe | null): { nouveauLoyerHc: Money, gelLoyer: boolean, raison?: string }`** (D-91 étape 3, D-92)
   - Pure read-only. Pattern similaire à `Money.multiplyByFraction` (DP-10/D-72 réutilisé pour le calcul).
   - Si `classeDpeBien ∈ {'F', 'G'}` : retourner `{ nouveauLoyerHc: this.loyerHc, gelLoyer: true, raison: 'gel_dpe' }` (pas de calcul).
   - Sinon : calculer `num = parseFloat(irlNouveau.valeur) * 100`, `den = parseFloat(this.irlReference.valeur) * 100` (centimes pour précision), puis `this.loyerHc.multiplyByFraction(BigInt(Math.round(num)), BigInt(Math.round(den)), 'banker')` (DP-16 — banker's rounding, cf. `Money.multiplyByFraction` ligne 148-178).

3. **`appliquerIndexation(irlNouveau: IRL, dateEffet: Temporal.PlainDate): Bail`** (D-94 étapes 1-2)
   - Copy-on-write : `Bail.creer({ ...this.toProps(), loyerHc: nouveauLoyerHc, irlReference: irlNouveau })`.
   - Ne **régénère pas** les échéances (c'est le use case `appliquerIndexationIRL` qui orchestre ça).
   - Throw `InvariantViolated` si `Bien.estGelLoyer()` → le use case doit avoir filtré avant ; défense en profondeur ici. Si le bail décide de ne pas connaître `Bien.classeDpe`, déplacer la vérification au use case uniquement.

4. **`verifierChecklistMobilier(): { manquants: TypeItemInventaire[], warning: string | null }`** (D-98)
   - Read-only. Liste les `TypeItemInventaire` obligatoires non présents dans `this.mobilier` (si on stocke `mobilier: InventaireItem[]` sur le `Bail` — cf. D-97).
   - **Note de planning** : D-97 dit que `Bail` stocke une liste d'`InventaireItem` minimaliste. Il faut donc **ajouter** un champ `mobilier: InventaireItem[]` sur `Bail`. Décision planner : champ optionnel ou requis ? Recommandation : requis avec valeur par défaut = `[]` (compatibilité Phase 1/2 — migration ALTER `bail` ajout colonne `mobilier TEXT NULL`).

---

### `src/domain/locatif/comparer-inventaires.ts` (domain service pure)

**Analog (rôle uniquement, pas de match 1:1) :** `src/application/encaissements/activer-bail.ts` (fonction `genererEcheancesPour` — pattern domain function pure exportée pour réutilisation).

**Pourquoi :** Phase 1/2 n'ont pas créé de fichier `*.service.ts` dans `domain/_shared/` ou `domain/locatif/`. Le seul équivalent est `genererEcheancesPour` (Phase 2) — pure function exportée depuis le use case. Pour la phase 3, **recommander un nouveau fichier** `src/domain/locatif/comparer-inventaires.ts` exportant une fonction pure (suit DDD §4.4 domain service stateless).

**Pure function pattern** (activer-bail.ts lignes 95-100 puis corps fonctionnel) :
```ts
export type ContratBailPourGeneration = Pick<
  Bail,
  'id' | 'dureeMois' | 'loyerHc' | 'montantCharges' | 'modeCharges' | 'bienId' | 'locataireId'
>;
```

**Déviations attendues pour `comparerInventaires`** (D-101) :
- Signature : `export function comparerInventaires(entree: EtatDesLieux, sortie: EtatDesLieux): Warning[]`.
- `Warning` type : `{ code: 'WARNING_ITEM_DISPARU' | 'WARNING_ITEM_DEGRADE', typeItem: TypeItemInventaire, message: string, contexte?: { etatAvant?: string, etatApres?: string } }`.
- Algorithme :
  1. Pour chaque `typeItem` (12 items) :
     - Trouver `itemEntree` et `itemSortie` (lookup dans les arrays).
     - Si `itemEntree.present && !itemSortie.present` → `WARNING_ITEM_DISPARU`.
     - Si `itemEntree.present && itemSortie.present` ET `etatADegrade(itemEntree.etat, itemSortie.etat)` → `WARNING_ITEM_DEGRADE`.
     - Sinon : ignoré.
- Helper privé `etatADegrade(avant, apres): boolean` : `'bon' → 'moyen' | 'degrade'` ou `'moyen' → 'degrade'` retourne `true`.
- 100% couverture (D-101 = logique métier — `SOFTWARE_CRAFTSMANSHIP.md` §8 gates CI).

---

### `migrations/0007_phase3_init.sql` (migration SQL — 3 tables + 1 ALTER)

**Analog (hybride) :**
1. **ALTER + CREATE en un seul fichier transactionnel** : `migrations/0002_phase2_bailleur_bail_ext.sql`.
2. **Append-only table** (pour `bail_indexations`) : `migrations/0004_phase2_encaissement.sql`.

**Migration ALTER + CREATE transactionnelle** (0002 lignes 16-37) :
```sql
BEGIN TRANSACTION;

-- Extension de la table bail (D-51, D-53)
ALTER TABLE bail ADD COLUMN actif_depuis TEXT NULL;
ALTER TABLE bail ADD COLUMN jour_echeance INTEGER NOT NULL DEFAULT 1
  CHECK (jour_echeance >= 1 AND jour_echeance <= 28);

-- Table bailleur singleton (D-67)
-- UNIQUE(singleton_marker) garantit qu'un seul bailleur peut exister
CREATE TABLE IF NOT EXISTS bailleur (
  id               TEXT PRIMARY KEY,
  ...
);

COMMIT;
```

**Append-only table pattern** (0004 lignes 8-23) :
```sql
CREATE TABLE IF NOT EXISTS encaissement (
  id                 TEXT PRIMARY KEY,
  echeance_id        TEXT NOT NULL REFERENCES echeance_loyer(id),
  -- NOTE : pas de CHECK >= 0 — compensateurs acceptés (D-60)
  montant_centimes   INTEGER NOT NULL,
  date               TEXT NOT NULL,
  mode               TEXT NOT NULL CHECK (mode IN ('virement','cheque','especes','prelevement','autre')),
  annule_le          DATETIME NULL,
  raison_annulation  TEXT NULL,
  cree_le            DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_encaissement_echeance_actif
  ON encaissement(echeance_id, annule_le)
  WHERE annule_le IS NULL;
```

**Déviations attendues pour `0007_phase3_init.sql`** (DP-19) :
- **ALTER `bien`** : ajout `classe_dpe TEXT NULL CHECK (classe_dpe IS NULL OR classe_dpe IN ('A','B','C','D','E','F','G'))` (D-78).
- **ALTER `bail`** : ajout `mobilier TEXT NULL` (JSON array d'InventaireItem — D-97, cf. note `verifierChecklistMobilier`).
- **Table `diagnostics`** (DP-15 — table dédiée, pas JSON inline) :
  ```sql
  CREATE TABLE IF NOT EXISTS diagnostics (
    id              TEXT PRIMARY KEY,
    bien_id         TEXT NOT NULL REFERENCES bien(id),
    type            TEXT NOT NULL CHECK (type IN ('dpe','gaz','elec','erp')),
    date_emission   TEXT NOT NULL,
    date_expiration TEXT NULL,           -- null pour ERP (validité illimitée)
    classe_dpe      TEXT NULL,           -- renseigné si type='dpe'
    cree_le         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_diagnostics_bien ON diagnostics(bien_id);
  -- Index pour Phase 7 dashboard "expirés"
  CREATE INDEX IF NOT EXISTS idx_diagnostics_expiration ON diagnostics(date_expiration);
  ```
- **Table `etat_des_lieux`** :
  ```sql
  CREATE TABLE IF NOT EXISTS etat_des_lieux (
    id               TEXT PRIMARY KEY,
    bail_id          TEXT NOT NULL REFERENCES bail(id),
    type             TEXT NOT NULL CHECK (type IN ('entree','sortie')),
    date_edl         TEXT NOT NULL,
    contradictoire   INTEGER NOT NULL DEFAULT 0,  -- bool SQLite
    date_signature   TEXT NULL,
    inventaire       TEXT NOT NULL,                -- JSON array d'InventaireItem (D-86)
    annule_le        DATETIME NULL,                -- soft-delete D-89
    raison_annulation TEXT NULL,
    cree_le          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_edl_bail ON etat_des_lieux(bail_id);
  -- Garantit ≤1 EDL actif par (bail, type) — D-89 invariant
  CREATE UNIQUE INDEX IF NOT EXISTS idx_edl_bail_type_actif
    ON etat_des_lieux(bail_id, type)
    WHERE annule_le IS NULL;
  ```
- **Table `bail_indexations`** (append-only — D-96) :
  ```sql
  CREATE TABLE IF NOT EXISTS bail_indexations (
    id                       TEXT PRIMARY KEY,
    bail_id                  TEXT NOT NULL REFERENCES bail(id),
    date_effet               TEXT NOT NULL,
    irl_avant_trimestre      TEXT NOT NULL,
    irl_avant_valeur         TEXT NOT NULL,
    irl_apres_trimestre      TEXT NOT NULL,
    irl_apres_valeur         TEXT NOT NULL,
    loyer_avant_centimes     INTEGER NOT NULL,
    loyer_apres_centimes     INTEGER NOT NULL,
    indexation_appliquee     INTEGER NOT NULL,    -- bool SQLite
    raison_non_application   TEXT NULL CHECK (raison_non_application IS NULL OR raison_non_application IN ('gel_dpe','refus_bailleur')),
    cree_le                  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_bail_indexations_bail ON bail_indexations(bail_id, date_effet DESC);
  ```
- Tout enveloppé dans `BEGIN TRANSACTION; ... COMMIT;` (pattern 0002 ligne 16).
- Headers de commentaires identiques (conventions ISO dates, INTEGER centimes, UUID v4).

---

### `src/infrastructure/repositories/bail-indexation-repository-sqlite.ts` (adapter Kysely append-only)

**Analog:** `src/infrastructure/repositories/encaissement-repository-sqlite.ts` (adapter pour table append-only, `versDomaine` + `enregistrer` + lookup par parent).

**Pourquoi :** Cas exact : table append-only, jamais d'UPDATE de valeurs (seulement metadata techniques), lookup par FK parent (bailId au lieu d'echeanceId).

**Enregistrer pattern** (encaissement-repository-sqlite.ts lignes 29-48) :
```ts
async enregistrer(encaissement: Encaissement): Promise<void> {
  await this.db
    .insertInto('encaissement')
    .values({
      id: encaissement.id,
      echeance_id: encaissement.echeanceId,
      montant_centimes: encaissement.montant.toSqliteInteger(),
      date: encaissement.date.toString(),
      mode: encaissement.mode,
      annule_le: encaissement.annuleLe?.toString() ?? null,
      raison_annulation: encaissement.raisonAnnulation ?? null,
    })
    .onConflict((oc) =>
      oc.column('id').doUpdateSet({
        annule_le: encaissement.annuleLe?.toString() ?? null,
        raison_annulation: encaissement.raisonAnnulation ?? null,
      }),
    )
    .execute();
}
```

**versDomaine pattern** (encaissement-repository-sqlite.ts lignes 106-123) :
```ts
private versDomaine(row: EncaissementRow): Encaissement {
  const centimes = row.montant_centimes;
  const montant = centimes >= 0
    ? Money.fromCentimes(BigInt(centimes))
    : Money.compensateur(Money.fromCentimes(BigInt(-centimes)));

  return Encaissement.creer({
    id: row.id as EncaissementId,
    echeanceId: row.echeance_id as EcheanceLoyerId,
    montant,
    date: Temporal.PlainDate.from(row.date),
    mode: row.mode,
    annuleLe: row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null,
    raisonAnnulation: row.raison_annulation,
  });
}
```

**Déviations attendues pour `BailIndexationRepositorySqlite`** :
- `enregistrer(bailIndexation, trxArg?)` : `trxArg` optionnel pour s'inscrire dans la transaction du use case `appliquerIndexationIRL` (cf. pattern `QuittanceRepositorySqlite.enregistrer(quittance, trxArg?)` lignes 26-48 — `DbOrTrx` type alias).
- **Pas d'`onConflict`** ou plus restrictif que Encaissement (append-only D-96 — pas même update metadata).
- `listerParBail(bailId): Promise<BailIndexation[]>` : ordre `date_effet DESC` (équivalent `listerParEcheance` du repo Encaissement).
- IRL `versDomaine` : reconstruire deux instances `IRL.creer({ trimestre: row.irl_avant_trimestre, valeur: row.irl_avant_valeur })` et idem `apres`.
- Money : `Money.fromCentimes(BigInt(row.loyer_avant_centimes))` (pas de compensateur — loyer toujours positif).

---

### `src/infrastructure/repositories/etat-des-lieux-repository-sqlite.ts` (adapter Kysely + JSON inline)

**Analog (hybride) :**
1. **JSON inline serialization/deserialization** : `src/infrastructure/repositories/bail-repository-sqlite.ts` (cautionnement JSON).
2. **versDomaine/versRow + transaction** : `src/infrastructure/repositories/quittance-repository-sqlite.ts` + `bail-repository-sqlite.ts`.

**JSON inline pattern** (bail-repository-sqlite.ts lignes 17-19 puis 178-181 puis 207-243) :
```ts
// Sérialisation
const cautionnementJson = bail.cautionnement
  ? JSON.stringify(bail.cautionnement.toJSON())
  : null;

// Désérialisation
const cautionnement = row.cautionnement
  ? this.cautionnementDepuisJson(row.cautionnement)
  : null;

// Helper privé désérialisation typée
private cautionnementDepuisJson(json: string): Cautionnement {
  const data = JSON.parse(json) as { type: string; garant: {...} | null; ... };
  const garant = data.garant ? { nom: data.garant.nom, ..., adresse: Adresse.creer({ ... }) } : null;
  return Cautionnement.creer({ ... });
}
```

**Déviations attendues pour `EtatDesLieuxRepositorySqlite`** :
- Sérialisation : `JSON.stringify(edl.inventaire.map(item => item.toJSON()))` (array JSON inline).
- Désérialisation : helper privé `inventaireDepuisJson(json: string): InventaireItem[]` qui `JSON.parse` puis `.map(d => InventaireItem.creer(d))`.
- `enregistrer(edl)` : insertInto avec `inventaire: JSON.stringify(...)`, `contradictoire: edl.contradictoire ? 1 : 0` (bool SQLite).
- `trouverEntreeParBail(bailId): Promise<EtatDesLieux | null>` + `trouverSortieParBail(bailId): Promise<EtatDesLieux | null>` (lookup par `bail_id` + `type` + `annule_le IS NULL`).
- `listerParBail(bailId): Promise<EtatDesLieux[]>` (max 2 actifs grâce à l'index unique).

---

### `src/infrastructure/pdf/avenant-doc-def.ts` (pdfmake builder pour avenant IRL)

**Analog:** `src/infrastructure/pdf/quittance-doc-def.ts` (mentions légales loi 89, bailleur/locataire, signature, footer).

**Pourquoi :** D-93 enumere les mentions obligatoires loi 89 art. 17-1 — strictement parallèle à la quittance qui couvre loi 89 art. 21. Même structure pdfmake (A4, Roboto, sections, footer, mention légale italics).

**Structure pdfmake doc-def** (quittance-doc-def.ts lignes 43-184) :
```ts
export function construireQuittance(
  echeance: EcheanceLoyer,
  bailleur: Bailleur,
  locataire: LocataireQuittance,
  adresseBien: Adresse,
  numero: string,
  emiseLe: Temporal.PlainDate,
  modeCharges: 'forfait' | 'provisions',
): TDocumentDefinitions {
  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 80],
    defaultStyle: { font: 'Roboto', fontSize: 10, lineHeight: 1.4 },
    styles: {
      titreDoc: { fontSize: 16, bold: true },
      ...
    },
    content: [
      // ─── ENTÊTE ─────────────────────────────────
      { text: `QUITTANCE DE LOYER N° ${numero}`, style: 'titreDoc', alignment: 'center', ... },
      // ─── BAILLEUR — LOCATAIRE (colonnes) ───────
      { columns: [ { stack: [{ text: 'Le bailleur', style: 'labelBloc' }, bailleur.nomComplet, ...] }, ... ] },
      // ─── TABLEAU VENTILATION ──────────────────
      { table: { widths: ['*', 'auto'], body: [...] }, layout: 'lightHorizontalLines', ... },
      // ─── MENTION LÉGALE LOI 89 ART. 21 ────────
      { text: [...], style: 'mentionLegale', ... },
      // ─── SIGNATURE ────────────────────────────
      { columns: [{ stack: ['Fait le ' + dateEmission, { text: '\nSignature du bailleur :', ... }] }] },
    ],
    footer: {
      text: [`Établi conformément à l'article 21 de la loi n° 89-462 du 6 juillet 1989. `, ...],
      style: 'footer', alignment: 'center', margin: [56, 0, 56, 0],
    },
  };
}
```

**Déviations attendues pour `construireAvenantIndexation`** :
- Signature : `(bail: Bail, locataire: Locataire, bailleur: Bailleur, irlNouveau: IRL, irlAncien: IRL, loyerAvant: Money, loyerApres: Money, dateEffet: Temporal.PlainDate): TDocumentDefinitions`.
- Titre : `"AVENANT À LA CONVENTION DE BAIL — Révision IRL"` (UI-SPEC §Avenant PDF).
- Sous-titre : `"Exercice ${annee} — Bail du ${formatDateLong(bail.dateDebut)}"`.
- Tableau ventilation à 4 lignes (au lieu de 3) : Ancien loyer HC | IRL référence | IRL nouveau | **Nouveau loyer HC** (mis en gras + plus gros).
- Mention légale (italics) : reprend formule de calcul `loyer × (IRL_nouveau / IRL_ancien)` pour transparence (UX-DESIGN §Trust — D-91 étape 3).
- Footer : `"Conformément à l'article 17-1 de la loi n° 89-462 du 6 juillet 1989."` (UI-SPEC §Avenant PDF).
- Signature : DEUX colonnes (Bailleur + Locataire) au lieu d'une seule (l'avenant est cosigné).

---

### `src/infrastructure/storage/stockage-fichier-local.ts` (modifié — `ecrireAvenant`)

**Analog:** méthode `ecrireQuittance` du même fichier (lignes 22-27).

**Existing pattern** :
```ts
async ecrireQuittance(annee: number, nomFichier: string, buffer: Buffer): Promise<string> {
  const cheminAbsolu = path.join(this.baseDir, 'quittances', String(annee), nomFichier);
  await fs.mkdir(path.dirname(cheminAbsolu), { recursive: true });
  await fs.writeFile(cheminAbsolu, buffer, { flag: 'wx' });
  return path.join('quittances', String(annee), nomFichier);
}
```

**Déviations attendues pour `ecrireAvenant`** (D-93) :
- Strictement symétrique : remplacer `'quittances'` par `'avenants'` partout.
- Conserver `flag: 'wx'` (immutabilité — pas d'écrasement).
- Pour le **lire** : ajouter `lireAvenant(cheminRelatif)` strictement symétrique à `lireQuittance` (lignes 39-81 — protection path traversal + realpath + ENOENT mapping vers `FichierIntrouvable`).
- **Note** : peut-être généraliser en `ecrireDocument(type: 'quittances' | 'avenants', annee, nomFichier, buffer)` — décision planner (YAGNI vs DRY). Recommandation YAGNI : duplique pour V1, refactor si Phase 4 ajoute un 3ème type.

---

### `src/application/patrimoine/ajouter-diagnostic.ts` (use case)

**Analog:** `src/application/patrimoine/ajouter-lot.ts` (use case sub-aggregate add).

**Pourquoi :** Pattern exact : sub-aggregate add → lookup parent → `parent.ajouterX()` copy-on-write → `repo.enregistrer(parent)`.

**Code à inspecter :** `src/application/patrimoine/ajouter-lot.ts` (non lu intégralement mais analog confirmé par grep + classification — courte fonction).

**Déviations attendues** :
- Validation Zod côté HTTP (cf. `diagnostic-schemas.ts`).
- Le use case reçoit `{ bienId, type, dateEmission, classeDpe? }` et fait `bien.ajouterDiagnostic(Diagnostic.creer({...}))`.
- Throw `BienIntrouvable` si `bien === null` (pattern Phase 1).

---

### `src/application/locatif/enregistrer-edl.ts` (use case multi-repos avec invariant cross-aggregate)

**Analog:** `src/application/encaissements/activer-bail.ts` (multi-repo orchestration, vérification d'invariant business, throw si déjà fait).

**Multi-repo + invariant cross-aggregate pattern** (activer-bail.ts lignes 33-69) :
```ts
export async function activerBail(
  commande: ActiverBailCommande,
  bailRepo: BailRepository,
  echeanceLoyerRepo: EcheanceLoyerRepository,
  clock: Clock,
): Promise<ActiverBailResultat> {
  const bail = await bailRepo.trouverParId(commande.bailId);
  if (!bail) {
    throw new BailIntrouvable(commande.bailId);
  }

  if (bail.actifDepuis !== null) {
    throw new InvariantViolated('Ce bail est déjà activé');
  }

  // Activer le bail (méthode copy-on-write avec validation jourEcheance D-53)
  const bailActif = bail.activer(commande.actifDepuis, commande.jourEcheance);
  await bailRepo.enregistrer(bailActif);
  ...
}
```

**Déviations attendues pour `enregistrerEDL`** :
- Reçoit `BailRepository` + `EtatDesLieuxRepository` (D-89 cross-aggregate).
- Lookup `bail` puis lookup `etatDesLieuxRepo.trouverParBailEtType(bailId, type)`.
- Si type='entree' et déjà un EDL entrée actif → throw `EDLEntreeExisteDeja` (nouvelle erreur dans `domain/locatif/erreurs.ts`).
- Si type='sortie' et déjà un EDL sortie actif → throw `EDLSortieExisteDeja`.
- Warning **non bloquant** (retourné dans le résultat, pas exception) :
  - Si type='sortie' et pas d'EDL entrée actif → ajouter au résultat `warnings: ['EDL_ENTREE_ABSENT']` (D-85).
  - Si type='sortie' et `bail.actifDepuis !== null` et `commande.dateEdl < bail.dateDebut.add({months: bail.dureeMois})` → warning `EDL_SORTIE_AVANT_FIN` (D-84).
  - Si items obligatoires `present: false` → warning `MOBILIER_OBLIGATOIRE_MANQUANT` (D-98 + UI-SPEC copywriting).
- Construire `EtatDesLieux.creer({...})` puis `etatDesLieuxRepo.enregistrer(edl)`.
- Return `{ edlId, warnings }`.

---

### `src/application/locatif/appliquer-indexation-irl.ts` (use case multi-repos transactionnel + PDF)

**Analogs (hybride) :**
1. **D-73 régénération des échéances futures** : `src/application/locatif/modifier-bail-actif.ts` (lignes 96-141).
2. **PDF + compensation atomicity** : `src/application/encaissements/generer-quittance.ts` (lignes 121-176).

**D-73 régénération pattern** (modifier-bail-actif.ts lignes 60-141) :
```ts
// Étape 1 : calculer la preview (toujours)
const echeances = await echeanceLoyerRepo.listerParBail(bail.id);
const today = clock.aujourdhui();

const aRegenererIds: EcheanceLoyerId[] = [];
let aPreserverCount = 0;

for (const echeance of echeances) {
  const aDesEncaissementsActifs =
    (await encaissementRepo.listerParEcheance(echeance.id, { inclureAnnules: false })).length > 0;
  const estFuture = Temporal.PlainDate.compare(echeance.jourEcheanceAttendue, today) > 0;
  const aRegenerer =
    (echeance.statut === 'en_attente' || echeance.statut === 'partiellement_payee') &&
    estFuture && !aDesEncaissementsActifs;
  if (aRegenerer) { aRegenererIds.push(echeance.id); } else { aPreserverCount++; }
}

// Étape 2 : appliquer le patch et régénérer
const bailModifie = bail.modifier(commande.patch);
await bailRepo.enregistrer(bailModifie);

const periodesSupprimees = new Set(echeances.filter((e) => aRegenererIds.includes(e.id)).map((e) => e.periodeDebut.toString()));
await echeanceLoyerRepo.supprimerLot(aRegenererIds);

if (aRegenererIds.length > 0) {
  const toutesLesEcheances = genererEcheancesPour(bailModifie, bailModifie.actifDepuis!, bailModifie.jourEcheance);
  const nouvellesEcheances = toutesLesEcheances.filter((e) => periodesSupprimees.has(e.periodeDebut.toString()));
  await echeanceLoyerRepo.enregistrerBatch(nouvellesEcheances);
}
```

**PDF + compensation pattern** (generer-quittance.ts lignes 121-176) :
```ts
await (db as Kysely<DB>).transaction().execute(async (trx) => {
  numero = await repos.quittanceRepo.prochainNumero(annee, trx);
  ...
  quittance = Quittance.creer({ ... });
  await repos.quittanceRepo.enregistrer(quittance, trx);
});

// ─── Hors transaction : génération PDF + stockage avec compensation (CR-02) ─
try {
  const docDef = construireQuittance(...);
  const buffer = await pdfRenderer.genererBuffer(docDef);
  await stockage.ecrireQuittance(annee!, nomFichierFinal, buffer);
} catch (err) {
  try {
    const quittanceAnnulee = quittance!.annuler(...);
    await repos.quittanceRepo.enregistrer(quittanceAnnulee);
  } catch (compErr) {
    console.error(`[CRITICAL] generer-quittance compensation failed ...`);
  }
  throw err;
}
```

**Déviations attendues pour `appliquerIndexationIRL`** (D-94) :
- Repos requis : `BailRepository`, `BienRepository`, `BailIndexationRepository`, `EcheanceLoyerRepository`, `EncaissementRepository`, `LocataireRepository`, `BailleurRepository`, `PdfRenderer`, `StockageFichierLocal`, `Clock`, `Kysely<DB>`.
- Étapes (D-94) :
  1. Lookup `bail` (BailIntrouvable si absent).
  2. Lookup `bien` (pour `classeDpe`).
  3. Vérifier **pre-condition gel** : si `bien.estGelLoyer()` → throw `GelLoyerClimatActif` (défense en profondeur, déjà filtré côté UI mais le domaine doit refuser aussi).
  4. **Transaction Kysely** :
     - `bailModifie = bail.appliquerIndexation(irlNouveau, dateEffet)` (copy-on-write loyer + irlReference).
     - `bailRepo.enregistrer(bailModifie, trx)` (s'il accepte trxArg, sinon orchestration légèrement différente).
     - Régénération échéances futures : pattern D-73 exact (filtre `en_attente`/`partiellement_payee` ET `periodeDebut >= dateEffet` ET pas d'encaissement actif), `supprimerLot` puis `enregistrerBatch` avec `genererEcheancesPour(bailModifie, ...)`.
     - `bailIndexationRepo.enregistrer(BailIndexation.creer({ ..., indexationAppliquee: true, raisonNonApplication: null }), trx)`.
  5. **Hors transaction** : génération PDF avenant + stockage (avec compensation si erreur — pattern Quittance lignes 142-176). Compensation = soft-cancel… mais `BailIndexation` est append-only D-96 ! → **alternative** : ne pas faire de compensation BD (laisser l'indexation appliquée), logger l'erreur PDF en CRITICAL. Le bailleur retéléchargera le PDF via une route `/baux/:id/avenant/:annee` qui le regénère à la volée si absent (cf. `lireQuittance` lignes 39-81). **Décision planner.**
- Return `{ bailIndexationId, nouveauLoyerHc, echeancesRegenerees, cheminFichierRelatifAvenant }`.

---

### `src/web/schemas/diagnostic-schemas.ts` + `edl-schemas.ts` + `indexation-schemas.ts` (Zod schemas)

**Analog:** `src/web/schemas/bien-schemas.ts` (Zod schemas + helper `normaliserLotsFormBody`).

**Zod schema simple pattern** (bien-schemas.ts lignes 35-49) :
```ts
export const bienCreationSchema = z.object({
  rue: z.string().trim().min(1, 'La rue est obligatoire.'),
  codePostal: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres.'),
  ville: z.string().trim().min(1, 'La ville est obligatoire.'),
  surface: z.coerce.number().positive('La surface doit être > 0.'),
  type: z.enum(['appartement', 'maison', 'immeuble', 'local_commercial'], {
    errorMap: () => ({ message: "Le type de bien est invalide." }),
  }),
  ...
});
```

**Helper checkbox/array form pattern** (bien-schemas.ts lignes 75-90 — pour `normaliserLotsFormBody`) :
```ts
export function normaliserLotsFormBody(body: Record<string, string | string[]>): unknown[] {
  const lotsMap = new Map<number, Record<string, unknown>>();
  for (const [cle, valeur] of Object.entries(body)) {
    const match = /^lots\[(\d+)\]\.(.+)$/.exec(cle);
    if (!match) continue;
    const index = parseInt(match[1]!, 10);
    const prop = match[2]!;
    if (!lotsMap.has(index)) lotsMap.set(index, {});
    lotsMap.get(index)![prop] = valeur;
  }
  return Array.from(lotsMap.entries()).sort(([a], [b]) => a - b).map(([, obj]) => obj);
}
```

**Déviations attendues** :

**`diagnostic-schemas.ts`** :
```ts
export const diagnosticCreationSchema = z.object({
  type: z.enum(['dpe', 'gaz', 'elec', 'erp'], { errorMap: () => ({ message: 'Type de diagnostic invalide.' }) }),
  date_emission: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date attendu : AAAA-MM-JJ.'),
  classe_dpe: z.enum(['A','B','C','D','E','F','G']).optional(),  // requis si type='dpe' via superRefine
}).superRefine((data, ctx) => {
  if (data.type === 'dpe' && !data.classe_dpe) {
    ctx.addIssue({ code: 'custom', path: ['classe_dpe'], message: 'La classe DPE est obligatoire pour un diagnostic DPE.' });
  }
});
```

**`edl-schemas.ts`** : nécessite un `normaliserInventaireFormBody(body)` qui reconstruit `inventaire[0].typeItem, inventaire[0].present, inventaire[0].etat, inventaire[0].note, inventaire[1]...`. Pattern strictement transposé de `normaliserLotsFormBody` (regex `/^inventaire\[(\d+)\]\.(.+)$/`).

**`indexation-schemas.ts`** :
```ts
export const indexationSaisieSchema = z.object({
  irl_trimestre: z.string().regex(/^\d{4}-T[1-4]$/, 'Format trimestre attendu : YYYY-TN (ex. 2026-T1).'),
  irl_valeur: z.string().regex(/^\d+(\.\d+)?$/, 'La valeur IRL doit être un nombre positif.'),
});
```

**Note UI-SPEC §Zod** : le format trimestre est `1T2026` dans UI-SPEC mais `YYYY-TN` dans `IRL.ts` (regex `/^\d{4}-T[1-4]$/`). **Aligner sur le domaine** (`YYYY-TN`) ou ajouter un transform Zod `1T2026 → 2026-T1`. Recommandation : aligner UI-SPEC sur le domaine — le planner doit signaler cette divergence pour décision.

---

### `src/web/routes/diagnostics.ts` + `etats-des-lieux.ts` + `indexations.ts` (Fastify route plugins)

**Analog:** `src/web/routes/biens.ts` (CRUD complet avec nested sub-aggregate) pour Diagnostics et EDL ; `src/web/routes/wizard.ts` (multi-step orchestration avec session) + `src/web/routes/quittances.ts` (PDF download + bannières + safeParse pattern) pour Indexations.

**Plugin signature + safeParse + erreur re-render pattern** (biens.ts lignes 20-82) :
```ts
export async function plugin(
  app: FastifyInstance,
  opts: { repo: BienRepository },
): Promise<void> {

  app.post('/biens', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const lotsRaw = normaliserLotsFormBody(body);
    const parsed = bienCreationSchema.safeParse({ ...body, lots: lotsRaw });

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      const lots = lotsRaw.length > 0 ? lotsRaw : [{ designation: '', type: 'appartement', surface: '', etage: '' }];
      return reply.view('pages/biens/formulaire.ejs', {
        mode: 'creation', bien: null, lots, valeurs: body, erreurs,
      });
    }

    try {
      const { rue, codePostal, ville, surface, type, anneeConstruction, lots } = parsed.data;
      const bienId = await creerBien({ ... }, opts.repo);
      return reply.redirect('/biens/' + bienId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      return reply.view('pages/biens/formulaire.ejs', { ..., erreurs: { _global: message } });
    }
  });
}

function extraireErreurs(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const cle = issue.path.join('.') || '_global';
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}
```

**Wizard multi-step + session pattern** (wizard.ts lignes 27-37 + 71-100) :
```ts
interface WizardSession {
  bienId?: string;
  locataireId?: string;
}

declare module 'fastify' {
  interface Session {
    wizard?: WizardSession;
    banniereSuccess?: string;
    banniereWarning?: string;
  }
}

app.get('/wizard/bien', async (_req, reply) => {
  return reply.view('pages/wizard/bien.ejs', { currentStep: 1, totalSteps: 3, valeurs: {}, erreurs: {} });
});

app.post('/wizard/bien', async (req, reply) => {
  const body = req.body as Record<string, string>;
  const lotsRaw = normaliserLotsFormBody(body);
  const parsed = bienCreationSchema.safeParse({ ...body, lots: lotsRaw });
  if (!parsed.success) { ... }
  ...
});
```

**PDF download pattern** (quittances.ts lignes 164-186) :
```ts
app.get('/quittances/:id/pdf', async (req, reply) => {
  const { id } = req.params as { id: string };
  const quittance = await opts.quittanceRepo.trouverParId(id as QuittanceId);
  if (!quittance) { return reply.code(404).send('Quittance introuvable.'); }

  try {
    const buffer = await opts.stockage.lireQuittance(quittance.cheminFichierRelatif);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="quittance-${quittance.numero}.pdf"`)
      .send(buffer);
  } catch (err) {
    if (err instanceof FichierIntrouvable) {
      return reply.code(404).send(`Fichier PDF introuvable. Régénérez la quittance.`);
    }
    throw err;
  }
});
```

**Déviations attendues** :

**`diagnostics.ts`** :
- Routes : `GET /biens/:id/diagnostics/nouveau`, `POST /biens/:id/diagnostics`. La fiche `/biens/:id` reste sur `biens.ts` (section diagnostics rendue via la même route via lookup + injection dans `bien` locals).
- Erreurs : `BienIntrouvable` (Phase 1).

**`etats-des-lieux.ts`** :
- 6 routes (UI-SPEC §Route Map) : `GET /baux/:id/edl/entree`, `GET /baux/:id/edl/entree/nouveau`, `POST /baux/:id/edl/entree`, `GET /baux/:id/edl/sortie`, `GET /baux/:id/edl/sortie/nouveau`, `POST /baux/:id/edl/sortie`.
- Le `formulaire.ejs` est **partagé** entrée/sortie via discriminant `type` passé en locals (UI-SPEC §LOC-03).
- Empty-state si EDL absent (pattern `empty-state.ejs`).
- Erreurs : `BailIntrouvable`, `EDLEntreeExisteDeja`, `EDLSortieExisteDeja`.

**`indexations.ts`** :
- 6 routes (UI-SPEC §Route Map) : `GET /baux/:id/indexer` (wizard étape 2), `POST /baux/:id/indexer/simuler`, `POST /baux/:id/indexer/confirmer`, `POST /baux/:id/indexer/appliquer`, `POST /baux/:id/indexer/renoncer`, `GET /baux/:id/avenant/:annee` (PDF download).
- Session : stocker `req.session.indexationDraft = { irlTrimestre, irlValeur }` entre étapes 2→3→4 (pattern Wizard session).
- Étape 2 : si `bien.estGelLoyer()` → render `pages/baux/indexer/gel-loyer.ejs` au lieu du form (UI-SPEC §LOC-04 D-92, bloc bloquant `role="alert"` + bouton unique "Compris").
- Étape 3 : `simulerIndexationIRL` use case + render `simulation.ejs` avec tableau comparatif.
- Étape 4 : render `confirmation.ejs` avec deux boutons (Appliquer / Ne pas indexer).
- POST appliquer : use case `appliquerIndexationIRL` + `req.session.banniereSuccess = "Révision IRL appliquée…"` + redirect `/baux/:id`.
- POST renoncer : use case `renoncerIndexationIRL` (similaire à `appliquer` mais pas de pivot loyer, pas de PDF, juste `BailIndexation.creer({ indexationAppliquee: false, raisonNonApplication: 'refus_bailleur', loyerApres: bail.loyerHc })`).
- GET avenant PDF : pattern `quittances/:id/pdf` exact (lookup `bailIndexation` par bailId + annee + indexationAppliquee=true, puis `stockage.lireAvenant(...)`).

---

### `src/web/views/pages/biens/diagnostics/formulaire.ejs` + `pages/baux/edl/*.ejs` + `pages/baux/indexer/*.ejs`

**Analog (forms)** : `src/web/views/pages/biens/formulaire.ejs` (form 1 colonne, label-au-dessus, `<%- include('../../partials/form-field') %>` partial usage).

**Analog (wizard)** : `src/web/views/partials/wizard-layout.ejs` + `src/web/views/pages/wizard/bien.ejs` (étapes numérotées via `<ol aria-label>...`).

**Layout split pattern** (biens/detail.ejs lignes 1-5 + dernière ligne) :
```ejs
<%- include('../../partials/layout-debut', {
  titre: bien.adresse.enLigne(),
  breadcrumbs: [{ url: '/biens', label: 'Biens' }, { label: bien.adresse.enLigne() }],
  navActive: 'biens'
}) %>

<h1><%= bien.adresse.enLigne() %></h1>
...
<%- include('../../partials/layout-fin') %>
```

**Form field partial usage** (biens/detail.ejs lignes 78-115) :
```ejs
<form method="POST" action="/biens/<%= bien.id %>/lots" novalidate>
  <%- include('../../partials/form-field', {
    id: 'ajout-lot-designation',
    name: 'designation',
    label: 'Désignation',
    value: '',
    erreur: locals.erreurAjoutLot || null
  }) %>
  <div class="field">
    <label for="ajout-lot-type">Type de lot <span aria-hidden="true">*</span></label>
    <select id="ajout-lot-type" name="type" required>
      <option value="appartement">Appartement</option>
      ...
    </select>
  </div>
  <button type="submit">Ajouter un lot</button>
</form>
```

**Wizard step indicator pattern** (wizard-layout.ejs lignes 20-30) :
```ejs
<nav aria-label="Étapes du wizard d'activation">
  <ol>
    <% etapes.forEach(function(etape) { %>
      <li<% if (etape.num === currentStep) { %> aria-current="step"<% } %>>
        <%= etape.num %>. <%= etape.label %>
      </li>
    <% }); %>
  </ol>
</nav>

<p><small>Étape <%= currentStep %> sur <%= totalSteps %></small></p>
```

**Déviations attendues** :
- Le formulaire EDL contient un `<fieldset><legend>Mobilier obligatoire (décret 2015-981)</legend>` enveloppant 12 lignes (UI-SPEC §LOC-03) — chaque ligne = checkbox `present` + select `etat` (disabled si `present:false`) + textarea `note`. Préférer **un partial dédié `partial-edl-form.ejs`** pour ne pas dupliquer entrée/sortie.
- Wizard IRL = 5 étapes (au lieu de 3 dans `wizard-layout.ejs`). Soit créer un wizard-layout dédié `wizard-irl-layout.ejs`, soit paramétrer `etapes` en locals. Recommandation planner : créer un partial dédié `wizard-irl-layout.ejs` (les étapes IRL sont métier-spécifiques).
- Étape 4 (confirmation IRL) : deux boutons côte à côte (primary "Appliquer la révision" + secondary "Ne pas indexer cette année") + paragraphe explicatif D-95 exact wording (UI-SPEC §Copywriting).

---

### Partials nouveaux (`partial-badge-dpe.ejs`, `partial-diagnostic-row.ejs`, etc.)

**Analogs** :
- `partial-badge-dpe.ejs` : pas d'analog direct (premier badge inline coloré). Pattern : inline `<span style="background: ...">` avec `aria-label`. Cf. UI-SPEC §Color §DPE badge color map pour les 8 couleurs.
- `partial-diagnostic-row.ejs` : pas indispensable — `data-table.ejs` accepte des rangées arbitraires via `lignes: [...]`. Si nécessaire, suivre le pattern d'une **fonction helper** comme `tableActions` plutôt qu'un partial (data-table.ejs lignes 28-37). **Décision planner** : créer ce partial seulement s'il y a duplication.
- `partial-edl-form.ejs` : extension `form-field.ejs` style. Structure : `<fieldset>` + boucle 12 items.
- `partial-inventaire-display.ejs` : analog `pages/baux/detail.ejs` lignes 12-31 (section `<dl>` + `<ul>`). HTML pur lecture-seule.
- `partial-inventaire-warnings.ejs` : réutilise directement `banniere-warning.ejs` avec une boucle sur `warnings[]`.
- `partial-indexation-banner.ejs` : pattern `banniere-warning.ejs` mais avec un `<a href>` cliquable. Référence UI-SPEC §Banner.

---

### `src/helpers/format-*.ts` (6 nouveaux helpers DP-18)

**Analog:** `src/helpers/format-date.ts` + `src/helpers/format-money.ts`.

**Existing pattern** (format-date.ts intégral) :
```ts
import { Temporal } from '@js-temporal/polyfill';

/**
 * Formate un Temporal.PlainDate en format légal français DD/MM/YYYY.
 * Retourne '—' (em dash) si la date est null/undefined.
 */
export function formatDate(date: Temporal.PlainDate | null | undefined): string {
  if (!date) return '—';
  const d = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${d}/${m}/${date.year}`;
}
```

**Déviations attendues** :
- 6 helpers exportés (DP-18 + UI-SPEC §New Helpers).
- Tous purs, retournent `string`, prennent un argument (parfois deux pour `formaterStatutDiagnostic(dateExp, today)`).
- Injectés dans `reply.locals` via `app.addHook('preHandler', ...)` dans `main.ts` (cf. main.ts lignes 122-129 — pattern existant).

**Note importante** : `formaterStatutDiagnostic(dateExp, today)` prend `today` en paramètre — pas d'accès `Clock` (déterminisme, pattern BDD_PRACTICES.md). Le hook preHandler devra injecter `today = clock.aujourdhui()` pour que les vues puissent appeler `formaterStatutDiagnostic(d.dateExpiration, today)`.

---

### `tests/_builders/patrimoine.ts` (modifié) + `tests/_builders/locatif.ts` (modifié)

**Analog:** `tests/_builders/patrimoine.ts` (lignes 25-49 — `unLotValide` + `unBienValide` factory builders avec overrides).

**Builder pattern** :
```ts
interface OverridesLot {
  id?: LotId;
  designation?: string;
  surface?: number | null;
  type?: TypeLot;
  etage?: number | null;
}

export function unLotValide(overrides: OverridesLot = {}): Lot {
  return Lot.creer({
    designation: overrides.designation ?? 'Appartement principal',
    surface: overrides.surface !== undefined ? overrides.surface : 50,
    type: overrides.type ?? 'appartement',
    etage: overrides.etage !== undefined ? overrides.etage : null,
    id: overrides.id,
  });
}
```

**Déviations attendues** :
- `unDiagnosticValide(overrides = {})`: defaults `type: 'dpe'`, `dateEmission: '2025-01-01'`, `classeDpe: 'D'`.
- `unInventaireItemValide(overrides = {})`: defaults `typeItem: 'literie'`, `present: true`, `etat: 'bon'`, `note: null`.
- `inventaireComplet12()` helper : retourne les 12 `InventaireItem` valides (état `bon`, présent) — équivalent à un "happy path" complet.
- `unEtatDesLieuxEntreeValide(overrides = {})`: defaults `bailId: nouveauBailId()`, `type: 'entree'`, `dateEdl: '2026-05-01'`, `contradictoire: true`, `dateSignature: '2026-05-01'`, `inventaire: inventaireComplet12()`.
- `unEtatDesLieuxSortieValide(overrides = {})`: idem mais `type: 'sortie'`.
- `uneBailIndexationValide(overrides = {})`: defaults `bailId: nouveauBailId()`, `dateEffet: '2027-05-01'`, IRL avant/après plausibles, loyers avant/après cohérents, `indexationAppliquee: true`, `raisonNonApplication: null`.

---

### `tests/unit/patrimoine/diagnostic.test.ts` + `etat-des-lieux.test.ts` + `bail-indexation.test.ts`

**Analog:** `tests/unit/locatif/cautionnement.test.ts` (factory + invariants Vitest).

**Vitest factory test pattern** (cautionnement.test.ts lignes 15-50) :
```ts
import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Cautionnement } from '../../../src/domain/locatif/cautionnement.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

describe('Cautionnement', () => {
  it("creer type='physique' avec garant complet — ne throw pas", () => {
    expect(() => Cautionnement.creer({ type: 'physique', garant: garnatValide, ... })).not.toThrow();
  });

  it("creer type='visale' sans garant (organisme) — ne throw pas", () => {
    expect(() => Cautionnement.creer({ type: 'visale', garant: null, ... })).not.toThrow();
  });

  it('creer type hors enum — throw InvariantViolated', () => {
    expect(() => Cautionnement.creer({ type: 'bancaire' as 'physique', ... })).toThrow(InvariantViolated);
  });

  it('creer durée_engagement < 1 mois — throw InvariantViolated', () => {
    expect(() => Cautionnement.creer({ ..., dureeEngagement: 0 })).toThrow(InvariantViolated);
  });
});
```

**Déviations attendues** :
- Pour `Diagnostic` : tester par `type` toutes les `DUREES_VALIDITE` (DPE→10 ans, gaz→6, élec→6, ERP→null), tester `estExpire(today)` (avant/après).
- Pour `EtatDesLieux` : tester invariant `inventaire.length === 12`, `dateSignature` requise si `contradictoire`, type enum strict, méthode `annuler()`.
- Pour `BailIndexation` : tester invariants append-only (pas de méthode `annuler` ; `loyerApres === loyerAvant` si non-appliquée).
- Pour `Bail.simulerIndexation` : tester gel DPE F/G (retourne `gelLoyer: true` + `loyerHc` inchangé), tester calcul avec valeurs IRL réelles (ex INSEE 4T2025 = 145.47, 4T2024 = 142.06 → ratio 1.024 → loyer 800€ → 819,21€).
- Pour `Bail.dateAnniversaireProchaine` : tester `today < dateDebut`, `today > dateDebut + N×1an`, edge cases bissextile.

---

### `tests/unit/locatif/comparer-inventaires.test.ts` (domain service)

**Analog (rôle uniquement) :** pas d'analog direct. Suivre le **même style Vitest** que `cautionnement.test.ts` + `bail.test.ts` mais sur fonction pure :

```ts
import { describe, it, expect } from 'vitest';
import { comparerInventaires } from '../../../src/domain/locatif/comparer-inventaires.js';
import { unEtatDesLieuxEntreeValide, unEtatDesLieuxSortieValide } from '../../_builders/locatif.js';

describe('comparerInventaires', () => {
  it('inventaires identiques → 0 warning', () => {
    const entree = unEtatDesLieuxEntreeValide();
    const sortie = unEtatDesLieuxSortieValide(); // tous items présents état bon
    expect(comparerInventaires(entree, sortie)).toEqual([]);
  });

  it("item présent entrée + absent sortie → WARNING_ITEM_DISPARU", () => { ... });

  it("item présent entrée bon + présent sortie dégradé → WARNING_ITEM_DEGRADE", () => { ... });

  it("item absent entrée + présent sortie → ignoré (locataire a ajouté du mobilier)", () => { ... });
});
```

100% couverture obligatoire (D-101 = logique métier).

---

### `tests/bdd/features/*.feature` + `tests/bdd/step_definitions/*.steps.ts`

**Analog:** `tests/bdd/features/enc02-activation-bail.feature` (scenarios métier) + `tests/bdd/step_definitions/enc02.steps.ts` (Before/After + Given/When/Then).

**Feature file pattern** (enc02-activation-bail.feature lignes 1-15) :
```gherkin
@enc-02 @phase2
Feature: Activation bail et génération d'échéances (ENC-02)

  Background:
    Given l'application est prête pour ENC-02 avec clock fixe "2026-05-01"
    And un bail brouillon ENC-02 existe avec loyer 620, charges 80, durée 12

  Scenario: Activation d'un bail brouillon génère les échéances (ENC-02)
    When le bailleur active le bail avec actif_depuis "2026-05-01" et jour_echeance 5
    Then 12 EcheanceLoyer existent en base pour ce bail
    And la page GET baux echeances liste 12 lignes
```

**Steps Before/After tag-isolated pattern** (enc02.steps.ts lignes 71-92) :
```ts
Before({ tags: '@enc-02' }, async function (this: MondeEnc02) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  this.sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  this.clockIso = '2026-05-01';
  const clock = ClockFixe.du(this.clockIso);
  this.app = await creerApp(this.db, { clock });
  ...
});

After({ tags: '@enc-02' }, async function (this: MondeEnc02) {
  if (this.app) await this.app.close();
  if (this.db) await this.db.destroy();
});
```

**Déviations attendues** :
- Tags Phase 3 : `@pat-03`, `@loc-03`, `@loc-04`, `@loc-05`, `@loc-06`, `@phase3`.
- 5 features files (un par REQ).
- Each steps file isole sa world via `Before({ tags: '@req-xx' })` — pattern strict Phase 2.
- Réutiliser `creerApp(db, { clock })`, `appliquerToutesMigrations`, `unBailValide`, `unBienValide` (builders existants).
- Scenarios obligatoires (BDD_PRACTICES.md §8 cas obligatoires) à couvrir Phase 3 :
  - **PAT-03** : calcul date_expiration par type (DPE 10 ans, gaz 6, élec 6, ERP null), badge expiré, historique préservé.
  - **LOC-03** : EDL entrée + sortie + invariant ≤1 par type, soft-delete, warnings delta.
  - **LOC-04** : formule IRL (cas légal réel), pivot irlReference, régénération échéances futures, avenant PDF généré.
  - **LOC-05** : gel DPE F/G refuse l'indexation (statut HTTP, message exact).
  - **LOC-06** : checklist mobilier 12 items, warning requalification, warning EDL entrée si items absents.

---

## Shared Patterns

### Soft-delete + raison + Clock

**Source:** `src/domain/encaissements/encaissement.ts` lignes 84-93 + `src/domain/encaissements/quittance.ts` lignes 74-87.

**Apply to:** `EtatDesLieux.annuler(raison, annuleLe)` (D-89 correction), `Diagnostic` (pas de cancel V1, mais préparer une méthode `marquerCommeRemplace(remplaceLe)` si besoin Phase 7).

```ts
annuler(raison: string, annuleLe: Temporal.PlainDate): Encaissement {
  if (this.annuleLe !== null) {
    throw new InvariantViolated('Cet encaissement est déjà annulé');
  }
  return Encaissement.creer({
    ...this.toProps(),
    annuleLe,
    raisonAnnulation: raison,
  });
}
```

---

### Erreurs domaine par bounded context

**Source:** `src/domain/locatif/erreurs.ts` (`BailIntrouvable`, `LocataireIntrouvable`) + `src/domain/encaissements/erreurs.ts` (`EcheanceLoyerIntrouvable`, `QuittanceDejaEmise`, etc.).

**Apply to:** Nouvelles erreurs Phase 3 (Phase 1 LEARNING §Erreurs domaine par bounded context) :
- `src/domain/patrimoine/erreurs.ts` (étendre) : `DiagnosticIntrouvable`.
- `src/domain/locatif/erreurs.ts` (étendre) : `EtatDesLieuxIntrouvable`, `EDLEntreeExisteDeja`, `EDLSortieExisteDeja`, `GelLoyerClimatActif`, `BailIndexationIntrouvable`.

Pattern (encaissements/erreurs.ts existant) :
```ts
export class EcheanceLoyerIntrouvable extends Error {
  constructor(id: string) {
    super(`Échéance ${id} introuvable.`);
    this.name = 'EcheanceLoyerIntrouvable';
  }
}
```

---

### Money.multiplyByFraction avec banker's rounding (DP-16)

**Source:** `src/domain/_shared/money.ts` lignes 148-178.

**Apply to:** `Bail.simulerIndexation` (calcul `loyer × (IRL_apres / IRL_avant)`).

```ts
multiplyByFraction(num: bigint, den: bigint, mode: 'banker' | 'floor' | 'ceil' = 'banker'): Money {
  if (den <= 0n) throw new InvariantViolated('Le dénominateur du prorata doit être positif');
  if (num < 0n || num > den) throw new InvariantViolated('La fraction de prorata doit être entre 0 et 1');

  const produit = this.centimes * num;
  const quotient = produit / den;
  const reste = produit % den;
  ...
  // Banker's rounding (round-half-to-even)
  const deuxFois = reste * 2n;
  if (deuxFois === den) {
    return Money.fromCentimes(quotient % 2n === 0n ? quotient : quotient + 1n);
  }
  return Money.fromCentimes(deuxFois > den ? quotient + 1n : quotient);
}
```

**Note Phase 3** : pour l'indexation IRL, la fraction peut être > 1 (hausse de loyer). La signature actuelle interdit `num > den`. **Décision planner** : étendre `Money.multiplyByFraction` pour accepter `num > den` (cas indexation hausse) OU créer une nouvelle méthode `Money.multiplyByRatio(num, den, mode)`. Recommandation : nouvelle méthode (pas casser l'invariant existant utilisé pour prorata).

---

### IRL VO + sérialisation plate (trimestre+valeur)

**Source:** `src/domain/_shared/irl.ts` + `src/infrastructure/repositories/bail-repository-sqlite.ts` lignes 36-37 + 169-173.

**Apply to:** `bail_indexations` table (colonnes `irl_avant_trimestre`, `irl_avant_valeur`, `irl_apres_trimestre`, `irl_apres_valeur` — pattern flat ; D-96).

```ts
// Écriture
irl_trimestre: bail.irlReference.trimestre,
irl_valeur: bail.irlReference.valeur,

// Lecture
const irlReference = IRL.creer({
  trimestre: row.irl_trimestre,
  valeur: row.irl_valeur,
});
```

---

### Temporal.PlainDate ↔ TEXT ISO

**Source:** `src/infrastructure/repositories/encaissement-repository-sqlite.ts` lignes 38-40 + 116-119.

**Apply to:** Toutes les nouvelles tables (diagnostics, etat_des_lieux, bail_indexations) pour les colonnes date.

```ts
// Écriture
date: encaissement.date.toString(),
annule_le: encaissement.annuleLe?.toString() ?? null,

// Lecture
date: Temporal.PlainDate.from(row.date),
annuleLe: row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null,
```

---

### Money INTEGER centimes ↔ BigInt

**Source:** `src/domain/_shared/money.ts` lignes 49-56 (`toSqliteInteger`) + `src/infrastructure/repositories/encaissement-repository-sqlite.ts` ligne 35 + 109-111.

**Apply to:** `bail_indexations.loyer_avant_centimes` et `loyer_apres_centimes`.

```ts
// Écriture
montant_centimes: encaissement.montant.toSqliteInteger(),

// Lecture
const montant = centimes >= 0
  ? Money.fromCentimes(BigInt(centimes))
  : Money.compensateur(Money.fromCentimes(BigInt(-centimes)));
```

**Note Phase 3** : `loyer_*_centimes` toujours positifs → pas besoin de `Money.compensateur`. Simplement `Money.fromCentimes(BigInt(row.loyer_avant_centimes))`.

---

### preHandler inject helpers dans `reply.locals`

**Source:** `src/main.ts` lignes 122-129.

**Apply to:** Phase 3 — ajouter les 6 nouveaux helpers (`formaterClasseDpe`, `formaterTypeDiagnostic`, `formaterEtatItem`, `formaterTrimestreIRL`, `formaterStatutDiagnostic`, `formaterRaisonNonApplication`) + éventuellement `today: clock.aujourdhui()` pour `formaterStatutDiagnostic`.

```ts
app.addHook('preHandler', async (_req, reply) => {
  reply.locals = {
    ...(reply.locals ?? {}),
    formatDate,
    formatMoney,
    formatPeriode,
    // Phase 3
    formaterClasseDpe,
    formaterTypeDiagnostic,
    formaterEtatItem,
    formaterTrimestreIRL,
    formaterStatutDiagnostic,
    formaterRaisonNonApplication,
    today: clock.aujourdhui(),
  };
});
```

---

### Bannières via session + redirect

**Source:** `src/web/routes/quittances.ts` lignes 103-110 + 131-134.

**Apply to:** Tous les POST de création/modification Phase 3 (diagnostics, EDL, indexation).

```ts
req.session.banniereSuccess = `Quittance n° ${numero} générée avec succès.`;
return reply.redirect(`/quittances/${quittanceId}`);

// ...côté GET:
const banniereSuccess = req.session.banniereSuccess ?? null;
const banniereWarning = req.session.banniereWarning ?? null;
if (banniereSuccess) req.session.banniereSuccess = undefined;
if (banniereWarning) req.session.banniereWarning = undefined;
```

**Note** : `Session` interface étendue via `declare module 'fastify'` — déjà fait dans `wizard.ts` lignes 32-38, étendre si besoin pour `indexationDraft`.

---

### Path traversal protection sur les fichiers PDF

**Source:** `src/infrastructure/storage/stockage-fichier-local.ts` lignes 39-81 (`lireQuittance`).

**Apply to:** `lireAvenant` (nouvelle méthode symétrique sur le même `StockageFichierLocal`). Reproduire à l'identique : NULL byte check, `path.resolve` boundary, `fs.realpath` double-check.

---

### `comparerInventaires` retourne Warning[] (pas exceptions)

**Source:** pattern interne UI-SPEC + D-101.

**Apply to:** Tous les use cases qui peuvent émettre des warnings non bloquants (D-80 diagnostic expiré, D-84 EDL sortie avant fin, D-85 EDL entrée absent, D-98 mobilier manquant).

**Convention** : `Warning` est un type avec `{ code: string, message: string, contexte?: object }` retourné dans le résultat du use case ou affiché via `req.session.banniereWarning`. Jamais via `throw` (réservé aux invariants bloquants).

---

## No Analog Found

Aucun fichier sans analog identifiable. Tout Phase 3 réutilise un pattern existant Phase 1 ou Phase 2.

Quelques **patterns nouveaux** sans précédent (à clarifier en planning, marqués `new` dans la classification) :

| File | Pourquoi pas d'analog |
|---|---|
| `src/domain/patrimoine/duree-validite-diagnostic.ts` | Première constante domaine pure (sans factory) — pattern à inventer mais trivial : `export const DUREES_VALIDITE: Record<TypeDiagnostic, { annees: number \| null }> = { dpe: { annees: 10 }, gaz: { annees: 6 }, elec: { annees: 6 }, erp: { annees: null } };`. Documenter R1.1 RISKS.md (versionneable LF). |
| `src/domain/locatif/comparer-inventaires.ts` | Premier "domain service" pure isolé (fonction libre). Phase 2 a `genererEcheancesPour` mais dans le use case, pas le domaine. Pattern recommandé : fichier dédié dans `domain/locatif/` (cohérence DDD §4.4 stateless service). |
| `src/web/views/partials/partial-badge-dpe.ejs` | Premier badge inline coloré. Pattern Pico.css : inline `style=` + `aria-label`. UI-SPEC §Color §DPE badge color map donne la table de correspondance complète. |

---

## Metadata

**Analog search scope:**
- `src/domain/` (tous bounded contexts : `_shared`, `patrimoine`, `locatif`, `encaissements`, `identite`)
- `src/application/` (use cases existants — multi-repos, transactionnels, PDF, soft-cancel)
- `src/infrastructure/` (repositories Kysely, PDF pdfmake, storage local, db migrations)
- `src/web/` (routes Fastify, schemas Zod, views EJS, partials)
- `src/helpers/` (format helpers existants)
- `tests/_builders/`, `tests/unit/`, `tests/bdd/features/`, `tests/bdd/step_definitions/`
- `migrations/` (root project, 6 fichiers SQL Phase 1+2)

**Files scanned:** 38 source files lus en détail (factories, repos, routes, views, helpers, tests) + 6 migrations SQL + 4 documents de contexte (CONTEXT, UI-SPEC, CLAUDE.md, 01-LEARNINGS partial).

**Conventions respected:**
- French ubiquitous language strict (jamais "Diagnostic" anglicisé, jamais "Inventory", toujours `Diagnostic`/`EtatDesLieux`/`InventaireItem`/`BailIndexation`).
- DDD hexagonal pur (domaine sans import technique — vérifié par dependency-cruiser projet).
- 100% couverture logique fiscale (formule IRL, gel DPE, dates expiration diagnostics).
- Cucumber `Feature/Scenario/Given/When/Then` en anglais ; texte des steps en français.

**Pattern extraction date:** 2026-05-16

---

## PATTERN MAPPING COMPLETE

**Phase:** 03 - Conformité du bail — Diagnostics, EDL, IRL, Mobilier
**Files classified:** 53 (38 new + 15 modifiés/étendus)
**Analogs found:** 53 / 53 (3 marqués `new` avec convention recommandée explicite)

### Coverage
- Files with exact analog: 28
- Files with role-match analog: 12
- Files with hybrid analog (2-3 sources combinées): 10
- Files with no analog (new pattern documenté): 3

### Key Patterns Identified
- **Sub-aggregate management via factory + copy-on-write (`Bien.ajouterDiagnostic`)** — strict reuse du pattern `Lot` Phase 1 D-29.
- **JSON inline storage pour VOs imbriqués (`InventaireItem[]` sur `etat_des_lieux.inventaire`)** — strict reuse du pattern `Cautionnement` Phase 1 D-33.
- **Append-only table avec ligne par événement (`bail_indexations`)** — strict reuse du pattern `Encaissement` Phase 2 D-60.
- **Régénération transactionnelle des échéances futures `en_attente`/`partiellement_payee`** — strict reuse du pattern D-73 Phase 2.
- **PDF pdfmake mentions légales loi 89 + persistance locale + compensation** — strict reuse du pattern Quittance Phase 2 D-63.
- **Wizard multi-step via session + 6 routes Fastify** — strict reuse du pattern wizard Phase 1 + extension à 5 étapes IRL.
- **Helpers preHandler injectés dans `reply.locals`** — strict reuse du pattern Phase 1/2 + ajout 6 helpers DP-18.
- **BDD outside-in avec tags isolés `@req-xx` + `Before/After` tag-filtered** — strict reuse du pattern Phase 2 `enc02.steps.ts`.
- **Money.multiplyByFraction banker's rounding** — extension nécessaire (fraction > 1 pour hausse de loyer) — décision planner.

### Critical Plannings Decisions to Surface
1. **DP-14** : recommandation pattern `Bien.ajouterDiagnostic(d)` qui sync `classeDpe` interne (cf. section Diagnostic.ts).
2. **DP-15** : table dédiée `diagnostics` confirmée (pas JSON inline — queryable Phase 7).
3. **DP-16** : étendre `Money.multiplyByFraction` ou créer `Money.multiplyByRatio` pour accepter `num > den`.
4. **DP-19** : migration unique `0007_phase3_init.sql` enveloppée dans `BEGIN TRANSACTION` (pattern 0002).
5. **DP-20** : `Bail.dateAnniversaireProchaine(today)` méthode du domaine (pas service externe).
6. **Divergence UI-SPEC vs domaine** : format trimestre IRL — UI-SPEC dit `1T2026`, domaine dit `2026-T1`. Aligner sur le domaine (Zod transform si besoin).
7. **Champ `mobilier` sur `Bail`** : à ajouter via ALTER `bail ADD COLUMN mobilier TEXT NULL` dans la migration 0007 (D-97 — pré-requis pour D-98 `verifierChecklistMobilier`).
8. **`appliquerIndexationIRL` compensation PDF** : `BailIndexation` étant append-only, pas de soft-cancel possible — alternative = log CRITICAL + route de regénération à la demande.

### File Created
`/Users/valentinshodo/Projects/toolbox/gestion-locative/.planning/phases/03-conformit-du-bail-diagnostics-edl-irl-mobilier/03-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. `gsd-planner` peut désormais référencer chaque analog Phase 1/2 explicitement dans les actions des plans, et trancher les 8 décisions de planning identifiées ci-dessus.

# Phase 2 : Quittancement — Échéances, Encaissements, Relances - Pattern Map

**Mapped:** 2026-05-14
**Files analyzed:** 52 fichiers cibles (nouveaux + modifiés)
**Analogs found:** 44 / 52 (8 sans analog Phase 1 — nouveaux patterns Phase 2)

---

## File Classification

| Fichier cible | Role | Data Flow | Analog Phase 1 | Match |
|---|---|---|---|---|
| `migrations/0002_phase2_init.sql` | migration | batch | `migrations/0001_init.sql` | exact |
| `src/domain/_shared/identifiants.ts` *(extension)* | model | — | lui-même | exact |
| `src/domain/_shared/money.ts` *(extension)* | model | transform | lui-même | exact |
| `src/domain/_shared/clock.ts` | port | — | AUCUN | nouveau |
| `src/domain/_shared/erreurs.ts` *(extension)* | model | — | lui-même | exact |
| `src/domain/encaissements/echeance-loyer.ts` | model | CRUD | `src/domain/locatif/bail.ts` | exact |
| `src/domain/encaissements/encaissement.ts` | model | CRUD | `src/domain/locatif/bail.ts` | exact |
| `src/domain/encaissements/quittance.ts` | model | CRUD | `src/domain/locatif/bail.ts` | exact |
| `src/domain/encaissements/relance.ts` | model | CRUD | `src/domain/locatif/bail.ts` | exact |
| `src/domain/encaissements/echeance-loyer-repository.ts` | port | CRUD | `src/domain/locatif/bail-repository.ts` | exact |
| `src/domain/encaissements/encaissement-repository.ts` | port | CRUD | `src/domain/locatif/bail-repository.ts` | exact |
| `src/domain/encaissements/quittance-repository.ts` | port | CRUD | `src/domain/locatif/bail-repository.ts` | exact |
| `src/domain/encaissements/relance-repository.ts` | port | CRUD | `src/domain/locatif/bail-repository.ts` | exact |
| `src/domain/encaissements/pdf-renderer.ts` | port | file-I/O | AUCUN | nouveau |
| `src/domain/encaissements/erreurs.ts` | model | — | `src/domain/locatif/erreurs.ts` | exact |
| `src/domain/identite/bailleur.ts` | model | CRUD | `src/domain/_shared/adresse.ts` | role-match |
| `src/domain/identite/bailleur-repository.ts` | port | CRUD | `src/domain/locatif/bail-repository.ts` | exact |
| `src/domain/identite/erreurs.ts` | model | — | `src/domain/locatif/erreurs.ts` | exact |
| `src/domain/locatif/bail.ts` *(extension)* | model | CRUD | lui-même | exact |
| `src/application/encaissements/activer-bail.ts` | service | CRUD | `src/application/locatif/creer-bail.ts` | exact |
| `src/application/encaissements/creer-encaissement.ts` | service | CRUD | `src/application/locatif/creer-bail.ts` | exact |
| `src/application/encaissements/annuler-encaissement.ts` | service | CRUD | `src/application/locatif/supprimer-bail.ts` | exact |
| `src/application/encaissements/generer-quittance.ts` | service | file-I/O | `src/application/locatif/creer-bail.ts` | role-match |
| `src/application/encaissements/annuler-quittance.ts` | service | CRUD | `src/application/locatif/modifier-bail.ts` | exact |
| `src/application/encaissements/calculer-relance-disponible.ts` | service | request-response | `src/application/locatif/lister-baux.ts` | role-match |
| `src/application/encaissements/enregistrer-relance.ts` | service | CRUD | `src/application/locatif/creer-bail.ts` | exact |
| `src/application/identite/creer-ou-maj-bailleur.ts` | service | CRUD | `src/application/locatif/creer-bail.ts` | role-match |
| `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts` | repository | CRUD | `src/infrastructure/repositories/bail-repository-sqlite.ts` | exact |
| `src/infrastructure/repositories/encaissement-repository-sqlite.ts` | repository | CRUD | `src/infrastructure/repositories/bail-repository-sqlite.ts` | exact |
| `src/infrastructure/repositories/quittance-repository-sqlite.ts` | repository | CRUD | `src/infrastructure/repositories/bail-repository-sqlite.ts` | exact |
| `src/infrastructure/repositories/relance-repository-sqlite.ts` | repository | CRUD | `src/infrastructure/repositories/bail-repository-sqlite.ts` | exact |
| `src/infrastructure/repositories/bailleur-repository-sqlite.ts` | repository | CRUD | `src/infrastructure/repositories/bail-repository-sqlite.ts` | exact |
| `src/infrastructure/pdf/pdf-renderer-pdfmake.ts` | adapter | file-I/O | AUCUN | nouveau |
| `src/infrastructure/storage/stockage-fichier-local.ts` | utility | file-I/O | AUCUN | nouveau |
| `src/web/routes/echeances.ts` | route | request-response | `src/web/routes/baux.ts` | exact |
| `src/web/routes/encaissements.ts` | route | request-response | `src/web/routes/baux.ts` | exact |
| `src/web/routes/quittances.ts` | route | request-response | `src/web/routes/baux.ts` | exact |
| `src/web/routes/relances.ts` | route | request-response | `src/web/routes/baux.ts` | exact |
| `src/web/routes/impayes.ts` | route | request-response | `src/web/routes/baux.ts` | role-match |
| `src/web/routes/bailleur.ts` | route | request-response | `src/web/routes/baux.ts` | exact |
| `src/web/schemas/echeance-schemas.ts` | schema | request-response | `src/web/schemas/bail-schemas.ts` | exact |
| `src/web/schemas/encaissement-schemas.ts` | schema | request-response | `src/web/schemas/bail-schemas.ts` | exact |
| `src/web/schemas/quittance-schemas.ts` | schema | request-response | `src/web/schemas/bail-schemas.ts` | exact |
| `src/web/schemas/relance-schemas.ts` | schema | request-response | `src/web/schemas/bail-schemas.ts` | exact |
| `src/web/schemas/bailleur-schemas.ts` | schema | request-response | `src/web/schemas/bail-schemas.ts` | exact |
| `src/web/views/pages/echeances/liste.ejs` | view | request-response | `src/web/views/pages/baux/liste.ejs` | exact |
| `src/web/views/pages/encaissements/formulaire.ejs` | view | request-response | `src/web/views/pages/baux/formulaire.ejs` | exact |
| `src/web/views/pages/impayes/liste.ejs` | view | request-response | `src/web/views/pages/baux/liste.ejs` | exact |
| `templates/relances/01-amiable.ejs` | template | transform | AUCUN | nouveau |
| `src/helpers/format-periode.ts` | utility | transform | `src/helpers/format-date.ts` | exact |
| `src/helpers/format-numero-quittance.ts` | utility | transform | `src/helpers/format-date.ts` | role-match |
| `src/helpers/build-mailto.ts` | utility | transform | AUCUN | nouveau |
| `tests/_builders/encaissements.ts` | test | — | `tests/_builders/locatif.ts` | exact |
| `tests/_world/monde-phase2.ts` | test | — | `tests/bdd/step_definitions/activation.steps.ts` | role-match |
| `tests/bdd/features/quittancement.feature` | test | — | `tests/bdd/features/activation.feature` | exact |
| `tests/bdd/step_definitions/quittancement.steps.ts` | test | — | `tests/bdd/step_definitions/activation.steps.ts` | exact |
| `tests/unit/encaissements/echeance-loyer.test.ts` | test | — | `tests/unit/locatif/bail.test.ts` | exact |
| `tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts` | test | — | `tests/integration/repositories/bail-repository-sqlite.test.ts` | exact |

---

## Pattern Assignments

### `migrations/0002_phase2_init.sql`

**Role:** Migration SQL Phase 2 — nouvelles tables + ALTER bail
**Analog:** `src/infrastructure/db/migrations/0001_init.sql` (lignes 1-81)
**Pourquoi cet analog:** Seule migration SQL existante — même conventions (soft-delete DATETIME NULL, Money INTEGER centimes, TEXT ISO dates, UUID TEXT)

**Excerpt à reproduire (lignes 1-20) :**
```sql
-- Migration 0002 — Phase 2 : Quittancement, Échéances, Encaissements, Relances
-- Conventions identiques à 0001 :
--   - Soft-delete via annule_le DATETIME NULL (encaissements) ou supprime_le DATETIME NULL
--   - Money en INTEGER centimes (jamais REAL)
--   - Dates en TEXT ISO 8601 (Temporal.PlainDate.toString())
--   - Identifiants UUID v4 TEXT PRIMARY KEY

ALTER TABLE bail ADD COLUMN actif_depuis TEXT NULL;
ALTER TABLE bail ADD COLUMN jour_echeance INTEGER NOT NULL DEFAULT 1
  CHECK (jour_echeance >= 1 AND jour_echeance <= 28);

CREATE TABLE IF NOT EXISTS echeance_loyer (
  id                    TEXT PRIMARY KEY,
  bail_id               TEXT NOT NULL REFERENCES bail(id),
  periode_debut         TEXT NOT NULL,
  periode_fin           TEXT NOT NULL,
  jour_echeance_attendue TEXT NOT NULL,
  loyer_hc              INTEGER NOT NULL,
  montant_charges       INTEGER NOT NULL,
  mode_charges          TEXT NOT NULL CHECK (mode_charges IN ('forfait','provisions')),
  total                 INTEGER NOT NULL,
  statut                TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente','partiellement_payee','payee','annulee')),
  cree_le               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  modifie_le            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  annule_le             DATETIME NULL
);
```

**Adaptations requises :**
- Ajouter les tables `encaissement`, `quittance`, `relance`, `bailleur` dans le même fichier (ou des fichiers atomiques par plan — à trancher planner)
- `bailleur` : ajouter la contrainte `UNIQUE (singleton_marker)` (D-67 + RESEARCH §5)
- `encaissement` : colonne `annule_le` + `raison_annulation` pour le soft-delete (D-60)
- `meta` est déjà créée dans 0001 — ne pas recréer, juste insérer les compteurs quittance

---

### `src/domain/_shared/identifiants.ts` (extension)

**Role:** Ajout des brand types Phase 2
**Analog:** lui-même (lignes 1-34)
**Pourquoi cet analog:** Extension du fichier existant, même pattern verbatim

**Excerpt à reproduire (lignes 4-25) :**
```typescript
export type BienId = string & { readonly __brand: 'BienId' };
// ... (existant)

// AJOUTER — Phase 2 :
export type EcheanceLoyerId = string & { readonly __brand: 'EcheanceLoyerId' };
export type EncaissementId = string & { readonly __brand: 'EncaissementId' };
export type QuittanceId = string & { readonly __brand: 'QuittanceId' };
export type RelanceId = string & { readonly __brand: 'RelanceId' };
export type BailleurId = string & { readonly __brand: 'BailleurId' };

export function nouveauEcheanceLoyerId(): EcheanceLoyerId {
  return crypto.randomUUID() as EcheanceLoyerId;
}
export function nouveauEncaissementId(): EncaissementId {
  return crypto.randomUUID() as EncaissementId;
}
export function nouveauQuittanceId(): QuittanceId {
  return crypto.randomUUID() as QuittanceId;
}
export function nouveauRelanceId(): RelanceId {
  return crypto.randomUUID() as RelanceId;
}
export function nouveauBailleurId(): BailleurId {
  return crypto.randomUUID() as BailleurId;
}
```

**Adaptations requises :**
- Aucune — copier verbatim le pattern `type X = string & { readonly __brand: 'X' }` + factory `nouveauXId()`

---

### `src/domain/_shared/money.ts` (extension)

**Role:** Ajout `multiplyByFraction` (prorata) et `Money.compensateur` (négatifs D-60)
**Analog:** lui-même (lignes 1-86)
**Pourquoi cet analog:** Extension du fichier existant — nouvelles méthodes ajoutées à la classe

**Excerpt à reproduire (structure de méthode, lignes 55-58) :**
```typescript
multiplier(facteur: number | bigint): Money {
  const f = typeof facteur === 'bigint' ? facteur : BigInt(Math.round(facteur));
  return Money.fromCentimes(this.centimes * f);
}
```

**Adaptations requises :**
- Ajouter `multiplyByFraction(num: bigint, den: bigint, mode: 'banker' | 'floor' | 'ceil' = 'banker'): Money` — algorithme complet dans RESEARCH.md §4
- Ajouter `static compensateur(positif: Money): Money` — factory dédiée qui accepte les négatifs (centimes négatifs autorisés uniquement via cette factory)
- `fromCentimes` reste inchangé (refuse les négatifs pour les usages normaux)

---

### `src/domain/_shared/clock.ts` (NOUVEAU)

**Role:** Port Clock — abstraction date courante pour déterminisme BDD
**Analog:** Aucun analog Phase 1

**Note:** Nouveau pattern introduit en Phase 2. Voir RESEARCH.md §6 pour l'interface complète (`Clock`, `ClockSysteme`, `ClockFixe`). Le `Clock` est injecté dans `creerApp(db, { clock })` et propagé aux use cases qui calculent les seuils J+10/J+30/J+60 (D-71).

---

### `src/domain/encaissements/echeance-loyer.ts`

**Role:** Agrégat racine EcheanceLoyer — snapshot loyer (D-54)
**Analog:** `src/domain/locatif/bail.ts` (lignes 1-158)
**Pourquoi cet analog:** Même pattern factory + InvariantViolated + copy-on-write

**Excerpt à reproduire (lignes 59-138) — structure factory :**
```typescript
export class EcheanceLoyer {
  readonly id: EcheanceLoyerId;
  readonly bailId: BailId;
  readonly periodeDebut: Temporal.PlainDate;
  readonly periodeFin: Temporal.PlainDate;
  readonly jourEcheanceAttendue: Temporal.PlainDate;
  readonly loyerHc: Money;
  readonly montantCharges: Money;
  readonly modeCharges: ModeCharges;
  readonly total: Money;         // loyerHc + montantCharges (snapshot D-54)
  readonly statut: StatutEcheanceLoyer;
  readonly annuleLe: Temporal.PlainDate | null;

  private constructor(id: EcheanceLoyerId, props: Omit<EcheanceLoyerProps, 'id'>) { ... }

  static creer(props: EcheanceLoyerProps): EcheanceLoyer {
    // D-55 : statut ∈ {en_attente, partiellement_payee, payee, annulee}
    const statutsValides: StatutEcheanceLoyer[] = ['en_attente', 'partiellement_payee', 'payee', 'annulee'];
    if (!statutsValides.includes(props.statut)) {
      throw new InvariantViolated(`Statut d'échéance invalide : "${props.statut}"`);
    }
    // total = loyerHc + montantCharges (snapshot — jamais recalculé à partir du bail)
    if (!props.total.egale(props.loyerHc.additionner(props.montantCharges))) {
      throw new InvariantViolated('Le total de l\'échéance doit être égal à loyerHc + montantCharges');
    }
    const id = props.id ?? nouveauEcheanceLoyerId();
    return new EcheanceLoyer(id, { ...props });
  }

  /** Mise à jour du statut (copy-on-write). Appelé par le use case après recalcul. */
  avecStatut(statut: StatutEcheanceLoyer): EcheanceLoyer {
    return EcheanceLoyer.creer({ ...this.toProps(), statut });
  }
}
```

**Adaptations requises :**
- `statut` est mutable via `avecStatut()` (contrairement à `Bail` qui n'a pas de statut) — le statut est recalculé par le use case après chaque Encaissement
- "En retard" n'est PAS un statut stocké (D-55) — c'est un dérivé calculé à la route : `statut !== 'payee' && jourEcheanceAttendue < today`
- Pas de `modifier()` généraliste — les champs monetaires sont immutables une fois créés (D-60)

---

### `src/domain/encaissements/encaissement.ts`

**Role:** Agrégat Encaissement — paiement partiel ou total (D-57/D-58/D-60)
**Analog:** `src/domain/locatif/bail.ts` (lignes 59-138)
**Pourquoi cet analog:** Même pattern factory + InvariantViolated

**Excerpt à reproduire (structure factory, lignes 90-138) :**
```typescript
static creer(props: EncaissementProps): Encaissement {
  // D-58 : mode ∈ {virement, cheque, especes, prelevement, autre}
  const modesValides: ModeEncaissement[] = ['virement', 'cheque', 'especes', 'prelevement', 'autre'];
  if (!modesValides.includes(props.mode)) {
    throw new InvariantViolated(`Mode de paiement invalide : "${props.mode}"`);
  }
  // D-60 : pas d'UPDATE destructif — Encaissement jamais modifiable
  // D-61 : date permissive — pas de throw, juste des warnings retournés
  const id = props.id ?? nouveauEncaissementId();
  return new Encaissement(id, props);
}

/** Annulation soft-delete (D-60). Retourne le nouvel Encaissement annulé. */
annuler(raisonAnnulation: string, annuleLe: Temporal.PlainDate): Encaissement {
  if (this.annuleLe !== null) {
    throw new InvariantViolated('Cet encaissement est déjà annulé');
  }
  return Encaissement.creer({ ...this.toProps(), annuleLe, raisonAnnulation });
}
```

**Adaptations requises :**
- `montant` peut être négatif (compensateur D-60) — utiliser `Money.compensateur()` pour les cas négatifs, `Money.fromCentimes()` pour les normaux
- Warnings D-61 (date hors plage) : retournés comme liste de `string[]` en 3ème valeur de retour de `creer()`, pas comme exception — le use case décide d'afficher ou non
- `annule_le` + `raison_annulation` : champs de soft-delete sur l'agrégat lui-même

---

### `src/domain/encaissements/quittance.ts`

**Role:** Agrégat Quittance — reçu légal PDF (loi 89 art. 21, D-63/D-64/D-65)
**Analog:** `src/domain/locatif/bail.ts` (lignes 59-138)
**Pourquoi cet analog:** Même pattern factory

**Excerpt à reproduire (structure) :**
```typescript
static creer(props: QuittanceProps): Quittance {
  // D-64 : numéro au format "AAAA-NNN" (ex: "2026-042")
  if (!/^\d{4}-\d{3,}$/.test(props.numero)) {
    throw new InvariantViolated(`Numéro de quittance invalide : "${props.numero}". Format attendu : AAAA-NNN`);
  }
  // D-65 : une quittance émise est immutable — annulation via annulee_le seulement
  const id = props.id ?? nouveauQuittanceId();
  return new Quittance(id, props);
}
```

**Adaptations requises :**
- Champ `annulee_le: Temporal.PlainDate | null` + `raison_annulation_quittance: string | null` (D-65)
- Champ `cheminFichierPdf: string` — chemin absolu du fichier PDF persisté (D-63)
- Le numéro est généré par le use case depuis la table `meta` (compteur annuel) — pas par la factory

---

### `src/domain/encaissements/relance.ts`

**Role:** Agrégat Relance — suivi de l'escalade (D-68/D-71)
**Analog:** `src/domain/locatif/bail.ts` (lignes 59-138)
**Pourquoi cet analog:** Même pattern factory

**Excerpt à reproduire (structure factory) :**
```typescript
export type NiveauRelance = 1 | 2 | 3;
export type CanalRelance = 'email' | 'pdf';

static creer(props: RelanceProps): Relance {
  // D-68 : niveau ∈ {1, 2, 3}
  if (![1, 2, 3].includes(props.niveau)) {
    throw new InvariantViolated(`Niveau de relance invalide : ${props.niveau}. Valeurs : 1, 2, 3`);
  }
  // D-71 : chaînage strict — niveau 3 ne peut pas être créé si niveau 2 n'existe pas
  // La vérification du chaînage est au use case (cross-aggregate)
  const id = props.id ?? nouveauRelanceId();
  return new Relance(id, props);
}
```

**Adaptations requises :**
- Champ `contenuSnapshot: string` (JSON stringifié du contenu du template au moment de l'envoi — D-71)
- Champ `annuleLe: Temporal.PlainDate | null` (soft-delete si erreur)
- `envoyeeLe` : date fournie par le use case via le port `Clock` (pas `new Date()` directement)

---

### `src/domain/encaissements/echeance-loyer-repository.ts`

**Role:** Port repository EcheanceLoyer
**Analog:** `src/domain/locatif/bail-repository.ts` (lignes 1-11)
**Pourquoi cet analog:** Même interface port — méthodes CRUD + requêtes métier

**Excerpt à reproduire (lignes 1-11) :**
```typescript
import type { BailId } from '../_shared/identifiants.js';
import type { Bail } from './bail.js';

export interface BailRepository {
  enregistrer(bail: Bail): Promise<void>;
  trouverParId(id: BailId): Promise<Bail | null>;
  listerTous(): Promise<Bail[]>;
  listerParLocataire(locataireId: LocataireId): Promise<Bail[]>;
  supprimer(id: BailId): Promise<void>;
}
```

**Adaptations requises :**
- Ajouter `listerParBail(bailId: BailId): Promise<EcheanceLoyer[]>`
- Ajouter `mettreAJourStatut(id: EcheanceLoyerId, statut: StatutEcheanceLoyer): Promise<void>`
- Ajouter `listerNonPayeesSansAnnulee(): Promise<EcheanceLoyer[]>` (page Impayés)
- Pas de méthode `supprimer()` — les échéances ne sont jamais supprimées (D-74)

---

### `src/domain/encaissements/encaissement-repository.ts`

**Role:** Port repository Encaissement
**Analog:** `src/domain/locatif/bail-repository.ts` (lignes 1-11)

**Adaptations requises :**
- Ajouter `listerParEcheance(echeanceId: EcheanceLoyerId): Promise<Encaissement[]>`
- Ajouter `sommePaieeParEcheance(echeanceId: EcheanceLoyerId): Promise<Money>` (agrège les actifs — `annule_le IS NULL`) — voir RESEARCH.md §3
- Pas de méthode `supprimer()` — soft-delete uniquement via `annuler()`

---

### `src/domain/encaissements/pdf-renderer.ts` (NOUVEAU port)

**Role:** Port PdfRenderer — abstraction de la génération PDF (domaine pur)
**Analog:** Aucun analog Phase 1

**Note:** Nouveau pattern introduit en Phase 2. L'interface minimale :
```typescript
export interface PdfRenderer {
  genererBuffer(docDef: TDocumentDefinitions): Promise<Buffer>;
}
```
Voir RESEARCH.md §1 pour l'adapter `PdfRendererPdfmake` côté infrastructure. `TDocumentDefinitions` est importé de `pdfmake/interfaces` — uniquement en infrastructure, jamais dans le domaine (le port utilise un type générique ou re-exporte uniquement l'interface).

---

### `src/domain/encaissements/erreurs.ts`

**Role:** Erreurs lookup-failure du BC Encaissements
**Analog:** `src/domain/locatif/erreurs.ts` (lignes 1-13)
**Pourquoi cet analog:** Même pattern — classe Error nommée avec message paramétrique

**Excerpt à reproduire (lignes 1-13) :**
```typescript
export class LocataireIntrouvable extends Error {
  constructor(id: string) {
    super(`Locataire introuvable : ${id}`);
    this.name = 'LocataireIntrouvable';
  }
}

export class BailIntrouvable extends Error {
  constructor(id: string) {
    super(`Bail introuvable : ${id}`);
    this.name = 'BailIntrouvable';
  }
}
```

**Adaptations requises :**
- Ajouter `EcheanceLoyerIntrouvable`, `EncaissementIntrouvable`, `QuittanceIntrouvable`, `RelanceIntrouvable`
- Ajouter `EcheanceLoyerDejaPayee` (invariant métier — on ne peut pas encaisser sur une échéance `payee`)
- Ajouter `EcheanceLoyerAnnulee` (même raison)

---

### `src/domain/identite/bailleur.ts`

**Role:** Agrégat Bailleur singleton (D-67) — identité du propriétaire
**Analog:** `src/domain/_shared/adresse.ts` (lignes 1-38)
**Pourquoi cet analog:** Même pattern VO/entité légère avec factory + InvariantViolated + props interface

**Excerpt à reproduire (lignes 9-38) :**
```typescript
export class Adresse {
  readonly rue: string;
  readonly codePostal: string;
  readonly ville: string;

  private constructor(props: AdresseProps) {
    this.rue = props.rue;
    this.codePostal = props.codePostal;
    this.ville = props.ville;
  }

  static creer(props: AdresseProps): Adresse {
    if (!props.rue.trim()) throw new InvariantViolated("La rue ne peut pas être vide");
    if (!props.codePostal.trim()) throw new InvariantViolated("Le code postal ne peut pas être vide");
    if (!props.ville.trim()) throw new InvariantViolated("La ville ne peut pas être vide");
    return new Adresse(props);
  }
}
```

**Adaptations requises :**
- `Bailleur` possède `id: BailleurId`, `nomComplet: string`, `adresse: Adresse`
- Réutiliser `Adresse.creer()` tel quel pour `bailleur.adresse`
- Invariant : `nomComplet` non vide
- Pas de `SIRET` en V1 (D-67 — ajouté Phase 5/6 par ALTER migration)
- Méthode `modifier(patch)` copy-on-write (même pattern que `Bail.modifier()`)

---

### `src/domain/locatif/bail.ts` (extension)

**Role:** Ajout `actifDepuis`, `jourEcheance`, méthode `activer()` (D-51/D-53)
**Analog:** lui-même (lignes 141-157) — méthode `modifier()` existante

**Excerpt à reproduire (lignes 141-157) — pattern copy-on-write :**
```typescript
/** Copy-on-write — re-valide tous les invariants. */
modifier(patch: ModifierBailPatch): Bail {
  return Bail.creer({
    id: this.id,
    locataireId: patch.locataireId ?? this.locataireId,
    // ... tous les champs
  });
}
```

**Adaptations requises :**
- Ajouter `actifDepuis: Temporal.PlainDate | null` et `jourEcheance: number` dans `BailProps` et propriétés readonly
- Ajouter méthode `activer(actifDepuis: Temporal.PlainDate, jourEcheance: number): Bail` — copy-on-write validant `jourEcheance ∈ [1, 28]`
- `creer()` : valider `jourEcheance` entre 1 et 28 si fourni (pas de contrainte si null/brouillon)

---

### `src/application/encaissements/activer-bail.ts`

**Role:** Use case activation du Bail + génération de toutes les EcheanceLoyer (D-52)
**Analog:** `src/application/locatif/creer-bail.ts` (lignes 1-102)
**Pourquoi cet analog:** Même pattern — use case multi-repos avec commande + vérifications cross-aggregate

**Excerpt à reproduire (lignes 51-102) :**
```typescript
export async function creerBail(
  commande: CreerBailCommande,
  bailRepo: BailRepository,
  bienRepo: BienRepository,
  locataireRepo: LocataireRepository,
): Promise<BailId> {
  // Vérification existence du Bien
  const bien = await bienRepo.trouverParId(commande.bienId);
  if (!bien) throw new BienIntrouvable(commande.bienId);

  // Construction et persistance
  const bail = Bail.creer({ ... });
  await bailRepo.enregistrer(bail);
  return bail.id;
}
```

**Adaptations requises :**
- Signature : `activerBail(commande, bailRepo, echeanceLoyerRepo, clock)` — prend aussi `clock: Clock`
- Après `bail.activer()`, générer toutes les `EcheanceLoyer` pour `dureeMois` mois (boucle)
- 1ère et dernière : calcul prorata via `Money.multiplyByFraction()` (D-56 + RESEARCH.md §4)
- Warning D-72 : si `actifDepuis < today - 2 ans`, retourner une liste de `string[]` warnings (pas une exception)
- Persister via `echeanceLoyerRepo.enregistrerBatch(echeances)` — une transaction pour toutes les insertions

---

### `src/application/encaissements/creer-encaissement.ts`

**Role:** Use case saisie d'un Encaissement (D-57/D-58/D-59/D-60/D-61)
**Analog:** `src/application/locatif/creer-bail.ts` (lignes 51-102)
**Pourquoi cet analog:** Même pattern use case multi-repos

**Excerpt à reproduire (lignes 58-101) :**
```typescript
// Vérification existence cross-aggregate
const bien = await bienRepo.trouverParId(commande.bienId);
if (!bien) throw new BienIntrouvable(commande.bienId);

// Construction agrégat (factory valide invariants)
const bail = Bail.creer({ ... });
await bailRepo.enregistrer(bail);
return bail.id;
```

**Adaptations requises :**
- Vérifier que l'`EcheanceLoyer` existe et n'est pas `annulee` (cross-aggregate)
- Après création, appeler `recalculerStatutEcheance()` (use case interne ou méthode du repo)
- Sur-paiement (D-59) : ne pas rejeter — retourner un warning `{ warning: 'trop_percu', montant: Money }`
- D-61 warnings date : retourner en liste, pas en exception

---

### `src/application/encaissements/annuler-encaissement.ts`

**Role:** Use case annulation soft-delete d'un Encaissement + recalcul statut (D-60)
**Analog:** `src/application/locatif/supprimer-bail.ts`
**Pourquoi cet analog:** Même pattern — lookup + opération destructive + persist

**Excerpt à reproduire :**
```typescript
export async function supprimerBail(id: BailId, bailRepo: BailRepository): Promise<void> {
  const bail = await bailRepo.trouverParId(id);
  if (!bail) throw new BailIntrouvable(id);
  await bailRepo.supprimer(id);
}
```

**Adaptations requises :**
- Soft-delete via `encaissement.annuler(raison, clock.aujourdhui())` puis `encaissementRepo.enregistrer()`
- Après annulation, recalculer le statut de l'`EcheanceLoyer` liée
- D-65 : si une `Quittance` existe pour cette échéance, la détecter et retourner un warning (`{ warning: 'quittance_peut_devenir_invalide', quittanceId }`)

---

### `src/application/encaissements/generer-quittance.ts`

**Role:** Use case génération PDF + persistance Quittance (D-63/D-64)
**Analog:** `src/application/locatif/creer-bail.ts` (structure multi-repos)
**Pourquoi cet analog:** Use case multi-repos + orchestration d'un port externe (PdfRenderer)

**Adaptations requises :**
- Signature : `genererQuittance(echeanceId, bailRepo, bailleurRepo, locataireRepo, echeanceLoyerRepo, quittanceRepo, pdfRenderer, stockageFichier, clock)`
- Pré-condition : `echeance.statut === 'payee'` (sinon `EcheanceLoyerNonPayee`)
- Pré-condition : `bailleur` existe (sinon redirect `/bailleur` côté route — le use case throw `BailleurAbsent`)
- Incrémenter le compteur `meta.compteur_quittance_{annee}` dans la même transaction que l'insert quittance
- Construire `TDocumentDefinitions` (voir RESEARCH.md §1 — structure JSON quittance) puis appeler `pdfRenderer.genererBuffer()`

---

### `src/application/identite/creer-ou-maj-bailleur.ts`

**Role:** Use case singleton Bailleur — création ou mise à jour (D-67 + RESEARCH §5)
**Analog:** `src/application/locatif/modifier-bail.ts` (lignes 29-79)
**Pourquoi cet analog:** Pattern lookup → modifier ou créer → persist

**Excerpt à reproduire (lignes 33-79) :**
```typescript
export async function modifierBail(commande, bailRepo, bienRepo): Promise<void> {
  const bail = await bailRepo.trouverParId(commande.id);
  if (!bail) throw new BailIntrouvable(commande.id);
  // ... vérifications cross-aggregate
  const bailModifie = bail.modifier({ ... });
  await bailRepo.enregistrer(bailModifie);
}
```

**Adaptations requises :**
- Pattern "upsert" : `const existant = await bailleurRepo.trouver()` — si null, créer ; sinon modifier
- `trouver()` retourne `Bailleur | null` (singleton — pas de paramètre `id`)
- La contrainte UNIQUE SQLite (`singleton_marker`) est le filet infra — le use case est la barrière domaine

---

### `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts`

**Role:** Adapter Kysely — persistance EcheanceLoyer
**Analog:** `src/infrastructure/repositories/bail-repository-sqlite.ts` (lignes 1-233)
**Pourquoi cet analog:** Exact — même structure : constructor(db), versDomaine(), versRow(), transaction()

**Excerpt à reproduire (lignes 13-68) — pattern upsert + transaction :**
```typescript
export class BailRepositorySqlite implements BailRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(bail: Bail): Promise<void> {
    await this.db.transaction().execute(async (trx) => {
      await trx
        .insertInto('bail')
        .values({ id: bail.id, ... })
        .onConflict((oc) => oc.column('id').doUpdateSet({ ... modifie_le: new Date().toISOString() }))
        .execute();
    });
  }
```

**Excerpt — pattern versDomaine (lignes 140-192) :**
```typescript
private versDomaine(row: { ... }, lotIds: LotId[]): Bail {
  const loyerHc = Money.fromCentimes(BigInt(row.loyer_hc));      // INTEGER → BigInt
  const dateDebut = Temporal.PlainDate.from(row.date_debut);     // TEXT ISO → Temporal
  return Bail.creer({ id: row.id as BailId, ... });
}
```

**Adaptations requises :**
- `versDomaine()` : `Temporal.PlainDate.from(row.periode_debut)`, `Money.fromCentimes(BigInt(row.loyer_hc))`
- `annule_le` TEXT NULL → `Temporal.PlainDate.from(row.annule_le)` si non null
- Ajouter `mettreAJourStatut(id, statut)` : simple `updateTable('echeance_loyer').set({ statut, modifie_le })` sans transaction
- `enregistrerBatch(echeances)` : une `db.transaction()` avec N insertions pour l'activation bail

---

### `src/infrastructure/repositories/encaissement-repository-sqlite.ts`

**Role:** Adapter Kysely — persistance Encaissement + agrégat SUM actifs
**Analog:** `src/infrastructure/repositories/bail-repository-sqlite.ts` (lignes 13-233)
**Pourquoi cet analog:** Même structure — plus pattern SUM Kysely pour `sommePaieeParEcheance`

**Adaptations requises :**
- `sommePaieeParEcheance()` : `eb.fn.sum('montant_centimes').where('annule_le', 'is', null)` — voir RESEARCH.md §3
- `montant_centimes` peut être négatif (compensateur) — `Money.fromCentimesSignes(BigInt(...))` en lecture
- Pas de `supprimer()` — uniquement `annuler()` via `enregistrer()` (soft-delete par `annule_le`)

---

### `src/infrastructure/pdf/pdf-renderer-pdfmake.ts` (NOUVEAU)

**Role:** Adapter pdfmake CJS depuis ESM (D-19)
**Analog:** Aucun analog Phase 1

**Note:** Nouveau pattern introduit en Phase 2. Voir RESEARCH.md §1 pour le snippet complet avec `createRequire(import.meta.url)`, `addFonts(Roboto)`, `setUrlAccessPolicy(() => false)`, `setLocalAccessPolicy(() => true)`, et la méthode `genererBuffer(docDef)`.

---

### `src/infrastructure/storage/stockage-fichier-local.ts` (NOUVEAU)

**Role:** Persistance fichiers PDF quittances sur le système de fichiers local (D-63)
**Analog:** Aucun analog Phase 1

**Note:** Nouveau pattern introduit en Phase 2. Utiliser `node:fs/promises` (`writeFile`, `mkdir`). Chemin cible : `~/Library/Application Support/gestion-locative/documents/quittances/{annee}/`. Méthode : `ecrire(nomFichier: string, buffer: Buffer): Promise<string>` retournant le chemin absolu.

---

### `src/web/routes/echeances.ts`

**Role:** Routes Fastify pour les échéances loyer
**Analog:** `src/web/routes/baux.ts` (lignes 38-385)
**Pourquoi cet analog:** Exact — même plugin pattern avec repos injectés en opts

**Excerpt à reproduire (lignes 38-71) — structure plugin :**
```typescript
export async function plugin(
  app: FastifyInstance,
  opts: {
    bailRepo: BailRepository;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
  },
): Promise<void> {
  // GET /baux — liste avec empty state prérequis
  app.get('/baux', async (_req, reply) => {
    const [baux, biens, locataires] = await Promise.all([...]);
    return reply.view('pages/baux/liste.ejs', {
      baux, biensCount: biens.length, navActive: 'baux',
    });
  });
```

**Excerpt — pattern error handling (lignes 193-212) :**
```typescript
try {
  const bailId = await creerBail(commande, opts.bailRepo, ...);
  return reply.redirect('/baux/' + bailId);
} catch (err) {
  const message = err instanceof Error ? err.message : 'Erreur inattendue';
  return reply.view('pages/baux/formulaire.ejs', { erreurs: { _global: message } });
}
```

**Adaptations requises :**
- `opts` contiendra `echeanceLoyerRepo`, `bailRepo`, `bailleurRepo`, `clock`
- Route PDF `GET /echeances/:id/avis-pdf` : `reply.header('Content-Type', 'application/pdf').send(buffer)` — voir RESEARCH.md §1
- Calcul "en retard" : `statut !== 'payee' && jourEcheanceAttendue < clock.aujourdhui()` — calculé à la route, pas stocké (D-55)

---

### `src/web/routes/encaissements.ts`

**Role:** Routes Fastify pour la saisie et l'annulation d'encaissements
**Analog:** `src/web/routes/baux.ts` (lignes 116-212)
**Pourquoi cet analog:** Même pattern POST avec safeParse + try/catch + redirect

**Excerpt à reproduire (lignes 116-146) — pattern POST formulaire :**
```typescript
app.post('/baux', async (req, reply) => {
  const body = req.body as Record<string, unknown>;
  const parsed = bailCreationSchema.safeParse(body);

  if (!parsed.success) {
    const erreurs = extraireErreurs(parsed.error.issues);
    return reply.view('pages/baux/formulaire.ejs', { erreurs, valeurs: body, ... });
  }

  try {
    await creerBail(commande, ...);
    return reply.redirect('/baux/' + bailId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erreur inattendue';
    return reply.view('pages/baux/formulaire.ejs', { erreurs: { _global: message }, valeurs: body });
  }
});
```

**Adaptations requises :**
- Warning sur-paiement (D-59) : récupérer en retour du use case, passer dans `reply.view({ warningSurPaiement })`, afficher dans la vue
- Warning date hors plage (D-61) : même mécanisme
- Annulation : `POST /encaissements/:id/annuler` (soft-delete), pas de `DELETE`

---

### `src/web/routes/relances.ts`

**Role:** Routes Fastify — boutons de relance contextuelle (D-71)
**Analog:** `src/web/routes/baux.ts` (lignes 373-384)
**Pourquoi cet analog:** Même pattern action POST simple

**Excerpt à reproduire (lignes 373-384) — pattern action POST :**
```typescript
app.post('/baux/:id/supprimer', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    await supprimerBail(id as BailId, opts.bailRepo);
    return reply.redirect('/baux');
  } catch (err) {
    if (err instanceof BailIntrouvable) return reply.code(404).send(err.message);
    throw err;
  }
});
```

**Adaptations requises :**
- `POST /relances` : créer une `Relance` + générer le mailto URI (niveau 1-2) ou le PDF (niveau 3) en réponse
- Le mailto URI est passé dans `reply.view({ mailtoUri })` pour être affiché dans la vue comme `href` sur un `<a>` (pas de redirect navigateur direct — l'utilisateur clique "Envoyer" depuis son client mail)
- Chaînage D-71 : vérifier au use case que le niveau N-1 existe avant de permettre le niveau N

---

### `src/web/schemas/encaissement-schemas.ts`

**Role:** Schémas Zod pour le formulaire de saisie d'encaissement
**Analog:** `src/web/schemas/bail-schemas.ts` (lignes 1-73)
**Pourquoi cet analog:** Exact — même structure `.object({}).superRefine()`

**Excerpt à reproduire (lignes 1-73) :**
```typescript
import { z } from 'zod';

export const bailCreationSchema = z
  .object({
    bienId: z.string().uuid('Sélectionnez un bien valide'),
    dateDebut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ'),
    dureeMois: z.coerce.number().int().min(12, 'Au moins 12 mois'),
    modeCharges: z.enum(['forfait', 'provisions'], { errorMap: () => ({ message: '...' }) }),
  })
  .superRefine((data, ctx) => {
    // validations croisées
  });

export type BailCreationFormData = z.infer<typeof bailCreationSchema>;
```

**Adaptations requises :**
- `mode` : `z.enum(['virement', 'cheque', 'especes', 'prelevement', 'autre'])`
- `dateEncaissement` : `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)` (validé permissif côté use case — D-61)
- `montantEuros` : `z.coerce.number()` — autorise les négatifs (compensateurs)
- Si `ZodEffects` bloquant, recréer explicitement (Phase 1 LESSON `wizardBailSchema`)

---

### `src/web/views/pages/echeances/liste.ejs`

**Role:** Page liste des échéances avec statuts visuels (couleurs D-55)
**Analog:** `src/web/views/pages/baux/liste.ejs` (lignes 1-63)
**Pourquoi cet analog:** Exact — même structure layout-debut + data-table + layout-fin

**Excerpt à reproduire (lignes 1-63) :**
```ejs
<%- include('../../partials/layout-debut', {
  titre: 'Baux',
  breadcrumbs: [{ label: 'Baux' }],
  navActive: 'baux'
}) %>

<% if (baux.length === 0) { %>
  <%- include('../../partials/empty-state', {
    heading: "Aucun bail pour l'instant",
    body: "...",
    ctaLabel: "Créer un bail", ctaUrl: "/baux/nouveau"
  }) %>
<% } else { %>
  <h1>Baux</h1>
  <%- include('../../partials/data-table', {
    ariaLabel: 'Liste des baux',
    colonnes: [...],
    lignes: baux.map(function(b) { return [...]; }),
    actions: function(ligne, i) { return '<a href=...>'; }
  }) %>
<% } %>

<%- include('../../partials/layout-fin') %>
```

**Adaptations requises :**
- Colonne "Statut" avec classe CSS selon statut : `en_attente` (neutre), `partiellement_payee` (ambre), `payee` (vert), `annulee` (gris), "En retard" dérivé (rouge) — via `class="statut-<%= echeance.statut %>"` ou inline style
- Colonne "Jour d'échéance" affichant `jourEcheanceAttendue`
- Actions : "Saisir un encaissement" (si non payée), "Générer avis PDF" (lien GET), "Voir quittance" (si payée)
- Empty state : "Aucune échéance — activez le bail d'abord."

---

### `src/web/views/pages/impayes/liste.ejs`

**Role:** Page Impayés — liste des échéances non payées après leur date (lecture seule)
**Analog:** `src/web/views/pages/baux/liste.ejs` (lignes 1-63)
**Pourquoi cet analog:** Même structure — liste + data-table + actions contextuelles

**Adaptations requises :**
- Empty state : "Tous les loyers sont à jour." (UX_DESIGN empty states)
- Colonne "Retard" : nombre de jours depuis `jourEcheanceAttendue` (calculé route)
- Bouton relance contextuel visible selon seuil J+10/J+30/J+60 (D-71) — rendu `disabled` si pas encore le seuil

---

### `src/web/views/partials/sidebar-nav.ejs` (extension)

**Role:** Ajout des liens Phase 2 dans la navigation principale
**Analog:** lui-même (lignes 1-13)

**Excerpt à reproduire (lignes 1-13) :**
```ejs
<nav aria-label="Navigation principale">
  <ul>
    <li>
      <a href="/biens"<% if (locals.navActive === 'biens') { %> aria-current="page"<% } %>>Biens</a>
    </li>
    <li>
      <a href="/baux"<% if (locals.navActive === 'baux') { %> aria-current="page"<% } %>>Baux</a>
    </li>
  </ul>
</nav>
```

**Adaptations requises :**
- Ajouter groupe "Encaissements" avec sous-liens : Échéances (`/echeances`), Encaissements (`/encaissements`), Quittances (`/quittances`), Impayés (`/impayes`)
- Ajouter lien "Profil bailleur" (`/bailleur`)
- `navActive` : étendre les valeurs possibles à `'echeances' | 'encaissements' | 'quittances' | 'impayes' | 'relances' | 'bailleur'`

---

### `templates/relances/01-amiable.ejs` (NOUVEAU)

**Role:** Template textuel EJS d'une relance amiable (niveau 1, D-70)
**Analog:** Aucun analog Phase 1

**Note:** Nouveau pattern — template EJS hors `src/web/views/` (contenu textuel, pas page HTML). Rendu serveur via `ejs.render(fs.readFileSync(templatePath), variables)` dans le use case `enregistrerRelance`. Variables interpolées : `prenom_locataire`, `nom_locataire`, `periode_impayee`, `montant_du`, `date_echeance_initiale`, `nom_bailleur`, `adresse_bailleur`. Idem pour `02-ferme.ejs` et `03-mise-en-demeure.ejs`.

---

### `src/helpers/format-periode.ts`

**Role:** Helper `PlainDate → "mai 2026"` (affichage période dans les vues)
**Analog:** `src/helpers/format-date.ts` (lignes 1-12)
**Pourquoi cet analog:** Exact — même signature (PlainDate + guard null) + même injection preHandler

**Excerpt à reproduire (lignes 1-12) :**
```typescript
import { Temporal } from '@js-temporal/polyfill';

export function formatDate(date: Temporal.PlainDate | null | undefined): string {
  if (!date) return '—';
  const d = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${d}/${m}/${date.year}`;
}
```

**Adaptations requises :**
- `Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' })` — attention U+00A0 (Phase 1 LESSON)
- Tests `.toMatch(/mai/)` plutôt que `.toBe('mai 2026')` pour éviter les espaces insécables
- Ajouter au preHandler global : `reply.locals.formatPeriode = formatPeriode`

---

### `src/helpers/format-numero-quittance.ts`

**Role:** Helper `(annee, n) → "2026-042"` (numérotation D-64)
**Analog:** `src/helpers/format-date.ts` (lignes 1-12)
**Pourquoi cet analog:** Même pattern helper pur sans dépendance externe

**Adaptations requises :**
- Signature : `formatNumeroQuittance(annee: number, sequence: number): string`
- `String(sequence).padStart(3, '0')` pour "042" — au moins 3 chiffres

---

### `src/helpers/build-mailto.ts` (NOUVEAU)

**Role:** Helper `buildMailto(params) → string` URI mailto RFC 6068
**Analog:** Aucun analog Phase 1

**Note:** Nouveau pattern introduit en Phase 2. Voir RESEARCH.md §2 pour l'implémentation complète (encodeURIComponent, `%0A → %0D%0A`, limite 1900 chars corps encodé, tronquage avec mention).

---

### `tests/_builders/encaissements.ts`

**Role:** Builders pour les 4 agrégats Phase 2 + Bailleur
**Analog:** `tests/_builders/locatif.ts` (lignes 1-115)
**Pourquoi cet analog:** Exact — même pattern `unXValide(overrides?)` avec defaults valides

**Excerpt à reproduire (lignes 26-50) :**
```typescript
interface OverridesLocataire {
  id?: LocataireId;
  nom?: string;
  // ...
}

export function unLocataireValide(overrides: OverridesLocataire = {}): Locataire {
  return Locataire.creer({
    id: overrides.id,
    nom: overrides.nom ?? 'Dupont',
    // defaults cohérents avec invariants
  });
}
```

**Adaptations requises :**
- `unEcheanceLoyerValide(overrides?)` — defaults : `statut: 'en_attente'`, `loyerHc: 80_000n centimes`, `montantCharges: 5_000n`, date du mois courant
- `unEncaissementValide(overrides?)` — defaults : `mode: 'virement'`, `montant: 85_000n`, `annuleLe: null`
- `uneQuittanceValide(overrides?)` — defaults : `numero: '2026-001'`, `annuleeLe: null`
- `uneRelanceValide(overrides?)` — defaults : `niveau: 1`, `canal: 'email'`
- `unBailleurValide(overrides?)` — defaults : `nomComplet: 'Jean Dupont'`, adresse Paris

---

### `tests/_world/monde-phase2.ts` (NOUVEAU)

**Role:** World Cucumber Phase 2 avec injection ClockFixe
**Analog:** `tests/bdd/step_definitions/activation.steps.ts` (lignes 1-44) — partie Before/After

**Excerpt à reproduire (lignes 29-44) — pattern Before hook :**
```typescript
Before(async function (this: MondeActivation) {
  process.env['SESSION_SECRET'] = 'test-secret-for-cucumber-tests-32chars!!';
  const sqlite = new Database(':memory:');
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
  await appliquerMigrationsBrutes(this.db, sqlite, MIGRATIONS_PATH);
  this.app = await creerApp(this.db);
  this.dernierStatut = 0;
  this.cookies = {};
});
```

**Adaptations requises :**
- `MIGRATIONS_PATH` : référencer `0002_phase2_init.sql` EN PLUS de `0001_init.sql` (ou path d'un fichier qui les enchaîne)
- Interface `MondePhase2 extends World` : ajouter `clock: ClockFixe`
- `this.clock = ClockFixe.du('2026-05-01')` — date fixe par défaut
- `this.app = await creerApp(this.db, { clock: this.clock })` — injection du clock dans l'app
- Step Gherkin `Given la date système est {string}` pour surcharger la date dans les features

---

### `tests/bdd/features/quittancement.feature`

**Role:** Scénarios BDD outside-in pour ENC-01/ENC-03/ENC-04/ENC-05
**Analog:** `tests/bdd/features/activation.feature` (lignes 1-37)
**Pourquoi cet analog:** Exact — même Gherkin (keywords anglais, textes français, pas de `# language: fr`)

**Excerpt à reproduire (lignes 1-10) — structure Gherkin :**
```gherkin
Feature: Activation

  Scenario: Création Bien minimal au premier lancement
    Given l'application est lancée pour la première fois
    When le bailleur soumet le formulaire Bien avec l'adresse "12 rue des Lilas"...
    Then le Bien est visible dans la liste GET /biens
    And la liste contient "12 rue des Lilas"
```

**Adaptations requises :**
- Steps avec `/` (routes) → regex `/^...$/` (Phase 1 LESSON — Cucumber Expression interprète `/` comme alternation)
- Scénario prorata : `Given la date système est "2026-03-15"` pour tester les seuils D-68
- Scénario sur-paiement : `Then la page affiche "Trop-perçu"`
- Scénario chaînage relances : enchaîner `Given niveau 1 envoyé il y a 25 jours` → `Then le bouton niveau 2 est visible`

---

### `tests/bdd/step_definitions/quittancement.steps.ts`

**Role:** Step definitions BDD Phase 2
**Analog:** `tests/bdd/step_definitions/activation.steps.ts` (lignes 1-379)
**Pourquoi cet analog:** Exact — même structure (Before/After + World typé + inject HTTP)

**Excerpt à reproduire (lignes 80-90) — pattern inject POST :**
```typescript
const payload = new URLSearchParams({
  loyerHcEuros: String(loyer),
  modeCharges: mode,
}).toString();

const reponse = await this.app.inject({
  method: 'POST',
  url: '/encaissements',
  payload,
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
});
```

**Adaptations requises :**
- Utiliser `MondePhase2` au lieu de `MondeActivation`
- Steps qui contrôlent le temps : `this.clock = ClockFixe.du(isoDate)` — nécessite que l'app soit réinstanciée ou que le clock soit muable via setDate
- SELECT DB direct pour vérifier les tables `echeance_loyer`, `encaissement`, `quittance` (même pattern que les `Then la table SQLite ... contient N ligne`)

---

### `tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts`

**Role:** Tests intégration roundtrip SQLite pour EcheanceLoyerRepository
**Analog:** `tests/integration/repositories/bail-repository-sqlite.test.ts` (lignes 1-160)
**Pourquoi cet analog:** Exact — même structure describe + beforeEach DB:memory + afterEach destroy

**Excerpt à reproduire (lignes 20-50) — structure setup :**
```typescript
describe('BailRepositorySqlite', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailRepo: BailRepositorySqlite;

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerMigrationsBrutes(db, sqlite, MIGRATIONS_PATH);
    bailRepo = new BailRepositorySqlite(db);
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('enregistrer + trouverParId roundtrip (loyer, dépôt, lot_ids, IRL)', async () => {
    const bail = unBailValide({ loyerHc: Money.fromEuros(800) });
    await bailRepo.enregistrer(bail);
    const retrouve = await bailRepo.trouverParId(bail.id);
    expect(retrouve!.loyerHc.toCentimes()).toBe(80_000n);
  });
```

**Adaptations requises :**
- `MIGRATIONS_PATH` : séquence `0001_init.sql` + `0002_phase2_init.sql` (ou un path d'un fichier combiné)
- Cas tests obligatoires : roundtrip Money (centimes négatifs pour compensateur), roundtrip Temporal.PlainDate `annule_le`, soft-delete `WHERE annule_le IS NULL`, `sommePaieeParEcheance` avec N encaissements dont 1 annulé

---

### `tests/unit/_shared/money.test.ts` (extension)

**Role:** Tests fast-check pour `Money.multiplyByFraction`
**Analog:** `tests/unit/_shared/money.test.ts` (lui-même — extension)

**Adaptations requises :**
- Ajouter tests propriétés fast-check (voir RESEARCH.md §4) : prorata mois entier = montant total, somme prorata ≤ total + 1 centime (arrondi banker's max)
- Pattern `.toMatch(/85/)` plutôt que `.toBe(...)` pour les assertions Money (Phase 1 LESSON U+00A0)

---

## Shared Patterns

### Authentification / sécurité
Aucune — application mono-user local (D-01). Pas de middleware auth requis.

### Error handling dans les routes Fastify
**Source:** `src/web/routes/baux.ts` (lignes 194-211)
**Appliquer à:** Toutes les nouvelles routes Phase 2

```typescript
// Pattern universel : extraireErreurs + try/catch + redirect
function extraireErreurs(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const cle = issue.path.join('.') || '_global';
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}

// Dans POST handler :
try {
  await useCase(commande, ...repos);
  return reply.redirect('/cible');
} catch (err) {
  const message = err instanceof Error ? err.message : 'Erreur inattendue';
  return reply.view('pages/xxx/formulaire.ejs', { erreurs: { _global: message }, valeurs: body });
}
```

### Roundtrip Money ↔ SQLite INTEGER
**Source:** `src/infrastructure/repositories/bail-repository-sqlite.ts` (lignes 159-161)
**Appliquer à:** Tous les adapters repository Phase 2

```typescript
// Écriture :
loyer_hc: Number(bail.loyerHc.toCentimes()),
// Lecture :
const loyerHc = Money.fromCentimes(BigInt(row.loyer_hc));
// Compensateur (négatifs) :
const montant = Money.fromCentimesSignes(BigInt(row.montant_centimes));
```

### Roundtrip Temporal.PlainDate ↔ SQLite TEXT ISO
**Source:** `src/infrastructure/repositories/bail-repository-sqlite.ts` (lignes 170-171)
**Appliquer à:** Tous les adapters repository Phase 2

```typescript
// Écriture :
periode_debut: echeance.periodeDebut.toString(),    // "2026-05-01"
// Lecture :
const periodeDebut = Temporal.PlainDate.from(row.periode_debut);
// Nullable :
const annuleLe = row.annule_le ? Temporal.PlainDate.from(row.annule_le) : null;
```

### Layout EJS split (règle non négociable Phase 1)
**Source:** `src/web/views/pages/baux/liste.ejs` (lignes 1, 63)
**Appliquer à:** Toutes les nouvelles pages EJS Phase 2

```ejs
<%- include('../../partials/layout-debut', {
  titre: 'Nom de la page',
  breadcrumbs: [{ label: 'Parent', url: '/parent' }, { label: 'Courante' }],
  navActive: 'echeances'
}) %>

<!-- contenu -->

<%- include('../../partials/layout-fin') %>
```

### preHandler helpers — ajouter `formatPeriode`
**Source:** Phase 1 LEARNING §preHandler + `src/helpers/format-date.ts`
**Appliquer à:** `src/main.ts` ou le point d'enregistrement du preHandler global

```typescript
// Existant :
reply.locals.formatDate = formatDate;
reply.locals.formatMoney = formatMoney;
// AJOUTER Phase 2 :
reply.locals.formatPeriode = formatPeriode;
reply.locals.formatNumeroQuittance = formatNumeroQuittance;
// NE PAS ajouter de données stateful (bannièreSuccess, session) — cf. Phase 1 LESSON
```

### Soft-delete — filtre Kysely
**Source:** `src/infrastructure/repositories/bail-repository-sqlite.ts` (lignes 75-76, 94-95)
**Appliquer à:** Toutes les queries de listing Phase 2

```typescript
// Pattern Phase 1 (supprime_le) :
.where('supprime_le', 'is', null)
// Adapter Phase 2 (annule_le pour Encaissement) :
.where('annule_le', 'is', null)
```

---

## Aucun Analog Trouvé

| Fichier | Role | Data Flow | Raison |
|---|---|---|---|
| `src/domain/_shared/clock.ts` | port | — | Aucune abstraction de date dans la codebase Phase 1. Nouveau pattern Phase 2 (RESEARCH.md §6) |
| `src/domain/encaissements/pdf-renderer.ts` | port | file-I/O | pdfmake jamais utilisé en Phase 1 (D-36 l'avait reporté). Nouveau port domaine Phase 2 (RESEARCH.md §1) |
| `src/infrastructure/pdf/pdf-renderer-pdfmake.ts` | adapter | file-I/O | Idem — première utilisation pdfmake (createRequire CJS depuis ESM). RESEARCH.md §1 |
| `src/infrastructure/storage/stockage-fichier-local.ts` | utility | file-I/O | Aucune persistance fichier en Phase 1. RESEARCH.md §1 (route download buffer) |
| `src/helpers/build-mailto.ts` | utility | transform | Aucun helper mailto en Phase 1. RESEARCH.md §2 (RFC 6068, encodeURIComponent, CRLF %0D%0A) |
| `templates/relances/01-amiable.ejs` | template | transform | Nouveau dossier `templates/relances/` hors `src/web/views/`. Pattern textuel EJS (pas HTML). CONTEXT.md D-70 |
| `tests/_world/monde-phase2.ts` | test | — | World Cucumber Phase 1 est inline dans `activation.steps.ts` — pas extrait en module séparé. Phase 2 introduit un World partagé avec Clock. RESEARCH.md §6 |

---

## Metadata

**Scope de recherche analog:** `src/` (domain, application, infrastructure, helpers, web), `tests/` (builders, bdd, unit, integration), `migrations/`
**Fichiers scannés:** 75
**Date d'extraction des patterns:** 2026-05-14

---

## PATTERN MAPPING COMPLETE

**Phase:** 2 — Quittancement, Échéances, Encaissements, Relances
**Fichiers classifiés:** 52
**Analogs trouvés:** 44 / 52

### Coverage
- Fichiers avec analog exact (même role, même data flow): 30
- Fichiers avec analog role-match (même role, data flow différent): 14
- Fichiers sans analog (nouveaux patterns Phase 2): 8

### Patterns clés identifiés
- Tous les agrégats Phase 2 (`EcheanceLoyer`, `Encaissement`, `Quittance`, `Relance`, `Bailleur`) copient le pattern `X.creer(props) + InvariantViolated + copy-on-write` de `bail.ts`
- Tous les adapters repository copient le pattern `versDomaine() + versRow() + transaction() + WHERE annule_le IS NULL` de `bail-repository-sqlite.ts`
- Toutes les routes copient le pattern `plugin(app, opts) + safeParse + extraireErreurs + try/catch + redirect` de `baux.ts`
- Les 8 partials Phase 1 (`data-table`, `form-field`, `empty-state`, `layout-debut/fin`, etc.) sont réutilisés sans réécriture
- Le port `Clock` + `ClockFixe` est le seul nouveau concept architectural Phase 2 (pas de précédent Phase 1)
- pdfmake via `createRequire(import.meta.url)` est le seul nouveau pattern infra Phase 2

### Fichier créé
`/Users/valentinshodo/Projects/toolbox/gestion-locative/.planning/phases/02-quittancement-ch-ances-encaissements-relances/02-PATTERNS.md`

### Prêt pour le planning
Le mapping des patterns est complet. Le planner peut référencer les excerpts de code des analogs dans chaque plan d'exécution.

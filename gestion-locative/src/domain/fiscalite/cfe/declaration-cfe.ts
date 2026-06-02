import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../../_shared/erreurs.js';
import {
  nouveauDeclarationCfeId,
  type BienId,
  type DeclarationCfeId,
} from '../../_shared/identifiants.js';
import { Money } from '../../_shared/money.js';

import {
  STATUTS_CFE_VALIDES,
  type StatutCfe,
} from './statut-cfe.js';

const MILLESIME_MIN = 2020;
const MILLESIME_MAX = 2030;

export interface DeclarationCfeProps {
  id?: DeclarationCfeId;
  bienId: BienId;
  millesime: number;
  statut: StatutCfe;
  dateDepotDeclaration: Temporal.PlainDate | null;
  montantAvisCentimes: Money | null;
  dateEcheancePaiement: Temporal.PlainDate;
}

type PatchDeclarationCfe = Partial<
  Omit<DeclarationCfeProps, 'id' | 'bienId' | 'millesime'>
>;

/**
 * Agrégat racine `DeclarationCfe` — Phase 6 / FIS-06 / D-CFE6.2 + D-CFE6.3 + D-CFE6.4.
 *
 * Référence `BienId` par identifiant (pattern miroir `TicketTravaux`),
 * jamais sous-agrégat de `Bien` (D-CFE6.2).
 *
 * Invariants (D-CFE6.3) :
 *   - statut ∈ STATUTS_CFE_VALIDES.
 *   - millesime ∈ [2020, 2030].
 *   - statut === 'deposee' ⇒ dateDepotDeclaration non null.
 *   - statut === 'payee'   ⇒ dateDepotDeclaration ET montantAvisCentimes non null.
 *   - statut === 'exoneree_premiere_annee' | 'exoneree_commune' : dépôt et montant
 *     facultatifs (D-CFE6.4 — exonération = simple documentation).
 *
 * Édition par `modifier(patch)` copy-on-write, en utilisant `'field' in patch`
 * pour les nullables (anti-écrasement silencieux — pas de `??` ici).
 */
export class DeclarationCfe {
  readonly id: DeclarationCfeId;
  readonly bienId: BienId;
  readonly millesime: number;
  readonly statut: StatutCfe;
  readonly dateDepotDeclaration: Temporal.PlainDate | null;
  readonly montantAvisCentimes: Money | null;
  readonly dateEcheancePaiement: Temporal.PlainDate;

  private constructor(id: DeclarationCfeId, props: Omit<DeclarationCfeProps, 'id'>) {
    this.id = id;
    this.bienId = props.bienId;
    this.millesime = props.millesime;
    this.statut = props.statut;
    this.dateDepotDeclaration = props.dateDepotDeclaration;
    this.montantAvisCentimes = props.montantAvisCentimes;
    this.dateEcheancePaiement = props.dateEcheancePaiement;
  }

  static creer(props: DeclarationCfeProps): DeclarationCfe {
    if (!STATUTS_CFE_VALIDES.includes(props.statut)) {
      throw new InvariantViolated(
        `Statut CFE invalide : "${props.statut}". Valeurs acceptées : ${STATUTS_CFE_VALIDES.join(', ')}`,
      );
    }
    if (
      !Number.isInteger(props.millesime)
      || props.millesime < MILLESIME_MIN
      || props.millesime > MILLESIME_MAX
    ) {
      throw new InvariantViolated(
        `Millesime CFE hors plage raisonnable (${MILLESIME_MIN}-${MILLESIME_MAX}) : ${props.millesime}`,
      );
    }
    if (props.statut === 'deposee' && props.dateDepotDeclaration === null) {
      throw new InvariantViolated(
        "DeclarationCfe statut='deposee' exige dateDepotDeclaration (D-CFE6.3)",
      );
    }
    if (props.statut === 'payee') {
      if (props.dateDepotDeclaration === null) {
        throw new InvariantViolated(
          "DeclarationCfe statut='payee' exige dateDepotDeclaration (D-CFE6.3)",
        );
      }
      if (props.montantAvisCentimes === null) {
        throw new InvariantViolated(
          "DeclarationCfe statut='payee' exige montantAvisCentimes (D-CFE6.3)",
        );
      }
    }

    const id = props.id ?? nouveauDeclarationCfeId();
    return new DeclarationCfe(id, {
      bienId: props.bienId,
      millesime: props.millesime,
      statut: props.statut,
      dateDepotDeclaration: props.dateDepotDeclaration,
      montantAvisCentimes: props.montantAvisCentimes,
      dateEcheancePaiement: props.dateEcheancePaiement,
    });
  }

  /**
   * Copy-on-write — retourne une nouvelle `DeclarationCfe` reflétant le patch.
   *
   * Champs immuables (omis du type) : `id`, `bienId`, `millesime`.
   *
   * Pour les nullables (`dateDepotDeclaration`, `montantAvisCentimes`), on utilise
   * `'field' in patch` au lieu de `patch.field ?? this.field` — sinon un `null`
   * explicite serait silencieusement remplacé par la valeur précédente (RESEARCH §Pattern 3).
   */
  modifier(patch: PatchDeclarationCfe): DeclarationCfe {
    const next: DeclarationCfeProps = {
      id: this.id,
      bienId: this.bienId,
      millesime: this.millesime,
      statut: 'statut' in patch ? (patch.statut as StatutCfe) : this.statut,
      dateDepotDeclaration:
        'dateDepotDeclaration' in patch
          ? (patch.dateDepotDeclaration ?? null)
          : this.dateDepotDeclaration,
      montantAvisCentimes:
        'montantAvisCentimes' in patch
          ? (patch.montantAvisCentimes ?? null)
          : this.montantAvisCentimes,
      dateEcheancePaiement: patch.dateEcheancePaiement ?? this.dateEcheancePaiement,
    };
    return DeclarationCfe.creer(next);
  }
}

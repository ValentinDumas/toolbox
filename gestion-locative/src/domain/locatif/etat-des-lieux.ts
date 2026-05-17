/**
 * Agrégat racine EtatDesLieux — LOC-03 (loi 89 art. 3-2).
 * Type discriminant 'entree' | 'sortie'. Soft-delete via annuleLe + raisonAnnulation.
 * Invariant cross-aggregate D-89 (≤1 actif par bail et type) assuré par le use case et UNIQUE INDEX partiel.
 */
import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import { EDLDejaAnnule } from './erreurs.js';
import { nouveauEtatDesLieuxId, type EtatDesLieuxId, type BailId } from '../_shared/identifiants.js';
import { InventaireItem, TYPES_ITEM_INVENTAIRE } from '../_shared/inventaire-item.js';

export type TypeEDL = 'entree' | 'sortie';

const TYPES_EDL_VALIDES: TypeEDL[] = ['entree', 'sortie'];

interface EtatDesLieuxProps {
  id?: EtatDesLieuxId;
  bailId: BailId;
  type: TypeEDL;
  dateEdl: Temporal.PlainDate;
  contradictoire: boolean;
  dateSignature: Temporal.PlainDate | null;
  inventaire: InventaireItem[];
  annuleLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

export class EtatDesLieux {
  readonly id: EtatDesLieuxId;
  readonly bailId: BailId;
  readonly type: TypeEDL;
  readonly dateEdl: Temporal.PlainDate;
  readonly contradictoire: boolean;
  readonly dateSignature: Temporal.PlainDate | null;
  readonly inventaire: ReadonlyArray<InventaireItem>;
  readonly annuleLe: Temporal.PlainDate | null;
  readonly raisonAnnulation: string | null;

  private constructor(id: EtatDesLieuxId, props: Omit<EtatDesLieuxProps, 'id'>) {
    this.id = id;
    this.bailId = props.bailId;
    this.type = props.type;
    this.dateEdl = props.dateEdl;
    this.contradictoire = props.contradictoire;
    this.dateSignature = props.dateSignature;
    this.inventaire = Object.freeze([...props.inventaire]);
    this.annuleLe = props.annuleLe ?? null;
    this.raisonAnnulation = props.raisonAnnulation ?? null;
  }

  static creer(props: EtatDesLieuxProps): EtatDesLieux {
    // Valider type ∈ {entree, sortie}
    if (!TYPES_EDL_VALIDES.includes(props.type)) {
      throw new InvariantViolated(`Type EDL invalide : "${props.type}". Valeurs acceptées : entree, sortie`);
    }

    // Valider inventaire.length === 12
    if (props.inventaire.length !== 12) {
      throw new InvariantViolated(
        "L'inventaire doit contenir exactement les 12 items du décret 2015-981",
      );
    }

    // Valider couverture exacte des 12 typeItems (sans doublon, sans manquant)
    const typesPresents = new Set(props.inventaire.map((i) => i.typeItem));
    const tousCouverts =
      typesPresents.size === 12 && props.inventaire.every((i) => TYPES_ITEM_INVENTAIRE.includes(i.typeItem));
    if (!tousCouverts) {
      throw new InvariantViolated(
        "L'inventaire doit couvrir les 12 typeItems du décret 2015-981 sans doublon",
      );
    }

    // EDL contradictoire → dateSignature obligatoire (loi 89 art. 3-2)
    if (props.contradictoire === true && props.dateSignature == null) {
      throw new InvariantViolated('Un EDL contradictoire doit avoir une date de signature');
    }

    const id = props.id ?? nouveauEtatDesLieuxId();
    return new EtatDesLieux(id, {
      bailId: props.bailId,
      type: props.type,
      dateEdl: props.dateEdl,
      contradictoire: props.contradictoire,
      dateSignature: props.dateSignature,
      inventaire: props.inventaire,
      annuleLe: props.annuleLe,
      raisonAnnulation: props.raisonAnnulation,
    });
  }

  /**
   * Soft-delete — annule cet EDL (pattern Encaissement Phase 2).
   * Throw EDLDejaAnnule si déjà annulé.
   */
  annuler(raison: string, annuleLe: Temporal.PlainDate): EtatDesLieux {
    if (this.annuleLe !== null) {
      throw new EDLDejaAnnule();
    }
    return EtatDesLieux.creer({
      id: this.id,
      bailId: this.bailId,
      type: this.type,
      dateEdl: this.dateEdl,
      contradictoire: this.contradictoire,
      dateSignature: this.dateSignature,
      inventaire: [...this.inventaire],
      annuleLe,
      raisonAnnulation: raison,
    });
  }

  toProps(): EtatDesLieuxProps {
    return {
      id: this.id,
      bailId: this.bailId,
      type: this.type,
      dateEdl: this.dateEdl,
      contradictoire: this.contradictoire,
      dateSignature: this.dateSignature,
      inventaire: [...this.inventaire],
      annuleLe: this.annuleLe,
      raisonAnnulation: this.raisonAnnulation,
    };
  }
}

import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauLotId, type LotId } from '../_shared/identifiants.js';

export type TypeLot = 'appartement' | 'parking' | 'cave' | 'local_commercial' | 'terrasse' | 'autre';

const TYPES_LOT_AVEC_SURFACE_OBLIGATOIRE: TypeLot[] = ['appartement', 'local_commercial'];

interface LotProps {
  id?: LotId;
  designation: string;
  surface: number | null;
  type: TypeLot;
  etage: number | null;
}

export class Lot {
  readonly id: LotId;
  readonly designation: string;
  readonly surface: number | null;
  readonly type: TypeLot;
  readonly etage: number | null;

  private constructor(id: LotId, props: Omit<LotProps, 'id'>) {
    this.id = id;
    this.designation = props.designation;
    this.surface = props.surface;
    this.type = props.type;
    this.etage = props.etage;
  }

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
}

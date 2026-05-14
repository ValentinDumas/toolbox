import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauBienId, type BienId } from '../_shared/identifiants.js';
import type { Adresse } from '../_shared/adresse.js';
import type { Lot } from './lot.js';

export type TypeBien = 'appartement' | 'maison' | 'immeuble' | 'local_commercial';

interface BienProps {
  id?: BienId;
  adresse: Adresse;
  surface: number;
  type: TypeBien;
  anneeConstruction: number;
  lots: Lot[];
}

export class Bien {
  readonly id: BienId;
  readonly adresse: Adresse;
  readonly surface: number;
  readonly type: TypeBien;
  readonly anneeConstruction: number;
  readonly lots: ReadonlyArray<Lot>;

  private constructor(id: BienId, props: Omit<BienProps, 'id'>) {
    this.id = id;
    this.adresse = props.adresse;
    this.surface = props.surface;
    this.type = props.type;
    this.anneeConstruction = props.anneeConstruction;
    this.lots = Object.freeze([...props.lots]);
  }

  static creer(props: BienProps): Bien {
    if (props.surface <= 0) {
      throw new InvariantViolated("La surface d'un Bien doit être strictement positive");
    }

    if (props.lots.length === 0) {
      throw new InvariantViolated("Un Bien doit avoir au moins un Lot");
    }

    const typesValides: TypeBien[] = ['appartement', 'maison', 'immeuble', 'local_commercial'];
    if (!typesValides.includes(props.type)) {
      throw new InvariantViolated(`Le type de bien "${props.type}" est invalide`);
    }

    const anneeActuelle = new Date().getFullYear();
    if (props.anneeConstruction < 1700 || props.anneeConstruction > anneeActuelle + 1) {
      throw new InvariantViolated(`L'année de construction doit être comprise entre 1700 et ${anneeActuelle + 1}`);
    }

    const id = props.id ?? nouveauBienId();
    return new Bien(id, {
      adresse: props.adresse,
      surface: props.surface,
      type: props.type,
      anneeConstruction: props.anneeConstruction,
      lots: props.lots,
    });
  }

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
}

import { InvariantViolated } from './erreurs.js';

interface AdresseProps {
  rue: string;
  codePostal: string;
  ville: string;
}

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

  enLigne(): string {
    return `${this.rue}, ${this.codePostal} ${this.ville}`;
  }

  egale(autre: Adresse): boolean {
    return (
      this.rue === autre.rue &&
      this.codePostal === autre.codePostal &&
      this.ville === autre.ville
    );
  }
}

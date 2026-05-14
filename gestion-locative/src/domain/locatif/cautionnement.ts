import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import type { Money } from '../_shared/money.js';
import type { Adresse } from '../_shared/adresse.js';

/** Types de cautionnement (D-33). */
export type TypeCautionnement = 'physique' | 'visale' | 'gli';

/** Garant physique (caution personnelle). */
export interface Garant {
  readonly nom: string;
  readonly prenom: string;
  readonly email: string;
  readonly telephone: string;
  readonly adresse: Adresse;
}

interface CautionnementProps {
  type: TypeCautionnement;
  garant: Garant | null;
  montantGaranti: Money | null;
  dateSignature: Temporal.PlainDate;
  dureeEngagement: number; // mois
}

/**
 * VO Cautionnement — rattaché au Bail (D-33).
 * type='physique' → caution personnelle, garant obligatoire.
 * type='visale'   → organisme VISALE, garant optionnel.
 * type='gli'      → garantie loyers impayés, garant optionnel.
 */
export class Cautionnement {
  readonly type: TypeCautionnement;
  readonly garant: Garant | null;
  readonly montantGaranti: Money | null;
  readonly dateSignature: Temporal.PlainDate;
  readonly dureeEngagement: number;

  private constructor(props: CautionnementProps) {
    this.type = props.type;
    this.garant = props.garant;
    this.montantGaranti = props.montantGaranti;
    this.dateSignature = props.dateSignature;
    this.dureeEngagement = props.dureeEngagement;
  }

  static creer(props: CautionnementProps): Cautionnement {
    const typesValides: TypeCautionnement[] = ['physique', 'visale', 'gli'];
    if (!typesValides.includes(props.type)) {
      throw new InvariantViolated(`Type de cautionnement invalide : "${props.type}"`);
    }

    // Caution personnelle : garant obligatoire
    if (props.type === 'physique' && !props.garant) {
      throw new InvariantViolated(
        'Un cautionnement physique requiert un garant (nom, prénom, email, adresse)',
      );
    }

    // La signature ne peut pas être dans le futur
    if (Temporal.PlainDate.compare(props.dateSignature, Temporal.Now.plainDateISO()) > 0) {
      throw new InvariantViolated(
        'La date de signature du cautionnement ne peut pas être dans le futur',
      );
    }

    if (props.dureeEngagement < 1) {
      throw new InvariantViolated(
        "La durée d'engagement du cautionnement doit être d'au moins 1 mois",
      );
    }

    return new Cautionnement(props);
  }

  /** Sérialisation JSON pour stockage en colonne TEXT SQLite (D-33). */
  toJSON(): object {
    return {
      type: this.type,
      garant: this.garant
        ? {
            nom: this.garant.nom,
            prenom: this.garant.prenom,
            email: this.garant.email,
            telephone: this.garant.telephone,
            adresse: {
              rue: this.garant.adresse.rue,
              codePostal: this.garant.adresse.codePostal,
              ville: this.garant.adresse.ville,
            },
          }
        : null,
      montantGaranti: this.montantGaranti ? Number(this.montantGaranti.toCentimes()) : null,
      dateSignature: this.dateSignature.toString(),
      dureeEngagement: this.dureeEngagement,
    };
  }
}

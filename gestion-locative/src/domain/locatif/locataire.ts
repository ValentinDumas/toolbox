import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauLocataireId, type LocataireId } from '../_shared/identifiants.js';
import type { Adresse } from '../_shared/adresse.js';

// Validation minimale email côté domaine — la validation RFC complète est déléguée à Zod côté HTTP
// Le domaine garantit uniquement la forme non-vide avec arobase et point dans le domaine
const REGEX_EMAIL_MINIMAL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface LieuNaissance {
  readonly commune: string;
  readonly pays: string;
}

function validerLieuNaissance(lieu: { commune: string; pays: string }): LieuNaissance {
  if (!lieu.commune.trim()) {
    throw new InvariantViolated('La commune de naissance est obligatoire');
  }
  if (!lieu.pays.trim()) {
    throw new InvariantViolated('Le pays de naissance est obligatoire');
  }
  return { commune: lieu.commune.trim(), pays: lieu.pays.trim() };
}

interface LocataireProps {
  id?: LocataireId;
  nom: string;
  prenom: string;
  dateNaissance: Temporal.PlainDate;
  lieuNaissance: { commune: string; pays: string };
  nationalite: string;
  email: string;
  telephone: string | null;
  adresseActuelle: Adresse;
}

export interface ModifierLocatairePatch {
  nom?: string;
  prenom?: string;
  dateNaissance?: Temporal.PlainDate;
  lieuNaissance?: { commune: string; pays: string };
  nationalite?: string;
  email?: string;
  telephone?: string | null;
  adresseActuelle?: Adresse;
}

export class Locataire {
  readonly id: LocataireId;
  readonly nom: string;
  readonly prenom: string;
  readonly dateNaissance: Temporal.PlainDate;
  readonly lieuNaissance: LieuNaissance;
  readonly nationalite: string;
  readonly email: string;
  readonly telephone: string | null;
  readonly adresseActuelle: Adresse;

  private constructor(id: LocataireId, props: Omit<LocataireProps, 'id'> & { lieuNaissance: LieuNaissance }) {
    this.id = id;
    this.nom = props.nom;
    this.prenom = props.prenom;
    this.dateNaissance = props.dateNaissance;
    this.lieuNaissance = props.lieuNaissance;
    this.nationalite = props.nationalite;
    this.email = props.email;
    this.telephone = props.telephone;
    this.adresseActuelle = props.adresseActuelle;
  }

  static creer(props: LocataireProps): Locataire {
    if (!props.nom.trim()) {
      throw new InvariantViolated('Le nom du locataire est obligatoire');
    }
    if (!props.prenom.trim()) {
      throw new InvariantViolated('Le prénom du locataire est obligatoire');
    }
    if (!REGEX_EMAIL_MINIMAL.test(props.email)) {
      throw new InvariantViolated("L'email du locataire est invalide");
    }
    if (!props.nationalite.trim()) {
      throw new InvariantViolated('La nationalité du locataire est obligatoire');
    }
    // La date de naissance doit être dans le passé (mentions obligatoires bail — LOCATION_MEUBLEE_REGLES §9.1)
    if (Temporal.PlainDate.compare(props.dateNaissance, Temporal.Now.plainDateISO()) >= 0) {
      throw new InvariantViolated('La date de naissance doit être dans le passé');
    }

    const lieuNaissance = validerLieuNaissance(props.lieuNaissance);
    const id = props.id ?? nouveauLocataireId();

    return new Locataire(id, {
      nom: props.nom.trim(),
      prenom: props.prenom.trim(),
      dateNaissance: props.dateNaissance,
      lieuNaissance,
      nationalite: props.nationalite.trim(),
      email: props.email,
      telephone: props.telephone ?? null,
      adresseActuelle: props.adresseActuelle,
    });
  }

  modifier(patch: ModifierLocatairePatch): Locataire {
    return Locataire.creer({
      id: this.id,
      nom: patch.nom ?? this.nom,
      prenom: patch.prenom ?? this.prenom,
      dateNaissance: patch.dateNaissance ?? this.dateNaissance,
      lieuNaissance: patch.lieuNaissance ?? this.lieuNaissance,
      nationalite: patch.nationalite ?? this.nationalite,
      email: patch.email ?? this.email,
      telephone: patch.telephone !== undefined ? patch.telephone : this.telephone,
      adresseActuelle: patch.adresseActuelle ?? this.adresseActuelle,
    });
  }
}

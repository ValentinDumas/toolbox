import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauBailleurId, type BailleurId } from '../_shared/identifiants.js';
import { Adresse } from '../_shared/adresse.js';

interface BailleurProps {
  id?: BailleurId;
  nomComplet: string;
  adresse: Adresse;
}

interface ModifierBailleurPatch {
  nomComplet?: string;
  adresse?: Adresse;
}

/**
 * Agrégat Bailleur — singleton mono-user (D-67).
 * Représente l'identité du bailleur physique (mentions légales loi 89 art. 21).
 * Une seule instance en base, protégée par UNIQUE(singleton_marker).
 */
export class Bailleur {
  readonly id: BailleurId;
  readonly nomComplet: string;
  readonly adresse: Adresse;

  private constructor(id: BailleurId, nomComplet: string, adresse: Adresse) {
    this.id = id;
    this.nomComplet = nomComplet;
    this.adresse = adresse;
  }

  static creer(props: BailleurProps): Bailleur {
    if (!props.nomComplet.trim()) {
      throw new InvariantViolated('Le nom complet du bailleur ne peut pas être vide');
    }

    const id = props.id ?? nouveauBailleurId();
    return new Bailleur(id, props.nomComplet.trim(), props.adresse);
  }

  /** Copy-on-write — retourne une nouvelle instance avec les champs modifiés. */
  modifier(patch: ModifierBailleurPatch): Bailleur {
    return Bailleur.creer({
      id: this.id,
      nomComplet: patch.nomComplet ?? this.nomComplet,
      adresse: patch.adresse ?? this.adresse,
    });
  }
}

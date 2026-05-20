import { Temporal } from '@js-temporal/polyfill';
import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauBailleurId, type BailleurId } from '../_shared/identifiants.js';
import { Adresse } from '../_shared/adresse.js';
import { Money } from '../_shared/money.js';

/**
 * Régime fiscal LMNP courant du bailleur.
 * null = non encore choisi / auto-déduit (état initial).
 * La cohérence régime vs recettes est portée par DeclarationAnnuelle (Plan 06) — D-LOCK-2.
 */
export type RegimeFiscal = 'micro_bic' | 'reel';

interface BailleurProps {
  id?: BailleurId;
  nomComplet: string;
  adresse: Adresse;
  /** Phase 5 — D-LOCK-2 + D-FIS-G4.3 : régime fiscal courant (null = non encore choisi) */
  regimeFiscal?: RegimeFiscal | null;
  /** Phase 5 — D-FIS-G3.1 : revenus actifs annuels courant pour pré-remplissage wizard clôture */
  revenusActifsAnnuelsCourant?: Money | null;
  /** Phase 5 — D-FIS-G5.4 : trace du premier accès à l'écran Fiscalité (onboarding progressif) */
  fiscalitePremierAcces?: Temporal.PlainDateTime | null;
}

interface ModifierBailleurPatch {
  nomComplet?: string;
  adresse?: Adresse;
  /** Phase 5 — D-LOCK-2 */
  regimeFiscal?: RegimeFiscal | null;
  /** Phase 5 — D-FIS-G3.1 */
  revenusActifsAnnuelsCourant?: Money | null;
  /** Phase 5 — D-FIS-G5.4 */
  fiscalitePremierAcces?: Temporal.PlainDateTime | null;
}

/**
 * Agrégat Bailleur — singleton mono-user (D-67).
 * Représente l'identité du bailleur physique (mentions légales loi 89 art. 21).
 * Une seule instance en base, protégée par UNIQUE(singleton_marker).
 *
 * Phase 5 : extension avec 3 champs fiscaux nullables (D-LOCK-2, D-FIS-G3.1, D-FIS-G5.4).
 * Aucun invariant croisé introduit côté Bailleur — la cohérence (regimeFiscal vs recettes)
 * est portée par DeclarationAnnuelle au Plan 06.
 */
export class Bailleur {
  readonly id: BailleurId;
  readonly nomComplet: string;
  readonly adresse: Adresse;
  /** Phase 5 — régime fiscal courant du bailleur (null = non encore choisi) */
  readonly regimeFiscal: RegimeFiscal | null;
  /** Phase 5 — revenus actifs annuels courant (pré-remplissage wizard clôture G3.1) */
  readonly revenusActifsAnnuelsCourant: Money | null;
  /** Phase 5 — timestamp premier accès écran Fiscalité (onboarding progressif G5.4) */
  readonly fiscalitePremierAcces: Temporal.PlainDateTime | null;

  private constructor(
    id: BailleurId,
    nomComplet: string,
    adresse: Adresse,
    regimeFiscal: RegimeFiscal | null,
    revenusActifsAnnuelsCourant: Money | null,
    fiscalitePremierAcces: Temporal.PlainDateTime | null,
  ) {
    this.id = id;
    this.nomComplet = nomComplet;
    this.adresse = adresse;
    this.regimeFiscal = regimeFiscal;
    this.revenusActifsAnnuelsCourant = revenusActifsAnnuelsCourant;
    this.fiscalitePremierAcces = fiscalitePremierAcces;
  }

  static creer(props: BailleurProps): Bailleur {
    if (!props.nomComplet.trim()) {
      throw new InvariantViolated('Le nom complet du bailleur ne peut pas être vide');
    }

    const id = props.id ?? nouveauBailleurId();
    return new Bailleur(
      id,
      props.nomComplet.trim(),
      props.adresse,
      props.regimeFiscal ?? null,
      props.revenusActifsAnnuelsCourant ?? null,
      props.fiscalitePremierAcces ?? null,
    );
  }

  /**
   * Copy-on-write — retourne une nouvelle instance avec les champs modifiés.
   * Les champs fiscaux nullables : si le patch définit la clé (même à null),
   * la valeur du patch est utilisée. Sinon, la valeur courante est conservée.
   */
  modifier(patch: ModifierBailleurPatch): Bailleur {
    return Bailleur.creer({
      id: this.id,
      nomComplet: patch.nomComplet ?? this.nomComplet,
      adresse: patch.adresse ?? this.adresse,
      // Pour les champs nullables Phase 5 : utiliser la clé du patch si elle est définie,
      // sinon conserver la valeur courante ('undefined' = non modifié).
      regimeFiscal: 'regimeFiscal' in patch ? patch.regimeFiscal : this.regimeFiscal,
      revenusActifsAnnuelsCourant: 'revenusActifsAnnuelsCourant' in patch
        ? patch.revenusActifsAnnuelsCourant
        : this.revenusActifsAnnuelsCourant,
      fiscalitePremierAcces: 'fiscalitePremierAcces' in patch
        ? patch.fiscalitePremierAcces
        : this.fiscalitePremierAcces,
    });
  }
}

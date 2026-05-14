import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauQuittanceId, type QuittanceId, type EcheanceLoyerId } from '../_shared/identifiants.js';
import { QuittanceDejaAnnulee } from './erreurs.js';

/**
 * Format AAAA-NNN : au moins 4 chiffres (année) + tiret + au moins 3 chiffres (séquence).
 * Exemples valides : 2026-001, 2026-042, 2026-1000, 2027-001.
 * Invalides : 26-1, abc, 2026-1 (2 chiffres seulement).
 */
const NUMERO_REGEX = /^\d{4}-\d{3,}$/;

interface QuittanceProps {
  id?: QuittanceId;
  echeanceId: EcheanceLoyerId;
  numero: string;
  cheminFichierRelatif: string;
  emiseLe: Temporal.PlainDate;
  annuleeLe?: Temporal.PlainDate | null;
  raisonAnnulation?: string | null;
}

/**
 * Agrégat Quittance (D-63, D-64, D-65).
 *
 * Invariants :
 *   - numero matches /^\d{4}-\d{3,}$/ (AAAA-NNN minimum)
 *   - PDF immutable (cheminFichierRelatif non modifiable après émission)
 *   - Annulation = copy-on-write, jamais de DELETE
 */
export class Quittance {
  readonly id: QuittanceId;
  readonly echeanceId: EcheanceLoyerId;
  readonly numero: string;
  readonly cheminFichierRelatif: string;
  readonly emiseLe: Temporal.PlainDate;
  readonly annuleeLe: Temporal.PlainDate | null;
  readonly raisonAnnulation: string | null;

  private constructor(id: QuittanceId, props: Omit<QuittanceProps, 'id'>) {
    this.id = id;
    this.echeanceId = props.echeanceId;
    this.numero = props.numero;
    this.cheminFichierRelatif = props.cheminFichierRelatif;
    this.emiseLe = props.emiseLe;
    this.annuleeLe = props.annuleeLe ?? null;
    this.raisonAnnulation = props.raisonAnnulation ?? null;
  }

  static creer(props: QuittanceProps): Quittance {
    if (!NUMERO_REGEX.test(props.numero)) {
      throw new InvariantViolated(
        `Numéro de quittance invalide : "${props.numero}". Format attendu : AAAA-NNN (ex. 2026-001)`,
      );
    }

    const id = props.id ?? nouveauQuittanceId();
    return new Quittance(id, {
      echeanceId: props.echeanceId,
      numero: props.numero,
      cheminFichierRelatif: props.cheminFichierRelatif,
      emiseLe: props.emiseLe,
      annuleeLe: props.annuleeLe ?? null,
      raisonAnnulation: props.raisonAnnulation ?? null,
    });
  }

  /**
   * Copy-on-write — retourne une nouvelle Quittance annulée (D-65).
   * Throw QuittanceDejaAnnulee si déjà annulée.
   * Le fichier PDF est conservé (D-63 immutabilité).
   */
  annuler(raison: string, annuleeLe: Temporal.PlainDate): Quittance {
    if (this.annuleeLe !== null) {
      throw new QuittanceDejaAnnulee();
    }
    return Quittance.creer({
      id: this.id,
      echeanceId: this.echeanceId,
      numero: this.numero,
      cheminFichierRelatif: this.cheminFichierRelatif,
      emiseLe: this.emiseLe,
      annuleeLe,
      raisonAnnulation: raison,
    });
  }

  /** Vrai si cette quittance n'est pas annulée. */
  estActive(): boolean {
    return this.annuleeLe === null;
  }
}

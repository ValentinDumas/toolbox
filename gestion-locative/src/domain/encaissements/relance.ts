import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import { nouveauRelanceId, type RelanceId, type EcheanceLoyerId } from '../_shared/identifiants.js';

export type NiveauRelance = 1 | 2 | 3;
export type CanalRelance = 'email' | 'pdf';

const NIVEAUX_VALIDES: NiveauRelance[] = [1, 2, 3];
const CANAUX_VALIDES: CanalRelance[] = ['email', 'pdf'];

interface RelanceProps {
  id?: RelanceId;
  echeanceId: EcheanceLoyerId;
  niveau: NiveauRelance;
  canal: CanalRelance;
  envoyeeLe: Temporal.PlainDate;
  contenuSnapshot: string;
  annuleLe?: Temporal.PlainDate | null;
}

/**
 * Agrégat Relance (D-68, D-69, D-70, D-71).
 *
 * Invariants :
 *   - niveau ∈ {1, 2, 3}
 *   - canal ∈ {'email', 'pdf'}
 *   - Annulation = copy-on-write, jamais de DELETE (D-71)
 *   - contenuSnapshot = JSON { variables, contenuRendu, mailtoUri, version } (audit-friendly)
 */
export class Relance {
  readonly id: RelanceId;
  readonly echeanceId: EcheanceLoyerId;
  readonly niveau: NiveauRelance;
  readonly canal: CanalRelance;
  readonly envoyeeLe: Temporal.PlainDate;
  readonly contenuSnapshot: string;
  readonly annuleLe: Temporal.PlainDate | null;

  private constructor(id: RelanceId, props: Omit<RelanceProps, 'id'>) {
    this.id = id;
    this.echeanceId = props.echeanceId;
    this.niveau = props.niveau;
    this.canal = props.canal;
    this.envoyeeLe = props.envoyeeLe;
    this.contenuSnapshot = props.contenuSnapshot;
    this.annuleLe = props.annuleLe ?? null;
  }

  static creer(props: RelanceProps): Relance {
    if (!NIVEAUX_VALIDES.includes(props.niveau as NiveauRelance)) {
      throw new InvariantViolated(
        `Niveau de relance invalide : ${String(props.niveau)}. Valeurs acceptées : 1, 2, 3`,
      );
    }

    if (!CANAUX_VALIDES.includes(props.canal as CanalRelance)) {
      throw new InvariantViolated(
        `Canal de relance invalide : "${String(props.canal)}". Valeurs acceptées : email, pdf`,
      );
    }

    const id = props.id ?? nouveauRelanceId();
    return new Relance(id, {
      echeanceId: props.echeanceId,
      niveau: props.niveau,
      canal: props.canal,
      envoyeeLe: props.envoyeeLe,
      contenuSnapshot: props.contenuSnapshot,
      annuleLe: props.annuleLe ?? null,
    });
  }

  /**
   * Copy-on-write — retourne une nouvelle Relance annulée (D-71).
   */
  annuler(annuleLe: Temporal.PlainDate): Relance {
    return Relance.creer({
      id: this.id,
      echeanceId: this.echeanceId,
      niveau: this.niveau,
      canal: this.canal,
      envoyeeLe: this.envoyeeLe,
      contenuSnapshot: this.contenuSnapshot,
      annuleLe,
    });
  }

  estActive(): boolean {
    return this.annuleLe === null;
  }
}

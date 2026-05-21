import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauDeclarationCorrigeeId,
  type DeclarationAnnuelleId,
  type DeclarationCorrigeeId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import type { QualificationFiscale } from './qualification-fiscale.js';
import type { VerdictLmp } from './verdict-lmp.js';

export type ChargesCorrigeesParCategorie = Record<QualificationFiscale, Money>;

export interface DeclarationCorrigeeProps {
  id?: DeclarationCorrigeeId;
  declarationOriginaleId: DeclarationAnnuelleId;
  motif: string;
  regimeApplique: 'micro_bic' | 'reel';
  recettesTotales: Money;
  chargesQualifieesParCategorie: ChargesCorrigeesParCategorie;
  dotationAmortissement: Money;
  ardGenere: Money;
  ardConsomme: Money;
  revenusFoyerSnapshot: Money | null;
  statutLmnpLmp: VerdictLmp;
  creeLe: Temporal.PlainDateTime;
}

/**
 * Agrégat racine DeclarationCorrigee — APPEND-ONLY STRICT (D-FIS-G4.4).
 *
 * Append-only strict : aucune méthode de modification ou d'annulation.
 * Pointe vers une declarationOriginaleId qui reste INTACTE.
 * N corrections successives supportées : chaque DeclarationCorrigee est une
 * nouvelle ligne, toutes pointant vers la même originale (append-only).
 *
 * Invariants :
 *   - motif non vide
 *   - declarationOriginaleId référence une DeclarationAnnuelle existante (FK DB)
 *
 * Analog : src/domain/locatif/bail-indexation.ts (append-only strict, D-96)
 */
export class DeclarationCorrigee {
  readonly id: DeclarationCorrigeeId;
  readonly declarationOriginaleId: DeclarationAnnuelleId;
  readonly motif: string;
  readonly regimeApplique: 'micro_bic' | 'reel';
  readonly recettesTotales: Money;
  readonly chargesQualifieesParCategorie: ChargesCorrigeesParCategorie;
  readonly dotationAmortissement: Money;
  readonly ardGenere: Money;
  readonly ardConsomme: Money;
  readonly revenusFoyerSnapshot: Money | null;
  readonly statutLmnpLmp: VerdictLmp;
  readonly creeLe: Temporal.PlainDateTime;

  private constructor(id: DeclarationCorrigeeId, props: Omit<DeclarationCorrigeeProps, 'id'>) {
    this.id = id;
    this.declarationOriginaleId = props.declarationOriginaleId;
    this.motif = props.motif;
    this.regimeApplique = props.regimeApplique;
    this.recettesTotales = props.recettesTotales;
    this.chargesQualifieesParCategorie = props.chargesQualifieesParCategorie;
    this.dotationAmortissement = props.dotationAmortissement;
    this.ardGenere = props.ardGenere;
    this.ardConsomme = props.ardConsomme;
    this.revenusFoyerSnapshot = props.revenusFoyerSnapshot;
    this.statutLmnpLmp = props.statutLmnpLmp;
    this.creeLe = props.creeLe;
  }

  /**
   * Factory append-only — seul point de création d'une DeclarationCorrigee.
   * @throws InvariantViolated si motif est vide
   */
  static creer(props: DeclarationCorrigeeProps): DeclarationCorrigee {
    if (props.motif.trim().length === 0) {
      throw new InvariantViolated('Le motif de correction ne peut pas être vide (D-FIS-G4.4)');
    }

    const id = props.id ?? nouveauDeclarationCorrigeeId();
    return new DeclarationCorrigee(id, {
      declarationOriginaleId: props.declarationOriginaleId,
      motif: props.motif,
      regimeApplique: props.regimeApplique,
      recettesTotales: props.recettesTotales,
      chargesQualifieesParCategorie: props.chargesQualifieesParCategorie,
      dotationAmortissement: props.dotationAmortissement,
      ardGenere: props.ardGenere,
      ardConsomme: props.ardConsomme,
      revenusFoyerSnapshot: props.revenusFoyerSnapshot,
      statutLmnpLmp: props.statutLmnpLmp,
      creeLe: props.creeLe,
    });
  }

  /** Sérialisation pour tests. */
  toProps(): DeclarationCorrigeeProps & { id: DeclarationCorrigeeId } {
    return {
      id: this.id,
      declarationOriginaleId: this.declarationOriginaleId,
      motif: this.motif,
      regimeApplique: this.regimeApplique,
      recettesTotales: this.recettesTotales,
      chargesQualifieesParCategorie: this.chargesQualifieesParCategorie,
      dotationAmortissement: this.dotationAmortissement,
      ardGenere: this.ardGenere,
      ardConsomme: this.ardConsomme,
      revenusFoyerSnapshot: this.revenusFoyerSnapshot,
      statutLmnpLmp: this.statutLmnpLmp,
      creeLe: this.creeLe,
    };
  }
}

import { Temporal } from '@js-temporal/polyfill';

import { InvariantViolated } from '../_shared/erreurs.js';
import {
  nouveauDeclarationAnnuelleId,
  type BailleurId,
  type DeclarationAnnuelleId,
} from '../_shared/identifiants.js';
import { Money } from '../_shared/money.js';
import type { QualificationFiscale } from './qualification-fiscale.js';
import type { VerdictLmp } from './verdict-lmp.js';

/**
 * Map des charges agrégées par catégorie de qualification (D-FIS-G2.2).
 * Sérialisée en JSON dans la colonne charges_qualifiees_json.
 */
export type ChargesQualifieesParCategorie = Record<QualificationFiscale, Money>;

export interface DeclarationAnnuelleProps {
  id?: DeclarationAnnuelleId;
  bailleurId: BailleurId;
  exercice: number;
  regimeApplique: 'micro_bic' | 'reel';
  recettesTotales: Money;
  chargesQualifieesParCategorie: ChargesQualifieesParCategorie;
  dotationAmortissement: Money;
  ardGenere: Money;
  ardConsomme: Money;
  revenusFoyerSnapshot: Money | null;
  statutLmnpLmp: VerdictLmp;
  composantsSnapshot: string; // JSON sérialisé — D-FIS-G4.2 'composants_snapshot_json conservé pour rejouer le calcul'
  clotureLe: Temporal.PlainDate;
  /** Seuil LMP recettes — injecté pour validation invariant D-FIS-G3.1 */
  seuilLmpRecettes: Money;
}

/**
 * Agrégat racine DeclarationAnnuelle — APPEND-ONLY STRICT (D-FIS-G4.2).
 *
 * Append-only strict : aucune méthode de modification ou d'annulation.
 * Une correction métier passe par la création d'une DeclarationCorrigee
 * (jamais de UPDATE ni de onConflict sur declarations_annuelles).
 *
 * Invariants (D-FIS-G4.2, CONTEXT.md L208) :
 *   - regimeApplique ∈ ('micro_bic', 'reel')
 *   - statutLmnpLmp ∈ VerdictLmp valeurs
 *   - revenusFoyerSnapshot REQUIS si recettesTotales > SEUIL_LMP_RECETTES (D-FIS-G3.1)
 *   - regimeApplique='reel' ⇒ composantsSnapshot ne doit pas être '[]' (au moins 1 composant)
 *   - UNIQUE (bailleurId, exercice) côté DB — D-FIS-G4.1, G4.2 (double clôture interdite)
 *   - statut implicite='cloture' — la création EST la clôture
 *
 * Analog : src/domain/locatif/bail-indexation.ts (append-only strict, D-96)
 */
export class DeclarationAnnuelle {
  readonly id: DeclarationAnnuelleId;
  readonly bailleurId: BailleurId;
  readonly exercice: number;
  readonly regimeApplique: 'micro_bic' | 'reel';
  readonly recettesTotales: Money;
  readonly chargesQualifieesParCategorie: ChargesQualifieesParCategorie;
  readonly dotationAmortissement: Money;
  readonly ardGenere: Money;
  readonly ardConsomme: Money;
  readonly revenusFoyerSnapshot: Money | null;
  readonly statutLmnpLmp: VerdictLmp;
  readonly composantsSnapshot: string;
  readonly clotureLe: Temporal.PlainDate;

  private constructor(
    id: DeclarationAnnuelleId,
    props: Omit<DeclarationAnnuelleProps, 'id' | 'seuilLmpRecettes'>,
  ) {
    this.id = id;
    this.bailleurId = props.bailleurId;
    this.exercice = props.exercice;
    this.regimeApplique = props.regimeApplique;
    this.recettesTotales = props.recettesTotales;
    this.chargesQualifieesParCategorie = props.chargesQualifieesParCategorie;
    this.dotationAmortissement = props.dotationAmortissement;
    this.ardGenere = props.ardGenere;
    this.ardConsomme = props.ardConsomme;
    this.revenusFoyerSnapshot = props.revenusFoyerSnapshot;
    this.statutLmnpLmp = props.statutLmnpLmp;
    this.composantsSnapshot = props.composantsSnapshot;
    this.clotureLe = props.clotureLe;
  }

  /**
   * Factory append-only — seul point de création d'une DeclarationAnnuelle.
   * Valide tous les invariants D-FIS-G4.2 avant création.
   *
   * @throws InvariantViolated si les invariants ne sont pas respectés
   */
  static creer(props: DeclarationAnnuelleProps): DeclarationAnnuelle {
    if (props.exercice <= 0) {
      throw new InvariantViolated(`exercice doit être > 0 (reçu : ${props.exercice})`);
    }

    // Invariant D-FIS-G3.1 : revenus foyer REQUIS si recettes > seuil LMP
    if (
      props.recettesTotales.superieurA(props.seuilLmpRecettes) &&
      props.revenusFoyerSnapshot === null
    ) {
      throw new InvariantViolated(
        `RevenusFoyerSnapshot requis : recettes (${props.recettesTotales.enEuros()}) > seuil LMP (${props.seuilLmpRecettes.enEuros()}) — D-FIS-G3.1`,
      );
    }

    // Invariant : regime 'reel' ⇒ au moins 1 composant dans le snapshot
    if (
      props.regimeApplique === 'reel' &&
      props.composantsSnapshot.trim() === '[]'
    ) {
      throw new InvariantViolated(
        "regimeApplique='reel' exige au moins 1 composant dans composantsSnapshot (D-FIS-G4.2)",
      );
    }

    const id = props.id ?? nouveauDeclarationAnnuelleId();
    return new DeclarationAnnuelle(id, {
      bailleurId: props.bailleurId,
      exercice: props.exercice,
      regimeApplique: props.regimeApplique,
      recettesTotales: props.recettesTotales,
      chargesQualifieesParCategorie: props.chargesQualifieesParCategorie,
      dotationAmortissement: props.dotationAmortissement,
      ardGenere: props.ardGenere,
      ardConsomme: props.ardConsomme,
      revenusFoyerSnapshot: props.revenusFoyerSnapshot,
      statutLmnpLmp: props.statutLmnpLmp,
      composantsSnapshot: props.composantsSnapshot,
      clotureLe: props.clotureLe,
    });
  }

  /** Sérialisation pour tests et audit trail. */
  toProps(): Omit<DeclarationAnnuelleProps, 'seuilLmpRecettes'> & { id: DeclarationAnnuelleId } {
    return {
      id: this.id,
      bailleurId: this.bailleurId,
      exercice: this.exercice,
      regimeApplique: this.regimeApplique,
      recettesTotales: this.recettesTotales,
      chargesQualifieesParCategorie: this.chargesQualifieesParCategorie,
      dotationAmortissement: this.dotationAmortissement,
      ardGenere: this.ardGenere,
      ardConsomme: this.ardConsomme,
      revenusFoyerSnapshot: this.revenusFoyerSnapshot,
      statutLmnpLmp: this.statutLmnpLmp,
      composantsSnapshot: this.composantsSnapshot,
      clotureLe: this.clotureLe,
    };
  }
}

/**
 * Enum QualificationFiscale — 4 catégories alignées liasse 2033-A (D-FIS-G2.2).
 *
 * Sources juridiques :
 *   - D-FIS-G2.2 : taxonomie à 4 catégories (entretien_reparation / amelioration /
 *     charge_courante_periodique / non_deductible)
 *   - D-FIS-G2.1 : statut 'non_qualifie' par défaut tant que non traité
 *
 * Alignement liasse 2031 :
 *   - entretien_reparation → ligne 2033-A "Entretiens, réparations, petits équipements"
 *   - amelioration → immobilisation amortissable (2033-B)
 *   - charge_courante_periodique → lignes diverses 2033-A
 *   - non_deductible → non reporté (personnel, hors activité)
 */
export type QualificationFiscale =
  | 'non_qualifie'
  | 'entretien_reparation'
  | 'amelioration'
  | 'charge_courante_periodique'
  | 'non_deductible';

/** Toutes les valeurs valides (runtime guard pour validation Zod et invariants). */
export const QUALIFICATIONS_VALIDES: readonly QualificationFiscale[] = [
  'non_qualifie',
  'entretien_reparation',
  'amelioration',
  'charge_courante_periodique',
  'non_deductible',
] as const;

/**
 * Qualifications déductibles fiscalement (excluent non_qualifie et non_deductible).
 * Utilisé par ChargesRepository pour agréger les charges déductibles.
 */
export const QUALIFICATIONS_DEDUCTIBLES: readonly QualificationFiscale[] = [
  'entretien_reparation',
  'amelioration',
  'charge_courante_periodique',
] as const;

/** Étiquettes françaises pour l'UI (radio, badges, tableaux). */
export const LABELS_QUALIFICATION: Record<QualificationFiscale, string> = {
  non_qualifie: 'À qualifier',
  entretien_reparation: 'Entretien / Réparation',
  amelioration: 'Amélioration',
  charge_courante_periodique: 'Charge courante périodique',
  non_deductible: 'Non déductible',
};

/**
 * Retourne true si la qualification est fiscalement déductible.
 * Utilisé par les use cases de calcul (D-FIS-G2.2).
 */
export function estQualificationDeductible(q: QualificationFiscale): boolean {
  return (QUALIFICATIONS_DEDUCTIBLES as readonly string[]).includes(q);
}

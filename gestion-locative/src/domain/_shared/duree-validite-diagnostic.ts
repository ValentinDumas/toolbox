/**
 * Durées légales de validité des diagnostics techniques immobiliers — D-77.
 *
 * Références légales :
 * - DPE  : 10 ans (Code de la construction et de l'habitation L126-26)
 * - Gaz  : 6 ans  (CCH R134-6 — décret 2002-120 modifié)
 * - Élec : 6 ans  (CCH R134-10 — décret 2002-120 modifié)
 * - ERP  : validité illimitée (sauf modifications majeures du bien)
 *
 * RISQUE R1.1 (RISKS.md) : cette constante est versionneable post-loi de finances annuelle.
 * Revue en janvier de chaque année. Si la durée légale change, mettre à jour ici + PR dédiée.
 *
 * Placé dans _shared (kernel partagé) pour éviter le cycle d'import locatif → patrimoine.
 * Consommé par : Diagnostic (patrimoine) + simulerIndexation (locatif, Phase 3-03).
 */

export type TypeDiagnostic = 'dpe' | 'gaz' | 'elec' | 'erp';

export type ClasseDpe = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export const TYPES_DIAGNOSTIC: TypeDiagnostic[] = ['dpe', 'gaz', 'elec', 'erp'];

export const CLASSES_DPE: ClasseDpe[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export const DUREES_VALIDITE: Record<TypeDiagnostic, { annees: number | null }> = {
  dpe: { annees: 10 },
  gaz: { annees: 6 },
  elec: { annees: 6 },
  erp: { annees: null },
};

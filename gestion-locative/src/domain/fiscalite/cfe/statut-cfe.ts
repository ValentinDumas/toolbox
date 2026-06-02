/**
 * Statuts d'une `DeclarationCfe` — Phase 6 / FIS-06 / D-CFE6.3.
 *
 * Strictement 5 valeurs :
 *   - 'non_deposee'              : déclaration 1447-C-SD non encore déposée auprès du SIE.
 *   - 'deposee'                  : 1447-C-SD déposée, avis CFE en attente de la commune.
 *   - 'exoneree_premiere_annee'  : première année d'activité LMNP — CGI art. 1478 II (D-CFE6.4).
 *   - 'exoneree_commune'         : décision d'exonération communale (CGI art. 1464 ss).
 *   - 'payee'                    : avis reçu et payé (date dépôt + montant requis, D-CFE6.3).
 *
 * Aucune transition automatique : l'utilisateur édite manuellement (D-CFE6.3).
 */

export type StatutCfe =
  | 'non_deposee'
  | 'deposee'
  | 'exoneree_premiere_annee'
  | 'exoneree_commune'
  | 'payee';

export const STATUTS_CFE_VALIDES: readonly StatutCfe[] = [
  'non_deposee',
  'deposee',
  'exoneree_premiere_annee',
  'exoneree_commune',
  'payee',
] as const;

export const LIBELLES_STATUT_CFE: Record<StatutCfe, string> = {
  non_deposee: 'Non déposée',
  deposee: 'Déposée',
  exoneree_premiere_annee: 'Exonérée — première année (CGI art. 1478)',
  exoneree_commune: 'Exonérée — décision de la commune',
  payee: 'Payée',
};

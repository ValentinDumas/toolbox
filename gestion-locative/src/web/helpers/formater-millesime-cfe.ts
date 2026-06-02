/**
 * Formate un millésime CFE (UI-SPEC §S8 carte CFE).
 * Ex : 2026 → "CFE 2026".
 */
export function formaterMillesimeCfe(millesime: number): string {
  return `CFE ${millesime}`;
}

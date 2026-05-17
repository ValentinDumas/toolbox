import type { ClasseDpe } from '../domain/_shared/duree-validite-diagnostic.js';

/**
 * Formate une classe DPE en libellé court.
 * null → 'Non renseignée' ; 'F' → 'DPE F'.
 * DP-18 : helper preHandler injectable dans les locals EJS.
 */
export function formaterClasseDpe(classe: ClasseDpe | null): string {
  return classe === null ? 'Non renseignée' : 'DPE ' + classe;
}

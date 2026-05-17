import { z } from 'zod';

/** Format canonique domain : "YYYY-TN" (cf src/domain/_shared/irl.ts). */
export const TRIMESTRE_CANONIQUE = /^\d{4}-T[1-4]$/;
/** Format UI français accepté en saisie : "NTYYYY" (ex 1T2026). */
export const TRIMESTRE_UI = /^[1-4]T\d{4}$/;

/**
 * Normalise une chaîne trimestre vers le format canonique domain "YYYY-TN".
 * Si l'entrée matche le format UI "NTYYYY", convertit. Sinon retourne tel quel.
 */
export function formaterTrimestreUIVersCanonique(s: string): string {
  if (TRIMESTRE_UI.test(s)) {
    return `${s.slice(2)}-T${s[0]}`;
  }
  return s;
}

/** Schema de saisie IRL — accepte les 2 formats trimestre, normalise vers canonique. */
export const indexationSaisieSchema = z.object({
  irl_trimestre: z
    .string()
    .regex(
      /^(\d{4}-T[1-4]|[1-4]T\d{4})$/,
      'Format trimestre attendu : 2026-T1 ou 1T2026.',
    )
    .transform(formaterTrimestreUIVersCanonique),
  irl_valeur: z
    .string()
    .regex(/^\d+(\.\d+)?$/, 'La valeur IRL doit être un nombre positif (ex 145.47).'),
});

export type IndexationSaisieInput = z.infer<typeof indexationSaisieSchema>;

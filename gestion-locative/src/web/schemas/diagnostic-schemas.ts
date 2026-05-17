import { z } from 'zod';

/**
 * Schéma Zod pour la création d'un Diagnostic technique.
 * Double barrière avec InvariantViolated côté domaine (T-03-01-01, T-03-01-02 — STRIDE mitigate).
 */
export const diagnosticCreationSchema = z
  .object({
    type: z.enum(['dpe', 'gaz', 'elec', 'erp'], {
      errorMap: () => ({ message: 'Type de diagnostic invalide.' }),
    }),
    date_emission: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ.'),
    classe_dpe: z.enum(['A', 'B', 'C', 'D', 'E', 'F', 'G']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'dpe' && !data.classe_dpe) {
      ctx.addIssue({
        code: 'custom',
        path: ['classe_dpe'],
        message: 'La classe DPE est obligatoire pour un diagnostic DPE.',
      });
    }
    if (data.type !== 'dpe' && data.classe_dpe) {
      ctx.addIssue({
        code: 'custom',
        path: ['classe_dpe'],
        message: "La classe DPE n'est pertinente que pour le diagnostic DPE.",
      });
    }
  });

import { z } from 'zod';

/**
 * WR-10 : validation Zod du formulaire POST /relances.
 * Accepte echeanceId UUID v4 + niveau ∈ {1, 2, 3}.
 */
export const relanceFormSchema = z.object({
  echeanceId: z.string().uuid('Sélectionnez une échéance valide'),
  niveau: z.coerce
    .number()
    .int('Niveau invalide')
    .min(1, 'Niveau invalide')
    .max(3, 'Niveau invalide'),
});

export type RelanceFormData = z.infer<typeof relanceFormSchema>;

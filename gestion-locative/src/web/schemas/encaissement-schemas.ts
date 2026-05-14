import { z } from 'zod';

export const encaissementFormSchema = z.object({
  echeanceId: z.string().uuid('Sélectionnez une échéance valide'),
  montantEuros: z.coerce
    .number()
    .refine((n) => n > 0, 'Le montant doit être supérieur à 0 €'),
  signe: z.enum(['positif', 'compensateur']).default('positif'),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ'),
  mode: z.enum(['virement', 'cheque', 'especes', 'prelevement', 'autre'], {
    errorMap: () => ({ message: 'Sélectionnez un mode de paiement' }),
  }),
});

export type EncaissementFormData = z.infer<typeof encaissementFormSchema>;

export const annulationFormSchema = z.object({
  raison: z.string().trim().min(3, 'Au moins 3 caractères'),
});

export type AnnulationFormData = z.infer<typeof annulationFormSchema>;

import { z } from 'zod';

export const genererQuittanceFormSchema = z.object({
  echeanceId: z.string().uuid('Échéance invalide'),
});

export const annulerQuittanceFormSchema = z.object({
  raison: z.string().trim().min(3, 'Au moins 3 caractères'),
});

export type GenererQuittanceFormData = z.infer<typeof genererQuittanceFormSchema>;
export type AnnulerQuittanceFormData = z.infer<typeof annulerQuittanceFormSchema>;

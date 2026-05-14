import { z } from 'zod';

export const bailleurFormSchema = z.object({
  nomComplet: z.string().trim().min(1, 'Le nom complet est requis'),
  rue: z.string().trim().min(1, 'La rue est requise'),
  codePostal: z.string().trim().regex(/^\d{5}$/, 'Code postal à 5 chiffres'),
  ville: z.string().trim().min(1, 'La ville est requise'),
});

export type BailleurFormData = z.infer<typeof bailleurFormSchema>;

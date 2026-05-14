import { z } from 'zod';

export const locataireCreationSchema = z.object({
  nom: z.string().trim().min(1, 'Le nom est obligatoire'),
  prenom: z.string().trim().min(1, 'Le prénom est obligatoire'),
  dateNaissance: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date de naissance doit être au format AAAA-MM-JJ'),
  communeNaissance: z.string().trim().min(1, 'La commune de naissance est obligatoire'),
  paysNaissance: z.string().trim().min(1, 'Le pays de naissance est obligatoire'),
  nationalite: z.string().trim().min(1, 'La nationalité est obligatoire'),
  email: z.string().email("L'email est invalide"),
  telephone: z
    .string()
    .trim()
    .min(1)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  rue: z.string().trim().min(1, 'La rue est obligatoire'),
  codePostal: z
    .string()
    .regex(/^\d{5}$/, 'Le code postal doit comporter 5 chiffres'),
  ville: z.string().trim().min(1, 'La ville est obligatoire'),
});

export const locataireModificationSchema = locataireCreationSchema.partial();

export type CreationLocataireFormData = z.infer<typeof locataireCreationSchema>;
export type ModificationLocataireFormData = z.infer<typeof locataireModificationSchema>;

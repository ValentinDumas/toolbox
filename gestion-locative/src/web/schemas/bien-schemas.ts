import { z } from 'zod';

export const lotCreationSchema = z.object({
  designation: z.string().trim().min(1, 'La désignation est obligatoire.'),
  surface: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().positive('La surface doit être > 0.').nullable(),
  ),
  type: z.enum(['appartement', 'parking', 'cave', 'local_commercial', 'terrasse', 'autre'], {
    errorMap: () => ({ message: "Le type de lot est invalide." }),
  }),
  etage: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z.number().int('L\'étage doit être un entier.').nullable(),
  ),
});

export type LotCreationData = z.infer<typeof lotCreationSchema>;

export const bienCreationSchema = z.object({
  rue: z.string().trim().min(1, 'La rue est obligatoire.'),
  codePostal: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres.'),
  ville: z.string().trim().min(1, 'La ville est obligatoire.'),
  surface: z.coerce.number().positive('La surface doit être > 0.'),
  type: z.enum(['appartement', 'maison', 'immeuble', 'local_commercial'], {
    errorMap: () => ({ message: "Le type de bien est invalide." }),
  }),
  anneeConstruction: z.coerce
    .number()
    .int()
    .min(1700, "L'année de construction doit être ≥ 1700.")
    .max(new Date().getFullYear() + 1, "L'année de construction ne peut pas être dans le futur."),
  lots: z.array(lotCreationSchema).min(1, 'Au moins un lot est requis.').max(50, 'Un Bien ne peut pas avoir plus de 50 lots.'),
});

export type BienCreationData = z.infer<typeof bienCreationSchema>;

export const bienModificationSchema = z.object({
  rue: z.string().trim().min(1, 'La rue est obligatoire.'),
  codePostal: z.string().regex(/^\d{5}$/, 'Le code postal doit contenir 5 chiffres.'),
  ville: z.string().trim().min(1, 'La ville est obligatoire.'),
  surface: z.coerce.number().positive('La surface doit être > 0.'),
  type: z.enum(['appartement', 'maison', 'immeuble', 'local_commercial'], {
    errorMap: () => ({ message: "Le type de bien est invalide." }),
  }),
  anneeConstruction: z.coerce
    .number()
    .int()
    .min(1700, "L'année de construction doit être ≥ 1700.")
    .max(new Date().getFullYear() + 1, "L'année de construction ne peut pas être dans le futur."),
});

export type BienModificationData = z.infer<typeof bienModificationSchema>;

/**
 * Reconstruit le tableau de lots depuis un body FormData plat.
 * Les champs sont encodés lots[0].designation, lots[1].type, etc.
 * Retourne un tableau d'objets triés par index.
 */
export function normaliserLotsFormBody(body: Record<string, string | string[]>): unknown[] {
  const lotsMap = new Map<number, Record<string, unknown>>();

  for (const [cle, valeur] of Object.entries(body)) {
    const match = /^lots\[(\d+)\]\.(.+)$/.exec(cle);
    if (!match) continue;
    const index = parseInt(match[1]!, 10);
    const prop = match[2]!;
    if (!lotsMap.has(index)) lotsMap.set(index, {});
    lotsMap.get(index)![prop] = valeur;
  }

  return Array.from(lotsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, obj]) => obj);
}

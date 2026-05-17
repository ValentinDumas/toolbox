/**
 * Schémas Zod pour les formulaires EDL (LOC-03).
 * Gère la normalisation du body HTML form-urlencoded vers le format attendu par les use cases.
 */
import { z } from 'zod';
import { TYPES_ITEM_INVENTAIRE, type TypeItemInventaire, type EtatItem } from '../../domain/_shared/inventaire-item.js';

/**
 * Schéma d'un item d'inventaire tel qu'il arrive du formulaire HTML.
 * Les clés sont indexées : inventaire[0].typeItem, inventaire[0].present, etc.
 */
const inventaireItemFormSchema = z.object({
  typeItem: z.enum(TYPES_ITEM_INVENTAIRE as [TypeItemInventaire, ...TypeItemInventaire[]]),
  present: z
    .union([z.literal('on'), z.literal('true'), z.literal('1'), z.boolean()])
    .transform((v) => v === 'on' || v === 'true' || v === '1' || v === true)
    .optional()
    .default(false),
  etat: z
    .enum(['bon', 'moyen', 'degrade'])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  note: z.string().trim().max(500).nullable().optional().transform((v) => v ?? null),
});

/**
 * Normalise le body HTML (form-urlencoded) pour en extraire l'inventaire indexé.
 * Exemple : { 'inventaire[0].typeItem': 'literie', 'inventaire[0].present': 'on', ... }
 * → [{ typeItem: 'literie', present: true, etat: null, note: null }, ...]
 */
export function normaliserInventaireFormBody(
  body: Record<string, unknown>,
): Array<{ typeItem: string; present: boolean; etat: string | null; note: string | null }> {
  // Regrouper les clés par index
  const byIndex = new Map<number, Record<string, unknown>>();

  for (const [key, value] of Object.entries(body)) {
    const match = key.match(/^inventaire\[(\d+)\]\.(.+)$/);
    if (!match) continue;
    const idx = parseInt(match[1]!, 10);
    const field = match[2]!;
    const existing = byIndex.get(idx) ?? {};
    existing[field] = value;
    byIndex.set(idx, existing);
  }

  // Trier par index et parser chaque item
  const result: Array<{ typeItem: string; present: boolean; etat: string | null; note: string | null }> = [];
  const sortedIndexes = [...byIndex.keys()].sort((a, b) => a - b);

  for (const idx of sortedIndexes) {
    const raw = byIndex.get(idx)!;
    const parsed = inventaireItemFormSchema.safeParse(raw);
    if (parsed.success) {
      result.push({
        typeItem: parsed.data.typeItem,
        present: parsed.data.present,
        etat: parsed.data.etat as EtatItem,
        note: parsed.data.note,
      });
    }
  }

  return result;
}

/** Schéma complet du formulaire EDL (entrée et sortie partagent la même structure). */
export const edlFormSchema = z.object({
  date_edl: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date EDL doit être au format AAAA-MM-JJ'),
  contradictoire: z
    .union([z.literal('on'), z.literal('true'), z.literal('1'), z.boolean()])
    .transform((v) => v === 'on' || v === 'true' || v === '1' || v === true)
    .optional()
    .default(false),
  date_signature: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .transform((v) => (v && v.trim() !== '' ? v : null)),
  raison: z.string().trim().min(1, 'La raison est requise').max(500).optional(),
});

export type EdlFormData = z.infer<typeof edlFormSchema>;

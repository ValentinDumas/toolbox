import { z } from 'zod';

import { STATUTS_CFE_VALIDES } from '../../domain/fiscalite/cfe/statut-cfe.js';

/**
 * Schémas Zod aux frontières HTTP (D-15) — routes CFE.
 *
 * Validation côté serveur = source de vérité ; les invariants métier
 * (`DeclarationCfe.creer`) sont en défense en profondeur.
 *
 * Anti-mass-assignment (T-06-CFE6-01) : aucun champ `id` ou `bienId` ici —
 * le `bienId` vient de `req.params.id`, l'`id` est généré côté domaine.
 */

const dateIsoSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ requis');

const dateOuVideSchema = z
  .union([dateIsoSchema, z.literal('')])
  .transform((v) => (v === '' ? null : v));

const montantEurosOuVideSchema = z
  .union([z.coerce.number().min(0, 'Le montant doit être positif'), z.literal('')])
  .transform((v) => (v === '' ? null : v));

export const enregistrerCfeSchema = z.object({
  millesime: z.coerce
    .number()
    .int('Le millésime doit être un entier')
    .min(2020, 'Le millésime doit être ≥ 2020')
    .max(2030, 'Le millésime doit être ≤ 2030'),
  statut: z.enum(STATUTS_CFE_VALIDES as readonly [string, ...string[]]),
  dateDepotDeclaration: dateOuVideSchema,
  montantAvisEuros: montantEurosOuVideSchema,
  dateEcheancePaiement: dateIsoSchema,
});

export type EnregistrerCfeData = z.infer<typeof enregistrerCfeSchema>;

export const modifierCfeSchema = z.object({
  statut: z.enum(STATUTS_CFE_VALIDES as readonly [string, ...string[]]).optional(),
  dateDepotDeclaration: dateOuVideSchema.optional(),
  montantAvisEuros: montantEurosOuVideSchema.optional(),
  dateEcheancePaiement: dateIsoSchema.optional(),
});

export type ModifierCfeData = z.infer<typeof modifierCfeSchema>;

import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';

import { TYPES_JUSTIFICATIF } from '../../domain/documents/justificatif.js';

/**
 * Zod schemas pour la création / soft-delete de justificatif.
 * Double barrière avec InvariantViolated côté domaine (T-04-01 mitigate).
 */

const typeEnumValues = TYPES_JUSTIFICATIF as readonly [
  string,
  ...string[],
];

export const uploadJustificatifFormSchema = z
  .object({
    titre: z
      .string()
      .trim()
      .min(1, 'Le titre est obligatoire.')
      .max(200),
    type: z.enum(typeEnumValues as unknown as [string, ...string[]], {
      errorMap: () => ({ message: 'Le type de document est obligatoire.' }),
    }),
    dateDocument: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ.')
      .refine(
        (s) => {
          try {
            const d = Temporal.PlainDate.from(s);
            const today = Temporal.Now.plainDateISO();
            return Temporal.PlainDate.compare(d, today) <= 0;
          } catch {
            return false;
          }
        },
        'La date du document ne peut pas être dans le futur.',
      ),
    bienId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    locataireId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    montantTtcCentimes: z
      .union([z.coerce.number().int().nonnegative(), z.literal('')])
      .optional()
      .transform((v) =>
        v === '' || v === undefined || v === null ? undefined : v,
      ),
    notes: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    rattachement: z.enum(['bien', 'locataire', 'bien_et_locataire'], {
      errorMap: () => ({
        message: 'Le type de rattachement est obligatoire.',
      }),
    }),
  })
  .superRefine((data, ctx) => {
    // D-103 : croise rattachement vs bienId/locataireId fournis
    if (data.rattachement === 'bien' && !data.bienId) {
      ctx.addIssue({
        code: 'custom',
        path: ['bienId'],
        message: 'Le bien à rattacher est obligatoire.',
      });
    }
    if (data.rattachement === 'locataire' && !data.locataireId) {
      ctx.addIssue({
        code: 'custom',
        path: ['locataireId'],
        message: 'Le locataire à rattacher est obligatoire.',
      });
    }
    if (data.rattachement === 'bien_et_locataire') {
      if (!data.bienId || !data.locataireId) {
        ctx.addIssue({
          code: 'custom',
          path: ['rattachement'],
          message:
            'Le document doit être rattaché à un bien ET à un locataire.',
        });
      }
    }
  });

export type UploadJustificatifFormSchema = z.infer<
  typeof uploadJustificatifFormSchema
>;

export const corbeilleJustificatifFormSchema = z.object({
  raison: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

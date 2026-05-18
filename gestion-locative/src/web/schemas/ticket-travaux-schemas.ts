import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';

import { TYPES_JUSTIFICATIF } from '../../domain/documents/justificatif.js';

/**
 * Zod schemas BC Travaux (T-04-18, T-04-19, T-04-21, T-04-25 mitigate).
 *
 * Défense en profondeur — les invariants domaine `TicketTravaux.creer`
 * re-valident titre, description, dateOuverture future.
 */

const typeJustificatifEnumValues = TYPES_JUSTIFICATIF as readonly [
  string,
  ...string[],
];

/**
 * Schéma de création d'un ticket (POST /biens/:id/travaux).
 *
 * coutEstimeTtcEuros optionnel — la conversion euros → centimes est faite
 * côté route (préserve la précision via Money.fromEuros).
 */
export const creerTicketSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, 'Le titre du ticket est obligatoire.')
    .max(200),
  description: z
    .string()
    .trim()
    .min(1, 'La description est obligatoire.')
    .max(5000),
  dateOuverture: z
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
      "La date d'ouverture ne peut pas être dans le futur.",
    ),
  coutEstimeTtcEuros: z
    .union([z.coerce.number().nonnegative(), z.literal('')])
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
});

export type CreerTicketSchema = z.infer<typeof creerTicketSchema>;

/**
 * Schéma de clôture d'un ticket (POST /travaux/:id/clore).
 *
 * coutReelTtcEuros REQUIS — verbatim UI-6.2 "Le coût réel TTC est obligatoire
 * pour clore le ticket." (T-04-19 mitigate, défense en profondeur Zod + domain).
 */
// Le verbatim UI-6.2 — exposé pour réutilisation dans les routes (catch
// TransitionInvalide / domain bypass safety).
export const VERBATIM_COUT_REEL_REQUIS =
  'Le coût réel TTC est obligatoire pour clore le ticket.';

export const cloreTicketSchema = z.object({
  dateCloture: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date attendu : AAAA-MM-JJ.'),
  coutReelTtcEuros: z.preprocess(
    (v) => {
      // Convertit "" / null / undefined en NaN pour faire échouer le coerce
      if (v === '' || v === null || v === undefined) return Number.NaN;
      return v;
    },
    z
      .coerce
      .number({
        invalid_type_error: VERBATIM_COUT_REEL_REQUIS,
        required_error: VERBATIM_COUT_REEL_REQUIS,
      })
      .nonnegative(VERBATIM_COUT_REEL_REQUIS)
      .refine(
        (n) => Number.isFinite(n),
        VERBATIM_COUT_REEL_REQUIS,
      ),
  ),
});

export type CloreTicketSchema = z.infer<typeof cloreTicketSchema>;

/** Schéma d'annulation d'un ticket (POST /travaux/:id/annuler). */
export const annulerTicketSchema = z.object({
  raison: z
    .string()
    .trim()
    .min(1, "La raison d'annulation est obligatoire.")
    .max(500),
});

export type AnnulerTicketSchema = z.infer<typeof annulerTicketSchema>;

/**
 * Schéma upload PJ depuis le panneau ticket (multipart fields).
 *
 * PAS de champ rattachement — bienId implicite = ticket.bienId (forcé côté
 * use case ajouter-pj-ticket, T-04-21 mitigate).
 */
export const ajouterPJUploadSchema = z.object({
  titre: z
    .string()
    .trim()
    .min(1, 'Le titre est obligatoire.')
    .max(200),
  type: z.enum(typeJustificatifEnumValues as unknown as [string, ...string[]], {
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
  montantTtcEuros: z
    .union([z.coerce.number().nonnegative(), z.literal('')])
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
});

export type AjouterPJUploadSchema = z.infer<typeof ajouterPJUploadSchema>;

/** Schéma attach Justificatif existant (query string ?justificatifId=...). */
export const ajouterPJExistantSchema = z.object({
  justificatifId: z.string().uuid('Identifiant justificatif invalide.'),
});

export type AjouterPJExistantSchema = z.infer<typeof ajouterPJExistantSchema>;

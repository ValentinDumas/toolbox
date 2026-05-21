import { z } from 'zod';
import { QUALIFICATIONS_VALIDES } from '../../domain/fiscalite/qualification-fiscale.js';

/**
 * POST /biens/:bienId/fiscalite/activer
 *
 * Validation Zod côté serveur (source de vérité).
 * T-05-03-02 : Σ composants validé en use case (ComposantsSommeIncoherente) — pas ici.
 * T-05-03-03 : quotePartTerrainRatio validé [0, 0.30] côté serveur + domain invariant.
 * T-05-03-07 : schema fixe 5 composants — pas de répétition.
 */
export const activerFiscaliteSchema = z.object({
  prixAcquisitionEuros: z.coerce
    .number()
    .refine((n) => n > 0, 'Le prix d\'acquisition doit être supérieur à 0'),
  dateAcquisition: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format AAAA-MM-JJ requis'),
  fraisNotaireEuros: z.coerce.number().min(0, 'Les frais ne peuvent pas être négatifs'),
  fraisAgenceEuros: z.coerce.number().min(0, 'Les frais ne peuvent pas être négatifs'),
  quotePartTerrainRatio: z.coerce
    .number()
    .min(0, 'La quote-part terrain doit être ≥ 0')
    .max(0.30, 'La quote-part terrain ne peut pas dépasser 30 % (D-FIS-G1.8)'),
  /** Montants HT des 5 composants amortissables en euros */
  gros_oeuvre: z.coerce.number().min(0),
  toiture_facade: z.coerce.number().min(0),
  installations_techniques: z.coerce.number().min(0),
  agencements_interieurs: z.coerce.number().min(0),
  mobilier: z.coerce.number().min(0),
});

export type ActiverFiscaliteData = z.infer<typeof activerFiscaliteSchema>;

/**
 * Schémas Zod pour les routes de qualification fiscale (Plan 02 — D-FIS-G2.1 à G2.6).
 *
 * Validation Zod uniquement aux frontières HTTP (adapters Fastify) — jamais dans le domaine.
 */

/** Qualifications autorisées via POST (excluent 'non_qualifie' qui est le statut par défaut). */
const QUALIFICATIONS_POSTABLES = QUALIFICATIONS_VALIDES.filter(
  (q) => q !== 'non_qualifie',
) as [string, ...string[]];

/**
 * POST /fiscalite/qualification/justificatif/:id
 * Body : { qualification: QualificationFiscale }
 */
export const qualifierJustificatifSchema = z.object({
  qualification: z.enum(QUALIFICATIONS_POSTABLES, {
    errorMap: () => ({
      message: `Qualification invalide. Valeurs acceptées : ${QUALIFICATIONS_POSTABLES.join(', ')}`,
    }),
  }),
});
export type QualifierJustificatifData = z.infer<typeof qualifierJustificatifSchema>;

/**
 * POST /fiscalite/qualification/ticket/:id
 * Body : { natureFiscale: QualificationFiscale }
 */
export const qualifierTicketSchema = z.object({
  natureFiscale: z.enum(QUALIFICATIONS_POSTABLES, {
    errorMap: () => ({
      message: `Qualification invalide. Valeurs acceptées : ${QUALIFICATIONS_POSTABLES.join(', ')}`,
    }),
  }),
});
export type QualifierTicketData = z.infer<typeof qualifierTicketSchema>;

/**
 * POST /fiscalite/qualification/decomposer/:id
 * Body : { enfants: [{ bienId, montantTtcEuros, titre }] }
 *
 * T-05-02-06 : max 50 enfants pour éviter le DoS sur body énorme.
 */
export const decomposerJustificatifSchema = z.object({
  enfants: z
    .array(
      z.object({
        bienId: z.string().uuid('Le bienId doit être un UUID valide'),
        montantTtcEuros: z.coerce
          .number()
          .min(0.01, 'Le montant doit être supérieur à 0 €'),
        titre: z.string().min(1, 'Le titre est obligatoire'),
      }),
    )
    .min(1, 'Au moins un enfant requis pour la décomposition')
    .max(50, 'Maximum 50 enfants par décomposition'),
});
export type DecomposerJustificatifData = z.infer<typeof decomposerJustificatifSchema>;

/**
 * POST /fiscalite/revenus-foyer
 * Body : { revenusActifsAnnuelsCourantEuros: number }
 *
 * Source : D-FIS-G3.1, D-FIS-G3.2 — saisie unique "revenus du travail et assimilés du foyer".
 * BOFIP-BIC-CHAMP-40-20 — périmètre revenus actifs foyer.
 * min(0) : un foyer sans revenus actifs est un cas licite (ex : retraité bailleur).
 */
export const saisirRevenusFoyerSchema = z.object({
  revenusActifsAnnuelsCourantEuros: z.coerce
    .number()
    .min(0, 'Les revenus du foyer doivent être >= 0 €'),
});

export type SaisirRevenusFoyerData = z.infer<typeof saisirRevenusFoyerSchema>;

/**
 * Reconstruit le tableau d'enfants depuis un body FormData plat.
 * Les champs sont encodés enfants[0].bienId, enfants[0].montantTtcEuros, etc.
 * (fast-querystring ne parse pas le bracket-dot notation imbriqué)
 */
export function normaliserEnfantsFormBody(body: Record<string, unknown>): unknown[] {
  const enfantsMap = new Map<number, Record<string, unknown>>();

  for (const [cle, valeur] of Object.entries(body)) {
    const match = /^enfants\[(\d+)\]\.(.+)$/.exec(cle);
    if (!match) continue;
    const index = parseInt(match[1]!, 10);
    const prop = match[2]!;
    if (!enfantsMap.has(index)) enfantsMap.set(index, {});
    enfantsMap.get(index)![prop] = valeur;
  }

  return Array.from(enfantsMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, obj]) => obj);
}

import { z } from 'zod';
import { TYPES_ITEM_INVENTAIRE, InventaireItem, type TypeItemInventaire } from '../../domain/_shared/inventaire-item.js';

export const bailCreationSchema = z
  .object({
    bienId: z.string().uuid('Sélectionnez un bien valide'),
    locataireId: z.string().uuid('Sélectionnez un locataire valide'),
    // lotIds peut être un string seul (un lot coché) ou un array
    lotIds: z
      .union([z.string().uuid(), z.array(z.string().uuid()).min(1)])
      .transform((val) => (Array.isArray(val) ? val : [val]))
      .pipe(z.array(z.string().uuid()).min(1, 'Sélectionnez au moins un lot').max(50)),
    dateDebut: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La date de début doit être au format AAAA-MM-JJ'),
    dureeMois: z.coerce.number().int().min(12, 'Un bail meublé classique doit durer au moins 12 mois'),
    loyerHcEuros: z.coerce.number().positive('Le loyer hors charges doit être supérieur à 0 €'),
    modeCharges: z.enum(['forfait', 'provisions'], {
      errorMap: () => ({ message: 'Sélectionnez un mode de charges valide' }),
    }),
    montantChargesEuros: z.coerce.number().min(0),
    depotGarantieEuros: z.coerce.number().min(0),
    irlTrimestre: z
      .string()
      .regex(/^\d{4}-T[1-4]$/, 'Le trimestre IRL doit respecter le format YYYY-TN (ex : "2026-T1")'),
    irlValeur: z
      .string()
      .regex(/^\d+(\.\d+)?$/, 'La valeur IRL doit être un nombre décimal positif (ex : "145.47")'),
    // Cautionnement (optionnel)
    cautionnementType: z.enum(['physique', 'visale', 'gli']).optional(),
    garantNom: z.string().trim().optional(),
    garantPrenom: z.string().trim().optional(),
    garantEmail: z.string().email().optional().or(z.literal('').transform(() => undefined)),
    garantTelephone: z.string().trim().optional(),
    garantRue: z.string().trim().optional(),
    garantCodePostal: z.string().trim().optional(),
    garantVille: z.string().trim().optional(),
    cautionnementMontantGarantiEuros: z.coerce.number().optional(),
    cautionnementDateSignature: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal('').transform(() => undefined)),
    cautionnementDureeMois: z.coerce.number().int().optional(),
    // Mobilier — checkboxes LOC-06 (un ou plusieurs TypeItemInventaire)
    mobilier: z
      .union([
        z.string(),
        z.array(z.string()),
      ])
      .transform((val) => (Array.isArray(val) ? val : [val]))
      .pipe(z.array(z.string()))
      .optional()
      .default([]),
  })
  .superRefine((data, ctx) => {
    // T-05-01 : double validation dépôt ≤ 2 × loyer
    if (data.depotGarantieEuros > 2 * data.loyerHcEuros) {
      ctx.addIssue({
        code: 'custom',
        path: ['depotGarantieEuros'],
        message: `Le dépôt de garantie ne peut pas dépasser 2 mois de loyer hors charges (maximum : ${2 * data.loyerHcEuros} €)`,
      });
    }

    // Garant obligatoire si cautionnement physique
    if (data.cautionnementType === 'physique') {
      if (!data.garantNom) {
        ctx.addIssue({ code: 'custom', path: ['garantNom'], message: 'Le nom du garant est obligatoire' });
      }
      if (!data.garantPrenom) {
        ctx.addIssue({ code: 'custom', path: ['garantPrenom'], message: 'Le prénom du garant est obligatoire' });
      }
      if (!data.garantEmail) {
        ctx.addIssue({ code: 'custom', path: ['garantEmail'], message: "L'email du garant est obligatoire" });
      }
    }
  });

export type BailCreationFormData = z.infer<typeof bailCreationSchema>;

export const bailModificationSchema = bailCreationSchema;
export type BailModificationFormData = z.infer<typeof bailModificationSchema>;

/**
 * Transforme le tableau de strings mobilier (valeurs de checkbox) en InventaireItem[].
 * Les types non reconnus sont ignorés silencieusement.
 * Les types manquants sont ajoutés avec present=false.
 */
export function mobilierVersInventaireItems(mobilierCoches: string[]): InventaireItem[] {
  const cochesSet = new Set(mobilierCoches.filter((t) => (TYPES_ITEM_INVENTAIRE as string[]).includes(t)));
  return TYPES_ITEM_INVENTAIRE.map((type) => {
    const present = cochesSet.has(type);
    return InventaireItem.creer({
      typeItem: type as TypeItemInventaire,
      present,
      // Mobilier checklist : état='bon' par défaut si présent (InventaireItem.creer exige etat non-null si présent).
      // L'EDL affine l'état réel lors de l'état des lieux.
      etat: present ? 'bon' : null,
      note: null,
    });
  });
}

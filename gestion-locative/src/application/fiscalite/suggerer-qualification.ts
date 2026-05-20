import type { TypeJustificatif } from '../../domain/documents/justificatif.js';
import type { QualificationFiscale } from '../../domain/fiscalite/qualification-fiscale.js';

/**
 * Use case pur — suggestion déterministe de qualification fiscale (D-FIS-G2.7).
 *
 * Table de lookup fixe basée sur le TypeJustificatif.
 * JAMAIS auto-appliquée : l'UI affiche le radio pré-coché mais l'utilisateur valide.
 * V2 : assistant IA d'auto-qualification (CLA-01) — hors scope V1.
 *
 * Sources :
 *   - D-FIS-G2.7 : suggestion par type (facture → charge_courante_periodique, etc.)
 *   - BOFIP-BIC-CHG-10-10 : pièces justificatives des charges
 */
export function suggererQualification(type: TypeJustificatif): QualificationFiscale {
  switch (type) {
    case 'facture':
      return 'charge_courante_periodique';
    case 'ticket_caisse':
      return 'entretien_reparation';
    default:
      return 'non_deductible';
  }
}

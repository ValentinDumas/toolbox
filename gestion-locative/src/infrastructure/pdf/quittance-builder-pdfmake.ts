/**
 * Adapter pdfmake pour le port QuittanceBuilder (ENC-01, D-63).
 *
 * Wraps la fonction pure `construireQuittance` (qui retourne une
 * `TDocumentDefinitions` pdfmake) pour exposer l'interface domaine
 * `QuittanceBuilder` (qui retourne `unknown`).
 *
 * Pattern miroir :
 *   - src/infrastructure/pdf/pdf-renderer-pdfmake.ts
 *   - src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts
 *
 * Règle hexagonale CLAUDE.md : l'application n'importe que le port
 * `QuittanceBuilder` depuis le domaine ; cet adapter est instancié
 * dans main.ts et injecté via DI.
 */

import type { Temporal } from '@js-temporal/polyfill';
import type { QuittanceBuilder } from '../../domain/encaissements/quittance-builder.js';
import type { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Adresse } from '../../domain/_shared/adresse.js';
import { construireQuittance } from './quittance-doc-def.js';

interface LocataireQuittance {
  readonly nom: string;
  readonly prenom: string;
}

export class QuittanceBuilderPdfmake implements QuittanceBuilder {
  construire(
    echeance: EcheanceLoyer,
    bailleur: Bailleur,
    locataire: LocataireQuittance,
    adresseBien: Adresse,
    numero: string,
    emiseLe: Temporal.PlainDate,
    modeCharges: 'forfait' | 'provisions',
  ): unknown {
    return construireQuittance(
      echeance,
      bailleur,
      locataire,
      adresseBien,
      numero,
      emiseLe,
      modeCharges,
    );
  }
}

/**
 * Adapter pdfmake pour le port AvenantIRLBuilder (Phase 3-04, D-93).
 *
 * Wraps la fonction pure `construireAvenantIRL` (qui retourne une
 * `TDocumentDefinitions` pdfmake) pour exposer l'interface domaine
 * `AvenantIRLBuilder` (qui retourne `unknown`).
 *
 * Pattern miroir :
 *   - src/infrastructure/pdf/pdf-renderer-pdfmake.ts
 *   - src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts
 *   - src/infrastructure/pdf/quittance-builder-pdfmake.ts
 *
 * Règle hexagonale CLAUDE.md : l'application n'importe que le port
 * `AvenantIRLBuilder` depuis le domaine ; cet adapter est instancié
 * dans main.ts et injecté via DI.
 */

import type { Temporal } from '@js-temporal/polyfill';
import type { AvenantIRLBuilder } from '../../domain/locatif/avenant-irl-builder.js';
import type { Bail } from '../../domain/locatif/bail.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Money } from '../../domain/_shared/money.js';
import type { IRL } from '../../domain/_shared/irl.js';
import { construireAvenantIRL } from './avenant-irl-doc-def.js';

interface LocataireAvenant {
  readonly nom: string;
  readonly prenom: string;
}

export class AvenantIRLBuilderPdfmake implements AvenantIRLBuilder {
  construire(
    bail: Bail,
    locataire: LocataireAvenant,
    bailleur: Bailleur,
    irlNouveau: IRL,
    irlAncien: IRL,
    loyerAvant: Money,
    loyerApres: Money,
    dateEffet: Temporal.PlainDate,
  ): unknown {
    return construireAvenantIRL(
      bail,
      locataire,
      bailleur,
      irlNouveau,
      irlAncien,
      loyerAvant,
      loyerApres,
      dateEffet,
    );
  }
}

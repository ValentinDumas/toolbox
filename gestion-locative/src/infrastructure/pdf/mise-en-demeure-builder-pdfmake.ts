/**
 * Adapter pdfmake pour le port MiseEnDemeureBuilder (D-69 niveau 3).
 *
 * Wraps la fonction pure `construireMiseEnDemeure` (qui retourne une
 * `TDocumentDefinitions` pdfmake) pour exposer l'interface domaine
 * `MiseEnDemeureBuilder` (qui retourne `unknown`).
 *
 * Pattern miroir :
 *   - src/infrastructure/pdf/pdf-renderer-pdfmake.ts
 *   - src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts
 *   - src/infrastructure/pdf/quittance-builder-pdfmake.ts
 *   - src/infrastructure/pdf/avenant-irl-builder-pdfmake.ts
 *
 * Règle hexagonale CLAUDE.md : l'application et la route n'importent que
 * le port `MiseEnDemeureBuilder` depuis le domaine ; cet adapter est
 * instancié dans main.ts et injecté via DI.
 */

import type { Temporal } from '@js-temporal/polyfill';
import type { MiseEnDemeureBuilder } from '../../domain/encaissements/mise-en-demeure-builder.js';
import type { EcheanceLoyer } from '../../domain/encaissements/echeance-loyer.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Adresse } from '../../domain/_shared/adresse.js';
import type { Money } from '../../domain/_shared/money.js';
import { construireMiseEnDemeure } from './mise-en-demeure-doc-def.js';

interface LocataireMinimal {
  readonly nom: string;
  readonly prenom: string;
}

interface BailMinimal {
  readonly dateDebut: Temporal.PlainDate;
  readonly dureeMois: number;
  readonly loyerHc: Money;
}

interface BienMinimal {
  readonly adresse: Adresse;
}

export class MiseEnDemeureBuilderPdfmake implements MiseEnDemeureBuilder {
  construire(
    echeance: EcheanceLoyer,
    encaissementsLies: unknown[],
    bailleur: Bailleur,
    locataire: LocataireMinimal,
    bien: BienMinimal,
    adresseBien: Adresse,
    bail: BailMinimal,
    resteDu: Money,
    aujourdhui: Temporal.PlainDate,
  ): unknown {
    return construireMiseEnDemeure(
      echeance,
      encaissementsLies,
      bailleur,
      locataire,
      bien,
      adresseBien,
      bail,
      resteDu,
      aujourdhui,
    );
  }
}

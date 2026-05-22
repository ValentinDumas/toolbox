/**
 * Adapter pdfmake pour le port RecapFiscalBuilder (D-FIS-G5.3).
 *
 * Wraps la fonction pure `construireRecapFiscal` (qui retourne une
 * `TDocumentDefinitions` pdfmake) pour exposer l'interface domaine
 * `RecapFiscalBuilder` (qui retourne `unknown`).
 *
 * Pattern miroir : src/infrastructure/pdf/pdf-renderer-pdfmake.ts
 *
 * Règle hexagonale CLAUDE.md : l'application n'importe que le port
 * `RecapFiscalBuilder` depuis le domaine ; cet adapter est instancié
 * dans main.ts et injecté via DI.
 */

import type { RecapFiscalBuilder } from '../../domain/fiscalite/recap-fiscal-builder.js';
import type { DeclarationAnnuelle } from '../../domain/fiscalite/declaration-annuelle.js';
import type { Bailleur } from '../../domain/identite/bailleur.js';
import type { Bien } from '../../domain/patrimoine/bien.js';
import type { AmortissementExercice } from '../../domain/fiscalite/amortissement-exercice.js';
import { construireRecapFiscal } from './recap-fiscal-doc-def.js';

export class RecapFiscalBuilderPdfmake implements RecapFiscalBuilder {
  construire(
    decl: DeclarationAnnuelle,
    bailleur: Bailleur,
    biens: Bien[],
    tableauxAmort: AmortissementExercice[],
  ): unknown {
    return construireRecapFiscal(decl, bailleur, biens, tableauxAmort);
  }
}

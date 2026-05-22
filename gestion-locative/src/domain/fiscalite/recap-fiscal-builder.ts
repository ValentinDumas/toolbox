/**
 * Port RecapFiscalBuilder — abstraction de la construction du document
 * de récapitulatif fiscal annuel LMNP (D-FIS-G5.3).
 *
 * Le domaine reste pur : il passe un `unknown` pour éviter d'importer
 * le type `TDocumentDefinitions` de pdfmake (package infrastructure).
 * L'adapter infrastructure caste vers `TDocumentDefinitions` à l'entrée.
 *
 * Pattern miroir : src/domain/encaissements/pdf-renderer.ts
 *   - PdfRenderer.genererBuffer(docDef: unknown): Promise<Buffer>
 *
 * Règle non-négociable CLAUDE.md (Domaine pur — Ports & Adapters strict) :
 *   aucun import technique (ORM, HTTP, fichier, pdfmake) dans le cœur du
 *   domaine. Cf. practices/DDD.md (hexagonal architecture).
 *
 * Utilisé par :
 *   - src/application/fiscalite/exporter-pdf-recap.ts (use case D-FIS-G5.3)
 *
 * Implémenté par :
 *   - src/infrastructure/pdf/recap-fiscal-builder-pdfmake.ts (adapter pdfmake)
 */

import type { DeclarationAnnuelle } from './declaration-annuelle.js';
import type { Bailleur } from '../identite/bailleur.js';
import type { Bien } from '../patrimoine/bien.js';
import type { AmortissementExercice } from './amortissement-exercice.js';

export interface RecapFiscalBuilder {
  /**
   * Construit la définition du document récapitulatif fiscal.
   *
   * Le type concret retourné est `TDocumentDefinitions` (pdfmake),
   * volontairement masqué en `unknown` pour préserver la pureté du
   * domaine (CLAUDE.md règle hexagonale, miroir de PdfRenderer.genererBuffer).
   *
   * @param decl - déclaration annuelle clôturée
   * @param bailleur - identité bailleur (mentions légales)
   * @param biens - liste des biens (pour affichage patrimoine)
   * @param tableauxAmort - lignes AmortissementExercice de l'exercice
   * @returns définition de document opaque, à passer à PdfRenderer.genererBuffer
   */
  construire(
    decl: DeclarationAnnuelle,
    bailleur: Bailleur,
    biens: Bien[],
    tableauxAmort: AmortissementExercice[],
  ): unknown;
}

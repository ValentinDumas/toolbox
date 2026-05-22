/**
 * Port MiseEnDemeureBuilder — abstraction de la construction du document
 * de mise en demeure de payer (D-69 niveau 3, Code civil art. 1344).
 *
 * Le domaine reste pur : il passe un `unknown` pour éviter d'importer
 * le type `TDocumentDefinitions` de pdfmake (package infrastructure).
 * L'adapter infrastructure caste vers `TDocumentDefinitions` à l'entrée.
 *
 * Pattern miroir :
 *   - src/domain/encaissements/pdf-renderer.ts (PdfRenderer.genererBuffer)
 *   - src/domain/fiscalite/recap-fiscal-builder.ts (RecapFiscalBuilder.construire)
 *   - src/domain/encaissements/quittance-builder.ts (QuittanceBuilder.construire)
 *   - src/domain/locatif/avenant-irl-builder.ts (AvenantIRLBuilder.construire)
 *
 * Règle non-négociable CLAUDE.md (Domaine pur — Ports & Adapters strict) :
 *   aucun import technique (ORM, HTTP, fichier, pdfmake) dans le cœur du
 *   domaine. Cf. practices/DDD.md (hexagonal architecture).
 *
 * Utilisé par deux consommateurs (cohérent avec l'esprit on-the-fly D-66) :
 *   - src/application/encaissements/enregistrer-relance.ts (use case ENC-05, niveau 3 PDF)
 *   - src/web/routes/relances.ts (GET /relances/:id/pdf — régénération à la demande)
 *
 * Implémenté par :
 *   - src/infrastructure/pdf/mise-en-demeure-builder-pdfmake.ts (adapter pdfmake)
 */

import type { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyer } from './echeance-loyer.js';
import type { Bailleur } from '../identite/bailleur.js';
import type { Adresse } from '../_shared/adresse.js';
import type { Money } from '../_shared/money.js';

/**
 * Vue minimale Locataire pour la mise en demeure (mentions légales art. 1344).
 */
interface LocataireMinimal {
  readonly nom: string;
  readonly prenom: string;
}

/**
 * Vue minimale Bail pour la mise en demeure (référence dates + loyer).
 */
interface BailMinimal {
  readonly dateDebut: Temporal.PlainDate;
  readonly dureeMois: number;
  readonly loyerHc: Money;
}

/**
 * Vue minimale Bien pour la mise en demeure (adresse).
 */
interface BienMinimal {
  readonly adresse: Adresse;
}

export interface MiseEnDemeureBuilder {
  /**
   * Construit la définition du document mise en demeure de payer (D-69 niveau 3).
   *
   * Le type concret retourné est `TDocumentDefinitions` (pdfmake),
   * volontairement masqué en `unknown` pour préserver la pureté du
   * domaine (CLAUDE.md règle hexagonale, miroir de PdfRenderer.genererBuffer).
   *
   * @param echeance - échéance impayée concernée
   * @param encaissementsLies - liste des encaissements partiels associés (audit)
   * @param bailleur - identité bailleur (mentions légales)
   * @param locataire - vue minimale locataire (nom, prénom)
   * @param bien - vue minimale bien (adresse)
   * @param adresseBien - adresse du logement (séparée pour cohérence avec doc-def)
   * @param bail - vue minimale bail (référence dates + loyer)
   * @param resteDu - montant restant dû au moment de la mise en demeure
   * @param aujourdhui - date d'émission du document
   * @returns définition de document opaque, à passer à PdfRenderer.genererBuffer
   */
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
  ): unknown;
}

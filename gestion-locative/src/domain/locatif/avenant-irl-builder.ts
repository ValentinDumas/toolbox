/**
 * Port AvenantIRLBuilder — abstraction de la construction du document
 * d'avenant IRL (loi 89-462 article 17-1, D-93).
 *
 * Le domaine reste pur : il passe un `unknown` pour éviter d'importer
 * le type `TDocumentDefinitions` de pdfmake (package infrastructure).
 * L'adapter infrastructure caste vers `TDocumentDefinitions` à l'entrée.
 *
 * Pattern miroir :
 *   - src/domain/encaissements/pdf-renderer.ts (PdfRenderer.genererBuffer)
 *   - src/domain/fiscalite/recap-fiscal-builder.ts (RecapFiscalBuilder.construire)
 *   - src/domain/encaissements/quittance-builder.ts (QuittanceBuilder.construire)
 *
 * Règle non-négociable CLAUDE.md (Domaine pur — Ports & Adapters strict) :
 *   aucun import technique (ORM, HTTP, fichier, pdfmake) dans le cœur du
 *   domaine. Cf. practices/DDD.md (hexagonal architecture).
 *
 * Utilisé par :
 *   - src/application/locatif/appliquer-indexation-irl.ts (use case LOC-04 apply, D-94)
 *
 * Implémenté par :
 *   - src/infrastructure/pdf/avenant-irl-builder-pdfmake.ts (adapter pdfmake)
 */

import type { Temporal } from '@js-temporal/polyfill';
import type { Bail } from './bail.js';
import type { Bailleur } from '../identite/bailleur.js';
import type { Money } from '../_shared/money.js';
import type { IRL } from '../_shared/irl.js';

/**
 * Vue minimale Locataire requise pour l'avenant. Le port n'a pas besoin de
 * l'agrégat complet — découplage maximal entre l'adapter et la représentation
 * domaine (le doc-def déclare déjà cette même interface en privé côté infra).
 */
interface LocataireAvenant {
  readonly nom: string;
  readonly prenom: string;
}

export interface AvenantIRLBuilder {
  /**
   * Construit la définition du document avenant IRL.
   *
   * Le type concret retourné est `TDocumentDefinitions` (pdfmake),
   * volontairement masqué en `unknown` pour préserver la pureté du
   * domaine (CLAUDE.md règle hexagonale, miroir de PdfRenderer.genererBuffer).
   *
   * @param bail - bail modifié après pivot (loyer + IRL référence à jour)
   * @param locataire - vue minimale locataire (nom, prénom)
   * @param bailleur - identité bailleur (mentions légales)
   * @param irlNouveau - nouvel IRL appliqué
   * @param irlAncien - IRL de référence avant indexation
   * @param loyerAvant - loyer HC avant indexation
   * @param loyerApres - loyer HC après indexation (résultat du calcul IRL)
   * @param dateEffet - date d'effet de l'avenant (anniversaire bail)
   * @returns définition de document opaque, à passer à PdfRenderer.genererBuffer
   */
  construire(
    bail: Bail,
    locataire: LocataireAvenant,
    bailleur: Bailleur,
    irlNouveau: IRL,
    irlAncien: IRL,
    loyerAvant: Money,
    loyerApres: Money,
    dateEffet: Temporal.PlainDate,
  ): unknown;
}

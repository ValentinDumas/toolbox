/**
 * Port QuittanceBuilder — abstraction de la construction du document
 * de quittance de loyer (ENC-01, D-63).
 *
 * Le domaine reste pur : il passe un `unknown` pour éviter d'importer
 * le type `TDocumentDefinitions` de pdfmake (package infrastructure).
 * L'adapter infrastructure caste vers `TDocumentDefinitions` à l'entrée.
 *
 * Pattern miroir :
 *   - src/domain/encaissements/pdf-renderer.ts (PdfRenderer.genererBuffer)
 *   - src/domain/fiscalite/recap-fiscal-builder.ts (RecapFiscalBuilder.construire)
 *
 * Règle non-négociable CLAUDE.md (Domaine pur — Ports & Adapters strict) :
 *   aucun import technique (ORM, HTTP, fichier, pdfmake) dans le cœur du
 *   domaine. Cf. practices/DDD.md (hexagonal architecture).
 *
 * Utilisé par :
 *   - src/application/encaissements/generer-quittance.ts (use case ENC-01)
 *
 * Implémenté par :
 *   - src/infrastructure/pdf/quittance-builder-pdfmake.ts (adapter pdfmake)
 */

import type { Temporal } from '@js-temporal/polyfill';
import type { EcheanceLoyer } from './echeance-loyer.js';
import type { Bailleur } from '../identite/bailleur.js';
import type { Adresse } from '../_shared/adresse.js';

/**
 * Vue minimale Locataire requise pour la quittance (mentions légales loi 89 art. 21).
 * Le port n'a pas besoin de l'agrégat complet — découplage maximal entre l'adapter
 * et la représentation domaine (le doc-def déclare déjà cette même interface en
 * privé côté infra).
 */
interface LocataireQuittance {
  readonly nom: string;
  readonly prenom: string;
}

export interface QuittanceBuilder {
  /**
   * Construit la définition du document quittance de loyer.
   *
   * Le type concret retourné est `TDocumentDefinitions` (pdfmake),
   * volontairement masqué en `unknown` pour préserver la pureté du
   * domaine (CLAUDE.md règle hexagonale, miroir de PdfRenderer.genererBuffer).
   *
   * @param echeance - échéance de loyer quittancée (statut === 'payee')
   * @param bailleur - identité bailleur (mentions légales)
   * @param locataire - vue minimale locataire (nom, prénom)
   * @param adresseBien - adresse du logement
   * @param numero - numéro séquentiel annuel (ex. "2026-001")
   * @param emiseLe - date d'émission de la quittance
   * @param modeCharges - 'forfait' ou 'provisions' (libellé charges)
   * @returns définition de document opaque, à passer à PdfRenderer.genererBuffer
   */
  construire(
    echeance: EcheanceLoyer,
    bailleur: Bailleur,
    locataire: LocataireQuittance,
    adresseBien: Adresse,
    numero: string,
    emiseLe: Temporal.PlainDate,
    modeCharges: 'forfait' | 'provisions',
  ): unknown;
}

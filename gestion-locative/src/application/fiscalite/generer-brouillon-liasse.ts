/**
 * Use case `genererBrouillonLiasse` — Phase 6 / FIS-05 / Task 1 squelette.
 *
 * **WAVE 1 — fondation seule.** Cette implémentation Task 1 expose la signature
 * et les classes d'erreurs publiques. L'algorithme complet (orchestration
 * snapshot → mapping → DTO) est livré en Task 2 (commit `feat(06-01)` suivant).
 *
 * Pattern miroir : `application/fiscalite/exporter-pdf-recap.ts` (use case
 * orchestrateur cross-BC, Pattern critique 7 RESEARCH.md).
 *
 * Sources :
 *   - D-L6.1 : brouillon case-par-case (numéro + libellé + valeur).
 *   - D-T6.4 : la valeur d'une case vient TOUJOURS du snapshot
 *     `DeclarationAnnuelle` (jamais recalculée).
 *   - D-A6.3 : 2033-B = cœur du brouillon (recettes + charges qualifiées + dotation).
 *   - D-A6.2 : 2033-A = postes calculables uniquement + bandeau "à compléter".
 *   - Anti-pattern §3 RESEARCH.md : `amelioration` exclue de la somme
 *     `chargesAutresExternes` (immobilisée → 2033-C).
 */

import type { DeclarationAnnuelleId } from '../../domain/_shared/identifiants.js';
import type { DeclarationAnnuelleRepository } from '../../domain/fiscalite/declaration-annuelle-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { MappingLiasseProvider } from '../../domain/fiscalite/liasse/mapping-liasse-provider.js';
import type { BrouillonLiasseDto } from '../../domain/fiscalite/liasse/case-liasse.js';

/**
 * Levée si la déclaration cible est introuvable côté repository.
 * Pattern miroir `DeclarationIntrouvable` d'`exporter-csv-fiscal.ts`.
 */
export class DeclarationIntrouvableLiasse extends Error {
  constructor(public readonly declarationId: string) {
    super(`Déclaration introuvable pour brouillon liasse : ${declarationId}`);
    this.name = 'DeclarationIntrouvableLiasse';
  }
}

/**
 * Levée si le bailleur singleton n'est pas configuré.
 * Pattern miroir `BailleurIntrouvable` d'`exporter-pdf-recap.ts`.
 */
export class BailleurIntrouvableLiasse extends Error {
  constructor() {
    super('Bailleur introuvable — profil non configuré (brouillon liasse)');
    this.name = 'BailleurIntrouvableLiasse';
  }
}

/**
 * Levée Wave 1 si la déclaration est en régime micro-BIC. Sera remplacée par
 * un rendu valide du brouillon 2042-C-PRO au Plan 02.
 */
export class RegimeMicroBicNonSupporteWave1 extends Error {
  constructor() {
    super('Régime micro-BIC : brouillon disponible Plan 02 (FIS-05 micro)');
    this.name = 'RegimeMicroBicNonSupporteWave1';
  }
}

export interface GenererBrouillonLiasseCommande {
  declarationId: DeclarationAnnuelleId;
}

export interface GenererBrouillonLiasseDeps {
  declRepo: DeclarationAnnuelleRepository;
  bailleurRepo: BailleurRepository;
  mappingProvider: MappingLiasseProvider;
}

/**
 * Stub Task 1 — sera remplacé par l'algorithme complet en Task 2.
 *
 * @throws DeclarationIntrouvableLiasse, BailleurIntrouvableLiasse,
 *         RegimeMicroBicNonSupporteWave1, ou `MappingLiasseAbsent` (propagé).
 */
export async function genererBrouillonLiasse(
  _commande: GenererBrouillonLiasseCommande,
  _deps: GenererBrouillonLiasseDeps,
): Promise<BrouillonLiasseDto> {
  throw new Error(
    'genererBrouillonLiasse non implémenté — Task 2 du Plan 06-01 (commit feat(06-01) suivant)',
  );
}

import { Temporal } from '@js-temporal/polyfill';

import type { Money } from '../../domain/_shared/money.js';
import type { BienId } from '../../domain/_shared/identifiants.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { DeclarationCfe } from '../../domain/fiscalite/cfe/declaration-cfe.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';
import type { StatutCfe } from '../../domain/fiscalite/cfe/statut-cfe.js';

export interface EnregistrerDeclarationCfeCommande {
  bienId: BienId;
  millesime: number;
  statut: StatutCfe;
  dateDepotDeclaration: Temporal.PlainDate | null;
  montantAvisCentimes: Money | null;
  dateEcheancePaiement: Temporal.PlainDate;
}

export interface EnregistrerDeclarationCfeDeps {
  bienRepo: BienRepository;
  cfeRepo: DeclarationCfeRepository;
}

/**
 * Use case — enregistrer une DeclarationCfe pour un Bien et un millésime
 * (Phase 6 / FIS-06 / D-CFE6.2).
 *
 * Charge le `Bien` (existence vérifiée), construit la `DeclarationCfe` via
 * factory `creer` (qui relaie `InvariantViolated`) puis upsert via `cfeRepo`.
 *
 * Throws:
 *   - `BienIntrouvable` si `bienId` inconnu.
 *   - `InvariantViolated` si le snapshot viole un invariant D-CFE6.3.
 */
export async function enregistrerDeclarationCfe(
  commande: EnregistrerDeclarationCfeCommande,
  deps: EnregistrerDeclarationCfeDeps,
): Promise<DeclarationCfe> {
  const bien = await deps.bienRepo.trouverParId(commande.bienId);
  if (!bien) {
    throw new BienIntrouvable(commande.bienId);
  }

  const decl = DeclarationCfe.creer({
    bienId: commande.bienId,
    millesime: commande.millesime,
    statut: commande.statut,
    dateDepotDeclaration: commande.dateDepotDeclaration,
    montantAvisCentimes: commande.montantAvisCentimes,
    dateEcheancePaiement: commande.dateEcheancePaiement,
  });
  await deps.cfeRepo.enregistrer(decl);
  return decl;
}

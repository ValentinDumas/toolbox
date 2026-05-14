import { Temporal } from '@js-temporal/polyfill';
import { Cautionnement } from '../../domain/locatif/cautionnement.js';
import { Money } from '../../domain/_shared/money.js';
import { IRL } from '../../domain/_shared/irl.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailId, BienId, LotId } from '../../domain/_shared/identifiants.js';
import type { CautionnementCommande } from './creer-bail.js';

export interface ModifierBailCommande {
  id: BailId;
  bienId?: BienId;
  lotIds?: LotId[];
  dateDebut?: Temporal.PlainDate;
  dureeMois?: number;
  loyerHc?: Money;
  modeCharges?: 'forfait' | 'provisions';
  montantCharges?: Money;
  depotGarantie?: Money;
  irlReference?: IRL;
  cautionnement?: CautionnementCommande | null;
}

export async function modifierBail(
  commande: ModifierBailCommande,
  bailRepo: BailRepository,
  bienRepo: BienRepository,
): Promise<void> {
  const bail = await bailRepo.trouverParId(commande.id);
  if (!bail) {
    throw new BailIntrouvable(commande.id);
  }

  // Si bienId ou lotIds modifiés, re-vérifier l'appartenance des lots
  const bienIdCible = commande.bienId ?? bail.bienId;
  const lotIdsCibles = commande.lotIds ?? [...bail.lotIds];

  if (commande.bienId || commande.lotIds) {
    const bien = await bienRepo.trouverParId(bienIdCible);
    if (!bien) {
      throw new BienIntrouvable(bienIdCible);
    }
    const idsLotsDuBien = new Set(bien.lots.map((l) => l.id));
    for (const lotId of lotIdsCibles) {
      if (!idsLotsDuBien.has(lotId)) {
        throw new InvariantViolated(
          `Tous les lots doivent appartenir au même bien (lot ${lotId} non trouvé dans bien ${bienIdCible})`,
        );
      }
    }
  }

  const cautionnement =
    commande.cautionnement !== undefined
      ? commande.cautionnement
        ? Cautionnement.creer(commande.cautionnement)
        : null
      : undefined;

  const bailModifie = bail.modifier({
    bienId: commande.bienId,
    lotIds: commande.lotIds,
    dateDebut: commande.dateDebut,
    dureeMois: commande.dureeMois,
    loyerHc: commande.loyerHc,
    modeCharges: commande.modeCharges,
    montantCharges: commande.montantCharges,
    depotGarantie: commande.depotGarantie,
    irlReference: commande.irlReference,
    cautionnement,
  });

  await bailRepo.enregistrer(bailModifie);
}

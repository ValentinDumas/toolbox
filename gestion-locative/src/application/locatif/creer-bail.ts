import { Temporal } from '@js-temporal/polyfill';

import { Bail } from '../../domain/locatif/bail.js';
import { Money } from '../../domain/_shared/money.js';
import { IRL } from '../../domain/_shared/irl.js';
import { Cautionnement } from '../../domain/locatif/cautionnement.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { LocataireIntrouvable } from '../../domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BailId, BienId, LotId, LocataireId } from '../../domain/_shared/identifiants.js';
import type { Adresse } from '../../domain/_shared/adresse.js';

export interface GarantCommande {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  adresse: Adresse;
}

export interface CautionnementCommande {
  type: 'physique' | 'visale' | 'gli';
  garant: GarantCommande | null;
  montantGaranti: Money | null;
  dateSignature: Temporal.PlainDate;
  dureeEngagement: number;
}

export interface CreerBailCommande {
  bienId: BienId;
  locataireId: LocataireId;
  lotIds: LotId[];
  dateDebut: Temporal.PlainDate;
  dureeMois: number;
  loyerHc: Money;
  modeCharges: 'forfait' | 'provisions';
  montantCharges: Money;
  depotGarantie: Money;
  irlReference: IRL;
  cautionnement: CautionnementCommande | null;
}

/**
 * Use case : créer un Bail meublé classique.
 * Orchestre 3 agrégats (Bien, Locataire, Bail) via leurs repositories.
 * La vérification "lot_ids ⊂ bien.lots" (D-30) est faite ici (cross-aggregate read).
 */
export async function creerBail(
  commande: CreerBailCommande,
  bailRepo: BailRepository,
  bienRepo: BienRepository,
  locataireRepo: LocataireRepository,
): Promise<BailId> {
  // Vérification existence du Bien
  const bien = await bienRepo.trouverParId(commande.bienId);
  if (!bien) {
    throw new BienIntrouvable(commande.bienId);
  }

  // Vérification existence du Locataire
  const locataire = await locataireRepo.trouverParId(commande.locataireId);
  if (!locataire) {
    throw new LocataireIntrouvable(commande.locataireId);
  }

  // D-30 : vérifier que tous les lot_ids appartiennent au Bien sélectionné (cross-aggregate)
  const idsLotsDuBien = new Set(bien.lots.map((l) => l.id));
  for (const lotId of commande.lotIds) {
    if (!idsLotsDuBien.has(lotId)) {
      throw new InvariantViolated(
        `Tous les lots doivent appartenir au même bien (lot ${lotId} non trouvé dans bien ${commande.bienId})`,
      );
    }
  }

  // Construction du Cautionnement si fourni
  const cautionnement = commande.cautionnement
    ? Cautionnement.creer(commande.cautionnement)
    : null;

  // Construction du Bail (factory valide invariants D-35)
  const bail = Bail.creer({
    bienId: commande.bienId,
    locataireId: commande.locataireId,
    lotIds: commande.lotIds,
    type: 'classique',
    dateDebut: commande.dateDebut,
    dureeMois: commande.dureeMois,
    loyerHc: commande.loyerHc,
    modeCharges: commande.modeCharges,
    montantCharges: commande.montantCharges,
    depotGarantie: commande.depotGarantie,
    irlReference: commande.irlReference,
    cautionnement,
  });

  await bailRepo.enregistrer(bail);
  return bail.id;
}

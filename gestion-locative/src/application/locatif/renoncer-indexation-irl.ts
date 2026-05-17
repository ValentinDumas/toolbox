import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';
import { BailIndexation } from '../../domain/locatif/bail-indexation.js';
import { IRL } from '../../domain/_shared/irl.js';
import type { BailId, BailIndexationId } from '../../domain/_shared/identifiants.js';
import { BailIntrouvable, GelLoyerClimatActif } from '../../domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';

export interface RenoncerIndexationIRLCommande {
  bailId: BailId;
  irlTrimestre: string;
  irlValeur: string;
  dateEffet?: Temporal.PlainDate;
}

export interface RenoncerIndexationIRLResult {
  bailIndexationId: BailIndexationId;
}

interface Repos {
  bailRepo: BailRepository;
  bienRepo: BienRepository;
  bailIndexationRepo: BailIndexationRepository;
}

/**
 * Use case LOC-04 renoncer (D-95).
 *
 * Le bailleur renonce à l'indexation cette année mais on pivote l'IRL de
 * référence pour que la prochaine révision parte de la bonne base.
 *
 * Sans changement de loyer, sans régénération d'échéances, sans PDF avenant.
 * Une ligne `bail_indexations` marker (indexationAppliquee=false,
 * raisonNonApplication='refus_bailleur') est tout de même créée pour l'audit.
 *
 * Defense en profondeur LOC-05 : un bail en gel Climat F/G ne peut pas
 * arriver ici via l'UI, mais on rejette aussi côté serveur par sécurité.
 */
export async function renoncerIndexationIRL(
  commande: RenoncerIndexationIRLCommande,
  repos: Repos,
  db: Kysely<DB>,
): Promise<RenoncerIndexationIRLResult> {
  const bail = await repos.bailRepo.trouverParId(commande.bailId);
  if (!bail) throw new BailIntrouvable(commande.bailId);

  const bien = await repos.bienRepo.trouverParId(bail.bienId);
  if (!bien) throw new BienIntrouvable(bail.bienId);

  if (bien.estGelLoyer()) {
    throw new GelLoyerClimatActif(bail.id, bien.classeDpe as 'F' | 'G');
  }

  const irlNouveau = IRL.creer({
    trimestre: commande.irlTrimestre,
    valeur: commande.irlValeur,
  });

  const dateEffet = commande.dateEffet ?? bail.dateAnniversaireProchaine(bail.dateDebut).subtract({ years: 1 });

  // Pivot IRL uniquement (loyer inchangé)
  const bailModifie = bail.pivoterIrlReference(irlNouveau);
  await repos.bailRepo.enregistrer(bailModifie);

  const bailIndexation = BailIndexation.creer({
    bailId: bail.id,
    dateEffet,
    irlAvant: bail.irlReference,
    irlApres: irlNouveau,
    loyerAvant: bail.loyerHc,
    loyerApres: bail.loyerHc,
    indexationAppliquee: false,
    raisonNonApplication: 'refus_bailleur',
  });
  await repos.bailIndexationRepo.enregistrer(bailIndexation);

  void db;

  return { bailIndexationId: bailIndexation.id };
}

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailId } from '../../domain/_shared/identifiants.js';
import { IRL } from '../../domain/_shared/irl.js';
import { Money } from '../../domain/_shared/money.js';
import {
  BailIntrouvable,
  GelLoyerClimatActif,
} from '../../domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import type { ClasseDpe } from '../../domain/_shared/duree-validite-diagnostic.js';

export interface SimulerIndexationIRLCommande {
  bailId: BailId;
  irlTrimestre: string;
  irlValeur: string;
}

export interface SimulerIndexationIRLResult {
  loyerAvant: Money;
  loyerApres: Money;
  irlAvant: IRL;
  irlApres: IRL;
  gelLoyer: false;
  classeDpeBien: ClasseDpe | null;
  formule: string;
}

/**
 * Use case read-only : simule l'indexation IRL pour un bail (Phase 3-03, LOC-04 + LOC-05).
 *
 * Defense en profondeur LOC-05 (T-03-03-01) : si le DPE du Bien est F ou G,
 * rejette avec GelLoyerClimatActif AVANT tout calcul — même si la route UI a
 * été contournée par POST direct.
 *
 * @throws BailIntrouvable, BienIntrouvable, GelLoyerClimatActif, InvariantViolated.
 */
export async function simulerIndexationIRL(
  cmd: SimulerIndexationIRLCommande,
  repos: { bailRepo: BailRepository; bienRepo: BienRepository },
): Promise<SimulerIndexationIRLResult> {
  const bail = await repos.bailRepo.trouverParId(cmd.bailId);
  if (!bail) throw new BailIntrouvable(cmd.bailId);

  const bien = await repos.bienRepo.trouverParId(bail.bienId);
  if (!bien) throw new BienIntrouvable(bail.bienId);

  // Construction VO IRL — peut lever InvariantViolated sur format.
  const irlNouveau = IRL.creer({ trimestre: cmd.irlTrimestre, valeur: cmd.irlValeur });

  // Defense en profondeur LOC-05 (D-92).
  if (bien.estGelLoyer()) {
    throw new GelLoyerClimatActif(bail.id, bien.classeDpe as 'F' | 'G');
  }

  const sim = bail.simulerIndexation(irlNouveau, bien.classeDpe);
  // À ce stade gelLoyer est forcément false (le check au-dessus a thrown sinon).

  const formule =
    `${bail.loyerHc.enEuros()} × (${irlNouveau.valeur} / ${bail.irlReference.valeur}) = ${sim.nouveauLoyerHc.enEuros()}`;

  return {
    loyerAvant: bail.loyerHc,
    loyerApres: sim.nouveauLoyerHc,
    irlAvant: bail.irlReference,
    irlApres: irlNouveau,
    gelLoyer: false,
    classeDpeBien: bien.classeDpe,
    formule,
  };
}

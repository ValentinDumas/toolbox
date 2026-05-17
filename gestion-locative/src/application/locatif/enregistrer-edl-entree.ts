/**
 * Use case EnregistrerEDLEntree — LOC-03, D-89.
 * Multi-repos : BailRepository + EtatDesLieuxRepository.
 * Invariant cross-aggregate : ≤1 EDL d'entrée actif par bail (D-89).
 * Warning non bloquant si items obligatoires absents (D-98).
 */
import { Temporal } from '@js-temporal/polyfill';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { EtatDesLieuxRepository } from '../../domain/locatif/etat-des-lieux-repository.js';
import { EtatDesLieux } from '../../domain/locatif/etat-des-lieux.js';
import { InventaireItem, TYPES_ITEM_OBLIGATOIRES } from '../../domain/_shared/inventaire-item.js';
import { BailIntrouvable, EDLEntreeExisteDeja } from '../../domain/locatif/erreurs.js';
import type { BailId, EtatDesLieuxId } from '../../domain/_shared/identifiants.js';
import type { EtatItem, TypeItemInventaire } from '../../domain/_shared/inventaire-item.js';

export interface CommandeEnregistrerEDLEntree {
  bailId: BailId;
  dateEdl: Temporal.PlainDate;
  contradictoire: boolean;
  dateSignature: Temporal.PlainDate | null;
  inventaire: Array<{
    typeItem: string;
    present: boolean;
    etat: string | null;
    note: string | null;
  }>;
}

export async function enregistrerEDLEntree(
  commande: CommandeEnregistrerEDLEntree,
  bailRepo: BailRepository,
  edlRepo: EtatDesLieuxRepository,
): Promise<{ edlId: EtatDesLieuxId; warnings: string[] }> {
  // Lookup bail (D-89)
  const bail = await bailRepo.trouverParId(commande.bailId);
  if (!bail) {
    throw new BailIntrouvable(commande.bailId);
  }

  // Invariant cross-aggregate : pas d'EDL d'entrée actif déjà (D-89)
  const edlActifEntree = await edlRepo.trouverActifParBailEtType(commande.bailId, 'entree');
  if (edlActifEntree !== null) {
    throw new EDLEntreeExisteDeja(commande.bailId);
  }

  // Construire l'inventaire (peut throw InvariantViolated si données invalides)
  const inventaire = commande.inventaire.map((i) =>
    InventaireItem.creer({
      typeItem: i.typeItem as TypeItemInventaire,
      present: i.present,
      etat: i.etat as EtatItem,
      note: i.note,
    }),
  );

  // Créer l'EDL
  const edl = EtatDesLieux.creer({
    bailId: commande.bailId,
    type: 'entree',
    dateEdl: commande.dateEdl,
    contradictoire: commande.contradictoire,
    dateSignature: commande.dateSignature,
    inventaire,
  });

  await edlRepo.enregistrer(edl);

  // Warning D-98 : items obligatoires absents (non bloquant)
  const warnings: string[] = [];
  const nbObligatoiresAbsents = TYPES_ITEM_OBLIGATOIRES.filter(
    (t) => !inventaire.some((i) => i.typeItem === t && i.present),
  ).length;

  if (nbObligatoiresAbsents > 0) {
    warnings.push(
      `${nbObligatoiresAbsents} élément(s) du décret 2015-981 absents dans cet inventaire — risque de requalification du bail en bail non meublé.`,
    );
  }

  return { edlId: edl.id, warnings };
}

/**
 * Use case EnregistrerEDLSortie — LOC-03, D-84, D-85, D-89, D-101.
 * Multi-repos : BailRepository + EtatDesLieuxRepository.
 * Warnings non bloquants : D-84 (sortie avant fin), D-85 (entrée absente).
 * Delta : comparerInventaires si EDL entrée actif présent.
 */
import { Temporal } from '@js-temporal/polyfill';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { EtatDesLieuxRepository } from '../../domain/locatif/etat-des-lieux-repository.js';
import { EtatDesLieux } from '../../domain/locatif/etat-des-lieux.js';
import { InventaireItem } from '../../domain/_shared/inventaire-item.js';
import { comparerInventaires, type Warning } from '../../domain/locatif/comparer-inventaires.js';
import { BailIntrouvable, EDLSortieExisteDeja } from '../../domain/locatif/erreurs.js';
import type { BailId, EtatDesLieuxId } from '../../domain/_shared/identifiants.js';
import type { EtatItem, TypeItemInventaire } from '../../domain/_shared/inventaire-item.js';

export interface CommandeEnregistrerEDLSortie {
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

export async function enregistrerEDLSortie(
  commande: CommandeEnregistrerEDLSortie,
  bailRepo: BailRepository,
  edlRepo: EtatDesLieuxRepository,
): Promise<{ edlId: EtatDesLieuxId; warnings: string[]; deltaWarnings: Warning[] }> {
  // Lookup bail
  const bail = await bailRepo.trouverParId(commande.bailId);
  if (!bail) {
    throw new BailIntrouvable(commande.bailId);
  }

  // Invariant cross-aggregate : pas d'EDL de sortie actif déjà (D-89)
  const edlActifSortie = await edlRepo.trouverActifParBailEtType(commande.bailId, 'sortie');
  if (edlActifSortie !== null) {
    throw new EDLSortieExisteDeja(commande.bailId);
  }

  // Construire l'inventaire
  const inventaire = commande.inventaire.map((i) =>
    InventaireItem.creer({
      typeItem: i.typeItem as TypeItemInventaire,
      present: i.present,
      etat: i.etat as EtatItem,
      note: i.note,
    }),
  );

  // Créer l'EDL de sortie
  const edlSortie = EtatDesLieux.creer({
    bailId: commande.bailId,
    type: 'sortie',
    dateEdl: commande.dateEdl,
    contradictoire: commande.contradictoire,
    dateSignature: commande.dateSignature,
    inventaire,
  });

  await edlRepo.enregistrer(edlSortie);

  const warnings: string[] = [];

  // Warning D-84 : EDL sortie avant fin officielle du bail
  if (bail.actifDepuis !== null) {
    const dateFin = bail.dateDebut.add({ months: bail.dureeMois });
    if (Temporal.PlainDate.compare(commande.dateEdl, dateFin) < 0) {
      warnings.push(
        `EDL de sortie enregistré avant la fin officielle du bail (${dateFin.toString()}) — vérifiez que vous avez bien la situation réelle.`,
      );
    }
  }

  // Warning D-85 + Delta D-101 : chercher EDL d'entrée actif
  const edlEntreeActif = await edlRepo.trouverActifParBailEtType(commande.bailId, 'entree');
  let deltaWarnings: Warning[] = [];

  if (edlEntreeActif === null) {
    // D-85 : pas d'EDL d'entrée enregistré
    warnings.push(
      "Pas d'EDL d'entrée enregistré pour ce bail — la comparaison entrée/sortie ne sera pas possible et la retenue sur dépôt sera plus difficile à justifier.",
    );
  } else {
    // D-101 : comparer les inventaires
    deltaWarnings = comparerInventaires(edlEntreeActif, edlSortie);
  }

  return { edlId: edlSortie.id, warnings, deltaWarnings };
}

import type { Temporal } from '@js-temporal/polyfill';

import type { JustificatifId } from '../../domain/_shared/identifiants.js';
import { Money } from '../../domain/_shared/money.js';
import { JustificatifIntrouvable } from '../../domain/documents/erreurs.js';
import {
  Justificatif,
  type TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';

/**
 * Patch metadata éditables (UI-4.4 — sans toucher au fichier ni au rattachement).
 * Les champs immuables (cheminFichier, mimeType, tailleOctets,
 * nomFichierOriginal, creeLe, bienId, locataireId, corbeilleLe, raisonCorbeille)
 * sont forcés depuis `existant.toProps()` — défense en profondeur.
 */
export interface PatchJustificatif {
  titre?: string;
  type?: TypeJustificatif;
  dateDocument?: Temporal.PlainDate;
  montantTtc?: Money | null;
  notes?: string | null;
}

/**
 * Use case `modifierJustificatif` (DOC-01 extras, UI-4.4).
 *
 * Re-valide tous les invariants D-103 via `Justificatif.creer({...toProps(), ...patch})`.
 * Throws :
 *   - JustificatifIntrouvable si lookup échoue.
 *   - InvariantViolated si le patch rendrait le résultat invalide.
 */
export async function modifierJustificatif(
  cmd: { id: JustificatifId | string; patch: PatchJustificatif },
  deps: { justificatifRepo: JustificatifRepository },
): Promise<{ justificatif: Justificatif }> {
  const existant = await deps.justificatifRepo.trouverParId(cmd.id);
  if (!existant) {
    throw new JustificatifIntrouvable(String(cmd.id));
  }

  const props = existant.toProps();
  // On applique uniquement les champs autorisés par le patch.
  // Les champs immuables restent ceux de toProps() — jamais écrasés.
  const nouvellesProps = {
    ...props,
    titre: cmd.patch.titre ?? props.titre,
    type: cmd.patch.type ?? props.type,
    dateDocument: cmd.patch.dateDocument ?? props.dateDocument,
    montantTtc:
      cmd.patch.montantTtc !== undefined ? cmd.patch.montantTtc : props.montantTtc,
    notes: cmd.patch.notes !== undefined ? cmd.patch.notes : props.notes,
  };

  // Re-valide via factory (D-103 défense en profondeur)
  const modifie = Justificatif.creer(nouvellesProps);
  await deps.justificatifRepo.enregistrer(modifie);
  return { justificatif: modifie };
}

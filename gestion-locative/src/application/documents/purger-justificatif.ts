import type { Kysely } from 'kysely';

import type { Clock } from '../../domain/_shared/clock.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type { JustificatifId } from '../../domain/_shared/identifiants.js';
import {
  JustificatifIntrouvable,
  PurgeAvantDixAnsRefusee,
} from '../../domain/documents/erreurs.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';
import { formatDate } from '../../helpers/format-date.js';
import type { DB } from '../../infrastructure/db/kysely-types.js';

/**
 * Use case `purgerJustificatif` (DOC-03, D-109).
 *
 * Hard-delete row + cleanup fichier physique APRÈS la transaction.
 *
 * Gate réglementaire (3 branches testées) :
 *   1. corbeille_le === null → InvariantViolated (pas en corbeille).
 *   2. peutEtrePurge=false   → PurgeAvantDixAnsRefusee + message verbatim
 *      UI-6.2 avec date formatée FR.
 *   3. peutEtrePurge=true    → trx { repo.supprimerDefinitivement } commit
 *      puis stockage.supprimer cleanup hors trx (best-effort,
 *      pas de rollback si ENOENT — row déjà supprimée).
 */
export async function purgerJustificatif(
  cmd: { id: JustificatifId | string },
  deps: {
    justificatifRepo: JustificatifRepository;
    stockage: StockageJustificatifs;
    clock: Clock;
    db: Kysely<DB>;
  },
): Promise<void> {
  const j = await deps.justificatifRepo.trouverParId(cmd.id);
  if (!j) {
    throw new JustificatifIntrouvable(String(cmd.id));
  }

  if (j.corbeilleLe === null) {
    throw new InvariantViolated(
      "Le document n'est pas en corbeille — soft-delete d'abord.",
    );
  }

  const today = deps.clock.aujourdhui();
  if (!j.peutEtrePurge(today)) {
    const datePurgePossible = j.creeLe.add({ years: 10 });
    const dateFr = formatDate(datePurgePossible);
    throw new PurgeAvantDixAnsRefusee(
      datePurgePossible,
      `Conservation légale obligatoire jusqu'au ${dateFr}. Vous pourrez purger ce document à partir de cette date.`,
    );
  }

  // Hard-delete row en trx
  await deps.db.transaction().execute(async (trx) => {
    await deps.justificatifRepo.supprimerDefinitivement(
      j.id,
      trx as unknown,
    );
  });

  // Cleanup fichier physique hors trx — best-effort
  try {
    await deps.stockage.supprimer(j.cheminFichier);
  } catch (err) {
    // Row supprimée, fichier orphelin tolérable (réparable manuellement)
    console.warn(
      '[purger-justificatif] Cleanup fichier physique post-purge échoué — row déjà supprimée',
      { err, cheminFichier: j.cheminFichier },
    );
  }
}

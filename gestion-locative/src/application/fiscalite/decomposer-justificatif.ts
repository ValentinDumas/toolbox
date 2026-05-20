import { Money } from '../../domain/_shared/money.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { BienId, JustificatifId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';

export interface DecomposerJustificatifCommande {
  parentId: JustificatifId;
  enfants: Array<{ bienId: BienId; montantTtc: Money; titre: string }>;
}

interface Repos {
  justificatifRepo: Pick<JustificatifRepository, 'trouverParId' | 'enregistrer'>;
}

/** Minimal abstraction d'un fournisseur de transaction (hexagonal — pas d'import infra). */
interface TransactionProvider {
  transaction(): { execute(fn: (trx: unknown) => Promise<void>): Promise<void> };
}

/**
 * Use case — split d'un Justificatif multi-biens en N enfants (D-FIS-G2.6).
 *
 * Le parent reste 'non_deductible' (image du document).
 * Les enfants ont chacun un bienId distinct + montantTtc = quote-part.
 * Invariant Σ enfants.montantTtc = parent.montantTtc (posé dans Justificatif.decomposerEnEnfants).
 *
 * Atomicité garantie par transaction Kysely (T-05-02-02).
 *
 * @throws Error si parent introuvable
 * @throws InvariantViolated si parent sans montantTtc
 * @throws ComposantsSommeIncoherente si Σ enfants ≠ parent.montantTtc
 */
export async function decomposerJustificatif(
  cmd: DecomposerJustificatifCommande,
  repos: Repos,
  clock: Clock,
  db: TransactionProvider,
): Promise<JustificatifId[]> {
  const today = clock.aujourdhui();

  // 1. Lookup parent
  const parent = await repos.justificatifRepo.trouverParId(cmd.parentId);
  if (!parent) {
    throw new Error(`Justificatif introuvable : ${cmd.parentId}`);
  }

  // 2. Décomposer en enfants (domaine — throw si Σ incorrect ou parent sans TTC)
  const enfants = parent.decomposerEnEnfants(cmd.enfants);

  // 3. Parent qualifié non_deductible (image du document)
  const parentNonDeductible = parent.qualifier('non_deductible', today);

  // 4. Transaction atomique : parent + N enfants
  await db.transaction().execute(async (trx) => {
    await repos.justificatifRepo.enregistrer(parentNonDeductible, trx);
    for (const enfant of enfants) {
      await repos.justificatifRepo.enregistrer(enfant, trx);
    }
  });

  return enfants.map((e) => e.id);
}

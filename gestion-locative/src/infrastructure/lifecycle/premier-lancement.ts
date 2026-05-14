import type { Kysely } from 'kysely';
import type { DB } from '../db/kysely-types.js';

export async function estPremierLancement(db: Kysely<DB>): Promise<boolean> {
  try {
    const result = await db
      .selectFrom('meta')
      .select('valeur')
      .where('cle', '=', 'wizard_complete')
      .executeTakeFirst();

    return result == null;
  } catch {
    // Table meta inaccessible — considéré comme premier lancement
    return true;
  }
}

export async function marquerWizardComplete(db: Kysely<DB>): Promise<void> {
  await db
    .insertInto('meta')
    .values({ cle: 'wizard_complete', valeur: '1' })
    .onConflict((oc) => oc.column('cle').doUpdateSet({ valeur: '1' }))
    .execute();
}

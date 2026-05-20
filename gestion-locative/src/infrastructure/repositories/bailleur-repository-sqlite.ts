import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import { Bailleur, type RegimeFiscal } from '../../domain/identite/bailleur.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import { Money } from '../../domain/_shared/money.js';
import type { BailleurId } from '../../domain/_shared/identifiants.js';

export class BailleurRepositorySqlite implements BailleurRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async trouver(): Promise<Bailleur | null> {
    const row = await this.db
      .selectFrom('bailleur')
      .selectAll()
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row);
  }

  async enregistrer(bailleur: Bailleur): Promise<void> {
    // WR-07 : UPSERT idempotent sur singleton_marker pour gérer le TOCTOU
    // entre trouver() et enregistrer() (utilisé par creer-ou-maj-bailleur).
    // Sans ce ON CONFLICT, un INSERT concurrent lèverait SQLITE_CONSTRAINT_UNIQUE
    // qui remonterait en 500 au lieu d'un upsert idempotent.
    await this.db
      .insertInto('bailleur')
      .values({
        id: bailleur.id,
        singleton_marker: 'unique_bailleur',
        nom_complet: bailleur.nomComplet,
        rue: bailleur.adresse.rue,
        code_postal: bailleur.adresse.codePostal,
        ville: bailleur.adresse.ville,
        // Phase 5 — champs fiscaux (D-LOCK-2, D-FIS-G3.1, D-FIS-G5.4)
        regime_fiscal: bailleur.regimeFiscal ?? null,
        revenus_actifs_annuels_courant_centimes:
          bailleur.revenusActifsAnnuelsCourant?.toSqliteInteger() ?? null,
        fiscalite_premier_acces: bailleur.fiscalitePremierAcces?.toString() ?? null,
      })
      .onConflict((oc) =>
        oc.column('singleton_marker').doUpdateSet({
          nom_complet: bailleur.nomComplet,
          rue: bailleur.adresse.rue,
          code_postal: bailleur.adresse.codePostal,
          ville: bailleur.adresse.ville,
          modifie_le: new Date().toISOString(),
          // Phase 5 — mise à jour champs fiscaux (D-LOCK-2)
          regime_fiscal: bailleur.regimeFiscal ?? null,
          revenus_actifs_annuels_courant_centimes:
            bailleur.revenusActifsAnnuelsCourant?.toSqliteInteger() ?? null,
          fiscalite_premier_acces: bailleur.fiscalitePremierAcces?.toString() ?? null,
        }),
      )
      .execute();
  }

  async mettreAJour(bailleur: Bailleur): Promise<void> {
    await this.db
      .updateTable('bailleur')
      .set({
        nom_complet: bailleur.nomComplet,
        rue: bailleur.adresse.rue,
        code_postal: bailleur.adresse.codePostal,
        ville: bailleur.adresse.ville,
        modifie_le: new Date().toISOString(),
        // Phase 5 — mise à jour champs fiscaux (D-LOCK-2)
        regime_fiscal: bailleur.regimeFiscal ?? null,
        revenus_actifs_annuels_courant_centimes:
          bailleur.revenusActifsAnnuelsCourant?.toSqliteInteger() ?? null,
        fiscalite_premier_acces: bailleur.fiscalitePremierAcces?.toString() ?? null,
      })
      .where('id', '=', bailleur.id)
      .execute();
  }

  private versDomaine(row: {
    id: string;
    nom_complet: string;
    rue: string;
    code_postal: string;
    ville: string;
    regime_fiscal?: string | null;
    revenus_actifs_annuels_courant_centimes?: number | null;
    fiscalite_premier_acces?: string | null;
  }): Bailleur {
    return Bailleur.creer({
      id: row.id as BailleurId,
      nomComplet: row.nom_complet,
      adresse: Adresse.creer({
        rue: row.rue,
        codePostal: row.code_postal,
        ville: row.ville,
      }),
      // Phase 5 — champs fiscaux (D-LOCK-2, D-FIS-G3.1, D-FIS-G5.4)
      regimeFiscal: (row.regime_fiscal as RegimeFiscal | null) ?? null,
      revenusActifsAnnuelsCourant: row.revenus_actifs_annuels_courant_centimes != null
        ? Money.fromCentimes(BigInt(row.revenus_actifs_annuels_courant_centimes))
        : null,
      fiscalitePremierAcces: row.fiscalite_premier_acces != null
        ? Temporal.PlainDateTime.from(row.fiscalite_premier_acces)
        : null,
    });
  }
}

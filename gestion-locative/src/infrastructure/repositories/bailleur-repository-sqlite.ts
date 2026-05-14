import type { Kysely } from 'kysely';

import type { DB } from '../db/kysely-types.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import { Bailleur } from '../../domain/identite/bailleur.js';
import { Adresse } from '../../domain/_shared/adresse.js';
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
    await this.db
      .insertInto('bailleur')
      .values({
        id: bailleur.id,
        singleton_marker: 'unique_bailleur',
        nom_complet: bailleur.nomComplet,
        rue: bailleur.adresse.rue,
        code_postal: bailleur.adresse.codePostal,
        ville: bailleur.adresse.ville,
      })
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
  }): Bailleur {
    return Bailleur.creer({
      id: row.id as BailleurId,
      nomComplet: row.nom_complet,
      adresse: Adresse.creer({
        rue: row.rue,
        codePostal: row.code_postal,
        ville: row.ville,
      }),
    });
  }
}

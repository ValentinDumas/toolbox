import { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';
import type { DB } from '../db/kysely-types.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import { Locataire } from '../../domain/locatif/locataire.js';
import { Adresse } from '../../domain/_shared/adresse.js';
import type { LocataireId } from '../../domain/_shared/identifiants.js';

export class LocataireRepositorySqlite implements LocataireRepository {
  constructor(private readonly db: Kysely<DB>) {}

  async enregistrer(locataire: Locataire): Promise<void> {
    const row = this.versRow(locataire);
    await this.db
      .insertInto('locataire')
      .values(row)
      .onConflict((oc) =>
        oc.column('id').doUpdateSet({
          nom: row.nom,
          prenom: row.prenom,
          date_naissance: row.date_naissance,
          commune_naissance: row.commune_naissance,
          pays_naissance: row.pays_naissance,
          nationalite: row.nationalite,
          email: row.email,
          telephone: row.telephone,
          rue: row.rue,
          code_postal: row.code_postal,
          ville: row.ville,
          modifie_le: new Date().toISOString(),
        }),
      )
      .execute();
  }

  async trouverParId(id: LocataireId): Promise<Locataire | null> {
    const row = await this.db
      .selectFrom('locataire')
      .selectAll()
      .where('id', '=', id)
      .where('supprime_le', 'is', null)
      .executeTakeFirst();

    if (!row) return null;
    return this.versDomaine(row);
  }

  async listerTous(): Promise<Locataire[]> {
    const rows = await this.db
      .selectFrom('locataire')
      .selectAll()
      .where('supprime_le', 'is', null)
      .orderBy('nom', 'asc')
      .orderBy('prenom', 'asc')
      .execute();

    return rows.map((r) => this.versDomaine(r));
  }

  async supprimer(id: LocataireId): Promise<void> {
    await this.db
      .updateTable('locataire')
      .set({ supprime_le: new Date().toISOString() })
      .where('id', '=', id)
      .execute();
  }

  private versRow(locataire: Locataire): {
    id: string;
    nom: string;
    prenom: string;
    date_naissance: string;
    commune_naissance: string;
    pays_naissance: string;
    nationalite: string;
    email: string;
    telephone: string | null;
    rue: string;
    code_postal: string;
    ville: string;
  } {
    return {
      id: locataire.id,
      nom: locataire.nom,
      prenom: locataire.prenom,
      // Temporal.PlainDate.toString() retourne la représentation ISO YYYY-MM-DD
      date_naissance: locataire.dateNaissance.toString(),
      commune_naissance: locataire.lieuNaissance.commune,
      pays_naissance: locataire.lieuNaissance.pays,
      nationalite: locataire.nationalite,
      email: locataire.email,
      telephone: locataire.telephone ?? null,
      rue: locataire.adresseActuelle.rue,
      code_postal: locataire.adresseActuelle.codePostal,
      ville: locataire.adresseActuelle.ville,
    };
  }

  private versDomaine(row: {
    id: string;
    nom: string;
    prenom: string;
    date_naissance: string;
    commune_naissance: string;
    pays_naissance: string;
    nationalite: string;
    email: string;
    telephone: string | null;
    rue: string;
    code_postal: string;
    ville: string;
  }): Locataire {
    return Locataire.creer({
      id: row.id as LocataireId,
      nom: row.nom,
      prenom: row.prenom,
      // Reconstitution Temporal.PlainDate depuis string ISO stocké en SQLite
      dateNaissance: Temporal.PlainDate.from(row.date_naissance),
      lieuNaissance: { commune: row.commune_naissance, pays: row.pays_naissance },
      nationalite: row.nationalite,
      email: row.email,
      telephone: row.telephone,
      adresseActuelle: Adresse.creer({
        rue: row.rue,
        codePostal: row.code_postal,
        ville: row.ville,
      }),
    });
  }
}

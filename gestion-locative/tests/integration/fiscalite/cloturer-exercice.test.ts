/**
 * Tests d'intégration — use case cloturerExercice.
 *
 * Vérifie avec DB in-memory :
 *   1. Clôture micro-BIC + DeclarationAnnuelle persistée avec bonnes valeurs
 *   2. Snapshot immuable après soft-delete encaissement post-clôture (CONTEXT.md L251)
 *   3. Figée check via qualifier-justificatif post-clôture → throw DeclarationFigeeException
 *
 * @tags @phase5 @fis-06 integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { cloturerExercice } from '../../../src/application/fiscalite/cloturer-exercice.js';
import { qualifierJustificatif } from '../../../src/application/fiscalite/qualifier-justificatif.js';
import { DeclarationFigeeException } from '../../../src/domain/fiscalite/erreurs.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import { ComposantRepositorySqlite, ValorisationFiscaleRepositorySqlite } from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import { unBailleurValide } from '../../_builders/identite.js';
import { unJustificatifNonQualifie } from '../../_builders/fiscalite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import type { BailleurId, BienId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const TODAY = Temporal.PlainDate.from('2026-12-31');
const EXERCICE = 2026;

function makeClock(date = TODAY) {
  return { aujourdhui: () => date };
}

describe('cloturerExercice — intégration in-memory', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurId: BailleurId;
  let bienId: BienId;
  let bailleurRepo: BailleurRepositorySqlite;
  let declRepo: DeclarationAnnuelleRepositorySqlite;
  let justificatifRepo: JustificatifRepositorySqlite;
  let regleFiscale: RegleFiscaleProviderEnMemoire;
  let bailId: string;
  let echeanceId: string;

  function makeRepos() {
    return {
      bailleurRepo,
      recettesRepo: new RecettesRepositorySqlite(db),
      chargesRepo: new ChargesRepositorySqlite(db),
      composantRepo: new ComposantRepositorySqlite(db),
      valorisationRepo: new ValorisationFiscaleRepositorySqlite(db),
      declRepo,
      tableauAmortRepo: new TableauAmortissementRepositorySqlite(db),
      justificatifRepo,
      ticketRepo: new TicketTravauxRepositorySqlite(db),
      bienRepo: new BienRepositorySqlite(db),
    };
  }

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    bailleurRepo = new BailleurRepositorySqlite(db);
    declRepo = new DeclarationAnnuelleRepositorySqlite(db);
    justificatifRepo = new JustificatifRepositorySqlite(db);
    regleFiscale = new RegleFiscaleProviderEnMemoire();

    // Seed bailleur singleton avec revenus foyer null (recettes < seuil LMP dans ces tests)
    const bailleur = unBailleurValide();
    await bailleurRepo.enregistrer(bailleur);
    bailleurId = bailleur.id;

    // Seed bien (nécessaire pour FK justificatif + FK composant)
    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    bienId = bien.id;

    // Seed bail + echeance_loyer pour le JOIN RecettesRepository
    // encaissement → echeance_loyer → bail (INNER JOIN chain)
    bailId = crypto.randomUUID();
    echeanceId = crypto.randomUUID();

    // Locataire minimal (FK bail)
    const locataireId = crypto.randomUUID();
    await db.insertInto('locataire').values({
      id: locataireId,
      nom: 'Test',
      prenom: 'Locataire',
      date_naissance: '1985-01-01',
      commune_naissance: 'Paris',
      pays_naissance: 'France',
      nationalite: 'française',
      email: 'test@example.fr',
      telephone: null,
      rue: '1 rue test',
      code_postal: '75001',
      ville: 'Paris',
      supprime_le: null,
    }).execute();

    await db.insertInto('bail').values({
      id: bailId,
      locataire_id: locataireId,
      bien_id: bienId,
      type: 'meuble',
      date_debut: `${EXERCICE}-01-01`,
      duree_mois: 12,
      loyer_hc: 90_000,
      mode_charges: 'forfait',
      montant_charges: 5_000,
      depot_garantie: 180_000,
      irl_trimestre: '2024-T4',
      irl_valeur: '142.06',
      cautionnement: null,
      actif_depuis: `${EXERCICE}-01-01`,
      jour_echeance: 1,
      mobilier: null,
      supprime_le: null,
    }).execute();

    await db.insertInto('echeance_loyer').values({
      id: echeanceId,
      bail_id: bailId,
      periode_debut: `${EXERCICE}-01-01`,
      periode_fin: `${EXERCICE}-01-31`,
      jour_echeance_attendue: `${EXERCICE}-01-01`,
      loyer_hc: 90_000,
      montant_charges: 5_000,
      mode_charges: 'forfait',
      total: 95_000,
      statut: 'payee',
      annule_le: null,
    }).execute();
  });

  afterEach(async () => {
    await db.destroy();
    sqlite.close();
  });

  it('Clôture micro-BIC : recettes 20k < seuil LMP → declaration micro persistée', async () => {
    // Seed 2 encaissements (10k + 10k = 20k recettes) via la chaîne FK correcte
    const echeanceId2 = crypto.randomUUID();
    await db.insertInto('echeance_loyer').values({
      id: echeanceId2,
      bail_id: bailId,
      periode_debut: `${EXERCICE}-06-01`,
      periode_fin: `${EXERCICE}-06-30`,
      jour_echeance_attendue: `${EXERCICE}-06-01`,
      loyer_hc: 90_000,
      montant_charges: 5_000,
      mode_charges: 'forfait',
      total: 95_000,
      statut: 'payee',
      annule_le: null,
    }).execute();

    await db.insertInto('encaissement').values({
      id: crypto.randomUUID(),
      echeance_id: echeanceId,
      montant_centimes: 1_000_000, // 10 000 €
      date: `${EXERCICE}-03-01`,
      mode: 'virement',
      annule_le: null,
      raison_annulation: null,
    }).execute();

    await db.insertInto('encaissement').values({
      id: crypto.randomUUID(),
      echeance_id: echeanceId2,
      montant_centimes: 1_000_000, // 10 000 €
      date: `${EXERCICE}-06-01`,
      mode: 'virement',
      annule_le: null,
      raison_annulation: null,
    }).execute();

    const repos = makeRepos();
    const resultat = await cloturerExercice(
      { bailleurId, exercice: EXERCICE },
      repos,
      makeClock(),
      regleFiscale,
      db,
    );

    expect(resultat.regimeApplique).toBe('micro_bic');
    expect(['lmnp_confirme', 'indetermine_revenus_foyer_manquants']).toContain(resultat.verdictLmp);

    // Vérifier la DeclarationAnnuelle persistée
    const decl = await declRepo.trouverParId(resultat.declarationId);
    expect(decl).not.toBeNull();
    expect(decl!.recettesTotales.toSqliteInteger()).toBe(2_000_000); // 20 000 €
    expect(decl!.regimeApplique).toBe('micro_bic');
    expect(decl!.exercice).toBe(EXERCICE);
    expect(decl!.bailleurId).toBe(bailleurId);
  });

  it('Snapshot immuable après soft-delete encaissement post-clôture (CONTEXT.md L251)', async () => {
    // Seed un encaissement via la chaîne FK correcte (table encaissement, colonne echeance_id)
    const encaissementId = crypto.randomUUID();
    await db.insertInto('encaissement').values({
      id: encaissementId,
      echeance_id: echeanceId,
      montant_centimes: 500_000, // 5 000 €
      date: `${EXERCICE}-03-01`,
      mode: 'virement',
      annule_le: null,
      raison_annulation: null,
    }).execute();

    const repos = makeRepos();
    const resultat = await cloturerExercice(
      { bailleurId, exercice: EXERCICE },
      repos,
      makeClock(),
      regleFiscale,
      db,
    );

    const declAvant = await declRepo.trouverParId(resultat.declarationId);
    expect(declAvant!.recettesTotales.toSqliteInteger()).toBe(500_000); // 5 000 €

    // Soft-delete l'encaissement post-clôture
    await db.updateTable('encaissement')
      .set({ annule_le: `${EXERCICE}-12-31`, raison_annulation: 'Test post-clôture' })
      .where('id', '=', encaissementId)
      .execute();

    // Relecture → recettes INCHANGÉES (snapshot par valeur — D-FIS-G4.2)
    const declApres = await declRepo.trouverParId(resultat.declarationId);
    expect(declApres!.recettesTotales.toSqliteInteger()).toBe(500_000); // Toujours 5 000 €
  });

  it('Figée check via qualifierJustificatif post-clôture → throw DeclarationFigeeException', async () => {
    // Clôturer l'exercice (sans recettes = 0€)
    const repos = makeRepos();
    await cloturerExercice(
      { bailleurId, exercice: EXERCICE },
      repos,
      makeClock(),
      regleFiscale,
      db,
    );

    // Créer un justificatif pour exercice 2026 (post-clôture) — bienId existant en DB
    const justificatif = unJustificatifNonQualifie({
      bienId,
      dateDocument: Temporal.PlainDate.from(`${EXERCICE}-03-01`),
    });
    await justificatifRepo.enregistrer(justificatif);

    // Tenter de qualifier → throw DeclarationFigeeException (D-FIS-G2.5)
    await expect(
      qualifierJustificatif(
        { justificatifId: justificatif.id as never, qualification: 'entretien_reparation' },
        { justificatifRepo, declRepo, bailleurRepo },
        makeClock(),
      ),
    ).rejects.toThrow(DeclarationFigeeException);
  });
});

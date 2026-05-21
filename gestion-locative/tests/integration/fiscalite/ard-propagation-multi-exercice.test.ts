/**
 * Tests d'intégration — Propagation ARD cross-exercice (CGI art. 39 B sans limite).
 *
 * BLOCKER scenario : exercice N génère ARD 10k → exercice N+1 consomme ARD 10k
 * via tableauAmortRepo.dernierArdCumuleBailleur(bailleurId, N).
 *
 * @tags @phase5 @fis-06 @fis-ard-cross integration
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
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { ComposantRepositorySqlite, ValorisationFiscaleRepositorySqlite } from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';
import { ValorisationFiscale } from '../../../src/domain/fiscalite/valorisation-fiscale.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { unBailleurValide } from '../../_builders/identite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import type { BailleurId, BienId, EcheanceLoyerId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const EXERCICE_N = 2026;
const EXERCICE_N1 = 2027;

function makeClockFor(exercice: number) {
  return { aujourdhui: () => Temporal.PlainDate.from(`${exercice}-12-31`) };
}

describe('ARD propagation cross-exercice (CGI art. 39 B sans limite)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurId: BailleurId;
  let bienId: BienId;
  let tableauAmortRepo: TableauAmortissementRepositorySqlite;
  let declRepo: DeclarationAnnuelleRepositorySqlite;
  let bailleurRepo: BailleurRepositorySqlite;
  let regleFiscale: RegleFiscaleProviderEnMemoire;
  let bailId: string;
  let echeanceNId: string;
  let echeanceN1Id: string;

  function makeRepos() {
    return {
      bailleurRepo,
      recettesRepo: new RecettesRepositorySqlite(db),
      chargesRepo: new ChargesRepositorySqlite(db),
      composantRepo: new ComposantRepositorySqlite(db),
      valorisationRepo: new ValorisationFiscaleRepositorySqlite(db),
      declRepo,
      tableauAmortRepo,
      justificatifRepo: new JustificatifRepositorySqlite(db),
      ticketRepo: new TicketTravauxRepositorySqlite(db),
      bienRepo: new BienRepositorySqlite(db),
    };
  }

  /**
   * Seed un encaissement via la chaîne FK correcte.
   * Table: 'encaissement' (singulier), colonne: 'echeance_id', mode: 'virement'.
   */
  async function seedEncaissement(echeanceId: EcheanceLoyerId, exercice: number, montantEuros: number) {
    await db.insertInto('encaissement').values({
      id: crypto.randomUUID(),
      echeance_id: echeanceId,
      montant_centimes: montantEuros * 100,
      date: `${exercice}-03-01`,
      mode: 'virement',
      annule_le: null,
      raison_annulation: null,
    }).execute();
  }

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    bailleurRepo = new BailleurRepositorySqlite(db);
    declRepo = new DeclarationAnnuelleRepositorySqlite(db);
    tableauAmortRepo = new TableauAmortissementRepositorySqlite(db);
    regleFiscale = new RegleFiscaleProviderEnMemoire();

    // Seed bailleur avec revenus foyer (recettes > 23k dans ces tests)
    const bailleur = unBailleurValide();
    const bailleurAvecRevenus = bailleur.modifier({ revenusActifsAnnuelsCourant: Money.fromEuros(150_000) });
    await bailleurRepo.enregistrer(bailleurAvecRevenus);
    bailleurId = bailleur.id;

    // Seed bien + composant gros_oeuvre (durée 40 ans)
    const bienRepo = new BienRepositorySqlite(db);
    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    bienId = bien.id;

    const composantRepo = new ComposantRepositorySqlite(db);
    // Gros œuvre : 200 000 € / 40 ans = 5 000 €/an dotation théorique
    const grosOeuvre = Composant.creer({
      bienId,
      type: 'gros_oeuvre',
      montantHt: Money.fromEuros(200_000),
      dateAcquisition: Temporal.PlainDate.from(`${EXERCICE_N}-01-01`),
      origineKind: 'initial',
    });
    await composantRepo.enregistrerBatch([grosOeuvre]);

    // Valorisation fiscale (obligatoire pour régime réel)
    const valorisationRepo = new ValorisationFiscaleRepositorySqlite(db);
    const valorisation = ValorisationFiscale.creer({
      bienId,
      prixAcquisition: Money.fromEuros(216_000),
      dateAcquisition: Temporal.PlainDate.from(`${EXERCICE_N}-01-01`),
      fraisNotaire: Money.fromEuros(16_000),
      fraisAgence: Money.fromEuros(8_000),
      quotePartTerrainRatio: 0.10,
      activeLe: Temporal.PlainDateTime.from(`${EXERCICE_N}-01-01T10:00:00`),
    });
    await valorisationRepo.enregistrer(valorisation);

    // Seed bail + echeances pour les recettes (JOIN chain requis par RecettesRepositorySqlite)
    const locataireId = crypto.randomUUID();
    await db.insertInto('locataire').values({
      id: locataireId,
      nom: 'ARD',
      prenom: 'Test',
      date_naissance: '1985-01-01',
      commune_naissance: 'Paris',
      pays_naissance: 'France',
      nationalite: 'française',
      email: 'ard@example.fr',
      telephone: null,
      rue: '1 rue ard',
      code_postal: '75001',
      ville: 'Paris',
      supprime_le: null,
    }).execute();

    bailId = crypto.randomUUID();
    await db.insertInto('bail').values({
      id: bailId,
      locataire_id: locataireId,
      bien_id: bienId,
      type: 'meuble',
      date_debut: `${EXERCICE_N}-01-01`,
      duree_mois: 24,
      loyer_hc: 400_000,
      mode_charges: 'forfait',
      montant_charges: 10_000,
      depot_garantie: 800_000,
      irl_trimestre: '2024-T4',
      irl_valeur: '142.06',
      cautionnement: null,
      actif_depuis: `${EXERCICE_N}-01-01`,
      jour_echeance: 1,
      mobilier: null,
      supprime_le: null,
    }).execute();

    echeanceNId = crypto.randomUUID();
    await db.insertInto('echeance_loyer').values({
      id: echeanceNId,
      bail_id: bailId,
      periode_debut: `${EXERCICE_N}-01-01`,
      periode_fin: `${EXERCICE_N}-12-31`,
      jour_echeance_attendue: `${EXERCICE_N}-03-01`,
      loyer_hc: 400_000,
      montant_charges: 10_000,
      mode_charges: 'forfait',
      total: 410_000,
      statut: 'payee',
      annule_le: null,
    }).execute();

    echeanceN1Id = crypto.randomUUID();
    await db.insertInto('echeance_loyer').values({
      id: echeanceN1Id,
      bail_id: bailId,
      periode_debut: `${EXERCICE_N1}-01-01`,
      periode_fin: `${EXERCICE_N1}-12-31`,
      jour_echeance_attendue: `${EXERCICE_N1}-03-01`,
      loyer_hc: 400_000,
      montant_charges: 10_000,
      mode_charges: 'forfait',
      total: 410_000,
      statut: 'payee',
      annule_le: null,
    }).execute();
  });

  afterEach(async () => {
    await db.destroy();
    sqlite.close();
  });

  it('ARD généré N consommé prioritairement en N+1 (CGI art. 39 B)', async () => {
    // Exercice N (2026) : recettes 50k, charges 48k
    // résultat avant amortissement = 50k - 48k = 2k
    // dotation théorique gros_oeuvre = 200k / 40 ans = 5k
    // plafond 2k < dotation 5k → dotation appliquée 2k, ARD généré = 3k
    await seedEncaissement(echeanceNId as EcheanceLoyerId, EXERCICE_N, 50_000);

    // Charges 48k via justificatif qualifié directement en SQL
    const justifId = crypto.randomUUID();
    await db.insertInto('justificatifs').values({
      id: justifId,
      bien_id: bienId,
      locataire_id: null,
      type: 'facture',
      titre: 'Charges importantes N',
      chemin_fichier: 'charges/2026/important.pdf',
      nom_fichier_original: 'important.pdf',
      mime_type: 'application/pdf',
      taille_octets: 50_000,
      notes: null,
      montant_ttc_centimes: 4_800_000, // 48 000 €
      date_document: `${EXERCICE_N}-03-01`,
      date_paiement: `${EXERCICE_N}-03-01`,
      qualification_fiscale: 'entretien_reparation',
      qualifie_le: `${EXERCICE_N}-03-02`,
      parent_justificatif_id: null,
      cree_le: `${EXERCICE_N}-01-01`,
      corbeille_le: null,
    }).execute();

    const repos = makeRepos();

    // Clôture exercice N
    const resultatN = await cloturerExercice(
      { bailleurId, exercice: EXERCICE_N, regimeChoisi: 'reel' },
      repos,
      makeClockFor(EXERCICE_N),
      regleFiscale,
      db,
    );

    expect(resultatN.regimeApplique).toBe('reel');

    // Vérifier ARD généré en N
    const declN = await declRepo.trouverParId(resultatN.declarationId);
    expect(declN).not.toBeNull();
    // ardGenere > 0 car dotation théorique (5k) > résultat avant amort (2k)
    expect(declN!.ardGenere.toSqliteInteger()).toBeGreaterThan(0);
    const ardGenereN = declN!.ardGenere;

    // Exercice N+1 (2027) : recettes 60k
    await seedEncaissement(echeanceN1Id as EcheanceLoyerId, EXERCICE_N1, 60_000);

    // Vérifier que dernierArdCumuleBailleur retourne l'ARD de N
    const ardCumule = await tableauAmortRepo.dernierArdCumuleBailleur(bailleurId, EXERCICE_N);
    expect(ardCumule.toSqliteInteger()).toBeGreaterThan(0);
    expect(ardCumule.toSqliteInteger()).toBe(ardGenereN.toSqliteInteger());

    // Clôture exercice N+1 — ARD propagé via dernierArdCumuleBailleur
    const resultatN1 = await cloturerExercice(
      { bailleurId, exercice: EXERCICE_N1, regimeChoisi: 'reel' },
      repos,
      makeClockFor(EXERCICE_N1),
      regleFiscale,
      db,
    );

    expect(resultatN1.regimeApplique).toBe('reel');

    const declN1 = await declRepo.trouverParId(resultatN1.declarationId);
    expect(declN1).not.toBeNull();
    // ardConsomme N+1 = ARD généré en N (consommé prioritairement)
    expect(declN1!.ardConsomme.toSqliteInteger()).toBe(ardGenereN.toSqliteInteger());
  });
});

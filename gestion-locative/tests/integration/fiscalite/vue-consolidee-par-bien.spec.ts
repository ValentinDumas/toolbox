/**
 * Tests d'intégration — listerVueConsolidee end-to-end (D-FIS-G5.1).
 *
 * RED phase : tests écrits avant l'implémentation.
 *
 * Setup in-memory + appliquerToutesMigrations + 2 biens activés + recettes + charges.
 * Appel listerVueConsolidee(bailleurId, 2026) + assertions sur ventilation par bien.
 *
 * Sources :
 *   - D-FIS-G5.1 : vue consolidée multi-bien — ventilation RÉELLE par bien
 *   - D-LOCK-2 : seuils appliqués sur total consolidé
 *   - CGI art. 50-0 : seuil micro-BIC 83 600 € (révision 2026-2028)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { listerVueConsolidee } from '../../../src/application/fiscalite/lister-vue-consolidee.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import { ComposantRepositorySqlite, ValorisationFiscaleRepositorySqlite } from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import { unBailleurValide } from '../../_builders/identite.js';
import type { BailleurId, BienId, LotId, EcheanceLoyerId, JustificatifId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const EXERCICE = 2026;
const TODAY = Temporal.PlainDate.from('2026-12-31');

describe('listerVueConsolidee — intégration in-memory (D-FIS-G5.1)', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurId: BailleurId;
  let bienId1: BienId;
  let bienId2: BienId;
  let bailId1: string;
  let bailId2: string;
  let echeanceId1: EcheanceLoyerId;
  let echeanceId2: EcheanceLoyerId;

  function makeRepos() {
    const regleFiscale = new RegleFiscaleProviderEnMemoire();
    return {
      bienRepo: new BienRepositorySqlite(db),
      recettesRepo: new RecettesRepositorySqlite(db),
      chargesRepo: new ChargesRepositorySqlite(db),
      composantRepo: new ComposantRepositorySqlite(db),
      valorisationRepo: new ValorisationFiscaleRepositorySqlite(db),
      tableauAmortRepo: new TableauAmortissementRepositorySqlite(db),
      bailleurRepo: new BailleurRepositorySqlite(db),
      regleFiscale: regleFiscale.obtenirPourAnnee(EXERCICE),
    };
  }

  beforeEach(async () => {
    sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);

    // Bailleur singleton (déjà créé par la migration seeds)
    const bailleurRow = await db.selectFrom('bailleur').selectAll().executeTakeFirst();
    if (bailleurRow) {
      bailleurId = bailleurRow.id as BailleurId;
      // Mettre à jour avec les revenus foyer pour les tests LMP
      await db.updateTable('bailleur').set({
        revenus_actifs_annuels_courant: 100_000_00, // 100k en centimes
      }).where('id', '=', bailleurId).execute();
    } else {
      const bailleur = unBailleurValide();
      bailleurId = bailleur.id;
      await db.insertInto('bailleur').values({
        id: bailleur.id,
        nom_complet: bailleur.nomComplet,
        rue: bailleur.adresse.rue,
        code_postal: bailleur.adresse.codePostal,
        ville: bailleur.adresse.ville,
        singleton_marker: 1,
        regime_fiscal: null,
        revenus_actifs_annuels_courant: 10_000_000, // 100k en centimes
        fiscalite_premier_acces: null,
      }).execute();
    }

    // 2 biens
    bienId1 = crypto.randomUUID() as BienId;
    bienId2 = crypto.randomUUID() as BienId;

    for (const [bienId, adresse] of [[bienId1, '10 rue Paris'], [bienId2, '20 rue Lyon']] as const) {
      await db.insertInto('bien').values({
        id: bienId, rue: adresse, code_postal: '75001', ville: 'Paris',
        surface: 60, type: 'appartement', annee_construction: 2000,
        classe_dpe: null, supprime_le: null,
      }).execute();
    }

    // 1 lot par bien
    const lotId1 = crypto.randomUUID() as LotId;
    const lotId2 = crypto.randomUUID() as LotId;
    await db.insertInto('lot').values({ id: lotId1, bien_id: bienId1, designation: 'T3 Paris', surface: 60, type: 'appartement', etage: 1, supprime_le: null }).execute();
    await db.insertInto('lot').values({ id: lotId2, bien_id: bienId2, designation: 'T4 Lyon', surface: 80, type: 'appartement', etage: 2, supprime_le: null }).execute();

    // Locataire unique
    const locId = crypto.randomUUID();
    await db.insertInto('locataire').values({
      id: locId, nom: 'Dupont', prenom: 'Jean',
      date_naissance: '1985-06-15', commune_naissance: 'Paris', pays_naissance: 'France',
      nationalite: 'Française', email: 'jean@test.fr', telephone: null,
      rue: '1 rue locataire', code_postal: '75001', ville: 'Paris', supprime_le: null,
    }).execute();

    // Baux : 1 bail → 1 lot → 1 bien
    bailId1 = crypto.randomUUID();
    bailId2 = crypto.randomUUID();
    for (const [bId, lotId, bienId, loyer] of [
      [bailId1, lotId1, bienId1, 120_000],
      [bailId2, lotId2, bienId2, 100_000],
    ] as const) {
      await db.insertInto('bail').values({
        id: bId, locataire_id: locId, bien_id: bienId,
        type: 'meuble', date_debut: '2026-01-01', duree_mois: 12,
        loyer_hc: loyer, mode_charges: 'forfait', montant_charges: 10000,
        depot_garantie: 240000, irl_trimestre: '2025-T4', irl_valeur: '142.06',
        cautionnement: null, actif_depuis: '2026-01-01', jour_echeance: 5,
        mobilier: null, supprime_le: null,
      }).execute();
    }

    // Échéances et encaissements pour recettes B1=50k, B2=40k
    echeanceId1 = crypto.randomUUID() as EcheanceLoyerId;
    echeanceId2 = crypto.randomUUID() as EcheanceLoyerId;
    await db.insertInto('echeance_loyer').values({
      id: echeanceId1, bail_id: bailId1,
      periode_debut: '2026-01-01', periode_fin: '2026-12-31',
      jour_echeance_attendue: '2026-01-05',
      loyer_hc: 120_000, montant_charges: 10000, mode_charges: 'forfait',
      total: 130_000, statut: 'payee', annule_le: null,
    }).execute();
    await db.insertInto('echeance_loyer').values({
      id: echeanceId2, bail_id: bailId2,
      periode_debut: '2026-01-01', periode_fin: '2026-12-31',
      jour_echeance_attendue: '2026-01-05',
      loyer_hc: 100_000, montant_charges: 10000, mode_charges: 'forfait',
      total: 110_000, statut: 'payee', annule_le: null,
    }).execute();

    // Encaissements : B1 = 50 000 €, B2 = 40 000 €
    await db.insertInto('encaissement').values({
      id: crypto.randomUUID(), echeance_id: echeanceId1,
      montant_centimes: 5_000_000, date: '2026-01-10',
      mode: 'virement', annule_le: null, raison_annulation: null,
    }).execute();
    await db.insertInto('encaissement').values({
      id: crypto.randomUUID(), echeance_id: echeanceId2,
      montant_centimes: 4_000_000, date: '2026-01-10',
      mode: 'virement', annule_le: null, raison_annulation: null,
    }).execute();

    // Charges : B1 = 5 000 €, B2 = 10 000 €
    for (const [bienId, montant] of [[bienId1, 500_000], [bienId2, 1_000_000]] as const) {
      const jId = crypto.randomUUID() as JustificatifId;
      await db.insertInto('justificatifs').values({
        id: jId, type: 'facture', date_document: '2026-02-01',
        titre: `Charge ${bienId}`, montant_ttc_centimes: montant,
        chemin_fichier: `factures/${jId}.pdf`, nom_fichier_original: `facture.pdf`,
        mime_type: 'application/pdf', taille_octets: 50_000,
        bien_id: bienId, locataire_id: null, notes: null,
        cree_le: '2026-02-01', corbeille_le: null, raison_corbeille: null,
        qualification_fiscale: 'entretien_reparation',
        qualifie_le: '2026-02-01', date_paiement: '2026-02-15',
        parent_justificatif_id: null,
      }).execute();
    }
  });

  afterEach(async () => {
    await db.destroy();
  });

  it('Test 1 : retour.biens.length === 2 ; ventilation réelle 50k / 40k par bien', async () => {
    const clock = { aujourdhui: () => TODAY };
    const repos = makeRepos();

    const result = await listerVueConsolidee(bailleurId, EXERCICE, repos, clock);

    expect(result.biens).toHaveLength(2);
    const bienR1 = result.biens.find((b) => b.bienId === bienId1)!;
    const bienR2 = result.biens.find((b) => b.bienId === bienId2)!;
    expect(bienR1).toBeDefined();
    expect(bienR2).toBeDefined();
    expect(bienR1.recettes.egale(Money.fromEuros(50_000))).toBe(true);
    expect(bienR2.recettes.egale(Money.fromEuros(40_000))).toBe(true);
  });

  it('Test 2 : totaux.recettes === 90k, totaux.charges === 15k', async () => {
    const clock = { aujourdhui: () => TODAY };
    const repos = makeRepos();

    const result = await listerVueConsolidee(bailleurId, EXERCICE, repos, clock);

    expect(result.totaux.recettes.egale(Money.fromEuros(90_000))).toBe(true);
    expect(result.totaux.charges.egale(Money.fromEuros(15_000))).toBe(true);
  });

  it('Test 3 : regimeApplique === reel (90k > 83.6k consolidé)', async () => {
    const clock = { aujourdhui: () => TODAY };
    const repos = makeRepos();

    const result = await listerVueConsolidee(bailleurId, EXERCICE, repos, clock);

    expect(result.regimeApplique).toBe('reel');
  });

  it('Test 4 : verdictLmp === lmnp_confirme (recettes 90k < foyer 100k)', async () => {
    const clock = { aujourdhui: () => TODAY };
    const repos = makeRepos();

    const result = await listerVueConsolidee(bailleurId, EXERCICE, repos, clock);

    // Foyer 100k, recettes 90k < 100k → LMNP confirmé
    expect(result.verdictLmp).toBe('lmnp_confirme');
  });
});

/**
 * Tests d'intégration — Parcours complet clôture exercice fiscal LMNP (Plan 08).
 *
 * Couverture plan 05-08 must_have :
 *   - Parcours micro-BIC : seed + qualif + revenus + clôture → assertions exhaustives
 *   - Parcours réel forcé : recettes > seuil → regime 'reel' + dotation > 0
 *   - Export CSV (BOM UTF-8) + export PDF (magic bytes %PDF)
 *
 * DB in-memory SQLite + migrations complètes (pattern cloturer-exercice.test.ts).
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
import { exporterCsvFiscal } from '../../../src/application/fiscalite/exporter-csv-fiscal.js';
import { exporterPdfRecap } from '../../../src/application/fiscalite/exporter-pdf-recap.js';
import { PdfRendererPdfmake } from '../../../src/infrastructure/pdf/pdf-renderer-pdfmake.js';
import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import { ComposantRepositorySqlite, ValorisationFiscaleRepositorySqlite } from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { unBailleurValide } from '../../_builders/identite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import { unComposantGrosOeuvre, uneValorisationFiscale } from '../../_builders/fiscalite.js';
import type { BailleurId, BienId, DeclarationAnnuelleId, LotId } from '../../../src/domain/_shared/identifiants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');
const EXERCICE = 2026;
const TODAY = Temporal.PlainDate.from('2026-12-31');

function makeClock(date = TODAY) {
  return { aujourdhui: () => date };
}

describe('parcours-complet-cloture — intégration end-to-end', () => {
  let db: Kysely<DB>;
  let sqlite: InstanceType<typeof Database>;
  let bailleurId: BailleurId;
  let bienId: BienId;
  let bailleurRepo: BailleurRepositorySqlite;
  let declRepo: DeclarationAnnuelleRepositorySqlite;
  let justificatifRepo: JustificatifRepositorySqlite;
  let regleFiscale: RegleFiscaleProviderEnMemoire;
  let bailId: string;
  // IDs des échéances pour insérer des encaissements
  const echeanceIds: string[] = [];

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

  /** Seed un encaissement et retourne son ID */
  async function seedEncaissement(echeanceId: string, montantCentimes: number): Promise<string> {
    const id = crypto.randomUUID();
    await db.insertInto('encaissement').values({
      id,
      echeance_id: echeanceId,
      montant_centimes: montantCentimes,
      date: `${EXERCICE}-06-01`,
      mode: 'virement',
      annule_le: null,
      raison_annulation: null,
    }).execute();
    return id;
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

    // Bailleur avec revenus foyer (60k > recettes micro 48k → LMNP confirmé)
    const bailleur = unBailleurValide().modifier({
      revenusActifsAnnuelsCourant: Money.fromEuros(60_000),
    });
    await bailleurRepo.enregistrer(bailleur);
    bailleurId = bailleur.id;

    // Bien
    const bien = unBienValide();
    await new BienRepositorySqlite(db).enregistrer(bien);
    bienId = bien.id;

    // Lot minimal (requis par BienRepositorySqlite.listerTous pour PDF)
    const lotId = crypto.randomUUID() as LotId;
    await db.insertInto('lot').values({
      id: lotId,
      bien_id: bienId,
      designation: 'Appartement T3',
      surface: 60,
      type: 'appartement',
      etage: 1,
      supprime_le: null,
    }).execute();

    // Locataire + bail + 12 écheances pour 12 encaissements de 4 000 € = 48 000 € recettes
    const locataireId = crypto.randomUUID();
    await db.insertInto('locataire').values({
      id: locataireId, nom: 'Martin', prenom: 'Pierre', date_naissance: '1980-01-01',
      commune_naissance: 'Paris', pays_naissance: 'France', nationalite: 'française',
      email: 'martin@example.fr', telephone: null, rue: '1 rue Test', code_postal: '75001',
      ville: 'Paris', supprime_le: null,
    }).execute();

    bailId = crypto.randomUUID();
    await db.insertInto('bail').values({
      id: bailId, locataire_id: locataireId, bien_id: bienId, type: 'meuble',
      date_debut: `${EXERCICE}-01-01`, duree_mois: 12, loyer_hc: 400_000,
      mode_charges: 'forfait', montant_charges: 0, depot_garantie: 800_000,
      irl_trimestre: '2024-T4', irl_valeur: '142.06', cautionnement: null,
      actif_depuis: `${EXERCICE}-01-01`, jour_echeance: 1, mobilier: null, supprime_le: null,
    }).execute();

    // 12 échéances (une par mois)
    echeanceIds.length = 0;
    for (let mois = 1; mois <= 12; mois++) {
      const echeanceId = crypto.randomUUID();
      echeanceIds.push(echeanceId);
      const moisStr = String(mois).padStart(2, '0');
      const lastDay = new Date(EXERCICE, mois, 0).getDate();
      await db.insertInto('echeance_loyer').values({
        id: echeanceId,
        bail_id: bailId,
        periode_debut: `${EXERCICE}-${moisStr}-01`,
        periode_fin: `${EXERCICE}-${moisStr}-${lastDay}`,
        jour_echeance_attendue: `${EXERCICE}-${moisStr}-01`,
        loyer_hc: 400_000,
        montant_charges: 0,
        mode_charges: 'forfait',
        total: 400_000,
        statut: 'payee',
        annule_le: null,
      }).execute();
    }
  });

  afterEach(async () => {
    await db.destroy();
    sqlite.close();
  });

  it('Parcours complet micro-BIC : 48k recettes → declaration persistée avec 6 assertions', async () => {
    // Seed 12 encaissements de 400 € × 100 = 4 000 € × 12 = 48 000 €
    for (const echeanceId of echeanceIds) {
      await seedEncaissement(echeanceId, 400_000); // 4 000 €
    }

    const repos = makeRepos();
    const resultat = await cloturerExercice(
      { bailleurId, exercice: EXERCICE },
      repos,
      makeClock(),
      regleFiscale,
      db,
    );

    // Assertion 1 : regime micro (48k < 83.6k)
    expect(resultat.regimeApplique).toBe('micro_bic');
    // Assertion 2 : verdict LMNP confirmé (48k < 23k threshold? Non — 48k > 23k mais foyer 60k > 48k)
    expect(resultat.verdictLmp).toBe('lmnp_confirme');

    const decl = await declRepo.trouverParId(resultat.declarationId);
    expect(decl).not.toBeNull();

    // Assertion 3 : recettes totales = 48 000 € = 4 800 000 centimes
    expect(decl!.recettesTotales.centimes).toBe(4_800_000n);
    // Assertion 4 : regime micro
    expect(decl!.regimeApplique).toBe('micro_bic');
    // Assertion 5 : verdict LMNP confirmé
    expect(decl!.statutLmnpLmp).toBe('lmnp_confirme');
    // Assertion 6 : dotation zéro (micro ne consume pas d'amortissement)
    expect(decl!.dotationAmortissement.centimes).toBe(0n);
    // Assertion 7 : composantsSnapshot vide (micro)
    expect(decl!.composantsSnapshot).toBe('[]');
    // Assertion 8 : clotureLe = date clock
    expect(decl!.clotureLe.toString()).toBe('2026-12-31');

    // Export CSV — contient BOM UTF-8 et les recettes
    const { contenu: csv } = await exporterCsvFiscal(
      { declarationId: resultat.declarationId },
      { declRepo },
    );
    const BOM = '﻿';
    expect(csv.startsWith(BOM)).toBe(true);
    // Recettes 48 000 € présentes dans le CSV
    expect(csv).toContain('Recettes annuelles');

    // Export PDF — magic bytes %PDF
    const pdfRenderer = new PdfRendererPdfmake();
    const { buffer } = await exporterPdfRecap(
      { declarationId: resultat.declarationId },
      { declRepo, bailleurRepo, bienRepo: new BienRepositorySqlite(db), tableauAmortRepo: new TableauAmortissementRepositorySqlite(db) },
      pdfRenderer,
    );
    expect(buffer.slice(0, 4).toString()).toBe('%PDF');
  });

  it('Parcours complet réel forcé : 100k recettes → regime reel + dotation > 0 + snapshot non vide', async () => {
    // Recettes > seuil micro (83 600 €) → régime réel forcé
    // 12 encaissements de 8 334 € ≈ 100 008 € total (> 83 600 €)
    for (const echeanceId of echeanceIds) {
      await seedEncaissement(echeanceId, 833_400); // 8 334 €
    }

    // Composant gros_oeuvre + valorisation pour le régime réel
    const composantRepo = new ComposantRepositorySqlite(db);
    const valorisationRepo = new ValorisationFiscaleRepositorySqlite(db);

    const composant = unComposantGrosOeuvre({
      bienId,
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });
    await composantRepo.enregistrer(composant);

    const valorisation = uneValorisationFiscale({ bienId });
    await valorisationRepo.enregistrer(valorisation);

    // Bailleur avec revenus foyer > recettes pour LMNP
    const bailleur = await bailleurRepo.trouver();
    const bailleurMaj = bailleur!.modifier({
      revenusActifsAnnuelsCourant: Money.fromEuros(150_000),
    });
    await bailleurRepo.enregistrer(bailleurMaj);

    const repos = makeRepos();
    const resultat = await cloturerExercice(
      { bailleurId, exercice: EXERCICE },
      repos,
      makeClock(),
      regleFiscale,
      db,
    );

    // Regime réel forcé car 100k > 83.6k
    expect(resultat.regimeApplique).toBe('reel');

    const decl = await declRepo.trouverParId(resultat.declarationId);
    expect(decl).not.toBeNull();
    expect(decl!.regimeApplique).toBe('reel');
    // Dotation > 0 car composant gros_oeuvre 200k / 40 ans = 5k proratisé
    expect(decl!.dotationAmortissement.centimes).toBeGreaterThan(0n);
    // Snapshot non vide en régime réel
    expect(decl!.composantsSnapshot).not.toBe('[]');
    // Verdict LMNP confirmé (100k < foyer 150k)
    expect(decl!.statutLmnpLmp).toBe('lmnp_confirme');
  });
});

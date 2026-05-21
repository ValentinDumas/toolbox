/**
 * Step definitions @fis-cas-limites @phase5 : Cas limites locked CONTEXT.md L242-252.
 *
 * Stratégie : appel direct des use cases purs pour les calculs simples (L242-L247, L249-L250, L252).
 *             DB in-memory pour L251 (snapshot immuable post soft-delete).
 *
 * Sources :
 *   CGI art. 50-0 — micro-BIC seuil 83 600 € (2026)
 *   CGI art. 155 IV — critères LMP (Conseil Constitutionnel n° 2009-587 DC)
 *   CGI art. 39, 39 B — amortissement, ARD reportable
 *   BOFIP-BIC-AMT-20-10 — prorata temporis jour par jour
 *   D-FIS-G4.2 — snapshot par valeur (immutable post-clôture)
 */

import { Before, After, Given, When, Then, World } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { Kysely, SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Temporal } from '@js-temporal/polyfill';

import type { DB } from '../../../src/infrastructure/db/kysely-types.js';
import { activerPragmas, appliquerToutesMigrations } from '../../../src/infrastructure/db/database.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { REGLES_2026 } from '../../../src/domain/fiscalite/regles/regles-2026.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';

import { choisirRegime } from '../../../src/application/fiscalite/choisir-regime.js';
import { calculerMicroBic } from '../../../src/application/fiscalite/calculer-micro-bic.js';
import { detecterBasculeLmp } from '../../../src/application/fiscalite/detecter-bascule-lmp.js';
import {
  calculerAmortissement,
  estActifPourExercice,
} from '../../../src/application/fiscalite/calculer-amortissement.js';
import { cloturerExercice } from '../../../src/application/fiscalite/cloturer-exercice.js';
import { Composant } from '../../../src/domain/fiscalite/composant.js';
import type { VerdictLmp } from '../../../src/domain/fiscalite/verdict-lmp.js';
import type { BailleurId, BienId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';

import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import { ComposantRepositorySqlite, ValorisationFiscaleRepositorySqlite } from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';

import { unBailleurValide } from '../../_builders/identite.js';
import { unBienValide } from '../../_builders/patrimoine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

// ─── World ─────────────────────────────────────────────────────────────────────

interface MondeCasLimites extends World {
  // Calcul régime
  recettesCentimes: number;
  regimeAutoChoisi: 'micro_bic' | 'reel' | null;

  // Calcul micro-BIC
  abattementApplique: bigint | null;

  // Calcul verdict LMP
  verdictLmpInput: { recettes: Money; revenusFoyer: Money | null };
  dernierVerdictLmp: VerdictLmp | null;

  // Calcul amortissement composant
  composantTest: Composant | null;
  dotationTheoriqueComposant: bigint | null;

  // L251 — infra pour snapshot immuable
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  bailleurId: BailleurId | null;
  bienId: BienId | null;
  declarationId: DeclarationAnnuelleId | null;
  encaissementId: string | null;

  [key: string]: unknown;
}

// ─── Before/After @fis-cas-limites ─────────────────────────────────────────────

Before({ tags: '@fis-cas-limites' }, function (this: MondeCasLimites) {
  this.recettesCentimes = 0;
  this.regimeAutoChoisi = null;
  this.abattementApplique = null;
  this.verdictLmpInput = { recettes: Money.zero(), revenusFoyer: null };
  this.dernierVerdictLmp = null;
  this.composantTest = null;
  this.dotationTheoriqueComposant = null;
  this.db = null;
  this.sqlite = null;
  this.bailleurId = null;
  this.bienId = null;
  this.declarationId = null;
  this.encaissementId = null;
});

After({ tags: '@fis-cas-limites' }, async function (this: MondeCasLimites) {
  if (this.db) {
    await this.db.destroy();
  }
  if (this.sqlite) {
    this.sqlite.close();
  }
});

// ─── Contexte ──────────────────────────────────────────────────────────────────

Given(
  'l\'application est prête pour les cas limites fiscaux avec clock fixe {string}',
  function (this: MondeCasLimites, _clockIso: string) {
    // Use cases purs — pas d'infrastructure à initialiser ici
  },
);

// ─── L242a/b — Seuil micro-BIC (régime auto-choisi) ───────────────────────────

Given(
  'des recettes de {int} centimes pour calcul du régime',
  function (this: MondeCasLimites, centimes: number) {
    this.recettesCentimes = centimes;
  },
);

When(
  'on calcule le régime auto-choisi pour ces recettes',
  function (this: MondeCasLimites) {
    const recettes = Money.fromCentimes(BigInt(this.recettesCentimes));
    this.regimeAutoChoisi = choisirRegime(recettes, undefined, REGLES_2026);
  },
);

Then(
  'le régime auto-choisi est {string}',
  function (this: MondeCasLimites, regimeAttendu: string) {
    assert.strictEqual(
      this.regimeAutoChoisi,
      regimeAttendu,
      `Régime attendu : ${regimeAttendu}, obtenu : ${this.regimeAutoChoisi}`,
    );
  },
);

// ─── L243 — Plancher abattement micro-BIC ──────────────────────────────────────

Given(
  'des recettes de {int} centimes pour calcul micro-BIC',
  function (this: MondeCasLimites, centimes: number) {
    this.recettesCentimes = centimes;
  },
);

When(
  'on calcule le micro-BIC pour ces recettes',
  function (this: MondeCasLimites) {
    const recettes = Money.fromCentimes(BigInt(this.recettesCentimes));
    const result = calculerMicroBic(recettes, REGLES_2026);
    this.abattementApplique = result.abattementApplique.centimes;
  },
);

Then(
  /^l'abattement appliqué est (\d+) centimes \(plancher 305 €\)$/,
  function (this: MondeCasLimites, centimesStr: string) {
    const centimesAttendus = BigInt(centimesStr);
    assert.strictEqual(
      this.abattementApplique,
      centimesAttendus,
      `Abattement attendu : ${centimesAttendus}, obtenu : ${this.abattementApplique}`,
    );
  },
);

// ─── L244-L247, L252 — Verdict LMP (detecterBasculeLmp pur) ───────────────────

Given(
  'des recettes de {int} centimes pour le calcul du verdict LMP',
  function (this: MondeCasLimites, centimes: number) {
    this.verdictLmpInput = {
      ...this.verdictLmpInput,
      recettes: Money.fromCentimes(BigInt(centimes)),
    };
  },
);

Given(
  'aucun revenu du foyer renseigné pour le calcul du verdict LMP',
  function (this: MondeCasLimites) {
    this.verdictLmpInput = { ...this.verdictLmpInput, revenusFoyer: null };
  },
);

Given(
  'des revenus du foyer de {int} centimes pour le calcul du verdict LMP',
  function (this: MondeCasLimites, centimes: number) {
    this.verdictLmpInput = {
      ...this.verdictLmpInput,
      revenusFoyer: Money.fromCentimes(BigInt(centimes)),
    };
  },
);

// L252 — Étape supplémentaire pour enchaîner les recettes + revenus foyer
Given(
  'des recettes de {int} centimes et revenus du foyer {int} centimes pour le verdict LMP',
  function (this: MondeCasLimites, recettesCentimes: number, revenusCentimes: number) {
    this.verdictLmpInput = {
      recettes: Money.fromCentimes(BigInt(recettesCentimes)),
      revenusFoyer: Money.fromCentimes(BigInt(revenusCentimes)),
    };
  },
);

When(
  'on évalue le verdict LMP pour ces recettes',
  function (this: MondeCasLimites) {
    const provider = new RegleFiscaleProviderEnMemoire();
    const regles = provider.pour(2026);
    this.dernierVerdictLmp = detecterBasculeLmp(this.verdictLmpInput, regles);
  },
);

Then(
  'le verdict LMP est {string}',
  function (this: MondeCasLimites, verdictAttendu: string) {
    assert.strictEqual(
      this.dernierVerdictLmp,
      verdictAttendu,
      `Verdict LMP attendu : ${verdictAttendu}, obtenu : ${this.dernierVerdictLmp}`,
    );
  },
);

// ─── L249/L250 — Amortissement composant (pur) ─────────────────────────────────

Given(
  /^un composant gros_oeuvre de (\d+) centimes acquis le "([^"]+)"$/,
  function (this: MondeCasLimites, montantStr: string, dateStr: string) {
    const bienId = crypto.randomUUID() as BienId;
    this.composantTest = Composant.creer({
      bienId,
      type: 'gros_oeuvre',
      montantHt: Money.fromCentimes(BigInt(montantStr)),
      dateAcquisition: Temporal.PlainDate.from(dateStr),
      origineKind: 'initial',
      ticketId: null,
      dateSortie: null,
      motifSortie: null,
    });
  },
);

Given(
  /^un composant gros_oeuvre de (\d+) centimes acquis le "([^"]+)" sorti le "([^"]+)"$/,
  function (this: MondeCasLimites, montantStr: string, dateAcqStr: string, dateSortieStr: string) {
    const bienId = crypto.randomUUID() as BienId;
    this.composantTest = Composant.creer({
      bienId,
      type: 'gros_oeuvre',
      montantHt: Money.fromCentimes(BigInt(montantStr)),
      dateAcquisition: Temporal.PlainDate.from(dateAcqStr),
      origineKind: 'initial',
      ticketId: null,
      dateSortie: Temporal.PlainDate.from(dateSortieStr),
      motifSortie: 'sinistre',
    });
  },
);

When(
  'on calcule l\'amortissement du composant pour l\'exercice {int}',
  function (this: MondeCasLimites, exercice: number) {
    assert.ok(this.composantTest !== null, 'Composant non initialisé');
    const result = calculerAmortissement(
      [this.composantTest],
      exercice,
      REGLES_2026,
      {
        resultatAvantAmortissement: Money.fromEuros(100_000), // Suffisant pour ne pas limiter la dotation
        ardCumuleEnEntree: Money.zero(),
      },
    );
    const premiereLigne = result.dotationParComposant[0];
    this.dotationTheoriqueComposant = premiereLigne?.dotationTheorique.centimes ?? 0n;
  },
);

Then(
  /^la dotation théorique du composant est d'environ (\d+) centimes \(±(\d+) centimes\)$/,
  function (this: MondeCasLimites, centimesStr: string, toleranceStr: string) {
    const attendus = BigInt(centimesStr);
    const tolerance = BigInt(toleranceStr);
    const obtenu = this.dotationTheoriqueComposant ?? 0n;
    const diff = obtenu > attendus ? obtenu - attendus : attendus - obtenu;
    assert.ok(
      diff <= tolerance,
      `Dotation attendue : ~${attendus} (±${tolerance}), obtenu : ${obtenu} (diff: ${diff})`,
    );
  },
);

Then(
  'le composant n\'est pas actif pour l\'exercice {int}',
  function (this: MondeCasLimites, exercice: number) {
    assert.ok(this.composantTest !== null, 'Composant non initialisé');
    const actif = estActifPourExercice(this.composantTest, exercice);
    assert.strictEqual(actif, false, `Composant devrait être inactif pour exercice ${exercice}`);
  },
);

// ─── L251 — Snapshot immuable (infra in-memory) ─────────────────────────────────

Given(
  'une déclaration clôturée avec {int} centimes de recettes',
  async function (this: MondeCasLimites, recettesCentimes: number) {
    // Setup in-memory DB
    const sqlite = new Database(':memory:');
    activerPragmas(sqlite);
    const db = new Kysely<DB>({ dialect: new SqliteDialect({ database: sqlite }) });
    await appliquerToutesMigrations(db, sqlite, MIGRATIONS_DIR);
    this.db = db;
    this.sqlite = sqlite;

    const bailleurRepo = new BailleurRepositorySqlite(db);
    const bienRepo = new BienRepositorySqlite(db);

    const bailleur = unBailleurValide().modifier({
      revenusActifsAnnuelsCourant: Money.fromEuros(60_000),
    });
    await bailleurRepo.enregistrer(bailleur);
    this.bailleurId = bailleur.id;

    const bien = unBienValide();
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;

    // Locataire + bail + 1 écheance + 1 encaissement pour avoir les recettes demandées
    const locataireId = crypto.randomUUID();
    await db.insertInto('locataire').values({
      id: locataireId, nom: 'Test', prenom: 'Snapshot', date_naissance: '1990-01-01',
      commune_naissance: 'Nantes', pays_naissance: 'France', nationalite: 'française',
      email: 'snapshot@test.fr', telephone: null, rue: '1 rue test', code_postal: '44000',
      ville: 'Nantes', supprime_le: null,
    }).execute();

    const bailId = crypto.randomUUID();
    await db.insertInto('bail').values({
      id: bailId, locataire_id: locataireId, bien_id: this.bienId, type: 'meuble',
      date_debut: '2026-01-01', duree_mois: 12, loyer_hc: recettesCentimes,
      mode_charges: 'forfait', montant_charges: 0, depot_garantie: recettesCentimes * 2,
      irl_trimestre: '2024-T4', irl_valeur: '142.06', cautionnement: null,
      actif_depuis: '2026-01-01', jour_echeance: 1, mobilier: null, supprime_le: null,
    }).execute();

    const echeanceId = crypto.randomUUID();
    await db.insertInto('echeance_loyer').values({
      id: echeanceId, bail_id: bailId,
      periode_debut: '2026-01-01', periode_fin: '2026-12-31',
      jour_echeance_attendue: '2026-01-01',
      loyer_hc: recettesCentimes, montant_charges: 0, mode_charges: 'forfait',
      total: recettesCentimes, statut: 'payee', annule_le: null,
    }).execute();

    const encaissementId = crypto.randomUUID();
    this.encaissementId = encaissementId;
    await db.insertInto('encaissement').values({
      id: encaissementId, echeance_id: echeanceId,
      montant_centimes: recettesCentimes, date: '2026-03-01',
      mode: 'virement', annule_le: null, raison_annulation: null,
    }).execute();

    // Clôturer l'exercice 2026
    const regleFiscale = new RegleFiscaleProviderEnMemoire();
    const repos = {
      bailleurRepo,
      recettesRepo: new RecettesRepositorySqlite(db),
      chargesRepo: new ChargesRepositorySqlite(db),
      composantRepo: new ComposantRepositorySqlite(db),
      valorisationRepo: new ValorisationFiscaleRepositorySqlite(db),
      declRepo: new DeclarationAnnuelleRepositorySqlite(db),
      tableauAmortRepo: new TableauAmortissementRepositorySqlite(db),
      justificatifRepo: new JustificatifRepositorySqlite(db),
      ticketRepo: new TicketTravauxRepositorySqlite(db),
      bienRepo,
    };

    const resultat = await cloturerExercice(
      { bailleurId: this.bailleurId, exercice: 2026 },
      repos,
      { aujourdhui: () => Temporal.PlainDate.from('2026-12-31') },
      regleFiscale,
      db,
    );
    this.declarationId = resultat.declarationId;
  },
);

When(
  'on annule l\'encaissement après la clôture',
  async function (this: MondeCasLimites) {
    assert.ok(this.db !== null, 'DB non initialisée');
    assert.ok(this.encaissementId !== null, 'encaissementId non défini');

    await this.db.updateTable('encaissement')
      .set({ annule_le: '2026-12-31', raison_annulation: 'Annulation test L251' })
      .where('id', '=', this.encaissementId)
      .execute();
  },
);

Then(
  'la déclaration a toujours {int} centimes de recettes',
  async function (this: MondeCasLimites, centimesAttendus: number) {
    assert.ok(this.db !== null, 'DB non initialisée');
    assert.ok(this.declarationId !== null, 'declarationId non défini');

    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParId(this.declarationId);
    assert.ok(decl !== null, 'Déclaration introuvable');
    assert.strictEqual(
      decl.recettesTotales.centimes,
      BigInt(centimesAttendus),
      `Recettes attendues : ${centimesAttendus}, obtenu : ${decl.recettesTotales.centimes}`,
    );
  },
);

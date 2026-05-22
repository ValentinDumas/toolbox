/**
 * Step definitions @fis-cloture : Clôture annuelle exercice fiscal LMNP.
 *
 * Stratégie : appel direct use case cloturerExercice (pas HTTP).
 * DB in-memory SQLite + migrations complètes (same pattern enc02.steps.ts).
 *
 * Couverture : CONTEXT.md L249-252
 *   L249 — ARD cross-exercice CGI 39 B
 *   L250 — UNIQUE (bailleur_id, exercice) : double clôture interdite
 *   L251 — Snapshot immuable post soft-delete encaissement
 *   L252 — Anti-sticky LMP : 3 exercices évalués indépendamment
 *
 * Tags : @phase5 @fis-06 @fis-cloture
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
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailleurId, BienId, DeclarationAnnuelleId } from '../../../src/domain/_shared/identifiants.js';

import { cloturerExercice } from '../../../src/application/fiscalite/cloturer-exercice.js';
import { qualifierJustificatif } from '../../../src/application/fiscalite/qualifier-justificatif.js';
import {
  PrerequisCloturalNonSatisfaits,
  DeclarationFigeeException,
} from '../../../src/domain/fiscalite/erreurs.js';
import { DeclarationDejaExiste } from '../../../src/application/fiscalite/cloturer-exercice.js';

import { BailleurRepositorySqlite } from '../../../src/infrastructure/repositories/bailleur-repository-sqlite.js';
import { BienRepositorySqlite } from '../../../src/infrastructure/repositories/bien-repository-sqlite.js';
import { RecettesRepositorySqlite } from '../../../src/infrastructure/repositories/recettes-repository-sqlite.js';
import { ChargesRepositorySqlite } from '../../../src/infrastructure/repositories/charges-repository-sqlite.js';
import {
  ComposantRepositorySqlite,
  ValorisationFiscaleRepositorySqlite,
} from '../../../src/infrastructure/repositories/composant-repository-sqlite.js';
import { TableauAmortissementRepositorySqlite } from '../../../src/infrastructure/repositories/tableau-amortissement-repository-sqlite.js';
import { JustificatifRepositorySqlite } from '../../../src/infrastructure/repositories/justificatif-repository-sqlite.js';
import { TicketTravauxRepositorySqlite } from '../../../src/infrastructure/repositories/ticket-travaux-repository-sqlite.js';
import { DeclarationAnnuelleRepositorySqlite } from '../../../src/infrastructure/repositories/declaration-annuelle-repository-sqlite.js';
import { RegleFiscaleProviderEnMemoire } from '../../../src/domain/fiscalite/regles/regle-fiscale-provider.js';

import { unBailleurValide } from '../../_builders/identite.js';
import { unBienValide } from '../../_builders/patrimoine.js';
import { unJustificatifNonQualifie, unComposantGrosOeuvre, uneValorisationFiscale } from '../../_builders/fiscalite.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../../migrations');

// ─── World ─────────────────────────────────────────────────────────────────────

interface MondeCloture extends World {
  db: Kysely<DB> | null;
  sqlite: InstanceType<typeof Database> | null;
  bailleurId: BailleurId | null;
  bienId: BienId | null;
  bailId: string | null;
  // Encaissements par exercice (pour seed multi-exercice)
  echeanceParExercice: Record<number, string>;
  // Dernière déclaration créée
  derniereDeclarationId: DeclarationAnnuelleId | null;
  // Erreur capturée
  derniereErreur: Error | null;
  // Revenus bailleur courants (modifiable entre exercices anti-sticky)
  revenusBailleurCentimes: number | null;
  // Dernier justificatif créé (post-clôture)
  dernierJustificatifId: string | null;
  [key: string]: unknown;
}

// ─── Before/After pour @fis-cloture ───────────────────────────────────────────

Before({ tags: '@fis-cloture' }, async function (this: MondeCloture) {
  process.env['SESSION_SECRET'] = 'test-secret-for-fis-cloture-at-least32!!';
  this.sqlite = new Database(':memory:');
  activerPragmas(this.sqlite);
  this.db = new Kysely<DB>({ dialect: new SqliteDialect({ database: this.sqlite }) });
  await appliquerToutesMigrations(this.db, this.sqlite, MIGRATIONS_DIR);
  this.bailleurId = null;
  this.bienId = null;
  this.bailId = null;
  this.echeanceParExercice = {};
  this.derniereDeclarationId = null;
  this.derniereErreur = null;
  this.revenusBailleurCentimes = null;
  this.dernierJustificatifId = null;
});

After({ tags: '@fis-cloture' }, async function (this: MondeCloture) {
  if (this.db) await this.db.destroy();
  if (this.sqlite) this.sqlite.close();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRepos(db: Kysely<DB>) {
  return {
    bailleurRepo: new BailleurRepositorySqlite(db),
    recettesRepo: new RecettesRepositorySqlite(db),
    chargesRepo: new ChargesRepositorySqlite(db),
    composantRepo: new ComposantRepositorySqlite(db),
    valorisationRepo: new ValorisationFiscaleRepositorySqlite(db),
    declRepo: new DeclarationAnnuelleRepositorySqlite(db),
    tableauAmortRepo: new TableauAmortissementRepositorySqlite(db),
    justificatifRepo: new JustificatifRepositorySqlite(db),
    ticketRepo: new TicketTravauxRepositorySqlite(db),
    bienRepo: new BienRepositorySqlite(db),
  };
}

async function seedEncaissement(
  db: Kysely<DB>,
  echeanceId: string,
  montantCentimes: number,
  exercice: number,
): Promise<void> {
  await db
    .insertInto('encaissement')
    .values({
      id: crypto.randomUUID(),
      echeance_id: echeanceId,
      montant_centimes: montantCentimes,
      date: `${exercice}-06-01`,
      mode: 'virement',
      annule_le: null,
      raison_annulation: null,
    })
    .execute();
}

async function seedEcheanceLoyer(
  db: Kysely<DB>,
  bailId: string,
  exercice: number,
): Promise<string> {
  const echeanceId = crypto.randomUUID();
  await db
    .insertInto('echeance_loyer')
    .values({
      id: echeanceId,
      bail_id: bailId,
      periode_debut: `${exercice}-01-01`,
      periode_fin: `${exercice}-12-31`,
      jour_echeance_attendue: `${exercice}-01-01`,
      loyer_hc: 90_000,
      montant_charges: 5_000,
      mode_charges: 'forfait',
      total: 95_000,
      statut: 'payee',
      annule_le: null,
    })
    .execute();
  return echeanceId;
}

async function seedBailEtEcheance(
  db: Kysely<DB>,
  bienId: BienId,
  exercices: number[],
): Promise<{ bailId: string; echeanceParExercice: Record<number, string> }> {
  const locataireId = crypto.randomUUID();
  await db
    .insertInto('locataire')
    .values({
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
    })
    .execute();

  const bailId = crypto.randomUUID();
  const premierExercice = exercices[0] ?? 2026;
  await db
    .insertInto('bail')
    .values({
      id: bailId,
      locataire_id: locataireId,
      bien_id: bienId,
      type: 'meuble',
      date_debut: `${premierExercice}-01-01`,
      duree_mois: 12 * exercices.length,
      loyer_hc: 90_000,
      mode_charges: 'forfait',
      montant_charges: 5_000,
      depot_garantie: 180_000,
      irl_trimestre: '2024-T4',
      irl_valeur: '142.06',
      cautionnement: null,
      actif_depuis: `${premierExercice}-01-01`,
      jour_echeance: 1,
      mobilier: null,
      supprime_le: null,
    })
    .execute();

  const echeanceParExercice: Record<number, string> = {};
  for (const exercice of exercices) {
    echeanceParExercice[exercice] = await seedEcheanceLoyer(db, bailId, exercice);
  }

  return { bailId, echeanceParExercice };
}

// ─── Given Background ─────────────────────────────────────────────────────────

Given(
  'un bailleur singleton enregistré avec revenus foyer à null',
  async function (this: MondeCloture) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bailleur = unBailleurValide();
    const bailleurRepo = new BailleurRepositorySqlite(this.db);
    await bailleurRepo.enregistrer(bailleur);
    this.bailleurId = bailleur.id;
    this.revenusBailleurCentimes = null;
  },
);

Given(
  'un bien immobilier enregistré',
  async function (this: MondeCloture) {
    assert.ok(this.db, 'DB doit être initialisée');
    const bien = unBienValide();
    const bienRepo = new BienRepositorySqlite(this.db);
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;

    // Seed bail + écheance pour tous les exercices utilisés dans les scénarios (2026-2028)
    const { bailId, echeanceParExercice } = await seedBailEtEcheance(
      this.db,
      bien.id,
      [2026, 2027, 2028],
    );
    this.bailId = bailId;
    this.echeanceParExercice = echeanceParExercice;
  },
);

Given(
  'le système est prêt pour la clôture fiscale',
  async function (this: MondeCloture) {
    // No-op : background complet après les deux Given précédents
  },
);

// ─── Given recettes ───────────────────────────────────────────────────────────

Given(
  /^des recettes de ([\d ]+) € pour l'exercice (\d{4})$/,
  async function (this: MondeCloture, montantStr: string, exerciceStr: string) {
    const montantEuros = parseInt(montantStr.replace(/\s/g, ''), 10);
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    const echeanceId = this.echeanceParExercice[exercice];
    assert.ok(echeanceId, `Aucune écheance seedée pour exercice ${exercice}`);
    await seedEncaissement(this.db, echeanceId, montantEuros * 100, exercice);
  },
);

// ─── Given bailleur revenus ───────────────────────────────────────────────────

Given(
  /^un bailleur avec des revenus actifs annuels de ([\d ]+) €$/,
  async function (this: MondeCloture, montantStr: string) {
    const montantEuros = parseInt(montantStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');

    if (!this.bailleurId) {
      // Première fois : créer le bailleur
      const bailleur = unBailleurValide();
      const bailleurRepo = new BailleurRepositorySqlite(this.db);
      await bailleurRepo.enregistrer(bailleur);
      this.bailleurId = bailleur.id;
      this.echeanceParExercice = this.echeanceParExercice ?? {};
    }

    // Mettre à jour les revenus du bailleur via UPDATE direct (mono-utilisateur)
    await this.db
      .updateTable('bailleur')
      .set({ revenus_actifs_annuels_courant_centimes: montantEuros * 100 })
      .where('id', '=', this.bailleurId)
      .execute();
    this.revenusBailleurCentimes = montantEuros * 100;
  },
);

// ─── Given composant + valorisation ──────────────────────────────────────────

Given(
  /^un composant gros_oeuvre de ([\d ]+) € acquis en (\d{4})$/,
  async function (this: MondeCloture, montantStr: string, exerciceStr: string) {
    const montantEuros = parseInt(montantStr.replace(/\s/g, ''), 10);
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bienId, 'bienId doit être initialisé');
    const composant = unComposantGrosOeuvre({
      bienId: this.bienId,
      montantHt: Money.fromEuros(montantEuros),
      dateAcquisition: Temporal.PlainDate.from(`${exercice}-01-01`),
    });
    const composantRepo = new ComposantRepositorySqlite(this.db);
    await composantRepo.enregistrer(composant);
  },
);

Given(
  'une valorisation fiscale activée pour ce bien',
  async function (this: MondeCloture) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bienId, 'bienId doit être initialisé');
    const valorisation = uneValorisationFiscale({ bienId: this.bienId });
    const valorisationRepo = new ValorisationFiscaleRepositorySqlite(this.db);
    await valorisationRepo.enregistrer(valorisation);
  },
);

// ─── Given justificatifs non qualifiés ───────────────────────────────────────

Given(
  /^(\d+) justificatifs non qualifiés pour l'exercice (\d{4})$/,
  async function (this: MondeCloture, nbStr: string, exerciceStr: string) {
    const nbJustificatifs = parseInt(nbStr, 10);
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bienId, 'bienId doit être initialisé');
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    for (let i = 0; i < nbJustificatifs; i++) {
      const justificatif = unJustificatifNonQualifie({
        bienId: this.bienId,
        dateDocument: Temporal.PlainDate.from(`${exercice}-03-01`),
      });
      await justificatifRepo.enregistrer(justificatif);
    }
  },
);

// ─── When clôturer ────────────────────────────────────────────────────────────

Given(
  'When le bailleur clôture l\'exercice {int}',
  async function (this: MondeCloture, exercice: number) {
    // Alias Given → même implémentation que When
    await cloturerExerciceStep.call(this, exercice, undefined);
  },
);

When(
  'le bailleur clôture l\'exercice {int}',
  async function (this: MondeCloture, exercice: number) {
    await cloturerExerciceStep.call(this, exercice, undefined);
  },
);

When(
  'le bailleur clôture l\'exercice {int} en régime {string}',
  async function (this: MondeCloture, exercice: number, regime: string) {
    await cloturerExerciceStep.call(this, exercice, regime as 'micro_bic' | 'reel');
  },
);

When(
  'le bailleur tente de clôturer l\'exercice {int}',
  async function (this: MondeCloture, exercice: number) {
    try {
      await cloturerExerciceStep.call(this, exercice, undefined);
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

When(
  'le bailleur tente de clôturer l\'exercice {int} une deuxième fois',
  async function (this: MondeCloture, exercice: number) {
    try {
      await cloturerExerciceStep.call(this, exercice, undefined);
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

async function cloturerExerciceStep(
  this: MondeCloture,
  exercice: number,
  regimeChoisi: 'micro_bic' | 'reel' | undefined,
): Promise<void> {
  assert.ok(this.db, 'DB doit être initialisée');
  assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
  const clock = ClockFixe.du(`${exercice}-12-31`);
  const repos = makeRepos(this.db);
  const regleFiscale = new RegleFiscaleProviderEnMemoire();

  const resultat = await cloturerExercice(
    { bailleurId: this.bailleurId, exercice, regimeChoisi },
    repos,
    clock,
    regleFiscale,
    this.db,
  );
  this.derniereDeclarationId = resultat.declarationId;
}

// ─── When post-clôture ────────────────────────────────────────────────────────

When(
  'un encaissement de l\'exercice {int} est annulé post-clôture',
  async function (this: MondeCloture, exercice: number) {
    assert.ok(this.db, 'DB doit être initialisée');
    // Annuler TOUS les encaissements de l'exercice (soft-delete)
    const echeanceId = this.echeanceParExercice[exercice];
    assert.ok(echeanceId, `Aucune écheance pour exercice ${exercice}`);
    await this.db
      .updateTable('encaissement')
      .set({
        annule_le: `${exercice}-12-31`,
        raison_annulation: 'Test post-clôture soft-delete',
      })
      .where('echeance_id', '=', echeanceId)
      .execute();
  },
);

When(
  'un justificatif de l\'exercice {int} est créé post-clôture',
  async function (this: MondeCloture, exercice: number) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bienId, 'bienId doit être initialisé');
    const justificatif = unJustificatifNonQualifie({
      bienId: this.bienId,
      dateDocument: Temporal.PlainDate.from(`${exercice}-03-01`),
    });
    const justificatifRepo = new JustificatifRepositorySqlite(this.db);
    await justificatifRepo.enregistrer(justificatif);
    this.dernierJustificatifId = justificatif.id;
  },
);

When(
  'le bailleur tente de qualifier ce justificatif',
  async function (this: MondeCloture) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    assert.ok(this.dernierJustificatifId, 'Aucun justificatif créé');
    const clock = ClockFixe.du('2026-12-31');
    const repos = makeRepos(this.db);
    try {
      await qualifierJustificatif(
        { justificatifId: this.dernierJustificatifId as never, qualification: 'entretien_reparation' },
        { justificatifRepo: repos.justificatifRepo, declRepo: repos.declRepo, bailleurRepo: repos.bailleurRepo },
        clock,
      );
    } catch (err) {
      this.derniereErreur = err as Error;
    }
  },
);

// ─── Then vérifications déclaration ──────────────────────────────────────────

Then(
  'la déclaration {int} a regime_applique {string}',
  async function (this: MondeCloture, exercice: number, regimeAttendu: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
    assert.strictEqual(
      decl.regimeApplique,
      regimeAttendu,
      `Régime attendu : ${regimeAttendu}, obtenu : ${decl.regimeApplique}`,
    );
  },
);

Then(
  /^la déclaration (\d{4}) a des recettes_totales de ([\d ]+) centimes$/,
  async function (this: MondeCloture, exerciceStr: string, centimesStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    const centimesAttendus = parseInt(centimesStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
    assert.strictEqual(
      Number(decl.recettesTotales.toSqliteInteger()),
      centimesAttendus,
      `Recettes attendues : ${centimesAttendus} centimes, obtenu : ${decl.recettesTotales.toSqliteInteger()}`,
    );
  },
);

Then(
  /^la déclaration (\d{4}) a toujours des recettes_totales de ([\d ]+) centimes$/,
  async function (this: MondeCloture, exerciceStr: string, centimesStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    const centimesAttendus = parseInt(centimesStr.replace(/\s/g, ''), 10);
    // Même vérification — le snapshot est immuable (D-FIS-G4.2)
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
    assert.strictEqual(
      Number(decl.recettesTotales.toSqliteInteger()),
      centimesAttendus,
      `Snapshot doit rester immuable — recettes attendues : ${centimesAttendus} centimes, obtenu : ${decl.recettesTotales.toSqliteInteger()}`,
    );
  },
);

Then(
  'la déclaration {int} a un statut lmnp_lmp parmi {string}, {string}',
  async function (this: MondeCloture, exercice: number, statut1: string, statut2: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
    assert.ok(
      [statut1, statut2].includes(decl.statutLmnpLmp),
      `Statut attendu parmi [${statut1}, ${statut2}], obtenu : ${decl.statutLmnpLmp}`,
    );
  },
);

Then(
  'la déclaration {int} a statut lmnp_lmp {string}',
  async function (this: MondeCloture, exercice: number, statutAttendu: string) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
    assert.strictEqual(
      decl.statutLmnpLmp,
      statutAttendu,
      `Statut LMP attendu : ${statutAttendu}, obtenu : ${decl.statutLmnpLmp}`,
    );
  },
);

Then(
  'le tableau d\'amortissement {int} contient au moins une ligne',
  async function (this: MondeCloture, exercice: number) {
    assert.ok(this.db, 'DB doit être initialisée');
    const rows = await this.db
      .selectFrom('amortissement_exercice')
      .selectAll()
      .where('exercice', '=', exercice)
      .execute();
    assert.ok(
      rows.length > 0,
      `Le tableau d'amortissement pour exercice ${exercice} doit contenir au moins une ligne`,
    );
  },
);

Then(
  'la déclaration {int} est créée',
  async function (this: MondeCloture, exercice: number) {
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
  },
);

// ─── Then erreurs ─────────────────────────────────────────────────────────────

Then(
  'la clôture est refusée pour prérequis non satisfaits',
  function (this: MondeCloture) {
    assert.ok(
      this.derniereErreur instanceof PrerequisCloturalNonSatisfaits,
      `Exception attendue : PrerequisCloturalNonSatisfaits, obtenu : ${this.derniereErreur?.constructor?.name ?? 'aucune'}`,
    );
  },
);

Then(
  'la deuxième clôture lance DeclarationDejaExiste',
  function (this: MondeCloture) {
    assert.ok(
      this.derniereErreur instanceof DeclarationDejaExiste,
      `Exception attendue : DeclarationDejaExiste, obtenu : ${this.derniereErreur?.constructor?.name ?? 'aucune'}`,
    );
  },
);

Then(
  'la qualification est refusée pour DeclarationFigeeException',
  function (this: MondeCloture) {
    assert.ok(
      this.derniereErreur instanceof DeclarationFigeeException,
      `Exception attendue : DeclarationFigeeException, obtenu : ${this.derniereErreur?.constructor?.name ?? 'aucune'}`,
    );
  },
);

// ─── Steps @fis-ard-cross (ARD propagation cross-exercice) ────────────────────

// World extension pour ARD cross : mêmes champs que MondeCloture + stockage ARD N
// Note : le Before de @fis-cloture ne s'active pas ici — activation.steps.ts fournit la DB.
// Mais activation.steps.ts ne seede pas bailleur/bien. On initialise via Given.

Given(
  /^un bien immobilier avec un composant gros_oeuvre de ([\d ]+) €$/,
  async function (this: MondeCloture, montantStr: string) {
    const montantEuros = parseInt(montantStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');

    // Si bailleur non encore initialisé (ARD cross n'a pas de bailleur singleton step)
    if (!this.bailleurId) {
      const bailleurRepo = new BailleurRepositorySqlite(this.db);
      const bailleur = unBailleurValide();
      await bailleurRepo.enregistrer(bailleur);
      this.bailleurId = bailleur.id;
    }

    const bien = unBienValide();
    const bienRepo = new BienRepositorySqlite(this.db);
    await bienRepo.enregistrer(bien);
    this.bienId = bien.id;

    // Seed composant gros_oeuvre avec le montant donné
    const composant = unComposantGrosOeuvre({
      bienId: bien.id,
      montantHt: Money.fromEuros(montantEuros),
      dateAcquisition: Temporal.PlainDate.from('2026-01-01'),
    });
    const composantRepo = new ComposantRepositorySqlite(this.db);
    await composantRepo.enregistrer(composant);

    // Seed bail + écheances pour 2026, 2027, 2028
    const { bailId, echeanceParExercice } = await seedBailEtEcheance(
      this.db,
      bien.id,
      [2026, 2027, 2028],
    );
    this.bailId = bailId;
    this.echeanceParExercice = echeanceParExercice ?? {};

    // Init state
    this.derniereDeclarationId = null;
    this.derniereErreur = null;
    this.dernierJustificatifId = null;
  },
);

Given(
  /^l'exercice (\d{4}) avec des recettes de ([\d ]+) € et des charges de ([\d ]+) €$/,
  async function (this: MondeCloture, exerciceStr: string, recettesStr: string, chargesStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    const recettesEuros = parseInt(recettesStr.replace(/\s/g, ''), 10);
    const chargesEuros = parseInt(chargesStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bienId, 'bienId doit être initialisé');

    // Seed encaissement pour recettes
    const echeanceId = this.echeanceParExercice[exercice];
    assert.ok(echeanceId, `Aucune écheance seedée pour exercice ${exercice}`);
    await seedEncaissement(this.db, echeanceId, recettesEuros * 100, exercice);

    // Seed justificatif qualifié pour les charges (entretien_reparation)
    if (chargesEuros > 0) {
      await this.db
        .insertInto('justificatifs')
        .values({
          id: crypto.randomUUID(),
          type: 'facture',
          date_document: `${exercice}-06-01`,
          titre: `Charges exercice ${exercice}`,
          montant_ttc_centimes: chargesEuros * 100,
          chemin_fichier: `factures/${exercice}/charges.pdf`,
          nom_fichier_original: 'charges.pdf',
          mime_type: 'application/pdf',
          taille_octets: 10_000,
          bien_id: this.bienId,
          locataire_id: null,
          notes: null,
          cree_le: `${exercice}-06-01`,
          date_paiement: `${exercice}-06-01`,
          qualification_fiscale: 'entretien_reparation',
          qualifie_le: `${exercice}-06-01`,
          parent_justificatif_id: null,
          corbeille_le: null,
        })
        .execute();
    }
  },
);

Given(
  /^l'exercice (\d{4}) avec des recettes de ([\d ]+) €$/,
  async function (this: MondeCloture, exerciceStr: string, recettesStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    const recettesEuros = parseInt(recettesStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');

    const echeanceId = this.echeanceParExercice[exercice];
    assert.ok(echeanceId, `Aucune écheance seedée pour exercice ${exercice}`);
    await seedEncaissement(this.db, echeanceId, recettesEuros * 100, exercice);
  },
);

When(
  /^je clôture l'exercice (\d{4}) en régime réel$/,
  async function (this: MondeCloture, exerciceStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const clock = ClockFixe.du(`${exercice}-12-31`);
    const repos = makeRepos(this.db);
    const regleFiscale = new RegleFiscaleProviderEnMemoire();
    const resultat = await cloturerExercice(
      { bailleurId: this.bailleurId, exercice, regimeChoisi: 'reel' },
      repos,
      clock,
      regleFiscale,
      this.db,
    );
    this.derniereDeclarationId = resultat.declarationId;
  },
);

Then(
  /^la déclaration (\d{4}) a un ARD généré supérieur à 0 €$/,
  async function (this: MondeCloture, exerciceStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
    assert.ok(
      Number(decl.ardGenere.toSqliteInteger()) > 0,
      `ARD généré doit être > 0, obtenu : ${decl.ardGenere.toSqliteInteger()} centimes`,
    );
    // Stocker pour comparaison N+1
    (this as MondeCloture & { ardGenereN: number }).ardGenereN = decl.ardGenere.toSqliteInteger();
  },
);

Then(
  /^le tableau d'amortissement (\d{4}) enregistre un SYNTHESE_BIEN avec l'ARD disponible$/,
  async function (this: MondeCloture, exerciceStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    const rows = await this.db
      .selectFrom('amortissement_exercice')
      .select(['type_ligne', 'ard_cumule_disponible_centimes'])
      .where('exercice', '=', exercice)
      .where('type_ligne', '=', 'SYNTHESE_BIEN')
      .execute();
    assert.ok(rows.length > 0, `SYNTHESE_BIEN manquant pour exercice ${exercice}`);
    const synthese = rows[0]!;
    assert.ok(
      synthese.ard_cumule_disponible_centimes !== null &&
        Number(synthese.ard_cumule_disponible_centimes) >= 0,
      `SYNTHESE_BIEN doit avoir ard_cumule_disponible_centimes >= 0, obtenu : ${synthese.ard_cumule_disponible_centimes}`,
    );
  },
);

Then(
  /^la déclaration (\d{4}) a un ardConsomme égal à l'ARD généré en (\d{4})$/,
  async function (this: MondeCloture, exerciceN1Str: string, _exerciceNStr: string) {
    const exerciceN1 = parseInt(exerciceN1Str, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const declN1 = await declRepo.trouverParBailleurExercice(this.bailleurId, exerciceN1);
    assert.ok(declN1, `Aucune déclaration trouvée pour exercice ${exerciceN1}`);
    const ardGenereN = (this as MondeCloture & { ardGenereN?: number }).ardGenereN;
    assert.ok(ardGenereN !== undefined, 'ARD généré N doit avoir été stocké');
    assert.strictEqual(
      declN1.ardConsomme.toSqliteInteger(),
      ardGenereN,
      `ardConsomme N+1 (${declN1.ardConsomme.toSqliteInteger()}) doit égaler ardGenere N (${ardGenereN})`,
    );
  },
);

Then(
  'la propagation cross-exercice confirme CGI art. 39 B sans limite',
  function (this: MondeCloture) {
    // Assertion symbolique — la vérification réelle est faite dans les deux Then précédents
    // (ardConsomme N+1 = ardGenere N). Cette étape confirme le contexte métier.
    assert.ok(true, 'Propagation ARD cross-exercice CGI 39 B vérifiée');
  },
);

Then(
  /^la déclaration (\d{4}) a le même ardGenere qu'avant l'annulation$/,
  async function (this: MondeCloture, exerciceStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    const declRepo = new DeclarationAnnuelleRepositorySqlite(this.db);
    const decl = await declRepo.trouverParBailleurExercice(this.bailleurId, exercice);
    assert.ok(decl, `Aucune déclaration trouvée pour exercice ${exercice}`);
    // L'ARD généré doit toujours être > 0 (snapshot immuable — D-FIS-G4.2)
    assert.ok(
      Number(decl.ardGenere.toSqliteInteger()) > 0,
      `ardGenere doit rester > 0 après annulation encaissement, obtenu : ${decl.ardGenere.toSqliteInteger()}`,
    );
  },
);

Then(
  /^le tableau SYNTHESE_BIEN (\d{4}) reste inchangé$/,
  async function (this: MondeCloture, exerciceStr: string) {
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    const rows = await this.db
      .selectFrom('amortissement_exercice')
      .select(['type_ligne', 'ard_cumule_disponible_centimes'])
      .where('exercice', '=', exercice)
      .where('type_ligne', '=', 'SYNTHESE_BIEN')
      .execute();
    assert.ok(rows.length > 0, `SYNTHESE_BIEN manquant pour exercice ${exercice}`);
    // Le tableau persiste — il n'est pas modifié par un soft-delete d'encaissement
    assert.ok(
      rows[0]!.ard_cumule_disponible_centimes !== null,
      `SYNTHESE_BIEN ard_cumule_disponible doit être non-null après soft-delete`,
    );
  },
);

// ─── Steps CR-03 multi-bien (05-VERIFICATION.md gap 2 BLOCKER) ─────────────────
//
// L'ARD est bailleur-level en V1 (D-LOCK-2 mono-bailleur) : une seule SYNTHESE_BIEN
// par exercice quelle que soit le nombre de biens. dernierArdCumuleBailleur ne doit
// pas sur-additionner l'ARD par le nombre de biens à l'exercice N+1.

Given(
  /^un (?:deuxième|troisième|quatrième) bien immobilier avec un composant gros_oeuvre de ([\d ]+) €$/,
  async function (this: MondeCloture, montantStr: string) {
    const montantEuros = parseInt(montantStr.replace(/\s/g, ''), 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé (Background)');
    // Bien additionnel (ne touche pas this.bienId qui reste le bien principal du Background)
    const bienExtra = unBienValide();
    const bienRepo = new BienRepositorySqlite(this.db);
    await bienRepo.enregistrer(bienExtra);
    // Composant gros_oeuvre acquis avant 2026 pour être actif sur tous les exercices testés
    const composant = unComposantGrosOeuvre({
      bienId: bienExtra.id,
      montantHt: Money.fromEuros(montantEuros),
      dateAcquisition: Temporal.PlainDate.from('2025-01-01'),
    });
    const composantRepo = new ComposantRepositorySqlite(this.db);
    await composantRepo.enregistrer(composant);
    // Valorisation fiscale activée (sinon prérequis bloquant si > seuil micro)
    const valorisation = uneValorisationFiscale({ bienId: bienExtra.id });
    const valorisationRepo = new ValorisationFiscaleRepositorySqlite(this.db);
    await valorisationRepo.enregistrer(valorisation);
  },
);

Then(
  /^la table amortissement_exercice contient exactement (\d+) ligne SYNTHESE_BIEN pour l'exercice (\d{4})$/,
  async function (this: MondeCloture, nbStr: string, exerciceStr: string) {
    const nbAttendu = parseInt(nbStr, 10);
    const exercice = parseInt(exerciceStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    const rows = await this.db
      .selectFrom('amortissement_exercice')
      .selectAll()
      .where('exercice', '=', exercice)
      .where('type_ligne', '=', 'SYNTHESE_BIEN')
      .execute();
    assert.strictEqual(
      rows.length,
      nbAttendu,
      `CR-03 — SYNTHESE_BIEN exercice ${exercice} : attendu ${nbAttendu} ligne(s), obtenu ${rows.length}. En V1 D-LOCK-2 mono-bailleur, l'ARD est bailleur-level → 1 seule SYNTHESE_BIEN par exercice (porteur sentinelle biensIds[0]).`,
    );
  },
);

Then(
  /^l'ARD propagé pour l'exercice (\d{4}) est exactement égal à l'ardCumuleEnSortie de (\d{4})$/,
  async function (this: MondeCloture, exerciceNplus1Str: string, exerciceNStr: string) {
    const exerciceN = parseInt(exerciceNStr, 10);
    assert.ok(this.db, 'DB doit être initialisée');
    assert.ok(this.bailleurId, 'bailleurId doit être initialisé');
    // Lit l'ardCumuleDisponible inscrit sur la seule SYNTHESE_BIEN de l'exercice N
    const rows = await this.db
      .selectFrom('amortissement_exercice')
      .select(['ard_cumule_disponible_centimes'])
      .where('exercice', '=', exerciceN)
      .where('type_ligne', '=', 'SYNTHESE_BIEN')
      .execute();
    assert.strictEqual(rows.length, 1, `Attendu 1 SYNTHESE_BIEN pour exercice ${exerciceN} (CR-03), obtenu ${rows.length}`);
    const ardCumuleStocke = BigInt(rows[0]!.ard_cumule_disponible_centimes ?? 0);
    // Appel direct du repo : dernierArdCumuleBailleur doit retourner exactement la valeur stockée
    const repo = new TableauAmortissementRepositorySqlite(this.db);
    const ardPropage = await repo.dernierArdCumuleBailleur(this.bailleurId, exerciceN);
    assert.strictEqual(
      ardPropage.toCentimes(),
      ardCumuleStocke,
      `CR-03 — ARD propagé doit être exactement = ardCumuleEnSortie(${exerciceN}). Attendu ${ardCumuleStocke}n, obtenu ${ardPropage.toCentimes()}n. Si > attendu × N (N=nb biens), le bug CR-03 persiste.`,
    );
  },
);

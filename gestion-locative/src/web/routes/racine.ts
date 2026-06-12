/**
 * Route racine GET / — dashboard principal (Phase 7 / DAS-01 / D-DASH-01..04).
 *
 * Logique de routage (D-DASH-01) :
 *   - estPremierLancement === true → redirect /wizard/bien (KPI Activation Phase 1 préservé)
 *   - sinon → render pages/dashboard/accueil.ejs avec 8 locals de composition
 *
 * Calcul à la demande via opts.clock.aujourdhui() — jamais new Date() ni Temporal.Now (D-AL-03 / D-CFE6.5).
 * Route en LECTURE PURE — aucune mutation de domaine, pas de session flash.
 * Erreurs non prévues remontent au setErrorHandler global de main.ts.
 *
 * 4 sections (D-DASH-02) :
 *   S2 Alertes critiques : calculerToutesAlertes().filter(j<=7), top 5, tri ASC
 *   S3 Impayés           : listerImpayes() en retard, top 5, tri joursDeRetard DESC
 *   S4 Actions du jour   : relances dues + alertes IRL J-30..J-0 (redondance intentionnelle D-DASH-02 §3)
 *   S5 Échéances à venir : listerNonPayees() dans la fenêtre [today, mois courant + 1 mois], top 5
 */

import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { RelanceRepository } from '../../domain/encaissements/relance-repository.js';
import type { DeclarationCfeRepository } from '../../domain/fiscalite/cfe/declaration-cfe-repository.js';
import type { NiveauRelance } from '../../domain/encaissements/relance.js';
import { estPremierLancement } from '../../infrastructure/lifecycle/premier-lancement.js';
import { calculerToutesAlertes } from '../../application/dashboard/calculer-toutes-alertes.js';
import { listerImpayes } from '../../domain/encaissements/impaye.js';
import { calculerRelanceDisponible } from '../../application/encaissements/calculer-relance-disponible.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    db: Kysely<DB>;
    cfeRepo: DeclarationCfeRepository;
    bienRepo: BienRepository;
    bailRepo: BailRepository;
    bailIndexationRepo: BailIndexationRepository;
    echeanceLoyerRepo: EcheanceLoyerRepository;
    encaissementRepo: EncaissementRepository;
    locataireRepo: LocataireRepository;
    relanceRepo: RelanceRepository;
    clock: Clock;
  },
): Promise<void> {
  app.get('/', async (_req, reply) => {
    // D-DASH-01 : branche activation préservée
    const premier = await estPremierLancement(opts.db);
    if (premier) {
      return reply.redirect('/wizard/bien');
    }

    const today = opts.clock.aujourdhui();

    // ── S2 Alertes critiques ──────────────────────────────────────────────────
    const toutesAlertes = await calculerToutesAlertes({
      cfeRepo: opts.cfeRepo,
      bienRepo: opts.bienRepo,
      bailRepo: opts.bailRepo,
      bailIndexationRepo: opts.bailIndexationRepo,
      clock: opts.clock,
    });
    const alertesCritiquesAll = toutesAlertes.filter((a) => a.joursRestants <= 7);
    const alertesCritiques = alertesCritiquesAll.slice(0, 5);
    const alertesCritiquesTotal = alertesCritiquesAll.length;

    // ── S3 Impayés ────────────────────────────────────────────────────────────
    const tousImpayes = (
      await listerImpayes(
        {},
        {
          echeanceLoyerRepo: opts.echeanceLoyerRepo,
          encaissementRepo: opts.encaissementRepo,
          bailRepo: opts.bailRepo,
          locataireRepo: opts.locataireRepo,
        },
        opts.clock,
      )
    )
      .filter((i) => i.estEnRetard)
      .sort((a, b) => b.joursDeRetard - a.joursDeRetard);
    const impayes = tousImpayes.slice(0, 5);
    const impayesTotal = tousImpayes.length;

    // ── S5 Échéances loyer à venir ────────────────────────────────────────────
    const finFenetre = today.add({ months: 2 }).with({ day: 1 }).subtract({ days: 1 });
    const nonPayees = await opts.echeanceLoyerRepo.listerNonPayees();
    const echeancesAVenirAll = nonPayees
      .filter(
        (e) =>
          Temporal.PlainDate.compare(e.jourEcheanceAttendue, today) >= 0 &&
          Temporal.PlainDate.compare(e.jourEcheanceAttendue, finFenetre) <= 0,
      )
      .sort((a, b) =>
        Temporal.PlainDate.compare(a.jourEcheanceAttendue, b.jourEcheanceAttendue),
      );
    const echeancesAVenir = echeancesAVenirAll.slice(0, 5);
    const echeancesAVenirTotal = echeancesAVenirAll.length;

    // ── S4 Actions du jour ────────────────────────────────────────────────────
    // Source 1 : relances dues — pour chaque impayé ouvert, vérifier si une relance est disponible
    type ActionRelance = {
      type: 'relance';
      niveau: NiveauRelance;
      echeanceId: string;
      libellePeriode: string;
      nomLocataire: string;
    };
    type ActionIrl = {
      type: 'irl';
      bailId: string;
      joursRestants: number;
      nomLocataire: string;
    };
    type Action = ActionRelance | ActionIrl;

    const actionsJourAll: Action[] = [];

    for (const impaye of tousImpayes) {
      const echeance = await opts.echeanceLoyerRepo.trouverParId(impaye.echeanceId);
      if (!echeance) continue;
      const relances = await opts.relanceRepo.listerParEcheance(impaye.echeanceId);
      const niveau = calculerRelanceDisponible(echeance, relances, today);
      if (niveau !== null) {
        const libellePeriode = `${impaye.periodeDebut.year}-${String(impaye.periodeDebut.month).padStart(2, '0')}`;
        actionsJourAll.push({
          type: 'relance',
          niveau,
          echeanceId: impaye.echeanceId as string,
          libellePeriode,
          nomLocataire: impaye.locataireNomComplet,
        });
      }
    }

    // Source 2 : alertes IRL J-30..J-0 (redondance intentionnelle D-DASH-02 §3)
    for (const alerte of toutesAlertes) {
      if (alerte.type === 'irl' && alerte.joursRestants >= 0 && alerte.joursRestants <= 30) {
        actionsJourAll.push({
          type: 'irl',
          bailId: alerte.source.refId,
          joursRestants: alerte.joursRestants,
          nomLocataire: String(alerte.source.extra?.['nomLocataire'] ?? ''),
        });
      }
    }

    // Tri : relances d'abord par niveau DESC (niveau 3 = le plus urgent), puis IRL par joursRestants ASC
    actionsJourAll.sort((a, b) => {
      if (a.type === 'relance' && b.type === 'relance') return b.niveau - a.niveau;
      if (a.type === 'relance') return -1;
      if (b.type === 'relance') return 1;
      return a.joursRestants - b.joursRestants;
    });

    const actionsJour = actionsJourAll.slice(0, 5);
    const actionsJourTotal = actionsJourAll.length;

    // ── État global zen ───────────────────────────────────────────────────────
    const etatGlobal =
      alertesCritiquesTotal === 0 &&
      impayesTotal === 0 &&
      actionsJourTotal === 0 &&
      echeancesAVenirTotal === 0
        ? 'a_jour'
        : 'avec_alertes';

    return reply.view('pages/dashboard/accueil.ejs', {
      titre: 'Tableau de bord',
      navActive: 'dashboard',
      alertesCritiques,
      alertesCritiquesTotal,
      impayes,
      impayesTotal,
      actionsJour,
      actionsJourTotal,
      echeancesAVenir,
      echeancesAVenirTotal,
      etatGlobal,
    });
  });
}

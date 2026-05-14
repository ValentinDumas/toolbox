import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { calculerImpaye, listerImpayes } from '../../../src/domain/encaissements/impaye.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import type { BailId, EcheanceLoyerId, LocataireId } from '../../../src/domain/_shared/identifiants.js';
import type { Locataire } from '../../../src/domain/locatif/locataire.js';
import type { Bail } from '../../../src/domain/locatif/bail.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function creerEcheance(overrides: {
  id?: string;
  bailId?: BailId;
  statut?: 'en_attente' | 'partiellement_payee' | 'payee' | 'annulee';
  jourEcheanceAttendue?: string;
  periodeDebut?: string;
}): EcheanceLoyer {
  const periodeDebut = Temporal.PlainDate.from(overrides.periodeDebut ?? '2026-05-01');
  const periodeFin = periodeDebut.with({ day: periodeDebut.daysInMonth });
  const loyerHc = Money.fromEuros(700);
  const montantCharges = Money.zero();
  return EcheanceLoyer.creer({
    id: overrides.id as EcheanceLoyerId | undefined,
    bailId: overrides.bailId ?? (crypto.randomUUID() as BailId),
    periodeDebut,
    periodeFin,
    jourEcheanceAttendue: Temporal.PlainDate.from(overrides.jourEcheanceAttendue ?? '2026-05-05'),
    loyerHc,
    montantCharges,
    modeCharges: 'forfait',
    total: loyerHc.additionner(montantCharges),
    statut: overrides.statut ?? 'en_attente',
    annuleLe: null,
  });
}

function creerLocataire(overrides: { id?: string } = {}): Locataire {
  return {
    id: (overrides.id ?? crypto.randomUUID()) as LocataireId,
    nom: 'Dupont',
    prenom: 'Marie',
    dateNaissance: Temporal.PlainDate.from('1985-06-15'),
    lieuNaissance: { commune: 'Paris', pays: 'France' },
    nationalite: 'française',
    email: 'marie@example.fr',
    telephone: '0123456789',
    adresseActuelle: { rue: '1 rue Test', code_postal: '75001', ville: 'Paris' },
  } as unknown as Locataire;
}

function creerBail(overrides: { id?: string; locataireId?: LocataireId } = {}): Bail {
  return {
    id: (overrides.id ?? crypto.randomUUID()) as BailId,
    locataireId: overrides.locataireId ?? (crypto.randomUUID() as LocataireId),
  } as unknown as Bail;
}

// ─── Tests calculerImpaye (T1–T7) ─────────────────────────────────────────────

describe('calculerImpaye', () => {
  const today = Temporal.PlainDate.from('2026-05-10');

  it('T1: en_attente, today < echeance → resteDu=700€, joursDeRetard=0, estEnRetard=false', () => {
    const echeance = creerEcheance({ statut: 'en_attente', jourEcheanceAttendue: '2026-05-15' });
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const sommePaiee = Money.zero();

    const impaye = calculerImpaye(echeance, sommePaiee, locataire, bail, today);

    expect(impaye.resteDu.toCentimes()).toBe(Money.fromEuros(700).toCentimes());
    expect(impaye.joursDeRetard).toBe(0);
    expect(impaye.estEnRetard).toBe(false);
  });

  it('T2: partiellement_payee, today < echeance, sommePaiee=300€ → resteDu=400€, joursDeRetard=0, estEnRetard=false', () => {
    const echeance = creerEcheance({ statut: 'partiellement_payee', jourEcheanceAttendue: '2026-05-15' });
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const sommePaiee = Money.fromEuros(300);

    const impaye = calculerImpaye(echeance, sommePaiee, locataire, bail, today);

    expect(impaye.resteDu.toCentimes()).toBe(Money.fromEuros(400).toCentimes());
    expect(impaye.joursDeRetard).toBe(0);
    expect(impaye.estEnRetard).toBe(false);
  });

  it('T3: en_attente, today > echeance de 5 jours → resteDu=700€, joursDeRetard=5, estEnRetard=true', () => {
    const echeance = creerEcheance({ statut: 'en_attente', jourEcheanceAttendue: '2026-05-05' });
    const today5Later = Temporal.PlainDate.from('2026-05-10');
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const sommePaiee = Money.zero();

    const impaye = calculerImpaye(echeance, sommePaiee, locataire, bail, today5Later);

    expect(impaye.resteDu.toCentimes()).toBe(Money.fromEuros(700).toCentimes());
    expect(impaye.joursDeRetard).toBe(5);
    expect(impaye.estEnRetard).toBe(true);
  });

  it('T4: partiellement_payee, sommePaiee=300€, today > echeance de 35 jours → joursDeRetard=35, estEnRetard=true', () => {
    const echeance = creerEcheance({ statut: 'partiellement_payee', jourEcheanceAttendue: '2026-04-05' });
    const today35 = Temporal.PlainDate.from('2026-05-10');
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const sommePaiee = Money.fromEuros(300);

    const impaye = calculerImpaye(echeance, sommePaiee, locataire, bail, today35);

    expect(impaye.joursDeRetard).toBe(35);
    expect(impaye.estEnRetard).toBe(true);
  });

  it('T5: statut=payee → estEnRetard=false même si today > echeance', () => {
    const echeance = creerEcheance({ statut: 'payee', jourEcheanceAttendue: '2026-04-01' });
    const todayLate = Temporal.PlainDate.from('2026-05-10');
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const sommePaiee = Money.fromEuros(700);

    const impaye = calculerImpaye(echeance, sommePaiee, locataire, bail, todayLate);

    expect(impaye.estEnRetard).toBe(false);
  });

  it('T6: statut=annulee → estEnRetard=false', () => {
    const echeance = creerEcheance({ statut: 'annulee', jourEcheanceAttendue: '2026-04-01' });
    const todayLate = Temporal.PlainDate.from('2026-05-10');
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const sommePaiee = Money.zero();

    const impaye = calculerImpaye(echeance, sommePaiee, locataire, bail, todayLate);

    expect(impaye.estEnRetard).toBe(false);
  });

  it('T7: sommePaiee > total (sur-paiement) → resteDu = Money.zero()', () => {
    const echeance = creerEcheance({ statut: 'payee', jourEcheanceAttendue: '2026-05-05' });
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const sommePaiee = Money.fromEuros(750); // > 700€

    const impaye = calculerImpaye(echeance, sommePaiee, locataire, bail, today);

    expect(impaye.resteDu.toCentimes()).toBe(Money.zero().toCentimes());
  });
});

// ─── Tests listerImpayes (T8–T9) ──────────────────────────────────────────────

describe('listerImpayes', () => {
  function creerRepos(opts: {
    echeancesNonPayees: EcheanceLoyer[];
    bails: Record<string, Bail>;
    locataires: Record<string, Locataire>;
    sommesPaiees?: Record<string, Money>;
  }) {
    const echeanceLoyerRepo = {
      listerNonPayees: async () => opts.echeancesNonPayees,
    };

    const encaissementRepo = {
      sommePaieeParEcheance: async (id: string) =>
        opts.sommesPaiees?.[id] ?? Money.zero(),
    };

    const bailRepo = {
      trouverParId: async (id: BailId) => opts.bails[id] ?? null,
    };

    const locataireRepo = {
      trouverParId: async (id: LocataireId) => opts.locataires[id] ?? null,
    };

    return { echeanceLoyerRepo, encaissementRepo, bailRepo, locataireRepo };
  }

  it('T8: 3 echeances (en_attente, partiellement_payee, payee) — listerNonPayees retourne les 2 premières, triées par jour_echeance_attendue ASC', async () => {
    const locataire = creerLocataire();
    const bail = creerBail({ locataireId: locataire.id });
    const clock = ClockFixe.du('2026-05-15');

    const e1 = creerEcheance({
      statut: 'en_attente',
      jourEcheanceAttendue: '2026-04-01',
      bailId: bail.id as BailId,
    });
    const e2 = creerEcheance({
      statut: 'partiellement_payee',
      jourEcheanceAttendue: '2026-03-01',
      bailId: bail.id as BailId,
    });
    // payee — filtered out by listerNonPayees (our stub returns only en_attente + partiellement_payee)

    const repos = creerRepos({
      echeancesNonPayees: [e1, e2], // stub: déjà filtrée par le repo
      bails: { [bail.id]: bail },
      locataires: { [locataire.id]: locataire },
    });

    const result = await listerImpayes({}, repos as never, clock);

    expect(result).toHaveLength(2);
    // Triés par jourEcheanceAttendue ASC — e2 (mars) avant e1 (avril)
    expect(result[0]!.echeanceId).toBe(e2.id);
    expect(result[1]!.echeanceId).toBe(e1.id);
  });

  it('T9: filtre locataireId — retourne seulement les impayes du locataire filtré', async () => {
    const locataire1 = creerLocataire();
    const locataire2 = creerLocataire();
    const bail1 = creerBail({ locataireId: locataire1.id });
    const bail2 = creerBail({ locataireId: locataire2.id });
    const clock = ClockFixe.du('2026-05-15');

    const e1 = creerEcheance({ statut: 'en_attente', bailId: bail1.id as BailId });
    const e2 = creerEcheance({ statut: 'en_attente', bailId: bail2.id as BailId });

    const repos = creerRepos({
      echeancesNonPayees: [e1, e2],
      bails: {
        [bail1.id]: bail1,
        [bail2.id]: bail2,
      },
      locataires: {
        [locataire1.id]: locataire1,
        [locataire2.id]: locataire2,
      },
    });

    const result = await listerImpayes(
      { locataireId: locataire1.id as LocataireId },
      repos as never,
      clock,
    );

    expect(result).toHaveLength(1);
    expect(result[0]!.locataireId).toBe(locataire1.id);
  });
});

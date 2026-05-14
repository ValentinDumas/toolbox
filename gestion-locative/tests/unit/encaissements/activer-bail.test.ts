import { describe, it, expect, beforeEach } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Money } from '../../../src/domain/_shared/money.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { unBailValide } from '../../_builders/locatif.js';
import type { BailId } from '../../../src/domain/_shared/identifiants.js';

// NOTE: activerBail n'existe pas encore — ces tests sont RED intentionnellement
import { activerBail } from '../../../src/application/encaissements/activer-bail.js';
import type { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';

// Stubs pour les repositories
function creerBailRepoStub(bail: ReturnType<typeof unBailValide>) {
  const bails = new Map([[bail.id, bail]]);
  return {
    trouverParId: async (id: BailId) => bails.get(id) ?? null,
    enregistrer: async (b: ReturnType<typeof unBailValide>) => { bails.set(b.id, b); },
    listerTous: async () => Array.from(bails.values()),
    listerParLocataire: async () => [],
    supprimer: async () => {},
  };
}

function creerEcheanceLoyerRepoStub() {
  const echeances: EcheanceLoyer[] = [];
  return {
    enregistrer: async (e: EcheanceLoyer) => { echeances.push(e); },
    enregistrerBatch: async (es: EcheanceLoyer[]) => { echeances.push(...es); },
    trouverParId: async (id: string) => echeances.find((e) => e.id === id) ?? null,
    listerParBail: async (bailId: string) => echeances.filter((e) => e.bailId === bailId),
    mettreAJourStatut: async () => {},
    listerNonPayees: async () => echeances.filter((e) => e.statut !== 'payee'),
    supprimerLot: async () => {},
  };
}

describe('activerBail', () => {
  const clock = ClockFixe.du('2026-05-01');

  // Test 12 : bail 12 mois commençant le 1er → 12 échéances mois plein
  it('actifDepuis 2026-05-01 (1er du mois), dureeMois=12 → 12 échéances créées', async () => {
    const loyerHc = Money.fromEuros(700);
    const montantCharges = Money.fromEuros(80);
    const bail = unBailValide({
      loyerHc,
      montantCharges,
      dureeMois: 12,
      dateDebut: Temporal.PlainDate.from('2026-05-01'),
    });
    const bailRepo = creerBailRepoStub(bail);
    const echeanceRepo = creerEcheanceLoyerRepoStub();

    const result = await activerBail(
      {
        bailId: bail.id,
        actifDepuis: Temporal.PlainDate.from('2026-05-01'),
        jourEcheance: 5,
      },
      bailRepo,
      echeanceRepo,
      clock,
    );

    expect(result.echeancesCreees).toBe(12);
    const echeances = await echeanceRepo.listerParBail(bail.id);
    expect(echeances).toHaveLength(12);

    // Toutes les échéances doivent avoir le loyer plein (actifDepuis = 1er du mois)
    const totalLoyerHc = echeances.reduce((sum, e) => sum + e.loyerHc.toCentimes(), 0n);
    expect(totalLoyerHc).toBe(loyerHc.toCentimes() * 12n);
  });

  // Test 13 : actifDepuis = '2026-05-15' → 1ère échéance prorata 17 jours
  it('actifDepuis 2026-05-15 (milieu de mois) → 1ère échéance prorata 17 jours sur 31', async () => {
    const loyerHc = Money.fromEuros(700);
    const montantCharges = Money.fromEuros(0);
    const bail = unBailValide({
      loyerHc,
      montantCharges,
      dureeMois: 12,
      dateDebut: Temporal.PlainDate.from('2026-05-15'),
    });
    const bailRepo = creerBailRepoStub(bail);
    const echeanceRepo = creerEcheanceLoyerRepoStub();

    const result = await activerBail(
      {
        bailId: bail.id,
        actifDepuis: Temporal.PlainDate.from('2026-05-15'),
        jourEcheance: 5,
      },
      bailRepo,
      echeanceRepo,
      clock,
    );

    expect(result.echeancesCreees).toBe(12);
    const echeances = await echeanceRepo.listerParBail(bail.id);
    expect(echeances).toHaveLength(12);

    // 1ère échéance prorata : 15→31 mai = 17 jours sur 31
    const premiere = echeances[0]!;
    const attendu = loyerHc.multiplyByFraction(17n, 31n);
    expect(premiere.loyerHc.toCentimes()).toBe(attendu.toCentimes());
  });

  // Test 13.bis : prorata première ET dernière échéance
  it('M6 prorata dernière : bail 2026-02-15 12mois → 12 échéances, 1ère + dernière en prorata', async () => {
    const loyerHc = Money.fromEuros(700);
    const montantCharges = Money.fromEuros(80);
    const bail = unBailValide({
      loyerHc,
      montantCharges,
      dureeMois: 12,
      dateDebut: Temporal.PlainDate.from('2026-02-15'),
    });
    const bailRepo = creerBailRepoStub(bail);
    const echeanceRepo = creerEcheanceLoyerRepoStub();

    const clockFev = ClockFixe.du('2026-02-15');
    const result = await activerBail(
      {
        bailId: bail.id,
        actifDepuis: Temporal.PlainDate.from('2026-02-15'),
        jourEcheance: 1,
      },
      bailRepo,
      echeanceRepo,
      clockFev,
    );

    expect(result.echeancesCreees).toBe(12);
    const echeances = await echeanceRepo.listerParBail(bail.id);
    expect(echeances).toHaveLength(12);

    // Fév 2026 a 28 jours ; 1ère échéance = 15→28 = 14 jours
    const premiere = echeances[0]!;
    const attenduPremier = loyerHc.multiplyByFraction(14n, 28n);
    expect(premiere.loyerHc.toCentimes()).toBe(attenduPremier.toCentimes());

    // 12e échéance = fév 2027 = 1→14 = 14 jours sur 28
    const derniere = echeances[11]!;
    const attenduDernier = loyerHc.multiplyByFraction(14n, 28n);
    expect(derniere.loyerHc.toCentimes()).toBe(attenduDernier.toCentimes());

    // 10 intermédiaires = mois pleins
    const intermediaires = echeances.slice(1, 11);
    expect(intermediaires).toHaveLength(10);

    // Invariant banker's rounding : prorata 1ère + 10 mois pleins + prorata dernière
    // = 14/28 + 10 + 14/28 = 11 équivalents mensuels
    // Tolérance ±1 centime pour banker's rounding sur les deux prorata
    const somme = echeances.reduce((sum, e) => sum + e.loyerHc.toCentimes(), 0n);
    const premierProrata = loyerHc.multiplyByFraction(14n, 28n).toCentimes();
    const dernierProrata = loyerHc.multiplyByFraction(14n, 28n).toCentimes();
    const dixMoisPleins = loyerHc.toCentimes() * 10n;
    const attenduTotal = premierProrata + dixMoisPleins + dernierProrata;
    const diff = somme - attenduTotal;
    expect(diff >= -1n && diff <= 1n).toBe(true);

    // Idem charges
    const sommeCharges = echeances.reduce((sum, e) => sum + e.montantCharges.toCentimes(), 0n);
    const premierProrataCharges = montantCharges.multiplyByFraction(14n, 28n).toCentimes();
    const dernierProrataCharges = montantCharges.multiplyByFraction(14n, 28n).toCentimes();
    const attenduTotalCharges = premierProrataCharges + montantCharges.toCentimes() * 10n + dernierProrataCharges;
    const diffCharges = sommeCharges - attenduTotalCharges;
    expect(diffCharges >= -1n && diffCharges <= 1n).toBe(true);
  });

  // Test 16.bis : variantes dureeMois 24 et 36
  it('actifDepuis 2026-02-15, dureeMois=24 → 24 échéances, prorata 1ère et 24ème', async () => {
    const loyerHc = Money.fromEuros(700);
    const montantCharges = Money.fromEuros(80);
    const bail = unBailValide({
      loyerHc,
      montantCharges,
      dureeMois: 24,
      dateDebut: Temporal.PlainDate.from('2026-02-15'),
    });
    const bailRepo = creerBailRepoStub(bail);
    const echeanceRepo = creerEcheanceLoyerRepoStub();

    const result = await activerBail(
      { bailId: bail.id, actifDepuis: Temporal.PlainDate.from('2026-02-15'), jourEcheance: 1 },
      bailRepo,
      echeanceRepo,
      ClockFixe.du('2026-02-15'),
    );

    expect(result.echeancesCreees).toBe(24);
    const echeances = await echeanceRepo.listerParBail(bail.id);
    expect(echeances).toHaveLength(24);

    const somme = echeances.reduce((sum, e) => sum + e.loyerHc.toCentimes(), 0n);
    // 2026-02-15, dureeMois=24:
    // - i=0 : 15→28 fév 2026 = 14j/28j prorata
    // - i=1..22 : 22 mois pleins (mars 2026 → déc 2027)
    // - i=23 : 1→14 fév 2028 = 14j/29j (2028 bissextile)
    // Note: fév 2028 a 29 jours (2028 est bissextile)
    const premierProrata = loyerHc.multiplyByFraction(14n, 28n).toCentimes();
    const dernierProrata = loyerHc.multiplyByFraction(14n, 29n).toCentimes(); // fév 2028 bissextile
    const moisPleins = loyerHc.toCentimes() * 22n;
    const attenduTotal = premierProrata + moisPleins + dernierProrata;
    const diff = somme - attenduTotal;
    expect(diff >= -1n && diff <= 1n).toBe(true);
  });

  // Test 14 : activation rétroactive > 2 ans → warning
  it("actifDepuis < today - 2 ans → warnings['Activation > 2 ans en arrière...']", async () => {
    const bail = unBailValide({ dureeMois: 36 });
    const bailRepo = creerBailRepoStub(bail);
    const echeanceRepo = creerEcheanceLoyerRepoStub();

    // clock = 2026-05-01, actifDepuis = 2023-01-01 = 3+ ans en arrière
    const result = await activerBail(
      {
        bailId: bail.id,
        actifDepuis: Temporal.PlainDate.from('2023-01-01'),
        jourEcheance: 1,
      },
      bailRepo,
      echeanceRepo,
      clock,
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/Activation r.trospective/);
    // Échéances quand même créées
    expect(result.echeancesCreees).toBe(36);
  });

  // Test 15 : actifDepuis futur lointain → ne throw pas
  it('actifDepuis > today + 5 ans → ne throw pas', async () => {
    const bail = unBailValide({ dureeMois: 12 });
    const bailRepo = creerBailRepoStub(bail);
    const echeanceRepo = creerEcheanceLoyerRepoStub();

    await expect(
      activerBail(
        {
          bailId: bail.id,
          actifDepuis: Temporal.PlainDate.from('2032-01-01'),
          jourEcheance: 1,
        },
        bailRepo,
        echeanceRepo,
        clock,
      ),
    ).resolves.toBeDefined();
  });
});

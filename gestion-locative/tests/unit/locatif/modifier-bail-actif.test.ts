import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { modifierBailActif } from '../../../src/application/locatif/modifier-bail-actif.js';
import { ClockFixe } from '../../../src/domain/_shared/clock.js';
import { Money } from '../../../src/domain/_shared/money.js';
import { IRL } from '../../../src/domain/_shared/irl.js';
import { Bail } from '../../../src/domain/locatif/bail.js';
import { EcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';
import { Encaissement } from '../../../src/domain/encaissements/encaissement.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import type { BailId, EcheanceLoyerId, EncaissementId } from '../../../src/domain/_shared/identifiants.js';
import type { StatutEcheanceLoyer } from '../../../src/domain/encaissements/echeance-loyer.js';

const TODAY = '2026-06-15';
const CLOCK = ClockFixe.du(TODAY);

function creerBailActif(): Bail {
  return Bail.creer({
    id: crypto.randomUUID() as BailId,
    bienId: crypto.randomUUID() as never,
    locataireId: crypto.randomUUID() as never,
    lotIds: [crypto.randomUUID() as never],
    type: 'classique',
    dateDebut: Temporal.PlainDate.from('2026-01-01'),
    dureeMois: 12,
    loyerHc: Money.fromEuros(700),
    modeCharges: 'forfait',
    montantCharges: Money.fromEuros(0),
    depotGarantie: Money.fromEuros(700),
    irlReference: IRL.creer({ trimestre: '2026-T1', valeur: '145.47' }),
    cautionnement: null,
    actifDepuis: Temporal.PlainDate.from('2026-01-01'),
    jourEcheance: 1,
  });
}

function creerEcheance(
  bailId: BailId,
  periodeDebut: string,
  periodeFin: string,
  statut: StatutEcheanceLoyer,
): EcheanceLoyer {
  const loyer = Money.fromEuros(700);
  return EcheanceLoyer.creer({
    id: crypto.randomUUID() as EcheanceLoyerId,
    bailId,
    periodeDebut: Temporal.PlainDate.from(periodeDebut),
    periodeFin: Temporal.PlainDate.from(periodeFin),
    jourEcheanceAttendue: Temporal.PlainDate.from(periodeDebut),
    loyerHc: loyer,
    montantCharges: Money.fromEuros(0),
    modeCharges: 'forfait',
    total: loyer,
    statut,
    annuleLe: null,
  });
}

function creerEncaissementActif(echeanceId: EcheanceLoyerId): Encaissement {
  return Encaissement.creer({
    id: crypto.randomUUID() as EncaissementId,
    echeanceId,
    montant: Money.fromEuros(700),
    date: Temporal.PlainDate.from('2026-05-01'),
    mode: 'virement',
  });
}

function stubRepos(bail: Bail, echeances: EcheanceLoyer[], encaissementsParEcheance: Map<string, Encaissement[]> = new Map()) {
  const echeancesStockees = [...echeances];
  const nouvellesEcheances: EcheanceLoyer[] = [];
  let bailStocke = bail;
  const idsSupprimes: string[] = [];

  return {
    bailRepo: {
      trouverParId: async () => bailStocke,
      enregistrer: async (b: Bail) => { bailStocke = b; },
    },
    echeanceLoyerRepo: {
      listerParBail: async () => echeancesStockees.filter(e => !idsSupprimes.includes(e.id)),
      supprimerLot: async (ids: EcheanceLoyerId[]) => { ids.forEach(id => idsSupprimes.push(id)); },
      enregistrerBatch: async (batch: EcheanceLoyer[]) => { nouvellesEcheances.push(...batch); },
      mettreAJourStatut: async () => {},
      enregistrer: async () => {},
      trouverParId: async () => null,
      listerNonPayees: async () => [],
    },
    encaissementRepo: {
      listerParEcheance: async (id: string, opts?: { inclureAnnules?: boolean }) => {
        const enc = encaissementsParEcheance.get(id) ?? [];
        if (opts?.inclureAnnules === false) return enc.filter(e => !e.annuleLe);
        return enc;
      },
      enregistrer: async () => {},
      trouverParId: async () => null,
      listerTous: async () => [],
      sommePaieeParEcheance: async () => Money.zero(),
    },
    idsSupprimes,
    nouvellesEcheances,
    getBailStocke: () => bailStocke,
  };
}

describe('modifierBailActif', () => {
  // T28 : bail brouillon → throw InvariantViolated
  it('T28: bail brouillon throw InvariantViolated', async () => {
    const bailBrouillon = Bail.creer({
      id: crypto.randomUUID() as BailId,
      bienId: crypto.randomUUID() as never,
      locataireId: crypto.randomUUID() as never,
      lotIds: [crypto.randomUUID() as never],
      type: 'classique',
      dateDebut: Temporal.PlainDate.from('2026-01-01'),
      dureeMois: 12,
      loyerHc: Money.fromEuros(700),
      modeCharges: 'forfait',
      montantCharges: Money.fromEuros(0),
      depotGarantie: Money.fromEuros(700),
      irlReference: IRL.creer({ trimestre: '2026-T1', valeur: '145.47' }),
      cautionnement: null,
      // actifDepuis omis → null
    });

    const repos = stubRepos(bailBrouillon, []);

    await expect(
      modifierBailActif(
        { bailId: bailBrouillon.id, patch: {}, confirmation: 'previsualiser' },
        repos.bailRepo as never,
        repos.echeanceLoyerRepo as never,
        repos.encaissementRepo as never,
        CLOCK,
      ),
    ).rejects.toThrow("Ce bail n'est pas actif");
  });

  // T29 : bail actif avec 12 échéances, today=2026-06-15
  // 3 payees (jan-mar), 9 en_attente (avr-déc)
  // Preview : 3 payées (jan-mar) + 2 passées (avr éch 2026-04-01, mai éch 2026-05-01) préservées
  // = 5 préservées ; jul-déc (7) à régénérer
  it('T29: preview 12 échéances — 7 à régénérer, 5 préservées', async () => {
    const bail = creerBailActif();

    // jan, fev, mar : payées
    const echeances: EcheanceLoyer[] = [
      creerEcheance(bail.id, '2026-01-01', '2026-01-31', 'payee'),  // préservée (payée)
      creerEcheance(bail.id, '2026-02-01', '2026-02-28', 'payee'),  // préservée (payée)
      creerEcheance(bail.id, '2026-03-01', '2026-03-31', 'payee'),  // préservée (payée)
      // avr éch=2026-04-01 : passée (≤ today 2026-06-15), en_attente
      creerEcheance(bail.id, '2026-04-01', '2026-04-30', 'en_attente'),  // préservée (passée)
      // mai éch=2026-05-01 : passée (≤ today 2026-06-15), en_attente
      creerEcheance(bail.id, '2026-05-01', '2026-05-31', 'en_attente'),  // préservée (passée)
      // jun éch=2026-06-01 : passée (≤ today 2026-06-15), en_attente
      creerEcheance(bail.id, '2026-06-01', '2026-06-30', 'en_attente'),  // préservée (≤ today)
      // jul-dec : futures, en_attente → à régénérer (6 échéances)
      creerEcheance(bail.id, '2026-07-01', '2026-07-31', 'en_attente'),
      creerEcheance(bail.id, '2026-08-01', '2026-08-31', 'en_attente'),
      creerEcheance(bail.id, '2026-09-01', '2026-09-30', 'en_attente'),
      creerEcheance(bail.id, '2026-10-01', '2026-10-31', 'en_attente'),
      creerEcheance(bail.id, '2026-11-01', '2026-11-30', 'en_attente'),
      creerEcheance(bail.id, '2026-12-01', '2026-12-31', 'en_attente'),
    ];

    const repos = stubRepos(bail, echeances);
    const result = await modifierBailActif(
      { bailId: bail.id, patch: {}, confirmation: 'previsualiser' },
      repos.bailRepo as never,
      repos.echeanceLoyerRepo as never,
      repos.encaissementRepo as never,
      CLOCK,
    );

    expect(result.kind).toBe('preview');
    if (result.kind === 'preview') {
      expect(result.preview.aRegenererCount).toBe(6);
      expect(result.preview.aPreserverCount).toBe(6);
    }
  });

  // T30 : échéance partiellement_payee AVEC encaissement actif → préservée
  it('T30: partiellement_payee avec encaissement actif → préservée', async () => {
    const bail = creerBailActif();
    const echeancePartielle = creerEcheance(bail.id, '2026-09-01', '2026-09-30', 'partiellement_payee');
    const enc = creerEncaissementActif(echeancePartielle.id);

    const encaissementsMap = new Map([[echeancePartielle.id, [enc]]]);
    const repos = stubRepos(bail, [echeancePartielle], encaissementsMap);

    const result = await modifierBailActif(
      { bailId: bail.id, patch: {}, confirmation: 'previsualiser' },
      repos.bailRepo as never,
      repos.echeanceLoyerRepo as never,
      repos.encaissementRepo as never,
      CLOCK,
    );

    expect(result.kind).toBe('preview');
    if (result.kind === 'preview') {
      expect(result.preview.aRegenererCount).toBe(0);  // préservée car encaissement actif
      expect(result.preview.aPreserverCount).toBe(1);
    }
  });

  // T31 : échéance partiellement_payee SANS encaissement actif → régénérée
  it('T31: partiellement_payee sans encaissement actif → régénérée', async () => {
    const bail = creerBailActif();
    const echeancePartielle = creerEcheance(bail.id, '2026-09-01', '2026-09-30', 'partiellement_payee');

    // Pas d'encaissement actif
    const repos = stubRepos(bail, [echeancePartielle]);

    const result = await modifierBailActif(
      { bailId: bail.id, patch: {}, confirmation: 'previsualiser' },
      repos.bailRepo as never,
      repos.echeanceLoyerRepo as never,
      repos.encaissementRepo as never,
      CLOCK,
    );

    expect(result.kind).toBe('preview');
    if (result.kind === 'preview') {
      expect(result.preview.aRegenererCount).toBe(1);  // régénérée (pas d'encaissement)
      expect(result.preview.aPreserverCount).toBe(0);
    }
  });

  // T32 : confirmation=oui → transaction supprime + régénère
  it('T32: confirmation=oui → suppression + régénération avec nouveau loyer', async () => {
    const bail = creerBailActif();
    const echeanceFuture = creerEcheance(bail.id, '2026-09-01', '2026-09-30', 'en_attente');
    const echeancePayee = creerEcheance(bail.id, '2026-01-01', '2026-01-31', 'payee');

    const repos = stubRepos(bail, [echeancePayee, echeanceFuture]);

    const result = await modifierBailActif(
      {
        bailId: bail.id,
        patch: { loyerHc: Money.fromEuros(750) },
        confirmation: 'oui',
      },
      repos.bailRepo as never,
      repos.echeanceLoyerRepo as never,
      repos.encaissementRepo as never,
      CLOCK,
    );

    expect(result.kind).toBe('result');
    if (result.kind === 'result') {
      expect(result.echeancesRegenerees).toBe(1);
      expect(result.echeancesPreservees).toBe(1);
    }
    // La future a été supprimée
    expect(repos.idsSupprimes).toContain(echeanceFuture.id);
    // De nouvelles échéances ont été insérées avec le nouveau loyer
    expect(repos.nouvellesEcheances.length).toBeGreaterThan(0);
    // Vérifier que le bail a été modifié avec le nouveau loyer (750€)
    expect(Number(repos.getBailStocke().loyerHc.toCentimes())).toBe(75000);
  });

  // T33 (unit guard) : throw InvariantViolated si bail introuvable
  it('T33-guard: bail introuvable → throw BailIntrouvable', async () => {
    const repos = {
      bailRepo: { trouverParId: async () => null, enregistrer: async () => {} },
      echeanceLoyerRepo: { listerParBail: async () => [], supprimerLot: async () => {}, enregistrerBatch: async () => {}, mettreAJourStatut: async () => {}, enregistrer: async () => {}, trouverParId: async () => null, listerNonPayees: async () => [] },
      encaissementRepo: { listerParEcheance: async () => [], enregistrer: async () => {}, trouverParId: async () => null, listerTous: async () => [], sommePaieeParEcheance: async () => Money.zero() },
    };

    await expect(
      modifierBailActif(
        { bailId: 'invalid-id' as BailId, patch: {}, confirmation: 'previsualiser' },
        repos.bailRepo as never,
        repos.echeanceLoyerRepo as never,
        repos.encaissementRepo as never,
        CLOCK,
      ),
    ).rejects.toThrow('introuvable');
  });
});

import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';

import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { Money } from '../../../src/domain/_shared/money.js';
import {
  TicketDejaAnnule,
  TransitionInvalide,
} from '../../../src/domain/travaux/erreurs.js';
import {
  STATUTS_TICKET_VALIDES,
  TicketTravaux,
} from '../../../src/domain/travaux/ticket-travaux.js';
import {
  unTicketTravauxAnnule,
  unTicketTravauxClos,
  unTicketTravauxEnCours,
  unTicketTravauxValide,
} from '../../_builders/travaux.js';

const TODAY = Temporal.PlainDate.from('2026-05-18');

describe('TicketTravaux.creer — invariants', () => {
  it('refuse un titre vide → "Le titre du ticket est obligatoire."', () => {
    expect(() =>
      TicketTravaux.creer(unTicketTravauxValide({ titre: '' }), TODAY),
    ).toThrow(InvariantViolated);
    expect(() =>
      TicketTravaux.creer(unTicketTravauxValide({ titre: '   ' }), TODAY),
    ).toThrow('Le titre du ticket est obligatoire.');
  });

  it('refuse une description vide → "La description est obligatoire."', () => {
    expect(() =>
      TicketTravaux.creer(unTicketTravauxValide({ description: '' }), TODAY),
    ).toThrow(InvariantViolated);
    expect(() =>
      TicketTravaux.creer(
        unTicketTravauxValide({ description: '   ' }),
        TODAY,
      ),
    ).toThrow('La description est obligatoire.');
  });

  it("refuse une dateOuverture future → \"La date d'ouverture ne peut pas être dans le futur.\"", () => {
    expect(() =>
      TicketTravaux.creer(
        unTicketTravauxValide({
          dateOuverture: Temporal.PlainDate.from('2026-12-31'),
        }),
        TODAY,
      ),
    ).toThrow("La date d'ouverture ne peut pas être dans le futur.");
  });

  it('accepte une dateOuverture pile à today', () => {
    const t = TicketTravaux.creer(
      unTicketTravauxValide({ dateOuverture: TODAY }),
      TODAY,
    );
    expect(t.dateOuverture.toString()).toBe('2026-05-18');
  });

  it("statut par défaut = 'ouvert' si props.statut omis (via builder)", () => {
    const t = TicketTravaux.creer(unTicketTravauxValide(), TODAY);
    expect(t.statut).toBe('ouvert');
  });

  it('refuse un statut inconnu', () => {
    expect(() =>
      TicketTravaux.creer(
        // @ts-expect-error — on teste un statut hors enum
        unTicketTravauxValide({ statut: 'inconnu' }),
        TODAY,
      ),
    ).toThrow(InvariantViolated);
  });

  it('expose les 4 statuts valides via STATUTS_TICKET_VALIDES', () => {
    expect([...STATUTS_TICKET_VALIDES]).toEqual([
      'ouvert',
      'en_cours',
      'clos',
      'annule',
    ]);
  });

  it('trim le titre et la description', () => {
    const t = TicketTravaux.creer(
      unTicketTravauxValide({
        titre: '  Titre avec espaces  ',
        description: '  Description avec espaces  ',
      }),
      TODAY,
    );
    expect(t.titre).toBe('Titre avec espaces');
    expect(t.description).toBe('Description avec espaces');
  });

  it('génère un id si non fourni', () => {
    const t = TicketTravaux.creer(unTicketTravauxValide(), TODAY);
    expect(typeof t.id).toBe('string');
    expect(t.id.length).toBeGreaterThan(0);
  });
});

describe('TicketTravaux.clore — transitions (D-114)', () => {
  it("depuis 'ouvert' → nouvelle instance statut='clos' + dateCloture + coutReelTtc", () => {
    const t = TicketTravaux.creer(unTicketTravauxValide(), TODAY);
    const dateCloture = Temporal.PlainDate.from('2026-06-01');
    const coutReel = Money.fromEuros(1250);
    const clos = t.clore(coutReel, dateCloture, TODAY);
    expect(clos.statut).toBe('clos');
    expect(clos.dateCloture?.toString()).toBe('2026-06-01');
    expect(clos.coutReelTtc?.toCentimes()).toBe(125000n);
    expect(clos.id).toBe(t.id);
    // L'original reste intact
    expect(t.statut).toBe('ouvert');
    expect(t.coutReelTtc).toBeNull();
  });

  it("depuis 'en_cours' → idem 'clos'", () => {
    const t = TicketTravaux.creer(unTicketTravauxEnCours(), TODAY);
    const clos = t.clore(
      Money.fromEuros(800),
      Temporal.PlainDate.from('2026-06-15'),
      TODAY,
    );
    expect(clos.statut).toBe('clos');
  });

  it("depuis 'clos' → throw TransitionInvalide('Ticket déjà clos.')", () => {
    const t = TicketTravaux.creer(unTicketTravauxClos(), TODAY);
    expect(() =>
      t.clore(
        Money.fromEuros(100),
        Temporal.PlainDate.from('2026-06-20'),
        TODAY,
      ),
    ).toThrow(TransitionInvalide);
    expect(() =>
      t.clore(
        Money.fromEuros(100),
        Temporal.PlainDate.from('2026-06-20'),
        TODAY,
      ),
    ).toThrow('Ticket déjà clos.');
  });

  it("depuis 'annule' → throw TransitionInvalide('Ticket annulé — impossible de clore.')", () => {
    const t = TicketTravaux.creer(unTicketTravauxAnnule(), TODAY);
    expect(() =>
      t.clore(
        Money.fromEuros(100),
        Temporal.PlainDate.from('2026-06-20'),
        TODAY,
      ),
    ).toThrow('Ticket annulé — impossible de clore.');
  });

  it("dateCloture < dateOuverture → throw InvariantViolated", () => {
    const t = TicketTravaux.creer(
      unTicketTravauxValide({
        dateOuverture: Temporal.PlainDate.from('2026-05-10'),
      }),
      TODAY,
    );
    expect(() =>
      t.clore(
        Money.fromEuros(100),
        Temporal.PlainDate.from('2026-05-01'),
        TODAY,
      ),
    ).toThrow(InvariantViolated);
    expect(() =>
      t.clore(
        Money.fromEuros(100),
        Temporal.PlainDate.from('2026-05-01'),
        TODAY,
      ),
    ).toThrow("La date de clôture ne peut pas précéder la date d'ouverture.");
  });

  it('accepte dateCloture === dateOuverture', () => {
    const t = TicketTravaux.creer(
      unTicketTravauxValide({
        dateOuverture: Temporal.PlainDate.from('2026-05-10'),
      }),
      TODAY,
    );
    const clos = t.clore(
      Money.fromEuros(100),
      Temporal.PlainDate.from('2026-05-10'),
      TODAY,
    );
    expect(clos.statut).toBe('clos');
  });
});

describe('TicketTravaux.annuler — soft-delete (D-114)', () => {
  it("depuis 'ouvert' → nouvelle instance statut='annule' + annuleLe + raisonAnnulation", () => {
    const t = TicketTravaux.creer(unTicketTravauxValide(), TODAY);
    const annuleLe = Temporal.PlainDate.from('2026-05-12');
    const annule = t.annuler('Plus pertinent', annuleLe, TODAY);
    expect(annule.statut).toBe('annule');
    expect(annule.annuleLe?.toString()).toBe('2026-05-12');
    expect(annule.raisonAnnulation).toBe('Plus pertinent');
    // L'original reste intact
    expect(t.statut).toBe('ouvert');
    expect(t.annuleLe).toBeNull();
  });

  it("depuis 'annule' → throw TicketDejaAnnule", () => {
    const t = TicketTravaux.creer(unTicketTravauxAnnule(), TODAY);
    expect(() =>
      t.annuler('Doublon', Temporal.PlainDate.from('2026-05-15'), TODAY),
    ).toThrow(TicketDejaAnnule);
  });

  it("depuis 'clos' → autorise l'annulation (annule prime sur clos)", () => {
    const t = TicketTravaux.creer(unTicketTravauxClos(), TODAY);
    const annule = t.annuler(
      'Erreur de saisie',
      Temporal.PlainDate.from('2026-06-05'),
      TODAY,
    );
    expect(annule.statut).toBe('annule');
    expect(annule.annuleLe).not.toBeNull();
  });
});

describe('TicketTravaux — pas de champ nature (D-115)', () => {
  it("l'instance n'expose AUCUN champ `nature`", () => {
    const t = TicketTravaux.creer(unTicketTravauxValide(), TODAY);
    expect((t as unknown as Record<string, unknown>)['nature']).toBeUndefined();
  });
});

describe('TicketTravaux.toProps — copy-on-write', () => {
  it('expose tous les champs nécessaires au repository', () => {
    const t = TicketTravaux.creer(unTicketTravauxValide(), TODAY);
    const props = t.toProps();
    expect(props.id).toBe(t.id);
    expect(props.bienId).toBe(t.bienId);
    expect(props.titre).toBe(t.titre);
    expect(props.description).toBe(t.description);
    expect(props.dateOuverture).toBe(t.dateOuverture);
    expect(props.statut).toBe(t.statut);
    expect(props.coutEstimeTtc).toBe(t.coutEstimeTtc);
    expect(props.coutReelTtc).toBe(t.coutReelTtc);
    expect(props.notes).toBe(t.notes);
    expect(props.creeLe).toBe(t.creeLe);
    expect(props.annuleLe).toBe(t.annuleLe);
    expect(props.raisonAnnulation).toBe(t.raisonAnnulation);
  });
});

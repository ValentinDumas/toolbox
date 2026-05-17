import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { EtatDesLieux } from '../../../src/domain/locatif/etat-des-lieux.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';
import { EDLDejaAnnule } from '../../../src/domain/locatif/erreurs.js';
import {
  inventaireCompletPresent,
  inventaireVidePour,
  TYPES_ITEM_INVENTAIRE,
  InventaireItem,
} from '../../../src/domain/_shared/inventaire-item.js';
import { nouveauBailId } from '../../../src/domain/_shared/identifiants.js';
import type { TypeEDL } from '../../../src/domain/locatif/etat-des-lieux.js';

const bailId = nouveauBailId();
const dateEdl = Temporal.PlainDate.from('2026-05-01');
const dateSignature = Temporal.PlainDate.from('2026-05-01');

function inventaire12Complet() {
  return inventaireCompletPresent();
}

describe('EtatDesLieux', () => {
  // T11
  it('creer EDL entrée avec inventaire complet — ne throw pas', () => {
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'entree',
        dateEdl,
        contradictoire: true,
        dateSignature,
        inventaire: inventaire12Complet(),
      }),
    ).not.toThrow();
  });

  // T12
  it('creer EDL avec inventaire length !== 12 — throw InvariantViolated', () => {
    const deuxItems = inventaire12Complet().slice(0, 2);
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'entree',
        dateEdl,
        contradictoire: false,
        dateSignature: null,
        inventaire: deuxItems,
      }),
    ).toThrow(InvariantViolated);
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'entree',
        dateEdl,
        contradictoire: false,
        dateSignature: null,
        inventaire: deuxItems,
      }),
    ).toThrow("12 items");
  });

  // T13 — doublon
  it('creer EDL avec doublon typeItem — throw InvariantViolated', () => {
    const item = InventaireItem.creer({ typeItem: 'literie', present: true, etat: 'bon', note: null });
    // 12 items mais le premier est dupliqué
    const avecDoublon = [item, ...inventaire12Complet().slice(0, 11)];
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'entree',
        dateEdl,
        contradictoire: false,
        dateSignature: null,
        inventaire: avecDoublon,
      }),
    ).toThrow(InvariantViolated);
  });

  // T14
  it('creer EDL contradictoire sans dateSignature — throw InvariantViolated', () => {
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'entree',
        dateEdl,
        contradictoire: true,
        dateSignature: null,
        inventaire: inventaire12Complet(),
      }),
    ).toThrow(InvariantViolated);
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'entree',
        dateEdl,
        contradictoire: true,
        dateSignature: null,
        inventaire: inventaire12Complet(),
      }),
    ).toThrow('Un EDL contradictoire doit avoir une date de signature');
  });

  // T15
  it('creer EDL contradictoire avec dateSignature — ne throw pas', () => {
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'entree',
        dateEdl,
        contradictoire: true,
        dateSignature,
        inventaire: inventaire12Complet(),
      }),
    ).not.toThrow();
  });

  // T16
  it('creer EDL non-contradictoire sans dateSignature (huissier) — ne throw pas', () => {
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'sortie',
        dateEdl,
        contradictoire: false,
        dateSignature: null,
        inventaire: inventaire12Complet(),
      }),
    ).not.toThrow();
  });

  // T17
  it("creer EDL type invalide — throw InvariantViolated", () => {
    expect(() =>
      EtatDesLieux.creer({
        bailId,
        type: 'invalid' as TypeEDL,
        dateEdl,
        contradictoire: false,
        dateSignature: null,
        inventaire: inventaire12Complet(),
      }),
    ).toThrow(InvariantViolated);
  });

  // T18
  it('annuler — retourne EDL avec annuleLe + raisonAnnulation', () => {
    const edl = EtatDesLieux.creer({
      bailId,
      type: 'entree',
      dateEdl,
      contradictoire: false,
      dateSignature: null,
      inventaire: inventaire12Complet(),
    });
    const annuleDate = Temporal.PlainDate.from('2026-06-01');
    const edlAnnule = edl.annuler('Erreur saisie', annuleDate);
    expect(edlAnnule.annuleLe?.toString()).toBe('2026-06-01');
    expect(edlAnnule.raisonAnnulation).toBe('Erreur saisie');
  });

  // T19
  it('annuler un EDL déjà annulé — throw EDLDejaAnnule', () => {
    const edl = EtatDesLieux.creer({
      bailId,
      type: 'entree',
      dateEdl,
      contradictoire: false,
      dateSignature: null,
      inventaire: inventaire12Complet(),
      annuleLe: Temporal.PlainDate.from('2026-06-01'),
      raisonAnnulation: 'déjà annulé',
    });
    expect(() => edl.annuler('re-annuler', Temporal.PlainDate.from('2026-07-01'))).toThrow(
      EDLDejaAnnule,
    );
  });
});

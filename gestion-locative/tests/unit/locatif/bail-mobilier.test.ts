import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Bail } from '../../../src/domain/locatif/bail.js';
import {
  inventaireCompletPresent,
  inventaireVidePour,
  TYPES_ITEM_INVENTAIRE,
  InventaireItem,
} from '../../../src/domain/_shared/inventaire-item.js';
import { unBailValide } from '../../_builders/locatif.js';

describe('Bail.mobilier (Phase 3 — LOC-06)', () => {
  // T26
  it('Bail.creer avec mobilier=[] — ne throw pas (champ optionnel)', () => {
    expect(() => unBailValide({ mobilier: [] })).not.toThrow();
  });

  // T27
  it('Bail.creer avec mobilier=inventaireCompletPresent — bail.mobilier.length === 12', () => {
    const bail = unBailValide({ mobilier: inventaireCompletPresent() });
    expect(bail.mobilier.length).toBe(12);
  });

  // T28
  it('verifierChecklistMobilier — mobilier=[] → 12 manquants + warning maximum', () => {
    const bail = unBailValide({ mobilier: [] });
    const result = bail.verifierChecklistMobilier();
    expect(result.manquants.length).toBe(12);
    expect(result.warning).toBe('Aucun mobilier renseigné — risque maximum de requalification.');
  });

  // T29
  it('verifierChecklistMobilier — mobilier complet → 0 manquants + warning null', () => {
    const bail = unBailValide({ mobilier: inventaireCompletPresent() });
    const result = bail.verifierChecklistMobilier();
    expect(result.manquants).toHaveLength(0);
    expect(result.warning).toBeNull();
  });

  // T30
  it('verifierChecklistMobilier — 11 items présents + 1 absent → 1 manquant + wording exact', () => {
    const inventaire = inventaireCompletPresent().map((item, idx) => {
      if (idx === 0) {
        // literie absent
        return InventaireItem.creer({ typeItem: item.typeItem, present: false, etat: null, note: null });
      }
      return item;
    });
    const bail = unBailValide({ mobilier: inventaire });
    const result = bail.verifierChecklistMobilier();
    expect(result.manquants).toHaveLength(1);
    expect(result.manquants[0]).toBe('literie');
    expect(result.warning).toBe(
      "Attention : 1 élément(s) obligatoire(s) du décret 2015-981 sont marqués absents. Le bail risque d'être requalifié en bail nu, entraînant un changement de régime fiscal (revenus fonciers au lieu de BIC).",
    );
  });

  // T31
  it('bail.modifier({ mobilier: nouveauMobilier }) — copy-on-write propage mobilier', () => {
    const bail = unBailValide({ mobilier: [] });
    expect(bail.mobilier.length).toBe(0);
    const nouveau = inventaireCompletPresent();
    const modifie = bail.modifier({ mobilier: nouveau });
    expect(modifie.mobilier.length).toBe(12);
    // Original inchangé
    expect(bail.mobilier.length).toBe(0);
  });
});

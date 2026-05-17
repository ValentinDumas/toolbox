import { describe, it, expect } from 'vitest';
import {
  InventaireItem,
  TYPES_ITEM_INVENTAIRE,
  TYPES_ITEM_OBLIGATOIRES,
  LABELS_ITEM_INVENTAIRE,
  etatADegrade,
  inventaireVidePour,
  inventaireCompletPresent,
  type TypeItemInventaire,
} from '../../../src/domain/_shared/inventaire-item.js';
import { InvariantViolated } from '../../../src/domain/_shared/erreurs.js';

describe('InventaireItem', () => {
  // T1
  it("creer item présent état 'bon' — ne throw pas, retourne VO", () => {
    const item = InventaireItem.creer({ typeItem: 'literie', present: true, etat: 'bon', note: null });
    expect(item.typeItem).toBe('literie');
    expect(item.present).toBe(true);
    expect(item.etat).toBe('bon');
    expect(item.note).toBeNull();
  });

  // T2
  it('creer item absent état null — ne throw pas (absent → état null OK)', () => {
    const item = InventaireItem.creer({ typeItem: 'literie', present: false, etat: null, note: null });
    expect(item.present).toBe(false);
    expect(item.etat).toBeNull();
  });

  // T3
  it("creer item présent sans état (null) — throw InvariantViolated", () => {
    expect(() =>
      InventaireItem.creer({ typeItem: 'literie', present: true, etat: null, note: null }),
    ).toThrow(InvariantViolated);
    expect(() =>
      InventaireItem.creer({ typeItem: 'literie', present: true, etat: null, note: null }),
    ).toThrow("L'état est requis si l'item est présent");
  });

  // T4
  it('creer item typeItem hors enum — throw InvariantViolated', () => {
    expect(() =>
      InventaireItem.creer({ typeItem: 'xyz' as TypeItemInventaire, present: true, etat: 'bon', note: null }),
    ).toThrow(InvariantViolated);
  });

  // T5
  it('LABELS_ITEM_INVENTAIRE — libellé non-vide pour les 12 typeItems', () => {
    for (const type of TYPES_ITEM_INVENTAIRE) {
      const label = LABELS_ITEM_INVENTAIRE[type];
      expect(label, `Label manquant pour ${type}`).toBeTruthy();
      expect(typeof label).toBe('string');
      expect(label.length).toBeGreaterThan(0);
    }
  });

  // T6
  it('TYPES_ITEM_INVENTAIRE — 12 valeurs atomiques exactes décret 2015-981', () => {
    expect(TYPES_ITEM_INVENTAIRE.length).toBe(12);
    // Pas de doublon
    const unique = new Set(TYPES_ITEM_INVENTAIRE);
    expect(unique.size).toBe(12);
    // Exactement les 12 items du décret 2015-981 (LOCATION_MEUBLEE_REGLES.md §2)
    const attendus: TypeItemInventaire[] = [
      'literie',
      'volets_occultants',
      'plaques_cuisson',
      'four_micro_ondes',
      'refrigerateur_congelateur',
      'vaisselle',
      'ustensiles',
      'table',
      'sieges',
      'etageres',
      'luminaires',
      'materiel_entretien',
    ];
    for (const a of attendus) {
      expect(TYPES_ITEM_INVENTAIRE, `'${a}' manquant dans TYPES_ITEM_INVENTAIRE`).toContain(a);
    }
    // Aucune fusion, aucune invention
    expect(TYPES_ITEM_INVENTAIRE).not.toContain('cuisine_evier');
    expect(TYPES_ITEM_INVENTAIRE).not.toContain('chauffage_eau_chaude');
    // vaisselle et ustensiles sont distincts
    expect(TYPES_ITEM_INVENTAIRE).toContain('vaisselle');
    expect(TYPES_ITEM_INVENTAIRE).toContain('ustensiles');
    // table et sieges sont distincts
    expect(TYPES_ITEM_INVENTAIRE).toContain('table');
    expect(TYPES_ITEM_INVENTAIRE).toContain('sieges');
  });

  // T7
  describe('etatADegrade', () => {
    it("bon→moyen retourne true", () => expect(etatADegrade('bon', 'moyen')).toBe(true));
    it("bon→dégradé retourne true", () => expect(etatADegrade('bon', 'degrade')).toBe(true));
    it("moyen→dégradé retourne true", () => expect(etatADegrade('moyen', 'degrade')).toBe(true));
    it("bon→bon retourne false", () => expect(etatADegrade('bon', 'bon')).toBe(false));
    it("dégradé→bon retourne false (amélioration)", () => expect(etatADegrade('degrade', 'bon')).toBe(false));
    it("moyen→moyen retourne false", () => expect(etatADegrade('moyen', 'moyen')).toBe(false));
    it("null→bon retourne false", () => expect(etatADegrade(null, 'bon')).toBe(false));
  });

  // T8
  it('inventaireVidePour — 12 items présent:false, etat:null', () => {
    const items = inventaireVidePour(TYPES_ITEM_INVENTAIRE);
    expect(items.length).toBe(12);
    for (const item of items) {
      expect(item.present).toBe(false);
      expect(item.etat).toBeNull();
    }
  });

  // T9
  it('inventaireCompletPresent — 12 items présent:true, etat:bon', () => {
    const items = inventaireCompletPresent();
    expect(items.length).toBe(12);
    for (const item of items) {
      expect(item.present).toBe(true);
      expect(item.etat).toBe('bon');
    }
  });

  // T10
  it('toJSON — retourne forme plate { typeItem, present, etat, note }', () => {
    const item = InventaireItem.creer({ typeItem: 'literie', present: true, etat: 'bon', note: 'ok' });
    const json = item.toJSON();
    expect(json).toEqual({ typeItem: 'literie', present: true, etat: 'bon', note: 'ok' });
  });

  it('TYPES_ITEM_OBLIGATOIRES contient les 12 items', () => {
    expect(TYPES_ITEM_OBLIGATOIRES.length).toBe(12);
  });
});

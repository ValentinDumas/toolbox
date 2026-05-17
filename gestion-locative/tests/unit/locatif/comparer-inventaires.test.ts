import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import {
  comparerInventaires,
  WARNING_ITEM_DISPARU,
  WARNING_ITEM_DEGRADE,
} from '../../../src/domain/locatif/comparer-inventaires.js';
import {
  inventaireCompletPresent,
  InventaireItem,
  TYPES_ITEM_INVENTAIRE,
} from '../../../src/domain/_shared/inventaire-item.js';
import { EtatDesLieux } from '../../../src/domain/locatif/etat-des-lieux.js';
import { nouveauBailId } from '../../../src/domain/_shared/identifiants.js';

const bailId = nouveauBailId();
const dateEntree = Temporal.PlainDate.from('2026-05-01');
const dateSortie = Temporal.PlainDate.from('2027-05-01');

function creerEDLEntree(inventaire: ReturnType<typeof inventaireCompletPresent>) {
  return EtatDesLieux.creer({
    bailId,
    type: 'entree',
    dateEdl: dateEntree,
    contradictoire: false,
    dateSignature: null,
    inventaire,
  });
}

function creerEDLSortie(inventaire: ReturnType<typeof inventaireCompletPresent>) {
  return EtatDesLieux.creer({
    bailId,
    type: 'sortie',
    dateEdl: dateSortie,
    contradictoire: false,
    dateSignature: null,
    inventaire,
  });
}

/** Remplace un item dans un inventaire complet par un item personnalisé. */
function avecItem(
  inventaire: InventaireItem[],
  typeItem: string,
  present: boolean,
  etat: 'bon' | 'moyen' | 'degrade' | null,
): InventaireItem[] {
  return inventaire.map((i) => {
    if (i.typeItem === typeItem) {
      return InventaireItem.creer({
        typeItem: i.typeItem,
        present,
        etat: present ? (etat ?? 'bon') : null,
        note: null,
      });
    }
    return i;
  });
}

describe('comparerInventaires', () => {
  // T20
  it('2 EDL identiques (12 items présents bon) → [] vide', () => {
    const entree = creerEDLEntree(inventaireCompletPresent());
    const sortie = creerEDLSortie(inventaireCompletPresent());
    const warnings = comparerInventaires(entree, sortie);
    expect(warnings).toHaveLength(0);
  });

  // T21
  it('literie présent entrée + absent sortie → WARNING_ITEM_DISPARU', () => {
    const inventaireEntree = inventaireCompletPresent();
    const inventaireSortie = avecItem(inventaireCompletPresent(), 'literie', false, null);
    const entree = creerEDLEntree(inventaireEntree);
    const sortie = creerEDLSortie(inventaireSortie);
    const warnings = comparerInventaires(entree, sortie);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe(WARNING_ITEM_DISPARU);
    expect(warnings[0]!.typeItem).toBe('literie');
    expect(warnings[0]!.message).toContain('Literie');
    expect(warnings[0]!.message).toContain("présent à l'entrée, absent à la sortie");
  });

  // T22
  it('literie présent bon entrée + présent dégradé sortie → WARNING_ITEM_DEGRADE', () => {
    const inventaireSortie = avecItem(inventaireCompletPresent(), 'literie', true, 'degrade');
    const entree = creerEDLEntree(inventaireCompletPresent());
    const sortie = creerEDLSortie(inventaireSortie);
    const warnings = comparerInventaires(entree, sortie);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.code).toBe(WARNING_ITEM_DEGRADE);
    expect(warnings[0]!.typeItem).toBe('literie');
    expect(warnings[0]!.contexte?.etatAvant).toBe('bon');
    expect(warnings[0]!.contexte?.etatApres).toBe('degrade');
  });

  // T23
  it('literie absent entrée + présent bon sortie → 0 warning (ignoré, D-101)', () => {
    const inventaireEntree = avecItem(inventaireCompletPresent(), 'literie', false, null);
    const entree = creerEDLEntree(inventaireEntree);
    const sortie = creerEDLSortie(inventaireCompletPresent());
    const warnings = comparerInventaires(entree, sortie);
    expect(warnings).toHaveLength(0);
  });

  // T24
  it('literie présent moyen entrée + présent bon sortie (amélioration) → 0 warning', () => {
    const inventaireEntree = avecItem(inventaireCompletPresent(), 'literie', true, 'moyen');
    const inventaireSortie = avecItem(inventaireCompletPresent(), 'literie', true, 'bon');
    const entree = creerEDLEntree(inventaireEntree);
    const sortie = creerEDLSortie(inventaireSortie);
    const warnings = comparerInventaires(entree, sortie);
    expect(warnings).toHaveLength(0);
  });

  // T25
  it('3 items dégradés simultanément → 3 warnings dans ordre TYPES_ITEM_INVENTAIRE', () => {
    const inventaireSortie = avecItem(
      avecItem(avecItem(inventaireCompletPresent(), 'literie', false, null), 'table', true, 'degrade'),
      'luminaires',
      true,
      'moyen',
    );
    const entree = creerEDLEntree(inventaireCompletPresent());
    const sortie = creerEDLSortie(inventaireSortie);
    const warnings = comparerInventaires(entree, sortie);
    expect(warnings).toHaveLength(3);
    // Dans l'ordre des TYPES_ITEM_INVENTAIRE : literie (0), table (7), luminaires (10)
    expect(warnings[0]!.typeItem).toBe('literie');
    expect(warnings[0]!.code).toBe(WARNING_ITEM_DISPARU);
    expect(warnings[1]!.typeItem).toBe('table');
    expect(warnings[1]!.code).toBe(WARNING_ITEM_DEGRADE);
    expect(warnings[2]!.typeItem).toBe('luminaires');
    expect(warnings[2]!.code).toBe(WARNING_ITEM_DEGRADE);
  });
});

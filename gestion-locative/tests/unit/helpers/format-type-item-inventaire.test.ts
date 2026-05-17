import { describe, it, expect } from 'vitest';
import { formaterTypeItemInventaire } from '../../../src/helpers/format-type-item-inventaire.js';

// T40 — 12 assertions une par item du décret 2015-981
describe('formaterTypeItemInventaire', () => {
  it("'literie' → libellé non vide contenant 'Literie'", () =>
    expect(formaterTypeItemInventaire('literie')).toContain('Literie'));

  it("'volets_occultants' → libellé non vide", () => {
    const label = formaterTypeItemInventaire('volets_occultants');
    expect(label.length).toBeGreaterThan(0);
    // wording fidèle au décret (occultation des fenêtres)
    expect(label.toLowerCase()).toContain('occult');
  });

  it("'plaques_cuisson' → libellé non vide contenant 'cuisson'", () => {
    const label = formaterTypeItemInventaire('plaques_cuisson');
    expect(label.toLowerCase()).toContain('cuisson');
  });

  it("'four_micro_ondes' → libellé non vide contenant 'four'", () => {
    const label = formaterTypeItemInventaire('four_micro_ondes');
    expect(label.toLowerCase()).toContain('four');
  });

  it("'refrigerateur_congelateur' → libellé non vide contenant 'frigérateur'", () => {
    const label = formaterTypeItemInventaire('refrigerateur_congelateur');
    expect(label.toLowerCase()).toContain('frig');
  });

  it("'vaisselle' → libellé non vide contenant 'Vaisselle'", () => {
    const label = formaterTypeItemInventaire('vaisselle');
    expect(label).toContain('Vaisselle');
  });

  it("'ustensiles' → libellé non vide contenant 'stensile'", () => {
    const label = formaterTypeItemInventaire('ustensiles');
    expect(label.toLowerCase()).toContain('stensile');
  });

  it("'table' → libellé non vide contenant 'Table'", () => {
    const label = formaterTypeItemInventaire('table');
    expect(label).toContain('Table');
  });

  it("'sieges' → libellé non vide contenant 'ège'", () => {
    const label = formaterTypeItemInventaire('sieges');
    expect(label.toLowerCase()).toContain('ège');
  });

  it("'etageres' → libellé non vide contenant 'tagère'", () => {
    const label = formaterTypeItemInventaire('etageres');
    expect(label.toLowerCase()).toContain('tagère');
  });

  it("'luminaires' → libellé non vide contenant 'Luminaire'", () => {
    const label = formaterTypeItemInventaire('luminaires');
    expect(label).toContain('Luminaire');
  });

  it("'materiel_entretien' → libellé non vide contenant 'entretien'", () => {
    const label = formaterTypeItemInventaire('materiel_entretien');
    expect(label.toLowerCase()).toContain('entretien');
  });
});

import { describe, it, expect } from 'vitest';
import { Temporal } from '@js-temporal/polyfill';
import { Bien } from '../../../src/domain/patrimoine/bien.js';
import { Diagnostic } from '../../../src/domain/patrimoine/diagnostic.js';
import { unBienValide, unDiagnosticDpeValide, unDiagnosticGazValide } from '../../_builders/patrimoine.js';

describe('Bien.ajouterDiagnostic()', () => {
  // T11 : ajouterDiagnostic DPE → classeDpe auto-sync + diagnostics.length = 1
  it('T11 : ajouterDiagnostic DPE sync classeDpe et ajoute au tableau', () => {
    const bien = unBienValide();
    const dpe = unDiagnosticDpeValide({ classeDpe: 'F' });
    const bienModifie = bien.ajouterDiagnostic(dpe);

    expect(bienModifie.diagnostics).toHaveLength(1);
    expect(bienModifie.classeDpe).toBe('F');
    expect(bien.diagnostics).toHaveLength(0); // immutabilité
  });

  // T12 : ajouterDiagnostic gaz → classeDpe reste inchangée
  it('T12 : ajouterDiagnostic gaz ne modifie pas classeDpe', () => {
    const bien = unBienValide({ classeDpe: 'D' });
    const gaz = unDiagnosticGazValide();
    const bienModifie = bien.ajouterDiagnostic(gaz);

    expect(bienModifie.classeDpe).toBe('D');
    expect(bienModifie.diagnostics).toHaveLength(1);
  });

  // T13 : 2 DPE successifs → classeDpe = dernier ajouté
  it('T13 : 2 DPE successifs → classeDpe suit le dernier ajouté', () => {
    const bien = unBienValide({ classeDpe: 'D' });
    const dpe1 = unDiagnosticDpeValide({ classeDpe: 'D' });
    const dpe2 = unDiagnosticDpeValide({ classeDpe: 'C' });

    const bienApres2 = bien.ajouterDiagnostic(dpe1).ajouterDiagnostic(dpe2);

    expect(bienApres2.classeDpe).toBe('C');
  });

  // T14 : diagnosticActif retourne le plus récent (by dateEmission)
  it('T14 : diagnosticActif retourne le DPE avec la dateEmission la plus récente', () => {
    const dpeOld = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from('2024-01-01'),
      classeDpe: 'D',
    });
    const dpeNew = Diagnostic.creer({
      type: 'dpe',
      dateEmission: Temporal.PlainDate.from('2025-06-01'),
      classeDpe: 'C',
    });

    const bien = unBienValide();
    const bienAvecDpe = bien.ajouterDiagnostic(dpeOld).ajouterDiagnostic(dpeNew);

    const actif = bienAvecDpe.diagnosticActif('dpe');
    expect(actif).not.toBeNull();
    expect(Temporal.PlainDate.compare(actif!.dateEmission, Temporal.PlainDate.from('2025-06-01'))).toBe(0);
  });

  // T15 : diagnosticActif gaz → null si aucun diagnostic gaz
  it('T15 : diagnosticActif retourne null si type absent', () => {
    const bien = unBienValide();
    expect(bien.diagnosticActif('gaz')).toBeNull();
  });

  // T16 : estGelLoyer → true uniquement pour F et G
  it('T16 : estGelLoyer vrai pour F/G, faux pour null/E/A/B/C/D', () => {
    expect(unBienValide({ classeDpe: null }).estGelLoyer()).toBe(false);
    expect(unBienValide({ classeDpe: 'E' }).estGelLoyer()).toBe(false);
    expect(unBienValide({ classeDpe: 'F' }).estGelLoyer()).toBe(true);
    expect(unBienValide({ classeDpe: 'G' }).estGelLoyer()).toBe(true);
  });

  // T17 : modifier({type}) préserve diagnostics et classeDpe
  it('T17 : modifier préserve diagnostics et classeDpe (copy-on-write)', () => {
    const d1 = unDiagnosticDpeValide({ classeDpe: 'C' });
    const d2 = unDiagnosticGazValide();
    const d3 = Diagnostic.creer({ type: 'elec', dateEmission: Temporal.PlainDate.from('2025-01-15') });

    const bien = unBienValide()
      .ajouterDiagnostic(d1)
      .ajouterDiagnostic(d2)
      .ajouterDiagnostic(d3);

    const bienModifie = bien.modifier({ type: 'maison' });

    expect(bienModifie.diagnostics).toHaveLength(3);
    expect(bienModifie.classeDpe).toBe('C');
    expect(bienModifie.type).toBe('maison');
  });
});

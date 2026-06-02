/**
 * Tests unitaires — helper `formaterCaseLiasse` (Phase 6 / FIS-05 / UI-SPEC §S2).
 *
 * Couvre :
 *   - Rendu nominal des codes lettres canoniques (CB, FK, FY).
 *   - Style monospace 14px (UI-SPEC §Typography).
 *   - **Threat T-06-LIASSE-W1-02 (XSS)** : échappement HTML strict — les chevrons
 *     `<` `>`, les guillemets `"` `'` et l'esperluette `&` sont neutralisés.
 *   - Codes complexes (`1GF`) inchangés (alphanumérique).
 */

import { describe, it, expect } from 'vitest';
import { formaterCaseLiasse } from '../../../src/web/helpers/formater-case-liasse.js';

describe('formaterCaseLiasse — helper UI (Phase 6 FIS-05)', () => {
  it('rend un <span> avec monospace 14px pour code CB', () => {
    const html = formaterCaseLiasse('CB');
    expect(html).toContain('<span');
    expect(html).toContain('class="case-cerfa"');
    expect(html).toContain('font-family:ui-monospace, monospace');
    expect(html).toContain('font-size:14px');
    expect(html).toContain('>CB<');
  });

  it('rend correctement les codes complexes 1GF', () => {
    const html = formaterCaseLiasse('1GF');
    expect(html).toContain('>1GF<');
  });

  it('échappe les < > " \' & (mitigation XSS — T-06-LIASSE-W1-02)', () => {
    const html = formaterCaseLiasse('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;/script&gt;');
  });

  it('échappe les guillemets doubles', () => {
    const html = formaterCaseLiasse('a"b');
    expect(html).toContain('a&quot;b');
  });

  it('échappe l\'esperluette en premier (ordre canonique)', () => {
    const html = formaterCaseLiasse('a&b');
    expect(html).toContain('a&amp;b');
    // Ne double-encode pas
    expect(html).not.toContain('&amp;amp;');
  });

  it('rend correctement une chaîne vide', () => {
    const html = formaterCaseLiasse('');
    expect(html).toContain('></span>');
  });
});

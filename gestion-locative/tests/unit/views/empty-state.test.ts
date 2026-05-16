import { describe, it, expect } from 'vitest';
import ejs from 'ejs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTIAL_PATH = path.resolve(__dirname, '../../../src/web/views/partials/empty-state.ejs');

async function rendre(locals: Record<string, unknown>): Promise<string> {
  return ejs.renderFile(PARTIAL_PATH, locals, { async: true });
}

describe('partials/empty-state.ejs', () => {
  it('rend le lien CTA quand ctaUrl et ctaLabel sont fournis', async () => {
    const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: '/foo', ctaLabel: 'Foo' });
    expect(html).toContain('<a href="/foo" role="button">Foo</a>');
  });

  it('ne rend AUCUN <a> quand ctaLabel est null', async () => {
    const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: '/foo', ctaLabel: null });
    expect(html.match(/<a\b/)).toBeNull();
  });

  it('ne rend AUCUN <a> quand ctaUrl est null', async () => {
    const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: null, ctaLabel: 'Foo' });
    expect(html.match(/<a\b/)).toBeNull();
  });

  it('ne rend AUCUN <a> quand les deux sont null (régression du bug G3)', async () => {
    const html = await rendre({ heading: 'Vide', body: 'Texte', ctaUrl: null, ctaLabel: null });
    expect(html.match(/<a\b/)).toBeNull();
    expect(html).not.toContain('role="button"');
  });
});

import { describe, it, expect } from 'vitest';
import ejs from 'ejs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// CR-02 (Phase 10) — non-régression d'encodage : `urlAction` est concaténé dans
// du HTML brut (blocActions) rendu via `<%- %>`. Il DOIT rester échappé comme le
// faisait l'ancien `<%= alerte.urlAction %>`, sinon une URL contenant des
// caractères HTML casse l'attribut href (défense en profondeur XSS).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ALERTE_PARTIAL = path.resolve(
  __dirname,
  '../../../src/web/views/partials/partial-bandeau-alerte.ejs',
);

function formatDate(date: Date | string): string {
  if (!date) return '';
  const d = new Date(date as string);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function formaterAlerteUrgence(alerte: { joursRestants: number }): string {
  return `Échéance dans ${alerte.joursRestants} jours`;
}
function iconeTypeAlerte(): string {
  return '📅';
}
function libelleTypeAlerte(): string {
  return 'Révision IRL';
}

async function rendreAvecUrl(urlAction: string): Promise<string> {
  const alerte = {
    joursRestants: 15,
    type: 'irl',
    dateEcheance: new Date('2026-09-01'),
    urlAction,
  };
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      ALERTE_PARTIAL,
      { alerte, inline: false, formatDate, formaterAlerteUrgence, iconeTypeAlerte, libelleTypeAlerte },
      {},
      (err, str) => (err ? reject(err) : resolve(str as string)),
    );
  });
}

describe('partial-bandeau-alerte — échappement urlAction (CR-02)', () => {
  it('échappe une urlAction hostile au lieu de l’injecter brute', async () => {
    const html = await rendreAvecUrl('/x"><script>alert(1)</script>');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('"><script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('laisse les URLs internes sûres inchangées (affichage identique)', async () => {
    const url = '/baux/bail-uuid-1/indexations/irl-uuid-1/editer';
    const html = await rendreAvecUrl(url);
    expect(html).toContain(`<a href="${url}" role="button">Lancer la révision IRL</a>`);
  });
});

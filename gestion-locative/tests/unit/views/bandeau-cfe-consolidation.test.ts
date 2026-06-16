import { describe, it, expect } from 'vitest';
import ejs from 'ejs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARTIALS_DIR = path.resolve(__dirname, '../../../src/web/views/partials');

const CFE_PARTIAL = path.join(PARTIALS_DIR, 'partial-bandeau-cfe-echeance.ejs');
const ALERTE_PARTIAL = path.join(PARTIALS_DIR, 'partial-bandeau-alerte.ejs');

// Stubs déterministes pour les helpers
function formatDate(date: Date | string): string {
  if (!date) return '';
  const d = new Date(date as string);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formaterAlerteUrgence(alerte: { joursRestants: number }): string {
  const j = alerte.joursRestants;
  if (j < 0) return `Échéance dépassée depuis ${Math.abs(j)} jour${Math.abs(j) > 1 ? 's' : ''}`;
  if (j === 0) return "Échéance aujourd'hui";
  if (j <= 7) return `Échéance dans ${j} jour${j > 1 ? 's' : ''}`;
  return `Échéance dans ${j} jours`;
}

function iconeTypeAlerte(type: string): string {
  const map: Record<string, string> = { irl: '📅', cfe: '💶', diagnostic: '🏠', fin_bail: '📋' };
  return map[type] ?? '⚠️';
}

function libelleTypeAlerte(alerte: { type: string }): string {
  const map: Record<string, string> = {
    irl: 'Révision IRL',
    cfe: 'CFE',
    diagnostic: 'Diagnostic',
    fin_bail: 'Fin de bail',
  };
  return map[alerte.type] ?? alerte.type;
}

async function rendreCfe(joursRestants: number): Promise<string> {
  const alerte = {
    joursRestants,
    millesime: 2026,
    dateEcheancePaiement: new Date('2026-12-15'),
    bienId: 'bien-uuid-1',
    declarationCfeId: 'cfe-uuid-1',
  };
  // Note: EJS include() ne fonctionne pas avec async:true — on utilise la forme callback.
  return new Promise((resolve, reject) => {
    ejs.renderFile(CFE_PARTIAL, { alerte, formatDate }, {}, (err, str) => {
      if (err) reject(err);
      else resolve(str as string);
    });
  });
}

async function rendreAlerte(joursRestants: number): Promise<string> {
  const alerte = {
    joursRestants,
    type: 'irl',
    dateEcheance: new Date('2026-09-01'),
    urlAction: '/baux/bail-uuid-1/indexations/irl-uuid-1/editer',
  };
  // Note: EJS include() ne fonctionne pas avec async:true — on utilise la forme callback.
  return new Promise((resolve, reject) => {
    ejs.renderFile(
      ALERTE_PARTIAL,
      {
        alerte,
        inline: true,
        formatDate,
        formaterAlerteUrgence,
        iconeTypeAlerte,
        libelleTypeAlerte,
      },
      {},
      (err, str) => {
        if (err) reject(err);
        else resolve(str as string);
      },
    );
  });
}

describe('bandeau-cfe-consolidation — snapshots avant-refactor', () => {
  describe('partial-bandeau-cfe-echeance (SANS icône)', () => {
    it('variante destructive (joursRestants < 0)', async () => {
      const html = await rendreCfe(-3);
      expect(html).toMatchInlineSnapshot(`
        "

        <aside
          role="alert"
          aria-live="assertive"
          aria-label="Alerte CFE 2026"
          style="padding: 16px; margin-bottom: 16px; background: var(--couleur-destructive-bg); border-left: 4px solid var(--couleur-destructive);"
        >
          <p>
            <strong>CFE 2026 — Échéance dépassée depuis 3 jours.</strong>
            Échéance le 15/12/2026.
          </p>
          <p>
            <a
              href="https://www.impots.gouv.fr/professionnel/cotisation-fonciere-des-entreprises-cfe"
              target="_blank"
              rel="noopener noreferrer"
              role="button"
            >Régler la CFE sur impots.gouv.fr</a>
            &nbsp;
            <a href="/biens/bien-uuid-1/cfe/cfe-uuid-1/editer">
              Mettre à jour le statut
            </a>
          </p>
        </aside>
        "
      `);
    });

    it('variante warning-fort (1 <= joursRestants <= 7)', async () => {
      const html = await rendreCfe(5);
      expect(html).toMatchInlineSnapshot(`
        "

        <aside
          role="alert"
          aria-live="assertive"
          aria-label="Alerte CFE 2026"
          style="padding: 16px; margin-bottom: 16px; background: var(--couleur-warning-bg, #FFF4E6); border-left: 4px solid var(--couleur-warning, #C2410C);"
        >
          <p>
            <strong>CFE 2026 — Échéance dans 5 jours.</strong>
            Échéance le 15/12/2026.
          </p>
          <p>
            <a
              href="https://www.impots.gouv.fr/professionnel/cotisation-fonciere-des-entreprises-cfe"
              target="_blank"
              rel="noopener noreferrer"
              role="button"
            >Régler la CFE sur impots.gouv.fr</a>
            &nbsp;
            <a href="/biens/bien-uuid-1/cfe/cfe-uuid-1/editer">
              Mettre à jour le statut
            </a>
          </p>
        </aside>
        "
      `);
    });

    it('variante warning (joursRestants >= 8)', async () => {
      const html = await rendreCfe(20);
      expect(html).toMatchInlineSnapshot(`
        "

        <aside
          role="status"
          aria-live="polite"
          aria-label="Alerte CFE 2026"
          style="padding: 16px; margin-bottom: 16px; border-left: 4px solid var(--couleur-warning, #C2410C); padding-left: 12px;"
        >
          <p>
            <strong>CFE 2026 — Échéance dans 20 jours.</strong>
            Échéance le 15/12/2026.
          </p>
          <p>
            <a
              href="https://www.impots.gouv.fr/professionnel/cotisation-fonciere-des-entreprises-cfe"
              target="_blank"
              rel="noopener noreferrer"
              role="button"
            >Régler la CFE sur impots.gouv.fr</a>
            &nbsp;
            <a href="/biens/bien-uuid-1/cfe/cfe-uuid-1/editer">
              Mettre à jour le statut
            </a>
          </p>
        </aside>
        "
      `);
    });

    it('NE contient PAS aria-hidden ni span icône (critère non-régression CFE)', async () => {
      const [html1, html2, html3] = await Promise.all([
        rendreCfe(-3),
        rendreCfe(5),
        rendreCfe(20),
      ]);
      for (const html of [html1, html2, html3]) {
        expect(html).not.toContain('aria-hidden="true"');
        expect(html).not.toMatch(/<span aria-hidden/);
      }
    });
  });

  describe('partial-bandeau-alerte (AVEC icône + ARIA)', () => {
    it('variante destructive (joursRestants < 0)', async () => {
      const html = await rendreAlerte(-2);
      expect(html).toMatchInlineSnapshot(`
        "

        <aside
          role="alert"
          aria-live="assertive"
          aria-label="Alerte Révision IRL"
          style="padding: 16px; margin-bottom: 16px; background: var(--couleur-destructive-bg); border-left: 4px solid var(--couleur-destructive);"
        >
          <p>
            <span aria-hidden="true">📅</span>
            <strong>Révision IRL — Échéance dépassée depuis 2 jours.</strong>
            Échéance le 01/09/2026.
          </p>
          
        </aside>
        "
      `);
    });

    it('variante warning-fort (1 <= joursRestants <= 7)', async () => {
      const html = await rendreAlerte(3);
      expect(html).toMatchInlineSnapshot(`
        "

        <aside
          role="alert"
          aria-live="assertive"
          aria-label="Alerte Révision IRL"
          style="padding: 16px; margin-bottom: 16px; background: var(--couleur-warning-bg, #FFF4E6); border-left: 4px solid var(--couleur-warning, #C2410C);"
        >
          <p>
            <span aria-hidden="true">📅</span>
            <strong>Révision IRL — Échéance dans 3 jours.</strong>
            Échéance le 01/09/2026.
          </p>
          
        </aside>
        "
      `);
    });

    it('variante warning (joursRestants >= 8)', async () => {
      const html = await rendreAlerte(15);
      expect(html).toMatchInlineSnapshot(`
        "

        <aside
          role="status"
          aria-live="polite"
          aria-label="Alerte Révision IRL"
          style="padding: 16px; margin-bottom: 16px; border-left: 4px solid var(--couleur-warning, #C2410C); padding-left: 12px;"
        >
          <p>
            <span aria-hidden="true">📅</span>
            <strong>Révision IRL — Échéance dans 15 jours.</strong>
            Échéance le 01/09/2026.
          </p>
          
        </aside>
        "
      `);
    });

    it('CONTIENT span aria-hidden et icône (critère ARIA polymorphe)', async () => {
      const [html1, html2, html3] = await Promise.all([
        rendreAlerte(-2),
        rendreAlerte(3),
        rendreAlerte(15),
      ]);
      for (const html of [html1, html2, html3]) {
        expect(html).toContain('<span aria-hidden="true">');
      }
    });
  });
});

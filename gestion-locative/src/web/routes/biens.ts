import type { FastifyInstance } from 'fastify';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import { creerBien } from '../../application/patrimoine/creer-bien.js';
import type { TypeBien } from '../../domain/patrimoine/bien.js';
import type { TypeLot } from '../../domain/patrimoine/lot.js';

export async function plugin(
  app: FastifyInstance,
  opts: { repo: BienRepository },
): Promise<void> {
  app.get('/biens', async (_req, reply) => {
    const biens = await opts.repo.listerTous();
    return reply.view('pages/biens/liste.ejs', { biens, banniereSuccess: null });
  });

  app.post('/biens', async (req, reply) => {
    const body = req.body as Record<string, string>;

    const commande = {
      adresse: {
        rue: body['rue'] ?? '',
        codePostal: body['codePostal'] ?? '',
        ville: body['ville'] ?? '',
      },
      surface: Number(body['surface'] ?? '0'),
      type: (body['type'] ?? 'appartement') as TypeBien,
      anneeConstruction: Number(body['anneeConstruction'] ?? '0'),
      lots: [
        {
          designation: body['lot1_designation'] ?? '',
          surface: body['lot1_type'] === 'appartement' || body['lot1_type'] === 'local_commercial'
            ? Number(body['surface'] ?? '0')
            : null,
          type: (body['lot1_type'] ?? 'appartement') as TypeLot,
          etage: null,
        },
      ],
    };

    try {
      await creerBien(commande, opts.repo);
      return reply.redirect('/biens');
    } catch (err) {
      // Plan 03 : re-render avec erreurs inline + Zod validation.
      // Plan 02 : 400 plain text (walking skeleton minimal)
      const message = err instanceof Error ? err.message : 'Erreur invariant';
      return reply.code(400).send(message);
    }
  });
}

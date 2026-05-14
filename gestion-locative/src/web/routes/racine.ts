import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import { estPremierLancement } from '../../infrastructure/lifecycle/premier-lancement.js';

export async function plugin(app: FastifyInstance, opts: { db: Kysely<DB> }): Promise<void> {
  app.get('/', async (_req, reply) => {
    // Plan 06 branchera le wizard si premier lancement.
    // Plan 02 : redirection systématique vers /biens (walking skeleton minimal).
    const _premier = await estPremierLancement(opts.db);
    return reply.redirect('/biens');
  });
}

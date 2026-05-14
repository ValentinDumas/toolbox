import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import { estPremierLancement } from '../../infrastructure/lifecycle/premier-lancement.js';

export async function plugin(app: FastifyInstance, opts: { db: Kysely<DB> }): Promise<void> {
  app.get('/', async (req, reply) => {
    const premier = await estPremierLancement(opts.db);
    if (premier) {
      return reply.redirect('/wizard/bien');
    }
    return reply.redirect('/biens');
  });
}

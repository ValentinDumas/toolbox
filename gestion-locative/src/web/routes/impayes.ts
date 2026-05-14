import type { FastifyInstance } from 'fastify';

import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { LocataireId } from '../../domain/_shared/identifiants.js';
import { listerImpayes } from '../../domain/encaissements/impaye.js';
import { Money } from '../../domain/_shared/money.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    echeanceLoyerRepo: EcheanceLoyerRepository;
    encaissementRepo: EncaissementRepository;
    bailRepo: BailRepository;
    locataireRepo: LocataireRepository;
    clock: Clock;
  },
): Promise<void> {
  // GET /impayes — liste toutes les EcheanceLoyer non entièrement payées
  app.get('/impayes', async (req, reply) => {
    const query = req.query as { locataire?: string };
    const locataireFiltre = query.locataire ?? null;

    const filtres: { locataireId?: LocataireId } = locataireFiltre
      ? { locataireId: locataireFiltre as LocataireId }
      : {};

    const impayes = await listerImpayes(
      filtres,
      {
        echeanceLoyerRepo: opts.echeanceLoyerRepo,
        encaissementRepo: opts.encaissementRepo,
        bailRepo: opts.bailRepo,
        locataireRepo: opts.locataireRepo,
      },
      opts.clock,
    );

    const totalGlobal = impayes.reduce(
      (acc, i) => acc.additionner(i.resteDu),
      Money.zero(),
    );

    const locatairesUniques = new Set(impayes.map((i) => i.locataireId));
    const allLocataires = await opts.locataireRepo.listerTous();

    return reply.view('pages/impayes/liste.ejs', {
      impayes,
      totalGlobal,
      nbLocataires: locatairesUniques.size,
      allLocataires,
      locataireFiltre,
      navActive: 'impayes',
    });
  });
}

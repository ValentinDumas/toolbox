import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { BailId } from '../../domain/_shared/identifiants.js';
import { activerBail } from '../../application/encaissements/activer-bail.js';
import { listerEcheancesParBail } from '../../application/encaissements/lister-echeances.js';
import { BailIntrouvable } from '../../domain/locatif/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { EcheanceLoyerIntrouvable } from '../../domain/encaissements/erreurs.js';
import { construireAvisEcheance } from '../../infrastructure/pdf/avis-echeance-doc-def.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    bailRepo: BailRepository;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
    echeanceLoyerRepo: EcheanceLoyerRepository;
    bailleurRepo: BailleurRepository;
    pdfRenderer: PdfRenderer;
    clock: Clock;
  },
): Promise<void> {

  // GET /baux/:id/activer — formulaire d'activation
  app.get('/baux/:id/activer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);

    if (!bail) {
      return reply.code(404).send('Bail introuvable.');
    }
    if (bail.actifDepuis !== null) {
      return reply.redirect('/baux/' + id);
    }

    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
    if (!locataire) {
      return reply.code(404).send('Locataire introuvable.');
    }

    return reply.view('pages/baux/activer.ejs', {
      bail,
      locataire,
      erreurs: {},
      valeurs: { actifDepuis: bail.dateDebut.toString(), jourEcheance: '1' },
      navActive: 'baux',
    });
  });

  // POST /baux/:id/activer — activation + génération échéances
  app.post('/baux/:id/activer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;

    const actifDepuisStr = typeof body['actifDepuis'] === 'string' ? body['actifDepuis'] : '';
    const jourEcheanceStr = typeof body['jourEcheance'] === 'string' ? body['jourEcheance'] : '1';
    const jourEcheance = parseInt(jourEcheanceStr, 10);

    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) {
      return reply.code(404).send('Bail introuvable.');
    }

    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
    if (!locataire) {
      return reply.code(404).send('Locataire introuvable.');
    }

    // Validation basique
    if (!actifDepuisStr || isNaN(jourEcheance) || jourEcheance < 1 || jourEcheance > 28) {
      const erreurs: Record<string, string> = {};
      if (!actifDepuisStr) erreurs['actifDepuis'] = 'La date de début est requise.';
      if (isNaN(jourEcheance) || jourEcheance < 1 || jourEcheance > 28) {
        erreurs['jourEcheance'] = 'Le jour d\'échéance doit être entre 1 et 28.';
      }
      return reply.view('pages/baux/activer.ejs', {
        bail,
        locataire,
        erreurs,
        valeurs: body,
        navActive: 'baux',
      });
    }

    let actifDepuis: Temporal.PlainDate;
    try {
      actifDepuis = Temporal.PlainDate.from(actifDepuisStr);
    } catch {
      return reply.view('pages/baux/activer.ejs', {
        bail,
        locataire,
        erreurs: { actifDepuis: 'Date invalide.' },
        valeurs: body,
        navActive: 'baux',
      });
    }

    try {
      const resultat = await activerBail(
        { bailId: id as BailId, actifDepuis, jourEcheance },
        opts.bailRepo,
        opts.echeanceLoyerRepo,
        opts.clock,
      );

      if (resultat.warnings.length > 0) {
        // Passer le warning en query param pour éviter la dépendance à la persistance session
        const warning = encodeURIComponent(resultat.warnings[0] ?? '');
        return reply.redirect('/baux/' + id + '?avertissement=' + warning);
      } else {
        req.session.banniereSuccess = `Bail activé — ${resultat.echeancesCreees} échéances générées.`;
      }
      return reply.redirect('/baux/' + id);
    } catch (err) {
      if (err instanceof BailIntrouvable) {
        return reply.code(404).send(err.message);
      }
      if (err instanceof InvariantViolated) {
        return reply.view('pages/baux/activer.ejs', {
          bail,
          locataire,
          erreurs: { _global: err.message },
          valeurs: body,
          navActive: 'baux',
        });
      }
      throw err;
    }
  });

  // GET /baux/:id/echeances — liste des échéances d'un bail
  app.get('/baux/:id/echeances', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);

    if (!bail) {
      return reply.code(404).send('Bail introuvable.');
    }

    const [locataire, echeances] = await Promise.all([
      opts.locataireRepo.trouverParId(bail.locataireId),
      listerEcheancesParBail(id as BailId, opts.echeanceLoyerRepo),
    ]);

    if (!locataire) {
      return reply.code(404).send('Locataire introuvable.');
    }

    return reply.view('pages/echeances/liste.ejs', {
      bail,
      locataire,
      echeances,
      navActive: 'baux',
    });
  });

  // GET /echeances/:id/avis-pdf — génération PDF avis d'échéance (D-66)
  app.get('/echeances/:id/avis-pdf', async (req, reply) => {
    const { id } = req.params as { id: string };

    const echeance = await opts.echeanceLoyerRepo.trouverParId(id);
    if (!echeance) {
      return reply.code(404).send('Échéance introuvable.');
    }

    const bail = await opts.bailRepo.trouverParId(echeance.bailId);
    if (!bail) {
      return reply.code(404).send('Bail introuvable.');
    }

    const [bailleur, locataire, bien] = await Promise.all([
      opts.bailleurRepo.trouver(),
      opts.locataireRepo.trouverParId(bail.locataireId),
      opts.bienRepo.trouverParId(bail.bienId),
    ]);

    if (!bailleur) {
      return reply.code(400).send('Profil bailleur non renseigné. <a href="/bailleur">Renseigner le profil</a>');
    }
    if (!locataire || !bien) {
      return reply.code(404).send('Données du bail incomplètes.');
    }

    const adresseBien = bien.adresse;
    const dateGeneration = opts.clock.aujourdhui();

    const docDef = construireAvisEcheance(echeance, bailleur, locataire, adresseBien, dateGeneration);
    const buffer = await opts.pdfRenderer.genererBuffer(docDef);

    const periode = echeance.periodeDebut.toString().substring(0, 7).replace('-', '-');
    const idCourt = id.substring(0, 8);
    const filename = `avis-echeance-${periode}-${idCourt}.pdf`;

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  });
}

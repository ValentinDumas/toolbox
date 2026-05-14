import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { QuittanceRepository } from '../../domain/encaissements/quittance-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { QuittanceId } from '../../domain/_shared/identifiants.js';
import { StockageFichierLocal } from '../../infrastructure/storage/stockage-fichier-local.js';
import { genererQuittance } from '../../application/encaissements/generer-quittance.js';
import { annulerQuittance } from '../../application/encaissements/annuler-quittance.js';
import {
  EcheanceLoyerNonPayee,
  QuittanceDejaEmise,
  FichierIntrouvable,
} from '../../domain/encaissements/erreurs.js';
import { BailleurAbsent } from '../../domain/identite/erreurs.js';
import { genererQuittanceFormSchema, annulerQuittanceFormSchema } from '../schemas/quittance-schemas.js';

export async function plugin(
  app: FastifyInstance,
  opts: {
    quittanceRepo: QuittanceRepository;
    echeanceLoyerRepo: EcheanceLoyerRepository;
    encaissementRepo: EncaissementRepository;
    bailleurRepo: BailleurRepository;
    locataireRepo: LocataireRepository;
    bienRepo: BienRepository;
    bailRepo: BailRepository;
    pdfRenderer: PdfRenderer;
    stockage: StockageFichierLocal;
    clock: Clock;
    db: Kysely<DB>;
  },
): Promise<void> {

  // GET /quittances — liste toutes les quittances
  app.get('/quittances', async (req, reply) => {
    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    const quittances = await opts.quittanceRepo.listerToutes({ inclureAnnulees: true });

    // Enrichir chaque quittance avec les données de l'échéance et du locataire
    const quittancesEnrichies = await Promise.all(
      quittances.map(async (q) => {
        const echeance = await opts.echeanceLoyerRepo.trouverParId(q.echeanceId);
        let locataire = null;
        if (echeance) {
          const bail = await opts.bailRepo.trouverParId(echeance.bailId);
          if (bail) {
            locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
          }
        }
        return { quittance: q, echeance, locataire };
      }),
    );

    return reply.view('pages/quittances/liste.ejs', {
      quittancesEnrichies,
      navActive: 'quittances',
      banniereSuccess,
      banniereWarning,
    });
  });

  // POST /quittances — générer une nouvelle quittance
  app.post('/quittances', async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const parsed = genererQuittanceFormSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      req.session.banniereWarning = issue?.message ?? 'Données invalides.';
      return reply.redirect('/echeances');
    }

    try {
      const { quittanceId, numero } = await genererQuittance(
        { echeanceId: parsed.data.echeanceId },
        {
          echeanceLoyerRepo: opts.echeanceLoyerRepo,
          encaissementRepo: opts.encaissementRepo,
          quittanceRepo: opts.quittanceRepo,
          bailleurRepo: opts.bailleurRepo,
          locataireRepo: opts.locataireRepo,
          bienRepo: opts.bienRepo,
          bailRepo: opts.bailRepo,
        },
        opts.pdfRenderer,
        opts.stockage,
        opts.clock,
        opts.db,
      );

      req.session.banniereSuccess = `Quittance n° ${numero} générée avec succès.`;
      return reply.redirect(`/quittances/${quittanceId}`);
    } catch (err) {
      if (err instanceof BailleurAbsent) {
        req.session.banniereWarning = "Renseignez votre profil bailleur avant d'émettre une quittance.";
        return reply.redirect('/bailleur');
      }
      if (err instanceof EcheanceLoyerNonPayee || err instanceof QuittanceDejaEmise) {
        const message = err instanceof Error ? err.message : 'Cette opération est impossible.';
        // Return 400 with error message embedded so BDD and error UI both work
        return reply.code(400).send(message);
      }
      app.log.error(err, 'Erreur lors de la génération de la quittance');
      req.session.banniereWarning = 'Une erreur est survenue lors de la génération de la quittance.';
      return reply.redirect('/quittances');
    }
  });

  // GET /quittances/:id — fiche d'une quittance
  app.get('/quittances/:id', async (req, reply) => {
    const { id } = req.params as { id: string };

    const quittance = await opts.quittanceRepo.trouverParId(id as QuittanceId);
    if (!quittance) {
      return reply.code(404).send('Quittance introuvable. <a href="/quittances">Retour</a>');
    }

    const banniereSuccess = req.session.banniereSuccess ?? null;
    const banniereWarning = req.session.banniereWarning ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;
    if (banniereWarning) req.session.banniereWarning = undefined;

    const echeance = await opts.echeanceLoyerRepo.trouverParId(quittance.echeanceId);
    let locataire = null;
    let bail = null;
    if (echeance) {
      bail = await opts.bailRepo.trouverParId(echeance.bailId);
      if (bail) {
        locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
      }
    }

    // D-65 warning: si l'échéance n'est plus payée alors que la quittance est active
    const peutEtreInvalidee = echeance !== null
      && echeance.statut !== 'payee'
      && quittance.annuleeLe === null;

    return reply.view('pages/quittances/fiche.ejs', {
      quittance,
      echeance,
      locataire,
      bail,
      peutEtreInvalidee,
      navActive: 'quittances',
      banniereSuccess,
      banniereWarning,
    });
  });

  // GET /quittances/:id/pdf — télécharger le PDF persisté
  app.get('/quittances/:id/pdf', async (req, reply) => {
    const { id } = req.params as { id: string };

    const quittance = await opts.quittanceRepo.trouverParId(id as QuittanceId);
    if (!quittance) {
      return reply.code(404).send('Quittance introuvable.');
    }

    try {
      const buffer = await opts.stockage.lireQuittance(quittance.cheminFichierRelatif);
      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="quittance-${quittance.numero}.pdf"`)
        .send(buffer);
    } catch (err) {
      if (err instanceof FichierIntrouvable) {
        return reply.code(404).send(
          `Fichier PDF introuvable. Régénérez la quittance.`,
        );
      }
      throw err;
    }
  });

  // POST /quittances/:id/annuler — annuler une quittance (D-65)
  app.post('/quittances/:id/annuler', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, unknown>;
    const parsed = annulerQuittanceFormSchema.safeParse(body);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      req.session.banniereWarning = issue?.message ?? 'Raison invalide.';
      return reply.redirect(`/quittances/${id}`);
    }

    // WR-11 : 404 explicite si quittance absente — évite que le use case
    // remonte QuittanceIntrouvable en 500.
    const quittance = await opts.quittanceRepo.trouverParId(id as QuittanceId);
    if (!quittance) {
      return reply.code(404).send('Quittance introuvable.');
    }
    const numeroSauvegarde = quittance.numero;

    await annulerQuittance(
      { id: id as QuittanceId, raison: parsed.data.raison },
      opts.quittanceRepo,
      opts.clock,
    );

    req.session.banniereSuccess = `Quittance n° ${numeroSauvegarde} annulée. Le PDF original reste consultable.`;
    return reply.redirect(`/quittances/${id}`);
  });
}

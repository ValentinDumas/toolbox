import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import type { Kysely } from 'kysely';

import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { BailIndexationRepository } from '../../domain/locatif/bail-indexation-repository.js';
import type { BailId } from '../../domain/_shared/identifiants.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import {
  BailIntrouvable,
  GelLoyerClimatActif,
} from '../../domain/locatif/erreurs.js';
import { BienIntrouvable } from '../../domain/patrimoine/erreurs.js';
import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import { FichierIntrouvable } from '../../domain/encaissements/erreurs.js';
import { simulerIndexationIRL } from '../../application/locatif/simuler-indexation-irl.js';
import { appliquerIndexationIRL } from '../../application/locatif/appliquer-indexation-irl.js';
import { renoncerIndexationIRL } from '../../application/locatif/renoncer-indexation-irl.js';
import { indexationSaisieSchema } from '../schemas/indexation-schemas.js';
import { formaterTrimestreIRL } from '../../helpers/format-trimestre-irl.js';

interface StockageLike {
  ecrireAvenant(annee: number, nomFichier: string, buffer: Buffer): Promise<string>;
  lireAvenant(cheminRelatif: string): Promise<Buffer>;
}

declare module 'fastify' {
  interface Session {
    indexationDraft?: { irlTrimestre: string; irlValeur: string };
  }
}

function extraireErreurs(
  issues: { path: (string | number)[]; message: string }[],
): Record<string, string> {
  const erreurs: Record<string, string> = {};
  for (const issue of issues) {
    const cle = issue.path.join('.') || '_global';
    if (!erreurs[cle]) erreurs[cle] = issue.message;
  }
  return erreurs;
}

export async function plugin(
  app: FastifyInstance,
  opts: {
    bailRepo: BailRepository;
    bienRepo: BienRepository;
    locataireRepo: LocataireRepository;
    /** Phase 3-04 (LOC-04 apply). Optionnels en mode lecture/simulation seule. */
    bailleurRepo?: BailleurRepository;
    echeanceLoyerRepo?: EcheanceLoyerRepository;
    encaissementRepo?: EncaissementRepository;
    bailIndexationRepo?: BailIndexationRepository;
    pdfRenderer?: PdfRenderer;
    stockage?: StockageLike;
    clock?: Clock;
    db?: Kysely<DB>;
  },
): Promise<void> {
  // ── GET /baux/:id/indexer — étape 2 (saisie OU gel) ────────────────────────
  app.get('/baux/:id/indexer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) {
      return reply.code(404).send("Ce bail n'existe pas.");
    }
    const bien = await opts.bienRepo.trouverParId(bail.bienId);
    if (!bien) {
      return reply.code(404).send('Bien associé introuvable.');
    }
    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);

    const breadcrumbs = [
      { url: '/baux', label: 'Baux' },
      { url: `/baux/${bail.id}`, label: 'Bail' },
      { label: 'Révision IRL' },
    ];

    if (bien.estGelLoyer()) {
      return reply.view('pages/baux/indexer/gel-loyer.ejs', {
        bail,
        bien,
        locataire,
        classeDpe: bien.classeDpe,
        currentStep: 2,
        breadcrumbs,
        navActive: 'baux',
        formaterTrimestreIRL,
      });
    }

    return reply.view('pages/baux/indexer/saisie.ejs', {
      bail,
      bien,
      locataire,
      valeurs: req.session.indexationDraft ?? {},
      erreurs: {},
      currentStep: 2,
      breadcrumbs,
      navActive: 'baux',
      formaterTrimestreIRL,
    });
  });

  // ── POST /baux/:id/indexer/simuler — étape 3 ────────────────────────────────
  app.post('/baux/:id/indexer/simuler', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send("Ce bail n'existe pas.");
    const bien = await opts.bienRepo.trouverParId(bail.bienId);
    if (!bien) return reply.code(404).send('Bien associé introuvable.');
    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);

    const breadcrumbs = [
      { url: '/baux', label: 'Baux' },
      { url: `/baux/${bail.id}`, label: 'Bail' },
      { label: 'Révision IRL' },
    ];

    const body = req.body as Record<string, unknown>;
    const parsed = indexationSaisieSchema.safeParse(body);
    if (!parsed.success) {
      return reply.view('pages/baux/indexer/saisie.ejs', {
        bail,
        bien,
        locataire,
        valeurs: body,
        erreurs: extraireErreurs(parsed.error.issues),
        currentStep: 2,
        breadcrumbs,
        navActive: 'baux',
        formaterTrimestreIRL,
      });
    }

    try {
      const result = await simulerIndexationIRL(
        {
          bailId: bail.id,
          irlTrimestre: parsed.data.irl_trimestre,
          irlValeur: parsed.data.irl_valeur,
        },
        { bailRepo: opts.bailRepo, bienRepo: opts.bienRepo },
      );
      req.session.indexationDraft = {
        irlTrimestre: parsed.data.irl_trimestre,
        irlValeur: parsed.data.irl_valeur,
      };
      return reply.view('pages/baux/indexer/simulation.ejs', {
        bail,
        bien,
        locataire,
        result,
        currentStep: 3,
        breadcrumbs,
        navActive: 'baux',
        formaterTrimestreIRL,
      });
    } catch (err) {
      // Defense en profondeur — gel rejeté côté serveur.
      if (err instanceof GelLoyerClimatActif) {
        return reply.code(403).view('pages/baux/indexer/gel-loyer.ejs', {
          bail,
          bien,
          locataire,
          classeDpe: bien.classeDpe,
          currentStep: 2,
          breadcrumbs,
          navActive: 'baux',
          formaterTrimestreIRL,
        });
      }
      if (
        err instanceof InvariantViolated ||
        err instanceof BailIntrouvable ||
        err instanceof BienIntrouvable
      ) {
        return reply.view('pages/baux/indexer/saisie.ejs', {
          bail,
          bien,
          locataire,
          valeurs: body,
          erreurs: { _global: err.message },
          currentStep: 2,
          breadcrumbs,
          navActive: 'baux',
          formaterTrimestreIRL,
        });
      }
      throw err;
    }
  });

  // ── POST /baux/:id/indexer/confirmer — étape 4 (livré 03-04) ───────────────
  app.post('/baux/:id/indexer/confirmer', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send("Ce bail n'existe pas.");
    if (!req.session.indexationDraft) {
      return reply.redirect(`/baux/${bail.id}/indexer`);
    }
    const bien = await opts.bienRepo.trouverParId(bail.bienId);
    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);

    // Recalcul de la simulation pour réafficher les valeurs récap.
    const draft = req.session.indexationDraft;
    const result = await simulerIndexationIRL(
      { bailId: bail.id, irlTrimestre: draft.irlTrimestre, irlValeur: draft.irlValeur },
      { bailRepo: opts.bailRepo, bienRepo: opts.bienRepo },
    );

    const breadcrumbs = [
      { url: '/baux', label: 'Baux' },
      { url: `/baux/${bail.id}`, label: 'Bail' },
      { label: 'Révision IRL' },
    ];

    return reply.view('pages/baux/indexer/confirmation.ejs', {
      bail,
      bien,
      locataire,
      result,
      currentStep: 4,
      breadcrumbs,
      navActive: 'baux',
      formaterTrimestreIRL,
    });
  });

  // ── POST /baux/:id/indexer/appliquer — étape 5 (livré 03-04) ────────────────
  app.post('/baux/:id/indexer/appliquer', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (
      !opts.bailleurRepo ||
      !opts.echeanceLoyerRepo ||
      !opts.encaissementRepo ||
      !opts.bailIndexationRepo ||
      !opts.pdfRenderer ||
      !opts.stockage ||
      !opts.clock ||
      !opts.db
    ) {
      return reply.code(500).send("Dépendances manquantes pour appliquer l'indexation.");
    }

    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send("Ce bail n'existe pas.");
    const draft = req.session.indexationDraft;
    if (!draft) {
      req.session.banniereWarning = 'Veuillez saisir un IRL avant d\'appliquer.';
      return reply.redirect(`/baux/${bail.id}/indexer`);
    }

    try {
      const { nouveauLoyerHc } = await appliquerIndexationIRL(
        {
          bailId: bail.id,
          irlTrimestre: draft.irlTrimestre,
          irlValeur: draft.irlValeur,
        },
        {
          bailRepo: opts.bailRepo,
          bienRepo: opts.bienRepo,
          locataireRepo: opts.locataireRepo,
          bailleurRepo: opts.bailleurRepo,
          echeanceLoyerRepo: opts.echeanceLoyerRepo,
          encaissementRepo: opts.encaissementRepo,
          bailIndexationRepo: opts.bailIndexationRepo,
        },
        { pdfRenderer: opts.pdfRenderer, stockage: opts.stockage, clock: opts.clock },
        opts.db,
      );
      req.session.indexationDraft = undefined;
      req.session.banniereSuccess =
        `Révision IRL appliquée avec succès. Nouveau loyer : ${nouveauLoyerHc.enEuros()}. Avenant disponible au téléchargement.`;
      return reply.redirect(`/baux/${bail.id}`);
    } catch (err) {
      if (err instanceof GelLoyerClimatActif) {
        const bien = await opts.bienRepo.trouverParId(bail.bienId);
        const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
        return reply.code(403).view('pages/baux/indexer/gel-loyer.ejs', {
          bail,
          bien,
          locataire,
          classeDpe: bien?.classeDpe ?? null,
          currentStep: 2,
          breadcrumbs: [
            { url: '/baux', label: 'Baux' },
            { url: `/baux/${bail.id}`, label: 'Bail' },
            { label: 'Révision IRL' },
          ],
          navActive: 'baux',
          formaterTrimestreIRL,
        });
      }
      if (
        err instanceof InvariantViolated ||
        err instanceof BailIntrouvable ||
        err instanceof BienIntrouvable
      ) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/baux/${bail.id}/indexer`);
      }
      throw err;
    }
  });

  // ── POST /baux/:id/indexer/renoncer — étape 4 alternative ───────────────────
  app.post('/baux/:id/indexer/renoncer', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!opts.bailIndexationRepo || !opts.db) {
      return reply.code(500).send("Dépendances manquantes pour renoncer à l'indexation.");
    }
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send("Ce bail n'existe pas.");
    const draft = req.session.indexationDraft;
    if (!draft) {
      req.session.banniereWarning = 'Veuillez saisir un IRL avant de renoncer.';
      return reply.redirect(`/baux/${bail.id}/indexer`);
    }

    try {
      await renoncerIndexationIRL(
        {
          bailId: bail.id,
          irlTrimestre: draft.irlTrimestre,
          irlValeur: draft.irlValeur,
        },
        {
          bailRepo: opts.bailRepo,
          bienRepo: opts.bienRepo,
          bailIndexationRepo: opts.bailIndexationRepo,
        },
        opts.db,
      );
      req.session.indexationDraft = undefined;
      req.session.banniereSuccess =
        "Révision IRL non appliquée — l'IRL de référence est mis à jour pour la prochaine révision.";
      return reply.redirect(`/baux/${bail.id}`);
    } catch (err) {
      if (err instanceof GelLoyerClimatActif) {
        const bien = await opts.bienRepo.trouverParId(bail.bienId);
        const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
        return reply.code(403).view('pages/baux/indexer/gel-loyer.ejs', {
          bail,
          bien,
          locataire,
          classeDpe: bien?.classeDpe ?? null,
          currentStep: 2,
          breadcrumbs: [
            { url: '/baux', label: 'Baux' },
            { url: `/baux/${bail.id}`, label: 'Bail' },
            { label: 'Révision IRL' },
          ],
          navActive: 'baux',
          formaterTrimestreIRL,
        });
      }
      if (
        err instanceof InvariantViolated ||
        err instanceof BailIntrouvable ||
        err instanceof BienIntrouvable
      ) {
        req.session.banniereWarning = err.message;
        return reply.redirect(`/baux/${bail.id}/indexer`);
      }
      throw err;
    }
  });

  // ── GET /baux/:id/avenant/:annee — téléchargement PDF ──────────────────────
  app.get('/baux/:id/avenant/:annee', async (req, reply) => {
    if (!opts.bailIndexationRepo || !opts.stockage) {
      return reply.code(500).send('Dépendances manquantes pour télécharger un avenant.');
    }
    const { id, annee: anneeStr } = req.params as { id: string; annee: string };
    const annee = parseInt(anneeStr, 10);
    if (!Number.isInteger(annee) || annee < 1900 || annee > 9999) {
      return reply.code(400).send('Année invalide.');
    }
    const bail = await opts.bailRepo.trouverParId(id as BailId);
    if (!bail) return reply.code(404).send("Ce bail n'existe pas.");

    const indexations = await opts.bailIndexationRepo.listerParBail(bail.id);
    const indexation = indexations.find(
      (i) => i.dateEffet.year === annee && i.indexationAppliquee,
    );
    if (!indexation) {
      return reply.code(404).send('Aucun avenant pour cette année.');
    }

    const bailIdCourt = bail.id.slice(0, 8);
    const nomFichier = `avenant-${bailIdCourt}-${indexation.dateEffet.toString()}.pdf`;
    const cheminRelatif = path.join('avenants', String(annee), nomFichier);

    try {
      const buffer = await opts.stockage.lireAvenant(cheminRelatif);
      reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="${nomFichier}"`);
      return reply.send(buffer);
    } catch (err) {
      if (err instanceof FichierIntrouvable) {
        return reply
          .code(404)
          .send("Fichier PDF avenant introuvable. Régénérez en relançant la révision IRL.");
      }
      throw err;
    }
  });
}

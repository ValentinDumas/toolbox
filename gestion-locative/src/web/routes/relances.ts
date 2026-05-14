import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';

import type { RelanceRepository } from '../../domain/encaissements/relance-repository.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type { RelanceId } from '../../domain/_shared/identifiants.js';
import type { NiveauRelance } from '../../domain/encaissements/relance.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import { enregistrerRelance } from '../../application/encaissements/enregistrer-relance.js';
import { listerRelances } from '../../application/encaissements/lister-relances.js';
import { TemplateRendererEjs } from '../../infrastructure/templates/template-renderer-ejs.js';
import { construireMiseEnDemeure } from '../../infrastructure/pdf/mise-en-demeure-doc-def.js';
import { Money } from '../../domain/_shared/money.js';
import { RelanceNiveauNonDisponible } from '../../domain/encaissements/erreurs.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates/relances');

export async function plugin(
  app: FastifyInstance,
  opts: {
    relanceRepo: RelanceRepository;
    echeanceLoyerRepo: EcheanceLoyerRepository;
    encaissementRepo: EncaissementRepository;
    bailRepo: BailRepository;
    locataireRepo: LocataireRepository;
    bienRepo: BienRepository;
    bailleurRepo: BailleurRepository;
    pdfRenderer: PdfRenderer;
    clock: Clock;
  },
): Promise<void> {
  // WR-02 : pdfRenderer injecté via opts (singleton DI) au lieu d'être
  // réinstancié — évite la double-configuration de pdfmake font state.
  const templateRenderer = new TemplateRendererEjs(TEMPLATES_DIR);
  const pdfRenderer = opts.pdfRenderer;

  // GET /relances — liste toutes les relances
  app.get('/relances', async (req, reply) => {
    const banniereSuccess = req.session.banniereSuccess ?? null;
    if (banniereSuccess) req.session.banniereSuccess = undefined;

    const relances = await listerRelances({ inclureAnnulees: false }, opts.relanceRepo);

    // Enrichir avec données locataire pour affichage
    const lignes = await Promise.all(
      relances.map(async (r) => {
        const echeance = await opts.echeanceLoyerRepo.trouverParId(r.echeanceId);
        if (!echeance) return null;
        const bail = await opts.bailRepo.trouverParId(echeance.bailId);
        if (!bail) return null;
        const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
        if (!locataire) return null;
        return {
          relance: r,
          echeance,
          locataireNomComplet: `${locataire.prenom} ${locataire.nom}`,
        };
      }),
    );

    const lignesValides = lignes.filter((l) => l !== null);

    return reply.view('pages/relances/liste.ejs', {
      lignes: lignesValides,
      navActive: 'relances',
      banniereSuccess,
    });
  });

  // POST /relances — enregistrer une relance (niveaux 1-2 redirect vers /impayes, niveau 3 retourne PDF)
  app.post('/relances', async (req, reply) => {
    const body = req.body as { echeanceId?: string; niveau?: string };
    const echeanceId = body.echeanceId;
    const niveauRaw = parseInt(body.niveau ?? '', 10);

    if (!echeanceId || ![1, 2, 3].includes(niveauRaw)) {
      return reply.code(400).send('Paramètres invalides.');
    }

    const niveau = niveauRaw as NiveauRelance;

    try {
      const resultat = await enregistrerRelance(
        { echeanceId, niveau },
        {
          relanceRepo: opts.relanceRepo,
          echeanceLoyerRepo: opts.echeanceLoyerRepo,
          encaissementRepo: opts.encaissementRepo,
          bailRepo: opts.bailRepo,
          locataireRepo: opts.locataireRepo,
          bienRepo: opts.bienRepo,
          bailleurRepo: opts.bailleurRepo,
        },
        templateRenderer,
        pdfRenderer,
        opts.clock,
      );

      if (resultat.canal === 'pdf') {
        return reply
          .header('Content-Type', 'application/pdf')
          .header('Content-Disposition', 'attachment; filename="mise-en-demeure.pdf"')
          .send(resultat.pdfBuffer);
      }

      // Canal email : redirect vers /impayes avec bannière succès
      req.session.banniereSuccess = `Relance niveau ${niveau} enregistrée.`;
      return reply.redirect('/impayes');
    } catch (err) {
      if (err instanceof RelanceNiveauNonDisponible) {
        return reply.code(422).send(err.message);
      }
      throw err;
    }
  });

  // GET /relances/:id/pdf — régénère le PDF mise en demeure depuis la fiche relance
  app.get('/relances/:id/pdf', async (req, reply) => {
    const { id } = req.params as { id: string };

    const relance = await opts.relanceRepo.trouverParId(id as RelanceId);
    if (!relance || relance.canal !== 'pdf') {
      return reply.code(404).send('Document indisponible — relance PDF introuvable.');
    }

    const echeance = await opts.echeanceLoyerRepo.trouverParId(relance.echeanceId);
    if (!echeance) {
      return reply.code(404).send('Document indisponible — une entité référencée a été supprimée.');
    }

    const bail = await opts.bailRepo.trouverParId(echeance.bailId);
    if (!bail) {
      return reply.code(404).send('Document indisponible — une entité référencée a été supprimée.');
    }

    const locataire = await opts.locataireRepo.trouverParId(bail.locataireId);
    if (!locataire) {
      return reply.code(404).send('Document indisponible — une entité référencée a été supprimée.');
    }

    const bailleur = await opts.bailleurRepo.trouver();
    if (!bailleur) {
      return reply.code(404).send('Document indisponible — profil bailleur absent.');
    }

    const bien = await opts.bienRepo.trouverParId(bail.bienId);
    if (!bien) {
      return reply.code(404).send('Document indisponible — une entité référencée a été supprimée.');
    }

    const sommePaiee = await opts.encaissementRepo.sommePaieeParEcheance(echeance.id);
    const resteDu = echeance.total.lte(sommePaiee) ? Money.zero() : echeance.total.soustraire(sommePaiee);

    const docDef = construireMiseEnDemeure(
      echeance,
      await opts.encaissementRepo.listerParEcheance(echeance.id),
      bailleur,
      locataire,
      bien,
      bien.adresse,
      bail,
      resteDu,
      opts.clock.aujourdhui(),
    );

    const buffer = await pdfRenderer.genererBuffer(docDef);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', 'attachment; filename="mise-en-demeure.pdf"')
      .send(buffer);
  });
}

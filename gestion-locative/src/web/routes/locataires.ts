import { Temporal } from '@js-temporal/polyfill';
import type { FastifyInstance } from 'fastify';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { LocataireId } from '../../domain/_shared/identifiants.js';
import { creerLocataire } from '../../application/locatif/creer-locataire.js';
import { modifierLocataire } from '../../application/locatif/modifier-locataire.js';
import { supprimerLocataire } from '../../application/locatif/supprimer-locataire.js';
import { listerLocataires } from '../../application/locatif/lister-locataires.js';
import { LocataireIntrouvable } from '../../domain/locatif/erreurs.js';
import {
  locataireCreationSchema,
  locataireModificationSchema,
} from '../schemas/locataire-schemas.js';

/** Formate un Temporal.PlainDate en DD/MM/YYYY pour l'affichage (format légal français). */
function formatDate(date: Temporal.PlainDate): string {
  const j = String(date.day).padStart(2, '0');
  const m = String(date.month).padStart(2, '0');
  return `${j}/${m}/${date.year}`;
}

export async function plugin(
  app: FastifyInstance,
  opts: { repo: LocataireRepository },
): Promise<void> {

  // GET /locataires — liste tabulée
  app.get('/locataires', async (_req, reply) => {
    const locataires = await listerLocataires(opts.repo);
    return reply.view('pages/locataires/liste.ejs', {
      locataires,
      banniereSuccess: null,
      navActive: 'locataires',
    });
  });

  // GET /locataires/nouveau — formulaire création
  // Déclaré AVANT /locataires/:id pour que "nouveau" ne soit pas capturé comme id
  app.get('/locataires/nouveau', async (_req, reply) => {
    return reply.view('pages/locataires/formulaire.ejs', {
      mode: 'creation',
      locataire: null,
      valeurs: {},
      erreurs: {},
      formatDate,
      navActive: 'locataires',
    });
  });

  // POST /locataires — créer un Locataire
  app.post('/locataires', async (req, reply) => {
    const body = req.body as Record<string, string>;
    const parsed = locataireCreationSchema.safeParse(body);

    if (!parsed.success) {
      const erreurs = extraireErreurs(parsed.error.issues);
      return reply.view('pages/locataires/formulaire.ejs', {
        mode: 'creation',
        locataire: null,
        valeurs: body,
        erreurs,
        formatDate,
        navActive: 'locataires',
      });
    }

    try {
      const { nom, prenom, dateNaissance, communeNaissance, paysNaissance, nationalite, email, telephone, rue, codePostal, ville } = parsed.data;
      const locataireId = await creerLocataire(
        {
          nom,
          prenom,
          dateNaissance,
          communeNaissance,
          paysNaissance,
          nationalite,
          email,
          telephone: telephone ?? null,
          adresseActuelle: { rue, codePostal, ville },
        },
        opts.repo,
      );
      return reply.redirect('/locataires/' + locataireId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur inattendue';
      return reply.view('pages/locataires/formulaire.ejs', {
        mode: 'creation',
        locataire: null,
        valeurs: body,
        erreurs: { _global: message },
        formatDate,
        navActive: 'locataires',
      });
    }
  });

  // GET /locataires/:id — détail
  app.get('/locataires/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const locataire = await opts.repo.trouverParId(id as LocataireId);
    if (!locataire) {
      return reply.code(404).send(
        'Ce locataire n\'existe pas ou a été supprimé. Retournez à la liste des locataires.',
      );
    }
    return reply.view('pages/locataires/detail.ejs', {
      locataire,
      banniereSuccess: null,
      formatDate,
      navActive: 'locataires',
    });
  });

  // GET /locataires/:id/modifier — formulaire édition
  app.get('/locataires/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const locataire = await opts.repo.trouverParId(id as LocataireId);
    if (!locataire) {
      return reply.code(404).send('Ce locataire n\'existe pas ou a été supprimé.');
    }
    return reply.view('pages/locataires/formulaire.ejs', {
      mode: 'edition',
      locataire,
      valeurs: {
        nom: locataire.nom,
        prenom: locataire.prenom,
        dateNaissance: locataire.dateNaissance.toString(),
        communeNaissance: locataire.lieuNaissance.commune,
        paysNaissance: locataire.lieuNaissance.pays,
        nationalite: locataire.nationalite,
        email: locataire.email,
        telephone: locataire.telephone ?? '',
        rue: locataire.adresseActuelle.rue,
        codePostal: locataire.adresseActuelle.codePostal,
        ville: locataire.adresseActuelle.ville,
      },
      erreurs: {},
      formatDate,
      navActive: 'locataires',
    });
  });

  // POST /locataires/:id/modifier — persister modifications
  app.post('/locataires/:id/modifier', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as Record<string, string>;
    const parsed = locataireModificationSchema.safeParse(body);

    if (!parsed.success) {
      const locataire = await opts.repo.trouverParId(id as LocataireId);
      const erreurs = extraireErreurs(parsed.error.issues);
      return reply.view('pages/locataires/formulaire.ejs', {
        mode: 'edition',
        locataire,
        valeurs: body,
        erreurs,
        formatDate,
        navActive: 'locataires',
      });
    }

    try {
      await modifierLocataire(
        {
          id: id as LocataireId,
          nom: parsed.data.nom,
          prenom: parsed.data.prenom,
          dateNaissance: parsed.data.dateNaissance,
          communeNaissance: parsed.data.communeNaissance,
          paysNaissance: parsed.data.paysNaissance,
          nationalite: parsed.data.nationalite,
          email: parsed.data.email,
          telephone: parsed.data.telephone ?? null,
          adresseActuelle:
            parsed.data.rue && parsed.data.codePostal && parsed.data.ville
              ? { rue: parsed.data.rue, codePostal: parsed.data.codePostal, ville: parsed.data.ville }
              : undefined,
        },
        opts.repo,
      );
      return reply.redirect('/locataires/' + id);
    } catch (err) {
      if (err instanceof LocataireIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });

  // POST /locataires/:id/supprimer — soft-delete
  app.post('/locataires/:id/supprimer', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      await supprimerLocataire(id as LocataireId, opts.repo);
      return reply.redirect('/locataires');
    } catch (err) {
      if (err instanceof LocataireIntrouvable) {
        return reply.code(404).send(err.message);
      }
      throw err;
    }
  });
}

/** Extrait les erreurs Zod en un dictionnaire chemin → premier message. */
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

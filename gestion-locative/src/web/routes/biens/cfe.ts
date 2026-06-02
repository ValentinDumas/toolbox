/**
 * Routes web — Suivi déclaratif CFE 1447-C-SD (Phase 6 / FIS-06).
 *
 * Endpoints :
 *   GET  /biens/:id/cfe/nouvelle             → Formulaire création
 *   POST /biens/:id/cfe                       → Création (Zod + use case + flash + redirect)
 *   GET  /biens/:id/cfe/:cfeId/editer        → Formulaire édition (404 si introuvable)
 *   POST /biens/:id/cfe/:cfeId/modifier       → Modification (Zod + use case + flash + redirect)
 *
 * Sécurité (06-PLAN threat model) :
 *   T-06-CFE6-01 Tampering : Zod schema strict — pas de `id` ni `bienId` dans le body.
 *   T-06-CFE6-02/03 : invariants en défense en profondeur (DeclarationCfe.creer).
 *   T-06-CFE6-05 : cross-bien access — la route 'modifier' vérifie `decl.bienId === params.id`.
 *
 * Pattern miroir : src/web/routes/fiscalite/cloture.ts (Zod safeParse + flash session).
 */

import type { FastifyInstance } from 'fastify';
import { Temporal } from '@js-temporal/polyfill';

import type { Clock } from '../../../domain/_shared/clock.js';
import type { BienRepository } from '../../../domain/patrimoine/bien-repository.js';
import type { DeclarationCfeRepository } from '../../../domain/fiscalite/cfe/declaration-cfe-repository.js';
import type { BienId, DeclarationCfeId } from '../../../domain/_shared/identifiants.js';
import type { StatutCfe } from '../../../domain/fiscalite/cfe/statut-cfe.js';
import { Money } from '../../../domain/_shared/money.js';
import { InvariantViolated } from '../../../domain/_shared/erreurs.js';
import { BienIntrouvable } from '../../../domain/patrimoine/erreurs.js';
import { DeclarationCfeIntrouvable } from '../../../domain/fiscalite/erreurs.js';

import { enregistrerDeclarationCfe } from '../../../application/fiscalite/enregistrer-declaration-cfe.js';
import { modifierDeclarationCfe } from '../../../application/fiscalite/modifier-declaration-cfe.js';
import { enregistrerCfeSchema, modifierCfeSchema } from '../../schemas/cfe-schemas.js';

declare module 'fastify' {
  interface Session {
    formErrors?: Record<string, string>;
    formValeurs?: Record<string, unknown>;
  }
}

export interface CfeRouteDeps {
  bienRepo: BienRepository;
  cfeRepo: DeclarationCfeRepository;
  clock: Clock;
}

function formatZodErrors(issues: ReturnType<typeof enregistrerCfeSchema.safeParse>) {
  if (issues && typeof issues === 'object' && 'error' in issues && issues.error) {
    const out: Record<string, string> = {};
    for (const err of issues.error.issues) {
      const key = err.path[0]?.toString() ?? 'global';
      out[key] = err.message;
    }
    return out;
  }
  return {};
}

export async function registerBiensCfeRoutes(
  app: FastifyInstance,
  deps: CfeRouteDeps,
): Promise<void> {
  const { bienRepo, cfeRepo, clock } = deps;

  // GET /biens/:id/cfe/nouvelle
  app.get('/biens/:id/cfe/nouvelle', async (req, reply) => {
    const { id } = req.params as { id: string };
    const bien = await bienRepo.trouverParId(id as BienId);
    if (!bien) {
      return reply.code(404).send('Bien introuvable.');
    }
    const query = req.query as { millesime?: string };
    const millesime = query.millesime ? parseInt(query.millesime, 10) : clock.aujourdhui().year;
    const erreurs = req.session.formErrors ?? {};
    const valeurs = req.session.formValeurs ?? {};
    req.session.formErrors = undefined;
    req.session.formValeurs = undefined;
    return reply.view('pages/biens/cfe/nouvelle.ejs', {
      bien,
      millesime,
      mode: 'creation',
      erreurs,
      valeurs,
      navActive: 'biens',
    });
  });

  // POST /biens/:id/cfe
  app.post('/biens/:id/cfe', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = enregistrerCfeSchema.safeParse(req.body);
    if (!parsed.success) {
      req.session.formErrors = formatZodErrors(parsed as never);
      req.session.formValeurs = (req.body as Record<string, unknown>) ?? {};
      return reply.redirect(`/biens/${id}/cfe/nouvelle`);
    }
    const data = parsed.data;
    try {
      const decl = await enregistrerDeclarationCfe(
        {
          bienId: id as BienId,
          millesime: data.millesime,
          statut: data.statut as StatutCfe,
          dateDepotDeclaration: data.dateDepotDeclaration
            ? Temporal.PlainDate.from(data.dateDepotDeclaration)
            : null,
          montantAvisCentimes:
            data.montantAvisEuros !== null ? Money.fromEuros(data.montantAvisEuros) : null,
          dateEcheancePaiement: Temporal.PlainDate.from(data.dateEcheancePaiement),
        },
        { bienRepo, cfeRepo },
      );
      req.session.banniereSuccess = `Déclaration CFE ${decl.millesime} enregistrée.`;
      return reply.redirect(`/biens/${id}`);
    } catch (err) {
      if (err instanceof BienIntrouvable) {
        return reply.code(404).send('Bien introuvable.');
      }
      if (err instanceof InvariantViolated) {
        req.session.formErrors = { global: err.message };
        req.session.formValeurs = (req.body as Record<string, unknown>) ?? {};
        return reply.redirect(`/biens/${id}/cfe/nouvelle`);
      }
      throw err;
    }
  });

  // GET /biens/:id/cfe/:cfeId/editer
  app.get('/biens/:id/cfe/:cfeId/editer', async (req, reply) => {
    const { id, cfeId } = req.params as { id: string; cfeId: string };
    const bien = await bienRepo.trouverParId(id as BienId);
    if (!bien) {
      return reply.code(404).send('Bien introuvable.');
    }
    const decl = await cfeRepo.trouverParId(cfeId as DeclarationCfeId);
    if (!decl || decl.bienId !== bien.id) {
      return reply.code(404).send('Déclaration CFE introuvable pour ce bien.');
    }
    const erreurs = req.session.formErrors ?? {};
    const sessionValeurs = req.session.formValeurs ?? {};
    const valeurs = {
      millesime: decl.millesime,
      statut: decl.statut,
      dateDepotDeclaration: decl.dateDepotDeclaration ? decl.dateDepotDeclaration.toString() : '',
      montantAvisEuros:
        decl.montantAvisCentimes !== null
          ? (decl.montantAvisCentimes.toSqliteInteger() / 100).toFixed(2)
          : '',
      dateEcheancePaiement: decl.dateEcheancePaiement.toString(),
      ...sessionValeurs,
    };
    req.session.formErrors = undefined;
    req.session.formValeurs = undefined;
    return reply.view('pages/biens/cfe/editer.ejs', {
      bien,
      millesime: decl.millesime,
      declarationId: decl.id,
      mode: 'edition',
      erreurs,
      valeurs,
      navActive: 'biens',
    });
  });

  // POST /biens/:id/cfe/:cfeId/modifier
  app.post('/biens/:id/cfe/:cfeId/modifier', async (req, reply) => {
    const { id, cfeId } = req.params as { id: string; cfeId: string };
    const decl = await cfeRepo.trouverParId(cfeId as DeclarationCfeId);
    if (!decl || decl.bienId !== id) {
      return reply.code(404).send('Déclaration CFE introuvable pour ce bien.');
    }
    const parsed = modifierCfeSchema.safeParse(req.body);
    if (!parsed.success) {
      req.session.formErrors = formatZodErrors(parsed as never);
      req.session.formValeurs = (req.body as Record<string, unknown>) ?? {};
      return reply.redirect(`/biens/${id}/cfe/${cfeId}/editer`);
    }
    const data = parsed.data;
    const patch: Parameters<typeof modifierDeclarationCfe>[0]['patch'] = {};
    if (data.statut !== undefined) patch.statut = data.statut as StatutCfe;
    if (data.dateDepotDeclaration !== undefined) {
      patch.dateDepotDeclaration = data.dateDepotDeclaration
        ? Temporal.PlainDate.from(data.dateDepotDeclaration)
        : null;
    }
    if (data.montantAvisEuros !== undefined) {
      patch.montantAvisCentimes =
        data.montantAvisEuros !== null ? Money.fromEuros(data.montantAvisEuros) : null;
    }
    if (data.dateEcheancePaiement !== undefined) {
      patch.dateEcheancePaiement = Temporal.PlainDate.from(data.dateEcheancePaiement);
    }
    try {
      const maj = await modifierDeclarationCfe(
        { id: cfeId as DeclarationCfeId, patch },
        { cfeRepo },
      );
      req.session.banniereSuccess = `Déclaration CFE ${maj.millesime} mise à jour.`;
      return reply.redirect(`/biens/${id}`);
    } catch (err) {
      if (err instanceof DeclarationCfeIntrouvable) {
        return reply.code(404).send('Déclaration CFE introuvable.');
      }
      if (err instanceof InvariantViolated) {
        req.session.formErrors = { global: err.message };
        req.session.formValeurs = (req.body as Record<string, unknown>) ?? {};
        return reply.redirect(`/biens/${id}/cfe/${cfeId}/editer`);
      }
      throw err;
    }
  });
}

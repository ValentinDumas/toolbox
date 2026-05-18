import type { Temporal } from '@js-temporal/polyfill';
import type { Kysely } from 'kysely';

import { InvariantViolated } from '../../domain/_shared/erreurs.js';
import type { Clock } from '../../domain/_shared/clock.js';
import type {
  BienId,
  JustificatifId,
  TicketTravauxId,
} from '../../domain/_shared/identifiants.js';
import type { Money } from '../../domain/_shared/money.js';
import type { ConvertisseurImage } from '../../domain/documents/convertisseur-image.js';
import { JustificatifIntrouvable } from '../../domain/documents/erreurs.js';
import type {
  TypeJustificatif,
} from '../../domain/documents/justificatif.js';
import type { JustificatifRepository } from '../../domain/documents/justificatif-repository.js';
import type { StockageJustificatifs } from '../../domain/documents/stockage-justificatifs.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import {
  PJIncoherenteBien,
  TicketIntrouvable,
} from '../../domain/travaux/erreurs.js';
import type { TicketTravauxRepository } from '../../domain/travaux/ticket-travaux-repository.js';
import type { DB } from '../../infrastructure/db/kysely-types.js';
import { uploaderJustificatif } from '../documents/uploader-justificatif.js';

export interface AjouterPJCommandeFichier {
  buffer: Buffer;
  nomOriginal: string;
  mimeAnnonce: string;
  titre: string;
  type: TypeJustificatif;
  dateDocument: Temporal.PlainDate;
  montantTtc?: Money | null;
  notes?: string | null;
}

export interface AjouterPJCommande {
  ticketId: TicketTravauxId | string;
  // Mode 1 — upload nouveau Justificatif (réutilise pipeline 04-01)
  fichier?: AjouterPJCommandeFichier;
  // Mode 2 — attach Justificatif existant
  justificatifId?: JustificatifId | string;
}

export interface AjouterPJDeps {
  ticketRepo: TicketTravauxRepository;
  justificatifRepo: JustificatifRepository;
  bienRepo: BienRepository;
  locataireRepo: LocataireRepository;
  stockage: StockageJustificatifs;
  convertisseurImage: ConvertisseurImage;
  clock: Clock;
  db: Kysely<DB>;
}

/**
 * Use case `ajouterPJTicket` — dual-mode upload OU attach (Pattern 5
 * cross-aggregate, D-113).
 *
 * Mode 1 (fichier fourni) : appelle `uploaderJustificatif` en forçant
 * `bienId = ticket.bienId` (cohérence cross-aggregate automatique — jamais
 * d'override possible côté client, T-04-21 mitigate).
 *
 * Mode 2 (justificatifId fourni) : vérifie que `justificatif.bienId === ticket.bienId`
 * sinon throw `PJIncoherenteBien` (T-04-22 mitigate).
 *
 * Si ni fichier ni justificatifId fourni : throw InvariantViolated.
 *
 * Lier le justificatif au ticket via `ticketRepo.lierJustificatif` (idempotent
 * onConflict.doNothing — réajout silencieux).
 */
export async function ajouterPJTicket(
  cmd: AjouterPJCommande,
  deps: AjouterPJDeps,
): Promise<{ justificatifId: JustificatifId }> {
  const ticket = await deps.ticketRepo.trouverParId(cmd.ticketId);
  if (!ticket) {
    throw new TicketIntrouvable(String(cmd.ticketId));
  }

  if (cmd.fichier !== undefined && cmd.fichier !== null) {
    // Mode upload — réutilise tout le pipeline 04-01
    const { justificatifId: newJid } = await uploaderJustificatif(
      {
        titre: cmd.fichier.titre,
        type: cmd.fichier.type,
        dateDocument: cmd.fichier.dateDocument,
        bienId: ticket.bienId,
        locataireId: null,
        notes: cmd.fichier.notes ?? null,
        montantTtc: cmd.fichier.montantTtc ?? null,
        fichier: {
          buffer: cmd.fichier.buffer,
          nomOriginal: cmd.fichier.nomOriginal,
          mimeAnnonce: cmd.fichier.mimeAnnonce,
        },
      },
      deps,
    );
    await deps.ticketRepo.lierJustificatif(ticket.id, newJid);
    return { justificatifId: newJid };
  }

  if (cmd.justificatifId !== undefined && cmd.justificatifId !== null) {
    const justificatif = await deps.justificatifRepo.trouverParId(
      cmd.justificatifId,
    );
    if (!justificatif) {
      throw new JustificatifIntrouvable(String(cmd.justificatifId));
    }
    // Cohérence bienId — string-compare via String() pour brand types
    if (
      String(justificatif.bienId ?? '') !==
      String((ticket.bienId as unknown as BienId) ?? '')
    ) {
      throw new PJIncoherenteBien();
    }
    await deps.ticketRepo.lierJustificatif(ticket.id, justificatif.id);
    return { justificatifId: justificatif.id };
  }

  throw new InvariantViolated(
    'Fournir un fichier OU un justificatifId existant.',
  );
}

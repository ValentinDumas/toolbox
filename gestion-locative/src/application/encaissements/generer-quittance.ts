import path from 'node:path';
import type { Kysely } from 'kysely';

import type { DB } from '../../infrastructure/db/kysely-types.js';
import type { EcheanceLoyerId, QuittanceId } from '../../domain/_shared/identifiants.js';
import type { EcheanceLoyerRepository } from '../../domain/encaissements/echeance-loyer-repository.js';
import type { EncaissementRepository } from '../../domain/encaissements/encaissement-repository.js';
import type { QuittanceRepository } from '../../domain/encaissements/quittance-repository.js';
import type { BailleurRepository } from '../../domain/identite/bailleur-repository.js';
import type { LocataireRepository } from '../../domain/locatif/locataire-repository.js';
import type { BienRepository } from '../../domain/patrimoine/bien-repository.js';
import type { BailRepository } from '../../domain/locatif/bail-repository.js';
import type { PdfRenderer } from '../../domain/encaissements/pdf-renderer.js';
import type { Clock } from '../../domain/_shared/clock.js';
import { Quittance } from '../../domain/encaissements/quittance.js';
import {
  EcheanceLoyerIntrouvable,
  EcheanceLoyerNonPayee,
  QuittanceDejaEmise,
} from '../../domain/encaissements/erreurs.js';
import { BailleurAbsent } from '../../domain/identite/erreurs.js';
import { construireQuittance } from '../../infrastructure/pdf/quittance-doc-def.js';
import { StockageFichierLocal } from '../../infrastructure/storage/stockage-fichier-local.js';
import { formatPeriode } from '../../helpers/format-periode.js';

interface Stockage {
  ecrireQuittance(annee: number, nomFichier: string, buffer: Buffer): Promise<string>;
}

interface Repos {
  echeanceLoyerRepo: EcheanceLoyerRepository;
  encaissementRepo?: EncaissementRepository;
  quittanceRepo: QuittanceRepository;
  bailleurRepo: BailleurRepository;
  locataireRepo: LocataireRepository;
  bienRepo: BienRepository;
  bailRepo: BailRepository;
}

interface ResultatGenererQuittance {
  quittanceId: QuittanceId;
  numero: string;
  cheminFichierRelatif: string;
}

/**
 * Use case ENC-01 — Génération d'une Quittance de loyer.
 *
 * Prérequis :
 * 1. EcheanceLoyer.statut === 'payee' (sinon EcheanceLoyerNonPayee)
 * 2. Pas de Quittance ACTIVE pour cette échéance (sinon QuittanceDejaEmise)
 * 3. Bailleur renseigné (sinon BailleurAbsent)
 *
 * Atomicité (T-02-04-01) :
 * - prochainNumero + INSERT quittance dans une seule transaction Kysely
 * - Écriture PDF hors transaction (compromis acceptable — voir spec)
 */
export async function genererQuittance(
  commande: { echeanceId: EcheanceLoyerId | string },
  repos: Repos,
  pdfRenderer: PdfRenderer,
  stockage: Stockage,
  clock: Clock,
  db: Kysely<DB> | { transaction: () => { execute: (fn: (trx: unknown) => Promise<unknown>) => Promise<unknown> } },
): Promise<ResultatGenererQuittance> {
  // ─── Validations avant transaction (pas d'incrément compteur si erreur métier) ──

  // 1. Lookup echéance
  const echeance = await repos.echeanceLoyerRepo.trouverParId(commande.echeanceId);
  if (!echeance) {
    throw new EcheanceLoyerIntrouvable(String(commande.echeanceId));
  }

  // 2. Vérifier statut payée
  if (echeance.statut !== 'payee') {
    throw new EcheanceLoyerNonPayee("Cette période n'est pas entièrement réglée.");
  }

  // 3. Vérifier qu'aucune Quittance ACTIVE n'existe pour cette échéance
  const quittanceExistante = await repos.quittanceRepo.trouverActiveParEcheance(commande.echeanceId);
  if (quittanceExistante !== null) {
    throw new QuittanceDejaEmise();
  }

  // 4. Lookup bailleur
  const bailleur = await repos.bailleurRepo.trouver();
  if (!bailleur) {
    throw new BailleurAbsent();
  }

  // 5. Lookup bail
  const bail = await repos.bailRepo.trouverParId(echeance.bailId);
  if (!bail) {
    throw new EcheanceLoyerIntrouvable(`Bail introuvable pour l'échéance ${String(commande.echeanceId)}`);
  }

  // 6. Lookup locataire
  const locataire = await repos.locataireRepo.trouverParId(bail.locataireId);
  if (!locataire) {
    throw new EcheanceLoyerIntrouvable(`Locataire introuvable pour le bail ${bail.id}`);
  }

  // 7. Lookup bien
  const bien = await repos.bienRepo.trouverParId(bail.bienId);
  if (!bien) {
    throw new EcheanceLoyerIntrouvable(`Bien introuvable pour le bail ${bail.id}`);
  }

  // ─── Calcul slug et chemin ──────────────────────────────────────────────────
  const locataireSlug = StockageFichierLocal.slugify(`${locataire.nom}-${locataire.prenom}`);
  const periodeStr = formatPeriode(echeance.periodeDebut).replace(/\s+/g, '-').toLowerCase();
  const annee = echeance.periodeDebut.year;

  // ─── Transaction atomique : incrément compteur + INSERT quittance ───────────
  let quittance: Quittance;
  let numero: string;

  await (db as Kysely<DB>).transaction().execute(async (trx) => {
    numero = await repos.quittanceRepo.prochainNumero(annee, trx);
    const nomFichier = `quittance-${numero}-${periodeStr}-${locataireSlug}.pdf`;
    const cheminFichierRelatif = path.join('quittances', String(annee), nomFichier);

    quittance = Quittance.creer({
      echeanceId: echeance.id,
      numero,
      cheminFichierRelatif,
      emiseLe: clock.aujourdhui(),
    });

    await repos.quittanceRepo.enregistrer(quittance, trx);
  });

  // ─── Hors transaction : génération PDF + stockage ──────────────────────────
  const adresseBien = bien.adresse;
  const docDef = construireQuittance(
    echeance,
    bailleur,
    locataire,
    adresseBien,
    quittance!.numero,
    clock.aujourdhui(),
    bail.modeCharges,
  );

  const buffer = await pdfRenderer.genererBuffer(docDef);
  const nomFichierFinal = path.basename(quittance!.cheminFichierRelatif);
  await stockage.ecrireQuittance(annee!, nomFichierFinal, buffer);

  return {
    quittanceId: quittance!.id,
    numero: quittance!.numero,
    cheminFichierRelatif: quittance!.cheminFichierRelatif,
  };
}

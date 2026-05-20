/**
 * Ports (interfaces) — repositories Composant + ValorisationFiscale.
 *
 * Ces interfaces sont les ports de sortie du domaine (hexagonal architecture).
 * Les adapters SQLite sont dans src/infrastructure/repositories/.
 *
 * Source : analog src/domain/encaissements/encaissement-repository.ts
 * Pattern : Dependency inversion — le domaine ne connaît pas Kysely ni SQLite.
 *
 * D-FIS-G1.1, G1.4, G1.8 — Composant sub-aggregate + ValorisationFiscale VO
 */

import { Temporal } from '@js-temporal/polyfill';
import type { BienId, BailleurId, ComposantId, ValorisationFiscaleId } from '../_shared/identifiants.js';
import type { Composant } from './composant.js';
import type { ValorisationFiscale } from './valorisation-fiscale.js';

/**
 * Port ComposantRepository — D-FIS-G1.1, G1.5.
 *
 * Analog exact : EncaissementRepository.
 * Transaction passée comme paramètre (pattern hexagonal pur — pas de coupling DB dans le domaine).
 */
export interface ComposantRepository {
  /** Enregistre ou met à jour un Composant (onConflict id doUpdateSet pour sortir()) */
  enregistrer(composant: Composant, trx?: unknown): Promise<void>;

  /** Enregistre un batch de Composants en une seule transaction (activation initiale — 6 composants) */
  enregistrerBatch(composants: Composant[], trx?: unknown): Promise<void>;

  /** Lookup par id — null si inexistant */
  trouverParId(id: ComposantId): Promise<Composant | null>;

  /**
   * Liste les Composants actifs (dateSortie IS NULL OR dateSortie > today).
   * Utilisé pour le calcul d'amortissement par exercice (D-FIS-G1.6).
   */
  listerActifsParBien(bienId: BienId, today: Temporal.PlainDate): Promise<Composant[]>;

  /** Liste TOUS les Composants d'un bien (actifs + sortis) */
  listerParBien(bienId: BienId): Promise<Composant[]>;

  /**
   * Liste tous les Composants actifs pour un bailleur (JOIN via bien).
   * Single-bailleur V1 (D-LOCK-2) : pas de filtre bailleurId SQL mais paramètre préparé pour V1.1.
   */
  listerActifsPourBailleur(bailleurId: BailleurId, today: Temporal.PlainDate): Promise<Composant[]>;
}

/**
 * Port ValorisationFiscaleRepository — D-FIS-G1.4.
 *
 * 1-1 avec Bien : UNIQUE(bien_id) en base garantit idempotence.
 * La violation UNIQUE est la défense de profondeur — le use case vérifie en amont.
 */
export interface ValorisationFiscaleRepository {
  /** Enregistre la valorisation fiscale (INSERT — UNIQUE bien_id garantit idempotence) */
  enregistrer(valorisation: ValorisationFiscale, trx?: unknown): Promise<void>;

  /** Lookup par bienId — null si fiscalité non activée */
  trouverParBien(bienId: BienId): Promise<ValorisationFiscale | null>;

  /** Lookup par id */
  trouverParId(id: ValorisationFiscaleId): Promise<ValorisationFiscale | null>;
}

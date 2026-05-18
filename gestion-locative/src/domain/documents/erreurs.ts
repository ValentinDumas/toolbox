import type { Temporal } from '@js-temporal/polyfill';

/**
 * Erreurs métier BC Documents (D-106 séparation BC stricte).
 *
 * Aucune réutilisation des erreurs du BC Encaissements (FichierIntrouvable y existe
 * mais reste limité aux quittances/avenants — ici on duplique volontairement pour
 * matérialiser la frontière BC).
 */

export class FichierIntrouvable extends Error {
  constructor(public readonly cheminRelatif: string) {
    super(`Fichier introuvable : ${cheminRelatif}`);
    this.name = 'FichierIntrouvable';
  }
}

export class JustificatifIntrouvable extends Error {
  constructor(public readonly id: string) {
    super(`Justificatif introuvable : ${id}`);
    this.name = 'JustificatifIntrouvable';
  }
}

export class FormatNonAccepte extends Error {
  constructor() {
    super('Format non accepté. Formats autorisés : PDF, JPG, PNG, HEIC, WebP.');
    this.name = 'FormatNonAccepte';
  }
}

export class FichierTropVolumineux extends Error {
  constructor() {
    super('Fichier trop volumineux. La taille maximale est 50 Mo.');
    this.name = 'FichierTropVolumineux';
  }
}

export class MimeMismatch extends Error {
  constructor() {
    super(
      'Le fichier ne correspond pas au format annoncé. Le téléversement a été refusé pour des raisons de sécurité.',
    );
    this.name = 'MimeMismatch';
  }
}

export class DocumentDejaEnCorbeille extends Error {
  constructor() {
    super('Ce document est déjà en corbeille.');
    this.name = 'DocumentDejaEnCorbeille';
  }
}

export class DocumentNonEnCorbeille extends Error {
  constructor() {
    super("Ce document n'est pas en corbeille.");
    this.name = 'DocumentNonEnCorbeille';
  }
}

export class PurgeAvantDixAnsRefusee extends Error {
  constructor(
    public readonly datePurgePossible: Temporal.PlainDate,
    message: string,
  ) {
    super(message);
    this.name = 'PurgeAvantDixAnsRefusee';
  }
}

export class CheminInvalide extends Error {
  constructor() {
    super('Chemin de stockage invalide.');
    this.name = 'CheminInvalide';
  }
}

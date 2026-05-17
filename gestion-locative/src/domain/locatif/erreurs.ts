export class LocataireIntrouvable extends Error {
  constructor(id: string) {
    super(`Locataire introuvable : ${id}`);
    this.name = 'LocataireIntrouvable';
  }
}

export class BailIntrouvable extends Error {
  constructor(id: string) {
    super(`Bail introuvable : ${id}`);
    this.name = 'BailIntrouvable';
  }
}

// Phase 3 — Plan 02 : EtatDesLieux (LOC-03)

export class EtatDesLieuxIntrouvable extends Error {
  constructor(id: string) {
    super(`État des lieux introuvable : ${id}`);
    this.name = 'EtatDesLieuxIntrouvable';
  }
}

export class EDLEntreeExisteDeja extends Error {
  readonly bailId: string;
  constructor(bailId: string) {
    super(`Un EDL d'entrée actif existe déjà pour le bail ${bailId}`);
    this.name = 'EDLEntreeExisteDeja';
    this.bailId = bailId;
  }
}

export class EDLSortieExisteDeja extends Error {
  readonly bailId: string;
  constructor(bailId: string) {
    super(`Un EDL de sortie actif existe déjà pour le bail ${bailId}`);
    this.name = 'EDLSortieExisteDeja';
    this.bailId = bailId;
  }
}

export class EDLDejaAnnule extends Error {
  constructor() {
    super("Cet état des lieux est déjà annulé");
    this.name = 'EDLDejaAnnule';
  }
}

/**
 * Erreurs métier BC Travaux (D-112).
 *
 * Erreurs propres au BC Travaux — séparation BC stricte (cf. D-106).
 */

export class TicketIntrouvable extends Error {
  constructor(public readonly id: string) {
    super(`Ticket de travaux introuvable : ${id}`);
    this.name = 'TicketIntrouvable';
  }
}

export class TransitionInvalide extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransitionInvalide';
  }
}

export class CoutReelManquantPourClore extends Error {
  constructor() {
    super('Le coût réel TTC est obligatoire pour clore le ticket.');
    this.name = 'CoutReelManquantPourClore';
  }
}

export class TicketDejaAnnule extends Error {
  constructor() {
    super('Ticket déjà annulé.');
    this.name = 'TicketDejaAnnule';
  }
}

export class PJIncoherenteBien extends Error {
  constructor(message?: string) {
    super(message ?? 'Pièce jointe doit être rattachée au même bien que le ticket.');
    this.name = 'PJIncoherenteBien';
  }
}

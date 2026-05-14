export class EcheanceLoyerIntrouvable extends Error {
  constructor(id: string) {
    super(`Échéance de loyer introuvable : ${id}`);
    this.name = 'EcheanceLoyerIntrouvable';
  }
}

export class BailNonActif extends Error {
  constructor(id: string) {
    super(`Le bail n'est pas activé : ${id}`);
    this.name = 'BailNonActif';
  }
}

export class EncaissementIntrouvable extends Error {
  constructor(id: string) {
    super(`Encaissement introuvable : ${id}`);
    this.name = 'EncaissementIntrouvable';
  }
}

export class EncaissementDejaAnnule extends Error {
  constructor(id: string) {
    super(`Cet encaissement est déjà annulé : ${id}`);
    this.name = 'EncaissementDejaAnnule';
  }
}

export class EcheanceAnnulee extends Error {
  constructor(id: string) {
    super(`Impossible d'encaisser sur une échéance annulée : ${id}`);
    this.name = 'EcheanceAnnulee';
  }
}

export class EcheanceLoyerIntrouvable extends Error {
  constructor(id: string) {
    super(`Échéance de loyer introuvable : ${id}`);
    this.name = 'EcheanceLoyerIntrouvable';
  }
}

export class BailNonActif extends Error {
  constructor(id: string) {
    super(`Le bail n'est pas actif : ${id}`);
    this.name = 'BailNonActif';
  }
}

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

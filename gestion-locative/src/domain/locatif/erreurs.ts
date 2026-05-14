export class LocataireIntrouvable extends Error {
  constructor(id: string) {
    super(`Locataire introuvable : ${id}`);
    this.name = 'LocataireIntrouvable';
  }
}

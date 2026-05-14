export class BienIntrouvable extends Error {
  constructor(id: string) {
    super(`Bien introuvable : ${id}`);
    this.name = 'BienIntrouvable';
  }
}

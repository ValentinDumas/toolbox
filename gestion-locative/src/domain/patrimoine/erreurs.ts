export class BienIntrouvable extends Error {
  constructor(id: string) {
    super(`Bien introuvable : ${id}`);
    this.name = 'BienIntrouvable';
  }
}

export class DiagnosticIntrouvable extends Error {
  constructor(id: string) {
    super(`Diagnostic introuvable : ${id}`);
    this.name = 'DiagnosticIntrouvable';
  }
}

export class BailleurAbsent extends Error {
  constructor() {
    super('Aucun profil bailleur configuré. Veuillez renseigner votre profil bailleur avant de continuer.');
    this.name = 'BailleurAbsent';
  }
}

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

// Phase 3 — Plan 03 : LOC-05 gel loyer Climat F/G (D-92)

/**
 * Levée par simulerIndexationIRL quand le DPE du Bien est F ou G.
 * Defense en profondeur : la route UI a déjà filtré, mais le use case rejette
 * tout calcul d'indexation côté serveur — interdiction du décret n° 2022-1313.
 */
export class GelLoyerClimatActif extends Error {
  readonly bailId: string;
  readonly classeDpe: 'F' | 'G';

  constructor(bailId: string, classeDpe: 'F' | 'G') {
    super(
      `Gel loyer Climat actif (DPE ${classeDpe}). Toute hausse de loyer est interdite par le décret n° 2022-1313, prorogé. L'indexation ne peut pas être appliquée.`,
    );
    this.name = 'GelLoyerClimatActif';
    this.bailId = bailId;
    this.classeDpe = classeDpe;
  }
}

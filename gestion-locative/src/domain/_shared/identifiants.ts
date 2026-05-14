// Types nominaux UUID v4 pour les identifiants du domaine
// Utilise le brand pattern TypeScript pour garantir l'intégrité de type à la compilation

export type BienId = string & { readonly __brand: 'BienId' };
export type LotId = string & { readonly __brand: 'LotId' };
export type LocataireId = string & { readonly __brand: 'LocataireId' };
export type BailId = string & { readonly __brand: 'BailId' };

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function nouveauBienId(): BienId {
  return crypto.randomUUID() as BienId;
}

export function nouveauLotId(): LotId {
  return crypto.randomUUID() as LotId;
}

export function nouveauLocataireId(): LocataireId {
  return crypto.randomUUID() as LocataireId;
}

export function nouveauBailId(): BailId {
  return crypto.randomUUID() as BailId;
}

export function estBienId(s: string): s is BienId {
  return UUID_V4_REGEX.test(s);
}

export function estLotId(s: string): s is LotId {
  return UUID_V4_REGEX.test(s);
}

// Phase 2 — identifiants nouveaux agrégats
export type BailleurId = string & { readonly __brand: 'BailleurId' };
export type EcheanceLoyerId = string & { readonly __brand: 'EcheanceLoyerId' };
export type EncaissementId = string & { readonly __brand: 'EncaissementId' };
export type QuittanceId = string & { readonly __brand: 'QuittanceId' };
export type RelanceId = string & { readonly __brand: 'RelanceId' };

export function nouveauBailleurId(): BailleurId {
  return crypto.randomUUID() as BailleurId;
}

export function nouveauEcheanceLoyerId(): EcheanceLoyerId {
  return crypto.randomUUID() as EcheanceLoyerId;
}

export function nouveauEncaissementId(): EncaissementId {
  return crypto.randomUUID() as EncaissementId;
}

export function nouveauQuittanceId(): QuittanceId {
  return crypto.randomUUID() as QuittanceId;
}

export function nouveauRelanceId(): RelanceId {
  return crypto.randomUUID() as RelanceId;
}

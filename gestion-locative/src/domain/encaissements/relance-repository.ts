import type { Relance } from './relance.js';
import type { EcheanceLoyerId, RelanceId } from '../_shared/identifiants.js';

export interface RelanceRepository {
  enregistrer(relance: Relance): Promise<void>;
  trouverParId(id: RelanceId | string): Promise<Relance | null>;
  listerParEcheance(
    echeanceId: EcheanceLoyerId | string,
    opts?: { inclureAnnulees?: boolean },
  ): Promise<Relance[]>;
  listerToutes(opts?: { inclureAnnulees?: boolean }): Promise<Relance[]>;
}

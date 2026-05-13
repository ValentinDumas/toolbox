# INTEGRATIONS — Planning state

> **État** : aucune intégration implémentée.
> Liste des intégrations **prévues** dérivée de [DDD.md §7 (Anti-Corruption Layer)](../../DDD.md) et [RISKS.md](../../RISKS.md).

## Entrées prévues

| Source | Format | Bounded context cible | ACL | Cible |
|---|---|---|---|---|
| Relevés bancaires | CSV · OFX | Encaissements | `BankStatementParser` → `LigneBancaire[]` | V1 manuel, V1.1 auto |
| OCR factures / tickets | PDF · image | Documents | `OcrAdapter` → `ExtractionOCR` | V1 (avec validation humaine) |
| Indice INSEE IRL | API ou CSV | Locatif | `InseeIrlClient` → `IRL` | V1 manuel, V1.1 auto |
| Loyers de référence (zones tendues) | INSEE | Locatif | `LoyerReferenceClient` | V1.1 |
| Diagnostics (DPE, gaz, élec…) | PDF · saisie manuelle | Patrimoine | saisie manuelle | V1 |

## Sorties prévues

| Destination | Format | Cible |
|---|---|---|
| Liasse 2031 + 2033-A/G | export CSV intermédiaire + brouillon Cerfa | V1 |
| Déclaration 2042 C PRO | report manuel guidé | V1 |
| Export expert-comptable | CSV/Excel + dossier zip de justificatifs | V1 |
| **EDI-TDFC** (norme officielle) | EDI | V2 |
| Quittance / avis d'échéance | PDF (mail ou dépôt local) | V1 |
| Backup chiffré complet | ZIP (DB + justificatifs + hash) | V1 manuel, V1.1 planifié |

## Principes ([DDD.md §7](../../DDD.md))

1. Toute frontière externe passe par un **Anti-Corruption Layer**.
2. **Aucun format externe ne pénètre le domaine** — mapping VO obligatoire.
3. Le port est défini par le domaine, l'adapter est implémenté côté infra.

## Intégrations explicitement exclues

- Pas d'API publique multi-utilisateur.
- Pas de synchronisation cloud par défaut.
- Pas de mise en location (annonces, sélection de dossier).

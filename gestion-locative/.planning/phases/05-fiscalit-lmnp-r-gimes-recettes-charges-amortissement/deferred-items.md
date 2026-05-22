# Deferred Items — Phase 05 (Fiscalité LMNP)

Out-of-scope discoveries logged during plan execution. Each item names the
discovery context, the file/line, and why it was deferred. Address in a
follow-up plan or phase.

## 2026-05-22 — Plan 05-11 (gap-recap-fiscal-port-hexa)

While closing CR-06 for `exporter-pdf-recap.ts`, three additional pre-existing
hexagonal violations of the same pattern were observed in `src/application/`.
The verifier did NOT flag them (CR-06 only named `recap-fiscal-doc-def`), so
they are out of scope for plan 05-11. Same fix shape (extract port + adapter +
inject via DI) applies. Phase 2/3 work — not phase 5.

| Caller | Infrastructure dependency | Function imported | Suggested port name |
|---|---|---|---|
| `src/application/encaissements/generer-quittance.ts:22` | `src/infrastructure/pdf/quittance-doc-def.ts` | `construireQuittance` | `QuittanceBuilder` |
| `src/application/encaissements/generer-quittance.ts:23` | `src/infrastructure/storage/stockage-fichier-local.ts` | `StockageFichierLocal` (concrete class) | already exists as `Stockage` port in another file? — verify |
| `src/application/locatif/appliquer-indexation-irl.ts:26` | `src/infrastructure/pdf/avenant-irl-doc-def.ts` | `construireAvenantIRL` | `AvenantIRLBuilder` |
| `src/application/encaissements/enregistrer-relance.ts:17` | `src/infrastructure/pdf/mise-en-demeure-doc-def.ts` | `construireMiseEnDemeure` | `MiseEnDemeureBuilder` |

These violations break the CLAUDE.md non-negotiable "Domaine pur : aucun import
technique [...] dans le cœur du domaine — ports & adapters strict" rule the
same way `exporter-pdf-recap.ts:26` did. Tracking them here so a future
verification wave or refactor sprint can close them all in one batch.

The 5 type-only `Kysely<DB>` imports in `src/application/` are intentionally
left as-is — documented "acceptable" in `05-VERIFICATION.md` L32 (type-only
DB schema bridge for transactional use cases).

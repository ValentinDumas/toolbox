---
phase: 7
slug: dashboard-notifications-d-ch-ances
status: verified
threats_open: 0
asvs_level: 1
created: 2026-06-15
---

# SECURITY.md — Phase 7: Dashboard / Notifications d'échéances

**Audit date:** 2026-06-15
**ASVS Level:** 1
**block_on:** high (BLOCKER = open `mitigate` threat)
**Auditor mode:** VERIFY MITIGATIONS EXIST (register authored at plan time; no new-threat scanning)
**Architectural baseline:** Single-user local app — absence of authN/authZ/tenant isolation is accepted (D-AL-03, VISION.md)

---

## Threat Register — Verification Results

### Mitigate threats (7 total — primary audit targets)

| Threat ID | Category | Mitigation Expected | Verification | Evidence |
|-----------|----------|---------------------|--------------|----------|
| T-07-02 | I | `source.extra` contains only non-sensitive data: millesime, statutCfe, dateEcheancePaiement | CLOSED | `alerte-cfe-j30.ts:95-99` — extra fields: `millesime`, `statutCfe`, `dateEcheancePaiement` only; no credentials, no SIRET, no amounts |
| T-07-05 | I | `source.extra.adresseBien` is street address only (no PII), already shown Phase 1/3 | CLOSED | `alerte-irl.ts:103` — `extra: { adresseBien: bien.adresse.rue }` — rue only, not nom/siret/email |
| T-07-03-02 | I | `source.extra.typeDiagnostic` is non-sensitive, already on fiche Bien | CLOSED | `alerte-diagnostic.ts:67` — `extra: { typeDiagnostic: diag.type }` — value is from closed set `TypeDiagnostic = 'dpe' | 'gaz' | 'elec' | 'erp'` |
| T-07-04-04 | T | IRL "exercice courant" filter driven by clock + append-only BailIndexation | CLOSED | `calculer-toutes-alertes.ts:71` — `derniere.dateEffet.year === maintenant.year`; `alerte-irl.ts:56` — `indexationDejaPresenteExerciceCourant` param gates the alert |
| T-07-05-01 | I/XSS | `<%= %>` for all dynamic values in partial-bandeau-alerte.ejs + accueil.ejs; CSP script-src 'self' 'unsafe-inline' at main.ts | CLOSED | `partial-bandeau-alerte.ejs:55-79` — all 11 dynamic outputs use `<%= %>`; zero `<%-` on data (only on `include()`). `accueil.ejs:1-142` — all 17 dynamic outputs use `<%= %>`; `<%-` only for `include()` calls (lines 1, 33, 142). `main.ts:227-229` — CSP header `script-src 'self' 'unsafe-inline'` applied globally via `onSend` hook |
| T-07-05-02 | I | external CFE link `impots.gouv.fr` target=_blank uses `rel="noopener noreferrer"` | CLOSED | `partial-bandeau-alerte.ejs:69` — `rel="noopener noreferrer"` present on the single external link |
| T-07-06-01 | I/XSS | `<%= %>` for all dynamic data in indexations.ejs; `<%-` only for partial includes | CLOSED | `indexations.ejs:31-35` — 4 dynamic outputs all use `<%= %>`; `<%-` only for `include()` calls (lines 1, 11, 34, 42) |
| T-07-06-03 | T | `/baux/indexations` static route declared BEFORE `/baux/:id` parametric route | CLOSED | `baux.ts:144` declares `GET /baux/indexations`; `baux.ts:297` declares `GET /baux/:id` — static route registered 153 lines earlier; find-my-way resolves statics over parametrics regardless of order, but declaration order is also correct |

### Accept threats (16 total — verify premise still holds in code)

| Threat ID | Category | Accepted Premise | Premise Verified | Evidence |
|-----------|----------|-----------------|-----------------|----------|
| T-07-01 | T | urlAction built from UUID v4 brand types, no user input; EJS `<%= %>` escapes | CLOSED | `alerte-cfe-j30.ts:90` — urlAction template-literal with `d.bienId` (BienId brand) and `d.id` (DeclarationCfeId brand); `identifiants.ts` — both types validated by UUID_V4_REGEX at construction |
| T-07-03 | D | Single-user, bounded volume, O(n log n) | CLOSED | Single-user baseline accepted (VISION.md); loop in `alerte-cfe-j30.ts:82-103` is O(n) over bounded declarations |
| T-07-04 | T | bailId brand UUID v4; EJS escaping | CLOSED | `alerte-irl.ts:98` — urlAction uses `bail.id` (BailId brand); `alerte-fin-bail.ts:79` — urlAction uses `bail.id`; both rendered via `<%= %>` in partial |
| T-07-06 | D | Single-user, bounded | CLOSED | Single-user baseline; loops in `alerte-irl.ts:85` and `alerte-fin-bail.ts:70` over baux collection |
| T-07-03-01 | T | bien.id brand UUID; diag.type closed set TYPES_DIAGNOSTIC | CLOSED | `alerte-diagnostic.ts:62` — urlAction uses `bien.id` (BienId brand) and `diag.type` from TypeDiagnostic closed set (`duree-validite-diagnostic.ts:17`); ERP excluded via `dateExpiration === null` check at line 51 |
| T-07-03-03 | D | Bounded double loop biens × TYPES_DIAGNOSTIC | CLOSED | `alerte-diagnostic.ts:43-44` — outer loop over biens, inner over TYPES_DIAGNOSTIC (4 fixed values) |
| T-07-04-01 | T | aggregated urlAction in EJS — domain-built brand UUIDs, aggregator concatenates only | CLOSED | `calculer-toutes-alertes.ts:77-84` — aggregator calls 4 pure domain functions, no urlAction construction; all urlAction strings built in domain functions with brand-typed IDs |
| T-07-04-02 | I | Single-user, owner of all data — cross-Bien aggregation acceptable | CLOSED | Single-user baseline; `calculer-toutes-alertes.ts:57-84` aggregates all biens for the sole user |
| T-07-04-03 | D | Bounded, same pattern as Phase 6 prod — Promise.all(biens.map(...)) | CLOSED | `calculer-toutes-alertes.ts:57,63,68` — three Promise.all over bounded collections |
| T-07-05-03 | I | Single-user — cross-Bien aggregation on one page | CLOSED | Single-user baseline; dashboard shows all biens to the owner |
| T-07-05-04 | D | GET / aggregates N repos — bounded <20 baux, <100ms SQLite | CLOSED | `racine.ts:64-165` — aggregation via calculerToutesAlertes + listerImpayes + echeanceLoyerRepo; all SQLite-backed, bounded |
| T-07-05-05 | T | estPremierLancement computed server-side from DB each request | CLOSED | `racine.ts:56-59` — `estPremierLancement(opts.db)` called on every GET /; redirect to /wizard/bien if true; no client-controllable bypass |
| T-07-06-02 | I | Single-user, owner of all tenant data | CLOSED | Single-user baseline; `locatairesParBail` map built server-side and rendered |
| T-07-06-04 | D | GET /baux/indexations loops baux × dernierePourBail — bounded <20 baux | CLOSED | `baux.ts:154-162` — Promise.all over baux; bounded single-user collection |
| T-07-06-05 | I | No external links on /baux/indexations — internal links only | CLOSED | `indexations.ejs` — links to `/baux/<refId>` and `/baux/<refId>/indexer` only; no target=_blank |

---

## Unregistered Flags

No SUMMARY.md threat flags map outside the registered threat IDs above. No unregistered_flag items to report.

---

## Accepted Risks Log

All `accept` threats in the register rely on the single-user, local-first architectural baseline documented in VISION.md (constraint D-AL-03). This baseline is verified to hold: no multi-user paths, no network-exposed auth surface, no tenant data mixing possible in the implemented code.

---

## Notes

- `unsafe-inline` in CSP script-src is acknowledged in main.ts:222-224 as a known interim state pending nonce migration (comment: "IN-05"). This weakens XSS defense-in-depth but does not constitute a new finding — it is the declared disposition of T-07-05-01.
- `diag.type` in urlAction anchor (`#diag-${diag.type}`) is constrained to TypeDiagnostic closed set (`'dpe' | 'gaz' | 'elec' | 'erp'`), not user-provided. Safe.
- Route ordering for T-07-06-03: find-my-way (Fastify's router) resolves static segments over parametric regardless of declaration order. The implementation also registers the static route first (line 144 vs 297), satisfying both the documented mitigation and the router's built-in behavior.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-06-15 | 23 | 23 | 0 | gsd-security-auditor (verify-mitigations mode) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-06-15

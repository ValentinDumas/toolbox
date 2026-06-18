---
phase: 10-dette-technique-consolidation-atomicit
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - gestion-locative/src/application/locatif/appliquer-indexation-irl.ts
  - gestion-locative/src/application/locatif/modifier-bail-actif.ts
  - gestion-locative/src/domain/encaissements/echeance-loyer-repository.ts
  - gestion-locative/src/domain/locatif/bail-repository.ts
  - gestion-locative/src/infrastructure/repositories/bail-repository-sqlite.ts
  - gestion-locative/src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
  - gestion-locative/src/main.ts
  - gestion-locative/src/web/routes/baux.ts
  - gestion-locative/src/web/views/pages/baux/indexations.ejs
  - gestion-locative/src/web/views/partials/_bandeau-cfe-corps.ejs
  - gestion-locative/src/web/views/partials/partial-bandeau-alerte.ejs
  - gestion-locative/src/web/views/partials/partial-bandeau-cfe-echeance.ejs
  - gestion-locative/tests/unit/application/locatif/atomicite-appliquer-indexation-irl.test.ts
  - gestion-locative/tests/unit/application/locatif/atomicite-modifier-bail-actif.test.ts
  - gestion-locative/tests/unit/locatif/modifier-bail-actif.test.ts
  - gestion-locative/tests/unit/views/bandeau-cfe-consolidation.test.ts
findings:
  critical: 3
  warning: 3
  info: 1
  total: 7
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-06-18
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Phase 10 consolidates duplicate CFE banner partials into a shared `_bandeau-cfe-corps` partial, unifies the IRL alert enrichment path, and (highest-risk) wraps multi-table DB writes in Kysely enveloping transactions with an opaque `trxArg` threaded through ports.

The transaction architecture is sound: the opaque-`trxArg` pattern in ports correctly avoids leaking Kysely into the domain, both `BailRepositorySqlite` and `EcheanceLoyerRepositorySqlite` handle the `trxArg` path correctly, and the rollback tests exercise the actual integration path with an in-memory SQLite. The CFE partial consolidation achieves the intended behavior-preserving refactor and the snapshot tests confirm it.

Three blockers were found: a data-loss bug in `appliquer-indexation-irl.ts` when `actifDepuis` is null inside the transaction (orphan delete with no re-insert and a silent zero count), an XSS injection surface in `partial-bandeau-alerte.ejs` via unescaped `urlAction`, and a `cautionnement` always-cleared bug in the `modifier-bail-actif` route. Two additional warnings cover the preview showing stale data (confusing UX + test gap) and a timezone-sensitive snapshot test.

---

## Critical Issues

### CR-01: Orphan delete + silent data loss when `actifDepuis` is null inside `appliquerIndexationIRL` transaction

**File:** `gestion-locative/src/application/locatif/appliquer-indexation-irl.ts:169-184`

**Issue:** Inside `db.transaction().execute`, `supprimerLot` is called unconditionally when `aRegenerer.length > 0`, but `enregistrerBatch` is guarded by a second condition `bailModifie.actifDepuis !== null`. If that second guard is false the transaction commits with echéances physically deleted and nothing reinserted. The return value also reports `echeancesRegenerees: 0`, hiding the data loss entirely. In practice `actifDepuis` should never be null for an active bail, but the pre-condition is only checked at the start of the function as `bail.actifDepuis` — the bail after `appliquerIndexation` could theoretically produce a different value. More importantly the missing invariant guard makes the code's safety reasoning locally invisible.

```typescript
// Current (lines 169–184):
if (aRegenerer.length > 0) {
  await repos.echeanceLoyerRepo.supprimerLot(aRegenerer.map((e) => e.id), trx);
  if (bailModifie.actifDepuis !== null) {       // ← second guard can be false
    // ...enregistrerBatch only runs here
    echeancesRegenereesCount = nouvellesFiltrees.length;
  }
  // If actifDepuis is null: échéances deleted, none inserted, count stays 0
}
```

**Fix:** Assert the invariant before entering the transaction branch, or collapse the two guards:

```typescript
// Promote the guard to an invariant throw before the transaction:
if (bailModifie.actifDepuis === null) {
  throw new InvariantViolated(
    'appliquerIndexationIRL: bailModifie.actifDepuis est null — invariant impossible après appliquerIndexation',
  );
}

// Then inside the transaction, the guard is gone and both writes are unconditional:
if (aRegenerer.length > 0) {
  await repos.echeanceLoyerRepo.supprimerLot(aRegenerer.map((e) => e.id), trx);
  const nouvelles = genererEcheancesPour(bailModifie, bailModifie.actifDepuis, bailModifie.jourEcheance);
  const aRegenererSet = new Set(aRegenerer.map((e) => e.periodeDebut.toString()));
  const nouvellesFiltrees = nouvelles.filter((n) => aRegenererSet.has(n.periodeDebut.toString()));
  if (nouvellesFiltrees.length > 0) {
    await repos.echeanceLoyerRepo.enregistrerBatch(nouvellesFiltrees, trx);
    echeancesRegenereesCount = nouvellesFiltrees.length;
  }
}
```

---

### CR-02: XSS injection via unescaped `urlAction` in `partial-bandeau-alerte.ejs`

**File:** `gestion-locative/src/web/views/partials/partial-bandeau-alerte.ejs:34-44`

**Issue:** `alerte.urlAction` is concatenated into raw HTML strings which are then emitted with `<%-` (unescaped output) via `_bandeau-cfe-corps`:

```ejs
lienAction = '<a href="' + alerte.urlAction + '" role="button">Lancer la révision IRL</a>';
// ...
blocActions = '<p>\n        ' + lienAction + '\n      </p>';
```

Then at line 47: `<%- include('_bandeau-cfe-corps', { ..., blocActions, ... }) -%>`

And in `_bandeau-cfe-corps.ejs` line 55: `<%- blocActions %>` (unescaped).

If `urlAction` contains `"` or a `javascript:` URI (e.g. injected via a crafted bail record), this is a stored XSS. The value reaches here via `calculerAlertesIrl` → `Alerte.urlAction` which is constructed from `bail.id` (UUID, safe) — but that chain is not enforced at the template layer. The Content-Security-Policy in `main.ts` includes `'unsafe-inline'` for scripts, so CSP does not mitigate a `javascript:` href.

**Fix:** Use EJS-escaped output (`<%= %>`) for `urlAction` by restructuring `blocActions` from a raw HTML string to structured data, or escape `urlAction` at construction time in the partial:

```ejs
<%
  // Escape urlAction before embedding in href attribute
  const urlActionSafe = (alerte.urlAction || '').replace(/"/g, '&quot;');
  // ... use urlActionSafe in href
  lienAction = '<a href="' + urlActionSafe + '" role="button">Lancer la révision IRL</a>';
%>
```

The cleaner fix is to restructure `blocActions` as structured data (`{ href, label }`) and render it with `<%= %>` in `_bandeau-cfe-corps` so EJS auto-escapes.

---

### CR-03: `cautionnement` always overwritten to `null` when modifying an active bail

**File:** `gestion-locative/src/web/routes/baux.ts:700-703`

**Issue:** In the POST `/baux/:id/modifier-actif` confirmation branch:

```typescript
const cautionnement = cautionnementCommande
  ? Cautionnement.creer(cautionnementCommande)
  : null;

const result = await modifierBailActif(
  {
    bailId: id as BailId,
    patch: {
      loyerHc: Money.fromEuros(data.loyerHcEuros),
      // ...
      ...(cautionnement !== undefined && { cautionnement }),  // ← always true
    },
    confirmation: 'oui',
  },
  // ...
);
```

`cautionnement` is typed as `Cautionnement | null`, never `undefined`. The spread condition `cautionnement !== undefined` is always `true`. When a bailleur submits the form to change only `loyerHc` without filling the cautionnement fields, `cautionnementCommande` evaluates to `null` (lines 664–686), so `cautionnement` is `null`, and the patch unconditionally includes `{ cautionnement: null }`, erasing any existing cautionnement on the bail. This is silent data loss.

**Fix:** Only include `cautionnement` in the patch when cautionnement data was explicitly submitted:

```typescript
const patch: ModifierBailPatch = {
  loyerHc: Money.fromEuros(data.loyerHcEuros),
  modeCharges: data.modeCharges,
  montantCharges: Money.fromEuros(data.montantChargesEuros),
  depotGarantie: Money.fromEuros(data.depotGarantieEuros),
  irlReference: IRL.creer({ trimestre: data.irlTrimestre, valeur: data.irlValeur }),
};
// Only patch cautionnement if the user explicitly submitted cautionnement fields
if (cautionnement !== null) {
  patch.cautionnement = cautionnement;
}
```

Alternatively gate on `cautionnementCommande !== null` before adding to the patch.

---

## Warnings

### WR-01: Preview always computed with empty patch (`{}`) — user-submitted values ignored

**File:** `gestion-locative/src/web/routes/baux.ts:638-645`

**Issue:** In the POST `/baux/:id/modifier-actif` non-confirmation branch (lines 624–660), the route has already successfully parsed `data` via `bailCreationSchema.safeParse(body)`. Despite having the parsed form values, the preview call uses `patch: {}`:

```typescript
const result = opts.db ? await modifierBailActif(
  { bailId: id as BailId, patch: {}, confirmation: 'previsualiser' },  // ← empty patch, not data
  ...
) : null;
```

The preview only shows how many echéances would be regenerated, not which amounts they'd carry. This is consistent in outcome (the count is determined by future-without-encaissement status, not loyer amount), but the intent of the preview step is to show the user the impact of their specific change. More critically, this same code path is used at line 639 for the confirmation review step, so the page shown before "confirmer" always shows the old-values preview rather than what they're about to confirm. If `ModifierBailPatch` ever grows to include date-changing fields that affect which echéances are "future", the preview would be silently wrong.

There is no test covering the preview-with-actual-patch scenario.

**Fix:** Pass the actual patch values to the preview call:

```typescript
const result = opts.db ? await modifierBailActif(
  {
    bailId: id as BailId,
    patch: {
      loyerHc: Money.fromEuros(data.loyerHcEuros),
      modeCharges: data.modeCharges,
      montantCharges: Money.fromEuros(data.montantChargesEuros),
      depotGarantie: Money.fromEuros(data.depotGarantieEuros),
      irlReference: IRL.creer({ trimestre: data.irlTrimestre, valeur: data.irlValeur }),
    },
    confirmation: 'previsualiser',
  },
  ...
) : null;
```

---

### WR-02: Snapshot test `formatDate` stub is timezone-dependent

**File:** `gestion-locative/tests/unit/views/bandeau-cfe-consolidation.test.ts:13-16`

**Issue:** The `formatDate` stub in the test constructs a `Date` object from an ISO string:

```typescript
function formatDate(date: Date | string): string {
  const d = new Date(date as string);
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
```

`new Date('2026-12-15')` (ISO date-only string) is parsed as UTC midnight. `toLocaleDateString('fr-FR')` renders in the system's local timezone. In UTC-negative timezones (e.g., CI running in UTC-5), `2026-12-15T00:00:00Z` becomes `2026-12-14T19:00:00-05:00` and the snapshot would render `14/12/2026` instead of `15/12/2026`. The inline snapshot would then fail on any CI runner west of UTC+0.

**Fix:** Use a fixed timezone-safe construction:

```typescript
function formatDate(date: Date | string): string {
  // Temporal.PlainDate → format directly without Date object (avoids UTC/local shift)
  if (typeof date === 'string') {
    const [year, month, day] = date.split('-').map(Number);
    return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
  }
  // For Date objects: use UTC getters to avoid TZ shift
  const d = date as Date;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}
```

---

### WR-03: `opts.db` unguarded non-null assertion on POST confirmation path

**File:** `gestion-locative/src/web/routes/baux.ts:710`

**Issue:** On the confirmation branch (`confirmation === 'oui'`), `opts.db` is accessed via non-null assertion `opts.db!` without any prior null-check, while `opts.db` is declared as optional (`db?: Kysely<DB>`):

```typescript
// line 710
opts.db!,  // ← no guard — TypeError at runtime if db is not wired
```

The GET and preview POST paths both guard with `if (opts.db)` before calling `modifierBailActif`. The confirmation path does not. If a route is registered without `db` (possible since all `opts` fields post-`bailRepo` are optional), a successful form submission with `confirmation=oui` throws an uncatchable TypeError inside the try-catch (since it's at the call site argument position, before the catch block can intercept it — though Fastify's global error handler would catch it at the plugin level). It would produce a 500 with an opaque message rather than a useful error.

**Fix:** Add an explicit guard before the confirmation block, matching the pattern already used elsewhere in the file:

```typescript
if (!opts.echeanceLoyerRepo || !opts.encaissementRepo || !opts.db) {
  return reply.code(500).send('Dépendances manquantes pour modifier un bail actif.');
}
```

This guard already exists at the top of the route for `echeanceLoyerRepo` and `encaissementRepo` (line 574) but does not include `opts.db`.

---

## Info

### IN-01: Inconsistent "future" predicate between the two use-cases (`jourEcheanceAttendue` vs `periodeDebut`)

**File:** `gestion-locative/src/application/locatif/modifier-bail-actif.ts:75` vs `gestion-locative/src/application/locatif/appliquer-indexation-irl.ts:139`

**Issue:** The two use-cases implement the "is this echéance in the future?" filter differently:

- `modifierBailActif` (line 75): `Temporal.PlainDate.compare(echeance.jourEcheanceAttendue, today) > 0`
- `appliquerIndexationIRL` (line 139): `Temporal.PlainDate.compare(e.periodeDebut, dateEffet) < 0` (inverted — skip if before dateEffet)

`jourEcheanceAttendue` and `periodeDebut` are often equal (echéance due on day 1 of the period) but diverge when `jourEcheance != 1`. In that case the two use-cases would produce different regeneration sets for the same bail state. No test exercises `jourEcheance != 1` cross-case. The difference is intentional for `appliquerIndexationIRL` (filters by `dateEffet` not today), but the use of `periodeDebut` rather than `jourEcheanceAttendue` in that case is not documented as a deliberate choice.

Worth a comment in `appliquer-indexation-irl.ts` explaining why `periodeDebut >= dateEffet` is the correct anchor point for the indexation use-case.

---

_Reviewed: 2026-06-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

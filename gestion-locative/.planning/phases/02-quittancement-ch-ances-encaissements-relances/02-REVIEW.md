---
phase: 02-quittancement-ch-ances-encaissements-relances
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - src/web/views/partials/empty-state.ejs
  - src/web/views/pages/quittances/liste.ejs
  - src/web/views/pages/quittances/fiche.ejs
  - src/web/views/pages/bailleur/profil.ejs
  - src/web/views/pages/baux/detail.ejs
  - src/web/views/pages/relances/liste.ejs
  - src/web/routes/echeances.ts
  - src/web/routes/relances.ts
  - src/web/views/pages/echeances/liste-globale.ejs
  - src/web/views/pages/relances/ouverture-mail.ejs
  - src/application/encaissements/lister-echeances.ts
  - src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts
  - src/domain/encaissements/echeance-loyer-repository.ts
  - tests/integration/repositories/echeance-loyer-repository-sqlite.test.ts
  - tests/integration/web/relances-mailto.test.ts
  - tests/unit/views/empty-state.test.ts
  - tests/bdd/features/gaps-g6-g7.feature
  - tests/bdd/step_definitions/gaps-g6-g7.steps.ts
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 02: Code Review Report (Gap-Closure G6/G7/G8)

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

This review covers the gap-closure files for G6 (vue globale /echeances), G7 (CTA quittances), and G8 (relance-mailto auto-trigger). The domain port, application layer, and EJS views are generally sound. Route-level null handling and session management are correct. The global helpers (`formatDate`, `formatMoney`, `formatPeriode`) are correctly injected via the global `preHandler` hook so the views can safely reference them without explicit per-route injection.

Three areas require attention before this code ships:

1. **`enregistrerBatch` has no conflict guard** — a duplicate-submit or retry will throw a SQLite UNIQUE constraint violation that propagates as an unhandled 500.
2. **`raisonAnnulation` null-concatenation** in `quittance/fiche.ejs` will render "Raison : null" literally when a cancelled quittance lacks a reason — possible given the DB column is nullable with no CHECK constraint.
3. Minor quality issues in tests: unnecessary `as any` cast, a hardcoded wrong `periode_fin` in the BDD helper, and the `ctaAlt` branch in `empty-state` is not tested.

---

## Critical Issues

### CR-01: `enregistrerBatch` has no `onConflict` guard — throws unhandled 500 on duplicate call

**File:** `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts:41-49`

**Issue:** `enregistrerBatch` performs a bare `insertInto` with no `onConflict` clause. The single-record variant `enregistrer` (line 28) correctly uses `.onConflict(oc => oc.column('id').doUpdateSet(...))`. The batch variant does not. If `activerBail` is triggered twice on the same bail (double-submit, client retry, or accidental re-activation), the second invocation passes the HTTP guard at line 94 (`bail.actifDepuis !== null`) only if the session was not committed yet — a narrow but real window — and then `enregistrerBatch` re-inserts the same UUIDs, causing SQLite to throw `UNIQUE constraint failed: echeance_loyer.id`. This is not caught anywhere in the call stack and surfaces as an HTTP 500 with no user-actionable error message.

**Fix:**
```typescript
async enregistrerBatch(echeances: EcheanceLoyer[]): Promise<void> {
  await this.db.transaction().execute(async (trx) => {
    for (const e of echeances) {
      await trx
        .insertInto('echeance_loyer')
        .values(this.versRow(e))
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
    }
  });
}
```

`doNothing()` is the right semantics: if the écheance already exists in full, there is nothing to update (unlike the single-record `enregistrer` which is used for status mutations).

---

## Warnings

### WR-01: `quittance.raisonAnnulation` concatenated without null guard — renders "Raison : null" literally

**File:** `src/web/views/pages/quittances/fiche.ejs:13-15`

**Issue:** The warning banner string is built by direct concatenation:
```js
warning: '...' + quittance.raisonAnnulation + '. Le PDF original reste consultable.'
```
The domain type declares `raisonAnnulation: string | null` (quittance.ts:39). The DB column `raison_annulation TEXT NULL` has no CHECK constraint enforcing `NOT NULL WHEN annulee_le IS NOT NULL`. A quittance loaded from DB with `annulee_le IS NOT NULL` but `raison_annulation IS NULL` (possible via direct DB edit, future migration, or data import) will render the warning with the literal text "Raison : null. Le PDF original reste consultable." — incorrect and confusing to the user.

**Fix:**
```ejs
warning: 'Quittance annulée le '
  + (locals.formatDate ? locals.formatDate(quittance.annuleeLe) : quittance.annuleeLe.toString())
  + (quittance.raisonAnnulation ? ' — Raison : ' + quittance.raisonAnnulation : '')
  + '. Le PDF original reste consultable.'
```

### WR-02: `as any` double-cast in `relances-mailto.test.ts` suppresses Kysely type-checking on `relance` insert

**File:** `tests/integration/web/relances-mailto.test.ts:119,127`

**Issue:**
```typescript
await (db as any).insertInto('relance').values({
  ...
} as any).execute();
```
The `relance` table is fully typed in `DB` (see `kysely-types.ts:150`), so `db.insertInto('relance')` is valid without any cast. The `as any` on the values object bypasses column-type checking, meaning a schema change to `RelanceTable` (e.g., renaming a column or changing its type) will not surface as a compile error in this test. The test silently becomes out-of-sync with the schema.

**Fix:**
```typescript
await db.insertInto('relance').values({
  id,
  echeance_id: echeanceId,
  niveau,
  canal: niveau === 3 ? ('pdf' as const) : ('email' as const),
  envoyee_le: envoyeeLe,
  contenu_snapshot: JSON.stringify({ version: 'v1', variables: {}, contenuRendu: 'Test',
    mailtoUri: niveau < 3 ? 'mailto:test@example.fr?subject=Test' : null }),
  annule_le: null,
}).execute();
```

### WR-03: Hardcoded `periode_fin: '2026-${mois}-28'` is wrong for months with 29/30/31 days

**File:** `tests/bdd/step_definitions/gaps-g6-g7.steps.ts:121`

**Issue:**
```typescript
periode_fin: `2026-${mois}-28`,
```
This assigns the 28th as the period end for every month regardless of the actual last day. Months 1, 3, 5 (January, March, May) have 31 days; the BDD scenarios create up to 5 échéances (months 01–05), so month 01 gets `periode_fin = '2026-01-28'` instead of `'2026-01-31'`. The domain and PDF renderer both use `periodeFin` for display (avis d'échéance, quittance). Test data that disagrees with what `activerBail` would actually produce means this test helper does not faithfully replicate production state, and period-boundary assertions in future tests would silently pass on wrong data.

**Fix:**
```typescript
// Replace the hardcoded 28 with the actual last day of the month:
import { Temporal } from '@js-temporal/polyfill';
// ...
const debut = Temporal.PlainDate.from(`2026-${mois}-01`);
const fin = debut.with({ day: debut.daysInMonth });
// ...
periode_fin: fin.toString(),   // '2026-01-31', '2026-02-28', etc.
```

### WR-04: `ctaAlt` branch in `empty-state.ejs` has no test coverage

**File:** `tests/unit/views/empty-state.test.ts` (missing cases) / `src/web/views/partials/empty-state.ejs:7-9`

**Issue:** The test suite covers the primary CTA (`ctaUrl` + `ctaLabel`) and the no-CTA cases, but never exercises the `ctaAlt` branch:
```ejs
<% if (locals.ctaAlt) { %>
  <a href="<%= locals.ctaAlt.url %>" role="button" class="secondary"><%= locals.ctaAlt.label %></a>
<% } %>
```
If `ctaAlt` is truthy but `ctaAlt.url` or `ctaAlt.label` is undefined, the rendered output will contain `href="undefined"` or empty link text — no error thrown, silent bad HTML. No regression guard exists.

**Fix:** Add two test cases to `empty-state.test.ts`:
```typescript
it('rend le lien CTA alternatif quand ctaAlt est fourni', async () => {
  const html = await rendre({
    heading: 'Vide', body: 'Texte',
    ctaUrl: '/foo', ctaLabel: 'Foo',
    ctaAlt: { url: '/bar', label: 'Bar' },
  });
  expect(html).toContain('<a href="/bar" role="button" class="secondary">Bar</a>');
});

it('ne rend pas le CTA alternatif quand ctaAlt est absent', async () => {
  const html = await rendre({ heading: 'Vide', body: 'Texte' });
  expect(html).not.toContain('class="secondary"');
});
```

---

## Info

### IN-01: `build-mailto.ts` — `to` address not percent-encoded in the final URI

**File:** `src/helpers/build-mailto.ts:46`

**Issue:**
```typescript
return `mailto:${to}?subject=${subjectEnc}${ccPart}&body=${bodyFinal}`;
```
Per RFC 6068, the `to` component of a mailto URI must be percent-encoded. For standard email addresses this is a no-op (no characters need encoding), but an address with a display name (e.g., `"Marie Martin" <marie@example.fr>`) or uncommon characters would produce a syntactically invalid URI. In practice `locataire.email` is validated on entry, so risk is low. Noted for completeness.

**Fix:**
```typescript
return `mailto:${encodeURIComponent(to)}?subject=${subjectEnc}${ccPart}&body=${bodyFinal}`;
```

### IN-02: `listerTous` on `EcheanceLoyerRepository` includes soft-deleted rows by default — design tradeoff to document

**File:** `src/infrastructure/repositories/echeance-loyer-repository-sqlite.ts:109-122` / `src/domain/encaissements/echeance-loyer-repository.ts:28-35`

**Issue:** `listerTous()` with no filters returns all rows including those with `annule_le IS NOT NULL`. The `GET /echeances` route passes no `annule_le IS NULL` filter, so the global list shows cancelled échéances by default alongside active ones. The port JSDoc documents this intent. The view (`liste-globale.ejs`) handles the `annulee` statut gracefully. However the behaviour diverges from `listerParBail` (which always excludes `annule_le IS NOT NULL`). The asymmetry is a potential source of confusion for future contributors. No code change is required given the documented intent, but a brief inline comment in the route would help:

```typescript
// Note : listerTous inclut les échéances annulées (annule_le IS NOT NULL) — comportement
// intentionnel pour la vue globale (audit trail). Voir EcheanceLoyerRepository.listerTous JSDoc.
const echeances = await listerToutesEcheances(filtres, opts.echeanceLoyerRepo);
```

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

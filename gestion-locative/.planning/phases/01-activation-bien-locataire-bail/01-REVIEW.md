---
phase: 01-activation-bien-locataire-bail
reviewed: 2026-05-16T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/web/views/pages/erreur.ejs
  - src/web/schemas/bien-schemas.ts
  - src/web/routes/wizard.ts
  - src/main.ts
  - src/web/views/pages/wizard/bien.ejs
  - src/web/views/pages/wizard/locataire.ejs
  - src/web/views/pages/biens/detail.ejs
  - tests/integration/wizard/wizard-validation-erreurs.test.ts
  - tests/integration/wizard/wizard-skippable.test.ts
  - tests/unit/web/bien-schemas.test.ts
  - tests/bdd/features/activation.feature
  - tests/bdd/step_definitions/activation.steps.ts
  - tests/unit/patrimoine/bien.test.ts
findings:
  critical: 2
  warning: 4
  info: 3
  total: 9
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-16T00:00:00Z
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

The wizard activation flow and associated validation schemas are generally well-structured, with correct use of Zod `superRefine`, proper session guards, and appropriate error handling in all POST routes. The BDD and integration test coverage is solid for the happy path and the two gap-closure scenarios.

However, two blockers surface: an XSS vector in the `confirm-dialog` partial where EJS-escaped values are injected into a JavaScript string literal without JS escaping, and a silent data-integrity bypass where the `terminer` guard calls `marquerWizardComplete` but never `await`s a session save, leaving a window where the wizard flag is written to the DB while the session may not yet reflect it across a concurrent tab. Two further warnings and three info items are catalogued below.

---

## Critical Issues

### CR-01: XSS — `dialogId` injected raw into JavaScript string in confirm-dialog partial

**File:** `src/web/views/partials/confirm-dialog.ejs:17`

**Issue:** EJS `<%= %>` HTML-encodes `dialogId` for HTML attribute contexts, but on line 17 the same value is placed inside a JavaScript string literal inside an inline `<script>` block:

```js
onclick="document.getElementById('<%= dialogId %>').close()"
```

and on lines 30–33:

```js
document.querySelectorAll('[data-open-dialog="<%= dialogId %>"]').forEach(...)
document.getElementById('<%= dialogId %>').showModal();
```

HTML encoding (`&quot;`, `&#x27;`, etc.) does **not** protect against JavaScript string injection. If `dialogId` were ever derived from attacker-controlled input (e.g., a lot ID containing `'); alert(1);//`), this would execute arbitrary JavaScript. In the current code, `lot.id` and `bien.id` are UUIDs generated server-side, so immediate exploitation is blocked — but only by an accident of the data model, not by code design. The injection surface exists and will fire if a non-UUID ID is ever stored or if the partial is reused with a different source.

In `detail.ejs` at line 63, the `actions` callback in `data-table` returns a raw HTML string that is rendered via `<%- %>` (unescaped), and it embeds `lot.id` in `data-open-dialog="dialog-supprimer-lot-" + lot.id`. The entire HTML string from `actions` is output unescaped — this is the second XSS surface.

**Fix:** JS-escape values before embedding them in `<script>` blocks. For UUIDs specifically, assert the format before use. A minimal defence for the inline `<script>`:

```js
// In confirm-dialog.ejs — replace raw interpolation with JSON.stringify
document.querySelectorAll('[data-open-dialog=' + JSON.stringify('<%= dialogId %>') + ']')
```

The safer long-term fix is to remove all inline script from the partial entirely, and use a single external script that reads `data-*` attributes — which also removes the need for `'unsafe-inline'` in the CSP (the CSP comment in `main.ts:133` explicitly notes this as a known debt).

---

### CR-02: Hardcoded invalid `codePostal` default `'00000'` bypasses domain invariant for garant address

**File:** `src/web/routes/wizard.ts:274`

**Issue:** When `data.garantCodePostal` is absent (the user submitted a `physique` cautionnement but left the code postal blank), the route silently substitutes `'00000'`:

```ts
codePostal: data.garantCodePostal ?? '00000',
```

`Adresse.creer` only checks that `codePostal` is not empty — `'00000'` is non-empty, so the domain invariant passes. The result is a persisted garant address containing a fictitious postal code that will silently appear in generated PDF documents (quittances, relances). No schema-level validation enforces that `garantCodePostal` must be a valid 5-digit French code when `cautionnementType === 'physique'`.

The `wizardBailSchema` only validates the garant address fields as `optional()` with no conditional requirements, so the `superRefine` block (lines 60–70) checks name, prenom, and email for `physique` but not rue/codePostal/ville. This means a bailleur can create a valid bail with a garant whose address is all empty strings and `'00000'`.

**Fix:** In `wizardBailSchema.superRefine`, add checks for the three address fields when `cautionnementType === 'physique'`:

```ts
if (data.cautionnementType === 'physique') {
  if (!data.garantRue?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['garantRue'], message: 'La rue du garant est obligatoire' });
  }
  if (!data.garantCodePostal?.trim() || !/^\d{5}$/.test(data.garantCodePostal)) {
    ctx.addIssue({ code: 'custom', path: ['garantCodePostal'], message: 'Le code postal du garant (5 chiffres) est obligatoire' });
  }
  if (!data.garantVille?.trim()) {
    ctx.addIssue({ code: 'custom', path: ['garantVille'], message: 'La ville du garant est obligatoire' });
  }
}
```

And remove the `?? '00000'` fallback in the route; let the schema block the request before it reaches the domain.

---

## Warnings

### WR-01: Session may not be persisted before redirect when `marquerWizardComplete` is called

**File:** `src/web/routes/wizard.ts:120-125` (also lines 193-199, 323-328)

**Issue:** After calling `marquerWizardComplete(opts.db)`, the route immediately does `req.session.wizard = undefined` and `return reply.redirect(...)`. With `@fastify/session`, setting `req.session.X = Y` does not immediately flush the session to the store — it is persisted by the framework on response completion. However, there is no explicit `await req.session.save()` call. If the session flush fails (e.g., transient store error), the user is redirected to `/biens`, the DB flag `wizard_complete` is set, but the session banner `banniereSuccess` may not be written. On the next reload the user will be redirected from the wizard (good), but the success banner will silently disappear.

More critically: in the `terminer` path the `bienId` is already stored in the DB but `req.session.wizard` is cleared without persistence confirmation. If the session fails to flush, the user's next request will still have `wizard` undefined (it was never persisted), but `wizard_complete` is already set in the meta table, so they can never re-enter the wizard. This is a one-way door and the data is intact, but the UX is broken.

**Fix:** Add `await req.session.save()` before each redirect in the `terminer` paths, or confirm that `@fastify/session` guarantees flush before response completion (it does not by default with external stores).

---

### WR-02: `bien.ejs` — `erreurs['lots.0.surface']` and `erreurs['lots[0].surface']` dual-key lookup is fragile and incomplete

**File:** `src/web/views/pages/wizard/bien.ejs:73` and `src/web/views/pages/wizard/bien.ejs:100`

**Issue:** The template checks two different key formats for lot field errors:

```ejs
erreur: (erreurs['lots.0.designation'] || erreurs['lots[0].designation']) || null
```

The `extraireErreurs` function in `wizard.ts:40-48` builds keys using `issue.path.join('.')`. For a Zod path like `['lots', 0, 'surface']`, `join('.')` produces `'lots.0.surface'` — not `'lots[0].surface'`. So the bracket form `erreurs['lots[0].surface']` in the template will **never match** an error from Zod; it is dead fallback code that creates a false sense of double coverage. It also means the key in `valeurs` (which comes from the raw form body and uses bracket notation like `valeurs['lots[0].surface']`) and the key in `erreurs` (dot notation from Zod) are always different namespaces — which is correct for `valeurs` but the fallback in `erreurs` is misleading.

The real issue: if the path format changes (e.g., from dot to bracket), error display silently breaks. This is currently masked by the fact that the `.0.` form is first and always correct, but the dual-form pattern is a maintenance trap.

**Fix:** Remove the bracket-notation fallback from `erreurs` lookups. Trust the single canonical dot-notation path that `extraireErreurs` produces:

```ejs
erreur: erreurs['lots.0.designation'] || null
```

---

### WR-03: `anneeConstruction` max bound computed at schema parse time, not request time

**File:** `src/web/schemas/bien-schemas.ts:47` and `:65`

**Issue:** The expression `new Date().getFullYear() + 1` is evaluated when the module is first imported (i.e., at server startup). In practice this means a server started in December 2025 and still running in January 2027 will refuse the year 2027 for a new bien, even though 2027 is now valid. For a local-first single-user app this is unlikely to cause real harm, but it is a correctness defect: the constraint is silently stale after a year boundary.

**Fix:** Wrap the max in a `z.lazy` or move it into a refinement that evaluates at parse time:

```ts
anneeConstruction: z.coerce
  .number()
  .int()
  .min(1700, "L'année de construction doit être ≥ 1700.")
  .refine(
    (v) => v <= new Date().getFullYear() + 1,
    "L'année de construction ne peut pas être dans le futur.",
  ),
```

---

### WR-04: `form-field.ejs` — `describedBy` variable computed but never used

**File:** `src/web/views/partials/form-field.ejs:10`

**Issue:** Line 10 computes a `describedBy` variable with a complex (and incorrect) ternary:

```js
const describedBy = [fieldErreur !== null || fieldErreur === '' ? '' : '', fieldHint ? fieldId + '-hint' : ''].filter(Boolean).join(' ') || (fieldId + '-error' + (fieldHint ? ' ' + fieldId + '-hint' : ''));
```

This expression has a logic error (`fieldErreur !== null || fieldErreur === ''` is equivalent to `true` when `fieldErreur !== null`, but returns `''` — so the first element of the array is always `''`). More importantly, `describedBy` is **never referenced**. The actual `aria-describedby` on the input (line 20) is hard-coded inline:

```ejs
aria-describedby="<%= fieldId %>-error<% if (fieldHint) { %> <%= fieldId %>-hint<% } %>"
```

The dead `describedBy` variable is a quality defect: it signals either an incomplete refactor or a misunderstanding. The hard-coded approach on line 20 is correct, so the fix is to delete the dead variable on line 10.

**Fix:** Delete line 10 entirely.

---

## Info

### IN-01: BDD step "la réponse contient le header Content-Type" does not actually check the header

**File:** `tests/bdd/step_definitions/activation.steps.ts:403-407`

**Issue:** The step implementation for `Then la réponse contient le header Content-Type {string}` ignores the `_contentType` parameter and instead checks whether the body contains `<html` or `<!doctype`. The test name says it checks the `Content-Type` header, but it does not. The `_contentType` argument is accepted but unused (prefixed with `_` to suppress the warning, which masks the omission).

This means a response with `Content-Type: text/plain` that happens to contain `<html` in the body would incorrectly pass the step.

**Fix:** Either inspect the actual header (store it on `this` alongside `dernierCorps`), or rename the step to match what it actually asserts.

---

### IN-02: Redundant `Then` step definitions — `la table SQLite meta contient wizard_complete` vs `wizard_complete=1`

**File:** `tests/bdd/step_definitions/activation.steps.ts:514-523`

**Issue:** Two step definitions on lines 503–512 and 514–523 are functionally identical — both check `cle = 'wizard_complete'` and `valeur = '1'`. They differ only in the step text (`wizard_complete=1` vs `wizard_complete`). The body of the second step is an exact duplicate of the first. This is dead duplication that will cause confusion if the assertion logic ever needs to change.

**Fix:** Remove the second definition (lines 514–523) and update the feature file to use the single consistent step text.

---

### IN-03: `bien.ejs` — `lots[0].etage` is sent as a hidden empty field but schema accepts `null` — minor form hygiene

**File:** `src/web/views/pages/wizard/bien.ejs:103`

**Issue:** A hidden `<input type="hidden" name="lots[0].etage" value="" />` is emitted. The `lotCreationSchema` preprocesses empty string to `null`, so this is functionally correct. However, sending an empty-string form field for `etage` is misleading — there is no UI affordance for the user to set an etage during the wizard, yet the field appears in the DOM and in every submitted payload. A future developer may be confused about whether this field is intentional.

**Fix:** Add a comment in the template explaining that `etage` is not collected in the wizard step (only in the bien detail page) and the empty field is sent to satisfy the `normaliserLotsFormBody` parsing which expects the key to exist. Alternatively, omit the hidden input and let `normaliserLotsFormBody` produce `{}` for index 0 (which will then have `etage: undefined`, processed by the schema's preprocess to `null`).

---

_Reviewed: 2026-05-16T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

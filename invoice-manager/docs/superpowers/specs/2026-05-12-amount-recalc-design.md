# Amount recalculation (HT / TVA / TTC) — design

**Date:** 2026-05-12
**Status:** spec (awaiting review)
**Domain:** Facturation

---

## Problem

Today, HT, TVA (€), TTC and `taux_tva` (%) are extracted independently by regex in `parsers._parse_amounts`. If only two of (HT, TVA, TTC) are printed, the third stays `NULL` and the item drops to *à réviser*. In the dashboard, the user can edit each field manually but nothing auto-completes — and nothing verifies that `HT + TVA = TTC`. As a result, items remain in *à réviser* with values the system could have derived, and silent inconsistencies can land in the ledger.

## Goal

A single, deterministic, well-tested function that:
- completes the missing value when two of (HT, TVA, TTC) are known,
- derives or validates `taux_tva`,
- detects inconsistencies (|HT+TVA − TTC| > 1 cent) and flags the item for review,
- never overwrites a value that came from the document.

Used by **both** extraction and dashboard edit — same logic, different aggressiveness.

## Non-goals

- Multi-rate invoices (line-by-line TVA). Out of scope — one rate per invoice for now.
- Currency conversion. Euros only.
- Rewriting the DB schema (HT/TVA/TTC/taux_tva columns stay `REAL`).

---

## Storage decision: amount vs percentage

**Both, with one canonical.**

| Column | Type | Role |
|---|---|---|
| `montant_tva` | REAL (€) | **Canonical.** Legal value used by `export.py` for the CA3/CA12 declaration sheet. |
| `taux_tva` | REAL (%) | Derived. Snapped to nearest legal rate {0, 2.1, 5.5, 10, 20} if within ±0.2%, else stored raw. UX lever (dropdown) and validation aid. |

Reason: the French TVA declaration is filed *per rate bracket*, so both are needed. But only the **amount** is law-canonical — the rate is bookkeeping convenience and can always be recomputed from `tva / ht * 100`.

---

## Design

### New module: `services/amounts.py`

A pure function — no Flask, no DB, no I/O. Tested in isolation.

```python
from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP

LEGAL_RATES = (Decimal("0"), Decimal("2.1"), Decimal("5.5"),
               Decimal("10"), Decimal("20"))
RATE_SNAP_TOLERANCE = Decimal("0.2")    # %
AMOUNT_TOLERANCE    = Decimal("0.01")   # €

@dataclass(frozen=True)
class Amounts:
    ht:   float | None
    tva:  float | None
    ttc:  float | None
    taux: float | None
    warnings: tuple[str, ...]   # codes: "tva_mismatch", "rate_unusual", …

def complete_amounts(
    ht:   float | None,
    tva:  float | None,
    ttc:  float | None,
    taux: float | None,
    *,
    infer_from_rate: bool,
) -> Amounts:
    ...
```

#### Rules (applied in order)

1. **Normalize** all inputs to `Decimal` (avoids float drift).
2. **Two amounts → derive the third** using `HT + TVA = TTC`:
   - `(ht, tva)` → `ttc = ht + tva`
   - `(ht, ttc)` → `tva = ttc − ht`
   - `(tva, ttc)` → `ht = ttc − tva`
3. **One amount + rate** (only if `infer_from_rate=True`):
   - `(ht, taux)` → `tva = ht × taux / 100`, `ttc = ht + tva`
   - `(ttc, taux)` → `ht = ttc / (1 + taux/100)`, `tva = ttc − ht`
4. **Three amounts present** → consistency check:
   - if `|ht + tva − ttc| ≤ 0.01` → pass.
   - else → keep all three verbatim, append `"tva_mismatch"` to warnings, **do not overwrite**.
5. **Derive `taux`** when missing and `ht + tva` are known:
   - `raw = tva / ht × 100`
   - if `min(|raw − r|) ≤ 0.2` for `r ∈ LEGAL_RATES`: snap to `r`.
   - else: store `raw` rounded to 2 decimals, append `"rate_unusual"`.
6. **Round** every amount to 2 decimals via `ROUND_HALF_UP` (arrondi commercial français).
7. Return `Amounts` (floats — DB compatibility) + warnings.

### Callers

| Caller | Mode | Behaviour |
|---|---|---|
| `parsers._parse_amounts` (extract) | `infer_from_rate=False` | Only fills the 3rd amount if 2 of (HT, TVA, TTC) were printed. Never invents a rate. Today's line 137 `taux = tva/ht*100` is removed — `complete_amounts` does it. |
| `services/revision._parse_review_fields` (edit) | `infer_from_rate=True` | Full inference. User fills HT + chooses rate → TVA + TTC derived. |

Both callers translate `warnings` into:
- `"tva_mismatch"` → `statut_révision = à_réviser`, message surfaced in the dashboard banner.
- `"rate_unusual"` → soft warning, no status change.

### Dashboard UX (edit form)

- Add a `<select name="taux_tva">` with options `{0, 2.1, 5.5, 10, 20, autre}`. Default = current `taux_tva` value or last-used rate per émetteur.
- Inline JS (no framework): when the user blurs HT, TVA or TTC, call a helper that mirrors `complete_amounts` to pre-fill the empty fields. Server still re-runs `complete_amounts` as the source of truth — JS is only a UX hint.
- Visual: if `tva_mismatch` warning, surface a red banner under the amount block with the three values and the delta.

### Test plan (`tests/test_amounts.py`)

Names read as domain rules:

- `test_two_of_three_derives_missing_amount`
- `test_ht_plus_rate_derives_tva_and_ttc`
- `test_ttc_plus_rate_derives_ht_and_tva`
- `test_three_amounts_within_tolerance_passes`
- `test_three_amounts_mismatch_keeps_values_and_warns`
- `test_rate_snaps_to_legal_when_close`
- `test_rate_kept_raw_when_far_from_legal`
- `test_zero_ht_does_not_divide_by_zero`
- `test_extract_mode_never_infers_from_rate`
- `test_edit_mode_infers_from_rate`
- `test_rounding_half_up_on_centimes`

Plus integration:
- `test_parse_amounts_completes_third_when_two_present`
- `test_post_review_save_with_ht_and_rate_completes_tva_and_ttc`
- `test_post_review_save_mismatch_demotes_to_a_reviser`

---

## Migration

None. Existing rows untouched. `complete_amounts` is invoked on new extractions and on every save through the review flow.

## Risks

- **Behavioural change at extract time.** Items previously stuck in *à réviser* with two of three amounts will now be auto-completed and may pass to *validé* if confidence ≥ 0.8. This is the intent, but it means existing thresholds need a smoke run on a real `input/` corpus before merge.
- **Float → Decimal → float trip.** Tests must assert exact strings on edge cases (`0.1 + 0.2`, multi-line rounding).

## Out of scope (future)

- Per-line TVA breakdown for invoices with mixed rates.
- Stocking amounts as `Decimal` (TEXT column) end-to-end — a bigger refactor, separate spec.

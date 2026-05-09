# Soft Delete & Corbeille — Design Spec

**Date:** 2026-05-10  
**Status:** Approved

## Problem

The `/review/<id>/delete` route performs a hard `DELETE FROM invoices`. No confirmation is shown. This violates:
- The design system's rule that destructive buttons require a confirmation dialog
- French accounting law (Code de commerce): pièces comptables must be retained for 10 years

A deleted ticket-de-caisse during review is permanently lost with no recourse.

## Solution

Soft delete: mark rows as deleted instead of removing them. Add a Corbeille tab to view and restore deleted items.

---

## 1. Schema

Two nullable columns added to `invoices` via `ALTER TABLE ADD COLUMN`:

```sql
ALTER TABLE invoices ADD COLUMN deleted_at TEXT;   -- ISO 8601 UTC, NULL = not deleted
ALTER TABLE invoices ADD COLUMN deleted_by TEXT;   -- always "user" (single-user tool)
```

Migration runs automatically on app start if columns are absent. No data is lost.

All existing queries that read invoice rows gain `AND deleted_at IS NULL`:
- `query_fiscal_summary`
- `query_ledger`
- `query_health`
- `query_items_a_reviser`
- `_query_validés`

---

## 2. Delete Flow

**Trigger:** User clicks "Supprimer" on any invoice in the review panel.

**Step 1 — Confirmation modal** (inline HTML/JS, no library):
- Title: "Supprimer ce document ?"
- Body: shows `fichier_source` basename + `émetteur_nom` + formatted `montant_ttc` — enough context to confirm correct item
- Buttons: "Annuler" (secondary style) | "Supprimer" (destructive/error fill, per design system)
- One modal element in the DOM, populated via `data-*` attributes on the trigger button
- Keyboard: Escape closes, Enter does not confirm (accidental submit risk)

**Step 2 — POST `/review/<id>/delete`:**
```python
conn.execute(
    "UPDATE invoices SET deleted_at=?, deleted_by='user' WHERE id=?",
    (now_utc_iso, item_id)
)
```
Redirect to `/` as today.

No hard DELETE is ever executed from the UI.

---

## 3. Corbeille Tab

**Location:** New tab in the dashboard, after "À réviser" and "Validés". Only rendered when at least one deleted row exists.

**Query:**
```sql
SELECT id, fichier_source, émetteur_nom, montant_ttc, type_document,
       date_document, deleted_at
FROM invoices WHERE deleted_at IS NOT NULL
ORDER BY deleted_at DESC
```

**Display per row:**
- Filename (basename)
- Emitter
- Amount (formatted, tabular-nums)
- Document type badge
- Document date
- Deletion date (formatted, muted)
- "Restaurer" button (secondary style)

No delete button. No bulk actions.

---

## 4. Restore Flow

**POST `/review/<id>/restore`:**
```python
conn.execute(
    "UPDATE invoices SET deleted_at=NULL, deleted_by=NULL, "
    "statut_révision='à_réviser', révisé_par=NULL, "
    "date_révision=NULL, validé_le=NULL WHERE id=?",
    (item_id,)
)
```

Restored item returns to `à_réviser` — must be reviewed before it enters the ledger again. Redirect to `/`.

No confirmation dialog needed for restore (reversible action).

---

## 5. Audit Trail

The `deleted_at` + `deleted_by` columns serve as the deletion audit record, consistent with the design system's audit trail rule. Restored items lose their `deleted_at` — the act of restoration is not separately logged (out of scope).

---

## Out of Scope

- Permanent deletion ("vider la corbeille") — decided against for compliance
- Multi-user `deleted_by` with actual usernames
- Expiration / auto-purge
- Corbeille for items deleted before this feature (they are gone; only future deletes are soft)

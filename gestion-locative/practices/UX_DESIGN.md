# UX Design Principles

## Core Mental Models

**Hick's Law** — Decision time grows with the number of choices. Reduce options; use progressive disclosure.

**Fitts's Law** — Time to click a target ∝ distance / size. Make primary actions large and close to where the user's attention already is.

**Miller's Law** — Working memory holds ~7 items (±2). Chunk content; paginate long lists; group related fields.

**Jakob's Law** — Users spend most time on *other* apps. Match conventions they already know.

**Doherty Threshold** — Response under 400ms feels instant. Anything slower needs a visual indicator.

## Flow & Navigation

- User always knows: where they are, where they came from, what they can do next
- Breadcrumbs or a clear page title on every view
- Destructive actions (delete, archive) require a confirmation step
- Back = safe — never lose user data on browser back

## Forms

- One column layout; group related fields visually
- Label above field, not inside (placeholder disappears on focus)
- Inline validation: show error when user leaves field, not on submit
- Required fields: mark required, not optional (fewer markers)
- Submit button disabled until minimum required fields are filled
- Always explain *why* a field is needed if it's not obvious

## Error Handling

- Error messages: say what happened + what to do (never just "Error")
- Position error message next to the field that caused it
- Preserve user input on error — never clear a form after a failed submit

## Empty States

- Never show a blank screen — explain why it's empty and what to do
- Example: "No invoices yet. Drop a PDF in `input/` and run the pipeline."

## Affordance & Discoverability

- If it's clickable, it must look clickable (underline, button shape, cursor change)
- Keyboard shortcut hints visible on hover for power users
- Tooltips for icons with no text label

## Cognitive Load Reduction

- Show only what the user needs for the current task (progressive disclosure)
- Default to the most common action pre-selected
- Summarize before details — headline numbers first, raw data second
- Avoid jargon; use the user's vocabulary

## Trust & Transparency

- Show data provenance: where did this number come from?
- Undo > confirm dialog when possible (less friction, same safety)
- Log all changes with timestamp + actor (already done via `corrections_log`)

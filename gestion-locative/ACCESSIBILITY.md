# Accessibility (WCAG 2.1 AA)

## The Four Principles (POUR)

**Perceivable** — Information must be presentable to all senses.
**Operable** — UI must be navigable without a mouse.
**Understandable** — Content and behavior must be predictable.
**Robust** — Works with current and future assistive technologies.

## Color & Contrast

- Body text: 4.5:1 contrast ratio minimum
- Large text (18px+ or 14px bold): 3:1 minimum
- UI components (buttons, inputs, icons): 3:1 against adjacent color
- Never use color alone to convey meaning — pair with icon or text

## Keyboard Navigation

- All interactive elements reachable via Tab
- Logical tab order follows visual order
- Visible focus indicator on every focusable element (never `outline: none` without replacement)
- Modal/dialog traps focus inside while open; restores focus on close
- `Escape` closes modals and dropdowns

## Semantic HTML

- Use correct elements: `<button>` for actions, `<a>` for navigation, `<table>` for tabular data
- Headings (`h1`–`h6`) reflect document outline — never skip levels
- One `<h1>` per page; subsequent headings nested logically
- `<label>` explicitly associated with every form input (`for`/`id` or wrapping)

## ARIA (use sparingly — semantic HTML first)

- `aria-label` on icon-only buttons: `<button aria-label="Supprimer la facture">`
- `aria-live="polite"` on status messages (loading, save confirmation)
- `role="alert"` for error messages that appear dynamically
- Never use ARIA to override broken semantics — fix the HTML instead

## Images & Icons

- Decorative images: `alt=""`
- Informative images: `alt` describes the content, not the filename
- SVG icons: `aria-hidden="true"` if the parent button has a label

## Forms

- Every input has a visible `<label>` (not just placeholder)
- Error messages linked to input via `aria-describedby`
- Required fields: `required` attribute + visual indicator
- Group related inputs with `<fieldset>` + `<legend>`

## Tables

- `<th scope="col">` for column headers, `<th scope="row">` for row headers
- `<caption>` or `aria-label` on the table
- No layout tables — use CSS grid/flexbox instead

## Motion & Animation

- Respect `prefers-reduced-motion` — disable or slow down animations
- No content that flashes more than 3 times per second (seizure risk)

## Testing Checklist

- [ ] Tab through entire page — every action reachable?
- [ ] Screen reader test (VoiceOver / NVDA) on key flows
- [ ] Zoom to 200% — no content cut off or overlapping
- [ ] Disable CSS — is content still readable and in logical order?
- [ ] Color blindness simulation (e.g. Stark plugin or browser DevTools)

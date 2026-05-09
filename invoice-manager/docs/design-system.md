---
name: ProLedger
colors:
  primary: "#1C4ED8"
  secondary: "#475569"
  surface: "#F8FAFC"
  surface-variant: "#F1F5F9"
  on-surface: "#0F172A"
  on-surface-muted: "#64748B"
  positive: "#059669"
  negative: "#DC2626"
  warning: "#D97706"
  error: "#B91C1C"
  border: "#E2E8F0"
typography:
  body-md:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: 400
  numeric:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: 500
    fontVariantNumeric: tabular-nums
rounded:
  md: 6px
---

# Design System

## Overview
A clean, light-mode interface for professional accounting software.
Optimized for high data density, long read sessions, and financial accuracy.
Trust and precision are the two visual values — no decoration without function.

## Colors
- **Primary** (#1C4ED8): CTAs, active navigation, interactive elements — signals authority and trust
- **Secondary** (#475569): Supporting UI, chips, secondary actions, column headers
- **Surface** (#F8FAFC): Page background — off-white to reduce eye fatigue during long sessions
- **Surface-variant** (#F1F5F9): Table row stripes, input backgrounds, sidebar panels
- **On-surface** (#0F172A): Primary text — near-black for maximum readability on light surfaces
- **On-surface-muted** (#64748B): Metadata, placeholders, secondary labels
- **Positive** (#059669): Credits, income, surplus, paid status — never used decoratively
- **Negative** (#DC2626): Debits, expenses, deficits, overdue status — never used decoratively
- **Warning** (#D97706): Pending invoices, reconciliation alerts, partial payments
- **Error** (#B91C1C): Validation errors, destructive actions, blocked states
- **Border** (#E2E8F0): Table dividers, card edges, input strokes

## Typography
- **Page titles**: Inter, 600, 22–24px
- **Section headers**: Inter, 500, 13px, uppercase, letter-spacing 0.06em
- **Body**: Inter, 400, 15px — readable across dense forms and tables
- **Labels**: Inter, 500, 12px — form labels, table headers
- **Amounts & numbers**: Inter, 500, 14px, `font-variant-numeric: tabular-nums` — mandatory on all financial values so columns align perfectly
- **Monospace totals**: use `font-variant-numeric: tabular-nums lining-nums` for balance rows

## Components

### Data Table
The core component of any accounting UI. Rules:
- Zebra striping with `surface` / `surface-variant` — no full-width borders
- Amount column: right-aligned, tabular-nums, fixed-width
- Positive amounts: `positive` color; negative amounts: `negative` color with parentheses `(1 234,00 €)` — never a minus sign alone
- Sticky header row on scroll
- Row hover: `surface-variant` background, no border change
- Selected row: 2px left border in `primary`

### Status Badge
Inline pill for invoice/payment state. Variants:
- **Paid**: green background `#DCFCE7`, text `#166534`
- **Pending**: amber background `#FEF3C7`, text `#92400E`
- **Overdue**: red background `#FEE2E2`, text `#991B1B`
- **Draft**: slate background `#F1F5F9`, text `#475569`

### Amount Input
- Right-aligned input text, tabular-nums
- Currency symbol as left prefix adornment, not inside the input value
- 1px border `border`, focus ring 2px `primary`
- Validation error: border color `error`, helper text below in `error` color

### Buttons
- **Primary**: `primary` fill, white text, 6px radius — one per view maximum
- **Secondary**: `border` stroke, `on-surface` text, `surface-variant` hover
- **Destructive**: `error` fill, white text — requires confirmation dialog before action

### Cards / Panels
- White background, 1px `border`, 6px radius
- No drop shadow — use border and background contrast only
- KPI cards: large numeric value (Inter 700, 28px) + small label below

### Navigation Sidebar
- `surface-variant` background
- Active item: `primary` left border (3px) + `primary`-tinted background `#EFF6FF`
- Section labels: uppercase, 11px, `on-surface-muted`

## Layout & Spacing
- Base unit: 4px
- Content max-width: 1280px
- Sidebar: 240px fixed
- Page padding: 32px horizontal, 28px vertical
- Table cell padding: 12px vertical, 16px horizontal
- Card gap: 16px

## Accounting-Specific UX Rules

### Financial Figures
- Always display currency symbol and two decimal places: `1 234,56 €` — never truncate amounts
- Use space as thousands separator (French locale) or comma (US locale) — pick one per project, never mix
- Negative values: parentheses convention `(500,00 €)` for accountants; minus sign for developers — decide per audience and be consistent
- Zero amounts: display as `0,00 €`, never blank

### Debit / Credit
- Debits and credits must be visually distinct columns — never the same column with sign reversal
- Use color only as a secondary cue, never as the sole indicator (accessibility)

### Reconciliation
- Matched rows: subtle `positive`-tinted left border
- Unmatched rows: `warning`-tinted left border
- Reconciliation progress: a simple progress bar in `primary`, not a pie chart

### Dates & Periods
- Always show fiscal year / period context in the page header
- Date pickers default to the current fiscal period, not today's date

### Audit Trail
- Every mutation (edit, delete, void) must display timestamp + author in a muted footnote row — never hide this

## Do's and Don'ts
- Do use `positive` / `negative` colors exclusively for financial meaning — not for general UI decoration
- Do enforce `tabular-nums` on every column that contains amounts, percentages, or dates
- Don't use red for errors and debits without a shape/label distinction — color alone fails accessibility
- Do provide keyboard navigation for all table actions (Tab, Enter, Escape)
- Don't auto-format amounts while the user is typing — format only on blur
- Do always show the grand total / balance row even when the table is paginated
- Don't use modals for data entry of more than 5 fields — use a dedicated page or slide-over panel
- Do maintain WCAG AA contrast (4.5:1) for all text, WCAG AAA (7:1) for amounts
- Don't use animations on financial data — motion implies pending state, which creates confusion
- Do use a sans-serif, not a decorative font — readability over brand expression in dense views

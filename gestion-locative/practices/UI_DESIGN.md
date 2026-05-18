# UI Design Principles

## Gestalt Laws — group elements so the eye understands structure instantly

| Law | Rule |
|-----|------|
| **Proximity** | Related elements close together; unrelated elements separated by space |
| **Similarity** | Same function → same color, size, or shape |
| **Continuity** | Align elements along a line or curve to guide the eye |
| **Closure** | Users complete incomplete shapes — use it to reduce visual noise |
| **Figure/Ground** | Ensure foreground always contrasts clearly against background |
| **Common Region** | Use borders or backgrounds to group related content (cards, panels) |

## Visual Hierarchy

- One dominant element per screen — never compete for attention
- Size > Weight > Color for communicating importance (in that order)
- Limit to 3 font sizes per view; 2 weights max
- White space is not wasted space — it is hierarchy

## Color

- One primary action color; never more than 3 accent colors
- Semantic colors must be consistent: red = error, amber = warning, green = success
- Never use color as the *only* differentiator (colorblind users)
- Contrast ratio: 4.5:1 minimum for body text, 3:1 for large text (WCAG AA)

## Typography

- Line length: 60–80 characters per line for readability
- Line height: 1.4–1.6× font size for body text
- Font size: 16px minimum for body; never below 12px for any visible text
- All-caps: decorative only, never for sentences

### Negative-space typography

- L'espace *entre* blocs de texte communique la structure **avant** le contenu lui-même — soigner le négatif autant que le positif (taille, graisse, couleur).
- **Espacement variable, pas uniforme** : la marge supérieure d'un titre doit être nettement plus grande que celle d'un paragraphe ; un sous-titre doit « coller » à son bloc et s'éloigner du précédent (proximité = appartenance).
- Raisonner en **proportions** liées à la taille de police (ex : `margin-top: 2em` pour H2, `1em` pour paragraphe), pas en pixels arbitraires — reste cohérent avec le système 8 px ci-dessous.
- Si deux blocs partagent la même marge verticale, le lecteur ne peut pas deviner leur hiérarchie. **Différencier les écarts = différencier les relations.**
- Ne jamais se contenter des valeurs par défaut du framework/éditeur — auditer le rythme vertical après chaque changement typographique.

Réf. : <https://www.chrbutler.com/negative-space-typography>

## Spacing System

Use a base unit (e.g. 8px). All spacing is a multiple: 4, 8, 16, 24, 32, 48, 64.
Never use arbitrary pixel values.

## Feedback States

Every interactive element needs 4 states: default, hover, active, disabled.
Never leave an action without visible confirmation (loading, success, error).

## Data Tables (relevant for this project)

- Right-align numbers; left-align text
- Zebra striping or row hover — not both
- Sticky header on scroll for long tables
- Sort indicators must show current sort column + direction
- Actions (edit, delete) on row hover — not permanent visible columns

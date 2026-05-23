# Practices — pack de pratiques exportable

Pack agnostique au domaine, conçu pour être **réutilisé tel quel** dans d'autres projets ou promu globalement vers `~/workflow/` / `~/.claude/`.

Aucun fichier de ce dossier ne référence de doc située hors du dossier — le pack est auto-suffisant.

## Pratiques de développement

| Document | Rôle |
|---|---|
| [SOFTWARE_CRAFTSMANSHIP.md](SOFTWARE_CRAFTSMANSHIP.md) | Discipline d'ingénierie : SOLID, Clean Code, refactoring, code review, mesures qualité (CI gates), AI-navigability. |
| [DDD.md](DDD.md) | Domain-Driven Design : ubiquitous language, bounded contexts, agrégats, hexagonal architecture. |
| [BDD_PRACTICES.md](BDD_PRACTICES.md) | Testing prioritaire : Given/When/Then, pyramide, couverture logique métier, cas obligatoires. |
| [BEHAVIOR.md](BEHAVIOR.md) | Code of conduct par session : posture sceptique, speed levers (parallel calls, cache discipline, tight prompts). |

## Pratiques UI / UX / Accessibilité

| Document | Rôle |
|---|---|
| [UI_DESIGN.md](UI_DESIGN.md) | Gestalt, hiérarchie visuelle, color, typography, spacing system (8 px), feedback states, data tables. |
| [UX_DESIGN.md](UX_DESIGN.md) | Hick / Fitts / Miller / Jakob / Doherty laws, flow & nav, forms, error handling, empty states, affordance, cognitive load, trust. |
| [ACCESSIBILITY.md](ACCESSIBILITY.md) | WCAG 2.1 AA : POUR principles, contraste, keyboard nav, semantic HTML, ARIA, forms, tables, motion, testing checklist. |

## Réutilisation

- **Vers un autre projet** : `cp -r practices/ <autre-projet>/practices/` puis référencer depuis son `CLAUDE.md`.
- **Vers `~/workflow/`** : `cp -r practices/ ~/workflow/practices/` et linker depuis `agent.md`.
- **Vers `~/.claude/`** : idem, en linker depuis `CLAUDE.md` global.

Les références au vocabulaire métier dans `SOFTWARE_CRAFTSMANSHIP.md` pointent vers « les docs domaine du projet » — sans chemin codé en dur — pour rester portable.

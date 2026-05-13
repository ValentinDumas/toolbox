# CLAUDE.md — Gestion locative

Project-level instructions for Claude sessions working in this folder.

## Main goal

Construire un **logiciel de gestion locative en local, mono-utilisateur**, qui permet à une personne seule de gérer l'administratif de son entreprise et de ses biens immobiliers, en restant **autonome** (pas de cloud obligatoire, pas de délégation, pas de multi-utilisateur).

Voir [VISION.md](VISION.md) pour la vision détaillée.

## Top priority — V1

**LMNP en location meublée longue durée.**

Centraliser factures, tickets, quittances, baux et échéances pour **simplifier les obligations fiscales** (liasse 2031, 2042 C PRO, CFE, amortissements, plus-value).

Tout ce qui sort de ce périmètre — location nue, SCI à l'IS, meublé de tourisme, multi-bailleur, gestion déléguée — est **reporté**.

## Documents de référence

### Métier

| Document | Rôle |
|---|---|
| [VISION.md](VISION.md) | Vision produit (le « pourquoi »). |
| [LOGICIEL_GESTION_LOCATIVE.md](LOGICIEL_GESTION_LOCATIVE.md) | PRD (cible, MVP, KPIs, roadmap, périmètre étendu V1.1/V2). |
| [RISKS.md](RISKS.md) | Registre des risques (fiscal, juridique, technique, UX, maintenance) avec mitigations et cibles. |
| [LMNP.md](LMNP.md) | Base de connaissances fiscales LMNP (CGI, BOFIP, seuils 2026, plus-value LF 2025). |
| [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md) | Règles juridiques de la location meublée (loi 89, décret mobilier, bail, EDL). |

### Pratiques de développement (opposables)

| Document | Rôle |
|---|---|
| [SOFTWARE_CRAFTSMANSHIP.md](SOFTWARE_CRAFTSMANSHIP.md) | Discipline d'ingénierie : SOLID, Clean Code, refactoring, code review, mesures qualité (CI gates). |
| [DDD.md](DDD.md) | Domain-Driven Design : ubiquitous language, bounded contexts, agrégats, hexagonal architecture. |
| [BDD_PRACTICES.md](BDD_PRACTICES.md) | **Testing top priority** : Given/When/Then, pyramide, 100 % couverture logique fiscale, cas obligatoires. |

## Principes directeurs

1. **Local-first** — SQLite, pas de cloud obligatoire.
2. **Single-user** — pas de rôles, pas d'auth multi-comptes.
3. **Sobre** — une question par écran, pas d'usine à gaz.
4. **Audit-friendly** — ledger d'opérations, historique de corrections, exports CSV/PDF.
5. **À jour fiscalement 2026** — seuils, abattements et règles LMNP intégrés au code.

## Règles non négociables (extraits)

- **Pas de code métier sans test** (cf. [BDD_PRACTICES.md](BDD_PRACTICES.md)). Cycle outside-in : scénario BDD rouge → TDD interne → scénario vert.
- **100 % de couverture** sur la logique fiscale (amortissement, micro-BIC, plus-value), **chaque exception** du droit a son scénario dédié.
- **Ubiquitous language** : tout identifiant du code reflète le vocabulaire métier français (`Bail`, `Quittance`, `Locataire`, `IRL`, `ARD`, `CFE`…), jamais traduit en anglais.
- **Domaine pur** : aucun import technique (ORM, HTTP, fichier) dans le cœur du domaine — ports & adapters strict.
- **Docs commitées avec le code** : tout changement de comportement met à jour la doc dans la **même PR**.

## Hors périmètre (V1)

- Location nue / revenus fonciers.
- Meublé de tourisme (loi Le Meur — différents seuils, encadrement spécifique).
- SCI à l'IS, multi-bailleur, agence.
- Mise en location (annonces, sélection de dossier, visites).
- Contentieux et procédures.

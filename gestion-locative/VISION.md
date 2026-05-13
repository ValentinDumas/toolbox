# Vision — Logiciel de gestion locative

> Document de vision produit · 2026-05-13

## Objectif

Construire un **logiciel de gestion locative en local, mono-utilisateur**, permettant à une personne seule de gérer l'administratif de son entreprise et de ses biens immobiliers sans dépendre d'une plateforme cloud, d'un prestataire ou d'un compte partagé.

## Public

Un **propriétaire bailleur unique** qui gère lui-même son patrimoine. Pas de multi-utilisateur, pas de SaaS partagé, pas de mode agence.

## Priorité absolue — V1

La V1 se concentre sur la **gestion d'une activité LMNP** (cf. [LMNP.md](LMNP.md)) en **location meublée longue durée** (cf. [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md)).

Tout ce qui sort de ce périmètre — location nue, SCI à l'IS, meublé de tourisme, multi-bailleur, gestion déléguée — est **explicitement reporté** à une version ultérieure.

## Promesse

- **Centraliser** factures, tickets, quittances, baux, échéances, paiements dans un seul endroit local.
- **Simplifier** les obligations administratives et **fiscales** : préparation de la liasse 2031, déclaration 2042 C PRO, suivi CFE, calcul des amortissements, anticipation de la plus-value.
- **Réduire le risque d'oubli** sur les échéances clés (révision IRL, taxe foncière, déclaration annuelle, CFE).
- **Préserver l'autonomie** : tout reste en local, l'utilisateur conserve la maîtrise complète de ses données.

## Principes directeurs

1. **Local-first** — données dans une base SQLite locale, pas de cloud obligatoire.
2. **Single-user** — pas de gestion de rôles, pas d'authentification multi-comptes.
3. **Sobre** — une interface qui répond à des questions précises (« qui doit quoi ? », « qu'est-ce qui est en retard ? »), pas une usine à gaz.
4. **Audit-friendly** — toute trace conservée (ledger d'opérations, historique de corrections, exports CSV/PDF).
5. **Adapté à la fiscalité française 2026** — seuils, abattements et règles LMNP intégrés au code et aux templates ; mise à jour assumée à chaque loi de finances.

## Ce que le logiciel n'est PAS

- Pas un service de délégation comptable ni un substitut à un expert-comptable pour les cas complexes.
- Pas un outil multi-utilisateur ni un SaaS partagé.
- Pas un outil de mise en location (recherche de locataire, visites, sélection de dossier).
- Pas un outil de contentieux ou de procédures juridiques.
- Pas un module d'analyse patrimoniale avancée (cashflow prévisionnel multi-scénarios, etc.).

## Liens avec les autres documents

- [LOGICIEL_GESTION_LOCATIVE.md](LOGICIEL_GESTION_LOCATIVE.md) — PRD produit (cible, périmètre, MVP, KPIs).
- [LMNP.md](LMNP.md) — Base de connaissances fiscales et juridiques du statut LMNP.
- [LOCATION_MEUBLEE_REGLES.md](LOCATION_MEUBLEE_REGLES.md) — Règles légales de la location meublée (bail, mobilier, préavis, dépôt).

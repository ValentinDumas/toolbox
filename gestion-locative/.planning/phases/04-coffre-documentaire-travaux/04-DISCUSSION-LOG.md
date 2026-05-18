# Phase 4 — Discussion Log

**Date :** 2026-05-18
**Mode :** discuss-phase exécuté en mode auto-spirit (instruction utilisateur "work without stopping for clarifying questions" → chaque gray area résolue par le choix raisonnable par défaut, sans AskUserQuestion interactif).

## Contexte chargé

- `.planning/PROJECT.md` (bounded contexts dont `Documents` à instancier).
- `.planning/REQUIREMENTS.md` (DOC-01, DOC-02, DOC-03, INC-01).
- `.planning/ROADMAP.md` §Phase 4.
- `.planning/STATE.md` (Phase 3 marquée complete 2026-05-18).
- `.planning/phases/01-CONTEXT.md` (D-01 → D-50, stack technique, patterns).
- `.planning/phases/02-CONTEXT.md` (D-51 → D-74, **D-63 StockageFichierLocal** réutilisé).
- `.planning/phases/03-CONTEXT.md` (D-75 → D-101, EDL/IRL/Diagnostics — confirme scope Phase 4).
- `src/infrastructure/storage/stockage-fichier-local.ts` (adapter à étendre).
- `src/domain/encaissements/`, `src/infrastructure/repositories/` (patterns de référence).

## Domain boundary identifié

Phase 4 livre 2 capacités :
1. **Coffre documentaire** — upload + rattachement Bien/Locataire + recherche + rétention 10 ans.
2. **Tickets travaux** — création + coût + pièce(s) jointe(s) Justificatif.

Nouveaux bounded contexts : `Documents` (Justificatif) + `Travaux` (TicketTravaux).

## Gray areas identifiées (10) — réponses auto

| # | Gray area | Choix retenu | Justification |
|---|---|---|---|
| GA-01 | Modèle de rattachement Justificatif | 2 FK nullables `bienId` / `locataireId`, au moins 1 non null | D-103 — simplicité V1, polymorphique optionnel ; N:N copropriété déféré V1.1+ |
| GA-02 | Catégorisation Justificatif | Enum fixe `TypeJustificatif` (9 valeurs) versionnable LF | D-104 — pattern D-77 Phase 3 ; tags libres = V2 |
| GA-03 | Année fiscale | Dérivée de `dateDocument.year`, pas stockée | D-105 — LMNP = année civile par défaut, pas de compta décalée |
| GA-04 | Formats acceptés | PDF, JPG, PNG ; 20 Mo max ; magic-bytes validation | D-107 — sécurité (anti-upload renommé), V1 minimal |
| GA-05 | Stockage physique | Extension `StockageFichierLocal` : `documents/justificatifs/{annee}/{id}-{slug}.{ext}` | D-108 — réutilise mécanisme anti-path-traversal WR-03 Phase 2 |
| GA-06 | Rétention 10 ans | Soft-delete corbeille + hard-block purge avant 10 ans | D-109 — audit-friendly + protection juridique |
| GA-07 | Recherche | SQL LIKE + filtres facettés (Bien/Locataire/Année/Type) | D-111 — FTS5 = V2, suffit < 10 000 docs mono-user |
| GA-08 | Documents générés (Quittance/Avis/Avenant) | Vue agrégée read-model `/coffre/generes`, pas de duplication BD | D-113 — préserve l'origine, audit-friendly |
| GA-09 | TicketTravaux : agrégat ou sous-agrégat ? | Agrégat racine séparé, nouveau BC `Travaux`, ref `BienId` | D-114 — cycle indépendant + dashboard cross-Bien Phase 7 |
| GA-10 | Ticket ↔ Justificatif | Table N:N `ticket_justificatifs`, justificatif autonome | D-115 — un justificatif existe sans ticket ; cascade ne supprime pas le justificatif (D-109 protection 10 ans) |

## Décisions complémentaires

| # | Sujet | Décision |
|---|---|---|
| GA-11 | Champ `nature` du ticket (préparation Phase 5) | Ajouté Phase 4 (`reparation` / `entretien` / `amelioration` / `autre`) — D-117 |
| GA-12 | Notion de Fournisseur | Pas d'agrégat V1 ; nom dans `description`/`notes` ; agrégat Fournisseur = V2 — D-118 |
| GA-13 | Dossier locataire structuré | Reste léger V1 (1 enum `'piece_locataire'` + notes) — D-110 |
| GA-14 | Upload accessibilité | `<input type="file">` natif + `<progress>` ; drag&drop = V2 — D-120 |
| GA-15 | Visualisation PDF | `<a target="_blank">` (visualiseur natif) ; iframe = pas V1 (a11y) — D-121 |
| GA-16 | Catégorisation fiscale Phase 4 | Hors scope ; Phase 5 lira `type` + `nature` + `montantTtc` + `bienId` — D-119 |

## Scope creep détecté + redirection

| Idée évoquée | Redirection |
|---|---|
| OCR / extraction TVA fournisseur | Déféré V1.1+ |
| Catégorisation automatique ML | Déféré V1.1+ |
| Multi-upload / drag&drop | Déféré V1.1+ / V2 |
| Tags libres folksonomy | Déféré V2 |
| Full-text search dans PDF | Déféré V2 (avec OCR) |
| Sync cloud / backup auto | Déféré Phase BAK |
| Workflow signature électronique | Déféré V2 / jamais (mono-user) |
| Émission de devis sortants | Hors LMNP — V2 ou jamais |
| Rattachement multi-Lots (copro) | Déféré V1.1+ |
| Discrimination rétention par type | Déféré V2 (uniformément 10 ans V1) |
| Notifications J-30 / J-7 expiration | Phase 7 |
| Dashboard cross-Bien | Phase 7 |

## Décisions différées au planner (DP-21 → DP-29)

Découpage exact des migrations, routes Fastify, librairie magic-bytes, helpers EJS, politique multipart, partials EJS — voir CONTEXT.md §Décisions différées au gsd-plan-phase 4.

## À ré-arbitrer si l'utilisateur souhaite challenger

Tous les choix ci-dessus ont été pris en autonomie sur la base de :
- l'analyse du domaine LMNP (rétention 10 ans, charges déductibles vs amortissables Phase 5),
- la cohérence avec les patterns Phases 1-3,
- les principes directeurs PROJECT.md (audit-friendly, sobre, single-user, local-first).

Points d'arbitrage utilisateur potentiellement souhaitables :
- **GA-06** (rétention) : valider que "soft-delete + hard-block purge avant 10 ans" est acceptable vs "suppression hard interdite tout court" (plus strict).
- **GA-08** (documents générés) : valider que la vue agrégée read-model suffit, vs copie physique dans le coffre (plus de cohérence visuelle mais duplication).
- **GA-09** (Travaux = BC séparé) : valider la création d'un 7e bounded context (`Travaux`) en dehors des 6 listés PROJECT.md — alternative = rattacher à `Patrimoine` comme sous-agrégat.
- **GA-11** (champ `nature` Phase 4) : valider l'ajout anticipé pour préparer Phase 5 vs ajout différé.

---

*Discussion log Phase 4 — 2026-05-18*

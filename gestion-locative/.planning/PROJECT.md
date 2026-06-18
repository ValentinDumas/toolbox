# Gestion locative

## What This Is

Logiciel de gestion locative **local-first**, **mono-utilisateur**, pour un propriétaire bailleur particulier qui gère son administratif et ses biens immobiliers en autonomie — sans cloud obligatoire, sans délégation, sans multi-utilisateur. V1 : LMNP en location meublée longue durée.

Vision détaillée : [VISION.md](../VISION.md).

## Core Value

**Centraliser factures, quittances, baux et échéances pour simplifier les obligations fiscales LMNP** (liasse 2031, 2042 C PRO, CFE, amortissements par composant, plus-value LF 2025) — sans cloud, sans délégation, sans multi-utilisateur.

## Current Milestone: v1.1 Durcissement & mise en main

**Goal :** Finir et durcir v1.0 pour un usage réel par un bailleur non-dev — sans ajouter de nouvelle capacité métier.

**Target features :**
- Finition qualité — exécuter et clôturer les 12 scénarios d'UAT humaine de la liasse 2031/CFE (Phase 06) en pause ; réconcilier les statuts UAT/debug stale (Phases 02/03/04).
- Dette technique — consolider les 2 partials CFE en double + les 2 patterns `calculerAlertesIrl` ; poser la transaction Kysely enveloppante (D-94).
- Sauvegarde / restauration — BAK-01 : sauvegarde planifiée + restauration testée (SQLite + dossier `documents/`), risque R3.1.
- Chiffrement au repos — BAK-02 : base SQLite chiffrée (SQLCipher).
- RGPD — BAK-03 : information locataire, droit à l'effacement, registre de traitement.
- Packaging installable — binaire natif (DMG/MSI/AppImage) + auto-launch navigateur, au lieu de `pnpm dev`.

**Hors scope v1.1** (→ backlog v1.2+) : OCR factures, simulateurs fiscaux (plus-value LF 2025, micro vs réel, bascule LMP), INSEE auto-indexation IRL, rapprochement bancaire, polish dashboard/notifications, et toute extension de périmètre (bail mobilité/étudiant, multi-bailleur, tourisme, indivision, colocation).

## Requirements

### Validated

<!-- Shipped et confirmé valuable. Détail REQ-ID archivé dans [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md). -->

- ✓ Patrimoine — biens, lots, diagnostics (DPE, gaz, élec, ERP) — v1.0
- ✓ Locatif — locataires, baux meublés, EDL, indexation IRL, gel DPE F/G, checklist mobilier (décret 2015-981) — v1.0
- ✓ Encaissements — quittances PDF, avis d'échéance, suivi paiements, relances escaladées, fiche échéance — v1.0
- ✓ Fiscalité — micro-BIC vs réel, amortissement par composant, brouillon liasse 2031 + annexes 2033, CFE, détection bascule LMP — v1.0
- ✓ Documents — upload justificatifs, recherche par Bien/Locataire/année, rétention 10 ans — v1.0
- ✓ Dashboard — impayés, échéances, notifications J-30 / J-7 (CFE, IRL, diagnostics, fin de bail) — v1.0
- ✓ Travaux — tickets incidents avec pièce jointe + coût — v1.0
- ✓ Dette technique (DET-01/02/03) — partial CFE unique, chemin `calculerAlertesIrl` unifié, transaction Kysely enveloppante (atomicité prouvée) — validé en Phase 10 (v1.1)

### Active

<!-- Périmètre v1.1 Durcissement & mise en main. Détail REQ-ID dans [REQUIREMENTS.md](REQUIREMENTS.md). -->

- Qualité (QUA) — clôture UAT liasse 2031/CFE + réconciliation des statuts stale — v1.1
- Sauvegarde & sécurité (BAK) — backup/restore testé, chiffrement SQLCipher, RGPD — v1.1
- Packaging (PKG) — app installable + auto-launch navigateur — v1.1

### Out of Scope

| Exclusion | Raison |
|---|---|
| Location nue / revenus fonciers | Régime fiscal différent (foncier), hors priorité LMNP. |
| SCI à l'IS | Entité juridique différente, comptabilité commerciale. |
| Meublé de tourisme | Seuils micro-BIC distincts, encadrement loi Le Meur. |
| Multi-bailleur / gestion déléguée / agence | Sort du single-user, conflits avec le modèle local-first. |
| Contentieux et procédures judiciaires | Hors compétence logiciel ; ne se substitue pas à un conseil juridique. |
| Mise en location (annonces, visites, sélection dossier) | Hors périmètre cible — focus admin/fiscal. |
| Bail mobilité / étudiant first-class V1 | Bail classique uniquement V1 (mobilité/étudiant reportés V2). |
| Cashflow multi-scénario | Différé — pas central pour activation. |
| Support humain en urgence | Jamais — logiciel autonome, pas un service. |
| Comptabilité d'agence (multi-user, séquestre, mandat) | Jamais — incompatible single-user. |

Voir [CLAUDE.md](../CLAUDE.md) §Hors périmètre et [LOGICIEL_GESTION_LOCATIVE.md](../LOGICIEL_GESTION_LOCATIVE.md) §Hors produit pour formulations originales.

## Context

**Domaine et règles fiscales** — documentés exhaustivement (à ne pas dupliquer ici) :

- [LMNP.md](../LMNP.md) — base de connaissances fiscales LMNP (CGI 155 IV, BOFIP, seuils 2026, plus-value LF 2025 réintégration amortissements).
- [LOCATION_MEUBLEE_REGLES.md](../LOCATION_MEUBLEE_REGLES.md) — règles juridiques (loi 89-462, décret 2015-981 mobilier, types de bail, EDL, DDT).

**Bounded contexts** identifiés (cf. [DDD.md](../DDD.md)) :

| Context | Responsabilité | Agrégats principaux |
|---|---|---|
| Patrimoine | Biens, lots, composants, diagnostics | `Bien`, `Lot`, `Composant`, `Diagnostic` |
| Locatif | Locataires, baux, états des lieux | `Bail`, `Locataire`, `EtatDesLieux`, `Inventaire` |
| Encaissements | Échéances, paiements, quittances, relances | `EcheanceLoyer`, `Encaissement`, `Quittance`, `Relance` |
| Comptabilité | Plan comptable, ledger, amortissements | `EcritureComptable`, `TableauAmortissement` |
| Fiscalité | Recettes/charges, régimes, liasse 2031, plus-value | `DeclarationAnnuelle`, `RegimeFiscal`, `CalculPlusValue` |
| Documents | Factures, justificatifs, OCR, indexation | `Justificatif`, `Facture`, `ExtractionOCR` |

**Registre des risques** : [RISKS.md](../RISKS.md) — surveillance fiscale annuelle (R1.1), alertes échéances (R2.1), backup/restore (R3.1), pédagogie fiscale (R4.3), maintenance des règles (R5.1).

**État après v1.0 (shippé 2026-06-16)** : ~28 400 LOC TypeScript, 199 fichiers de test, 9 phases / 54 plans. Stack : Fastify + EJS (SSR) + SQLite via Kysely + pdfmake. Couverture 100 % sur le domaine `fiscalite/`. Dette technique connue : 2 partials CFE en double, 2 patterns d'enrichissement `calculerAlertesIrl`, transaction Kysely enveloppante non posée (D-94 accepté). Item différé notable : 12 scénarios d'UAT humaine Phase 06 (liasse 2031/CFE) en pause — cf. STATE.md › Deferred Items.

## Constraints

- **Architecture** : DDD hexagonal strict — domaine pur, **aucun import technique** (ORM, HTTP, fichier) dans `domain/`. Ports définis par le domaine, implémentés par les adapters. — *[DDD.md](../DDD.md), [CLAUDE.md](../CLAUDE.md) §Règles non négociables*
- **Stockage** : SQLite local, **pas de cloud obligatoire**. — *[VISION.md](../VISION.md), [LOGICIEL_GESTION_LOCATIVE.md](../LOGICIEL_GESTION_LOCATIVE.md)*
- **Stack applicative** (langage, framework UI, ORM, lib PDF) : **non figée** — à trancher en `/gsd-discuss-phase 1` selon les contraintes du premier slice.
- **Ubiquitous language français** : tout identifiant du code reflète le vocabulaire métier français (`Bail`, `Quittance`, `Locataire`, `Bailleur`, `IRL`, `ARD`, `CFE`, `BIC`, `DPE`, `LMNP`, `LMP`, `Liasse 2031`…), **jamais traduit en anglais**. — *[CLAUDE.md](../CLAUDE.md)*
- **Qualité — testing top priority** : BDD outside-in (scénario rouge → TDD interne vert → scénario vert), **100 % de couverture sur la logique fiscale** (amortissement, micro-BIC, plus-value), **chaque exception du droit a son scénario dédié**, ≥80 % couverture globale, cyclomatique < 10 par fonction, suite < 30 s. — *[BDD_PRACTICES.md](../BDD_PRACTICES.md), [SOFTWARE_CRAFTSMANSHIP.md](../SOFTWARE_CRAFTSMANSHIP.md)*
- **Documentation commitée avec le code** dans la même PR ; tout changement de comportement met à jour la doc. — *[CLAUDE.md](../CLAUDE.md) §Documentation hygiene*
- **Fiscal à jour LF 2026** : seuils, abattements, règles LMNP intégrés au code, **versionnés par année** (`RegleFiscale2026`, `RegleFiscale2027`…), revus chaque janvier post-loi de finances. — *[RISKS.md](../RISKS.md) §R1.1, [LMNP.md](../LMNP.md)*
- **Audit-friendly** : ledger d'opérations append-only, historique de corrections, snapshot annuel post-déclaration. — *[CLAUDE.md](../CLAUDE.md) §Principes directeurs*

## Key Decisions

| Décision | Rationale | Outcome |
|---|---|---|
| V1 = LMNP location meublée longue durée uniquement | Régime fiscal complexe + fort besoin de centralisation. Autres cas (nue, SCI, tourisme, multi-bailleur) reportés. | ✓ Good — 26/26 REQ livrés sans scope creep |
| Local-first / mono-user / SQLite | Autonomie utilisateur, contrôle des données, pas de coût récurrent cloud. | ✓ Good — aucune dépendance cloud sur v1.0 |
| Ubiquitous language français dans le code | Cohérence métier ↔ implémentation, traçabilité avec le droit fiscal français. | ✓ Good — tenu sur tout le code v1.0 |
| BDD outside-in mandaté pour la logique fiscale | Chaque règle du droit = scénario dédié. 100 % couverture sur amortissement / micro-BIC / plus-value. | ✓ Good — 100 % couverture `fiscalite/`, 199 fichiers de test |
| DDD hexagonal — 6 bounded contexts | Isole le domaine fiscal/locatif des adaptateurs (SQLite, OCR, INSEE IRL, mail). | ✓ Good — domaine pur, durci par Phase 5.1 (0 import infra dans `application/`) |
| Tech stack applicative non figée à l'init | À décider en `/gsd-discuss-phase 1` selon les contraintes du premier slice MVP. | ✓ Good — stack tranchée : TypeScript + Fastify + EJS (SSR) + SQLite/Kysely + pdfmake |
| Roadmap structurée en Vertical MVP slices | Permet activation rapide (KPI : créer 1 Bien + 1 Locataire + 1 Bail en première session), aligné BDD outside-in. | ✓ Good — chaque phase shippable ; 1 phase de hardening (5.1) + 2 gap-closure (8) insérées |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state (utilisation, feedback, métriques)

---
*Last updated: 2026-06-18 — Phase 10 complete (dette technique DET-01/02/03 épongée, atomicité Kysely posée)*

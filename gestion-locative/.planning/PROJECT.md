# Gestion locative

## What This Is

Logiciel de gestion locative **local-first**, **mono-utilisateur**, pour un propriétaire bailleur particulier qui gère son administratif et ses biens immobiliers en autonomie — sans cloud obligatoire, sans délégation, sans multi-utilisateur. V1 : LMNP en location meublée longue durée.

Vision détaillée : [VISION.md](../VISION.md).

## Core Value

**Centraliser factures, quittances, baux et échéances pour simplifier les obligations fiscales LMNP** (liasse 2031, 2042 C PRO, CFE, amortissements par composant, plus-value LF 2025) — sans cloud, sans délégation, sans multi-utilisateur.

## Requirements

### Validated

<!-- Shipped et confirmé valuable. -->

(Aucun — projet greenfield. Ship pour valider.)

### Active

<!-- Périmètre V1. Détail REQ-ID dans [REQUIREMENTS.md](REQUIREMENTS.md). -->

- [ ] Patrimoine — biens, lots, diagnostics (DPE, gaz, élec)
- [ ] Locatif — locataires, baux meublés, EDL, indexation IRL, gel DPE F/G, checklist mobilier (décret 2015-981)
- [ ] Encaissements — quittances PDF, avis d'échéance, suivi paiements, relances escaladées
- [ ] Fiscalité — micro-BIC vs réel, amortissement par composant, brouillon liasse 2031, CFE, détection bascule LMP
- [ ] Documents — upload justificatifs, recherche par Bien/Locataire/année, rétention 10 ans
- [ ] Dashboard — impayés, échéances, notifications J-30 / J-7 (CFE, IRL, diagnostics, fin de bail)
- [ ] Travaux — tickets incidents avec pièce jointe + coût

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
| V1 = LMNP location meublée longue durée uniquement | Régime fiscal complexe + fort besoin de centralisation. Autres cas (nue, SCI, tourisme, multi-bailleur) reportés. | — Pending |
| Local-first / mono-user / SQLite | Autonomie utilisateur, contrôle des données, pas de coût récurrent cloud. | — Pending |
| Ubiquitous language français dans le code | Cohérence métier ↔ implémentation, traçabilité avec le droit fiscal français. | — Pending |
| BDD outside-in mandaté pour la logique fiscale | Chaque règle du droit = scénario dédié. 100 % couverture sur amortissement / micro-BIC / plus-value. | — Pending |
| DDD hexagonal — 6 bounded contexts | Isole le domaine fiscal/locatif des adaptateurs (SQLite, OCR, INSEE IRL, mail). | — Pending |
| Tech stack applicative non figée à l'init | À décider en `/gsd-discuss-phase 1` selon les contraintes du premier slice MVP. | — Pending |
| Roadmap structurée en Vertical MVP slices | Permet activation rapide (KPI : créer 1 Bien + 1 Locataire + 1 Bail en première session), aligné BDD outside-in. | — Pending |

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
*Last updated: 2026-05-13 after initialization*

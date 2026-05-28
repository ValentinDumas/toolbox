# Phase 6: Liasse 2031 & CFE - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 6-liasse-2031-cfe
**Areas discussed:** Format du brouillon liasse, Périmètre annexes 2033, Modèle CFE & alerte, Traçabilité liasse → sources

---

## Format du brouillon liasse (G1)

### Q1 — Format global du brouillon

Première formulation (3 options : mapping case par case / aide-mémoire structuré / cerfa-fidèle PDF)
**rejetée par l'utilisateur** au profit d'une clarification.

**Clarification utilisateur :** « pour la liasse 2031, je veux le plus fidèle juridiquement
parlant et parlant à l'utilisateur. »

**Résolution :** mapping case-par-case (numéro de case cerfa + libellé officiel + valeur
calculée) — concilie fidélité juridique et lisibilité bailleur. → **D-L6.1**

### Q2 — Régimes couverts

| Option | Description | Selected |
|--------|-------------|----------|
| Réel uniquement | Liasse 2031-SD + 2033 (réel) seulement ; micro = 2042 C PRO hors brouillon | |
| Réel + micro-BIC | Brouillon réel complet + brouillon minimaliste 2042 C PRO | ✓ |

**User's choice:** Réel + micro-BIC → **D-L6.2**

### Q3 — Versioning du mapping case → valeur

| Option | Description | Selected |
|--------|-------------|----------|
| Fichier mapping versionné par année | Pattern `regles-2026.ts` : `mapping-liasse-2026.ts`, revu chaque janvier | ✓ |
| Config dynamique en base | Table SQLite éditable sans code | |

**User's choice:** Fichier versionné par année → **D-L6.3**

### Q4 — Formats d'export

| Option | Description | Selected |
|--------|-------------|----------|
| PDF + vue HTML | Vue HTML consultable + PDF téléchargeable | |
| PDF seul | PDF uniquement | |
| PDF + CSV + vue HTML | Les 3 formats (CSV pour expert-comptable) | ✓ |

**User's choice:** PDF + CSV + vue HTML.
**Notes:** « si le csv est "incomplet", alors je prends option 3. Assure-toi de me recommander
le plus aligné avec ma vision et le juridique. » → le CSV liasse doit être complété avec le
mapping case-par-case (pas le simple récap CSV Phase 5). → **D-L6.4**

### Q5 — Liasse rectificative

| Option | Description | Selected |
|--------|-------------|----------|
| Même brouillon, données corrigées | Même format + bandeau « Rectificative — motif » | ✓ |
| Brouillon différentiel (avant/après) | Valeur originale barrée + nouvelle valeur | |

**User's choice:** Même brouillon, données corrigées → **D-L6.5**

---

## Périmètre annexes 2033 (G2)

### Q1 — Quelles annexes inclure

| Option | Description | Selected |
|--------|-------------|----------|
| A + B + C + D uniquement | 4 annexes pertinentes LMNP personne physique ; E reportée, F/G exclues | ✓ |
| A à E (inclure CVAE) | + 2033-E (valeur ajoutée) | |
| A à G (toutes) | 7 annexes même vides | |

**User's choice:** A + B + C + D uniquement → **D-A6.1**

### Q2 — Niveau de complétude 2033-A (bilan)

| Option | Description | Selected |
|--------|-------------|----------|
| Postes couverts uniquement | Immobilisations/amort./VNC + « à compléter manuellement » pour le reste | ✓ |
| Bilan complet avec saisie manuelle | Formulaire de complément trésorerie/dettes | |

**User's choice:** Postes couverts uniquement → **D-A6.2**

### Q3 — 2033-D : ARD, historique ou solde seul

| Option | Description | Selected |
|--------|-------------|----------|
| Solde exercice + historique compact | Case ARD + tableau année/généré/consommé/cumul | ✓ |
| Solde exercice seul | Montant ARD dans la case uniquement | |

**User's choice:** Solde exercice + historique compact → **D-A6.4** (2033-B couvert par défaut → **D-A6.3**)

---

## Modèle CFE & alerte (G3)

### Q1 — Niveau de modélisation

| Option | Description | Selected |
|--------|-------------|----------|
| Suivi déclaratif + échéance | Agrégat léger `DeclarationCfe` (statut, dates, montant) ; pas de reproduction du 1447-C-SD | ✓ |
| Formulaire 1447-C-SD intégré | Reproduire les cases du formulaire | |
| Simple checklist | Checkbox sur la fiche Bien | |

**User's choice:** Suivi déclaratif + échéance → **D-CFE6.1, D-CFE6.3**

### Q2 — Rattachement DDD

| Option | Description | Selected |
|--------|-------------|----------|
| BC Fiscalité, référence BienId | `domain/fiscalite/`, ref BienId par identifiant | ✓ |
| Sous-agrégat de Bien (BC Patrimoine) | Comme `Diagnostic` | |

**User's choice:** BC Fiscalité, référence BienId → **D-CFE6.2**

### Q3 — Exonérations

| Option | Description | Selected |
|--------|-------------|----------|
| Statut exonération + info pédagogique | Statuts exonération + aide contextuelle première année | ✓ |
| Statut simple sans exonération | déposée / non déposée / payée | |

**User's choice:** Statut exonération + info pédagogique → **D-CFE6.4**

### Q4 — Emplacement de l'alerte

| Option | Description | Selected |
|--------|-------------|----------|
| Banner sur fiche Bien + page fiscalité | Banner J-30 (pattern IRL Phase 3) ; Phase 7 consolide | ✓ |
| Différer entièrement à Phase 7 | Phase 6 = données seules | |

**User's choice:** Banner sur fiche Bien + page fiscalité → **D-CFE6.5**

---

## Traçabilité liasse → sources (G4)

### Q1 — Mécanisme de traçabilité

| Option | Description | Selected |
|--------|-------------|----------|
| Liens cliquables HTML + annotations PDF/CSV | Drill-down complet par case | ✓ |
| Renvoi vers pages existantes | Lien vers le récap Phase 5 | |
| Annotations statiques PDF seul | Notes explicatives par case | |

**User's choice:** Liens cliquables HTML + annotations PDF/CSV → **D-T6.1**

### Q2 — Granularité

| Option | Description | Selected |
|--------|-------------|----------|
| Par case cerfa | Chaque case a sa liste de sources | ✓ |
| Par section de la liasse | Au niveau de chaque annexe | |

**User's choice:** Par case cerfa → **D-T6.2**

### Q3 — Construction des données de traçabilité

| Option | Description | Selected |
|--------|-------------|----------|
| Read-model à la génération | Use case cross-BC agrège les sources vivantes | ✓ |
| Snapshot sources dans DeclarationAnnuelle | Figer les IDs à la clôture (modifie Phase 5) | |

**User's choice:** Read-model à la génération → **D-T6.3**

### Q4 — Cohérence audit snapshot vs sources vivantes (follow-up soulevé par Claude)

Claude a signalé un risque : le snapshot fige les totaux mais pas les IDs sources ; un
encaissement annulé post-clôture ferait diverger la somme vivante de la valeur figée.

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot fait foi + réconciliation visible | Valeur = snapshot ; bandeau si Σ vivant ≠ snapshot | ✓ |
| Figer les IDs sources à la clôture | Étendre Phase 5 (snapshot lourd) | |

**User's choice:** Snapshot fait foi + réconciliation visible → **D-T6.4** (respecte anti-patterns Phase 5 #3/#4)

---

## Claude's Discretion

- Numéros de cases exacts des cerfa (2031-SD / 2033-A-D / 2042 C PRO) — à vérifier par le researcher.
- Découpage des migrations SQLite (`0022_phase6_declaration_cfe.sql`).
- Routes Fastify exactes, helpers EJS, mise en page pdfmake, forme du DTO de traçabilité.

## Deferred Ideas

- **V1.1** : annexe 2033-E (CVAE), 1447-M-SD (modification CFE), SIM-01/02, liasse différentielle, calcul IR/PS.
- **V2** : EDI-01 (EDI-TDFC), assistant remplissage 1447-C-SD, override utilisateur du mapping.
- **Phase 7** : dashboard consolidé des échéances + notifications J-30/J-7 (DAS-02).

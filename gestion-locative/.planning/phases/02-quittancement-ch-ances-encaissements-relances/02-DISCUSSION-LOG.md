# Phase 2: Quittancement — Échéances, Encaissements, Relances - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 2-quittancement-echeances-encaissements-relances
**Areas discussed:** Génération échéances + statut Bail actif, Modèle Encaissement ↔ Échéance, Quittances PDF — émission/numérotation/stockage, Relances — niveaux/canal/templates, Edge cases (activation rétroactive, modification Bail actif, suppression Bail avec activité)

---

## Pré-discussion : gestion d'un scope creep utilisateur

**Demande utilisateur (multiSelect):** *"j'aimerais en priorité discuter le fait de pouvoir importer mes tickets / factures afin de connaitre mon total de charges deductible et le calcul complet pour savoir combien d'impôts estimés pour ma lmnp. Tu l'as pris en compte ?"*

**Réponse Claude :** Demande explicitement **hors-périmètre Phase 2** par le slicing MVP. Mappée dans la roadmap :
- Import tickets/factures → DOC-01/02/03 (Phase 4)
- Total charges déductibles → FIS-03 (Phase 5)
- Calcul micro-BIC / amortissement → FIS-02/04 (Phase 5)
- Brouillon liasse 2031 → FIS-05 (Phase 6)

| Option | Description | Selected |
|--------|-------------|----------|
| Garder Phase 2 telle quelle | Slicing MVP actuel : Phase 2 = quittancement seul. Charges déductibles Phase 4, estimation impôt Phase 5/6. | ✓ |
| Réorganiser la ROADMAP | Stop discuss, utiliser /gsd-phase pour réordonner. | |
| MVP fiscal vertical dès Phase 2 | Élargir Phase 2 à encaissement + import basique + estimation micro-BIC (~12-15 plans). | |

**User's choice:** Garder Phase 2 telle quelle.
**Notes:** Décision capturée dans `<deferred>` de CONTEXT.md avec renvoi explicite vers Phases 4/5/6.

---

## Génération échéances + statut Bail actif

### Q1 — Statut du Bail

| Option | Description | Selected |
|--------|-------------|----------|
| `actif_depuis: PlainDate \| null` | Singleton minimal YAGNI. Brouillon si null. Notion "terminé" dérivée de date_debut + dureeMois. | ✓ |
| Enum `statut: brouillon \| actif \| termine` | Transitions explicites. Sur-modélisation V1. | |
| Deux champs `actif_depuis` + `termine_le` | Approche complète. 2 champs nullables, "terminé" inutile Phase 2. | |

**User's choice:** `actif_depuis: PlainDate | null`.

### Q2 — Stratégie de génération des EcheanceLoyer

| Option | Description | Selected |
|--------|-------------|----------|
| Auto à l'activation : toute la durée d'un coup | 1 clic active + génère 12-36 échéances. Aucun cron. | ✓ |
| Auto mois courant + on-demand | Friction mensuelle, oubli possible. | |
| Hybride 12 mois rolling | Besoin mécanisme rolling (cron OU check au boot). | |

**User's choice:** Auto à l'activation, toute la durée. (Question initiale : *"que recommande tu par rapport a ma vision?"* — Claude a fourni un tableau d'alignement avec VISION.md.)
**Notes:** Recommandation choisie pour aligner sobre + audit-friendly + local-first + LMNP longue durée prévisible.

### Q3 — Jour d'échéance

| Option | Description | Selected |
|--------|-------------|----------|
| `jour_echeance: 1..28` sur Bail (défaut 1) | Paramétrable, plafonné 28 (mois courts). Loi 89 art. 7 "aux dates convenues". | ✓ |
| Toujours le 1er (hard-codé) | Zero param, ne reflète pas la réalité contractuelle. | |
| Dérivé de date_debut | Bizarre pour bail commencé le 23. | |

**User's choice:** `jour_echeance: 1..28` sur le Bail (défaut 1).

### Q4 — Composition de l'EcheanceLoyer

| Option | Description | Selected |
|--------|-------------|----------|
| Snapshot complet (loyer_hc + charges + total + période + jour_echeance) | Audit-friendly, immutable, simple JOIN inutile. | ✓ |
| Référence Bail seul (calcul à la volée) | Indexation Phase 3 modifierait rétroactivement → catastrophe audit. | |
| Snapshot minimal (juste total) | Quittance loi 89 exige détail loyer/charges. | |

**User's choice:** Snapshot complet.

### Q5 — Statut interne EcheanceLoyer

| Option | Description | Selected |
|--------|-------------|----------|
| Enum stocké `en_attente \| partiellement_payee \| payee \| annulee`, recalculé à chaque Encaissement | Requêtes dashboard simples. "En retard" non stocké (dérivé). | ✓ |
| Pas de statut, calcul SUM(encaissements) à la volée | Requêtes plus lourdes, perf Phase 7. | |
| Enum stocké + `payee_le: PlainDate \| null` | Date dérivable du max(encaissements.date) au besoin. | |

**User's choice:** Enum stocké + recalculé.

### Q6 — Granularité de la période

| Option | Description | Selected |
|--------|-------------|----------|
| Mois civil strict (1er → dernier jour) | Aligne usage LMNP, liasse 2031 (chaque période dans 1 exercice). | |
| Période glissante (jour_echeance → jour_echeance-1) | Chevauche 2 mois civils, complique liasse fiscale. | |
| Mois civil + prorata 1ère/dernière échéance | Juridiquement exact pour bail démarrant en milieu de mois. | ✓ |

**User's choice:** Option 3 — mois civil + prorata 1ère/dernière échéance.
**Notes:** L'utilisateur a d'abord demandé clarification (*"dans les questions précedentes on a definit entre le 1 et le 28 pour lecheance. Quel impact ?"*) puis (*"ok mais est ce que le montant se regle au prorata de la date d'arrivée / sortie du locataire ?"*). Claude a expliqué la distinction `jour_echeance` (date paiement) vs `période` (jouissance) puis confirmé que le prorata est l'usage standard LMNP (loi 89 ne l'impose pas mais c'est la pratique). Recommandation révisée vers Option 3.

---

## Modèle Encaissement ↔ Échéance

### Q1 — Cardinalité

| Option | Description | Selected |
|--------|-------------|----------|
| N:1 — plusieurs encaissements par échéance | Gère paiement plein/partiel/étalé. Cas multi-mois = N saisies (1/mois). | ✓ |
| N:M — table jointure avec montant ventilé | Juridiquement parfait, complexité au-dessus du besoin V1. | |
| 1:1 strict | Contradit ENC-03 (paiements partiels). | |

**User's choice:** N:1.

### Q2 — Modes de paiement

| Option | Description | Selected |
|--------|-------------|----------|
| Enum strict 5 valeurs : `virement \| cheque \| especes \| prelevement \| autre` | Couvre 100% LMNP. Agrégation propre Phase 5. | ✓ |
| Free-text | Impossible d'agréger (Virement / virement / VIR = 3 valeurs distinctes). | |
| Enum minimal 3 valeurs | Perd distinction espèces (seuil CMF) et prélèvement. | |

**User's choice:** Enum strict 5 valeurs.

### Q3 — Sur-paiement

| Option | Description | Selected |
|--------|-------------|----------|
| Accepter + warning (pas de report auto V1) | Sobre, audit-friendly, user en contrôle. | ✓ |
| Refuser strict (bloquer la saisie) | Force des contournements, perd info réelle. | |
| Accepter + report auto sur prochaine échéance | Magie cachée, couplage entre échéances, risque erreurs. | |

**User's choice:** Option 1.
**Notes:** Question initiale *"option 1 ou 3 en accord avec ma vision ?"*. Claude a fourni un tableau d'alignement (sobre, audit-friendly, mono-user, cas LMNP réel). Évolution naturelle V1.x : bouton explicite "Reporter sur prochaine échéance" si Phase 7 le justifie.

### Q4 — Modification/suppression Encaissement (audit-friendly)

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete + correction = nouvel Encaissement compensateur | Audit parfait, historique intact. | ✓ |
| Hard-delete + audit_log séparé | 2 sources de vérité, risque incohérence. | |
| Soft-delete simple + edit in place | Modification écrase l'historique → pas vraiment audit-friendly. | |

**User's choice:** Soft-delete + compensateur.

### Q5 — Contraintes sur la date d'Encaissement

| Option | Description | Selected |
|--------|-------------|----------|
| Permissive : aucune contrainte stricte, warnings extrêmes | Reflète tous les cas LMNP réels. | ✓ |
| Stricte : date ∈ [date_debut, today] | Bloque paiement à l'avance, régularisation oubliée. | |
| Modérée : date ≤ today | Bloque le futur, autorise passé. | |

**User's choice:** Permissive + warnings.

### Q6 — Statut Encaissement

| Option | Description | Selected |
|--------|-------------|----------|
| Non — juste `annule_le` (V1 sobre) | L'existence = "encaissé" implicite. | ✓ |
| Enum minimal `encaisse \| annule` | Redondant avec annule_le. | |
| Enum complet `en_attente \| encaisse \| rapproche \| annule` | Workflow rapprochement bancaire. Reporter Phase 7+. | |

**User's choice:** Pas d'enum, juste annule_le.

---

## Quittances PDF — émission, numérotation, stockage

### Q1 — Déclenchement de l'émission

| Option | Description | Selected |
|--------|-------------|----------|
| Manuel (bouton si payée) + persistance fichier local | Conforme loi 89 "sur demande", audit-friendly. | ✓ |
| Auto dès qu'une échéance bascule "payée" | Génère PDF non demandés, pollue stockage. | |
| On-the-fly sans persistance | Si données sources changent post-émission, contenu mouvant → traçabilité cassée. | |

**User's choice:** Manuel + persistance.
**Notes:** Question initiale *"1 ou 3 selon ma vision ? est-ce que l'on peut donner une quittance de loyer sur le dernier mois meme s'il n'a pas encore été 'payé'"*. Claude a (a) répondu NON juridiquement (la quittance loi 89 inclut "tous comptes apurés" = preuve de paiement, opposable au bailleur si mal émise), (b) tableau d'alignement Option 1 vs Option 3 avec audit-friendly comme critère décisif.

### Q2 — Numérotation des quittances

| Option | Description | Selected |
|--------|-------------|----------|
| Séquentielle annuelle `AAAA-NNN` (reset annuel) | Aligne pratique comptable, Phase 6 liasse groupe par exercice. | ✓ |
| Continue globale `00001`, `00002`... | Numéros qui grossissent indéfiniment. | |
| Par bail `BAIL-{id}-001` | Pas globalement unique, plus difficile à référencer. | |

**User's choice:** `AAAA-NNN` annuel.

### Q3 — Cohérence post-correction

| Option | Description | Selected |
|--------|-------------|----------|
| Détection auto + warning + bouton "Annuler la quittance". Originale immutable. Nouvelle = numéro suivant. | Audit + UX : l'utilisateur voit le pb et agit. | ✓ |
| Pas de détection auto (l'utilisateur gère) | Léger mais moins audit-friendly. | |
| Bloquer la correction d'Encaissement si quittance émise | Irréaliste, force des contournements. | |

**User's choice:** Détection auto + annulation.

### Q4 — Politique avis d'échéance

| Option | Description | Selected |
|--------|-------------|----------|
| Aucune numérotation, on-the-fly sans persistance | Nature non-probante, identifié par période + bail. | ✓ |
| Numérotation parallèle `AVIS-AAAA-NNN` + persistance | Sur-modélisation. | |
| Persistance sans numérotation | Métadonnées fichier suffisent. | |

**User's choice:** On-the-fly sans persistance, sans numéro.

### Q5 — Identité du Bailleur (concept absent Phase 1)

| Option | Description | Selected |
|--------|-------------|----------|
| Agrégat `Bailleur` minimal V1 (nom + adresse) dans nouveau BC `identite` | Singleton mono-user. SIRET ajouté Phase 5/6. Cohérent patterns Phase 1. | ✓ |
| Stockage simple dans table `meta` (clé/valeur JSON) | Pas d'invariants, ne suit pas les patterns Phase 1. | |
| Champ par Bail (multi-bailleur) | Hors-périmètre V1 (PROJECT.md). | |

**User's choice:** Agrégat `Bailleur` dans BC `identite` (placement `_shared/` à trancher au planner).

---

## Relances — niveaux, canal, templates

### Q1 — Niveaux d'escalade V1

| Option | Description | Selected |
|--------|-------------|----------|
| 3 niveaux : amiable J+10 → relance ferme J+30 → mise en demeure J+60 | Pré-judiciaire complet. Commandement (huissier) hors-périmètre. | ✓ |
| 2 niveaux : amiable → mise en demeure | Plus brusque, moins réaliste. | |
| Niveaux configurables par l'utilisateur | Sur-modélisation V1. | |

**User's choice:** 3 niveaux.

### Q2 — Canal V1

| Option | Description | Selected |
|--------|-------------|----------|
| Hybride : niveau 1-2 = mailto natif, niveau 3 = PDF imprimable | Local-first, conforme légal (mise en demeure = RAR poste). | ✓ |
| SMTP via env vars | Configuration technique, sécurité du mot de passe. | |
| PDF imprimable seulement les 3 niveaux | Friction énorme niveau amiable. | |

**User's choice:** Hybride mailto + PDF.

### Q3 — Templates

| Option | Description | Selected |
|--------|-------------|----------|
| Templates fixes V1 (fichiers EJS) | Mise à jour juridique = édit fichier + commit + git pull. Audit-friendly via Git. | ✓ |
| Templates personnalisables (édition UI) | Surface UI suppl., risque template juridiquement faible. | |
| Fixes V1 + override fichier user (sans UI) | Compromis. Reporter V1.x. | |

**User's choice:** Templates fixes EJS dans `templates/relances/`.
**Notes:** Question initiale *"est-ce qu'il sera simple avec loption 1 e mettre à jour les templates en fonction de changements juridiques ?"*. Claude a confirmé OUI à condition d'utiliser des fichiers .ejs séparés (pas strings TS embarquées) — édition + commit + git pull. Pattern réutilisable Phase 5/6 pour courriers fiscaux.

### Q4 — Détection automatique

| Option | Description | Selected |
|--------|-------------|----------|
| Suggestion contextuelle (bouton si J+seuil + niveau précédent envoyé) | Sobre, audit, "logiciel qui aide". Chaînage strict. | ✓ |
| Pure manuelle | App ne fait que stocker, pas active. | |
| Envoi automatique (mailto auto) | Perte de contrôle, surprises, ton inadapté. | |

**User's choice:** Suggestion contextuelle.
**Notes:** Question utilisateur *"choisis le plus aligné avec ma vision et le juridique"*. Claude a fourni tableau d'alignement (sobre, audit, vision "logiciel qui simplifie", juridique pas de seuil obligatoire).

---

## Edge cases supplémentaires (validés post-areas)

### Q5 — Activation rétroactive d'un Bail

| Option | Description | Selected |
|--------|-------------|----------|
| Permissive avec warning > 2 ans | Cas LMNP réel (rattrapage admin), audit-friendly. | ✓ |

### Q6 — Modification d'un Bail actif

| Option | Description | Selected |
|--------|-------------|----------|
| Confirmation explicite + régénération uniquement futures non payées (passées/payées immutables) | Audit + sobre. | ✓ |

### Q7 — Suppression d'un Bail avec activité

| Option | Description | Selected |
|--------|-------------|----------|
| Refuser, proposer désactivation `actif_depuis = null` | Audit, juridique (10 ans rétention), historique opposable. | ✓ |

**Notes:** Les 3 décisions présentées en bloc avec recommandations alignées vision + juridique. User a validé toutes les 3 en bloc (*"Oui, valider les 3"*) sans creuser.

---

## Claude's Discretion

L'utilisateur a délégué à Claude la décision sur :
- Convention exacte des routes Fastify Phase 2.
- Nommage des partials EJS spécifiques Phase 2.
- Détails libellés / placeholders.
- Découpage migrations.
- Encoding mailto: UTF-8.
- Politique d'arrondi du prorata.

Tous notés en `<decisions>` § "Claude's Discretion" du CONTEXT.md ; arbitrage final par le `gsd-planner` ou le `gsd-executor`.

## Deferred Ideas

Capturées dans `<deferred>` du CONTEXT.md :
- Import factures / charges / estimation impôt → couvert par Phases 4/5/6.
- Résiliation anticipée → V2.
- Report auto sur-paiement → V1.x.
- SMTP optionnel → V1.x sur demande.
- Statut Encaissement complet (rapprochement) → Phase 7+.
- Override utilisateur templates EJS → V1.x.
- Indemnité d'occupation, multi-bailleur, commandement de payer → V2 ou hors-périmètre.
- Compensation impayé sur dépôt de garantie → Phase 3 EDL sortie.

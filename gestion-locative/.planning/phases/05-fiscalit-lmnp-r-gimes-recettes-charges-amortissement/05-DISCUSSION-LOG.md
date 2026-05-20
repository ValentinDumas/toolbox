# Phase 5 : Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement — Discussion Log

> **Audit trail only.** Ne pas utiliser comme entrée des agents de planning / research / execution.
> Les décisions sont capturées dans `05-CONTEXT.md` — ce log préserve les alternatives considérées.

**Date :** 2026-05-19 → 2026-05-20
**Phase :** 5 — Fiscalité LMNP — Régimes, Recettes/Charges, Amortissement
**Areas discussed :** G1 (Composants), G2 (Qualification charges), G3 (LMP foyer), G4 (Clôture & immutabilité), G5 (zones complémentaires : multi-bien, sortie composant, exports, onboarding)
**Mode :** `discuss` par défaut, single-question turns
**Mode effort :** max

---

## Préambule — Décisions Claude lockées avant discussion

Présentées au début (pas dans AskUserQuestion — annoncées comme non-négociables).

- **D-LOCK-1** — Seuils versionnés par année dans `domain/fiscalite/regles/regles-2026.ts`.
- **D-LOCK-2** — Régime fiscal porté par `Bailleur` (single-bailleur V1), pas par Bien.
- **D-LOCK-3** — Plus-value de cession HORS Phase 5 (SIM-02 V1.1).
- **D-LOCK-4** — CFE hors Phase 5 (Phase 6).
- **D-LOCK-5** — Cotisations SSI / TNS non modélisées (D-LOCK-5).

---

## Sélection des gray areas

| Option | Description | Sélectionné |
|--------|-------------|----------|
| G1 — Modèle Composant sur Bien | Granularité / valuation amortissement | ✓ |
| G2 — Qualification fiscale des charges | Où / quand tagger entretien/amélioration | ✓ |
| G3 — Bascule LMP : revenus du foyer | Saisie données inconnues de l'app | ✓ |
| G4 — Année fiscale : clôture & immutabilité | Snapshot, ARD, déclaration corrigée | ✓ |

**Choix utilisateur :** toutes les 4 zones (« toutes ces discussions »).

---

## G1 — Modèle Composant sur Bien

### G1.1 — Granularité

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Composants fixes BOFIP | 6 composants prédéfinis + durées canoniques | ✓ |
| Composants libres | Saisie libre par bailleur | |
| Ventilation guidée par défaut + override | Pré-rempli 70/15/10/5 % | |

**Choix utilisateur :** Composants fixes BOFIP.

### G1.2 — Mobilier (composant dynamique)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Hybride : initial sur Bien + ajouts via TicketTravaux | Cohorte d'amortissement par acquisition | ✓ |
| Tout sur Bien (saisie cumulée) | Une seule ligne mobilier, cumulée | |
| Tout via TicketTravaux | Bien.composantMobilier calculé | |

**Choix utilisateur :** Hybride. Conséquence : nouvelle valeur `acquisition_mobilier` dans l'énum `NatureTicket`.

### G1.3 — Frais d'acquisition

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Prorata BOFIP sur composants amortissables | Doctrine BOFIP-BIC-AMT-10-20 §110 | ✓ |
| Sur gros œuvre uniquement | Plus simple, sous-optimal | |
| Charges déductibles immédiatement | Crée déficit + ARD report | |
| Laisse-moi choisir au cas par cas | Toggle par bien | |

**Choix utilisateur :** Prorata BOFIP. *(Première formulation de la question avait dérivé sur un autre sujet — re-formulée explicitement avec exemple concret 200k€ + 16k€ notaire + 8k€ agence.)*

**Notes :** Le dernier composant absorbe l'écart d'arrondi pour garantir Σ quote-part = frais total.

### G1.4 — Quand saisir la valorisation initiale

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Écran dédié "Activer fiscalité" en Phase 5 | Bien utilisable sans valorisation pour Phases 1–4 | ✓ |
| Extension du wizard Phase 1 | Saisie obligatoire dès création | |
| Au moment de la déclaration annuelle | Saisie répétée chaque année | |

**Choix utilisateur :** Écran dédié Phase 5. Ne casse pas Phases 1–4 + KPI activation préservé.

### G1.5 — Travaux d'amélioration post-acquisition

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Nouveau composant additionnel avec sa propre date | Chaque amélioration = ligne dédiée | ✓ |
| Agrégation sur le composant existant | Cumul valeur, date inchangée | |
| Charge déductible immédiate si < seuil, sinon composant | Seuil 600 € BOFIP | |

**Choix utilisateur :** Nouveau composant additionnel. Compatible LF 2025 plus-value (sépare gros œuvre initial vs améliorations).

### G1.6 — Prorata temporis

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Prorata au jour près | Strict BOFIP, réutilise `Money.multiplyByFraction(jours, 365)` | ✓ |
| Prorata au mois près | Tolérance BOFIP, plus simple à lire | |
| Pas de prorata | Année entière même partielle | |

**Choix utilisateur :** Prorata au jour près. Test BDD : bien acquis 2026-03-15, gros œuvre 200k€/40 ans → dotation 2026 = 5 000 € × 292/365 = 4 000 €.

### G1.7 — ARD reportable

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Tableau dédié Phase 5 + bandeau d'info | Vue ARD + bandeau pédagogique | ✓ |
| Visible seulement Phase 6 | Calculé interne Phase 5, exposé Phase 6 | |
| Ligne dans bilan annuel + drill-down | Compromis | |

**Choix utilisateur :** Tableau dédié + bandeau pédagogique. R4.3 + alimente directement 2033-B Phase 6.

### G1.8 — Quote-part terrain

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Saisie utilisateur libre + aide contextuelle | 0–30 %, tooltip BOFIP, pas de pré-remplissage | ✓ |
| Pré-rempli 15 % par défaut + override | Accélère mais risque par défaut non vérifié | |
| Wizard guidé "estimer ma quote-part terrain" | 3 questions guidées | |

**Choix utilisateur :** Option 1. R4.3 + respect autonomie.

**Question utilisateur durant G1.8 :** "Quel amortissement a été retiré du statut par le projet loi finance appliqué 1er janvier 2026 ?"

**Réponse Claude (sources vérifiées via WebSearch)** :
- **Aucun amortissement n'a été retiré du statut LMNP par LF 2026** (sous-amendement plafonnement 2 %/an rejeté).
- Confusion fréquente : LF 2025 art. 84 (CGI 150 VB III) réintègre les amortissements gros œuvre dans la PV — déjà capturé `LMNP.md §6`.
- Réels changements LF 2026 : CSG 9.2 → 10.6 % (PS 17.2 → 18.6 % sur revenus BIC), seuil micro 77 700 € → 83 600 € pour recettes 2026-2028.
- **Conséquence Phase 5 :** seuils LMNP.md confirmés OK pour 2026. Hausse PS notée en `<deferred>`.

### Check post-G1 (1er passage, 4 questions)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Passer à G2 | G1 satisfait pour planner | |
| Plus de questions sur G1 | 4 questions supplémentaires | ✓ |

**Choix utilisateur :** Plus de questions sur G1 → poursuite avec G1.5–G1.8.

### Check post-G1 (2e passage, 8 questions total)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Passer à G2 | G1 saturé | ✓ |
| Encore G1 | 4 questions de plus | |

**Choix utilisateur :** Passer à G2.

---

## G2 — Qualification fiscale des charges

### G2.1 — Où et quand tagger un Justificatif

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Écran dédié "Qualifier les charges {année}" en Phase 5 | Différé, bulk annuel | ✓ |
| À l'upload (extension Phase 4 a posteriori) | Donnée propre dès l'origine | |
| Sur le ticket uniquement, pas sur le justificatif | Justificatif hérite du ticket | |

**Choix utilisateur :** Écran dédié déféré. Pas de migration Phase 4.

### G2.2 — Taxonomie

| Option | Description | Sélectionné |
|--------|-------------|----------|
| 4 catégories fines alignées 2033-A | entretien_reparation / amelioration / charge_courante_periodique / non_deductible | ✓ |
| 3 catégories simples | deductible_immediate / amortissable / non_deductible | |
| Catégories par usage avec sous-types | 2 niveaux, expressif | |

**Choix utilisateur :** 4 catégories. Map direct sur lignes 2033-A.

### G2.3 — Ticket vs Justificatif

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Au niveau du Ticket entier | Doctrine BOFIP "ensemble de travaux" | ✓ |
| Au niveau de chaque Justificatif | Granularité fine, risque incohérence | |
| Hybride : ticket défini la règle, justificatif override | Flexibilité, complexité | |

**Choix utilisateur :** Au niveau du Ticket entier. Cohérence audit.

### G2.4 — Montant HT vs TTC

| Option | Description | Sélectionné |
|--------|-------------|----------|
| TTC partout, montant_ttc obligatoire si qualifié | LMNP V1 non assujetti TVA | ✓ |
| Séparer HT + tauxTva | Donnée plus riche, inutile V1 | |
| TTC obligatoire dès l'upload | Trop strict, casse Phase 4 | |

**Choix utilisateur :** TTC partout.

### Check post-G2 (1er passage, 4 questions)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Passer à G3 | G2 satisfait | |
| Encore G2 | 4 questions supplémentaires | ✓ |

**Choix utilisateur :** Encore G2.

### G2.5 — Reclassement a posteriori

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Modification ouverte tant que brouillon, bloquée après clôture | Opposabilité fiscale | ✓ |
| Modification toujours possible avec historique | Audit-friendly mais brise figeage | |
| Bloquée dès qu'utilisée dans un calcul fiscal | Trop strict | |

**Choix utilisateur :** Brouillon-only. Cohérence forte avec G4.

### G2.6 — Multi-biens

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Split obligatoire à la qualification | parent_justificatif_id + N enfants | ✓ |
| Multi-rattachement N:N avec quote-part | Plus pur, alourdit modèle | |
| Rattachement principal + tag informatif | Perd la 2e moitié | |

**Choix utilisateur :** Split obligatoire. Use case `decomposer-justificatif`.

### G2.7 — Suggestion

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Suggestion déterministe par TypeJustificatif | Validation 1-clic | ✓ |
| Aucune suggestion V1 | Pénible 60+/an | |
| Suggestion IA (LLM) | V2 CLA-01 différé | |

**Choix utilisateur :** Option 1 + considérer option 3 (LLM) pour V2.

### G2.8 — Coût sans pièce

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Accepté + badge "Sans pièce" persistant | Jurisprudence + pédagogie | ✓ |
| Refusé — obliger justificatif | Trop strict | |
| Accepté sans warning | Risque contrôle | |

**Choix utilisateur :** "Prend le plus adapté avec ma vision et le juridique. 1 ?" → Claude confirme option 1 sur la base de jurisprudence (BOFIP-BIC-CHG-10-10 admet déduction sans pièce si dépense démontrée par d'autres moyens) + pédagogie R4.3.

### Check post-G2 (2e passage, 8 questions)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Passer à G3 | | |
| Encore G2 | | ✓ |

**Choix utilisateur :** Encore G2.

### G2.9 — Taxe foncière

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Justificatif standard + qualification standard | Décomposition manuelle | (Claude's call) |
| Type dédié `taxe_fonciere` + assistant TEOM | Inflate enum | |
| Modéliser ImpotsLocaux dédié | Sur-dimensionné V1 | |

**Choix utilisateur :** "Choisis le plus aligné avec ma vision et le juridique." → Claude analyse : option 1 hybride avec widget pédagogique ciblé (heuristique sur libellé) sans inflater l'enum. Réutilise `decomposer-justificatif` pour TF nette + TEOM séparée.

### G2.10 — Intérêts d'emprunt

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Justificatif annuel uniquement | V1 simple | ✓ |
| Agrégat Pret avec tableau d'amortissement | V1.1 SIM-01 | |
| Hybride pretInfo simplifié sur Bien | Compromis | |

**Choix utilisateur :** Justificatif annuel. V1.1 ajoutera `Pret` pour SIM-01.

### G2.11 — Date de rattachement

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Date de paiement effectif (datePaiement) | Encaissement | ✓ |
| Date du document toujours | dateDocument.year | |
| Au choix utilisateur | Risque optimisation agressive | |

**Choix utilisateur :** datePaiement (avec fallback dateDocument). Nuance documentée : BOFIP-BIC-DECLA-30-30 (micro encaissement) + BOFIP-BIC-DECLA-30-40-20 (tolérance encaissement en réel pour LMNP non pro).

### G2.12 — Loyers irrécouvrables

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Pas de comptabilisation | Cohérent encaissement G2.11 | (Claude's call) |
| Comptabiliser comme charge déductible | Comptabilité d'engagement | |
| Hybride : trace sans effet fiscal V1 | Compromis | |

**Choix utilisateur :** "Va au plus simple en respectant le DDD et le juridique." → Claude analyse : option 1 (aucune écriture). Cohérence stricte G2.11 + DDD KISS + le bailleur ne perd rien fiscalement par rapport à engagement.

### Check post-G2 (3e passage, 12 questions)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Passer à G3 | | |
| Encore G2 | | ✓ |

**Choix utilisateur :** Encore G2.

### G2.13 — Honoraires EC + OGA

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Charge déductible standard + widget réduction d'impôt | Recommandé (mais...) | (Choisi mais corrigé) |
| Charge déductible standard sans widget | Simple | (Retenu après vérif) |
| Non déductible | Faux | |

**Choix utilisateur :** Option 1, mais Claude vérifie via WebSearch et corrige : **art. 199 quater B abrogé par LF 2025 art. 11** (loi 2025-127). Dernière application = revenus 2024. Pour Phase 5 (exercices 2026+) : option 2 effective (charge déductible sans widget de réduction). Aide contextuelle : "Depuis LF 2025, l'adhésion à un OGA n'apporte plus de réduction d'impôt. La cotisation reste déductible en charge."

### G2.14 — Frais kilométriques

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Justificatif annuel manuel + barème reportable | V1 simple, local-first | ✓ |
| Agrégat DeplacementProfessionnel | V1.1 | |
| Hors scope Phase 5 | Trop strict | |

**Choix utilisateur :** Justificatif annuel manuel.

### G2.15 — Frais syndic

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Décomposition manuelle widget dédié | Réutilise decomposer-justificatif | ✓ |
| Justificatif entier sans décomposition | Faux fiscalement | |
| Reporter V1.1 | Trop minimaliste | |

**Choix utilisateur :** Widget de décomposition syndic. Doctrine BOFIP-BIC-CHG-30-40 + décret 87-713.

### G2.16 — Provisions gros entretien (PGE)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Suivi simple via G2.15 + re-classification G2.5 | Zéro nouvelle aggregate | ✓ |
| Agrégat ProvisionTravaux dédié | Sur-dimensionné V1 | |
| Hors scope Phase 5 | G2.15 le couvre déjà | |

**Choix utilisateur :** Suivi simple via G2.15. Si exercice clôturé → DeclarationCorrigee Phase 6.

### Check post-G2 (4e passage, 16 questions)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Passer à G3 | G2 saturé | ✓ |
| Encore G2 | | |

**Choix utilisateur :** Passer à G3.

---

## G3 — Bascule LMP : revenus du foyer

### G3.1 — Où saisir les revenus du foyer

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Champ optionnel sur Bailleur + alerte si recettes > 23k€ | Onboarding léger | (hésitation) |
| Champ obligatoire sur Bailleur dès création | Trop intrusif | |
| Wizard annuel "Préparer la déclaration N" | Snapshot annuel | (hésitation) |

**Choix utilisateur :** "J'hésite entre 1 et 3. Lequel est le plus aligné avec ma vision et le juridique ?" → Claude analyse : **option 3 enrichie par option 1**. Champ optionnel sur Bailleur (`revenusActifsAnnuelsCourant`) = pré-remplissage du wizard annuel ; wizard fige dans `DeclarationAnnuelle.revenusFoyerSnapshot` (immuable). Conforme CGI 155 IV (évaluation annuelle, snapshot opposable) + cohérent G4 + audit-friendly.

### G3.2 — Périmètre

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Montant unique + tooltip BOFIP | Simple + pédagogique | ✓ |
| Décomposition par catégorie | 4-5 champs | |
| Référence à case avis d'imposition | Décalage 12 mois | |

**Choix utilisateur :** Montant unique. Tooltip BOFIP-BIC-CHAMP-40-20 détaillé (inclus : salaires, BNC, BA, BIC autres, traitements/pensions, gérance ; exclus : fonciers, mobiliers, PV, BIC LMNP objet de la déclaration).

### G3.3 — Présentation du verdict

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Bandeau permanent + récap détaillé | Tri-état (vert/orange/rouge) | ✓ |
| Verdict uniquement à la clôture | Découverte tardive | |
| Verdict + actions automatiques | Trop interventionniste | |

**Choix utilisateur :** Bandeau permanent. Invite à consulter EC en cas de LMP probable (limite de compétence CLAUDE.md "ne se substitue pas").

### G3.4 — Oscillation LMNP/LMP

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Chaque année indépendamment | Juridiquement correct | ✓ |
| Verrouillage sticky LMP 2 ans | Aucune base légale | |
| Verrouillage SSI URSSAF | Hors scope V1 (D-LOCK-5) | |

**Choix utilisateur :** Évaluation indépendante annuelle. Anti-pattern : ne jamais sticky-LMP (Décision CC 2009-587 DC a supprimé la condition RCS depuis 2009).

### Check post-G3 (4 questions)

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Passer à G4 | G3 satisfait | ✓ |
| Encore G3 | Sujets : PACSé/marié, changement situation, indépendant LMP auto | |

**Choix utilisateur :** Passer à G4.

---

## G4 — Année fiscale : clôture & immutabilité

### G4.1 — Déclenchement de la clôture

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Action manuelle + prérequis | Checklist bloquante | ✓ |
| Clôture automatique en mai N+1 | Surprend si saisie incomplète | |
| Clôture à l'export liasse 2031 | Couplage Phase 6 | |

**Choix utilisateur :** Manuelle avec prérequis bloquants.

### G4.2 — Snapshot

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Snapshot par valeur (montants figés) | Audit-immuable | ✓ |
| Snapshot par référence (re-calcul) | Anti-pattern | |
| Hybride : valeur agrégats + référence justificatifs | Compromis | |

**Choix utilisateur :** Par valeur. Composants_snapshot_json conservé pour rejouer le calcul d'amortissement.

### G4.3 — Régime micro vs réel

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Auto-choix + override | Comparateur micro/réel | ✓ |
| Auto-choix exclusif | Bloque option réel sous seuil | |
| Choix manuel obligatoire | Trop intrusif | |

**Choix utilisateur :** Auto + override + comparateur en background. BOFIP-BIC-DECLA-10-30 option réel renouvelable tacitement.

### G4.4 — DeclarationCorrigee

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Trace en Phase 5 + liasse rectificative Phase 6 | Séparation responsabilités | ✓ |
| Tout en Phase 6 | Couplage fort | |
| Reporter V1.1 | Faux : cas réel fréquent | |

**Choix utilisateur :** Modélisation Phase 5, liasse rectificative générée Phase 6. N corrections successives supportées.

### Wrap-up — toutes zones initiales discutées

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Prêt pour le contexte | Finaliser CONTEXT.md | |
| Explorer d'autres zones grises | G5 | ✓ |

**Choix utilisateur :** Explorer d'autres zones grises.

---

## G5 — Zones grises complémentaires

### G5.1 — Multi-bien

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Vue consolidée + détail par bien | Conforme CGI seuils | ✓ |
| Vue par bien + ligne total | Total pas saillant | |
| Toggle utilisateur | Redondant | |

**Choix utilisateur :** Vue consolidée bailleur + détail par bien.

### G5.2 — Sortie de composant

| Option | Description | Sélectionné |
|--------|-------------|----------|
| dateSortie + prorata + VNC conservée | V1 simple, prépare SIM-02 | ✓ |
| Soft-delete du composant | Perd dotation année partielle | |
| Hors scope V1 | Cas fréquent | |

**Choix utilisateur :** dateSortie + prorata + VNC.

### G5.3 — Exports

| Option | Description | Sélectionné |
|--------|-------------|----------|
| CSV + PDF récap dès Phase 5 | Livrable indépendant Phase 6 | ✓ |
| Aucun export Phase 5 | Couplage Phase 6 | |
| CSV seulement, pas de PDF | Bof | |

**Choix utilisateur :** CSV + PDF dès Phase 5.

### G5.4 — Migration / rétrofit

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Écran d'onboarding optionnel + progressif | Doux + autonomie | ✓ |
| Auto-qualification par défaut | Trop intrusif | |
| Aucune migration | Perd déductions rétroactives | |

**Choix utilisateur :** Onboarding progressif. Bannière persistante "X justificatifs à qualifier".

### Final wrap-up

| Option | Description | Sélectionné |
|--------|-------------|----------|
| Prêt — finaliser CONTEXT.md | | ✓ |
| Explorer encore (4 questions) | Journal audit, métriques BDD, alertes Phase 7, BAK-01 | |

**Choix utilisateur :** Prêt — finaliser CONTEXT.md.

---

## Claude's Discretion (rappel)

Pas de zone laissée totalement à la discrétion de Claude. Toutes les décisions sont tracées. Quelques choix faits par Claude sur demande explicite "choisis le plus aligné" :

- **G1.3 (re-formulée)** — Claude a re-formulé la question avec exemple concret après une première réponse hors sujet.
- **G2.8 (coût sans pièce)** — Confirmé option 1 sur la base de jurisprudence + pédagogie.
- **G2.9 (taxe foncière)** — Option 1 hybride avec widget pédagogique ciblé (pas d'inflation d'enum).
- **G2.12 (irrécouvrables)** — Option 1 (aucune écriture), KISS + cohérence G2.11.
- **G2.13 (OGA)** — Option 2 retenue après vérif WebSearch (LF 2025 a abrogé la réduction).
- **G3.1 (revenus foyer)** — Variante hybride option 1 + 3 sur indication explicite "j'hésite entre 1 et 3".

---

## Vérifications externes effectuées

Trois WebSearch déclenchés par doute factuel sur droit fiscal récent :

1. **LF 2026 & amortissement LMNP** — déclenché par question utilisateur "quel amortissement a été retiré du statut par le projet loi finance appliqué 1er Janvier 2026 ?". Résultat : **aucun amortissement retiré** (sous-amendement plafonnement 2 %/an rejeté). Confirmation de LF 2025 art. 84 (réintégration PV).
2. **Seuil micro-BIC longue durée 2026** — vérification de 77 700 € vs 83 600 € : confirmé que **83 600 €** est le seuil correct pour les recettes 2026-2028 (révision triennale). LMNP.md à jour.
3. **OGA / art. 199 quater B** — vérification du statut de la réduction d'impôt : **abrogée par LF 2025 art. 11** (loi 2025-127 du 14/02/2025). Plus applicable aux exercices 2026+.

---

## Deferred Ideas (capturées pendant la discussion)

Voir `05-CONTEXT.md` section `<deferred>` pour la liste complète. Synthèse :

- **V1.1** : SIM-01, SIM-02, SIM-03, CES-01, HIS-01, HIS-02, bounded context Financement, agrégat DeplacementProfessionnel, agrégat PerteSurCreance, calcul IR + PS 18.6 %, BAK-01/02.
- **V2** : CLA-01 (assistant IA), TOU-01 (tourisme), CES-02..05, EDI-01, EXP-01, INS-01.
- **Hors scope absolu** : CFE (Phase 6), Liasse 2031 (Phase 6), Notifications J-30/J-7 (Phase 7), cotisations SSI/TNS (D-LOCK-5).

---

*Discussion totale : 37 questions (G1: 8, G2: 16, G3: 4, G4: 4, G5: 4) + 1 sélection initiale + 6 checks de progression + 3 vérifications externes.*
*Sessions effectives : 2026-05-19 et 2026-05-20.*

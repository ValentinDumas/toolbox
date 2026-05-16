# Phase 3: Conformité du bail — Diagnostics, EDL, IRL, Mobilier - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `03-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-16
**Phase:** 3 — Conformité du bail — Diagnostics, EDL, IRL, Mobilier
**Areas discussed:** Rattachement des Diagnostics, Granularité EDL + Inventaire, Workflow IRL & avenant PDF, Checklist mobilier vs Inventaire EDL

---

## Rattachement des Diagnostics

### Q1 — Niveau de rattachement (Bien vs Lot)

| Option | Description | Selected |
|--------|-------------|----------|
| Toujours au Bien (recommandé) | Un Bien = un seul DPE, une seule installation gaz/élec globale. DDT juridique = par logement entier. Modélisation simple : Bien.diagnostics[]. | ✓ |
| Au Lot pour gaz/élec, au Bien pour DPE/ERP | Modélisation fine si immeuble multi-lots. Plus réaliste mais plus complexe (2 niveaux, JOIN supplémentaire). | |
| Choix libre à la saisie | L'utilisateur choisit à qui rattacher chaque diagnostic. Flexible mais UX confuse. | |

**User's choice:** Option 1 (Toujours au Bien) avec proposition pour V2.
**Notes:** Le user a demandé si proposer la version per-Lot en V2 est cohérent avec la vision. Confirmé : pour V1, diagnostics toujours sur le Bien (DDT juridique = document par logement entier). Le cas multi-lots avec installations individuelles (immeuble de rapport) est un bon candidat V2, noté dans les déférés.

---

### Q2 — Agrégat racine ou sous-agrégat ?

| Option | Description | Selected |
|--------|-------------|----------|
| Sous-agrégat de Bien (recommandé) | Bien.diagnostics[] : le Diagnostic n'a pas d'existence propre hors d'un Bien. Cohérent DDD. Pas de DiagnosticRepository V1. | ✓ |
| Agrégat racine avec repository propre | DiagnosticRepository séparé. Utile pour Phase 7 dashboard cross-biens. Ajoute complexité immédiate. | |

**User's choice:** Demandé recommandation DDD + alignement vision → **Sous-agrégat de Bien**.
**Notes:** Réflexion DDD : Diagnostic n'a pas d'existence sans Bien (règle racine), DiagnosticId existe pour l'identité mais pas de repository séparé. Pour la Phase 7 (dashboard diagnostics expirés), méthode `BienRepository.trouverBiensAvecDiagnosticsExpiresAvant(date)` suffit. Pattern identique à `Bien.lots[]` Phase 1.

---

### Q3 — Types et durées de validité

| Option | Description | Selected |
|--------|-------------|----------|
| Types fixes + durées héritées en domaine (recommandé) | Enum TypeDiagnostic, durées légales codées (DPE 10 ans, gaz 6 ans, élec 6 ans, ERP valable). User saisit date_emission seule. Map DUREES_VALIDITE versionneable LF annuelle. | ✓ |
| Types fixes + date d'expiration saisie manuellement | L'utilisateur saisit lui-même la date d'expiration. Plus flexible mais erreur-prone. | |

**User's choice:** Types fixes + durées héritées en domaine.
**Notes:** Cohérent avec R1.1 RISKS (revue annuelle LF), conformité automatique des durées légales.

---

### Q4 — Classe DPE dans le modèle (crucial pour gel LOC-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Champ classe DPE sur Bien (recommandé) | Bien.classeDpe : 'A'..'G'|null. MAJ quand nouveau Diagnostic DPE. Permet Bien.estGelLoyer() sans JOIN. | ✓ |
| Dérivé du Diagnostic DPE le plus récent | Calcul à la volée. Correct mais JOIN à chaque vérification gel, goulot potentiel Phase 5. | |

**User's choice:** Champ classe DPE sur Bien.
**Notes:** Performance + invariant cohérent dans l'agrégat. La méthode `Bien.ajouterDiagnostic()` synchronisera classeDpe.

---

### Q5a — Plusieurs DPE successifs sur un même Bien

| Option | Description | Selected |
|--------|-------------|----------|
| Historique complet, le plus récent par type est actif (recommandé) | Tous les DPE conservés, tri date_emission desc. Audit complet, trace la rénovation. | ✓ |
| Un seul Diagnostic actif par type (remplacement) | Nouveau DPE remplace l'ancien. Simpler mais perd l'historique pré-rénovation. | |

**User's choice:** Historique complet, mais a demandé comment cela trace la plus-value.
**Notes:** Réponse fournie : l'historique DPE avant/après travaux justifie la qualification fiscale des dépenses (amélioration amortissable vs entretien) pour la Phase 5 + sert de preuve documentaire pour la plus-value LMNP réel LF 2025 (réintégration des amortissements de gros œuvre). Décision confirmée.

---

### Q5b — DPE expiré + bail actif : blocage ou warning ?

| Option | Description | Selected |
|--------|-------------|----------|
| Warning non bloquant partout (recommandé) | Badge rouge sur fiche, jamais bloquant. Notifications J-30/J-7 = Phase 7. Aligné vision sobre. | ✓ |
| Blocage sur actions sensibles (quittance, indexation) | Plus strict mais friction inutile (bailleur en cours de renouvellement). | |

**User's choice:** Warning non bloquant partout.
**Notes:** Cohérent avec la vision sobre/autonome — pas paternaliste. Le bailleur reste opérationnel.

---

## Granularité EDL + Inventaire

### Q1 — Forme de l'Inventaire mobilier dans l'EDL

| Option | Description | Selected |
|--------|-------------|----------|
| 12 items décret fixes + état par item + note libre (recommandé) | InventaireItem = { type, present, état, note }. Couvre LOC-03 + LOC-06 dans une structure unique. | ✓ |
| Liste libre par pièce avec items configurables | Plus expressif mais UX complexe (drag, ordre), dépasse les 12 items obligatoires sans gain métier V1. | (reportée V2) |
| Champ texte libre global | Simple mais non structuré, impossible de vérifier les 12 items manquants automatiquement. | |

**User's choice:** Option 1 pour V1 ; option 2 (liste libre par pièce) explicitement reportée en V2.
**Notes:** Déféré V2 noté dans la section "Deferred Ideas" du CONTEXT.md.

---

### Q2 — EDL d'entrée vs sortie : même structure ou asymétrique ?

| Option | Description | Selected |
|--------|-------------|----------|
| Même structure, type discriminant (recommandé) | EtatDesLieux avec type: 'entrée'|'sortie'. Permet comparaison entrée↔sortie facile. | ✓ |
| Deux agrégats distincts | Plus expressif si champs divergent, mais duplication, comparaison difficile. | |

**User's choice:** Demandé recommandation pure DDD → **Même agrégat, type discriminant**.
**Notes:** Justification DDD : un "état des lieux" est un concept unique en droit français (loi 89 art. 3-2) — les deux moments partagent les mêmes invariants. Une seule classe, une seule table. Si une "retenue sur dépôt" devient un sous-agrégat distinct plus tard (V2), elle sera modélisée séparément, pas par clonage d'EtatDesLieux.

---

### Q3 — Le champ 'contradictoire' : bool ou structuré ?

| Option | Description | Selected |
|--------|-------------|----------|
| Booléen simple + date signature (recommandé) | contradictoire: bool, date_signature: PlainDate|null. Suffit V1. | ✓ |
| Enum procédure (contradictoire / huissier_bailleur / huissier_locataire) | Capture procédure exacte. Ajoutable V1.x si besoin. | (reportée V1.x) |

**User's choice:** A demandé "qu'est-ce que les contradictoires ?". Explication fournie : EDL en présence des deux parties (procédure normale). Si refus → huissier de justice (pas notaire — notaire = ventes). Décision : booléen suffit V1.
**Notes:** Distinction huissier bailleur/locataire reportée V1.x dans les déférés.

---

### Q4a — EDL de sortie avant fin officielle du bail ?

| Option | Description | Selected |
|--------|-------------|----------|
| Oui, permissif avec warning (recommandé) | EDL sortie peut être enregistré avant date_fin_bail. Warning si anticipé. Audit-friendly. | ✓ |
| Bloqué avant la fin du bail | Trop strict : les locataires rendent les clés en pratique avant la fin du préavis. | |

**User's choice:** Permissif avec warning.

---

### Q4b — Si EDL d'entrée absent lors de l'enregistrement de l'EDL de sortie ?

| Option | Description | Selected |
|--------|-------------|----------|
| Warning non bloquant (recommandé) | Message : "Pas d'EDL d'entrée, comparaison impossible, retenue plus dur à justifier." | ✓ |
| Blocage : EDL d'entrée obligatoire | Trop rigide : EDL entrée parfois en papier hors système. | |

**User's choice:** Warning non bloquant.

---

### Q5a — Stockage de l'inventaire EDL

| Option | Description | Selected |
|--------|-------------|----------|
| JSON inline sur l'EDL (recommandé) | inventaire: TEXT (JSON array). Pattern Cautionnement Phase 1. Simple, performant. | ✓ |
| Table dédiée etat_des_lieux_items | 1 row par item. Queryable SQL mais sur-équipé V1. | |

**User's choice:** JSON inline.

---

### Q5b — PDF de l'EDL : inclus Phase 3 ou différé ?

| Option | Description | Selected |
|--------|-------------|----------|
| Différé Phase 3 — PDF viendra Phase 4 (recommandé) | Phase 3 = structurer données + HTML. Phase 4 = Coffre documentaire (PDF). Séparation claire. | ✓ |
| PDF de l'EDL inclus en Phase 3 | Cohérent avec pdfmake Phase 2 mais alourdit Phase 3. | |

**User's choice:** Différé Phase 4.

---

### Q6a — Comparaison visuelle entrée vs sortie (diff UI) Phase 3 ?

| Option | Description | Selected |
|--------|-------------|----------|
| Affichage simple, pas de diff Phase 3 (recommandé) | Phase 3 = listing des EDL. Diff UI = Phase 4+. | ✓ |
| Vue diff entrée/sortie en Phase 3 | Tableau comparé. Utile pour retenue mais impl. supplémentaire + scope creep. | (reportée Phase 4+) |

**User's choice:** Affichage simple Phase 3.
**Notes:** Distinction importante : le **calcul du delta** (domain service) reste inclus Phase 3 ; seule la **vue diff visuelle** est différée.

---

### Q6b — Nombre maximal d'EDL par bail

| Option | Description | Selected |
|--------|-------------|----------|
| 1 EDL entrée + 1 EDL sortie max par bail (recommandé) | Invariant métier. Correction = soft-delete + nouveau (pattern D-60 Phase 2). | ✓ |
| Libre (N EDL par type par bail) | Permet amendements multiples mais complexifie la notion d'EDL actif. | |

**User's choice:** 1 + 1 max.

---

## Workflow IRL & Avenant

### Q1 — Comment l'utilisateur est-il alerté qu'une révision IRL est disponible ?

| Option | Description | Selected |
|--------|-------------|----------|
| Banner sur la fiche Bail à la date anniversaire (recommandé) | Affichage conditionnel sur la fiche du Bail concerné. Pas de notif push Phase 3. | ✓ |
| Page dédiée "Révisions IRL" listant tous les bails | Vue transversale. Plus visible mais ce dashboard relève de la Phase 7. | (reportée Phase 7) |

**User's choice:** Banner sur fiche Bail Phase 3, page transversale en Phase 7.

---

### Q2 — Workflow exact de l'indexation IRL

| Option | Description | Selected |
|--------|-------------|----------|
| Banner → saisie IRL nouveau → simulation calcul → confirmation → avenant (recommandé) | 5 étapes. App calcule loyer_actuel × IRL_nouveau/IRL_réf, user confirme, échéances futures régénérées + avenant PDF. | ✓ |
| Saisie directe du nouveau loyer (sans calcul auto) | User entre le loyer après calcul externe. Moins de valeur métier, risque d'erreur. | |

**User's choice:** Workflow 5 étapes.

---

### Q3 — Gel loyer Climat (DPE F/G) : blocage dur ou warning débloquable ?

| Option | Description | Selected |
|--------|-------------|----------|
| Blocage dur — l'app refuse le calcul et explique (recommandé) | Si Bien.classeDpe ∈ {F,G} → form bloqué. Message : "Gel loyer Climat actif, indexation interdite (décret 2022-1313)". Conforme LOC-05. | ✓ |
| Warning avec case "Je confirme appliquer quand même" | User peut outrepasser. Trop risqué : hausse illégale, fausse sécurité. | |

**User's choice:** Blocage dur.

---

### Q4 — Contenu minimal de l'avenant PDF

| Option | Description | Selected |
|--------|-------------|----------|
| Mentions obligatoires loi 89 + IRL (recommandé) | Référence bail, ancien loyer HC, IRL référence (trim+val), IRL nouveau, nouveau loyer, date d'effet, clause signature. | ✓ |
| Lettre de notification simple | Simple courrier, perd valeur documentaire/probante. | |

**User's choice:** Mentions obligatoires loi 89.

---

### Q5 — Effet sur Bail + Échéances après confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Bail mis à jour + échéances futures régénérées + IRL référence pivotée (recommandé) | Bail.loyerHc maj, Bail.irlReference = nouveau pivot, EcheancesLoyer futures (pattern D-73) régénérées, historique ligne dans table dédiée. | ✓ |
| Bail mis à jour seulement, échéances non touchées | Incohérent avec D-73 Phase 2. | |

**User's choice:** Bail + échéances régénérées + IRL pivot.

---

### Q6a — Le bailleur peut-il refuser d'indexer ?

| Option | Description | Selected |
|--------|-------------|----------|
| Oui — bouton "Passer la révision" (loyer inchangé) (recommandé) | En droit, le bailleur peut renoncer. Loyer inchangé MAIS IRL référence quand même pivoté (sinon bloqué indéfiniment). | ✓ |
| Non — indexation obligatoire si clause IRL | Juridiquement inexact : clause IRL = faculté, pas obligation. | |

**User's choice:** Option 1 + a demandé d'ajouter un petit paragraphe explicatif sous la feature.
**Notes:** Paragraphe explicatif convenu : *"Vous pouvez renoncer à la révision annuelle. Le loyer reste inchangé. L'IRL de référence est mis à jour afin que la prochaine révision parte de la bonne base."*

---

### Q6b — Stockage de l'historique des indexations IRL

| Option | Description | Selected |
|--------|-------------|----------|
| Table dédiée bail_indexations (recommandé) | { id, bail_id, date_effet, irl_avant, irl_apres, loyer_avant, loyer_apres, indexation_appliquee, raison_non_application }. Queryable Phase 5. | ✓ |
| Log JSON inline sur le Bail | Bail.historique_irl: TEXT (JSON array). Non queryable SQL. | |

**User's choice:** Table dédiée bail_indexations.

---

## Checklist mobilier vs Inventaire EDL

### Q1 — Checklist 12 éléments et inventaire EDL : même donnée ou distincts ?

| Option | Description | Selected |
|--------|-------------|----------|
| Même structure InventaireItem (recommandé) | InventaireItem unique { type, present, état, note }. Checklist LOC-06 = vérification présence ; EDL = même tableau rempli avec état. | ✓ |
| Deux structures distinctes (ChecklistBail + InventaireEDL) | Logique séparée mais duplication enum 12 items + risque désync. | |

**User's choice:** Même structure InventaireItem.

---

### Q2 — Quand est déclenchée la vérification LOC-06 ?

| Option | Description | Selected |
|--------|-------------|----------|
| Aux 2 moments : création Bail + EDL entrée | Checklist sur Bail + même inventaire en EDL entrée avec état. | |
| Uniquement à la création du Bail | Conforme LOC-06 "à la création/édition Bail". | ✓ (complété) |
| Uniquement lors de l'EDL d'entrée | Mais user peut créer un bail sans EDL et rater l'alerte. | |

**User's choice:** A demandé recommandation DDD + alignée vision → **Uniquement à la création du Bail** (invariant agrégat Bail) **+ complément léger** : domain service warning non bloquant lors de la création de l'EDL d'entrée si items obligatoires `present: false`.
**Notes:** Justification DDD : LOC-06 dit "à la création/édition d'un Bail". L'EtatDesLieux est un agrégat séparé qui ne doit pas re-déclencher la règle du Bail (pas de cross-aggregate invariant). Le warning EDL entrée est un domain service check, pas un invariant.

---

### Q3 — Sémantique du field 'present' (entrée vs sortie)

| Option | Description | Selected |
|--------|-------------|----------|
| Même structure, double sémantique selon type EDL (recommandé) | Entrée : present = fourni par bailleur (décret). Sortie : present = encore là (retour). Domain service gère warnings. | ✓ |
| Deux champs distincts (fourni_bailleur + restitue) | Plus explicite mais alourdit le modèle, casse la symétrie comparaison. | |

**User's choice:** Demandé clarification ("on parle de l'EDL d'entrée ou de sortie ?"). Réponse : check de présence pour les deux EDL, sémantiques différentes :
- **EDL entrée** : present = fourni par bailleur. Warning si item obligatoire `present: false` (LOC-06).
- **EDL sortie** : present = encore là. Warning si item était présent à l'entrée et absent à la sortie (potentielle retenue).

Décision finale : **Même structure, double sémantique**.

---

### Q4a — Modélisation des 12 items du décret 2015-981

| Option | Description | Selected |
|--------|-------------|----------|
| Enum TypeItemInventaire codé en dur dans le domaine (recommandé) | Enum TS strict. Vérifié par dependency-cruiser. MAJ par PR si décret évolue. | ✓ (V1) |
| Configuration externe (JSON/table BD) | Permet ajout sans toucher code. Mais c'est règle de droit, pas config métier. | (reportée V1.x) |

**User's choice:** Enum en dur V1 ; gestion en BD pour ajouter/modifier des items si la législation évolue → ajoutée aux déférés V1.x.

---

### Q4b — Comportement si un item se dégrade entre entrée et sortie

| Option | Description | Selected |
|--------|-------------|----------|
| Calcul automatique du delta + warning retenue (recommandé) | Domain service comparerInventaires() génère warnings "vérifier retenue". Calcul du montant = Phase 3.x. | ✓ |
| Pas de logique de delta en Phase 3 | User compare visuellement. Faible valeur métier. | |

**User's choice:** A demandé si c'est indépendant des décisions précédentes sur le diff. Clarification fournie :
- **Delta de calcul** (domain service compareInventaires → warnings) = **inclus Phase 3** (logique métier pure).
- **Vue diff UI** (tableau côte à côte) = **différée Phase 4** (UI, non critique).

Décision : delta inclus Phase 3, diff UI différé.

---

## Claude's Discretion

Les zones où Claude a flexibilité pour décider (détail à trancher par le planner / executor) sont listées dans CONTEXT.md §"Claude's Discretion" :

- Convention de nommage des routes Fastify Phase 3.
- Structure des partials EJS Phase 3.
- Choix précis des libellés et placeholders d'inputs.
- Placement du calcul `nouveau_loyer = loyer × (IRL_apres / IRL_avant)` (méthode Bail.simulerIndexation recommandée).
- Mise en page pdfmake exacte de l'avenant.
- Encoding des accents dans le nom de fichier PDF.

Décisions DP-14 → DP-20 (différées au gsd-plan-phase 3) avec recommandations explicites dans CONTEXT.md.

## Deferred Ideas

Liste complète dans CONTEXT.md §"Deferred Ideas". Résumé :

### V1.1 / V1.x
- Procédure huissier détaillée pour EDL non contradictoire (enum).
- Gestion en BD des items inventaire (admin CRUD).
- Intégration INSEE auto pour récupération IRL (INS-01).
- Override utilisateur des templates (avenant IRL).

### V2
- Diagnostics par Lot (gaz/élec installations séparées).
- Inventaire libre par pièce avec items configurables.
- Indemnités d'occupation post-résiliation.

### Phase 3.x ou Phase 4+
- Vue diff UI côte à côte entrée vs sortie.
- Calcul du montant de la retenue sur dépôt.
- PDF de l'EDL.

### Phase 7
- Notifications J-30 / J-7 (diagnostics, IRL, fin de bail).
- Page transversale "Révisions IRL".
- Dashboard diagnostics expirés cross-Bien.

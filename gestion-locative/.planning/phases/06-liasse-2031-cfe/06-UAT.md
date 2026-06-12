---
status: paused
phase: 06-liasse-2031-cfe
source:
  - 06-01-SUMMARY.md
  - 06-02-SUMMARY.md
  - 06-03-SUMMARY.md
  - 06-04-SUMMARY.md
  - 06-05-SUMMARY.md
  - 06-06-SUMMARY.md
  - 06-07-SUMMARY.md
started: 2026-06-09T05:24:09Z
updated: 2026-06-11T07:14:00Z
paused_reason: "Verification reportée — sera exécutée juste avant la verif manuelle de la Phase 7 (UI Phase 6+7 testée d'un seul tenant)."
---

## Current Test

[paused — reprendre via /gsd-verify-work 6 après exécution Phase 7]

## Tests

### 1. Cold Start Smoke Test
expected: Tuer tout serveur en cours. Repartir d'un état propre (DB SQLite recréée ou migrations rejouées). Lancer `pnpm dev`. Le serveur démarre sans erreur, la migration 0023_phase6_declaration_cfe.sql s'applique, et /fiscalite répond en 200.
result: [pending]

### 2. Bloc « Brouillons de liasse » sur /fiscalite
expected: Aller sur /fiscalite. Sous les blocs Phase 5, un bloc « Brouillons de liasse » liste les déclarations annuelles (réel + micro-BIC côte à côte avec suffixe `(réel)` / `(micro-BIC)`). Chaque ligne est un lien vers /fiscalite/declarations/:id/liasse.
result: [pending]

### 3. Brouillon liasse régime réel (5 annexes)
expected: Ouvrir le brouillon d'une déclaration régime réel. La page affiche le bandeau S1 « Brouillon — à reporter case-par-case », le H1 avec millésime + nom bailleur, puis 5 sections : 2031-SD (CB/CC), 2033-A (AN/AP/AQ/AT/AV + postes manuels avec bandeau S3), 2033-B (FC/FK/FX/FY/FZ/GA), 2033-C (KA-KF), 2033-D (WG/WH/WI). Chaque case affiche numéro + libellé officiel + valeur formatée €.
result: [pending]

### 4. Brouillon liasse micro-BIC (case 5NI)
expected: Ouvrir le brouillon d'une déclaration micro-BIC. Une seule section `2042-C-PRO — Report micro-BIC` avec la case `5NI` (Locations meublées non professionnelles — longue durée). La valeur est le total des recettes BRUTES (aucun abattement appliqué côté app).
result: [pending]

### 5. Drill-down sources par case
expected: Sur le brouillon réel, la colonne « Sources » contient un `<details>` natif. Cliquer sur « Voir N source(s) » d'une case (ex. FC recettes) déplie la liste des liens internes vers les pièces source (recettes / charges / amortissement). Les cases sans source affichent `—`.
result: [pending]

### 6. Bandeau réconciliation snapshot ≠ vivant
expected: Modifier une recette/charge APRÈS qu'une déclaration ait été clôturée (snapshot figé). Recharger le brouillon : un bandeau rouge « Réconciliation » apparaît au-dessus des sections, indiquant le nombre de pièces modifiées. Aucun bouton « Re-calculer ». Si rien n'a bougé, pas de bandeau.
result: [pending]

### 7. Liasse rectificative (bandeau S6)
expected: Depuis une déclaration corrigée (DeclarationCorrigee), ouvrir /fiscalite/declarations-corrigees/:id/liasse. Un bandeau jaune S6 affiche « Liasse rectificative — motif : … » + lien « Voir la déclaration originale ». La déclaration originale reste consultable sans ce bandeau.
result: [pending]

### 8. Export PDF du brouillon
expected: Sur le brouillon (réel ou micro), section « Exports » avec 2 CTA. Cliquer « Télécharger PDF » télécharge un fichier `brouillon-liasse-{exercice}.pdf` (ou `-rectificative-` si applicable). Le PDF s'ouvre correctement et contient bandeau S1 + sections + tableaux.
result: [pending]

### 9. Export CSV du brouillon
expected: Cliquer « Télécharger CSV (expert-comptable) » télécharge `brouillon-liasse-{exercice}.csv` (BOM UTF-8, séparateur `;`, colonnes Annexe;Case;Libellé;Valeur;Sources). Ouvert dans Excel/LibreOffice, les accents s'affichent correctement et aucune cellule ne commence par `=`/`+`/`-`/`@` sans préfixe `'`.
result: [pending]

### 10. Création + édition d'une déclaration CFE
expected: Depuis la fiche d'un bien, accéder à « Nouvelle déclaration CFE ». Renseigner millésime (2020-2030), statut (`non_deposee`/`deposee`/`payee`/`exoneree_premiere_annee`/`exoneree_commune`), date de dépôt + montant si statut le requiert. Soumettre : la déclaration apparaît dans la liste CFE du bien. Édition possible avec changements persistés.
result: [pending]

### 11. Carte + badge statut CFE sur fiche bien
expected: Sur la fiche bien, la section CFE liste les déclarations triées par millésime. Chaque déclaration affiche une carte avec badge coloré selon `StatutCfe` (libellé FR officiel), millésime formaté, montant le cas échéant.
result: [pending]

### 12. Banner CFE J-30 (3 variantes)
expected: Avec une déclaration CFE `non_deposee` (ou `deposee` non `payee`) dont l'échéance tombe dans la fenêtre [-60j, +30j] : un banner s'affiche sur la fiche bien ET sur /fiscalite (section « Échéances CFE »). 3 variantes selon les jours restants : warning (J-30 à J-8), warning forte (J-7 à J-0), destructive (J+1+). Lien « Régler sur impots.gouv.fr » avec `target=_blank rel=noopener noreferrer`. Aucun banner si statut `payee`.
result: [pending]

## Summary

total: 12
passed: 0
issues: 0
pending: 12
skipped: 0

## Gaps

[none yet]

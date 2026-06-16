---
status: passed
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
updated: 2026-06-16T10:45:00Z
closed_le: 2026-06-16
executed_by: "Phase 9 / QUA-01 plan 09-01 (Playwright, app live :7878 + cold start :7879)"
closed_by: "Phase 9 / plan 09-03 — confirmation perceptuelle bailleur (sc.8 PDF, sc.9 CSV)"
closure_note: "12/12 scénarios clos (9 pass, 3 pass-with-note, 0 pending). Rapport consolidé : ../09-finition-qualit-cl-ture-uat-r-conciliation-des-statuts/09-UAT-CLOSURE.md"
---

## Current Test

[automatable scenarios exécutés en Phase 9 (plan 09-01). Restent sc.8 + sc.9 perceptuels → plan 09-03.]

## Tests

### 1. Cold Start Smoke Test
expected: Tuer tout serveur en cours. Repartir d'un état propre (DB SQLite recréée ou migrations rejouées). Lancer `pnpm dev`. Le serveur démarre sans erreur, la migration 0023_phase6_declaration_cfe.sql s'applique, et /fiscalite répond en 200.
result: pass
note: Cold start sur DB neuve (HOME temp, PORT 7879). Boot sans erreur (log INFO « Server listening » uniquement), toutes les migrations rejouées dont 0023 (table `declarations_cfe` créée), `GET /fiscalite` → 200.

### 2. Bloc « Brouillons de liasse » sur /fiscalite
expected: Aller sur /fiscalite. Sous les blocs Phase 5, un bloc « Brouillons de liasse » liste les déclarations annuelles (réel + micro-BIC côte à côte avec suffixe `(réel)` / `(micro-BIC)`). Chaque ligne est un lien vers /fiscalite/declarations/:id/liasse.
result: pass
note: Bloc « Brouillons de liasse » présent ; lignes « Consulter le brouillon liasse 2026 (réel) » et « … 2024 (micro-BIC) », chacune liant vers `/fiscalite/declarations/:id/liasse`. Suffixe régime correct.

### 3. Brouillon liasse régime réel (5 annexes)
expected: Ouvrir le brouillon d'une déclaration régime réel. La page affiche le bandeau S1 « Brouillon — à reporter case-par-case », le H1 avec millésime + nom bailleur, puis 5 sections : 2031-SD (CB/CC), 2033-A (AN/AP/AQ/AT/AV + postes manuels avec bandeau S3), 2033-B (FC/FK/FX/FY/FZ/GA), 2033-C (KA-KF), 2033-D (WG/WH/WI). Chaque case affiche numéro + libellé officiel + valeur formatée €.
result: pass
note: Bandeau S1 présent ; H1 « Brouillon liasse fiscale 2026 — V » ; 5 annexes rendues avec tous les numéros de cases attendus (CB/CC ; AN/AP/AQ/AT/AV ; FC/FK/FX/FY/FZ/GA ; KA-KF ; WG/WH/WI), chacune numéro + libellé officiel + valeur € (insécable). Bandeau S3 « postes à compléter manuellement » sur 2033-A. Cohérence fiscale vérifiée : FC 12 000,00 € − FK 1 800,00 € − FY 3 500,00 € = GA/CB 6 700,00 €.

### 4. Brouillon liasse micro-BIC (case 5NI)
expected: Ouvrir le brouillon d'une déclaration micro-BIC. Une seule section `2042-C-PRO — Report micro-BIC` avec la case `5NI` (Locations meublées non professionnelles — longue durée). La valeur est le total des recettes BRUTES (aucun abattement appliqué côté app).
result: pass-with-note
note: Rendu live impossible à dupliquer en mono-bailleur : `UNIQUE(bailleur, exercice)` + mapping liasse disponible **uniquement pour 2026** (D-L6.3) ⇒ réel et micro ne peuvent coexister sur 2026. Vérifié de façon équivalente par le test d'intégration `tests/integration/web/route-liasse.test.ts` (« 200 micro-BIC : section 2042-C-PRO + case 5NI ») qui boote l'app réelle (creerApp) et rend la vue via HTTP : 2042-C-PRO + 5NI + recettes brutes 30 000,00 € (pas le net après abattement). Le chemin de rendu est identique au live. → suite verte (1096 tests).

### 5. Drill-down sources par case
expected: Sur le brouillon réel, la colonne « Sources » contient un `<details>` natif. Cliquer sur « Voir N source(s) » d'une case (ex. FC recettes) déplie la liste des liens internes vers les pièces source (recettes / charges / amortissement). Les cases sans source affichent `—`.
result: pass
note: `<details>` natif « Voir 1 source » sur FC → lien interne « Encaissements 2026 (cumulés) » (/encaissements?annee=2026) et sur FK → « Charges déductibles 2026 » (/coffre?annee=2026). Cases sans source affichent `—`.

### 6. Bandeau réconciliation snapshot ≠ vivant
expected: Modifier une recette/charge APRÈS qu'une déclaration ait été clôturée (snapshot figé). Recharger le brouillon : un bandeau rouge « Réconciliation » apparaît au-dessus des sections, indiquant le nombre de pièces modifiées. Aucun bouton « Re-calculer ». Si rien n'a bougé, pas de bandeau.
result: pass-with-note
note: Bandeau rouge « Réconciliation — données snapshot ≠ sources vivantes » affiché au-dessus des annexes : « Données modifiées depuis la clôture du 31/12/2026… N pièces ont changé… Les valeurs ci-dessous restent celles validées à la clôture. » Aucun bouton « Re-calculer » présent. Détection déclenchée car snapshot figé ≠ pièces vivantes. Le scénario précis « modifier une pièce post-clôture » est par ailleurs couvert par le test unitaire `tests/unit/fiscalite/reconciliation.test.ts`.

### 7. Liasse rectificative (bandeau S6)
expected: Depuis une déclaration corrigée (DeclarationCorrigee), ouvrir /fiscalite/declarations-corrigees/:id/liasse. Un bandeau jaune S6 affiche « Liasse rectificative — motif : … » + lien « Voir la déclaration originale ». La déclaration originale reste consultable sans ce bandeau.
result: pass
note: Bandeau jaune S6 « Liasse rectificative — motif : Oubli charge syndic… » + lien « Voir la déclaration originale » → liasse de l'originale. L'originale rendue sans bandeau S6 (audit-friendly).

### 8. Export PDF du brouillon
expected: Sur le brouillon (réel ou micro), section « Exports » avec 2 CTA. Cliquer « Télécharger PDF » télécharge un fichier `brouillon-liasse-{exercice}.pdf` (ou `-rectificative-` si applicable). Le PDF s'ouvre correctement et contient bandeau S1 + sections + tableaux.
result: pass
note: Partie automatisable OK — `GET …/liasse.pdf` → 200, `content-type: application/pdf`, `Content-Disposition: attachment; filename="brouillon-liasse-2026.pdf"`, en-tête `%PDF`, 38 Ko. Confirmation humaine (plan 09-03, 2026-06-16) : le bailleur a ouvert le PDF, il s'ouvre et fonctionne (lisible, bandeau S1 + sections + tableaux). → clos.

### 9. Export CSV du brouillon
expected: Cliquer « Télécharger CSV (expert-comptable) » télécharge `brouillon-liasse-{exercice}.csv` (BOM UTF-8, séparateur `;`, colonnes Annexe;Case;Libellé;Valeur;Sources). Ouvert dans Excel/LibreOffice, les accents s'affichent correctement et aucune cellule ne commence par `=`/`+`/`-`/`@` sans préfixe `'`.
result: pass
note: Partie automatisable OK — `GET …/liasse.csv` → 200, `text/csv; charset=utf-8`, `filename="brouillon-liasse-2026.csv"`, BOM UTF-8 (EF BB BF) présent, séparateur `;`, colonnes `Annexe;Case;Libellé officiel;Valeur (€);Valeur (brut);Sources`. Assertion injection : 0 cellule débutant par `=`/`+`/`-`/`@` (ASCII). Confirmation humaine (plan 09-03, 2026-06-16) : accents corrects + colonnes bien séparées dans le tableur. La réserve signalée par le bailleur (colonne « Valeur (€) » non numérique) a été **corrigée en Phase 9** : ajout d'une colonne `Valeur (brut)` numérique (point décimal, sans séparateur ni symbole, ex. `12000.00`) exploitable par Excel/LibreOffice, la colonne formatée restant pour la lecture humaine. Couvert par `tests/unit/fiscalite/exporter-csv-brouillon-liasse.test.ts`. → upgrade pass-with-note → pass.

### 10. Création + édition d'une déclaration CFE
expected: Depuis la fiche d'un bien, accéder à « Nouvelle déclaration CFE ». Renseigner millésime (2020-2030), statut (`non_deposee`/`deposee`/`payee`/`exoneree_premiere_annee`/`exoneree_commune`), date de dépôt + montant si statut le requiert. Soumettre : la déclaration apparaît dans la liste CFE du bien. Édition possible avec changements persistés.
result: pass
note: Création (millésime 2026, statut `non_deposee`, échéance 10/07/2026) → flash « Déclaration CFE 2026 enregistrée », carte affichée sur la fiche bien. Édition (statut `deposee` + date dépôt 02/05/2026 + montant 512 €) → flash « mise à jour », carte « déposée le 02/05/2026 — 512,00 € » persistée. Les 5 statuts officiels sont proposés dans le select.

### 11. Carte + badge statut CFE sur fiche bien
expected: Sur la fiche bien, la section CFE liste les déclarations triées par millésime. Chaque déclaration affiche une carte avec badge coloré selon `StatutCfe` (libellé FR officiel), millésime formaté, montant le cas échéant.
result: pass
note: Section CFE avec carte « CFE 2026 », badge libellé FR officiel évoluant avec le statut (« ⚠ Non déposée » → « Déposée » → « Payée »), millésime + échéance + montant affichés.

### 12. Banner CFE J-30 (3 variantes)
expected: Avec une déclaration CFE `non_deposee` (ou `deposee` non `payee`) dont l'échéance tombe dans la fenêtre [-60j, +30j] : un banner s'affiche sur la fiche bien ET sur /fiscalite (section « Échéances CFE »). 3 variantes selon les jours restants : warning (J-30 à J-8), warning forte (J-7 à J-0), destructive (J+1+). Lien « Régler sur impots.gouv.fr » avec `target=_blank rel=noopener noreferrer`. Aucun banner si statut `payee`.
result: pass
note: Variante **warning** vérifiée live (échéance 10/07/2026, J-24) : banner « CFE 2026 — Échéance dans 24 jours » affiché à la fois sur la fiche bien ET sur /fiscalite ; lien « Régler la CFE sur impots.gouv.fr » avec `target="_blank" rel="noopener noreferrer"`. Suppression vérifiée live : statut `payee` → 0 banner. Les variantes **warning forte** (J-7→J-0) et **destructive** (J+1+) + filtre statut sont couvertes par `tests/unit/fiscalite/alerte-cfe-j30.test.ts` et `tests/integration/web/route-cfe-banner.test.ts`.

## Summary

total: 12
passed: 12
issues: 0
pending: 0
skipped: 0

(passed inclut 2 pass-with-note : sc.4, sc.6. sc.8 + sc.9 perceptuels clos par confirmation humaine au plan 09-03 le 2026-06-16 ; sc.9 upgrade pass-with-note → pass après correction de la colonne CSV numérique. 0 scénario en attente.)

## Gaps

### Défaut bloquant découvert et corrigé (D-04) — RÉSOLU en Phase 9
- **Crash du wizard de clôture (5 vues `wizard-cloture/etape-*.ejs`)** : includes de partials à profondeur erronée (`../../../../partials/`, 4 niveaux au lieu de 3) → `ENOENT …/toolbox/partials/layout-debut.ejs` → page 500 sur tout le parcours `/fiscalite/cloturer/:exercice/etape/{1..5}`. Présent depuis la création (commit 18fcf49) ; jamais couvert (les tests de clôture exercent le use-case en mémoire, sans rendu de vue). Découvert pendant la mise en place de l'UAT liasse. **Corrigé** commit `bd175e5` (profondeur 4→3) + test de régression `tests/integration/web/route-cloture-wizard.test.ts` (rend les 5 étapes via app.inject, exige 200). Suite complète verte (156 fichiers, 1096 tests).

### Écarts cosmétiques / non-bloquants → backlog (severity minor, hors Phase 9 par D-04)
- **Brouillons liasse des millésimes pré-2026** : le bloc « Brouillons de liasse » liste toutes les déclarations clôturées ; cliquer une déclaration antérieure à 2026 mène à un 422 « Mapping de la liasse non disponible pour l'année N » (le mapping est révisé chaque janvier — D-L6.3). Comportement attendu mais UX perfectible (on pourrait griser/annoter les lignes sans mapping). Non-bloquant.
- **Libellé du compteur de réconciliation** : le bandeau indique « N pièces ont changé » ; quand l'écart vient de l'absence totale de pièces vivantes (vs snapshot), le terme « modifiées » est un raccourci. Cosmétique, non-bloquant.
- ~~**CSV liasse — colonne « Valeur (€) » non numérique**~~ — **RÉSOLU (Phase 9)** : ajout d'une colonne `Valeur (brut)` numérique (point décimal, sans séparateur ni symbole) dans `src/application/fiscalite/exporter-csv-brouillon-liasse.ts`, exploitable par Excel/LibreOffice (expert-comptable), la colonne `Valeur (€)` formatée restant pour la lecture humaine. Test : `tests/unit/fiscalite/exporter-csv-brouillon-liasse.test.ts`.

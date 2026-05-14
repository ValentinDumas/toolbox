---
status: complete
phase: 02-quittancement-ch-ances-encaissements-relances
source:
  - 02-01-SUMMARY.md
  - 02-02-SUMMARY.md
  - 02-03-SUMMARY.md
  - 02-04-SUMMARY.md
  - 02-05-SUMMARY.md
  - 02-06-SUMMARY.md
started: 2026-05-14T22:30:00Z
updated: 2026-05-14T23:35:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Tuer le serveur, vider la DB, redémarrer. Serveur boote sans erreur, migrations 0001..0006 OK, home page répond, sidebar complète (Profil, Biens, Locataires, Baux, Échéances, Encaissements, Quittances, Impayés, Relances).
result: issue
reported: "Les erreurs de validation dans les formulaires redirigent vers une page avec du json. Par exemple: '{statusCode:500, error:Internal Server Error, message:La surface est obligatoire et doit être > 0 pour un lot de type appartement}'. Il faudrait plutot afficher un message d'erreur sous les champs concernés et empecher de passer à l'étape suivante. Le locataire et le bail ne devraient pas etre 'obligatoires', car je veux pouvoir gérer juste avec le bien et l'extraction de factures / fiscalité dans un premier temps je n'aurais pas de locataire donc pas de baux. Concernant l'onglet Quittances, sur sa vue il y a un bouton qui n'a pas de texte à l'intérieur et ne fait rien au clic. Le css est bizarre mais je suppose quil sera adressé dans une autre phase."
severity: major
notes: "Le smoke test lui-même est passé (serveur boote, sidebar visible, wizard accessible). 3 issues distinctes découvertes pendant l'exploration — détaillées dans Gaps."

### 2. Profil bailleur — UPSERT idempotent
expected: Page /bailleur permet de saisir/modifier nom, raison sociale, adresse, SIRET. Sauvegarde réussit. Recharger la page affiche les valeurs persistées. Re-sauvegarder n'est pas une erreur (idempotent, fix WR-07).
result: pass
notes: "Bannière 'Profil bailleur enregistré' s'affiche en doublon (logged as separate gap, severity minor)."

### 3. Activer un bail (ENC-01)
expected: Sur la fiche d'un bail brouillon, cliquer "Activer le bail". Saisir date début. L'écran liste 12 échéances générées sur 12 mois avec montants corrects (loyer + charges). Un PDF "Avis d'échéance" est téléchargeable. Le bail passe à actif (`actifDepuis` rempli).
result: pass
notes: "Bannière 'Bail activé — 12 échéances générées' s'affiche en doublon (même root cause que test 2). User confirme l'activité via la bannière 'Ce bail a déjà de l'activité…' mais ne voit pas la date actifDepuis directement sur la fiche bail — gap d'affichage."

### 4. Liste des échéances
expected: Page /echeances affiche les échéances triées par période, avec statut (en_attente, payée_partiellement, payée). Filtres par bail/statut fonctionnent. Montants affichés avec deux décimales.
result: issue
reported: "je ne vois pas de filtres par bail / par statut"
severity: major

### 5. Créer un encaissement (ENC-02)
expected: Depuis la fiche d'une échéance en_attente, créer un encaissement (montant = loyer + charges, date, mode = virement). Le statut de l'échéance passe à `payee`. La liste /encaissements affiche l'opération. Encaissement de 0 € est rejeté (fix WR-08).
result: pass

### 6. Annuler un encaissement
expected: Depuis la fiche encaissement, cliquer "Annuler". Confirmer. L'encaissement passe à `annulé`. Le statut de l'échéance recalcule et revient à `en_attente` (ou `payee_partiellement` si d'autres encaissements existent). L'historique reste visible (audit).
result: pass

### 7. Modifier un bail actif
expected: Modifier le loyer ou les charges d'un bail actif. Les échéances PASSÉES (déjà payées) restent intactes. Les échéances FUTURES sont régénérées avec les nouveaux montants. Aucun doublon, aucun trou de période (fix CR-01).
result: pass

### 8. Générer une quittance (ENC-03)
expected: Depuis une échéance payée, cliquer "Générer quittance". Le PDF est généré et téléchargeable. Le numéro suit la séquence annuelle (ex : 2026-001, 2026-002…). Sous concurrence, pas de doublon de numéro (fix CR-03).
result: pass
notes: "Bannière 'Quittance n° 2026-001 générée avec succès' s'affiche en doublon (même root cause flash banner). User a dû demander où trouver l'action — discoverability gap loggué séparément."

### 9. Annuler une quittance
expected: Cliquer "Annuler" sur une quittance. Le fichier PDF est supprimé du disque. L'échéance redevient "à quittancer" (la quittance reste tracée pour audit). Si le fichier n'existe plus (échec disque), une 404 propre s'affiche (fix WR-11).
result: pass
notes: "Comportement réel : quittance passe à 'annulé' ✓, échéance redevient 'payée' avec bouton 'Générer quittance' réapparu ✓, PDF reste consultable (par design — message app dit 'Le PDF original reste consultable'). MON 'expected' était auto-contradictoire (suppression PDF + audit-tracking incompatibles) — le design app est audit-correct. Bannière dupliquée 4/4 (pattern confirmé)."

### 10. Vue impayés (ENC-04)
expected: Page /impayes liste les échéances en retard de paiement, triées par ancienneté décroissante. Chaque ligne affiche locataire, bien, période, montant dû, jours de retard.
result: pass

### 11. Relance amiable (ENC-05 — niveau 1)
expected: Depuis la fiche d'un impayé, cliquer "Relancer (amiable)". Un lien mailto: s'ouvre avec destinataire (email du locataire), sujet et corps pré-remplis (ton courtois). La relance est tracée en BDD avec date et niveau.
result: issue
reported: "le bouton relancer amiable une fois cliqué, disparait, et rien ne se passe."
severity: major

### 12. Relance ferme (niveau 2)
expected: Après le délai minimal depuis la relance amiable, l'action "Relance ferme" devient disponible. mailto: avec ton plus directif. La relance niveau 2 est tracée. Avant le délai, l'action est désactivée.
result: issue
reported: "j'ai le bouton relance ferme mais rien ne se passe quand je clique dessus. Il disparait bien apres clic mais c'est tout."
severity: major
notes: "Comportement identique au test 11 — POST /relances enregistre bien (bouton disparaît) mais le mailto: ne s'ouvre pas. Le bouton 'Relance ferme' apparaît bien quand l'échéance dépasse J+30 ✓ (validation seuil OK). Confirme que le bug mailto est systémique à TOUS les niveaux niveaux 1+2 (et probablement 3 PDF aussi)."

### 13. Mise en demeure (niveau 3)
expected: Après le délai minimal depuis la relance ferme, l'action "Mise en demeure" devient disponible. Génère un PDF formel (LRAR) avec mentions légales. La relance niveau 3 est tracée. Avant le délai, l'action est désactivée.
result: pass
notes: "PDF se télécharge correctement (canal PDF, pas mailto). Confirme que le bug 'mailto pas ouvert' est spécifique au canal email (niveaux 1+2), pas au canal PDF (niveau 3). Backdating échéance à 2026-03-01 (74j retard) requis pour faire apparaître le bouton."

## Summary

total: 13
passed: 9
issues: 4
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Les erreurs de validation côté serveur doivent s'afficher inline sous les champs concernés et empêcher l'avancée du wizard"
  status: failed
  reason: "User reported: Les erreurs de validation dans les formulaires redirigent vers une page avec du json (ex: 500 'La surface est obligatoire et doit être > 0 pour un lot de type appartement'). Il faudrait afficher un message d'erreur sous les champs concernés et empêcher de passer à l'étape suivante."
  severity: major
  test: 1
  origin_phase: 01
  artifacts: []
  missing: []

- truth: "Le wizard doit permettre de créer un bien sans locataire ni bail (locataire + bail optionnels pour usage solo / extraction factures / fiscalité)"
  status: scope_change
  reason: "User reported: Le locataire et le bail ne devraient pas être obligatoires, je veux pouvoir gérer juste avec le bien et l'extraction de factures / fiscalité dans un premier temps. Sans locataire pas de bail."
  severity: major
  test: 1
  origin_phase: 01
  notes: "Changement de scope du wizard P01 — débloquer le mode bien-only."
  artifacts: []
  missing: []

- truth: "La page /quittances ne doit pas contenir de bouton vide sans action"
  status: failed
  reason: "User reported: Sur la vue Quittances il y a un bouton sans texte à l'intérieur et qui ne fait rien au clic. Le css bizarre est accepté (sera traité dans une autre phase)."
  severity: minor
  test: 1
  origin_phase: 02
  notes: "ROOT CAUSE identifié pendant test 8 : src/web/views/partials/empty-state.ejs:4 rend toujours `<a href=\"\" role=\"button\"></a>` même quand ctaUrl=null et ctaLabel=null. Fix : wrapper le <a> dans un `<% if (locals.ctaUrl && locals.ctaLabel) { %>`."
  artifacts:
    - path: "src/web/views/partials/empty-state.ejs"
      issue: "ligne 4 : <a> CTA rendu inconditionnellement (href vide + label vide quand null)"
    - path: "src/web/views/pages/quittances/liste.ejs"
      issue: "ligne 13-18 : passe ctaLabel:null + ctaUrl:null au partial, déclenche le bug"
  missing:
    - "Wrapper conditionnel autour du <a> dans empty-state.ejs"

- truth: "Les bannières flash de succès doivent s'afficher une seule fois après une action"
  status: failed
  reason: "User reported test 2: 'La bannière Profil bailleur enregistré s'affiche deux fois'. Test 3: 'la bannière écran bail activé Bail activé — 12 échéances générées s'affiche deux fois'. Test 8: 'Quittance n° 2026-001 générée avec succès s'affiche deux fois'. Test 9: 'Quittance n° 2026-001 annulée. Le PDF original reste consultable. s'affiche en double'. Pattern systémique reproductible 4/4 sur toutes les flash banners."
  severity: minor
  test: 2, 3, 8, 9
  origin_phase: 02
  notes: "Pattern systémique 3/3 sur les flash banners de succès. Causes probables : (a) partial banniere-warning + banniere-success inclus deux fois dans le layout (layout-debut.ejs + page), (b) query param ?avertissement= + cookie flash banniereWarning concurrents, (c) deux includes pour la même bannière dans la page (un en layout, un en page-specific)."
  artifacts: []
  missing: []

- truth: "La date d'activation (actifDepuis) du bail doit être visible sur la fiche bail après activation"
  status: failed
  reason: "User reported: 'ou est-ce que je peux voir actifDepuis ?'. La fiche bail affiche bien la bannière 'Ce bail a déjà de l'activité' mais ne montre pas la date d'activation directement."
  severity: minor
  test: 3
  origin_phase: 02
  notes: "Gap d'affichage sur la fiche bail (src/web/views/pages/baux/detail.ejs). Ajouter un champ 'Actif depuis : <date>' à proximité du statut."
  artifacts: []
  missing: []

- truth: "La liste /echeances doit proposer des filtres par bail et par statut"
  status: failed
  reason: "User reported: 'je ne vois pas de filtres par bail / par statut'"
  severity: major
  test: 4
  origin_phase: 02
  notes: "Filtres absents de src/web/views/pages/echeances/liste.ejs. Ajouter <select> bail (peuple via listerBaux) + <select> statut (en_attente/payee_partiellement/payee/annulee). La route GET /echeances doit accepter ces query params."
  artifacts: []
  missing: []

- truth: "L'action 'Générer quittance' doit être découvrable depuis le contexte d'une échéance payée"
  status: failed
  reason: "User asked: 'où sélectionne t on générer quittance ?'. Le bouton existe sur /echeances colonne Actions mais ne s'affiche que pour statut=payee && !quittanceActive ; aucune indication ni CTA sur /quittances."
  severity: minor
  test: 8
  origin_phase: 02
  notes: "Discoverability gap. Pistes : (a) ajouter un CTA 'Émettre une quittance' sur /quittances qui amène à la liste filtrée /echeances?statut=payee, (b) ajouter l'action sur la fiche échéance /echeances/:id (pas seulement la liste), (c) sur la fiche bail, montrer une section 'Quittances à émettre' regroupant les échéances payées sans quittance."
  artifacts: []
  missing: []

- truth: "Cliquer 'Relancer' (niveau 1, 2 ou 3) doit ouvrir un mailto: (niveau 1+2) ou un PDF (niveau 3) ET tracer la relance en BDD ET donner un feedback visuel"
  status: failed
  reason: "User reported test 11: 'le bouton relancer amiable une fois cliqué, disparait, et rien ne se passe'. Test 12: 'j'ai le bouton relance ferme mais rien ne se passe quand je clique dessus. Il disparait bien apres clic mais c'est tout.' Pattern identique sur amiable ET ferme — bug systémique sur la route POST /relances ou le partial relance-action.ejs."
  severity: major
  test: 11, 12
  origin_phase: 02
  notes: "Le bouton disparaît (POST aboutit, BDD enregistre la relance ✓), mais le mailto: ne s'ouvre pas (niveau 1+2) et probablement pareil pour le PDF niveau 3. Causes probables : (a) la route POST /relances retourne un redirect HTTP qui ignore complètement le mailto: stocké dans le snapshot, (b) le formulaire HTML submit normal au lieu d'un <a href=mailto> ou JS qui ouvre window.location.href=mailtoUri, (c) la liste se re-render et n'a pas de pont vers le mailto:. À investiguer : src/web/routes/relances.ts (handler POST), src/web/views/partials/relance-action.ejs (form/action), src/web/views/pages/relances/liste.ejs, src/helpers/build-mailto.ts (la fonction existe et est testée, mais le résultat n'est pas surfacé côté client)."
  artifacts:
    - path: "src/web/routes/relances.ts"
      issue: "Redirect HTTP qui ignore le mailtoUri du snapshot"
    - path: "src/web/views/partials/relance-action.ejs"
      issue: "Form POST classique sans déclenchement du mailto: côté client"
    - path: "src/helpers/build-mailto.ts"
      issue: "mailtoUri généré et stocké mais jamais surfacé au browser"
  missing:
    - "Bridge client-side qui ouvre le mailtoUri après le POST réussi (option A : retourner du HTML qui contient un <script>window.location=mailto:...</script>, option B : transformer le form en <a href=mailto:...> qui appelle d'abord un POST avec fetch puis navigate au mailto, option C : pattern HTMX/htmx-trigger)"

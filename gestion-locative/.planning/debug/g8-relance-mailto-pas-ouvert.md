---
status: diagnosed
trigger: "G8: Cliquer 'Relancer' (niveau 1, 2) ne ouvre pas le mailto: — bouton disparait, POST aboutit (relance enregistrée en BDD), mais le mailto pré-rempli ne s'ouvre pas côté client. Niveau 3 PDF OK."
created: 2026-05-14T00:00:00Z
updated: 2026-05-14T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMÉE — Le handler POST /relances (route) ignore complètement le `mailtoUri` retourné par le use case `enregistrerRelance` pour le canal 'email', et retourne un simple HTTP redirect vers `/impayes`. Aucun mécanisme (ni server-side ni client-side) n'expose le `mailtoUri` au navigateur, donc rien ne déclenche l'ouverture du mailto.
test: lecture du code complet du flow (route, view, partial, use case, helper)
expecting: identifier où le pont mailtoUri → client est cassé
next_action: retourner ROOT CAUSE FOUND au caller

## Symptoms

expected: Cliquer 'Relancer' (niveau 1, 2) doit ouvrir un mailto: pré-rempli ET tracer la relance en BDD ET donner un feedback visuel.
actual:
  - Test 11 (amiable niveau 1): bouton disparait, rien ne se passe (pas de mailto ouvert).
  - Test 12 (ferme niveau 2): bouton disparait, rien ne se passe.
  - Test 13 (mise en demeure niveau 3): OK, PDF se télécharge correctement.
  - DB confirme: relances niveau 1 ET 2 sont bien enregistrées en table `relance` (donc POST aboutit).
errors: Aucune erreur — comportement silencieux ("bouton disparait" = la page navigue après submit du form).
reproduction:
  1. Aller sur /impayes (ou démarrer une nouvelle relance)
  2. Cliquer 'Lancer la relance amiable' (niveau 1) ou 'Lancer la relance ferme' (niveau 2)
  3. Observer: bouton disparait, page redirige vers /impayes avec bannière succès. Mailto JAMAIS ouvert.
started: Toujours cassé depuis livraison phase 02-06 (jamais validé en UAT).

## Eliminated

(aucune hypothèse à éliminer — la cause est directement observable dans 2 fichiers)

## Evidence

- timestamp: 2026-05-14
  checked: src/web/routes/relances.ts (handler POST /relances, lignes 80-123)
  found: |
    Pour canal='email' (niveaux 1 et 2), lignes 114-116 :
      req.session.banniereSuccess = `Relance niveau ${niveau} enregistrée.`;
      return reply.redirect('/impayes');
    Le `resultat.mailtoUri` retourné par enregistrerRelance() est SILENCIEUSEMENT IGNORÉ.
    Pour canal='pdf' (niveau 3), lignes 107-112 : Content-Type 'application/pdf' + body PDF → le navigateur télécharge → fonctionne.
  implication: |
    Le handler n'a aucun chemin pour transmettre le mailtoUri au navigateur. La différence comportementale niveau 3 vs 1-2 vient directement de cette branche manquante.

- timestamp: 2026-05-14
  checked: src/web/views/partials/relance-action.ejs (formulaire bouton relance)
  found: |
    Pour les 3 niveaux, c'est un <form method="POST" action="/relances"> avec un <button type="submit">.
    AUCUN attribut JavaScript (onclick, data-mailto, target=_blank), AUCUN <a href="mailto:...">, AUCUN handler client.
    C'est un form HTML pur — le clic = submit classique → navigation vers la réponse HTTP.
  implication: |
    Le seul mécanisme possible côté client serait que la réponse HTTP du POST contienne soit (a) une page HTML avec un trigger JS auto, (b) un Content-Type: text/uri-list, (c) un redirect 302 vers une URL mailto: (mais les browsers bloquent mailto: en redirect direct sans interaction). Aucune de ces stratégies n'est en place.

- timestamp: 2026-05-14
  checked: src/web/views/pages/relances/liste.ejs + impayes/liste.ejs
  found: |
    Aucune des deux vues ne contient de JS inline (pas de <script>, pas de window.location.href, pas de data-mailto).
    L'impayes/liste.ejs (cible du redirect après submit) ne reçoit même pas `mailtoUri` dans son rendering context.
  implication: Après le redirect, le navigateur affiche /impayes sans aucune information du mailto à ouvrir.

- timestamp: 2026-05-14
  checked: src/application/encaissements/enregistrer-relance.ts (use case)
  found: |
    Le use case calcule correctement le mailtoUri (ligne 135 : `mailtoUri = buildMailto(...)`),
    le stocke dans contenuSnapshot (ligne 142 — pour audit, donc en BDD),
    et le retourne dans le résultat (ligne 159 : `return { relanceId, canal: 'email', mailtoUri: mailtoUri! }`).
    Le use case fait son travail correctement.
  implication: Le bug n'est PAS dans le use case. Le mailtoUri est bien produit. Il est simplement jeté à la sortie de la couche application par la couche web.

- timestamp: 2026-05-14
  checked: src/helpers/build-mailto.ts
  found: Fonction OK, génère bien un URI mailto: conforme RFC 6068.
  implication: Helper hors de cause.

- timestamp: 2026-05-14
  checked: grep "mailtoUri" + "window.location" dans tout src/
  found: |
    `mailtoUri` n'est référencé qu'à 3 endroits :
    1. enregistrer-relance.ts (calcul + retour)
    2. relance.ts (commentaire JSDoc du contenuSnapshot)
    Aucun consommateur du retour côté web. Aucun JS qui le récupère.
    Aucun `window.location` nulle part dans src/.
  implication: Le pont mailtoUri → browser est COMPLÈTEMENT ABSENT du code. Ce n'est pas un bug subtil — c'est une fonctionnalité non implémentée.

- timestamp: 2026-05-14
  checked: src/web/routes/impayes.ts (cible du redirect)
  found: La route GET /impayes ne reçoit pas mailtoUri et ne le passe pas à la vue.
  implication: Confirme que même après le redirect, aucune trace du mailtoUri n'arrive au navigateur.

## Resolution

root_cause: |
  Le handler POST /relances (src/web/routes/relances.ts lignes 114-116) IGNORE le `mailtoUri`
  retourné par le use case `enregistrerRelance` pour le canal 'email' (niveaux 1 et 2).
  Il fait simplement `session.banniereSuccess + reply.redirect('/impayes')`.

  Aucun mécanisme — ni server-side (réponse HTML avec auto-trigger), ni client-side
  (JavaScript handler, <a href=mailto:>) — n'expose le mailtoUri au navigateur.

  Le use case calcule pourtant le mailtoUri correctement (ligne 135), le stocke en BDD
  dans contenu_snapshot (ligne 142), et le retourne (ligne 159). Mais ce retour est
  silencieusement jeté à la couche web.

  Le bouton "disparait" simplement parce que le form HTML pur est submit et la page
  navigue vers /impayes — comportement normal d'un form classique sans JS.

  C'est l'hypothèse (a) ET (b) du prompt initial qui se confirment ensemble :
  - (a) confirmé : la route POST ne fait qu'un redirect.
  - (b) confirmé : le form HTML pur n'a aucun JS pour gérer window.location.href.

  Différence niveau 3 vs 1-2 :
  - Niveau 3 : la route répond directement avec `Content-Type: application/pdf` → le
    navigateur sait quoi faire (téléchargement). Pas besoin de pont JS.
  - Niveau 1-2 : il faudrait soit (a) répondre avec une page intermédiaire qui contient
    `window.location.href = '<mailtoUri>'` avant le redirect, soit (b) transformer le
    bouton en `<a href="mailto:...">` rendu côté serveur AVANT le submit (i.e. le mailtoUri
    devrait être pré-calculé et exposé sur la page /impayes pour chaque relance disponible).

fix: |
  (Hint — non implémenté ici car goal=find_root_cause_only)

  Option recommandée (la plus simple, conservant le flow POST→DB→trace) :
  Modifier le handler POST /relances pour le canal 'email' pour qu'au lieu de
  redirect('/impayes'), il retourne une petite page HTML intermédiaire qui :
    1. Déclenche `window.location.href = '<mailtoUri encodé>'` (ouvre le client mail)
    2. Affiche un lien de fallback `<a href="<mailtoUri>">Ouvrir le mail</a>` si le navigateur bloque
    3. Affiche un lien retour vers /impayes
    4. (Bonne pratique) Stocke la bannière succès en session pour le retour ultérieur.

  Option alternative (plus "progressive enhancement") :
  Rendre le bouton niveau 1-2 directement comme `<a href="<mailtoUri pré-calculé>"
  data-relance-niveau="1" data-echeance-id="...">` avec un click handler JS qui :
    1. POST en arrière-plan (fetch) pour tracer la relance en BDD
    2. Laisse l'href mailto: ouvrir naturellement
  → impose de pré-calculer le mailtoUri côté impayes.ts pour CHAQUE échéance impayée
  (coût : un appel templateRenderer.rendre par ligne — surcoût acceptable car peu d'impayés).

  Option alternative 2 (no-JS, fonctionne même sans JavaScript) :
  Faire le POST classique mais répondre avec un HTTP redirect VERS le mailtoUri directement
  (`reply.redirect(mailtoUri)`). À tester : la plupart des navigateurs OUVRENT le mailto:
  sur un redirect, mais certains bloquent. Comportement potentiellement inconsistant
  → moins fiable que l'option intermédiaire.

  Le test couvrant la régression devra vérifier que pour canal='email', la réponse HTTP
  contient le mailtoUri (soit dans le body HTML, soit comme Location header).

verification: (à appliquer dans la phase de fix — couverture du fix par un test unitaire
  + UAT manuel de répétition test 11 + test 12)
files_changed: []

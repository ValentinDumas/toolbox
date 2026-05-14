---
status: diagnosed
trigger: "Les erreurs de validation dans les formulaires redirigent vers une page avec du json. Par exemple: '{statusCode:500, error:Internal Server Error, message:La surface est obligatoire et doit être > 0 pour un lot de type appartement}'. Il faudrait afficher un message d'erreur sous les champs concernés et empêcher de passer à l'étape suivante."
created: 2026-05-14T16:00:00Z
updated: 2026-05-14T16:30:00Z
---

## Current Focus

hypothesis: Le message d'erreur reporté ne vient pas de Zod mais d'un `InvariantViolated` levé par le constructeur de domaine `Lot.creer()` (src/domain/patrimoine/lot.ts:43). La route `POST /wizard/bien` (src/web/routes/wizard.ts:80-109) appelle `creerBien(...)` SANS try/catch après le `safeParse` Zod. Combinée à l'absence de `setErrorHandler` Fastify global dans `src/main.ts`, l'erreur remonte au handler d'erreur Fastify par défaut, qui sérialise en JSON 500. La route POST /biens correspondante (src/web/routes/biens.ts:46-82) gère bien le cas avec un try/catch qui re-render le formulaire avec `erreurs: { _global: message }`.
test: Comparer wizard.ts POST /wizard/bien vs biens.ts POST /biens vs encaissements.ts POST /encaissements + chercher setErrorHandler + identifier la source exacte du message d'erreur.
expecting: wizard.ts manque try/catch, biens.ts/encaissements.ts en a un, main.ts n'a pas setErrorHandler.
next_action: Returner ## ROOT CAUSE FOUND avec evidence et fix direction.

## Symptoms

expected: Erreurs de validation affichées inline sous les champs concernés, wizard reste sur l'étape courante.
actual: Redirection vers une page texte brut JSON `{statusCode:500, error:Internal Server Error, message:La surface est obligatoire et doit être > 0 pour un lot de type appartement}`.
errors: 500 Internal Server Error avec body JSON `{statusCode:500, error:Internal Server Error, message:La surface est obligatoire et doit être > 0 pour un lot de type appartement}`.
reproduction: Aller dans le wizard de création de bien (route `/wizard/bien`, accessible au premier lancement via `estPremierLancement`), saisir un lot de type appartement sans surface, soumettre.
started: Phase 01 (wizard de création construit en phase 01).

## Eliminated

- hypothesis: "Zod ne valide pas la surface du lot pour appartement"
  evidence: "`src/web/schemas/bien-schemas.ts:5-8` — `lotCreationSchema.surface` est `.nullable()`, donc Zod accepte explicitement null. Le message d'erreur exact 'La surface est obligatoire et doit être > 0 pour un lot de type appartement' provient de `src/domain/patrimoine/lot.ts:43` (domain layer, pas Zod)."
  timestamp: 2026-05-14T16:15:00Z

## Evidence

- timestamp: 2026-05-14T16:10:00Z
  checked: "src/web/routes/wizard.ts POST /wizard/bien handler (lines 80-109)"
  found: "Après `bienCreationSchema.safeParse(...)` réussi, la route appelle `creerBien(data, opts.bienRepo)` ligne 96-105 SANS try/catch. Toute exception remonte au framework."
  implication: "Une erreur de domaine levée pendant `creerBien` n'est pas traduite en re-render du formulaire."

- timestamp: 2026-05-14T16:11:00Z
  checked: "grep 'surface est obligatoire' dans src/"
  found: "Une seule occurrence : `src/domain/patrimoine/lot.ts:43` — `throw new InvariantViolated(\\`La surface est obligatoire et doit être > 0 pour un lot de type \"${props.type}\"\\`);`"
  implication: "Le message vient du domaine (Lot.creer), pas du Zod schema. Confirme un écart entre validation Zod (permissive : surface nullable) et invariant domaine (strict : surface obligatoire pour appartement et local_commercial)."

- timestamp: 2026-05-14T16:12:00Z
  checked: "src/main.ts complet"
  found: "Aucun `app.setErrorHandler(...)` n'est enregistré. Fastify utilise donc son handler par défaut qui répond Content-Type: application/json avec body `{statusCode, error, message}` et le code HTTP courant (500 pour une Error standard)."
  implication: "Toute exception non catchée par un handler de route produit une réponse JSON. Pour un user qui clique 'Soumettre' depuis un form HTML, le browser navigue vers cette réponse JSON et l'affiche en texte brut."

- timestamp: 2026-05-14T16:13:00Z
  checked: "src/web/routes/biens.ts POST /biens handler (lines 46-82)"
  found: "Pattern correct : `safeParse` puis `try { await creerBien(...) } catch (err) { return reply.view('pages/biens/formulaire.ejs', { ..., erreurs: { _global: message } }) }`. La même route hors wizard ne reproduit donc pas le bug."
  implication: "Le pattern de gestion d'erreur attendu existe déjà dans la codebase (biens.ts, encaissements.ts). wizard.ts a été oublié."

- timestamp: 2026-05-14T16:14:00Z
  checked: "src/web/routes/encaissements.ts POST /encaissements (lines 113-197)"
  found: "Même pattern : safeParse → re-render avec erreurs Zod ; try/catch autour de `creerEncaissement` → re-render avec `{ _global: message }` pour les erreurs métier connues (`EcheanceAnnulee`, `BailNonActif`, `EcheanceLoyerIntrouvable`). Les erreurs inconnues sont rethrown (et tomberaient dans le default handler — défense-in-depth manquante)."
  implication: "Le pattern existe dans plusieurs routes mais n'est pas systématique. Le wizard et toute future route oubliée est exposée au même bug."

- timestamp: 2026-05-14T16:15:00Z
  checked: "src/web/routes/wizard.ts POST /wizard/locataire (lines 125-161) et POST /wizard/bail (lines 190-270)"
  found: "Mêmes oublis : `creerLocataire` ligne 144 et `creerBail` ligne 245 sont appelés sans try/catch. Tout invariant du domaine `Locataire.creer` (ex : email invalide après Zod, dateNaissance future si guarded au domain) ou `Bail.creer` (ex : dépôt > 2 mois loyer post-superRefine) déclencherait le même bug 500-JSON."
  implication: "Le bug n'est pas spécifique à l'étape Bien — il touche les 3 étapes du wizard. Et plus largement toute route qui appelle un use-case domaine sans try/catch."

- timestamp: 2026-05-14T16:16:00Z
  checked: "src/web/views/pages/wizard/bien.ejs (locataire.ejs, bail.ejs)"
  found: "Les vues consomment déjà `erreurs.{field}` (ex : `erreurs['lots.0.surface']` ligne 100) ET un pattern `erreurs._global` pourrait être ajouté facilement. Pas de blocker côté template."
  implication: "Le fix côté handler peut surfacer le message soit en `_global` (banneau d'erreur en haut du form) soit, mieux, en mappant l'invariant vers un champ spécifique (ex : `surface est obligatoire` → `erreurs['lots.0.surface']`)."

- timestamp: 2026-05-14T16:18:00Z
  checked: "grep setErrorHandler dans src/ et toute la codebase"
  found: "Aucune occurrence. Fastify reste sur son handler par défaut."
  implication: "Defense-in-depth manquante : même si chaque route catch correctement, une erreur oubliée ailleurs (futur code, dépendance qui throw) produira la même UX dégradée."

## Resolution

root_cause: |
  Double cause, conjointe et nécessaire :

  1. **Cause directe (handler-level)** : La route `POST /wizard/bien` (src/web/routes/wizard.ts:96-105)
     appelle `creerBien(...)` sans try/catch après le `safeParse` Zod. Or `creerBien` → `Lot.creer()`
     (src/domain/patrimoine/lot.ts:41-45) lève `InvariantViolated` quand `surface` est null/≤0 pour un
     lot de type `appartement` ou `local_commercial`. Cet invariant n'est pas couvert par le Zod schema
     `lotCreationSchema` (src/web/schemas/bien-schemas.ts:5-8) qui déclare `surface.nullable()`. L'erreur
     remonte donc au framework. Le même bug existe sur POST /wizard/locataire et POST /wizard/bail
     (mêmes appels sans try/catch).

  2. **Cause facilitatrice (framework-level)** : `src/main.ts` n'enregistre pas de
     `app.setErrorHandler(...)`. Fastify utilise son handler par défaut qui sérialise toute exception non
     catchée en `{statusCode, error, message}` JSON avec HTTP 500. Pour un user qui clique submit dans un
     `<form method="POST">`, le browser affiche cette réponse JSON en texte brut → exactement ce que
     l'utilisateur a reporté.

  Les routes `POST /biens`, `POST /encaissements` et autres ont déjà le bon pattern (try/catch + re-render
  avec `erreurs: { _global: message }`). La régression vient de wizard.ts qui a été oublié.

fix: |
  Fix minimal (suffit pour Gap G1) :
  Ajouter un try/catch autour des 3 appels d'application dans `src/web/routes/wizard.ts` (creerBien,
  creerLocataire, creerBail). Dans le catch, re-render la vue wizard correspondante avec
  `erreurs: { _global: err.message }` (et `valeurs: body` pour préserver la saisie). Pattern à reproduire
  depuis biens.ts:65-82.

  Fix recommandé (defense-in-depth) :
  Ajouter un `app.setErrorHandler` dans src/main.ts qui :
    - distingue les Accept HTML vs JSON (req.headers.accept)
    - pour HTML, render une page d'erreur générique (pages/erreur.ejs) avec le message en clair
    - pour JSON / API, garder le JSON brut
    - log l'erreur (app.log.error) avec stack

  Fix robuste (élimination du bug par construction) :
  Aligner le Zod schema sur l'invariant domaine via `superRefine` : si `type === 'appartement' || type === 'local_commercial'`,
  alors `surface > 0` requis. Ainsi Zod attrape l'erreur AVANT d'arriver au domaine et l'affiche
  inline sous le champ correspondant (`erreurs['lots.0.surface']`) — exactement ce que demande la "truth"
  du gap. Cumulable avec le try/catch (défense-en-profondeur).

verification: ""
files_changed: []

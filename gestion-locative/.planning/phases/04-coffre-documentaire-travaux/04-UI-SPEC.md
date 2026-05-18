---
phase: 4
slug: coffre-documentaire-travaux
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-18
restart: 2026-05-18
approved: 2026-05-18
discussion_log: 04-DISCUSSION-LOG.md
---

# Phase 4 — UI Design Contract (v2 — discussion explicite)

> Visual and interaction contract for Phase 4: Coffre documentaire & Travaux.
> Réécrit après arbitrage explicite de 22 gray areas UI en 6 batches (cf. `04-DISCUSSION-LOG.md`).
> Backup v1 auto : `04-UI-SPEC.v1-auto.bak.md`.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | none (Pico.css classless v2.1.1) |
| Preset | not applicable |
| Component library | Pico.css classless — semantic HTML styled automatically |
| Icon library | none — text labels only (cohérent Phase 1 D-37) |
| Font | System stack (Pico v2 default — aucune custom font chargée) |

Source: `public/styles/pico.min.css` + `package.json` `@picocss/pico ^2.1.1`. Pas de shadcn, Tailwind, ni React. Stack = Fastify + EJS + Pico.css + JS minimal.

---

## Spacing Scale (UI-1.1)

8-point scale. Mêmes tokens que Phase 1 D-42.

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Padding nav active (`padding-left: 4px`), inline gaps |
| sm | 8px | Compact element spacing, gaps boutons actions |
| md | 16px | Default banniere padding, section margin |
| lg | 24px | Section padding |
| xl | 32px | Layout gaps |
| 2xl | 48px | Major section breaks |
| 3xl | 64px | Page-level spacing |

**Exceptions** :
- `<input type="file">` `<progress>` : full width du parent.
- Touch targets : minimum `44x44px` pour tous les `<button>` et `<a role="button">` (WCAG 2.5.5).

Source : `public/styles/app.css` observé + arbitrage UI-1.1.

---

## Typography (UI-1.2)

Pico v2 defaults préservés. Zero override custom CSS.

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Body | 16px (1rem) | 400 | 1.5 | Texte courant, paragraphes |
| Label | 14px (0.875rem) | 400 | 1.4 | `<label>`, `.error-msg`, hint |
| Heading section (h2) | 20px (1.25rem) | 600 | 1.2 | Sections "Documents", "Travaux", "Pièces jointes" |
| Display (h1) | 28px (1.75rem) | 700 | 1.2 | Titre page (`/coffre`, fiche justificatif, fiche ticket) |

**Notes** :
- `<th>` headers : 14px weight 600 (Pico default).
- `.error-msg` (existant) : 14px weight 400 color `var(--couleur-destructive)`.
- Aucune nouvelle font-family ni weight introduits Phase 4.

Source : arbitrage UI-1.2 + Pico v2 defaults.

---

## Color (UI-1.3)

**Tokens CSS** déclarés en `:root` dans `public/styles/app.css` (refactor inclus Phase 4 — extraction des hex hardcodés actuels).

```css
:root {
  --couleur-accent: #1d4ed8;          /* bleu — accents, active states, primary CTA */
  --couleur-accent-bg: #dbeafe;       /* bleu clair — bg badge accent */
  --couleur-warning: #d97706;         /* ambre — warnings, rétention */
  --couleur-warning-bg: #fef3c7;      /* ambre clair — bg banniere-warning */
  --couleur-destructive: #dc2626;     /* rouge — destructive, errors */
  --couleur-destructive-bg: #fee2e2;  /* rouge clair — bg alerts */
  --couleur-success: #16a34a;         /* vert — succès, ajout, clos */
  --couleur-success-bg: #d1fae5;      /* vert clair — bg banniere-success */
  --couleur-neutre: #6b7280;          /* gris — neutre, désactivé, annulé */
  --couleur-neutre-bg: #f3f4f6;       /* gris clair — bg badge neutre */
}
```

| Role | Token | Hex | Usage |
|------|-------|-----|-------|
| Dominant (60%) | `var(--pico-background-color)` | #ffffff (light mode) | Page background, `<main>` |
| Secondary (30%) | `var(--pico-card-background-color)` | ~#f9fafb | `<article>` cards, sidebar nav |
| Accent (10%) | `var(--couleur-accent)` | #1d4ed8 | **Liste réservée ci-dessous** |
| Warning | `var(--couleur-warning)` | #d97706 | Bannière warning, rétention block |
| Destructive | `var(--couleur-destructive)` | #dc2626 | Boutons destructive, `aria-invalid`, `.error-msg` |
| Success | `var(--couleur-success)` | #16a34a | Bannière success post-upload/restore/ticket |
| Neutre | `var(--couleur-neutre)` | #6b7280 | Badge statut "annulé", labels secondaires |

**Accent réservé pour** :
- Primary CTA : "Ajouter un document", "Nouveau ticket", "Restaurer", "Téléverser le document".
- Active nav link : sidebar left-border accent on `aria-current="page"` (existant).
- Filter submit button sur `/coffre`.
- Badge statut Ticket `ouvert` (UI-1.4).
- Wizard step active (existant).
- Outline focus du `section[role="alert"]` (existant).

**Destructive réservé pour** :
- Bouton "Mettre en corbeille" (confirmation `confirm-dialog.ejs`).
- Bouton "Purger définitivement" (confirmation `confirm-dialog.ejs`).
- `aria-invalid` form field border + `.error-msg` text.

**Contrast WCAG 2.1 AA vérifiés** :
- `#1d4ed8` sur `#ffffff` : 5.9:1 ✓
- `#dc2626` sur `#ffffff` : 4.63:1 ✓
- `#16a34a` sur `#ffffff` : 3.97:1 — texte ≥18px ou bold ✓ (passe AA Large)
- `#d97706` sur `#ffffff` : 3.13:1 — **utiliser sur fond `var(--couleur-warning-bg)` uniquement** (gives sufficient contrast)
- `#6b7280` sur `#ffffff` : 4.5:1 ✓ (passe AA pile)

**Refactor `app.css` inclus** : remplacer hex hardcodés `.banniere-success` (l.30-31), `.banniere-warning` (l.71-72), `.warning-zone` (l.80-81), `.field input[aria-invalid="true"]` (l.43), `.error-msg` (l.46), `nav[aria-label="Navigation principale"]` (l.52), `ol[aria-label="Étapes du wizard d'activation"]` (l.60), `nav[aria-label="Étapes de la révision IRL"]` (l.66), `section[role="alert"][aria-live="assertive"]` (l.86-95) par `var(--couleur-*)`. Pas de changement visuel attendu (mêmes valeurs).

**`partial-badge-dpe.ejs` non touché** : 7 nuances A→G spécifiques, pas de palette sémantique réutilisable (cf. UI-1.3 pattern hybride).

---

## Component Inventory

### Existing partials — reused unchanged

| Partial | Usage Phase 4 |
|---------|---------------|
| `layout-debut.ejs` / `layout-fin.ejs` | Toutes les pages Phase 4 |
| `breadcrumbs.ejs` | `/coffre`, `/coffre/corbeille`, `/coffre/upload`, `/justificatifs/:id`, `/biens/:id/travaux`, `/travaux/:id` |
| `banniere-success.ejs` | Post-upload, post-restore, post-ticket-create, post-ticket-close |
| `banniere-warning.ejs` | Rétention block message si purge tentée avant 10 ans (D-109) |
| `empty-state.ejs` | 4 contextes empty (cf. Copywriting) |
| `confirm-dialog.ejs` | "Mettre en corbeille", "Purger définitivement" |
| `data-table.ejs` | `/coffre`, `/coffre/corbeille`, `/biens/:id/travaux`, sections Documents/Travaux sur fiches |
| `form-field.ejs` | Tous les champs upload, ticket création |
| `sidebar-nav.ejs` | Mise à jour avec entrée "Coffre documentaire" (UI-2) |

### Existing partials — edit light (refactor cross-cutting UI-3.4)

| Partial | Edit |
|---------|------|
| `data-table.ejs` | Ajouter `style="color: var(--pico-muted-color); text-align: right;"` sur le `<td class="row-actions">` pour atténuer le bruit visuel des actions désormais always-visible. Aucun changement structurel. |

### New partials — Phase 4

| Partial | Responsabilité |
|---------|---------------|
| `partial-badge-statut-ticket.ejs` | Pill badge inline-styled `<span>` + `aria-label="Statut : {libellé}"`. 4 variantes mappées sur palette UI-1.3 : `ouvert` → accent, `en_cours` → warning, `clos` → success, `annule` → neutre. Pattern clone de `partial-badge-dpe.ejs`. |
| `partial-upload-form.ejs` | `<fieldset>` radio mutex "Rattacher à" + dropdowns conditionnels + champs file/titre/date/type/montant/notes (UI-4.1, UI-4.2). Inclut `<progress>` wrapper aria-live (UI-6.3). |
| `partial-justificatif-row.ejs` | Un `<tr>` table justificatifs : `date | type | titre | bien | locataire | montant | actions` (UI-3.1). Actions always-visible (UI-3.4) : Télécharger / Modifier / Mettre en corbeille. |
| `partial-filters-coffre.ejs` | Barre haute compacte (UI-3.2) : search input + 4 selects + bouton "Filtrer" + lien "Effacer les filtres" conditionnel. `<form method="GET" action="/coffre">`. |
| `partial-ticket-row.ejs` | Un `<tr>` table tickets : `titre | statut-badge | date-ouverture | date-cloture | cout-estime | cout-reel | actions` (UI-5.2). |
| `partial-ticket-pj-section.ejs` | Section "Pièces jointes" sur `/travaux/:id` — table justificatifs liés + bouton "Ajouter une pièce jointe" inline (UI-5.3). |
| `partial-justificatif-preview.ejs` | Aperçu fichier sur fiche justificatif (UI-4.3 single column) : `<img>` inline si JPG/PNG, `<a target="_blank" rel="noopener noreferrer">` + `.sr-only` "(nouvel onglet)" si PDF/HEIC/WebP (D-117 + UI-6.3). |

---

## Sidebar Navigation Update (UI-2)

**Position UI-2.1** : insérer "Coffre documentaire" **entre Baux et Encaissements**. Workflow logique :

```
1. Biens                          (existant)
2. Locataires                     (existant)
3. Baux                           (existant)
4. Coffre documentaire            ← NOUVEAU
5. Encaissements (dropdown)       (existant)
   ├─ Toutes les échéances
   ├─ Encaissements
   ├─ Quittances
   ├─ Impayés
   └─ Relances
6. Profil bailleur                (existant)
```

**Libellé UI-2.2** : "Coffre documentaire" (21 caractères, cohérent avec Encaissements 13ch).

**Sub-entries UI-2.3** : **entrée plate** — pas de dropdown.

```html
<li>
  <a href="/coffre" <% if (navActive === 'coffre') { %>aria-current="page"<% } %>>
    Coffre documentaire
  </a>
</li>
```

`navActive = 'coffre'`.

**Pas d'entrée racine "Travaux"** (D-114 confirmé) — accessible depuis la fiche Bien uniquement (contextuel).

**Lien corbeille** : affiché dans le header de `/coffre` (au-dessus de la table, à côté du CTA "Ajouter un document"). Conditionnel "Corbeille (N)" où N = nombre de justificatifs soft-deleted. Masqué si N = 0.

---

## Page Inventory

| Route | Page Purpose | Layout & Key Interactions |
|-------|-------------|---------------------------|
| `GET /coffre` | Liste filtrée Justificatifs actifs (UI-3) | Filtres barre haute (search + 4 selects) + table 7 colonnes + pagination 20 + lien "Corbeille (N)" + CTA "Ajouter un document". URL params verbeux `?search=&bien=&locataire=&annee=&type=&page=`. |
| `GET /coffre/corbeille` | Liste Justificatifs soft-deleted (UI-5.1) | Table colonnes : `date_corbeille | type | titre | bien | locataire | date_purge_possible | actions`. Actions "Restaurer" + "Purger" (disabled si avant date). |
| `GET /coffre/upload` | Formulaire upload (UI-4.1, UI-4.2) | 1 page, ordre `fichier → titre → date → type → fieldset rattachement (radio + dropdowns conditionnels) → montant → notes`. Submit "Téléverser le document". |
| `GET /justificatifs/:id` | Fiche détail Justificatif (UI-4.3) | Layout 1 colonne : Méta haut (titre, type, date, bien, locataire, montant, notes) + actions inline (Télécharger / Modifier / Mettre en corbeille) + Preview pleine largeur dessous. |
| `GET /justificatifs/:id/fichier` | Download/preview fichier | Endpoint serveur, `Content-Disposition: attachment` ou inline selon contexte. Réutilisé par les `<a>` et `<img>`. |
| `GET /justificatifs/:id/modifier` | Form édition métadonnées | Mêmes champs que `/coffre/upload` sauf `fichier` (immutable post-upload). |
| `GET /biens/:id/travaux` | Liste tickets d'un Bien (UI-5.2) | Table 7 colonnes `titre | statut | date-ouverture | date-cloture | cout-estime | cout-reel | actions` + CTA "Nouveau ticket". |
| `GET /travaux/nouveau?bienId=:id` | Form création ticket | 1 page : titre, description, date ouverture, coût estimé, notes. Submit "Créer le ticket" → redirect `/travaux/:id`. |
| `GET /travaux/:id` | Fiche détail ticket (UI-5.3) | Layout 1 colonne 3 sections : Méta → Pièces jointes (table + upload inline) → Clôture inline (si statut ouvert/en_cours). |
| Fiche Bien (existant) | Section "Documents" + section "Travaux" ajoutées (UI-5.4) | Documents : 5 derniers + lien `/coffre?bien=:id`. Travaux : tickets ouverts + lien `/biens/:id/travaux` + CTA "Nouveau ticket". |
| Fiche Locataire (existant) | Section "Documents" ajoutée (UI-5.4 + D-120) | Dropdown filtre par type + 5 derniers + lien `/coffre?locataire=:id`. |

---

## Interaction Contracts

### Upload flow (D-116 + UI-4 + UI-6.3)

1. User navigue `/coffre/upload` ou ouvre flow inline depuis `/travaux/:id` PJ section.
2. `<form enctype="multipart/form-data" method="POST" action="/coffre/upload">` — single file `<input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic,.webp" required aria-describedby="fichier-hint">`.
3. Label : "Fichier" + hint paragraphe `<p id="fichier-hint">PDF, JPG, PNG, HEIC, WebP — max 50 Mo</p>`.
4. Champs ordre **UI-4.1** :
   - `[fichier]`
   - `[titre]` (requis)
   - `[date du document]` (requis, type=date)
   - `[type]` (`<select>` enum `TypeJustificatif`)
   - **`<fieldset>` Rattacher à** (UI-4.2) :
     ```html
     <fieldset>
       <legend>Rattacher à</legend>
       <label><input type="radio" name="rattachement" value="bien" required> Un Bien</label>
       <label><input type="radio" name="rattachement" value="locataire"> Un Locataire</label>
       <label><input type="radio" name="rattachement" value="bien_et_locataire"> Un Bien et un Locataire</label>
     </fieldset>
     <div class="field-rattachement-bien"><label for="bien">Bien</label><select id="bien" name="bien">…</select></div>
     <div class="field-rattachement-locataire"><label for="locataire">Locataire</label><select id="locataire" name="locataire">…</select></div>
     ```
     CSS-only conditional show via `:has()` ou sibling combinator. Fallback : visibles permanents si CSS non supporté.
   - `[montant TTC]` (optionnel)
   - `[notes]` (optionnel, `<textarea>`)
5. Submit "Téléverser le document" → POST.
6. **`<progress>` natif** durant l'upload (CSS `form[data-uploading] progress { display: block }` + minimal JS sur `submit` event).
7. Sur succès : redirect `/justificatifs/:id` avec `banniereSuccess="Document ajouté."`.
8. Sur erreur (413 / bad MIME / invariant) : re-render form avec `aria-invalid="true"` sur le champ fautif + `.error-msg` verbatim UI-6.2.

### File view (D-117)

- **PDF / WebP / HEIC (converted JPEG)** : `<a href="/justificatifs/:id/fichier" target="_blank" rel="noopener noreferrer">Ouvrir le fichier <span class="sr-only">(s'ouvre dans un nouvel onglet)</span></a>` — visualiseur natif navigateur.
- **JPG / PNG (original)** : inline `<img src="/justificatifs/:id/fichier" alt="{titre}" style="max-width: 100%; height: auto;">` dans la section preview de `/justificatifs/:id`.

### Soft-delete flow (D-109)

1. Bouton "Mettre en corbeille" inline sur fiche `/justificatifs/:id` (always-visible UI-3.4) OU row actions sur `/coffre`.
2. Click ouvre `confirm-dialog.ejs` :
   - Message : "Ce document sera déplacé vers la corbeille. Vous pourrez le restaurer depuis /coffre/corbeille."
   - Bouton confirm : "Mettre en corbeille" styled `var(--couleur-destructive)`.
   - Autofocus sur bouton "Annuler" (pattern Phase 1).
3. Confirm POST `/justificatifs/:id/corbeille` → redirect `/coffre` avec `banniereSuccess="Document déplacé vers la corbeille."`.

### Purge flow (D-109 + UI-5.1)

1. Sur `/coffre/corbeille`, chaque row affiche la colonne `date_purge_possible` (computed `cree_le + 10 ans`).
2. Bouton "Purger définitivement" toujours rendu mais **`disabled` + `aria-disabled="true"` + `title="Disponible le {date}"`** si `today < date_purge_possible`.
3. Si `today >= date_purge_possible` : bouton actif. Click ouvre `confirm-dialog.ejs` :
   - Message : "Cette action est irréversible. Le fichier sera supprimé définitivement du disque."
   - Bouton confirm : "Purger définitivement" styled `var(--couleur-destructive)`.
4. Confirm POST `/justificatifs/:id/purger` → redirect `/coffre/corbeille` avec `banniereSuccess="Document supprimé définitivement."`. Le serveur ré-valide `Justificatif.peutEtrePurge(today)` (D-109 garde).

### Ticket statut transition (D-114)

- Badge statut `<span aria-label="Statut : {label}" style="background: var(--couleur-{role}-bg); color: var(--couleur-{role}); padding: 2px 6px; border-radius: 4px;">{label}</span>` — composant `partial-badge-statut-ticket.ejs`.

Mapping :

| Statut | Label | Token bg | Token text |
|---|---|---|---|
| `ouvert` | "ouvert" | `--couleur-accent-bg` | `--couleur-accent` |
| `en_cours` | "en cours" | `--couleur-warning-bg` | `--couleur-warning` |
| `clos` | "clos" | `--couleur-success-bg` | `--couleur-success` |
| `annule` | "annulé" | `--couleur-neutre-bg` | `--couleur-neutre` |

- **Transitions manuelles uniquement** (D-114). Pas d'auto-transition V1.
- Section "Clôture" sur `/travaux/:id` rendue conditionnellement si statut ∈ {`ouvert`, `en_cours`}. Form inline : `[date_cloture]` + `[cout_reel_ttc]` + bouton "Clore le ticket".

### Filter behavior on `/coffre` (D-110 + UI-3.2 + UI-3.3)

- `<form method="GET" action="/coffre">` — submit reload page.
- Search input : `<input type="search" name="search" placeholder="Titre, notes, nom de fichier…">`.
- 4 selects : `<select name="bien">`, `<select name="locataire">`, `<select name="annee">`, `<select name="type">`. Chaque select a une option "Tous" valeur `""` par défaut.
- Submit "Filtrer" + lien "Effacer les filtres" → `/coffre` (conditionnel : affiché seulement si filtres actifs détectés via présence de query params).
- Pas de live filtering V1 — full page reload.
- Pagination URL `?page=N` cohérent.

### Row actions visibility (UI-3.4) — refactor cross-cutting

- **Always-visible** : suppression de `.row-actions { visibility: hidden }` + reveals dans `public/styles/app.css` (lignes 19-25).
- `data-table.ejs` partial : `<td class="row-actions" style="color: var(--pico-muted-color); text-align: right;">` pour atténuer visuellement.
- Impact : toutes les listings projet (quittances, encaissements, échéances, baux, biens, locataires, impayés, relances + nouveaux coffre/travaux) verront leurs row actions devenir visibles permanent.
- Justification A11y : WCAG 2.4.4 Link Purpose + 3.3.2 Labels or Instructions + touch-friendly + Doherty (feedback < 400ms) + cognitive load reduit (discoverability immédiate).

---

## Copywriting Contract (UI-6.1 + UI-6.2 + D-119)

### CTAs primaires (UI-6.1)

| Action | Verbatim |
|---|---|
| Ajout nouveau document | "Ajouter un document" |
| Submit upload | "Téléverser le document" |
| Nouveau ticket | "Nouveau ticket" |
| Submit ticket création | "Créer le ticket" |
| Restaurer depuis corbeille | "Restaurer" |
| Clore ticket | "Clore le ticket" |
| Submit clôture | "Clore le ticket" |
| Purger définitivement | "Purger définitivement" |
| Soft-delete | "Mettre en corbeille" |
| Ajouter PJ ticket | "Ajouter une pièce jointe" |
| Effacer filtres | "Effacer les filtres" |
| Voir tous documents Bien | "Voir tous les documents de ce Bien ({N})" |
| Voir tous tickets | "Voir tous les tickets ({N})" |
| Voir corbeille | "Corbeille ({N})" |

### Empty states (D-119 + UI-6)

| Contexte | Heading | Body | CTA |
|---|---|---|---|
| Coffre vide | "Aucun justificatif pour le moment" | "Commencez par téléverser une facture, un bail signé ou un diagnostic." | "Ajouter un document" → `/coffre/upload` |
| Coffre filtré vide | "Aucun document ne correspond à ces filtres" | "Modifiez les filtres ou ajoutez de nouveaux documents." | (lien "Effacer les filtres") |
| Corbeille vide | "La corbeille est vide" | "Les documents supprimés apparaissent ici avant purge définitive." | (aucun CTA) |
| Tickets bien vides | "Aucun ticket pour ce Bien" | "Le premier ticket sert souvent à tracer la mise en service du logement." | "Nouveau ticket" → `/travaux/nouveau?bienId=:id` |
| Documents bien vides | "Aucun document rattaché à ce Bien" | "Téléversez factures, devis ou diagnostics depuis le coffre." | "Ajouter un document" → `/coffre/upload` |
| Documents locataire vides | "Aucun document rattaché à ce Locataire" | "Téléversez CNI, fiches de paie ou attestations depuis le coffre." | "Ajouter un document" → `/coffre/upload` |
| PJ ticket vides | "Aucune pièce jointe" | "Ajoutez un devis ou une facture pour ce ticket." | "Ajouter une pièce jointe" inline |

### Messages d'erreur (UI-6.2 — ton factuel non paternaliste)

| Contexte | Verbatim |
|---|---|
| Upload format rejeté | "Format non accepté. Formats autorisés : PDF, JPG, PNG, HEIC, WebP." |
| Upload taille dépassée (413) | "Fichier trop volumineux. La taille maximale est 50 Mo." |
| Magic-bytes mismatch | "Le fichier ne correspond pas au format annoncé. Le téléversement a été refusé pour des raisons de sécurité." |
| Champ titre vide | "Le titre est obligatoire." |
| Date document absente | "La date du document est obligatoire." |
| Type non sélectionné | "Le type de document est obligatoire." |
| Invariant rattachement violé | "Le document doit être rattaché à un bien ou à un locataire." |
| Ticket titre vide | "Le titre du ticket est obligatoire." |
| Ticket description vide | "La description est obligatoire." |
| Ticket date ouverture future | "La date d'ouverture ne peut pas être dans le futur." |
| Ticket clôture sans coût réel | "Le coût réel TTC est obligatoire pour clore le ticket." |
| Tentative purge avant 10 ans | "Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date." |
| Bien introuvable | "Bien introuvable." |
| Locataire introuvable | "Locataire introuvable." |
| Justificatif introuvable | "Document introuvable." |
| Ticket introuvable | "Ticket introuvable." |

### Banners succès

| Contexte | Verbatim |
|---|---|
| Upload réussi | "Document ajouté." |
| Mise en corbeille | "Document déplacé vers la corbeille." |
| Restauration | "Document restauré." |
| Purge | "Document supprimé définitivement." |
| Ticket créé | "Ticket créé." |
| Ticket clôturé | "Ticket clôturé." |
| PJ ajoutée | "Pièce jointe ajoutée au ticket." |
| Modif justificatif | "Document mis à jour." |

### Banner rétention (`banniere-warning` inline corbeille)

> "Conservation légale obligatoire jusqu'au {date}. Vous pourrez purger ce document à partir de cette date."

Source : D-109 (verbatim conservé), R4.3 RISKS (message factuel non paternaliste).

---

## Accessibility Contract (UI-6.3 + WCAG 2.1 AA)

### Patterns spécifiques Phase 4

| Élément | Pattern |
|---|---|
| `<input type="file">` (D-116) | `<label for="fichier">Fichier</label><input id="fichier" type="file" accept=".pdf,..." required aria-describedby="fichier-hint"><p id="fichier-hint">PDF, JPG, PNG, HEIC, WebP — max 50 Mo</p>`. Pas de placeholder seul. |
| `<progress>` upload (UI-6.3 b) | `<div aria-live="polite"><progress aria-label="Téléversement en cours" max="100" value="<%= valeur %>"><%= valeur %>%</progress></div>`. `aria-live="polite"` non-intrusif, jamais `assertive`. |
| Bannière succès | `banniere-success.ejs` existant — `role="status" aria-live="polite"` (déjà conforme). |
| Bannière warning rétention | `banniere-warning.ejs` existant — pas de `aria-live` requis (non-critique). |
| `<a target="_blank">` (UI-6.3 a) | `<a href="…" target="_blank" rel="noopener noreferrer">Ouvrir le fichier<span class="sr-only">(s'ouvre dans un nouvel onglet)</span></a>`. |
| Badge statut Ticket (UI-6.3 c) | `<span aria-label="Statut : en cours" style="…">en cours</span>`. Jamais color-only (WCAG 1.4.1). Texte visible. |
| Confirm dialog | `confirm-dialog.ejs` existant — `autofocus` sur "Annuler", ESC pour fermer. |
| Row actions always-visible (UI-3.4) | Visibles permanent dans le partial `data-table.ejs`. WCAG 2.4.4 + 3.3.2 + touch-friendly + Doherty. |
| Inline image preview | `<img src="…" alt="{titre du Justificatif}">` — titre toujours présent (requis). |
| Bouton "Purger" disabled (UI-5.1) | `<button disabled aria-disabled="true" title="Disponible le {date}" aria-describedby="purge-date-{id}">Purger définitivement</button>` + cellule date `<td id="purge-date-{id}">{date}</td>`. Taille ≥ 44px conservée. |
| Filtres `<select>` (UI-3.2) | Chaque select a un `<label>` explicite ou `aria-label`. Option "Tous" valeur `""`. |
| Coffre table | `<table aria-label="Justificatifs">`. Sortable columns = V1.1+. |
| Tickets table | `<table aria-label="Tickets travaux">`. |
| Touch targets | Tous `<button>` et `<a role="button">` minimum `44x44px` (WCAG 2.5.5). |
| `prefers-reduced-motion` | `@media (prefers-reduced-motion: reduce)` existant respecte `banniere-success` auto-dismiss + tout `transition/animation`. |
| Keyboard navigation | Tous les CTAs et row actions tabulables. Order DOM cohérent ordre lecture. |
| `<fieldset>` radio mutex (UI-4.2) | `<legend>Rattacher à</legend>` + 3 radios `name="rattachement"` + dropdowns conditionnels. Pas de tabs (anti-Pico). |

### Contrast (vérifiés en section Color)

Tous les couples contrastés AA/AAA documentés. Le `#d97706` (warning) est utilisé seulement sur fond `--couleur-warning-bg` pour atteindre le ratio.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | aucun — not applicable (no shadcn) | not applicable |
| npm packages | `@fastify/multipart` (upload), lib magic-bytes (D-118 / DP-21), lib HEIC converter (D-105 / DP-22) | `pnpm audit` standard — no shadcn vetting required |

Aucun composant third-party registry utilisé Phase 4. Toute l'UI = EJS partials maison + Pico classless.

---

## Checker Sign-Off

`gsd-ui-checker` run du 2026-05-18 — **APPROVED**.

- [x] Dimension 1 Copywriting: **PASS** — 14 CTAs verb+noun, 7 empty states, 16 erreurs avec solution, 8 banners succès. Destructive routé via `confirm-dialog.ejs`. Ton factuel non paternaliste (R4.3 RISKS).
- [x] Dimension 2 Visuals: **PASS** — Page Inventory complet (11 routes), 8 partials réutilisés + 6 nouveaux spécifiés. Icon library "none — text labels only". Row actions always-visible documenté (UI-3.4).
- [x] Dimension 3 Color: **PASS** — Accent reserved-for list bornée (6 items), destructive reserved-for list bornée. Tokens `:root` + bg variants. Contraste WCAG 2.1 AA documenté.
- [x] Dimension 4 Typography: **FLAG (non-bloquant)** — 4 tailles 14/16/20/28 au max autorisé, 3 poids 400/600/700 au-dessus du seuil strict de 2. Décision utilisateur verrouillée UI-1.2 : (a) Pico v2 defaults sans override, (b) mapping 1:1 sémantique HTML (label/body=400, h2/th=600, h1=700). Acceptée non-bloquante.
- [x] Dimension 5 Spacing: **PASS** — 7 tokens 8-pt scale (multiples de 4) + exception touch 44px WCAG 2.5.5 documentée.
- [x] Dimension 6 Registry Safety: **PASS** — Aucun third-party UI registry (Pico classless maison). npm packages serveur audités standard (`pnpm audit`).

**Approval:** approved 2026-05-18 par `gsd-ui-checker` (5/6 PASS + 1 FLAG accepté).

---

## Decision Trace

Toutes les décisions UI Phase 4 sont tracées dans `04-DISCUSSION-LOG.md` :

| Section UI-SPEC | Source(s) |
|---|---|
| Spacing Scale | UI-1.1 |
| Typography | UI-1.2 |
| Color (tokens + refactor) | UI-1.3 |
| Badge TicketTravaux | UI-1.4 |
| Sidebar Navigation | UI-2.1, UI-2.2, UI-2.3 |
| Coffre liste — Columns | UI-3.1 |
| Coffre liste — Filtres | UI-3.2 (sidebar deferred V1.1+) |
| URL params | UI-3.3 (user override : `search` verbeux) |
| Row actions | UI-3.4 (user override : always-visible + refactor cross-cutting) |
| Upload form — Champs | UI-4.1 |
| Upload form — Invariant | UI-4.2 |
| Fiche justificatif — Layout | UI-4.3 |
| Fiche justificatif — Actions | UI-4.4 |
| Corbeille — Rétention | UI-5.1 |
| Tickets — Columns | UI-5.2 |
| Fiche ticket — Layout | UI-5.3 |
| Fiches augmentées (Bien/Locataire) | UI-5.4 |
| Verbatim CTAs | UI-6.1 |
| Verbatim erreurs | UI-6.2 |
| Patterns A11y | UI-6.3 |
| Upload natif | D-116 (CONTEXT) |
| Visualisation `<a target="_blank">` / `<img>` | D-117 (CONTEXT) |
| Magic-bytes serveur | D-118 (CONTEXT — sécurité) |
| Empty states (4 contextes) | D-119 (CONTEXT) |
| `/coffre` page principale | D-111 (CONTEXT) |
| Workflow ticket méta + PJ | D-114 (CONTEXT) |
| Section Documents fiche Locataire | D-120 (CONTEXT) |

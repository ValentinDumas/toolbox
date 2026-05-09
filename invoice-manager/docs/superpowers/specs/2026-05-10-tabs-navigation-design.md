# Spec — Navigation par onglets (Ledger / À réviser / Corbeille)

Date : 2026-05-10  
Statut : approuvé

## Problème

Le dashboard présente trois sections tabulaires empilées verticalement (Ledger, Non validés, Corbeille). Cela crée trois frictions :

- **Navigation** : il faut scroller loin pour atteindre "Non validés" quand le ledger est long.
- **Discoverabilité** : au premier regard, impossible de savoir s'il y a des items à traiter.
- **Encombrement** : les sections secondaires polluent visuellement la vue principale.

## Solution

Regrouper les trois sections dans un système d'onglets. KPI et Santé restent au-dessus des onglets, non affectés.

## Structure de la page

```
Header (titre + sélecteur année)
KPI — Synthèse fiscale          ← inchangé
Santé workspace                 ← inchangé
─────────────────────────────────────────────
[Ledger (N)]  [À réviser (N)]  [Corbeille (N)]   ← tab bar
─────────────────────────────────────────────
Panneau actif
```

## Comportement des onglets

- **Onglet actif par défaut** : Ledger.
- **Labels** : `Ledger (42)`, `À réviser (3)`, `Corbeille (0)` — le compteur est toujours affiché.
- **Onglet vide** (count = 0) : attribut `disabled` sur le `<button>`, style grisé, non focusable au clavier.
- **Persistance** : hash URL (`#ledger`, `#reviser`, `#corbeille`). Le rechargement de la page restaure l'onglet actif. Aucun changement backend.

## Accessibilité

| Élément | Attributs |
|---|---|
| Conteneur onglets | `role="tablist"` |
| Bouton onglet | `role="tab"`, `aria-selected`, `aria-controls="panel-X"`, `tabindex` |
| Panneau | `role="tabpanel"`, `id="panel-X"`, `aria-labelledby="tab-X"` |
| Onglet vide | `disabled`, `aria-disabled="true"` |

Navigation clavier : ←/→ cycle entre les onglets non-disabled. Enter/Space active l'onglet focusé.

## JavaScript

Vanilla, ~25 lignes, aucune dépendance. Logique :

1. Au chargement : lire `location.hash`, activer l'onglet correspondant (défaut : `#ledger`).
2. Au clic : mettre à jour `aria-selected`, masquer/afficher les panneaux, écrire le hash.
3. Au `keydown` sur un tab : gérer ←/→ en skippant les disabled.

## CSS

Onglet actif : bordure basse `--primary` + `font-weight: 600`.  
Onglet disabled : `opacity: 0.4`, `cursor: not-allowed`.  
Panneaux inactifs : `display: none`.  
Style intégré dans le `<style>` existant du template.

## Changements de template

- Supprimer le `{% if items_a_reviser_list %}` et `{% if corbeille_list %}` qui masquent conditionnellement les sections — les panneaux existent toujours, l'onglet disabled remplace ce comportement.
- Ajouter un état vide dans chaque panneau (`<p class="empty-row">Aucun item.</p>`) affiché quand la liste est vide.
- Pas de changement backend (`dashboard.py`, routes).

## Non-scope

- Pas de routing serveur pour les onglets.
- Pas de persistance en base de données de l'onglet préféré.
- Pas d'animation de transition entre panneaux.

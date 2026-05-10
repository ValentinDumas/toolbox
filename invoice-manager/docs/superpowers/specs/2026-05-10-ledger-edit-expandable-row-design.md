# Spec : édition inline ledger — expandable row

**Date :** 2026-05-10
**Contexte :** Les items "validé" dans le ledger sont éditables, mais le mécanisme actuel (formulaire caché révélé via CSS `:target` sous le tableau) ne signale pas clairement à l'utilisateur qu'il est en mode édition. Les corrections sont fréquentes, la solution doit être rapide et sans ambiguïté.

---

## Problème

Le clic sur `✎` déclenche un scroll vers un formulaire situé sous l'ensemble du tableau, révélé par CSS `:target`. Le lien visuel entre la ligne cliquée et le formulaire apparu est faible : l'utilisateur ne sait pas clairement qu'il est "en train de modifier" un item précis.

## Solution retenue : expandable row

Remplacer le formulaire hors-tableau par un `<tr>` de formulaire inséré **directement sous la ligne source**, dans le `<tbody>`. Le formulaire est rendu côté serveur (Jinja), JavaScript ne fait que show/hide + gestion d'état.

---

## Structure HTML

```html
<!-- Ligne source (validé) -->
<tr class="ledger-row" data-edit-target="edit-row-{id}">
  <td>...</td>
  ...
  <td>
    <span class="badge badge-paid">Validé ✓</span>
    <button class="btn-edit-item" aria-expanded="false"
            aria-controls="edit-row-{id}" title="Modifier">✎</button>
  </td>
</tr>

<!-- Ligne d'édition — cachée par défaut -->
<tr class="edit-row" id="edit-row-{id}" hidden>
  <td colspan="8">
    <div class="edit-row-inner">
      <div class="edit-row-header">
        <span>Correction — {émetteur} — {date}</span>
        <span class="badge badge-editing">En cours d'édition</span>
      </div>
      <form method="post" action="/review/{id}/save">
        <!-- mêmes champs que le formulaire actuel -->
        <div class="review-fields">...</div>
        <div class="review-actions">
          <button type="submit" class="btn-save">Enregistrer la correction</button>
          <button type="button" class="btn-cancel-edit">Annuler</button>
        </div>
      </form>
    </div>
  </td>
</tr>
```

---

## Comportement JavaScript

- **Ouverture :** clic `✎` → retire `hidden` sur `edit-row-{id}`, ferme tout autre `edit-row` ouvert, `scrollIntoView({ behavior: 'smooth', block: 'nearest' })` sur la ligne étendue
- **Exclusivité :** un seul `edit-row` ouvert à la fois — ouvrir un second ferme le précédent
- **Icône du bouton :** `✎` → `✕` tant que la ligne est ouverte ; `aria-expanded` mis à jour
- **Fermeture via "Annuler" :** remet `hidden`, rétablit l'icône `✎`
- **Submit :** POST normal (`/review/{id}/save`), rechargement de page — pas d'AJAX

---

## Signal visuel "mode édition"

Quand `edit-row` est ouvert :

| Élément | Style |
|---|---|
| Ligne source | `background: #FFFBEB` + `border-left: 3px solid #F59E0B` |
| `edit-row` | `background: #FFFBEB` + même bordure gauche (continuité visuelle) |
| En-tête formulaire | Texte "Correction — [Émetteur] — [Date]" + badge "En cours d'édition" (ambre) |
| Bouton `✎` | Passe à `✕`, `aria-expanded="true"` |

Le fond ambre partagé entre la ligne source et le formulaire crée une continuité visuelle claire : les deux n'en font visuellement qu'un.

---

## Champs du formulaire

Identiques au formulaire actuel : Type, Montant HT, TVA, TTC, Date, Émetteur, N° facture, Catégorie, Notes correction. Pré-remplis avec les valeurs actuelles de l'item.

---

## Ce qui est supprimé

- Le bloc `{% for item in items_validés_list %}` sous le tableau (formulaires cachés via `:target`)
- La règle CSS `.review-item-hidden { display: none; } .review-item-hidden:target { display: block; }`
- Les `<a href="#review-{id}">` sur les boutons d'édition du ledger

---

## Accessibilité

- `aria-expanded` sur le bouton `✎` reflète l'état ouvert/fermé
- `aria-controls` pointe vers l'id du `edit-row`
- Le `<button type="button">` "Annuler" n'est pas un submit (pas de soumission accidentelle)
- Focus mis sur le premier champ du formulaire à l'ouverture

---

## Hors périmètre

- Validation client des champs (pas demandé)
- Sauvegarde AJAX / sans rechargement (pas demandé)
- Édition des items `auto_validé` : non concerné par cette spec (comportement inchangé)

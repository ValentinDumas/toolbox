# Design — Prévisualisation et téléchargement PDF dans le Ledger

**Date :** 2026-05-10  
**Périmètre :** `dashboard.html` — onglets Ledger et À réviser

---

## Contexte

Dans la colonne fichier du ledger, une icône 🔍 ouvre actuellement le fichier PDF dans un nouvel onglet (`<a target="_blank">`). L'objectif est de :

1. Remplacer ce comportement par un téléchargement direct (icône 📥)
2. Ajouter une prévisualisation inline dans le navigateur via une modale (icône 🔍 à gauche du 📥)

Les fichiers sont tous des PDFs servis en même-origine par la route Flask `/files/<filename>`.

---

## Décision d'architecture : `<dialog>` natif + `<iframe>`

**Approche retenue :** modale HTML native (`<dialog>`) avec le PDF rendu dans un `<iframe>`.

**Alternatives écartées :**
- Lightbox (ex. GLightbox, Fancybox) : conçu pour les images, pas pour les documents PDF multipages. Ajoute une dépendance externe sans apport réel.
- Panneau latéral (drawer) : le PDF serait trop étroit sur écran standard. Complexité JS supérieure pour un bénéfice marginal (le ledger n'a pas besoin d'être visible simultanément).
- Expansion inline (row expand) : hauteur insuffisante pour une facture lisible, désorientation de la mise en page.

**Pourquoi `<dialog>` :**
- Focus trap natif (pas besoin de JS custom)
- Fermeture par Échap natif
- Sémantique accessible (rôle `dialog`, aria gérés par le navigateur)
- Zéro dépendance externe

---

## Comportement détaillé

### Colonne fichier — deux icônes

Pour chaque ligne avec un `fichier_source` :

```
🔍   📥
```

| Icône | Élément HTML | Action |
|-------|-------------|--------|
| 🔍 | `<button>` | Ouvre la modale de prévisualisation |
| 📥 | `<a download>` | Force le téléchargement du PDF |

### Modale de prévisualisation

- Un seul `<dialog id="pdf-modal">` partagé dans le template (pas une modale par ligne)
- Structure :
  - **Header** : nom du fichier + bouton ✕
  - **Corps** : `<iframe>` pointant vers `/files/<basename>`, pleine largeur, hauteur 80vh
  - **Footer** : indication "Échap ou clic en dehors pour fermer"
- Fermeture : bouton ✕, touche Échap (natif), clic sur le backdrop (`::backdrop` ou click sur `<dialog>` lui-même)
- À la fermeture : `iframe.src = ''` pour stopper le rendu PDF et libérer la mémoire

### Téléchargement

```html
<a href="/files/{{ row.fichier_source|basename }}"
   download="{{ row.fichier_source|basename }}"
   title="Télécharger">📥</a>
```

L'attribut `download` force le téléchargement côté navigateur sans modification backend. Fonctionne car même-origine.

---

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `templates/dashboard.html` | Remplacement `<a>` unique (ligne 648) par `<button>🔍` + `<a>📥` |
| `templates/dashboard.html` | Même remplacement onglet À réviser (ligne 768) |
| `templates/dashboard.html` | Ajout `<dialog id="pdf-modal">` avant `</body>` |
| `templates/dashboard.html` | Ajout ~20 lignes JS vanilla (`openPdfPreview`, `closePdfModal`, clic backdrop) |

Aucun changement backend nécessaire.

---

## JS — interface minimale

```javascript
function openPdfPreview(url, name) {
  document.getElementById('pdf-modal-frame').src = url;
  document.getElementById('pdf-modal-title').textContent = name;
  document.getElementById('pdf-modal').showModal();
}

function closePdfModal() {
  const d = document.getElementById('pdf-modal');
  d.close();
  document.getElementById('pdf-modal-frame').src = '';
}

// Clic backdrop = fermeture
document.getElementById('pdf-modal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closePdfModal();
});
```

---

## Hors périmètre

- Support des fichiers images (JPG, PNG) — les fichiers actuels sont exclusivement des PDFs
- Pagination dans la modale ou navigation entre factures depuis la modale
- Changement de la route `/files/` côté backend

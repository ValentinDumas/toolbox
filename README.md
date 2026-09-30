# photos-vers-drive

Raccourci iOS : choisir un dossier (Google Drive ou autre emplacement de l'app Fichiers),
prendre une série de photos, les retrouver nommées dans ce dossier. Rien ne passe par la
galerie.

Le raccourci est généré par `build.py` (plist binaire au format Raccourcis), puis signé
sur le Mac avec `shortcuts sign` — iOS refuse les raccourcis non signés.

## Fonctionnement

1. Sélection du dossier de destination.
2. Saisie d'un sujet (« Salle de bain »), converti en préfixe kebab-case (`salle-de-bain`).
3. Boucle : photo → enregistrement immédiat dans le dossier → menu « Encore une photo » /
   « Terminer ». 30 photos max par session.
4. Notification finale avec le nombre de photos enregistrées.

Nom des fichiers : `<sujet>-<AAAA-MM-JJ-HHmm>-<n>.<ext>`, par exemple
`salle-de-bain-2026-10-01-1430-3.jpg`. L'horodatage est calculé une fois au lancement :
toutes les photos d'une session le partagent, deux sessions ne s'écrasent pas.
L'extension suit Réglages → Appareil photo → Formats (« Le plus compatible » = `.jpg`,
« Haute efficacité » = `.heic`).

Chaque photo est enregistrée dès sa prise : un abandon en cours de session ne perd que la
photo en cours.

## Installation

### Prérequis

- Mac connecté à iCloud (Réglages Système → identifiant Apple) — requis par
  `shortcuts sign`.
- iPhone : app Google Drive installée, et Drive activé dans l'app Fichiers
  (Parcourir → « … » → Modifier → Drive).

### Générer et signer

```sh
cd ~/toolbox/photos-vers-drive
python3 build.py
shortcuts sign --mode anyone \
  --input dist/photos-vers-drive-unsigned.shortcut \
  --output dist/photos-vers-drive.shortcut
```

`dist/` n'est pas versionné : le fichier signé dépend du compte qui signe.

### Importer

- **Via iCloud** : `open dist/photos-vers-drive.shortcut` sur le Mac, valider l'import.
  Si la synchro iCloud des raccourcis est active, il apparaît sur l'iPhone.
- **Via AirDrop** : envoyer `dist/photos-vers-drive.shortcut` à l'iPhone, l'ouvrir,
  « Ajouter le raccourci ».

### Accès rapide

| Déclencheur | Réglage | Disponibilité |
|-------------|---------|---------------|
| Bouton Action | Réglages → Bouton Action → Raccourci | iPhone 15 Pro et suivants |
| Toucher le dos | Réglages → Accessibilité → Toucher → Toucher le dos → Toucher deux fois | tous les iPhone récents |
| Centre de contrôle / écran verrouillé | ajouter une commande « Raccourci » | iOS 18+ |
| Écran d'accueil | raccourci → Partager → « Sur l'écran d'accueil » | toujours |

## Utilisation

1. Lancer le raccourci (bouton Action, double tap au dos…).
2. Choisir le dossier Drive.
3. Saisir le sujet — `photos` par défaut.
4. Photographier, valider chaque prise, puis « Encore une photo » ou « Terminer ».

## Statut et points à vérifier

Le format des raccourcis n'est pas documenté par Apple : identifiants d'actions et clés
de paramètres sont reconstitués, **non testés sur iPhone**. Au premier lancement,
vérifier dans l'éditeur :

| Action | Paramètre à contrôler | Si incorrect |
|--------|----------------------|--------------|
| Sélectionner un fichier | sélection de **dossiers** activée | l'activer ; à défaut, action « Fichier » sur un dossier fixe |
| Enregistrer le fichier | destination = variable `Dossier`, « Demander où enregistrer » désactivé | relier la variable ; à défaut, activer « Demander où enregistrer » |
| Définir le nom | `Prefixe-Horodatage-Indice de répétition` | recomposer le nom avec ces trois variables |
| Si | `Termine` « n'a aucune valeur » | reconfigurer la condition |

Une correction faite dans l'éditeur se reporte dans `build.py` pour rester reproductible.

## Structure

```
build.py    génère dist/photos-vers-drive-unsigned.shortcut
dist/       fichiers générés (ignoré par git)
```

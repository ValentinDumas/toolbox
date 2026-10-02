# Construction manuelle sur iPhone

Construire le raccourci directement dans l'app Raccourcis, sans Mac ni signature iCloud.
Durée estimée : 15–20 min.

Les libellés d'actions sont donnés en français, de mémoire : ils peuvent varier selon la
version d'iOS. En cas de doute, taper un mot-clé (« photo », « variable », « nom ») dans
la recherche d'actions.

## Écart avec `build.py`

La variable `Termine` est **initialisée à `non` avant la boucle** et testée avec « est
non ». `build.py` teste « n'a aucune valeur » sur une variable jamais définie — ce qui
marche à l'exécution mais pas dans l'éditeur, qui ne propose une variable dans le « Si »
qu'une fois définie plus haut.

## 0. Prérequis

- [ ] App **Google Drive** installée et connectée.
- [ ] App **Fichiers** → Parcourir → « … » → Modifier → **Drive** activé.
- [ ] Réglages → Appareil photo → Formats : « Le plus compatible » pour du `.jpg`,
      « Haute efficacité » pour du `.heic`.

## 1. Créer le raccourci

1. App **Raccourcis** → onglet Raccourcis → **+**.
2. Tap sur le nom en haut → **Renommer** → `Photos vers Drive`.
3. Même menu → **Choisir l'icône** : glyphe appareil photo, couleur au choix.

Convention de la suite : « Ajouter » = barre de recherche en bas → taper le nom → tap
sur l'action. Elle s'ajoute en fin de liste ; la faire glisser si besoin.

## 2. Dossier de destination

| # | Action | Réglage |
|---|--------|---------|
| 1 | **Sélectionner un fichier** | flèche › → activer la sélection de **dossiers** ; « Sélectionner plusieurs » désactivé |
| 2 | **Définir la variable** | nom `Dossier`, entrée = *Fichier* (sortie de l'action 1) |

Si l'action 1 ne propose pas de choisir un dossier : la remplacer par **Fichier**
(ou **Dossier**) pointé sur un dossier Drive fixe. Un raccourci par dossier habituel
— le dupliquer via appui long → Dupliquer.

## 3. Préfixe à partir du sujet

| # | Action | Réglage |
|---|--------|---------|
| 3 | **Demander une entrée** | type Texte, question `Sujet ?`, réponse par défaut `photos` |
| 4 | **Modifier la casse** | entrée = *Texte fourni*, casse **minuscules** |
| 5 | **Remplacer le texte** | rechercher ` ` (une espace), remplacer par `-`, dans *Texte mis à jour* |
| 6 | **Définir la variable** | nom `Prefixe`, entrée = sortie de l'action 5 |

## 4. Horodatage de la session

| # | Action | Réglage |
|---|--------|---------|
| 7 | **Formater la date** | date = *Date actuelle* ; format **Personnalisé** ; chaîne `yyyy-MM-dd-HHmm` |
| 8 | **Définir la variable** | nom `Horodatage`, entrée = *Date formatée* |

Attention à la casse de la chaîne : `MM` = mois, `mm` = minutes, `HH` = heure sur 24 h.

## 5. Initialiser l'indicateur de fin

| # | Action | Réglage |
|---|--------|---------|
| 9 | **Texte** | contenu `non` |
| 10 | **Définir la variable** | nom `Termine`, entrée = *Texte* |

## 6. Boucle de prise de vue

Ajouter les actions dans cet ordre, en glissant chacune **à l'intérieur** du bloc
indiqué par l'indentation.

```
11  Répéter 30 fois
12  │  Si  [Termine]  est  « non »
13  │  │  Prendre une photo
14  │  │  Définir le nom
15  │  │  Enregistrer le fichier
16  │  │  Définir la variable  Nombre
17  │  │  Choisir dans le menu  « Suite ? »
    │  │  ├─ Encore une photo        (vide)
    │  │  └─ Terminer
18  │  │       Texte  « oui »
19  │  │       Définir la variable  Termine
    │  │  Fin du menu
    │  Autrement                      (vide — supprimable si iOS le permet)
    │  Fin de Si
    Fin de Répéter
```

Le bloc « Répéter » ne peut pas s'interrompre : après « Terminer », les tours restants
passent dans le « Si » sans rien faire. 30 = nombre maximal de photos par session.

| # | Action | Réglage |
|---|--------|---------|
| 11 | **Répéter** | `30` fois |
| 12 | **Si** | entrée = variable `Termine` ; condition **est** ; valeur `non` |
| 13 | **Prendre une photo** | flèche › : « Afficher l'aperçu de l'appareil photo » **activé**, appareil **arrière** |
| 14 | **Définir le nom** | entrée = *Photo* ; nom = `Prefixe` `-` `Horodatage` `-` `Indice de répétition` (voir ci-dessous) ; « Ne pas inclure l'extension » **désactivé** |
| 15 | **Enregistrer le fichier** | entrée = *Fichier renommé* ; « Demander où enregistrer » **désactivé** ; destination = variable `Dossier` ; « Remplacer si le fichier existe » désactivé |
| 16 | **Définir la variable** | nom `Nombre`, entrée = *Indice de répétition* |
| 17 | **Choisir dans le menu** | invite `Suite ?` ; options `Encore une photo` et `Terminer` |
| 18 | **Texte** | contenu `oui` — glissé sous l'option **Terminer** |
| 19 | **Définir la variable** | nom `Termine`, entrée = *Texte* — sous **Terminer** |

**Composer le nom (action 14)** : tap dans le champ nom → barre au-dessus du clavier →
**Sélectionner une variable** → `Prefixe` ; taper `-` ; insérer `Horodatage` ; taper `-` ;
insérer **Indice de répétition** (proposé dans la liste des variables tant qu'on est dans
le « Répéter »). Résultat attendu : `salle-de-bain-2026-10-02-1430-1.jpg`.

**Destination (action 15)** : désactiver d'abord « Demander où enregistrer », puis tap
sur le champ dossier → **Sélectionner une variable** → `Dossier`. Si iOS n'accepte
qu'un dossier fixe : réactiver « Demander où enregistrer » — le sélecteur s'ouvrira à
chaque photo — ou choisir un dossier Drive fixe.

## 7. Notification finale

| # | Action | Réglage |
|---|--------|---------|
| 20 | **Afficher la notification** | titre `Photos vers Drive` ; corps `Nombre` + ` photo(s) enregistrée(s)` |

Placée **après** « Fin de Répéter ».

## 8. Accès rapide

| Déclencheur | Réglage | Disponibilité |
|-------------|---------|---------------|
| Bouton Action | Réglages → Bouton Action → Raccourci → `Photos vers Drive` | iPhone 15 Pro et suivants |
| Toucher le dos | Réglages → Accessibilité → Toucher → Toucher le dos → Toucher deux fois | tous les iPhone récents |
| Centre de contrôle / écran verrouillé | ajouter une commande « Raccourci » | iOS 18+ |
| Écran d'accueil | raccourci → Partager → « Sur l'écran d'accueil » | toujours |

## 9. Recette

- [ ] Lancement : le sélecteur propose les dossiers Drive.
- [ ] Sujet `Salle de bain` → fichiers préfixés `salle-de-bain-`.
- [ ] 3 photos puis « Terminer » → 3 fichiers `…-1`, `…-2`, `…-3` dans le dossier Drive.
- [ ] Notification « 3 photo(s) enregistrée(s) ».
- [ ] Aucune des 3 photos dans l'app Photos.
- [ ] Deuxième session une minute plus tard, même sujet → aucun fichier écrasé.
- [ ] Le déclencheur d'accès rapide lance le raccourci.

## Dépannage

| Symptôme | Cause probable | Correction |
|----------|----------------|------------|
| Sélecteur de fichiers au lieu de dossiers | option dossiers inactive (action 1) | l'activer, ou dossier fixe (§ 2) |
| Fichiers nommés `IMG_xxxx` | action 15 prend *Photo* au lieu de *Fichier renommé* | changer l'entrée de l'action 15 |
| Nom sans extension | « Ne pas inclure l'extension » activé (action 14) | le désactiver |
| Mois à la place des minutes | `mm`/`MM` inversés (action 7) | `yyyy-MM-dd-HHmm` |
| Une seule photo puis fin | actions 17–19 hors du « Si » ou du « Répéter » | les glisser dans le bloc |
| La boucle ne s'arrête jamais | action 19 hors de l'option « Terminer » | la glisser sous « Terminer » |
| Drive absent des destinations | Drive non activé dans Fichiers | prérequis § 0 |

Toute correction qui change le comportement se reporte dans `build.py`.

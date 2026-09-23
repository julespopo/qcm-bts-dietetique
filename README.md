# QCM BTS Diététique — V7.7

Application de révision modulaire en HTML / JavaScript conçue pour fonctionner :

- en ligne via GitHub Pages ;
- en local sans serveur ;
- sur ordinateur, tablette et téléphone ;
- avec des banques de questions JSON organisées par matière et par chapitre.

---

## 1. Structure du projet

```text
QCM_BTS_Dietetique_WEB_MODULAIRE_V7_3/
│
├── index.html
├── index_local.html
├── manifest.json
├── generer_manifest.py
├── README.md
│
└── banques/
    ├── BPADN/
    │   ├── 01_glucides.json
    │   ├── 02_lipides.json
    │   ├── 03_protides.json
    │   ├── 04_acides_nucleiques.json
    │   ├── 05_milieu_interieur.json
    │   └── 06_biologie_cellulaire.json
    │
    └── Sante_publique/
        ├── 01_concepts_sante.json
        ├── 02_determinants_sante.json
        ├── 03_mesure_etat_sante_population.json
        ├── 04_pnns.json
        ├── 05_gaspillage_alimentaire.json
        └── 06_situation_professionnelle_gaspillage.json
```

Le projet contient actuellement **12 banques** et environ **300 questions**.

---

## 2. Principe général

Le projet sépare complètement :

- le moteur du QCM : `index.html` ;
- les banques de questions : fichiers `.json` ;
- le catalogue des banques : `manifest.json`.

Cela permet d'ajouter progressivement des matières et des chapitres sans alourdir le fichier principal.

Chaque fichier JSON correspond à un chapitre ou à un thème.

---

## 3. Sélection des matières et chapitres

### Sur ordinateur

L'écran de sélection est divisé en deux parties :

- à gauche : les matières ;
- à droite : les chapitres de la matière active.

Une matière ou un chapitre sélectionné est indiqué par un **halo lumineux sobre**.

Il n'y a pas de bouton ON/OFF ni de coche sur les cartes.

Un clic sur une matière permet de sélectionner ou désélectionner rapidement ses chapitres.

Les chapitres restent également sélectionnables individuellement.

### Sur téléphone

Toucher une matière ouvre ses chapitres dans une **fenêtre flottante / bottom sheet**.

Cette fenêtre contient :

- la liste des chapitres ;
- un bouton unique `Tout sélectionner` / `Tout désélectionner` ;
- un bouton de fermeture.

Cela évite d'avoir à faire défiler la page entre les matières et les chapitres.

---

## 4. Menu flottant

L'interface de réglages ne repose plus sur une fenêtre ou un panneau.

À l'état neutre, un seul bouton flottant `☰` est visible.

Lorsqu'on le touche ou qu'on clique dessus, il se déploie en deux boutons flottants indépendants :

- `☾ / ☀` : bascule immédiatement entre le mode nuit et le mode jour ;
- `⏱` : active ou désactive le minuteur.

Aucun cadre ne contient ces boutons.

Lorsque le minuteur est activé, quatre petits boutons supplémentaires apparaissent autour de lui :

- `15`
- `30`
- `45`
- `60`

Ils correspondent au nombre de secondes maximum par question.

Le bouton principal reste déplaçable à la souris ou au doigt.

Lorsqu'il est amené près du bord gauche ou droit, il peut se ranger partiellement hors de l'écran : environ 30 % de l'icône restent visibles. Un clic sur cette partie visible ramène le bouton entièrement à l'écran puis ouvre automatiquement le menu radial.

## 5. Mode jour / nuit

Le changement de thème se trouve dans le menu `⚙ Réglages`.

Au premier lancement, le site suit automatiquement le thème clair ou sombre de l'appareil / navigateur.

Si l'utilisateur choisit manuellement un thème, ce choix est mémorisé dans le navigateur et devient prioritaire.

Le thème ne dépend pas de l'heure.

---

## 6. Minuteur par question

Le minuteur est **désactivé par défaut**.

Il s'active directement via l'icône `⏱` du menu flottant.

Lorsqu'il est activé, quatre durées sont disponibles :

- **15 secondes**
- **30 secondes**
- **45 secondes**
- **60 secondes**

Une seule durée est active à la fois.

Chaque nouvelle question repart avec le temps complet.

Si le temps arrive à zéro :

1. la question est automatiquement terminée ;
2. la correction s'affiche ;
3. la question est comptée comme incorrecte si la réponse n'était pas correcte ;
4. l'utilisateur passe ensuite manuellement à la question suivante.

La mise en pause conserve le temps restant de la question en cours.

## 7. Difficulté du questionnaire

Avant de lancer une session, l'utilisateur peut filtrer les questions par difficulté :

- **Tous niveaux**
- **Facile** — niveau 1
- **Intermédiaire** — niveau 2
- **Difficile** — niveau 3

Le nombre de questions disponibles est recalculé en fonction :

- des matières sélectionnées ;
- des chapitres sélectionnés ;
- du niveau choisi.

Le nombre demandé est automatiquement limité au nombre de questions réellement disponibles.

Les banques actuelles contiennent :

- 169 questions de niveau 1 ;
- 127 questions de niveau 2 ;
- 4 questions de niveau 3.

Cette répartition évoluera naturellement avec l'ajout de nouvelles banques.

## 8. Mode focus pendant le questionnaire

Lorsqu'une session commence, l'interface passe automatiquement en **mode focus** :

- le reste de la page est masqué ;
- sur téléphone, le nom du chapitre / de la banque est retiré pendant la session afin de libérer de la hauteur ;
- la carte du questionnaire est centrée dans la fenêtre ;
- la question et les propositions sont regroupées dans cette carte ;
- les boutons `Valider`, `Mettre en pause` et `Abandonner` restent accessibles grâce à une barre d'actions fixe en bas de la carte ;
- après validation, la vue se repositionne automatiquement pour rendre la correction visible.

Si le contenu d'une question dépasse la hauteur disponible, seul l'intérieur de la carte du quiz défile.

## 9. Réponses et navigation

Les réponses sont affichées **verticalement, une sous l'autre**, afin de limiter les mouvements des yeux et faciliter la lecture.

Les cartes de réponse sont volontairement assez grandes pour être confortables sur ordinateur comme sur mobile.

Les boutons radio et cases à cocher natifs sont masqués : **aucune coche ni aucun rond n'est affiché**. La sélection est indiquée uniquement par le halo de la carte choisie.

### Navigation clavier sur ordinateur

Pendant un questionnaire :

- `↑` / `↓` / `←` / `→` : naviguer entre les réponses ;
- `Espace` : sélectionner ou désélectionner la réponse active ;
- `Entrée` : valider la réponse ;
- après validation, `Entrée` : passer à la question suivante.

La première réponse reçoit automatiquement le focus à chaque nouvelle question.

---

## 10. Mobile et zoom

Sur téléphone :

- le double-tap zoom accidentel est neutralisé sur les contrôles ;
- le zoom à deux doigts reste disponible ;
- le scroll à un doigt reste disponible ;
- le bouton Réglages est déplaçable au doigt.

---

## 11. Pause et reprise

Une session en cours peut être sauvegardée automatiquement dans le navigateur.

La reprise conserve notamment :

- la question actuelle ;
- le score ;
- les erreurs ;
- les options choisies ;
- le temps restant si le minuteur est actif.

---

## 12. Utilisation en ligne avec GitHub Pages

Le fichier principal du site est :

```text
index.html
```

Le site lit automatiquement :

```text
manifest.json
```

puis charge uniquement les banques JSON nécessaires au questionnaire.

Pour publier une mise à jour avec GitHub Desktop :

```text
1. Modifier les fichiers dans le dossier local du dépôt
2. Ouvrir GitHub Desktop
3. Vérifier les changements
4. Commit to main
5. Push origin
```

GitHub Pages met ensuite le site à jour.

---

## 13. Utilisation locale sans serveur

Pour une utilisation locale, ouvrir :

```text
index_local.html
```

Puis sélectionner le dossier :

```text
banques/
```

Le navigateur lit récursivement les sous-dossiers et importe les banques JSON.

Cette version ne nécessite ni serveur local ni connexion internet.

---

## 14. Ajouter une nouvelle matière

Créer un nouveau dossier dans `banques`.

Exemple :

```text
banques/Alimentation_therapeutique/
```

Puis ajouter les banques JSON correspondantes :

```text
banques/Alimentation_therapeutique/01_diabete.json
banques/Alimentation_therapeutique/02_insuffisance_renale.json
```

Ensuite, depuis le dossier du projet :

```bash
python3 generer_manifest.py
```

Le script parcourt récursivement tous les sous-dossiers de `banques` et reconstruit automatiquement `manifest.json`.

Il faut ensuite envoyer sur GitHub :

- les nouveaux fichiers JSON ;
- le nouveau `manifest.json`.

Il n'est normalement pas nécessaire de modifier `index.html`.

---

## 15. Ajouter un nouveau chapitre

Exemple :

```text
banques/BPADN/07_enzymologie.json
```

Puis lancer :

```bash
python3 generer_manifest.py
```

et pousser les modifications sur GitHub.

---

## 16. Format d'une banque JSON

Chaque banque contient notamment :

```json
{
  "subject": "BPADN",
  "chapter": "Les glucides",
  "questions": [
    {
      "id": "exemple_001",
      "type": "single",
      "difficulty": "moyen",
      "prompt": "Question...",
      "choices": [
        {
          "text": "Réponse A",
          "correct": true
        },
        {
          "text": "Réponse B",
          "correct": false
        }
      ],
      "explanation": "Explication de la réponse."
    }
  ]
}
```

Types actuellement utilisés :

```text
single   → une seule bonne réponse
multiple → plusieurs bonnes réponses
```

---

## 17. Matières actuellement disponibles

### BPADN

- Glucides
- Lipides
- Protides
- Acides nucléiques
- Milieu intérieur
- Biologie cellulaire

### Santé publique

- Concepts de santé
- Déterminants de santé
- Mesure de l'état de santé d'une population
- PNNS
- Gaspillage alimentaire
- Situation professionnelle — gaspillage alimentaire

---

# Changelog

## V7.7

- Rafraîchissement visuel sobre de l'interface avant la V8.0.
- Ajout d'une illustration diététique discrète dans l'en-tête.
- Création d'icônes vectorielles maison pour :
  - Matières
  - Chapitres
  - Difficulté
  - Résultats
- Ajout d'accents graphiques légers sur certaines cartes.
- Le style reste volontairement épuré et non ostentatoire.
- Footer mis à jour : `Index V7.7`.

## V7.6.4

- Contraste renforcé entre les éléments sélectionnés et non sélectionnés en mode nuit.
- Le mode jour reste inchangé.
- Matières et chapitres sélectionnés :
  - fond violet plus visible ;
  - bordure plus lumineuse ;
  - halo renforcé.
- Difficulté sélectionnée plus identifiable en mode sombre.
- Réponses sélectionnées plus distinctes avant validation.
- Choix du timer et état actif du timer plus visibles.
- Les éléments non sélectionnés sont légèrement plus mats pour accentuer la différence.
- Footer mis à jour : `Index V7.6.4`.

## V7.6.3

- Ajout d'un graphique circulaire animé sur la page Résultats.
- Le pourcentage s'anime de 0 % jusqu'au score obtenu.
- La couleur de l'anneau s'adapte au score.
- Le bouton ⚙ peut désormais être rangé partiellement hors de l'écran :
  - environ 30 % restent visibles ;
  - un clic sur la partie visible le ramène entièrement dans l'écran ;
  - le menu radial s'ouvre automatiquement après son retour.
- La position rangée du bouton est mémorisée.
- Suppression de la ligne `300 questions disponibles • 2 matières • sélection par chapitres` sous le titre.
- Le footer affiche `Index V7.6.3`.

## V7.6.2

- Correction renforcée du bug `Temps écoulé`.
- La validation manuelle et l'expiration du timer utilisent désormais deux chemins séparés.
- Un intervalle de timer obsolète est automatiquement neutralisé si le timer est désactivé.
- Optimisation du mode Focus sur téléphone :
  - suppression du chapitre / de la banque pendant la question ;
  - marges et espacements réduits ;
  - réponses plus compactes ;
  - barre Valider / Pause / Abandonner compacte et toujours accessible ;
  - meilleure utilisation de la hauteur de l'écran.
- Renforcement du fond et du contraste des icônes du menu flottant et des choix 15 / 30 / 45 / 60 s.
- Le bas de la page affiche désormais uniquement la version réelle de l'index : `Index V7.6.2`.

## V7.6.1

- Correction d'un bug où un clic normal sur `Valider` pouvait afficher `Temps écoulé`.
- Le message `Temps écoulé` n'apparaît désormais que lorsque le timer atteint réellement zéro.
- Pour les questions à choix multiples, le nombre exact de bonnes réponses n'est plus révélé.
- Le texte affiche simplement : `Plusieurs réponses sont attendues.`

## V7.6

- Retour de l'icône `⚙` sur le bouton principal du menu flottant.
- Ajout d'un mode focus automatique pendant les questionnaires.
- Questionnaire centré dans la fenêtre.
- Barre d'actions du quiz maintenue accessible en bas de la carte.
- Recentrage automatique vers la correction après validation.
- Ajout du filtre de difficulté :
  - Tous niveaux
  - Facile
  - Intermédiaire
  - Difficile
- Recalcul dynamique du nombre de questions disponibles selon la difficulté.
- Affichage des libellés de difficulté dans les questions au lieu des valeurs numériques.

## V7.5

- Remplacement de la fenêtre Réglages par un menu flottant sans panneau.
- État neutre : seule l'icône `☰` est visible.
- Un clic sur `☰` déploie deux icônes indépendantes :
  - Jour / Nuit ;
  - Timer.
- Jour / Nuit bascule immédiatement sans ouvrir de sous-menu.
- Le bouton Timer active / désactive directement le minuteur.
- Lorsque le timer est actif, les choix 15 / 30 / 45 / 60 s apparaissent comme de petits boutons flottants.
- Aucun cadre ou fond commun autour des icônes déployées.
- Déplacement et aimantation du bouton principal conservés.

## V7.4

- Suppression des coches / ronds visibles dans les réponses.
- Sélection des réponses indiquée uniquement par un halo.
- Menu Réglages simplifié.
- Mode jour / nuit représenté uniquement par son icône.
- Timer activable / désactivable sans checkbox visible.
- Remplacement du champ numérique du timer par quatre durées fixes :
  - 15 s
  - 30 s
  - 45 s
  - 60 s
- Timer toujours désactivé par défaut.

## V7.3

- Nouveau menu `⚙ Réglages` flottant.
- Mode jour / nuit déplacé dans le menu Réglages.
- Minuteur optionnel par question.
- Minuteur désactivé par défaut.
- Durée réglable de 15 à 300 secondes.
- Retour des réponses en disposition verticale.
- Conservation de la navigation clavier.
- Conservation du bottom sheet mobile pour les chapitres.
- Bouton Réglages déplaçable et aimanté au coin le plus proche.
- Double-tap zoom neutralisé sur les contrôles.
- Pinch-to-zoom conservé.

## V7.2

- Navigation clavier améliorée.
- Agrandissement du bouton flottant.
- Ajout d'une marge avec les bords.
- Première version du minuteur.
- Agrandissement des cartes de réponse.

## V7.1

- Aimantation automatique du bouton flottant au coin le plus proche.
- Amélioration du comportement tactile.
- Réduction des zooms accidentels sur iPhone.

## V7

- Bottom sheet des chapitres sur téléphone.
- Interface différente automatiquement entre desktop et mobile.
- Bouton unique `Tout sélectionner / Tout désélectionner`.
- Amélioration du déplacement tactile du bouton flottant.

---

## Objectif du projet

Construire progressivement une plateforme de révision BTS Diététique simple à maintenir, utilisable toute l'année et partageable avec d'autres étudiants, sans avoir à reconstruire l'application à chaque nouveau cours.


## Assets visuels

Le projet contient désormais un dossier `assets/` avec des illustrations et icônes SVG légères, créées spécialement pour l'interface.

```text
assets/
├── icons/
│   ├── matieres.svg
│   ├── chapitres.svg
│   ├── difficulte.svg
│   └── resultats.svg
└── illustrations/
    └── hero-dietetique.svg
```

Ces fichiers sont libres à utiliser dans le projet et ne nécessitent aucune dépendance externe.

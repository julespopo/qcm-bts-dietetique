# QCM BTS Diététique — V7.3

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

## 4. Réglages flottants

Le bouton flottant `⚙` ouvre le menu des réglages rapides.

Il peut être déplacé :

- à la souris sur ordinateur ;
- au doigt sur téléphone.

Quand il est relâché, il s'aimante automatiquement vers le **coin de l'écran le plus proche** avec une animation fluide.

Une marge est conservée avec les bords afin que le bouton reste facile à attraper.

Sa position est mémorisée dans le navigateur.

---

## 5. Mode jour / nuit

Le changement de thème se trouve dans le menu `⚙ Réglages`.

Au premier lancement, le site suit automatiquement le thème clair ou sombre de l'appareil / navigateur.

Si l'utilisateur choisit manuellement un thème, ce choix est mémorisé dans le navigateur et devient prioritaire.

Le thème ne dépend pas de l'heure.

---

## 6. Minuteur par question

Le minuteur est **désactivé par défaut**.

Il peut être activé depuis le menu `⚙ Réglages`.

L'utilisateur choisit un temps maximum par question :

- minimum : **15 secondes** ;
- maximum : **300 secondes** ;
- valeur proposée : **30 secondes**.

Chaque nouvelle question repart avec le temps complet.

Si le temps arrive à zéro :

1. la question est automatiquement terminée ;
2. elle est comptée comme incorrecte si elle n'était pas correctement répondue ;
3. la correction s'affiche ;
4. l'utilisateur passe ensuite manuellement à la question suivante.

La mise en pause conserve le temps restant de la question en cours.

---

## 7. Réponses et navigation

Les réponses sont affichées **verticalement, une sous l'autre**, afin de limiter les mouvements des yeux et faciliter la lecture.

Les cartes de réponse sont volontairement assez grandes pour être confortables sur ordinateur comme sur mobile.

### Navigation clavier sur ordinateur

Pendant un questionnaire :

- `↑` / `↓` / `←` / `→` : naviguer entre les réponses ;
- `Espace` : sélectionner ou désélectionner la réponse active ;
- `Entrée` : valider la réponse ;
- après validation, `Entrée` : passer à la question suivante.

La première réponse reçoit automatiquement le focus à chaque nouvelle question.

---

## 8. Mobile et zoom

Sur téléphone :

- le double-tap zoom accidentel est neutralisé sur les contrôles ;
- le zoom à deux doigts reste disponible ;
- le scroll à un doigt reste disponible ;
- le bouton Réglages est déplaçable au doigt.

---

## 9. Pause et reprise

Une session en cours peut être sauvegardée automatiquement dans le navigateur.

La reprise conserve notamment :

- la question actuelle ;
- le score ;
- les erreurs ;
- les options choisies ;
- le temps restant si le minuteur est actif.

---

## 10. Utilisation en ligne avec GitHub Pages

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

## 11. Utilisation locale sans serveur

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

## 12. Ajouter une nouvelle matière

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

## 13. Ajouter un nouveau chapitre

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

## 14. Format d'une banque JSON

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

## 15. Matières actuellement disponibles

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

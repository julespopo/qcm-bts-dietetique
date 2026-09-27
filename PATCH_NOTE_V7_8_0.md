### Patch Note — V7.8.0

- **Nouveau mode de révision**
  - choix entre QCM classique et flashcards Vrai/Faux ;
  - le mode choisi réutilise les mêmes matières, chapitres et niveaux de difficulté.

- **Flashcards façon swipe**
  - gauche = Faux ;
  - droite = Vrai ;
  - boutons Faux / Vrai disponibles ;
  - flèches clavier gauche / droite sur ordinateur ;
  - animation de carte pendant le geste.

- **Réutilisation des banques existantes**
  - aucune deuxième base de données à maintenir ;
  - une proposition est tirée dans chaque question pour produire une carte Vrai/Faux ;
  - alternance autant que possible entre propositions vraies et fausses.

- **Correction et suivi**
  - passage automatique à la carte suivante après la réponse (environ 0,85 s), sans bouton « Suivant » ;
  - grand ✓ vert en cas de réussite et grande ✕ rouge en cas d’erreur pendant la transition ;
  - effet de choc avec rebond / secousse sur le feedback ;
  - la carte suivante arrive en glissant depuis la droite.
  - correction immédiate ;
  - explication de la question conservée ;
  - score, progression, timer, pause/reprise et revoir les erreurs restent compatibles.

- **Entretien du dépôt**
  - Chapitre 0 BPADN passé en version 3 ;
  - README mis à jour à 13 banques / 330 questions ;
  - ajout de .gitignore ;
  - suppression des fichiers .DS_Store.

- **Version**
  - footer : Index V7.8.0.


- **Banques BPADN recréées**
  - 7 chapitres reconstruits à partir des documents de cours fournis ;
  - 30 questions par chapitre, soit 210 questions BPADN ;
  - noms uniformisés au format `Chapitre X — Nom du chapitre` ;
  - fichiers renumérotés pour correspondre aux vrais chapitres 6, 7 et 8 ;
  - manifest synchronisé.


- **Flashcards épurées**
  - la carte affiche désormais l’affirmation seule, centrée ;
  - suppression du libellé « Cette proposition est-elle vraie ? » et de la question source sur la carte ;
  - en révision des erreurs, l’explication est affichée avant de pouvoir passer à l’erreur suivante ;
  - hors révision, le passage automatique après le ✓ / ✕ est conservé.


- **Flashcards : propositions autonomes**
  - une réponse isolée n'est plus affichée seule ;
  - chaque carte reformule désormais la question et la réponse proposée en une affirmation complète ;
  - exemple : « La réponse correcte à la question “Quelle hormone régule le rythme de production des globules rouges ?” est : l’érythropoïétine (EPO). » ;
  - les anciennes sauvegardes de sessions flashcards sont converties automatiquement au nouveau format lors de la reprise.


- **Flashcards : format compact contextuel**
  - suppression du long préfixe « La réponse correcte à la question… » ;
  - si la réponse constitue déjà une affirmation complète, elle est affichée seule ;
  - sinon, la carte affiche un contexte court + la proposition ;
  - taille du texte adaptée automatiquement aux cartes plus longues.

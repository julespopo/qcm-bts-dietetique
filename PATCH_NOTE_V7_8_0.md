### Patch Note — V7.8.0

- **Nouveau mode de révision**
  - choix entre QCM classique et flashcards ;
  - les deux modes utilisent les mêmes matières, chapitres et niveaux de difficulté.

- **Flashcards Vrai / Faux**
  - chaque carte affiche une **question** et, juste dessous, une **réponse proposée** ;
  - seules les **questions à réponse unique** alimentent ce mode ; les QCM à réponses multiples sont exclus du Vrai/Faux mais restent inchangés dans le mode QCM ;
  - l’utilisateur doit juger si cette réponse est vraie ou fausse ;
  - swipe gauche = **Faux** ;
  - swipe droite = **Vrai** ;
  - boutons **Faux / Vrai** disponibles sans geste ;
  - clavier : flèche gauche = Faux, flèche droite = Vrai ;
  - pour les questions à réponses multiples, les cartes vraies montrent l’ensemble exact des bonnes réponses et les cartes fausses une combinaison altérée.

- **Animations**
  - grand ✓ vert pour **Je savais** ;
  - grande ✕ rouge pour **À revoir** ;
  - effet d’impact avec rebond / secousse ;
  - la carte suivante arrive en glissant depuis la droite ;
  - passage automatique après l’auto-évaluation pendant une série normale.

- **Révision des erreurs**
  - les réponses Vrai/Faux incorrectes sont conservées comme erreurs ;
  - lors de **Revoir mes erreurs**, l’explication du cours est affichée après la réponse ;
  - le passage à l’erreur suivante est alors manuel afin de laisser le temps de lire l’explication.

- **Minuteur**
  - le minuteur reste compatible avec les flashcards ;
  - à expiration, la carte est comptée comme incorrecte.

- **Banques BPADN**
  - 7 chapitres reconstruits à partir des documents de cours fournis ;
  - 30 questions par chapitre, soit 210 questions BPADN ;
  - intitulés uniformisés au format `Chapitre X — Nom du chapitre` ;
  - fichiers renumérotés pour correspondre aux chapitres 6, 7 et 8 ;
  - manifest synchronisé.

- **Entretien du dépôt**
  - 13 banques / 330 questions ;
  - banques BPADN en version 3 ;
  - ajout de `.gitignore` ;
  - suppression des fichiers macOS parasites `.DS_Store`.

- **Version**
  - footer : `Index V7.8.0`.


- **Coloration des réponses QCM**
  - après validation, seules les réponses sélectionnées changent de couleur ;
  - réponse globale correcte : sélection(s) en vert ;
  - réponse globale incorrecte : sélection(s) en rouge ;
  - légère animation d’impact au moment de la validation ;
  - les réponses non sélectionnées restent neutres.

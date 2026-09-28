# Patch note — V7.8.3

## Vrai/Faux : explications optionnelles

- Une popup s’affiche avant de lancer une session Vrai/Faux.
- **Oui, afficher** : les corrections restent dans la carte. Une bonne réponse affiche l’explication seule pendant 7 secondes puis passe automatiquement à la suivante ; une erreur affiche « Réponse incorrecte », la vérité attendue et l’explication jusqu’à validation.
- **Non, enchaîner** : le fonctionnement rapide reste identique à V7.8.2, avec passage automatique après l’animation.
- L’action **💡 Explications** est intégrée au menu flottant et permet de modifier ce choix pendant une session.
- Le choix est inclus dans la sauvegarde locale pour les pauses/reprises.
- Le comportement est identique dans `index.html` et `index_local.html`.
- Les contrôles automatisés ont été étendus pour couvrir la popup et les changements de mode en cours de session.

- Bonne réponse + explications activées : la question et la proposition disparaissent ; seule l’explication reste dans la carte pendant 7 secondes, avec un petit chronomètre circulaire en haut à droite qui se vide, puis la carte suivante s’affiche automatiquement. **Entrée** permet d’avancer immédiatement et **Espace** met la session en pause.

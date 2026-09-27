# Patch note — V7.8.2

Cette version est consacrée à la robustesse, à l’ergonomie et aux tests de non-régression.

## Corrections

- correction du warning `aria-hidden` / focus du menu flottant ;
- utilisation de `inert` pour empêcher le focus sur les contrôles réellement masqués ;
- bottom sheet mobile rendu réellement modal, sans rendre le dialogue lui-même inerte ;
- restauration du focus au bon endroit après fermeture du bottom sheet ;
- correction du chemin d’erreur de chargement du manifest ;
- correction d’un crash potentiel de `index_local.html` lié à l’ancien `heroText` ;
- bouton de continuation de nouveau accessible sur mobile pendant la revue des erreurs Vrai/Faux ;
- les raccourcis clavier du QCM n’interceptent plus les boutons Pause, Abandonner, Timer, etc. ;
- les erreurs de `localStorage` ne font plus planter la session ;
- la reprise web refuse maintenant une sauvegarde partiellement incompatible plutôt que de décaler silencieusement les questions ;
- résultat Vrai/Faux annoncé via une zone `aria-live` ;
- barre de progression exposée comme `progressbar` accessible ;
- ajout d’un mode compact pour les écrans de faible hauteur ;
- alignement visuel du thème entre `index.html` et `index_local.html` ;
- suppression du code JavaScript devenu inutilisé ;
- ajout d’une favicon explicite ;
- suppression des fichiers système macOS suivis par erreur.

## Tests automatisés

Ajout de `tests/check_project.py` et d’un workflow GitHub Actions qui vérifient :

- le schéma de toutes les banques JSON ;
- l’unicité des identifiants ;
- la cohérence manifest / banques ;
- la logique de score QCM ;
- la compatibilité du mode Vrai/Faux ;
- la génération répétée des propositions Vrai/Faux ;
- la syntaxe JavaScript ;
- les ressources HTML, attributs essentiels et plusieurs invariants d’accessibilité.

Ajout de `tests/browser_smoke.py` avec Chrome/Selenium. Le test exécute réellement l’application et couvre notamment :

- QCM desktop, bonne réponse et réponse multiple partiellement fausse ;
- couleurs correctes / incorrectes / réponses oubliées ;
- pause puis reprise ;
- déplacement de la carte Vrai/Faux **avant le relâchement du pointeur** ;
- avance automatique des cartes ;
- menu flottant, Échap, focus et `inert` ;
- bottom sheet mobile et restauration du focus ;
- occupation de l’écran mobile et taille des boutons ;
- cohérence visuelle Pause / Abandonner ;
- erreur Vrai/Faux volontaire puis revue de l’erreur sur mobile ;
- absence de régression critique dans la console navigateur.

Au dernier passage complet : **13 banques, 330 questions, 1 657 cas de logique QCM et 41 600 générations Vrai/Faux** validés, plus les parcours navigateur desktop/mobile.

# Patch note — V7.8.2

Cette version est consacrée à la robustesse du projet.

- correction du focus et de `aria-hidden` dans le menu flottant ;
- utilisation de `inert` pour empêcher le focus sur les contrôles masqués ;
- correction du chemin d'erreur de chargement du manifest ;
- ajout d'une favicon explicite ;
- suppression des fichiers système macOS suivis par erreur ;
- ajout d'une suite de vérifications automatisées :
  - schéma des banques ;
  - unicité des identifiants ;
  - cohérence manifest / banques ;
  - logique de score QCM ;
  - compatibilité du mode Vrai/Faux ;
  - stress test de génération des propositions Vrai/Faux ;
  - présence des ressources et attributs HTML essentiels ;
  - syntaxe JavaScript avec Node.js ;
- ajout d'un workflow GitHub Actions exécutant ces contrôles sur les PR et sur `main`.

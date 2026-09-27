### Patch Note — V7.8.1

- **Swipe Vrai/Faux plus physique**
  - dès l'appui, la carte se **décolle** visuellement de la pile ;
  - la carte suit réellement le doigt ou la souris pendant le geste avec un léger retard physique ;
  - un ressort amorti ajoute de l'inertie pendant le déplacement et lors des changements brusques de direction ;
  - légère translation verticale et rotation selon le point où la carte est saisie ;
  - la pile située derrière remonte progressivement pendant le drag ;
  - au-delà du seuil, la carte se décroche et est projetée hors de l’écran avec inertie ;
  - un geste rapide peut lancer la carte même si la distance parcourue est plus courte ;
  - si le seuil n’est pas atteint, la carte revient en place avec un léger effet ressort.

- **Contrôles conservés**
  - gauche = Faux ;
  - droite = Vrai ;
  - les boutons et les flèches clavier déclenchent eux aussi l’animation de projection ;
  - le ✓ / ✕, l’impact visuel et l’arrivée glissée de la carte suivante restent actifs.

- **Ergonomie**
  - le défilement vertical mobile reste possible ;
  - le swipe horizontal est détecté séparément afin d’éviter les déclenchements accidentels ;
  - `prefers-reduced-motion` reste respecté avec des animations raccourcies.


- **Plein écran mobile**
  - le mode Vrai/Faux utilise désormais toute la hauteur disponible ;
  - la carte prend la majorité de l'espace tout en laissant des contrôles confortables ;
  - les boutons Faux / Vrai sont plus grands ;
  - Mettre en pause / Abandonner sont recentrés sur deux colonnes et agrandis.

- **Statistiques en direct**
  - le score est affiché sur le nombre de questions déjà répondues, par exemple `7 / 11` ;
  - le nombre de questions restantes est affiché juste à côté ;
  - la barre de progression se met à jour dès la validation.

- **Correctif du drag**
  - l'animation d'arrivée de la carte est annulée dès qu'on la saisit afin qu'elle puisse réellement suivre le doigt ou la souris avant le relâchement ;
  - la carte se soulève dès l'appui et le navigateur ne capture plus le geste horizontal de la carte.

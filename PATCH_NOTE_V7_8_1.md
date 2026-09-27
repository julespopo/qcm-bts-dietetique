### Patch Note — V7.8.1

- **Swipe Vrai/Faux plus physique**
  - la carte suit réellement le doigt ou la souris pendant le geste ;
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

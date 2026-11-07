# Revue générale du 7 novembre 2026

Base examinée : `417af8b3ca13e0cf00c92d89ddad5ffdfb10779f` (`main`).
Périmètre : architecture, deux pages, 22 banques / 776 questions, manifest,
QCM, Vrai/Faux, pause et reprise, thèmes, desktop/mobile, clavier, stockage et CI.
Aucun contenu pédagogique n'a été modifié.

## Constats corrigés

| Problème confirmé | Conséquence | Correction et couverture |
| --- | --- | --- |
| Même clé localStorage pour deux formats de sauvegarde incompatibles | Une session locale et une session web ouvertes sur la même origine pouvaient s'écraser | Clé locale distincte, lecture et migration des anciennes sauvegardes locales ; tests JS et navigateur |
| Toute erreur de reprise web effaçait la sauvegarde | Une simple panne réseau faisait perdre la progression | Conservation de la sauvegarde, message explicite, état de session affecté seulement après chargement complet ; simulation réseau et reprise réelle |
| Indices, scores et éléments de sauvegarde très peu contrôlés | JSON valide mais incohérent accepté, score impossible ou exception au rendu | Validation des bornes et types, cohérence score/erreurs/progression, contrôle des références et questions locales ; tests JS sur valeurs corrompues |
| Proposition Vrai/Faux restaurée sans vérifier son adéquation à la banque | Après modification d'une banque, ancienne proposition et vérité pouvaient être incohérentes | Vérification de la proposition sauvegardée et de sa vérité avant restauration |
| Boutons de révision des thèmes locaux actifs après réouverture, sans les banques en mémoire | Action impossible : les sauvegardes ne contiennent que les questions de la série, pas les banques complètes | Boutons désactivés et invitation à recharger le dossier ; « Revoir mes erreurs » reste utilisable avec la sauvegarde seule |
| Chargeur de dossier local non masqué en mode quiz | Largeur du quiz réduite, particulièrement sur mobile | Masquage en mode quiz et mesure de largeur en test navigateur |
| Imports acceptés dès que `questions` était une liste | Une question `null`, sans choix ou sans bonne réponse pouvait casser le quiz | Validation structurelle des questions, choix, bonnes réponses et IDs dupliqués avant mise en cache ; rejet des imports invalides |
| Manifest web contrôlé uniquement comme liste | Métadonnées malformées et doublons pouvaient casser les sélections | Contrôle des champs essentiels, fichiers locaux et unicité des IDs/fichiers |
| Focus perdu au remplacement des boutons de sélection | Navigation clavier interrompue ; dialogue de préférences sans boucle Tab | Restauration du focus et boucle Tab/Shift+Tab dans les deux dialogues ; tests clavier |
| Sélecteur de dossier en `display:none` | Import local inaccessible au clavier | Contrôle natif visible et associé à son libellé |
| Interception globale des doubles taps/clics | Gestes natifs et double activation pouvaient être annulés sur toute la page | Suppression de cette interception ; conservation de `touch-action:manipulation` existant sur les contrôles |
| Sauvegarde automatique uniquement par `beforeunload` | Couverture insuffisante du passage en arrière-plan sur mobile | Ajout de `pagehide` et de `visibilitychange` |
| Thème sans `color-scheme`, valeur stockée arbitraire acceptée | Contrôles natifs mal assortis en mode nuit, préférence invalide bloquant le suivi système | Synchronisation des contrôles natifs et validation de la préférence |
| CI régénérant le manifest avant de le vérifier | Une PR oubliant le manifest pouvait être verte | Mode `--check` sans écriture ; vérification du fichier réellement committé |
| Générateur changeant la date à chaque exécution | Diffs quotidiens sans changement de banques | Date conservée si les métadonnées sont identiques |
| Test local retirant `webkitdirectory` et utilisant HTTP | Perte des chemins de sous-dossiers ; plusieurs noms identiques écrasés dans le cache de test | Véritable import du dossier et exécution de la version locale en `file://` |

## Nettoyage complémentaire

Le suivi de cette revue remplace les deux moteurs copiés par une source commune :
`src/app.js`, `src/styles.css`, `src/page.html` et le petit chargeur local. Le script
`scripts/build.py` produit les deux pages autonomes ; `--check` garantit qu'elles
correspondent aux sources committées. L'ouverture locale ne dépend d'aucun import
JavaScript réseau. Une fabrique d'application sépare l'initialisation du montage
DOM ; les tests chargent le fichier complet sans découpage textuel.

Le minuteur de réponse, ses propriétés d'état et de sauvegarde, les expirations
associées et l'ancien menu radial vide ont été supprimés. Le bouton de thème reste
déplaçable ; le délai de lecture Vrai/Faux de sept secondes conserve son propre
cycle de pause/reprise. Les anciennes sauvegardes contenant des champs de minuteur
restent lisibles ; ces champs n'ont plus d'effet et ne sont plus écrits.

Les accès simultanés à une banque web partagent maintenant la même requête.
Une requête échouée est retirée du cache des requêtes en cours pour permettre
une nouvelle tentative. Les tests couvrent la mutualisation et cette récupération.

Les contrôles sur des fragments exacts de CSS/JS, un numéro de footer et la
reproduction du score en Python ont été retirés. Les contrats HTML sont vérifiés
avec un parseur ; le JavaScript réel est testé pour les combinaisons exactes et
chaque inversion de choix des 776 questions, les propositions Vrai/Faux des 603
questions éligibles, les sauvegardes, références disparues et migrations. Une
horloge simulée vérifie le gel et la reprise du décompte sans attendre plusieurs
secondes. La suite Selenium utilise de vrais clics sur les contrôles et leurs
libellés, attend les animations et observe les changements d'état. Le geste de
test non validant reste sous le seuil de validation même avec une vitesse élevée.

Les versions Node de test sont verrouillées par `package-lock.json` et Selenium
par `requirements-tests.txt`. La CI est en lecture seule pour le contenu ; le
workflow qui committait le manifest directement dans main a été retiré. Sources,
pages et manifest doivent appartenir à la même PR. Les exécutions obsolètes d'une
même branche sont annulées par un groupe de concurrence.

### Défauts supplémentaires trouvés par les nouveaux contrôles

- Le texte atténué sur fond clair et les boutons principaux sur fond violet en
  thème nuit avaient un contraste insuffisant. Les couleurs de texte et de survol
  ont été ajustées ; les contrôles axe sont exécutés sans exclusion de règle.
- La fermeture du dialogue des chapitres remettait tous les éléments de fond à
  `inert=false`, y compris la popup d'explications encore masquée. Les états inert
  antérieurs sont désormais mémorisés puis restaurés ; une régression dédiée
  et axe vérifient ce parcours mobile.
- Le bouton de thème recouvrait une partie d'Abandonner sur petit écran. Sa position
  par défaut en cours de quiz est maintenant en haut, avec un espace réservé dans
  l'en-tête ; les positions choisies manuellement restent prioritaires. Un contrôle
  géométrique interdit le chevauchement des actions principales.
- Une variable CSS `--accent-soft` n'existait pas ; l'icône d'explications utilise
  désormais la couleur partagée `--soft`.
- La préférence de réduction des animations est étendue aux dialogues, au placement
  du thème et au défilement. Le décompte textuel conserve sa durée normale.

Le README a été réécrit autour du fonctionnement actuel ; ses anciens exemples
de minuteur, menu radial et nombres de banques obsolètes ont été retirés.
Aucun fichier des banques ni son contenu pédagogique n'a été changé.

## Validation et limites

```sh
python3 scripts/build.py --check
python3 tests/test_build.py
python3 generer_manifest.py --check
python3 tests/test_manifest.py
python3 tests/check_project.py
node tests/runtime.mjs
# Serveur dans un autre terminal : python3 -m http.server 8000 --bind 127.0.0.1
python3 tests/browser_smoke.py
npm run test:browsers
```

La matrice Playwright couvre Chromium, Firefox et WebKit, chacun en tailles
1280 × 900 et 390 × 844, avec des parcours QCM, reprise après rechargement,
Vrai/Faux, explications, pause, clavier, thèmes et résultats. Chaque moteur
vérifie aussi un import réel du dossier et une reprise locale en `file://`.
Le contrôle axe WCAG A/AA est exécuté sur la configuration jour, la sélection
nuit, le QCM nuit, les résultats, le dialogue, la carte et sa correction, ainsi
que le chargeur local. Les captures desktop/mobile sont conservées en CI.
Selenium garde la couverture détaillée des gestes et révisions ciblées/globales.

Les tests de comportement ne constituent pas une validation scientifique des
banques. Neuf prompts génériques/répétés sont signalés sans modification pédagogique.
Les sauvegardes restent propres au navigateur, à l'appareil et à l'origine.

Safari natif a été essayé via safaridriver, mais la session a expiré lors de la
connexion à Safari sur cette machine. Les parcours WebKit ont été vérifiés ; ils
ne prouvent pas un essai dans Safari natif ou sur iPhone physique. Aucun lecteur
d'écran réel (VoiceOver/NVDA) ni appareil Android physique n'a été piloté. Les
règles axe, le focus clavier et les noms accessibles complètent la couverture,
sans remplacer une écoute et une navigation humaines. La fermeture forcée par
l'OS et le stockage effacé par le navigateur restent hors du contrôle de l'app.

Références des outils : [Playwright](https://playwright.dev/docs/intro),
[axe-core](https://github.com/dequelabs/axe-core).

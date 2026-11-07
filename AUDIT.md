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

## Architecture et dette restante

L'application est un site statique sans backend ni dépendance JS de production.
Le manifest décrit les banques chargées à la demande ; la version locale utilise
un import de fichiers et un cache mémoire. Les textes des questions et choix
sont insérés par `textContent` ou échappés avant insertion HTML. Les banques
versionnées passent les contrôles structurels : 603 questions à réponse unique,
173 à réponses multiples. Neuf prompts génériques ou répétés sont signalés par
le contrôle existant, sans présumer d'une erreur pédagogique.

Les deux pages contiennent chacune environ 3 200 lignes de HTML/CSS/JS avec
beaucoup de code dupliqué. Les différences de persistance sont intentionnelles :
références légères côté web, questions complètes pour reprendre hors ligne côté
local. Une future génération des deux pages depuis une source commune réduirait
les divergences. Cette revue évite une réécriture générale ; les nouveaux contrats
de validation partagés sont comparés automatiquement entre les deux pages.

Le minuteur et une partie de l'ancien menu flottant restent dans le code alors
que leur interface a été retirée. Leur suppression mérite un changement séparé,
car ils sont encore reliés à la pause, aux timers d'explication et aux sauvegardes.
Le cache web ne mutualise pas les requêtes simultanées sur une même banque ; les
compteurs utilisent toutefois un identifiant de requête pour ignorer les résultats
périmés. Ce point représente surtout une dette de performance.

`tests/check_project.py` contient de nombreux contrôles sur des chaînes exactes
de CSS/JS et une version précise de footer : une reformulation ou un formatage
inoffensif peut les faire échouer. Ses tests de score et de hasard reproduisent
les règles en Python ; ils ne prouvent pas seuls le comportement du JavaScript.
Le nouveau test `runtime.mjs` exécute les fonctions de production des deux pages,
notamment le score QCM pour les 776 questions, les combinaisons exactes et chaque
inversion d'un choix, ainsi que la génération Vrai/Faux des 603 questions éligibles.
Les tests Selenium gardent des attentes de dimensions et quelques délais liés aux
animations : utiles pour les régressions visuelles, mais sensibles aux différences
de navigateur. Ils utilisent souvent des clics JS ; les nouveaux contrôles clavier
complètent cette couverture sans remplacer un audit manuel avec lecteur d'écran.

La CI installe Selenium sans verrouillage de version ; cela peut faire évoluer
le comportement des tests indépendamment du dépôt. Le workflow de manifest reste
autorisé à committer directement sur `main` et ne sérialise pas ses exécutions :
deux modifications rapprochées peuvent provoquer un conflit de push. Les PR doivent
désormais inclure leur manifest à jour, ce qui réduit le besoin de cette réparation
automatique sans changer le workflow de publication existant.

## Validation et limites

Commandes de contrôle :

```sh
python3 generer_manifest.py --check
python3 tests/test_manifest.py
python3 tests/check_project.py
node tests/runtime.mjs
# Dans un autre terminal : python3 -m http.server 8000 --bind 127.0.0.1
python3 tests/browser_smoke.py
```

Les parcours couvrent score simple/multiple, corrections, revue ciblée/globale,
Vrai/Faux avec et sans explications, décompte et pause, reprise après rechargement,
panne réseau, thèmes, dialogues clavier, affichages desktop/mobile et import local
réel. Le navigateur local utilisé est Chrome ; l'émulation de taille ne remplace
pas des essais sur Safari/iOS, Android physique ou avec lecteur d'écran. Le comportement
réel d'une fermeture forcée par l'OS reste dépendant du navigateur. Les sauvegardes
restent locales à l'appareil et à l'origine ; elles ne constituent pas une synchronisation.

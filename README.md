# QCM BTS Diététique

Application statique de révision : **23 banques, 886 questions**, regroupées par
matière, chapitre et difficulté. Aucun compte ni serveur de données n'est nécessaire.

## Utiliser l'application

- **En ligne** : [ouvrir le site](https://julespopo.github.io/qcm-bts-dietetique/).
- **Hors ligne** : conserver `index_local.html`, le dossier `banques/`, les images
  `assets/` et `favicon.svg`. Ouvrir `index_local.html` par double-clic puis choisir
  le dossier `banques`. Les sous-dossiers sont importés automatiquement.
- **Tester la version web sur sa machine** : lancer `python3 -m http.server 8000`
  depuis le dépôt puis ouvrir [localhost:8000](http://localhost:8000).

Sur ordinateur, cliquer sur une matière sélectionne ou désélectionne ses chapitres.
Sur mobile, cela ouvre un dialogue permettant de choisir les chapitres. Filtrer
ensuite la difficulté et choisir le nombre de questions.

### QCM et Vrai/Faux

Le QCM demande la combinaison exacte des bonnes réponses, sans crédit partiel.
Les questions à plusieurs réponses sont signalées. Après validation, les réponses
correctes, incorrectes et oubliées sont distinguées et la correction est affichée.

Le mode Vrai/Faux utilise uniquement les questions à réponse unique. Il présente
une question et une proposition à juger avec les boutons **Faux / Vrai**, un
balayage horizontal ou les flèches gauche/droite au clavier.

La popup de départ et l'icône **💡** permettent de choisir les explications :

- avec explications, une bonne réponse affiche la correction pendant **7 secondes**
  avant de continuer ; une erreur attend une action sur « Question suivante » ;
- sans explications, la carte suivante arrive après l'animation du résultat ;
- en révision des erreurs, la correction reste toujours visible jusqu'à validation.

Il n'y a pas de limite de temps pour répondre. Le décompte de 7 secondes concerne
uniquement la lecture d'une explication après une bonne réponse.

### Clavier, thème et pause

En QCM, les flèches déplacent le focus entre les choix, Espace sélectionne une
réponse et Entrée valide ou continue. En Vrai/Faux, les flèches répondent, Espace
met en pause/reprend et Entrée passe une explication déjà affichée. Les raccourcis
ne détournent pas les boutons ou champs de saisie. Tab reste dans les dialogues ;
Échap ferme le dialogue de sélection ou de préférences.

Le bouton flottant **☀ / ☾** change le thème. Il reste déplaçable et peut se ranger
partiellement sur le bord de l'écran. Le thème de l'appareil s'applique au premier
lancement ; un choix manuel est mémorisé. La préférence de réduction des animations
est respectée.

« Mettre en pause » sauvegarde un QCM et revient à la sélection. En Vrai/Faux, la
pause reste sur la carte et fige aussi le décompte d'explication. Les réponses
validées sont enregistrées ; une reprise après fermeture continue à la prochaine
question non répondue. Une correction en cours de lecture n'est pas rejouée après
fermeture de la page.

Les sauvegardes restent dans le navigateur, sur cet appareil et cette origine.
Les formats web/local sont séparés ; les anciennes sauvegardes locales sont
migrées lors de leur prochaine écriture. Les anciennes propriétés du minuteur
sont ignorées sans invalider la progression. Un échec réseau de reprise conserve
la sauvegarde. En local, la série sauvegardée et « Revoir mes erreurs » fonctionnent
sans réimport ; la révision d'un **thème complet** nécessite de recharger les banques.

## Développer et publier

```text
src/
  app.js              moteur commun et différences d'accès web/local
  styles.css          styles communs
  page.html           modèle HTML commun
  local-loader.html   sélecteur propre à l'édition locale
scripts/build.py      génération des deux éditions autonomes
index.html            sortie générée pour GitHub Pages
index_local.html      sortie générée pour ouverture par double-clic
banques/              contenu pédagogique JSON
manifest.json         catalogue généré des banques
```

Modifier **`src/`**, puis régénérer les pages :

```sh
python3 scripts/build.py
```

Les pages produites embarquent le même JavaScript et le même CSS. Elles n'utilisent
pas d'import de module réseau, afin de fonctionner aussi en `file://`. Leur seule
différence d'interface est le chargeur local ; leur mode d'accès aux banques et
leur format de sauvegarde sont choisis par l'attribut `data-edition`.

Après ajout ou modification d'une banque :

```sh
python3 generer_manifest.py
```

Committer les sources, les pages générées et le manifest avec la modification.
La CI les vérifie **sans les réécrire** et ne commite plus automatiquement dans
`main`. La publication GitHub Pages reste basée sur les fichiers présents dans
`main`. Aucun outil de compilation n'est nécessaire chez l'utilisateur final.

## Vérifications

Python 3.12 et Node.js 22 sont utilisés en CI. Installer les dépendances de test :

```sh
python3 -m pip install -r requirements-tests.txt
npm ci
npx playwright install chromium firefox webkit
# Sous Linux, installer aussi les dépendances système :
# npx playwright install --with-deps chromium firefox webkit
```

Vérifications sans navigateur :

```sh
python3 scripts/build.py --check
python3 tests/test_build.py
python3 generer_manifest.py --check
python3 tests/test_manifest.py
python3 tests/check_project.py
node tests/runtime.mjs
```

Pour les parcours navigateur, démarrer le serveur dans un autre terminal :

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Puis lancer :

```sh
python3 tests/browser_smoke.py
npm run test:browsers
```

- `check_project.py` vérifie les banques, les IDs, les ressources, la sémantique
  HTML et la fraîcheur des pages, sans dépendre d'une mise en forme CSS précise.
- `runtime.mjs` charge la fabrique JavaScript complète : score de toutes les questions,
  combinaisons exactes et inversions, génération Vrai/Faux, stockage, migration,
  reprise interrompue, mutualisation des requêtes et pause du décompte avec horloge
  simulée. Il ne découpe plus le code par des marqueurs textuels.
- Selenium vérifie les gestes, dimensions utiles, explications, révisions, pauses
  et reprises avec Chrome. Les clics utilisent les contrôles réels ; les animations
  sont attendues jusqu'à leur fin. Une fenêtre d'observation est conservée pour
  vérifier qu'un décompte en pause reste immobile.
- Playwright vérifie Chromium, Firefox et WebKit en tailles desktop/mobile, les
  dialogues clavier, les thèmes et l'accessibilité avec axe sur les états principaux.
  L'import local réel et sa reprise sont testés en `file://` pour chaque moteur.
  Les captures sont déposées dans `test-results/` et conservées par la CI.

Les versions des paquets Node sont verrouillées par `package-lock.json` et celle
de Selenium par `requirements-tests.txt`. Les tests vérifient la structure et le
fonctionnement, sans valider scientifiquement les formulations des banques.

Les contrôles axe et WebKit complètent la couverture ; ils ne remplacent pas une
session avec VoiceOver/NVDA ni un essai sur iPhone ou Android physique. Safari natif
peut dépendre de réglages d'automatisation propres à la machine.

Voir [AUDIT.md](AUDIT.md) pour les constats et le bilan du nettoyage.

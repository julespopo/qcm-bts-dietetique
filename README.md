# QCM BTS Diététique — version web modulaire

## Architecture

- `index.html` : moteur du QCM, sans questions intégrées.
- `manifest.json` : catalogue des banques disponibles.
- `banques/*.json` : une banque par cours ou chapitre.
- `generer_manifest.py` : reconstruit automatiquement `manifest.json` à partir du dossier `banques`.

## Ajouter un nouveau cours plus tard

Exemple : tu ajoutes `banques/07_vitamines.json`.

Ensuite, à la racine du projet :

```bash
python3 generer_manifest.py
```

Le manifeste est mis à jour automatiquement. Tu publies ensuite les nouveaux fichiers sur GitHub.

Tu n'as PAS besoin de modifier `index.html`.

## Pourquoi cette version est plus scalable

La page d'accueil charge seulement `manifest.json`, qui est très léger.

Au moment de créer un questionnaire, le site choisit d'abord les questions à tirer grâce au nombre de questions indiqué dans le manifeste. Il ne télécharge ensuite que les banques contenant réellement les questions tirées.

Exemple :
- 20 matières disponibles ;
- 2 000 questions au total ;
- l'étudiant demande 20 questions ;
- le navigateur n'a pas besoin de charger les 2 000 questions au démarrage.

## Pause et reprise

La sauvegarde stocke principalement les identifiants des questions et les noms des fichiers de banque, pas une copie de toute la base de données.

Au moment de reprendre, le site recharge uniquement les banques nécessaires.

## Hébergement

Cette version est prévue pour un hébergement HTTP/HTTPS comme GitHub Pages.

Elle ne peut pas être testée correctement par un simple double-clic sur `index.html`, car les navigateurs bloquent généralement `fetch()` depuis `file://`.

Pour tester localement :

```bash
cd QCM_BTS_Dietetique_WEB_MODULAIRE
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Organisation conseillée sur l'année

Tu peux garder une banque par chapitre :

```text
banques/
  biochimie_glucides.json
  biochimie_lipides.json
  biochimie_protides.json
  bpadn_acides_nucleiques.json
  bpadn_milieu_interieur.json
  bpadn_biologie_cellulaire.json
  physiologie_digestive.json
  nutrition_adulte.json
  microbiologie_chapitre_1.json
  ...
```

Chaque nouveau fichier devient automatiquement une nouvelle banque lorsque le manifeste est régénéré.

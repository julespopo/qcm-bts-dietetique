# QCM BTS Diététique — version web modulaire V2

## Organisation par matière

Le dossier `banques` peut maintenant contenir des sous-dossiers correspondant aux matières.

Exemple :

```text
banques/
  BPADN/
    01_glucides.json
    02_lipides.json
    03_protides.json
    04_acides_nucleiques.json
    05_milieu_interieur.json
    06_biologie_cellulaire.json

  alimentation_therapeutique/
    diabete.json
    insuffisance_renale.json
    maladies_cardiovasculaires.json

  microbiologie/
    bacteries.json
    virus.json
```

## Principe

- Le dossier correspond à une matière.
- Chaque fichier JSON correspond à un chapitre ou à un thème.
- `index.html` reste le moteur du QCM.
- `manifest.json` est le catalogue des banques.
- `generer_manifest.py` parcourt automatiquement TOUS les sous-dossiers de `banques`.

## Ajouter une nouvelle matière

1. Crée un dossier, par exemple :
   `banques/alimentation_therapeutique/`

2. Ajoute les banques JSON dedans, par exemple :
   `banques/alimentation_therapeutique/diabete.json`

3. Lance :
   `python3 generer_manifest.py`

4. Envoie sur GitHub :
   - le nouveau fichier JSON ;
   - le `manifest.json` mis à jour.

Tu n'as pas besoin de modifier `index.html`.

## Ajouter un chapitre BPADN

Exemple :

```text
banques/BPADN/07_enzymologie.json
```

Puis :

```bash
python3 generer_manifest.py
```

## Situation actuelle

Les 6 banques existantes sont maintenant toutes rangées sous la matière `BPADN` :
- Glucides
- Lipides
- Protides
- Acides nucléiques
- Milieu intérieur
- Biologie cellulaire

Le site les regroupe donc automatiquement sous une seule matière.

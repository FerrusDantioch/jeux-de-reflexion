# Jeux de Réflexion — notes pour Claude

PWA de quatre jeux (Sudoku, Mots Mêlés, Démineur, Mémoire) en **HTML/CSS/JS pur,
sans aucune dépendance ni étape de compilation**. Code et commentaires en
français, rédigés pour un développeur débutant : conserver ce niveau
d'explication dans toute modification.

## ⚠️ Avant de pousser : incrémenter la version du service worker

Après toute modification d'un fichier **mis en cache** (`index.html`, `css/`,
`js/`, `manifest.json`, `icones/`), incrémenter la constante en haut de
`service-worker.js` :

```js
const VERSION = 'jeux-reflexion-v2';   // → v3
```

Sans ce changement, le navigateur ne détecte aucun service worker différent, ne
retélécharge rien, et **toute personne ayant déjà ouvert l'application continue
de voir l'ancienne version**. Le symptôme est trompeur : le dépôt est à jour,
mais l'application ne change pas.

En cas d'**ajout de fichier**, l'inscrire aussi dans la liste
`FICHIERS_A_METTRE_EN_CACHE` du même fichier, sinon il manquera hors ligne.

**Ne pas** incrémenter pour un changement qui ne touche aucun fichier du cache
(README, LICENSE, `.gitattributes`, `captures/`) : cela imposerait un
retéléchargement complet à tous les utilisateurs sans raison.

## Tester en local

```bash
node serveur-local.js   # puis http://localhost:5177
```

Un service worker ne fonctionne **que** sur `https://` ou `http://localhost`,
jamais par double-clic sur `index.html` (`file://`). Les jeux tourneront quand
même, mais ni l'installation ni le mode hors ligne.

## Architecture

Chaque jeu s'inscrit lui-même dans `window.Jeux` (voir la fin de
`js/sudoku.js`) ; `js/app.js` construit le menu à partir de ce registre et ne
contient aucune règle de jeu. Pour ajouter un jeu : créer `js/<nom>.js` sur le
même modèle, puis le déclarer dans `index.html`, dans `ORDRE_DES_JEUX` de
`app.js` et dans la liste du service worker.

Déploiement : GitHub Pages, branche `main`, racine →
https://ferrusdantioch.github.io/jeux-de-reflexion/

# Jeux de Réflexion

**▶ Jouer en ligne : https://ferrusdantioch.github.io/jeux-de-reflexion/**

Une application web installable (PWA) qui regroupe **quatre jeux de logique**,
entièrement jouables **hors connexion** :

| Jeu | Contenu |
|---|---|
| **Sudoku** | Grilles générées aléatoirement, à solution unique garantie. 4 niveaux. |
| **Mots Mêlés** | 5 thèmes français, grilles générées aléatoirement. 3 niveaux. |
| **Démineur** | 3 niveaux, premier clic toujours sans danger. |
| **Mémoire** | Jeu des paires, 3 thèmes et 3 niveaux. |

Aucune bibliothèque externe, aucun serveur, aucune donnée envoyée sur internet :
uniquement du HTML, du CSS et du JavaScript. Tout le code est commenté en français.

---

## 1. Essayer l'application

### Le plus simple (pour jouer tout de suite)

Ouvrez le fichier `index.html` par un double-clic. Les quatre jeux fonctionnent,
les scores sont enregistrés.

> ⚠️ Dans ce mode, **le bouton « Installer » et le vrai mode hors-ligne ne
> fonctionnent pas**. Ce n'est pas un défaut du code : les navigateurs
> interdisent les *service workers* sur les adresses `file://`, pour des
> raisons de sécurité. Voir la méthode suivante.

### Pour tester la PWA complète (hors-ligne + installation)

Il faut une adresse `http://localhost`. Un petit serveur est fourni :

1. Installez [Node.js](https://nodejs.org) si ce n'est pas déjà fait.
2. Ouvrez un terminal dans ce dossier.
3. Lancez :

```bash
node serveur-local.js
```

4. Ouvrez `http://localhost:5177` dans votre navigateur.

Le fichier `serveur-local.js` ne sert **qu'aux tests** ; il n'est pas nécessaire
une fois l'application hébergée en ligne.

### Pour l'installer sur votre téléphone

Ouvrez **https://ferrusdantioch.github.io/jeux-de-reflexion/** sur votre
téléphone (l'application y est publiée automatiquement à chaque modification
envoyée sur GitHub), puis :

- **Android / Chrome** : menu ⋮ → « Installer l'application », ou le bouton ⤓
  affiché en haut à droite de l'application.
- **iPhone / Safari** : bouton Partager → « Sur l'écran d'accueil ».

Après cette première visite, l'application fonctionne **sans aucune connexion**.

---

## 2. Organisation des fichiers

```
JeuxDeReflexion/
├── index.html            La seule page HTML : elle contient les 3 « écrans »
│                         (accueil, choix du niveau, jeu en cours)
├── manifest.json         Carte d'identité de la PWA (nom, icônes, couleurs)
├── service-worker.js     Met tous les fichiers en cache → mode hors-ligne
├── serveur-local.js      Serveur de test (facultatif, pour le développement)
│
├── css/
│   ├── style.css         Charte graphique commune : couleurs, boutons, écrans
│   └── jeux.css          Styles propres à chacun des quatre jeux
│
├── js/
│   ├── stockage.js       Enregistrement local : parties en cours et records
│   ├── outils.js         Fonctions partagées : hasard, chronomètre, modale
│   ├── sudoku.js         Jeu 1 — génération + règles
│   ├── mots-meles.js     Jeu 2 — listes de mots, placement, glissement
│   ├── demineur.js       Jeu 3 — pose des mines, révélation en cascade
│   ├── memoire.js        Jeu 4 — distribution des cartes, comparaison
│   └── app.js            Menu, navigation, service worker, installation
│
└── icones/               Icônes de l'application (PNG)
```

### Comment les jeux se branchent sur le menu

Chaque fichier de jeu s'inscrit tout seul dans un « registre » commun :

```js
window.Jeux['sudoku'] = {
  nom: 'Sudoku',
  niveaux: [ ... ],
  demarrer(conteneur, options) { ... },
  arreter() { ... }
};
```

`app.js` lit ce registre et construit le menu automatiquement. **Pour ajouter un
cinquième jeu**, il suffit donc de créer un fichier sur le même modèle, de
l'ajouter dans `index.html`, dans la liste `ORDRE_DES_JEUX` de `app.js`, et dans
la liste du `service-worker.js`.

---

## 3. Modifier l'application

### Ajouter des mots ou un thème aux Mots Mêlés

Dans `js/mots-meles.js`, tout en haut, se trouve le tableau `THEMES`. Les mots
doivent être **en majuscules et sans accent** :

```js
{
  id: 'metiers',
  nom: 'Métiers',
  mots: ['BOULANGER', 'FACTEUR', 'MEDECIN', ...]
}
```

### Changer la difficulté d'un jeu

Chaque fichier de jeu commence par un tableau `NIVEAUX` bien visible :

- **Sudoku** : `indices` = nombre de cases remplies au départ (moins = plus dur).
- **Mots Mêlés** : `taille`, `nbMots` et `directions`.
- **Démineur** : `lignes`, `colonnes` et `mines`.
- **Mémoire** : `paires` et `colonnes`.

### Changer les couleurs

Tout est regroupé en haut de `css/style.css`, dans le bloc `:root`. Modifier
`--accent` change la couleur principale dans **toute** l'application.

### ⚠️ Publier une mise à jour

Le service worker garde tous les fichiers en mémoire. Si vous modifiez le code
sans rien d'autre, les personnes ayant déjà ouvert l'application continueront à
voir **l'ancienne version**.

**À chaque mise à jour, changez le numéro de version** en haut de
`service-worker.js` :

```js
const VERSION = 'jeux-reflexion-v2';   // v1 → v2
```

Le navigateur détectera alors un service worker différent, retéléchargera tous
les fichiers et supprimera l'ancien cache.

---

## 4. Vos données

Tout est enregistré **uniquement sur votre appareil**, via `localStorage` :

- la partie en cours de chaque jeu (reprise automatique au rechargement) ;
- les meilleurs temps par niveau (et par thème pour les Mots Mêlés et la Mémoire) ;
- le meilleur nombre de coups pour le jeu de Mémoire.

Rien n'est envoyé sur internet, il n'y a ni compte ni publicité ni traceur.
Vider les données du site dans le navigateur efface les scores.

---

## 5. Détails techniques

**Génération du Sudoku.** Une grille complète est d'abord remplie au hasard par
retour sur trace (*backtracking*), puis les cases sont vidées une à une dans un
ordre aléatoire. Après chaque suppression, un solveur vérifie qu'il reste
**exactement une** solution ; sinon le chiffre est remis. Le solveur utilise des
masques de bits et l'heuristique MRV (on traite d'abord la case ayant le moins
de possibilités), ce qui rend la génération quasi instantanée : **1 à 3
millisecondes** par grille, y compris au niveau Expert.

**Placement des mots.** Les mots sont placés du plus long au plus court. Pour
chaque mot, toutes les positions et directions possibles sont mélangées, puis la
première qui convient est retenue. Deux mots peuvent se croiser s'ils partagent
la même lettre au point de croisement.

**Démineur.** Les mines ne sont posées **qu'après le premier clic**, en excluant
la case cliquée et ses huit voisines : le premier clic ouvre donc toujours une
zone. La révélation en cascade utilise une pile plutôt que la récursion, afin de
ne pas saturer la mémoire sur la grande grille du niveau Expert.

**Compatibilité.** Les interactions utilisent les *événements pointeur*
(`pointerdown`, `pointermove`, `pointerup`) : un seul et même code fonctionne à
la souris, au doigt et au stylet. L'application est utilisable entièrement au
clavier sur ordinateur (flèches, chiffres, `Ctrl+Z` / `Ctrl+Y`, `N` pour le
crayon, `H` pour un indice).

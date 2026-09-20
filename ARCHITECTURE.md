# Architecture

Ce document complète le `README.md` (organisation générale des fichiers,
comment ajouter un jeu) avec le détail technique du jeu **Labyrinthe**,
le plus récent des cinq jeux de l'application.

Pour l'organisation générale (menu, stockage, service worker, comment un jeu
s'inscrit dans `window.Jeux`), voir la section « 2. Organisation des
fichiers » du `README.md`.

---

## Labyrinthe

Le jeu est réparti sur deux fichiers, à l'image du principe « moteur séparé
de l'affichage » déjà utilisé pour le Sudoku (génération) et le Démineur
(pose des mines) :

| Fichier | Rôle |
|---|---|
| `js/labyrinthe-moteur.js` | Le moteur : génération, solveur. Aucun accès au DOM — utilisable tel quel dans Node.js. |
| `js/labyrinthe.js` | Le jeu : Canvas, contrôles, sons, sauvegarde, inscription au menu. |
| `tests/test-labyrinthe.js` | Vérifications automatiques du moteur (voir plus bas). |

### Le moteur (`js/labyrinthe-moteur.js`)

**Représentation.** Une grille de `largeur x hauteur` cellules, indexées
`index = y * largeur + x`. Chaque cellule est un entier (`Uint8Array`) codant
ses 4 murs sous forme de bits : `HAUT=1, DROITE=2, BAS=4, GAUCHE=8`. Un bit à
1 signifie « le mur est encore debout ».

**Graine et reproductibilité.** Le générateur pseudo-aléatoire est
`mulberry32` : à graine égale, la suite de nombres produite est identique, et
donc le labyrinthe aussi. C'est ce qui permet le « code du labyrinthe »
(section suivante).

**Algorithmes de génération** (tous itératifs, avec une pile ou une file
explicite — jamais de récursion, pour rester solide sur les grandes
grilles) :

- **Retour arrière** (*backtracker*, DFS itératif) : couloirs longs et
  sinueux, peu d'embranchements. Utilisé en Facile et Normal.
- **Prim aléatoire** : beaucoup de petites impasses. Utilisé en Difficile.
- **Wilson** (marches aléatoires à effacement de boucles) : labyrinthe
  statistiquement uniforme, sans biais de l'algorithme. Utilisé en Expert.

Ces trois algorithmes produisent un labyrinthe **parfait** : un seul chemin
possible entre deux cellules quelconques (nombre de passages ouverts =
nombre de cellules − 1, aucune boucle).

**Boucles (braidage).** En Facile uniquement, une passe supplémentaire
(`braider`) perce un mur en plus sur ~30 % des impasses, ouvrant des chemins
alternatifs — le labyrinthe n'est alors plus « parfait ».

**Départ et arrivée.** Calculés par double parcours en largeur (BFS) : on
part d'un coin, on cherche la cellule la plus loin (A), puis la cellule la
plus loin de A (B). A et B deviennent départ et arrivée. C'est une méthode
classique, rapide (deux BFS), qui donne une excellente séparation sans avoir
à tester toutes les paires de cellules.

**Solveur.** Un BFS classique entre deux cellules, qui renvoie le chemin
complet (pas seulement sa longueur). Réutilisé pour l'indice (chemin depuis
la position actuelle) et pour la note de fin de partie (comparaison avec le
nombre de pas du joueur).

**Réglages centralisés.** Tout l'équilibrage (quel algorithme, combien de
boucles, combien d'indices, brouillard ou non) est dans deux objets en fin
de fichier, `DIFFICULTES` et `TAILLES` :

```js
facile:    { algorithme: 'retour-arriere', braidage: 0.30, indices: Infinity, brouillard: false }
normal:    { algorithme: 'retour-arriere', braidage: 0,    indices: 3,        brouillard: false }
difficile: { algorithme: 'prim',           braidage: 0,    indices: 1,        brouillard: false }
expert:    { algorithme: 'wilson',         braidage: 0,    indices: 0,        brouillard: true  }
```

```
petit: 8x8, moyen: 15x15, grand: 25x25, immense: 40x40
```

### Tests automatiques (`tests/test-labyrinthe.js`)

```bash
node tests/test-labyrinthe.js
```

Pour chaque combinaison difficulté × taille (4 × 4 = 16) et 200 graines
fixes (3200 labyrinthes au total), le script vérifie : connexité totale,
caractère « parfait » quand attendu (passages = cellules − 1), séparation
correcte départ/arrivée, reproductibilité à graine égale, validité et
optimalité du chemin trouvé par le solveur, et performance (objectif
Immense < 150 ms). Il se termine par un résumé et un code de sortie non nul
en cas d'échec — pratique pour un outil d'intégration continue plus tard.

### Le jeu (`js/labyrinthe.js`)

**Écran de configuration.** Le menu générique de `app.js` ne gère qu'un seul
choix à la fois (des « niveaux », plus un « thème » optionnel), alors que le
Labyrinthe a besoin de deux réglages indépendants (difficulté ET taille) et
d'un champ de code. Le jeu déclare donc un seul « niveau » factice
(« Jouer ») dans `window.Jeux['labyrinthe'].niveaux` : le clic dessus ouvre
un écran de configuration entièrement construit par `labyrinthe.js`
lui-même, à l'intérieur du même conteneur (`zone-jeu`).

**Rendu Canvas.** Les murs ne changent jamais en cours de partie : ils sont
dessinés une seule fois sur un `<canvas>` hors écran (`vue.offscreen`), à une
résolution fixe de 28 px par cellule. À chaque image, on recopie
(`drawImage`) uniquement le morceau visible de ce calque — beaucoup plus
rapide que redessiner tous les murs à chaque fois, important sur un
téléphone d'entrée de gamme.

**Mode caméra.** Si une cellule ferait moins de 16 px de large en affichant
toute la grille (grandes tailles sur petit écran), ou en difficulté Expert
(brouillard), l'affichage bascule sur une fenêtre de 9x9 cellules centrée
sur le joueur, qui se déplace avec lui.

**Brouillard (Expert).** Une opacité est calculée par cellule visible, selon
sa distance au joueur (dégradé entre 1,7 et 3,6 cellules) ; les cellules déjà
visitées gardent une opacité plafonnée (0,55 au lieu de 0,95), pour rester
faiblement visibles au lieu de redevenir noires.

**Déplacement.** Un seul type de geste tactile (`pointermove` sur le
canevas) gère à la fois le glissement rapide (swipe) et le glissement
continu : dès que le doigt a parcouru un certain seuil de pixels, on avance
d'une case et on reprend la mesure à partir de la position actuelle. Au
clavier, on utilise `event.code` (la touche PHYSIQUE) : `KeyW/KeyA/KeyS/KeyD`
correspondent à Z/Q/S/D sur un clavier AZERTY comme aux flèches/WASD sur un
clavier QWERTY, sans détection de disposition.

**Sons et vibrations.** Le module partagé `Sons` (ajouté dans `js/outils.js`,
réutilisable par de futurs jeux) synthétise 4 effets courts avec la Web
Audio API : aucun fichier audio, donc aucun poids supplémentaire pour le
mode hors-ligne.

### Format de sauvegarde (`localStorage`, via `Parties`)

```js
{
  difficulte, taille, graine,   // suffisent a regenerer EXACTEMENT le meme labyrinthe
  position,                     // cellule actuelle du joueur
  pas,
  indicesRestants,               // -1 signifie "illimite" (Facile) : JSON ne sait pas ecrire Infinity
  cellulesVisitees,              // tableau d'index, pour la trainee et le brouillard
  temps                          // millisecondes ecoulees
}
```

Comme le labyrinthe n'est jamais sauvegardé lui-même (seulement la graine
+ les réglages qui l'ont produit), la sauvegarde reste minuscule même pour
la taille Immense (1600 cellules).

### Le « code du labyrinthe »

Un texte court du type `NG-3XA1F9` : les deux premières lettres sont la
difficulté et la taille (`N`=Normal, `G`=Grand...), suivies de la graine en
base 36. Fonctions `encoderCode` / `decoderCode` dans `labyrinthe.js`.
Rejouer un labyrinthe précis, ou en partager un, revient donc à ressaisir ce
code sur l'écran de configuration.

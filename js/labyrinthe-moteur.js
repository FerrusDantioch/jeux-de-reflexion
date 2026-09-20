/* ==========================================================================
   labyrinthe-moteur.js - Le "moteur" du jeu Labyrinthe
   --------------------------------------------------------------------------
   Ce fichier ne touche JAMAIS au HTML ni à l'écran (aucun `document`, aucun
   `window` indispensable) : il ne fait que calculer un labyrinthe et le
   résoudre. Cela permet deux choses :
     1. l'utiliser tel quel dans le jeu (phase 2, avec l'affichage Canvas) ;
     2. l'utiliser aussi dans Node.js pour le tester automatiquement, sans
        avoir besoin d'un navigateur (voir tests/test-labyrinthe.js).

   SOMMAIRE
     1. Représentation d'une grille (murs, sous forme de bits)
     2. Générateur aléatoire à graine (mulberry32)
     3. Algorithmes de génération : retour arrière, Prim, Wilson
     4. Option "boucles" (braidage) : on perce quelques impasses en plus
     5. Recherche du départ et de l'arrivée (les deux cellules les plus
        éloignées possible)
     6. Solveur : plus court chemin entre deux cellules
     7. Réglages (difficultés x tailles) et fonction principale
   ========================================================================== */

(function (global) {
  'use strict';

  /* ========================================================================
     1. REPRÉSENTATION D'UNE GRILLE
     ------------------------------------------------------------------------
     Chaque cellule est identifiée par un seul nombre (son "index") :
       index = y * largeur + x
     Pour chacune, on retient quels murs sont encore debout, sous la forme
     d'un "masque de bits" : un seul petit nombre qui contient 4 informations
     à la fois (un peu comme 4 interrupteurs rangés dans le même octet). On
     utilise un Uint8Array (un tableau d'entiers 0-255) car il prend 4 fois
     moins de mémoire qu'un tableau JavaScript classique : utile sur mobile
     pour les grandes grilles.
     ======================================================================== */

  const HAUT    = 1; // 0001
  const DROITE  = 2; // 0010
  const BAS     = 4; // 0100
  const GAUCHE  = 8; // 1000
  const TOUS_LES_MURS = HAUT | DROITE | BAS | GAUCHE; // 15 : les 4 murs debout

  // Pour chaque direction, le déplacement (dx, dy) et le mur "vu depuis l'autre
  // côté" : si on perce le mur DROITE d'une cellule, c'est le mur GAUCHE de
  // sa voisine de droite qu'il faut aussi percer.
  const DIRECTIONS = [
    { mur: HAUT,   oppose: BAS,    dx: 0,  dy: -1 },
    { mur: DROITE, oppose: GAUCHE, dx: 1,  dy: 0  },
    { mur: BAS,    oppose: HAUT,   dx: 0,  dy: 1  },
    { mur: GAUCHE, oppose: DROITE, dx: -1, dy: 0  }
  ];

  /**
   * Renvoie les voisines existantes d'une cellule (celles qui restent à
   * l'intérieur de la grille), sans se soucier des murs. Sert à construire
   * le labyrinthe (on choisit une voisine, puis on perce le mur vers elle).
   */
  function voisinesStructurelles(index, largeur, hauteur) {
    const x = index % largeur;
    const y = Math.floor(index / largeur);
    const resultat = [];
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const d = DIRECTIONS[i];
      const vx = x + d.dx;
      const vy = y + d.dy;
      if (vx < 0 || vx >= largeur || vy < 0 || vy >= hauteur) continue;
      resultat.push({ index: vy * largeur + vx, mur: d.mur, oppose: d.oppose });
    }
    return resultat;
  }

  /**
   * Renvoie les voisines ATTEIGNABLES d'une cellule, c'est-à-dire celles dont
   * le mur a déjà été percé. Sert à se déplacer dans un labyrinthe déjà
   * construit (solveur, calcul de distances, déplacement du joueur).
   */
  function voisinesOuvertes(murs, index, largeur, hauteur) {
    const x = index % largeur;
    const y = Math.floor(index / largeur);
    const resultat = [];
    for (let i = 0; i < DIRECTIONS.length; i++) {
      const d = DIRECTIONS[i];
      if (murs[index] & d.mur) continue; // ce mur est encore debout
      const vx = x + d.dx;
      const vy = y + d.dy;
      resultat.push(vy * largeur + vx);
    }
    return resultat;
  }

  /** Perce le mur entre deux cellules voisines (dans les deux sens à la fois). */
  function percerMur(murs, lien) {
    murs[lien.de] &= ~lien.mur;
    murs[lien.vers] &= ~lien.oppose;
  }

  /** Compte combien de murs sont encore debout autour d'une cellule (0 à 4). */
  function compterMurs(masque) {
    let n = 0;
    if (masque & HAUT) n++;
    if (masque & DROITE) n++;
    if (masque & BAS) n++;
    if (masque & GAUCHE) n++;
    return n;
  }

  /* ========================================================================
     2. GÉNÉRATEUR ALÉATOIRE À GRAINE (mulberry32)
     ------------------------------------------------------------------------
     `Math.random()` ne se "rejoue" jamais à l'identique : impossible donc de
     partager un labyrinthe précis avec un code. mulberry32 est un petit
     algorithme, très rapide, qui transforme un nombre de départ (la "graine")
     en une suite de nombres qui SEMBLE aléatoire mais qui est en réalité
     entièrement déterminée par la graine : même graine => exactement la même
     suite de nombres => exactement le même labyrinthe.
     ======================================================================== */

  function mulberry32(graine) {
    let a = graine >>> 0; // >>> 0 force un entier non signé sur 32 bits
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Entier aléatoire entre 0 (inclus) et max (exclu), à partir d'un rng fourni. */
  function entierAleatoire(rng, max) {
    return Math.floor(rng() * max);
  }

  /* ========================================================================
     3. ALGORITHMES DE GÉNÉRATION
     ------------------------------------------------------------------------
     IMPORTANT : aucune récursion. Sur un grand labyrinthe (40 x 40 = 1600
     cellules), une version récursive pourrait empiler 1600 appels de fonction
     et dépasser la pile d'exécution sur certains navigateurs mobiles. On
     utilise donc partout une pile ou une file EXPLICITE (un simple tableau).
     ======================================================================== */

  /**
   * Retour arrière (backtracker) : à partir d'une cellule, on avance au
   * hasard vers une voisine pas encore visitée en perçant le mur ; si on est
   * bloqué, on revient en arrière (on "dépile"). Résultat typique : de longs
   * couloirs sinueux, peu d'embranchements.
   */
  function genererRetourArriere(largeur, hauteur, rng) {
    const total = largeur * hauteur;
    const murs = new Uint8Array(total).fill(TOUS_LES_MURS);
    const visitee = new Uint8Array(total);
    const pile = new Int32Array(total);
    let sommet = 0;

    visitee[0] = 1;
    pile[sommet++] = 0;

    while (sommet > 0) {
      const actuelle = pile[sommet - 1];
      const candidates = voisinesStructurelles(actuelle, largeur, hauteur)
        .filter(function (v) { return !visitee[v.index]; });

      if (candidates.length === 0) {
        sommet--; // impasse : on revient en arrière
        continue;
      }

      const choisie = candidates[entierAleatoire(rng, candidates.length)];
      percerMur(murs, { de: actuelle, vers: choisie.index, mur: choisie.mur, oppose: choisie.oppose });
      visitee[choisie.index] = 1;
      pile[sommet++] = choisie.index;
    }

    return murs;
  }

  /**
   * Prim aléatoire : on part d'une cellule et on garde la liste des murs
   * "à la frontière" du labyrinthe déjà construit. On en choisit un au
   * hasard ; s'il mène vers une cellule pas encore reliée, on le perce et on
   * ajoute les murs de cette nouvelle cellule à la frontière. Résultat
   * typique : beaucoup de petites impasses, plus déroutant que le retour
   * arrière.
   */
  function genererPrim(largeur, hauteur, rng) {
    const total = largeur * hauteur;
    const murs = new Uint8Array(total).fill(TOUS_LES_MURS);
    const dansLabyrinthe = new Uint8Array(total);
    const frontiere = [];

    function ajouterFrontiere(cellule) {
      voisinesStructurelles(cellule, largeur, hauteur).forEach(function (v) {
        if (!dansLabyrinthe[v.index]) {
          frontiere.push({ de: cellule, vers: v.index, mur: v.mur, oppose: v.oppose });
        }
      });
    }

    dansLabyrinthe[0] = 1;
    ajouterFrontiere(0);

    while (frontiere.length > 0) {
      // On tire un lien au hasard et on le retire en O(1) en le remplaçant
      // par le dernier élément (l'ordre de la liste n'a pas d'importance ici).
      const i = entierAleatoire(rng, frontiere.length);
      const lien = frontiere[i];
      frontiere[i] = frontiere[frontiere.length - 1];
      frontiere.pop();

      if (dansLabyrinthe[lien.vers]) continue; // déjà reliée entre-temps

      percerMur(murs, lien);
      dansLabyrinthe[lien.vers] = 1;
      ajouterFrontiere(lien.vers);
    }

    return murs;
  }

  /**
   * Wilson (marches aléatoires à effacement de boucles) : on part d'une
   * cellule extérieure au labyrinthe et on marche au hasard, en notant à
   * chaque cellule la direction empruntée. Si la marche repasse par une
   * cellule déjà visitée PENDANT CETTE MARCHE, on écrase simplement
   * l'ancienne direction par la nouvelle : la boucle est ainsi effacée sans
   * effort. Dès que la marche atteint une cellule déjà dans le labyrinthe, on
   * grave tout le chemin mémorisé. Résultat : un labyrinthe parfaitement
   * "uniforme" (aucun biais visible dû à l'algorithme), mais un peu plus lent
   * à générer que les deux précédents.
   */
  function genererWilson(largeur, hauteur, rng) {
    const total = largeur * hauteur;
    const murs = new Uint8Array(total).fill(TOUS_LES_MURS);
    const dansLabyrinthe = new Uint8Array(total);
    // Pour chaque cellule, le mur "de sortie" choisi pendant la marche en cours.
    const directionDepuis = new Int8Array(total).fill(-1);

    const initiale = entierAleatoire(rng, total);
    dansLabyrinthe[initiale] = 1;
    let restantes = total - 1;

    while (restantes > 0) {
      // On choisit une cellule de départ de marche, hors du labyrinthe.
      let depart;
      do {
        depart = entierAleatoire(rng, total);
      } while (dansLabyrinthe[depart]);

      // Marche aléatoire jusqu'à toucher le labyrinthe déjà construit.
      let actuelle = depart;
      while (!dansLabyrinthe[actuelle]) {
        const voisines = voisinesStructurelles(actuelle, largeur, hauteur);
        const choisie = voisines[entierAleatoire(rng, voisines.length)];
        directionDepuis[actuelle] = choisie.mur;
        actuelle = choisie.index;
      }

      // On regrave le chemin mémorisé, de la case de départ jusqu'au point
      // de contact avec le labyrinthe.
      actuelle = depart;
      while (!dansLabyrinthe[actuelle]) {
        const mur = directionDepuis[actuelle];
        const direction = DIRECTIONS[[HAUT, DROITE, BAS, GAUCHE].indexOf(mur)];
        const x = actuelle % largeur;
        const y = Math.floor(actuelle / largeur);
        const suivante = (y + direction.dy) * largeur + (x + direction.dx);

        percerMur(murs, { de: actuelle, vers: suivante, mur: mur, oppose: direction.oppose });
        dansLabyrinthe[actuelle] = 1;
        restantes--;
        actuelle = suivante;
      }
    }

    return murs;
  }

  /* ========================================================================
     4. OPTION "BOUCLES" (BRAIDAGE)
     ------------------------------------------------------------------------
     Un labyrinthe "parfait" n'a qu'un seul chemin entre deux cellules : ce
     sont d'ailleurs les seules impasses qui existent. Pour le niveau Facile,
     on perce en plus un mur sur un certain pourcentage des impasses : cela
     ouvre un second chemin (une "boucle") et rend le labyrinthe plus facile,
     car se tromper de couloir devient moins pénalisant.
     ======================================================================== */

  function braider(murs, largeur, hauteur, rng, pourcentage) {
    if (!pourcentage) return;
    const total = largeur * hauteur;
    for (let i = 0; i < total; i++) {
      if (compterMurs(murs[i]) !== 3) continue; // pas une impasse (une seule sortie)
      if (rng() > pourcentage) continue;

      // Parmi les murs encore debout, on en perce un choisi au hasard.
      const mursDebout = voisinesStructurelles(i, largeur, hauteur)
        .filter(function (v) { return (murs[i] & v.mur) !== 0; });
      if (mursDebout.length === 0) continue;

      const choisi = mursDebout[entierAleatoire(rng, mursDebout.length)];
      percerMur(murs, { de: i, vers: choisi.index, mur: choisi.mur, oppose: choisi.oppose });
    }
  }

  /* ========================================================================
     5. DÉPART ET ARRIVÉE (cellules les plus éloignées)
     ------------------------------------------------------------------------
     Un parcours en largeur (BFS, "Breadth-First Search") part d'une cellule
     et explore le labyrinthe "en cercles concentriques" : on visite d'abord
     toutes les cellules à 1 pas, puis toutes celles à 2 pas, etc. C'est
     l'outil de base pour mesurer des distances dans un labyrinthe (où, à la
     différence d'une carte routière, il n'y a pas de "à vol d'oiseau").
     ======================================================================== */

  /** Distances (en nombre de pas) depuis une cellule de départ. -1 = injoignable. */
  function calculerDistances(murs, largeur, hauteur, depart) {
    const total = largeur * hauteur;
    const distances = new Int32Array(total).fill(-1);
    // Une file d'attente FIFO codée avec un simple tableau + un index de
    // lecture : on évite ainsi le coût d'un tableau.shift() (qui redécale
    // toute la mémoire) à chaque cellule traitée.
    const file = new Int32Array(total);
    let lecture = 0;
    let ecriture = 0;

    distances[depart] = 0;
    file[ecriture++] = depart;

    while (lecture < ecriture) {
      const actuelle = file[lecture++];
      const d = distances[actuelle];
      const voisines = voisinesOuvertes(murs, actuelle, largeur, hauteur);
      for (let i = 0; i < voisines.length; i++) {
        const v = voisines[i];
        if (distances[v] === -1) {
          distances[v] = d + 1;
          file[ecriture++] = v;
        }
      }
    }

    return distances;
  }

  function celluleLaPlusLointaine(distances) {
    let meilleure = 0;
    for (let i = 1; i < distances.length; i++) {
      if (distances[i] > distances[meilleure]) meilleure = i;
    }
    return meilleure;
  }

  /**
   * Choisit départ et arrivée en les éloignant le plus possible l'un de
   * l'autre : on part d'un coin, on cherche la cellule la plus lointaine
   * (A), puis la cellule la plus lointaine de A (B). C'est une méthode
   * classique et rapide (deux BFS) qui donne un excellent résultat, même si
   * elle ne garantit pas mathématiquement la paire absolument la plus
   * éloignée (ce qui demanderait de tester toutes les paires).
   */
  function choisirDepartEtArrivee(murs, largeur, hauteur) {
    const distancesDepuisCoin = calculerDistances(murs, largeur, hauteur, 0);
    const a = celluleLaPlusLointaine(distancesDepuisCoin);
    const distancesDepuisA = calculerDistances(murs, largeur, hauteur, a);
    const b = celluleLaPlusLointaine(distancesDepuisA);
    return { depart: a, arrivee: b };
  }

  /* ========================================================================
     6. SOLVEUR : plus court chemin entre deux cellules
     ------------------------------------------------------------------------
     Toujours un BFS, mais cette fois on mémorise aussi "par où on est
     arrivé" à chaque cellule, ce qui permet de reconstituer le chemin complet
     à la fin (et pas seulement sa longueur).
     ======================================================================== */

  function resoudre(murs, largeur, hauteur, depart, arrivee) {
    const total = largeur * hauteur;
    const parent = new Int32Array(total).fill(-1);
    const visitee = new Uint8Array(total);
    const file = new Int32Array(total);
    let lecture = 0;
    let ecriture = 0;

    visitee[depart] = 1;
    file[ecriture++] = depart;

    while (lecture < ecriture) {
      const actuelle = file[lecture++];
      if (actuelle === arrivee) break;

      const voisines = voisinesOuvertes(murs, actuelle, largeur, hauteur);
      for (let i = 0; i < voisines.length; i++) {
        const v = voisines[i];
        if (!visitee[v]) {
          visitee[v] = 1;
          parent[v] = actuelle;
          file[ecriture++] = v;
        }
      }
    }

    if (!visitee[arrivee]) return null; // ne devrait jamais arriver dans un labyrinthe connecté

    // On reconstitue le chemin en remontant les parents depuis l'arrivée,
    // puis on remet l'ordre "du départ vers l'arrivée" avec reverse().
    const chemin = [];
    let c = arrivee;
    while (c !== -1) {
      chemin.push(c);
      c = parent[c];
    }
    chemin.reverse();
    return chemin;
  }

  /* ========================================================================
     7. RÉGLAGES ET FONCTION PRINCIPALE
     ------------------------------------------------------------------------
     Tout ce qui distingue une difficulté ou une taille est centralisé ici :
     c'est le seul endroit à modifier pour ajuster l'équilibrage du jeu.
     ======================================================================== */

  const DIFFICULTES = {
    facile:    { id: 'facile',    nom: 'Facile',    algorithme: 'retour-arriere', braidage: 0.30, indices: Infinity, brouillard: false },
    normal:    { id: 'normal',    nom: 'Normal',    algorithme: 'retour-arriere', braidage: 0,     indices: 3,        brouillard: false },
    difficile: { id: 'difficile', nom: 'Difficile', algorithme: 'prim',           braidage: 0,     indices: 1,        brouillard: false },
    expert:    { id: 'expert',    nom: 'Expert',    algorithme: 'wilson',         braidage: 0,     indices: 0,        brouillard: true }
  };

  const TAILLES = {
    petit:   { id: 'petit',   nom: 'Petit',   largeur: 8,  hauteur: 8  },
    moyen:   { id: 'moyen',   nom: 'Moyen',   largeur: 15, hauteur: 15 },
    grand:   { id: 'grand',   nom: 'Grand',   largeur: 25, hauteur: 25 },
    immense: { id: 'immense', nom: 'Immense', largeur: 40, hauteur: 40 }
  };

  const ORDRE_DIFFICULTES = ['facile', 'normal', 'difficile', 'expert'];
  const ORDRE_TAILLES = ['petit', 'moyen', 'grand', 'immense'];

  /**
   * Fonction principale : construit un labyrinthe complet et prêt à jouer.
   *
   * @param {object} options
   * @param {string} [options.difficulte='normal']  une clé de DIFFICULTES
   * @param {string} [options.taille='moyen']        une clé de TAILLES
   * @param {number} [options.graine]                 graine fixe (sinon tirée au hasard)
   * @returns {{largeur:number, hauteur:number, murs:Uint8Array, depart:number,
   *            arrivee:number, graine:number, difficulte:string, taille:string}}
   */
  function genererLabyrinthe(options) {
    const reglages = options || {};
    const idDifficulte = DIFFICULTES[reglages.difficulte] ? reglages.difficulte : 'normal';
    const idTaille = TAILLES[reglages.taille] ? reglages.taille : 'moyen';
    const difficulte = DIFFICULTES[idDifficulte];
    const taille = TAILLES[idTaille];

    // >>> 0 force un entier non signé sur 32 bits, exactement ce qu'attend mulberry32.
    const graine = (typeof reglages.graine === 'number')
      ? (reglages.graine >>> 0)
      : Math.floor(Math.random() * 4294967296);

    const rng = mulberry32(graine);
    const largeur = taille.largeur;
    const hauteur = taille.hauteur;

    let murs;
    if (difficulte.algorithme === 'prim') {
      murs = genererPrim(largeur, hauteur, rng);
    } else if (difficulte.algorithme === 'wilson') {
      murs = genererWilson(largeur, hauteur, rng);
    } else {
      murs = genererRetourArriere(largeur, hauteur, rng);
    }

    braider(murs, largeur, hauteur, rng, difficulte.braidage);

    const points = choisirDepartEtArrivee(murs, largeur, hauteur);

    return {
      largeur: largeur,
      hauteur: hauteur,
      murs: murs,
      depart: points.depart,
      arrivee: points.arrivee,
      graine: graine,
      difficulte: idDifficulte,
      taille: idTaille
    };
  }

  /** Compte les passages ouverts (sert aux tests : un labyrinthe parfait en a "cellules - 1"). */
  function compterPassages(murs, largeur, hauteur) {
    let compte = 0;
    for (let y = 0; y < hauteur; y++) {
      for (let x = 0; x < largeur; x++) {
        const i = y * largeur + x;
        if (x + 1 < largeur && !(murs[i] & DROITE)) compte++;
        if (y + 1 < hauteur && !(murs[i] & BAS)) compte++;
      }
    }
    return compte;
  }

  /* ========================================================================
     EXPORT
     ------------------------------------------------------------------------
     Ce fichier peut être chargé de deux façons :
       - dans le navigateur avec <script>, où il pose `window.LabyrintheMoteur` ;
       - dans Node.js avec `require(...)`, pour les tests automatiques.
     ======================================================================== */

  const LabyrintheMoteur = {
    // Constantes de murs (utiles au dessin, en phase 2)
    HAUT: HAUT, DROITE: DROITE, BAS: BAS, GAUCHE: GAUCHE,

    // Réglages
    DIFFICULTES: DIFFICULTES,
    TAILLES: TAILLES,
    ORDRE_DIFFICULTES: ORDRE_DIFFICULTES,
    ORDRE_TAILLES: ORDRE_TAILLES,

    // Générateur aléatoire (exposé pour les tests de reproductibilité)
    mulberry32: mulberry32,

    // API principale
    genererLabyrinthe: genererLabyrinthe,
    resoudre: resoudre,
    calculerDistances: calculerDistances,
    compterPassages: compterPassages,
    voisinesOuvertes: voisinesOuvertes
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = LabyrintheMoteur;
  } else {
    global.LabyrintheMoteur = LabyrintheMoteur;
  }

})(typeof window !== 'undefined' ? window : globalThis);

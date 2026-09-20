/* ==========================================================================
   test-labyrinthe.js - Vérifications automatiques du moteur du Labyrinthe
   --------------------------------------------------------------------------
   Ce script ne teste PAS l'affichage (il n'y en a pas ici) : il vérifie
   uniquement que js/labyrinthe-moteur.js produit toujours des labyrinthes
   valides, quels que soient la difficulté, la taille et la graine.

   LANCER LES TESTS :
     node tests/test-labyrinthe.js

   Le script affiche un tableau de résultats puis un résumé. Il se termine
   avec le code de sortie 1 (au lieu de 0) si un seul test échoue, ce qui
   permet de le brancher plus tard dans un outil d'intégration continue.
   ========================================================================== */

'use strict';

const Moteur = require('../js/labyrinthe-moteur.js');

const NB_GRAINES = 200;
// Graines fixes (et non tirées au hasard à chaque lancement) : on veut que
// deux exécutions du script testent exactement les mêmes cas.
const GRAINES = [];
for (let i = 0; i < NB_GRAINES; i++) GRAINES.push(i * 1000 + 1);

const echecs = [];

function verifier(condition, message) {
  if (!condition) echecs.push(message);
}

/* --------------------------------------------------------------------------
   Un accumulateur simple pour calculer moyenne / maximum au fil de l'eau,
   sans garder toutes les valeurs en mémoire.
   -------------------------------------------------------------------------- */
function nouvelAccumulateur() {
  return { total: 0, max: -Infinity, n: 0 };
}
function accumuler(acc, valeur) {
  acc.total += valeur;
  acc.n++;
  if (valeur > acc.max) acc.max = valeur;
}
function moyenne(acc) {
  return acc.n === 0 ? 0 : acc.total / acc.n;
}

/* ==========================================================================
   BOUCLE PRINCIPALE : difficulté x taille x graine
   ========================================================================== */

// Un accumulateur de durée de génération par taille (toutes difficultés
// confondues), comme demandé : "temps de génération moyen et maximum par taille".
const dureesParTaille = {};
Moteur.ORDRE_TAILLES.forEach(function (t) { dureesParTaille[t] = nouvelAccumulateur(); });

// Longueur du chemin optimal par combinaison difficulté x taille.
const cheminsParCombinaison = {};

console.log('Test du moteur de Labyrinthe (' + NB_GRAINES + ' graines x ' +
  Moteur.ORDRE_DIFFICULTES.length + ' difficultés x ' + Moteur.ORDRE_TAILLES.length + ' tailles)...\n');

Moteur.ORDRE_DIFFICULTES.forEach(function (idDifficulte) {
  const difficulte = Moteur.DIFFICULTES[idDifficulte];

  Moteur.ORDRE_TAILLES.forEach(function (idTaille) {
    const taille = Moteur.TAILLES[idTaille];
    const total = taille.largeur * taille.hauteur;
    const cle = idDifficulte + ' / ' + idTaille;
    const accChemins = nouvelAccumulateur();
    cheminsParCombinaison[cle] = accChemins;

    GRAINES.forEach(function (graine) {
      const avant = process.hrtime.bigint();
      const labyrinthe = Moteur.genererLabyrinthe({ difficulte: idDifficulte, taille: idTaille, graine: graine });
      const apres = process.hrtime.bigint();
      const dureeMs = Number(apres - avant) / 1e6;
      accumuler(dureesParTaille[idTaille], dureeMs);

      const prefixe = cle + ' [graine ' + graine + '] : ';

      /* ---- 1. Connexité : toutes les cellules sont atteignables ---- */
      // On part d'une cellule arbitraire (le coin 0) : peu importe laquelle,
      // puisqu'un labyrinthe correct doit relier TOUTES les cellules entre elles.
      const distancesDepuisCoin = Moteur.calculerDistances(labyrinthe.murs, labyrinthe.largeur, labyrinthe.hauteur, 0);
      let atteignables = 0;
      for (let i = 0; i < distancesDepuisCoin.length; i++) if (distancesDepuisCoin[i] !== -1) atteignables++;
      verifier(atteignables === total, prefixe + 'labyrinthe non entièrement connecté (' + atteignables + '/' + total + ' cellules atteignables)');

      /* ---- 2. Labyrinthe parfait <=> passages = cellules - 1 ---- */
      const passages = Moteur.compterPassages(labyrinthe.murs, labyrinthe.largeur, labyrinthe.hauteur);
      if (difficulte.braidage === 0) {
        verifier(passages === total - 1, prefixe + 'labyrinthe parfait attendu, mais ' + passages + ' passages au lieu de ' + (total - 1));
      } else {
        // Avec braidage, on attend AU MOINS le squelette parfait, et parfois plus (des boucles).
        verifier(passages >= total - 1, prefixe + 'moins de passages qu\'un labyrinthe parfait (' + passages + ' < ' + (total - 1) + ')');
      }

      /* ---- 3. Départ et arrivée valides et bien éloignés ---- */
      // Distances calculées depuis la VRAIE cellule de départ du labyrinthe
      // (et non depuis le coin, qui n'est qu'un point de calcul intermédiaire
      // utilisé par choisirDepartEtArrivee).
      const distancesDepuisDepart = Moteur.calculerDistances(labyrinthe.murs, labyrinthe.largeur, labyrinthe.hauteur, labyrinthe.depart);
      verifier(labyrinthe.depart !== labyrinthe.arrivee, prefixe + 'départ et arrivée identiques');
      const distanceDepartArrivee = distancesDepuisDepart[labyrinthe.arrivee];
      verifier(distanceDepartArrivee > 0, prefixe + 'distance départ/arrivée invalide');

      /* ---- 4. Reproductibilité : même graine => même résultat ---- */
      const labyrintheBis = Moteur.genererLabyrinthe({ difficulte: idDifficulte, taille: idTaille, graine: graine });
      let identique = labyrinthe.depart === labyrintheBis.depart && labyrinthe.arrivee === labyrintheBis.arrivee;
      if (identique) {
        for (let i = 0; i < labyrinthe.murs.length; i++) {
          if (labyrinthe.murs[i] !== labyrintheBis.murs[i]) { identique = false; break; }
        }
      }
      verifier(identique, prefixe + 'deux générations avec la même graine diffèrent');

      /* ---- 5. Le solveur trouve un chemin valide et optimal ---- */
      const chemin = Moteur.resoudre(labyrinthe.murs, labyrinthe.largeur, labyrinthe.hauteur, labyrinthe.depart, labyrinthe.arrivee);
      verifier(chemin !== null, prefixe + 'le solveur ne trouve aucun chemin');
      if (chemin) {
        verifier(chemin[0] === labyrinthe.depart, prefixe + 'le chemin ne commence pas au départ');
        verifier(chemin[chemin.length - 1] === labyrinthe.arrivee, prefixe + 'le chemin ne finit pas à l\'arrivée');
        // Optimalité : la longueur du chemin doit correspondre exactement à
        // la distance BFS, jamais plus (et le BFS garantit qu'il ne peut pas
        // non plus être plus court qu'un autre chemin existant).
        verifier(chemin.length - 1 === distanceDepartArrivee, prefixe + 'chemin non optimal (' + (chemin.length - 1) + ' pas au lieu de ' + distanceDepartArrivee + ')');

        // Chaque pas du chemin doit vraiment franchir un mur percé (aucun
        // passage "à travers un mur").
        for (let i = 0; i < chemin.length - 1; i++) {
          const ouvertes = Moteur.voisinesOuvertes(labyrinthe.murs, chemin[i], labyrinthe.largeur, labyrinthe.hauteur);
          if (ouvertes.indexOf(chemin[i + 1]) === -1) {
            verifier(false, prefixe + 'le chemin traverse un mur entre ' + chemin[i] + ' et ' + chemin[i + 1]);
            break;
          }
        }

        accumuler(accChemins, chemin.length - 1);
      }
    });
  });
});

/* ==========================================================================
   RÉSUMÉ
   ========================================================================== */

console.log('Longueur moyenne du chemin optimal, par combinaison :\n');
console.log(pad('Difficulté / taille', 24) + pad('Chemin moyen', 14) + 'Chemin max');
console.log('-'.repeat(52));
Moteur.ORDRE_DIFFICULTES.forEach(function (d) {
  Moteur.ORDRE_TAILLES.forEach(function (t) {
    const acc = cheminsParCombinaison[d + ' / ' + t];
    console.log(pad(d + ' / ' + t, 24) + pad(moyenne(acc).toFixed(1), 14) + acc.max);
  });
});

console.log('\nTemps de génération, par taille (toutes difficultés confondues) :\n');
console.log(pad('Taille', 12) + pad('Moyen (ms)', 14) + 'Maximum (ms)');
console.log('-'.repeat(38));
Moteur.ORDRE_TAILLES.forEach(function (t) {
  const acc = dureesParTaille[t];
  console.log(pad(t, 12) + pad(moyenne(acc).toFixed(3), 14) + acc.max.toFixed(3));
});

// Objectif de performance explicitement demandé : Immense < 150 ms.
const accImmense = dureesParTaille.immense;
verifier(accImmense.max < 150, 'Objectif de performance non atteint : Immense a pris jusqu\'à ' + accImmense.max.toFixed(1) + ' ms (objectif : < 150 ms)');

console.log('\n' + '='.repeat(52));
if (echecs.length === 0) {
  console.log('TOUT EST OK : ' + (NB_GRAINES * Moteur.ORDRE_DIFFICULTES.length * Moteur.ORDRE_TAILLES.length) + ' labyrinthes vérifiés, aucune anomalie.');
  process.exit(0);
} else {
  console.log(echecs.length + ' ÉCHEC(S) :\n');
  // On n'affiche pas les centaines d'échecs potentiels un par un : un
  // échantillon suffit à comprendre le problème.
  echecs.slice(0, 30).forEach(function (m) { console.log('  - ' + m); });
  if (echecs.length > 30) console.log('  ... et ' + (echecs.length - 30) + ' autre(s).');
  process.exit(1);
}

function pad(texte, longueur) {
  texte = String(texte);
  while (texte.length < longueur) texte += ' ';
  return texte;
}

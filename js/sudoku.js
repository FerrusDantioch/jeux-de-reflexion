/* ==========================================================================
   sudoku.js - Le jeu de Sudoku
   --------------------------------------------------------------------------
   SOMMAIRE DU FICHIER
     1. Reglages (niveaux de difficulte)
     2. Le moteur : generation d'une grille aleatoire a solution unique
     3. L'etat de la partie
     4. Construction de l'interface
     5. Les actions du joueur (saisie, notes, indice, annuler/retablir)
     6. Sauvegarde et reprise de la partie
     7. Inscription du jeu dans le menu de l'application

   REPRESENTATION DE LA GRILLE
     Une grille de Sudoku est ici un simple tableau de 81 nombres (et non un
     tableau de tableaux) : c'est plus rapide et plus simple a copier.
       index = ligne * 9 + colonne     (index de 0 a 80)
       0 signifie « case vide »
   ========================================================================== */

window.Jeux = window.Jeux || {};

(function () {
  'use strict';

  const ID = 'sudoku';

  /* ======================================================================
     1. REGLAGES
     ====================================================================== */

  /* « indices » = nombre de cases deja remplies au depart.
     Moins il y a de cases remplies, plus la grille est difficile. */
  const NIVEAUX = [
    { id: 'facile',    nom: 'Facile',    indices: 46, detail: 'environ 46 cases remplies' },
    { id: 'moyen',     nom: 'Moyen',     indices: 38, detail: 'environ 38 cases remplies' },
    { id: 'difficile', nom: 'Difficile', indices: 31, detail: 'environ 31 cases remplies' },
    { id: 'expert',    nom: 'Expert',    indices: 26, detail: 'environ 26 cases remplies' }
  ];

  function trouverNiveau(idNiveau) {
    return NIVEAUX.find(function (n) { return n.id === idNiveau; }) || NIVEAUX[0];
  }

  /* ======================================================================
     2. LE MOTEUR DE GENERATION
     ----------------------------------------------------------------------
     ASTUCE DE PERFORMANCE : les « masques de bits ».
     Plutot que de parcourir 9 cases pour savoir si le chiffre 5 est deja
     present dans une ligne, on stocke un seul nombre par ligne dans lequel
     chaque bit represente un chiffre :
        bit 1 -> chiffre 1, bit 2 -> chiffre 2, ... bit 9 -> chiffre 9
     Tester la presence du 5 revient alors a « lignes[3] & (1 << 5) », ce qui
     est immediat. C'est ce qui rend le solveur assez rapide pour verifier
     l'unicite de la solution des dizaines de fois par grille generee.
     ====================================================================== */

  // 0b1111111110 : les bits 1 a 9 sont a 1 (le bit 0 n'est pas utilise).
  const MASQUE_COMPLET = 1022;

  // Pour chaque index de case, le numero du bloc 3x3 auquel elle appartient.
  // On le calcule une fois pour toutes au chargement du fichier.
  const BLOC = new Array(81);
  for (let i = 0; i < 81; i++) {
    const ligne = Math.floor(i / 9);
    const colonne = i % 9;
    BLOC[i] = Math.floor(ligne / 3) * 3 + Math.floor(colonne / 3);
  }

  /** Compte le nombre de bits a 1, c'est-a-dire le nombre de chiffres possibles. */
  function nombreDeBits(n) {
    let compte = 0;
    while (n) {
      n &= n - 1;      // astuce classique : efface le bit a 1 le plus a droite
      compte++;
    }
    return compte;
  }

  /** Construit les trois tableaux de masques a partir d'une grille. */
  function calculerMasques(grille) {
    const lignes = new Array(9).fill(0);
    const colonnes = new Array(9).fill(0);
    const blocs = new Array(9).fill(0);
    for (let i = 0; i < 81; i++) {
      const valeur = grille[i];
      if (valeur === 0) continue;
      const bit = 1 << valeur;
      lignes[Math.floor(i / 9)] |= bit;
      colonnes[i % 9] |= bit;
      blocs[BLOC[i]] |= bit;
    }
    return { lignes: lignes, colonnes: colonnes, blocs: blocs };
  }

  /**
   * Cherche la case vide ayant le MOINS de chiffres possibles.
   * On l'appelle l'heuristique MRV (Minimum Remaining Values) : commencer par
   * la case la plus contrainte reduit enormement le nombre d'essais.
   * @returns {object|null} { index, candidats } ou null si la grille est pleine
   */
  function caseLaPlusContrainte(grille, m) {
    let meilleurIndex = -1;
    let meilleursCandidats = 0;
    let minimum = 10;

    for (let i = 0; i < 81; i++) {
      if (grille[i] !== 0) continue;
      const libres = MASQUE_COMPLET & ~(m.lignes[Math.floor(i / 9)] | m.colonnes[i % 9] | m.blocs[BLOC[i]]);
      const combien = nombreDeBits(libres);
      if (combien === 0) return { index: i, candidats: 0 };  // impasse
      if (combien < minimum) {
        minimum = combien;
        meilleurIndex = i;
        meilleursCandidats = libres;
        if (combien === 1) break;   // on ne fera pas mieux
      }
    }
    if (meilleurIndex === -1) return null;                    // grille complete
    return { index: meilleurIndex, candidats: meilleursCandidats };
  }

  /** Transforme un masque de candidats en tableau de chiffres. Ex : 34 -> [1, 5] */
  function listerCandidats(masque) {
    const liste = [];
    for (let v = 1; v <= 9; v++) {
      if (masque & (1 << v)) liste.push(v);
    }
    return liste;
  }

  /**
   * Remplit une grille par retour sur trace (backtracking) en essayant les
   * chiffres dans un ordre ALEATOIRE : chaque appel produit donc une grille
   * complete differente. C'est la base de la generation aleatoire.
   * @returns {boolean} true si la grille a pu etre completee
   */
  function remplirAleatoirement(grille, m) {
    const choix = caseLaPlusContrainte(grille, m);
    if (choix === null) return true;      // toutes les cases sont remplies
    if (choix.candidats === 0) return false;

    const index = choix.index;
    const ligne = Math.floor(index / 9);
    const colonne = index % 9;
    const bloc = BLOC[index];
    const valeurs = Outils.melanger(listerCandidats(choix.candidats));

    for (let k = 0; k < valeurs.length; k++) {
      const bit = 1 << valeurs[k];
      // On pose le chiffre...
      grille[index] = valeurs[k];
      m.lignes[ligne] |= bit; m.colonnes[colonne] |= bit; m.blocs[bloc] |= bit;

      if (remplirAleatoirement(grille, m)) return true;

      // ...et on l'enleve si la suite mene a une impasse (c'est le « retour »).
      grille[index] = 0;
      m.lignes[ligne] &= ~bit; m.colonnes[colonne] &= ~bit; m.blocs[bloc] &= ~bit;
    }
    return false;
  }

  /**
   * Compte les solutions d'une grille, en s'arretant des qu'on en a trouve
   * `limite`. Appele avec limite = 2, il repond a la question qui nous
   * interesse : « cette grille a-t-elle UNE SEULE solution ? »
   */
  function compterSolutions(grille, limite) {
    const travail = grille.slice();       // on travaille sur une copie
    const m = calculerMasques(travail);
    const compteur = { total: 0 };
    explorer(travail, m, limite, compteur);
    return compteur.total;
  }

  function explorer(grille, m, limite, compteur) {
    if (compteur.total >= limite) return;

    const choix = caseLaPlusContrainte(grille, m);
    if (choix === null) { compteur.total++; return; }   // grille pleine = 1 solution
    if (choix.candidats === 0) return;                  // impasse

    const index = choix.index;
    const ligne = Math.floor(index / 9);
    const colonne = index % 9;
    const bloc = BLOC[index];

    for (let v = 1; v <= 9; v++) {
      if (!(choix.candidats & (1 << v))) continue;
      const bit = 1 << v;
      grille[index] = v;
      m.lignes[ligne] |= bit; m.colonnes[colonne] |= bit; m.blocs[bloc] |= bit;

      explorer(grille, m, limite, compteur);

      grille[index] = 0;
      m.lignes[ligne] &= ~bit; m.colonnes[colonne] &= ~bit; m.blocs[bloc] &= ~bit;

      if (compteur.total >= limite) return;
    }
  }

  /**
   * Genere une enigme complete et garantie a solution unique.
   *
   * METHODE (la plus courante) :
   *   1. on fabrique une grille pleine valide, au hasard ;
   *   2. on vide les cases une par une, dans un ordre aleatoire ;
   *   3. apres chaque suppression on verifie qu'il reste EXACTEMENT une
   *      solution ; sinon on remet le chiffre.
   * On s'arrete quand on atteint le nombre de cases remplies vise.
   *
   * Remarque : selon le tirage, il n'est pas toujours possible de descendre
   * jusqu'au nombre exact demande. La grille reste alors legerement plus
   * facile que prevu, mais elle est toujours valide et a solution unique.
   */
  function genererEnigme(indicesVises) {
    const solution = new Array(81).fill(0);
    remplirAleatoirement(solution, calculerMasques(solution));

    const enigme = solution.slice();
    const positions = Outils.melanger(
      Array.from({ length: 81 }, function (_, i) { return i; })
    );

    let casesRemplies = 81;
    for (let k = 0; k < positions.length && casesRemplies > indicesVises; k++) {
      const position = positions[k];
      const memoire = enigme[position];
      enigme[position] = 0;

      if (compterSolutions(enigme, 2) === 1) {
        casesRemplies--;                 // suppression validee
      } else {
        enigme[position] = memoire;      // deux solutions : on annule
      }
    }

    return { enigme: enigme, solution: solution, casesRemplies: casesRemplies };
  }

  /* ======================================================================
     3. ETAT DE LA PARTIE
     ====================================================================== */

  let etat = null;      // toutes les donnees de la partie en cours
  let vue = null;       // les elements HTML, pour ne pas les rechercher sans cesse

  function etatNeuf(idNiveau, enigme, solution) {
    return {
      niveau: idNiveau,
      enigme: enigme,                                  // grille de depart (0 = vide)
      solution: solution,                              // la reponse complete
      valeurs: enigme.slice(),                         // ce que le joueur voit
      notes: Array.from({ length: 81 }, function () { return []; }), // crayon
      revelees: new Array(81).fill(false),             // cases donnees par un indice
      historique: [],                                  // pour annuler / retablir
      positionHistorique: 0,
      selection: null,                                 // index de la case choisie
      modeNotes: false,
      detection: true,                                 // signaler les erreurs ?
      indicesUtilises: 0,
      temps: 0,
      terminee: false
    };
  }

  /* ======================================================================
     4. CONSTRUCTION DE L'INTERFACE
     ====================================================================== */

  function construireInterface(conteneur) {
    Outils.vider(conteneur);

    /* --- Bandeau du haut : temps, record, indices utilises --- */
    const bandeau = Outils.creer('div', { classe: 'bandeau-jeu' });
    const infoTemps   = creerInfo('Temps', '00:00');
    const infoRecord  = creerInfo('Record', '--:--');
    const infoIndices = creerInfo('Indices', '0');
    bandeau.append(infoTemps.bloc, infoRecord.bloc, infoIndices.bloc);
    conteneur.appendChild(bandeau);

    /* --- La grille : 81 boutons --- */
    const grille = Outils.creer('div', {
      classe: 'grille-sudoku',
      attributs: { role: 'grid', 'aria-label': 'Grille de sudoku' }
    });

    const cases = [];
    for (let i = 0; i < 81; i++) {
      const colonne = i % 9;
      const ligne = Math.floor(i / 9);

      let classes = 'case-sudoku';
      // Traits epais a droite des colonnes 2 et 5, en bas des lignes 2 et 5 :
      // c'est ce qui dessine les neuf blocs de 3x3.
      if (colonne === 2 || colonne === 5) classes += ' bord-droit';
      if (ligne === 2 || ligne === 5) classes += ' bord-bas';

      const bouton = Outils.creer('button', {
        classe: classes,
        attributs: { type: 'button', 'data-index': String(i), 'aria-label': 'ligne ' + (ligne + 1) + ' colonne ' + (colonne + 1) }
      });

      const valeur = Outils.creer('span', { classe: 'valeur-case' });
      const notes = Outils.creer('div', { classe: 'notes-sudoku' });
      for (let n = 1; n <= 9; n++) notes.appendChild(Outils.creer('span'));

      bouton.append(valeur, notes);
      grille.appendChild(bouton);
      cases.push({ bouton: bouton, valeur: valeur, notes: notes });
    }
    conteneur.appendChild(grille);

    /* --- Pave numerique tactile --- */
    const pave = Outils.creer('div', { classe: 'pave-numerique' });
    const touches = [];
    for (let chiffre = 1; chiffre <= 9; chiffre++) {
      const touche = Outils.creer('button', {
        classe: 'touche-chiffre',
        texte: String(chiffre),
        attributs: { type: 'button', 'data-chiffre': String(chiffre) }
      });
      pave.appendChild(touche);
      touches.push(touche);
    }
    const gomme = Outils.creer('button', {
      classe: 'touche-chiffre gomme',
      texte: 'Effacer',
      attributs: { type: 'button', 'data-chiffre': '0', 'aria-label': 'Effacer la case' }
    });
    pave.appendChild(gomme);
    conteneur.appendChild(pave);

    const temoinNotes = Outils.creer('p', {
      classe: 'indicateur-notes',
      texte: 'Mode crayon actif : les chiffres saisis deviennent des notes.'
    });
    temoinNotes.hidden = true;
    conteneur.appendChild(temoinNotes);

    /* --- Barre d'actions --- */
    const actions = Outils.creer('div', { classe: 'barre-actions' });
    const boutons = {
      annuler:   bouton('Annuler'),
      retablir:  bouton('Retablir'),
      notes:     bouton('Crayon'),
      indice:    bouton('Indice'),
      detection: bouton('Erreurs'),
      nouvelle:  bouton('Nouvelle')
    };
    Object.keys(boutons).forEach(function (cle) { actions.appendChild(boutons[cle]); });
    conteneur.appendChild(actions);

    vue = {
      conteneur: conteneur,
      cases: cases,
      touches: touches,
      gomme: gomme,
      boutons: boutons,
      temoinNotes: temoinNotes,
      valeurTemps: infoTemps.valeur,
      valeurRecord: infoRecord.valeur,
      valeurIndices: infoIndices.valeur
    };

    brancherEvenements();
  }

  function bouton(texte) {
    return Outils.creer('button', { classe: 'bouton', texte: texte, attributs: { type: 'button' } });
  }

  function creerInfo(etiquette, valeurInitiale) {
    const bloc = Outils.creer('div', { classe: 'info-jeu' });
    bloc.appendChild(Outils.creer('span', { classe: 'etiquette', texte: etiquette }));
    const valeur = Outils.creer('span', { classe: 'valeur', texte: valeurInitiale });
    bloc.appendChild(valeur);
    return { bloc: bloc, valeur: valeur };
  }

  /* ======================================================================
     5. EVENEMENTS ET ACTIONS DU JOUEUR
     ====================================================================== */

  let chrono = null;

  function brancherEvenements() {
    // Un seul ecouteur pose sur la grille entiere plutot que 81 ecouteurs :
    // c'est la « delegation d'evenement », plus economique et plus simple.
    vue.cases[0].bouton.parentNode.addEventListener('click', function (evenement) {
      const bouton = evenement.target.closest('.case-sudoku');
      if (!bouton) return;
      selectionner(Number(bouton.dataset.index));
    });

    vue.touches.forEach(function (touche) {
      touche.addEventListener('click', function () {
        saisir(Number(touche.dataset.chiffre));
      });
    });
    vue.gomme.addEventListener('click', function () { saisir(0); });

    vue.boutons.annuler.addEventListener('click', annuler);
    vue.boutons.retablir.addEventListener('click', retablir);
    vue.boutons.notes.addEventListener('click', basculerNotes);
    vue.boutons.indice.addEventListener('click', donnerIndice);
    vue.boutons.detection.addEventListener('click', basculerDetection);
    vue.boutons.nouvelle.addEventListener('click', demanderNouvellePartie);

    document.addEventListener('keydown', auClavier);
  }

  /** Gestion du clavier physique (ordinateur). */
  function auClavier(evenement) {
    if (!etat || etat.terminee) return;
    // Si une fenetre modale est ouverte, on laisse le clavier tranquille.
    if (!document.getElementById('fond-modale').hidden) return;

    const touche = evenement.key;

    // Ctrl+Z / Ctrl+Y : annuler et retablir
    if ((evenement.ctrlKey || evenement.metaKey) && touche.toLowerCase() === 'z') {
      evenement.preventDefault();
      if (evenement.shiftKey) retablir(); else annuler();
      return;
    }
    if ((evenement.ctrlKey || evenement.metaKey) && touche.toLowerCase() === 'y') {
      evenement.preventDefault();
      retablir();
      return;
    }
    if (evenement.ctrlKey || evenement.metaKey) return;

    // Deplacement au clavier avec les fleches
    const deplacements = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (deplacements[touche] !== undefined) {
      evenement.preventDefault();
      deplacerSelection(deplacements[touche]);
      return;
    }

    if (touche >= '1' && touche <= '9') {
      evenement.preventDefault();
      saisir(Number(touche));
    } else if (touche === '0' || touche === 'Backspace' || touche === 'Delete') {
      evenement.preventDefault();
      saisir(0);
    } else if (touche.toLowerCase() === 'n') {
      basculerNotes();
    } else if (touche.toLowerCase() === 'h') {
      donnerIndice();
    }
  }

  function deplacerSelection(pas) {
    let depart = etat.selection === null ? 0 : etat.selection;
    // Les fleches gauche/droite ne doivent pas « sauter » a la ligne suivante.
    if (pas === -1 && depart % 9 === 0) return;
    if (pas === 1 && depart % 9 === 8) return;
    const cible = depart + pas;
    if (cible < 0 || cible > 80) return;
    selectionner(cible);
  }

  function selectionner(index) {
    if (!etat || etat.terminee) return;
    etat.selection = index;
    rafraichir();
  }

  /**
   * Ecrit un chiffre (ou l'efface avec 0) dans la case selectionnee.
   * En mode crayon, le chiffre est ajoute ou retire des notes.
   */
  function saisir(chiffre) {
    if (!etat || etat.terminee) return;
    const index = etat.selection;
    if (index === null) {
      Outils.info('Choisissez d\'abord une case.');
      return;
    }
    // Les chiffres de depart ne se modifient jamais.
    if (etat.enigme[index] !== 0) return;

    // On memorise l'etat AVANT modification pour pouvoir annuler.
    const avant = {
      valeur: etat.valeurs[index],
      notes: etat.notes[index].slice(),
      revelee: etat.revelees[index]
    };

    if (etat.modeNotes && chiffre !== 0) {
      // Poser une note n'a de sens que dans une case vide.
      if (etat.valeurs[index] !== 0) return;
      const position = etat.notes[index].indexOf(chiffre);
      if (position === -1) etat.notes[index].push(chiffre);
      else etat.notes[index].splice(position, 1);
      etat.notes[index].sort();
    } else if (chiffre === 0) {
      if (etat.valeurs[index] === 0 && etat.notes[index].length === 0) return;
      etat.valeurs[index] = 0;
      etat.notes[index] = [];
      etat.revelees[index] = false;
    } else {
      // Reappuyer sur le meme chiffre efface la case : pratique au doigt.
      etat.valeurs[index] = (etat.valeurs[index] === chiffre) ? 0 : chiffre;
      etat.notes[index] = [];
      etat.revelees[index] = false;
      if (etat.valeurs[index] !== 0) nettoyerNotesVoisines(index, etat.valeurs[index]);
    }

    const apres = {
      valeur: etat.valeurs[index],
      notes: etat.notes[index].slice(),
      revelee: etat.revelees[index]
    };

    empilerAction({ index: index, avant: avant, apres: apres });
    rafraichir();
    verifierVictoire();
    sauvegarder();
  }

  /**
   * Confort de jeu : quand on pose un chiffre, on retire automatiquement ce
   * chiffre des notes de la meme ligne, colonne et bloc.
   * (Ces suppressions ne sont pas annulables individuellement : elles font
   *  partie de la meme action que la saisie du chiffre.)
   */
  function nettoyerNotesVoisines(index, chiffre) {
    const ligne = Math.floor(index / 9);
    const colonne = index % 9;
    for (let i = 0; i < 81; i++) {
      if (i === index) continue;
      const memeLigne = Math.floor(i / 9) === ligne;
      const memeColonne = i % 9 === colonne;
      const memeBloc = BLOC[i] === BLOC[index];
      if (!memeLigne && !memeColonne && !memeBloc) continue;
      const position = etat.notes[i].indexOf(chiffre);
      if (position !== -1) etat.notes[i].splice(position, 1);
    }
  }

  /* --- Annuler / Retablir ------------------------------------------------
     L'historique est une pile d'actions et un curseur (positionHistorique).
     Annuler recule le curseur, retablir l'avance. Si on joue un nouveau coup
     apres avoir annule, on efface ce qui se trouvait « devant » : c'est le
     comportement habituel de tous les logiciels.                          */

  function empilerAction(action) {
    etat.historique.length = etat.positionHistorique;
    etat.historique.push(action);
    etat.positionHistorique++;
    // On limite la taille de l'historique pour ne pas saturer la sauvegarde.
    if (etat.historique.length > 200) {
      etat.historique.shift();
      etat.positionHistorique--;
    }
  }

  function annuler() {
    if (!etat || etat.terminee || etat.positionHistorique === 0) return;
    etat.positionHistorique--;
    appliquer(etat.historique[etat.positionHistorique], 'avant');
  }

  function retablir() {
    if (!etat || etat.terminee || etat.positionHistorique >= etat.historique.length) return;
    appliquer(etat.historique[etat.positionHistorique], 'apres');
    etat.positionHistorique++;
  }

  function appliquer(action, sens) {
    const cliche = action[sens];
    etat.valeurs[action.index] = cliche.valeur;
    etat.notes[action.index] = cliche.notes.slice();
    etat.revelees[action.index] = cliche.revelee;
    etat.selection = action.index;
    etat.terminee = false;
    rafraichir();
    sauvegarder();
  }

  /* --- Mode crayon et detection des erreurs --- */

  function basculerNotes() {
    if (!etat) return;
    etat.modeNotes = !etat.modeNotes;
    rafraichir();
  }

  function basculerDetection() {
    if (!etat) return;
    etat.detection = !etat.detection;
    Outils.info(etat.detection ? 'Detection des erreurs activee' : 'Detection des erreurs desactivee');
    rafraichir();
    sauvegarder();
  }

  /* --- Indice --- */

  function donnerIndice() {
    if (!etat || etat.terminee) return;

    // On revele en priorite la case selectionnee si elle est vide ou fausse.
    let cible = etat.selection;
    const inutile = cible === null || etat.enigme[cible] !== 0 ||
                    etat.valeurs[cible] === etat.solution[cible];
    if (inutile) {
      const candidates = [];
      for (let i = 0; i < 81; i++) {
        if (etat.enigme[i] === 0 && etat.valeurs[i] !== etat.solution[i]) candidates.push(i);
      }
      if (candidates.length === 0) return;
      cible = Outils.auHasard(candidates);
    }

    const avant = { valeur: etat.valeurs[cible], notes: etat.notes[cible].slice(), revelee: etat.revelees[cible] };
    etat.valeurs[cible] = etat.solution[cible];
    etat.notes[cible] = [];
    etat.revelees[cible] = true;
    nettoyerNotesVoisines(cible, etat.solution[cible]);
    const apres = { valeur: etat.valeurs[cible], notes: [], revelee: true };

    empilerAction({ index: cible, avant: avant, apres: apres });
    etat.indicesUtilises++;
    etat.selection = cible;

    Outils.vibrer(20);
    rafraichir();
    verifierVictoire();
    sauvegarder();
  }

  /* --- Nouvelle partie --- */

  function demanderNouvellePartie() {
    Outils.modale({
      titre: 'Nouvelle grille ?',
      message: 'La partie en cours sera definitivement perdue.',
      boutons: [
        { texte: 'Nouvelle grille', valeur: true, principal: true },
        { texte: 'Continuer a jouer', valeur: false }
      ]
    }).then(function (confirme) {
      if (confirme) lancerPartie(etat.niveau, false);
    });
  }

  /* ======================================================================
     RAFRAICHISSEMENT DE L'AFFICHAGE
     ----------------------------------------------------------------------
     Une seule fonction redessine tout a partir de l'etat. C'est un peu moins
     optimise que de modifier uniquement la case concernee, mais infiniment
     plus simple a comprendre et a maintenir : il n'y a jamais de decalage
     possible entre ce qui est affiche et l'etat reel de la partie.
     ====================================================================== */

  function rafraichir() {
    if (!etat || !vue) return;

    const selection = etat.selection;
    const ligneSel = selection === null ? -1 : Math.floor(selection / 9);
    const colonneSel = selection === null ? -1 : selection % 9;
    const blocSel = selection === null ? -1 : BLOC[selection];
    const valeurSel = selection === null ? 0 : etat.valeurs[selection];

    // Combien de fois chaque chiffre est-il deja place correctement ?
    const comptes = new Array(10).fill(0);
    for (let i = 0; i < 81; i++) {
      if (etat.valeurs[i] !== 0) comptes[etat.valeurs[i]]++;
    }

    for (let i = 0; i < 81; i++) {
      const c = vue.cases[i];
      const valeur = etat.valeurs[i];
      const estDonnee = etat.enigme[i] !== 0;

      c.valeur.textContent = valeur === 0 ? '' : String(valeur);

      // Les notes ne s'affichent que dans les cases vides.
      const notes = valeur === 0 ? etat.notes[i] : [];
      for (let n = 0; n < 9; n++) {
        c.notes.children[n].textContent = notes.indexOf(n + 1) !== -1 ? String(n + 1) : '';
      }

      // Reconstruction de la liste des classes CSS de la case
      let classes = 'case-sudoku';
      if (i % 9 === 2 || i % 9 === 5) classes += ' bord-droit';
      if (Math.floor(i / 9) === 2 || Math.floor(i / 9) === 5) classes += ' bord-bas';
      if (estDonnee) classes += ' donnee';
      if (etat.revelees[i]) classes += ' revelee';
      if (etat.detection && valeur !== 0 && !estDonnee && valeur !== etat.solution[i]) classes += ' erreur';

      if (i === selection) {
        classes += ' selectionnee';
      } else if (selection !== null) {
        if (valeur !== 0 && valeur === valeurSel) classes += ' meme-valeur';
        else if (Math.floor(i / 9) === ligneSel || i % 9 === colonneSel || BLOC[i] === blocSel) classes += ' surlignee';
      }
      c.bouton.className = classes;
    }

    // Chiffres deja places neuf fois : on estompe la touche correspondante.
    vue.touches.forEach(function (touche, position) {
      touche.classList.toggle('epuisee', comptes[position + 1] >= 9);
    });

    // Etat des boutons d'action
    vue.boutons.annuler.disabled = etat.positionHistorique === 0;
    vue.boutons.retablir.disabled = etat.positionHistorique >= etat.historique.length;
    vue.boutons.notes.classList.toggle('actif', etat.modeNotes);
    vue.boutons.detection.classList.toggle('actif', etat.detection);
    vue.temoinNotes.hidden = !etat.modeNotes;
    vue.valeurIndices.textContent = String(etat.indicesUtilises);
  }

  function afficherTemps(ms) {
    if (vue) vue.valeurTemps.textContent = Outils.formaterTemps(ms);
  }

  /* ======================================================================
     VICTOIRE
     ====================================================================== */

  function verifierVictoire() {
    for (let i = 0; i < 81; i++) {
      if (etat.valeurs[i] === 0) return;              // grille incomplete
    }
    for (let i = 0; i < 81; i++) {
      if (etat.valeurs[i] !== etat.solution[i]) {
        Outils.info('La grille est complete mais contient une erreur.');
        return;
      }
    }

    etat.terminee = true;
    etat.temps = chrono.temps();
    chrono.arreter();
    Parties.effacer(ID);
    Outils.vibrer([30, 60, 30]);

    // Une partie terminee avec des indices ne compte pas comme un record :
    // ce serait injuste vis-a-vis des parties jouees sans aide.
    let record = false;
    if (etat.indicesUtilises === 0) {
      record = Records.enregistrer(ID, 'temps', etat.niveau, etat.temps);
    }
    afficherRecord();

    const niveau = trouverNiveau(etat.niveau);
    let message = 'Grille ' + niveau.nom.toLowerCase() + ' resolue en ' +
                  Outils.formaterTemps(etat.temps) + '.';
    if (etat.indicesUtilises > 0) {
      message += ' (' + etat.indicesUtilises + ' indice' +
                 (etat.indicesUtilises > 1 ? 's' : '') + ' utilise' +
                 (etat.indicesUtilises > 1 ? 's' : '') + ' : le temps ne compte pas pour le record.)';
    } else if (record) {
      message += ' Nouveau record !';
    }

    Outils.modale({
      titre: record ? 'Nouveau record !' : 'Grille resolue !',
      message: message,
      boutons: [
        { texte: 'Nouvelle grille', valeur: 'nouvelle', principal: true },
        { texte: 'Retour au menu', valeur: 'menu' }
      ]
    }).then(function (choix) {
      if (choix === 'nouvelle') lancerPartie(etat.niveau, false);
      else if (choix === 'menu') App.retour();
    });
  }

  function afficherRecord() {
    if (!vue || !etat) return;
    const meilleur = Records.meilleur(ID, 'temps', etat.niveau);
    vue.valeurRecord.textContent = meilleur === null ? '--:--' : Outils.formaterTemps(meilleur);
  }

  /* ======================================================================
     6. SAUVEGARDE ET REPRISE
     ====================================================================== */

  function sauvegarder() {
    if (!etat || etat.terminee) return;
    Parties.sauvegarder(ID, {
      niveau: etat.niveau,
      enigme: etat.enigme,
      solution: etat.solution,
      valeurs: etat.valeurs,
      notes: etat.notes,
      revelees: etat.revelees,
      historique: etat.historique,
      positionHistorique: etat.positionHistorique,
      modeNotes: etat.modeNotes,
      detection: etat.detection,
      indicesUtilises: etat.indicesUtilises,
      temps: chrono ? chrono.temps() : 0
    });
  }

  function restaurer(donnees) {
    const restaure = etatNeuf(donnees.niveau, donnees.enigme, donnees.solution);
    restaure.valeurs = donnees.valeurs;
    restaure.notes = donnees.notes;
    restaure.revelees = donnees.revelees;
    restaure.historique = donnees.historique || [];
    restaure.positionHistorique = donnees.positionHistorique || 0;
    restaure.modeNotes = !!donnees.modeNotes;
    restaure.detection = donnees.detection !== false;
    restaure.indicesUtilises = donnees.indicesUtilises || 0;
    restaure.temps = donnees.temps || 0;
    return restaure;
  }

  /* ======================================================================
     LANCEMENT D'UNE PARTIE
     ====================================================================== */

  function lancerPartie(idNiveau, reprendre) {
    const sauvegarde = reprendre ? Parties.charger(ID) : null;

    if (sauvegarde && sauvegarde.valeurs && sauvegarde.solution) {
      etat = restaurer(sauvegarde);
    } else {
      const niveau = trouverNiveau(idNiveau);
      // La generation d'une grille prend 1 a 3 millisecondes grace au
      // solveur a masques de bits : inutile d'afficher un ecran d'attente.
      const resultat = genererEnigme(niveau.indices);
      etat = etatNeuf(niveau.id, resultat.enigme, resultat.solution);
      Parties.effacer(ID);
    }

    App.definirTitre('Sudoku - ' + trouverNiveau(etat.niveau).nom);

    if (chrono) chrono.arreter();
    chrono = new Chrono(afficherTemps);
    chrono.demarrer(etat.temps);

    afficherRecord();
    rafraichir();
    sauvegarder();
  }

  /* ======================================================================
     7. INSCRIPTION DU JEU DANS LE MENU
     ====================================================================== */

  window.Jeux[ID] = {
    id: ID,
    nom: 'Sudoku',
    emoji: '🔢',
    description: 'Grilles aleatoires a solution unique, 4 niveaux.',
    themes: null,
    niveaux: NIVEAUX,

    /** Texte du record affiche sur la carte du niveau, dans le menu. */
    texteRecord: function (idNiveau) {
      const meilleur = Records.meilleur(ID, 'temps', idNiveau);
      return meilleur === null ? '' : 'Record ' + Outils.formaterTemps(meilleur);
    },

    /** Y a-t-il une partie a reprendre ? */
    sauvegardeExiste: function () {
      const s = Parties.charger(ID);
      return !!(s && s.valeurs);
    },

    descriptionSauvegarde: function () {
      const s = Parties.charger(ID);
      if (!s) return '';
      return trouverNiveau(s.niveau).nom + ' - ' + Outils.formaterTemps(s.temps || 0);
    },

    /** Force une sauvegarde (appele par app.js avant la mise en arriere-plan). */
    sauvegarder: function () { sauvegarder(); },

    /** Appele par app.js pour demarrer le jeu. */
    demarrer: function (conteneur, options) {
      construireInterface(conteneur);
      lancerPartie(options.niveau, options.reprendre === true);
    },

    /** Appele par app.js quand on quitte le jeu : on libere tout. */
    arreter: function () {
      sauvegarder();
      if (chrono) { chrono.arreter(); chrono = null; }
      document.removeEventListener('keydown', auClavier);
      etat = null;
      vue = null;
    }
  };

})();

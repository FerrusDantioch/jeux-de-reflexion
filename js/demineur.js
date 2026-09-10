/* ==========================================================================
   demineur.js - Le Demineur
   --------------------------------------------------------------------------
   SOMMAIRE
     1. Reglages des niveaux
     2. Generation de la grille (mines posees APRES le premier clic)
     3. Interface
     4. Actions : reveler, drapeau, revelation en cascade
     5. Victoire / defaite, sauvegarde, inscription au menu

   REPRESENTATION
     Comme pour le sudoku, la grille est un tableau a une seule dimension :
       index = ligne * colonnes + colonne
   ========================================================================== */

window.Jeux = window.Jeux || {};

(function () {
  'use strict';

  const ID = 'demineur';

  const DRAPEAU = '🚩';   // 🚩
  const MINE    = '💣';   // 💣

  /* ======================================================================
     1. NIVEAUX
     ====================================================================== */

  const NIVEAUX = [
    { id: 'debutant',      nom: 'Debutant',      lignes: 9,  colonnes: 9,  mines: 10, detail: '9 x 9, 10 mines' },
    { id: 'intermediaire', nom: 'Intermediaire', lignes: 16, colonnes: 16, mines: 40, detail: '16 x 16, 40 mines' },
    { id: 'expert',        nom: 'Expert',        lignes: 16, colonnes: 30, mines: 99, detail: '16 x 30, 99 mines' }
  ];

  function trouverNiveau(idNiveau) {
    return NIVEAUX.find(function (n) { return n.id === idNiveau; }) || NIVEAUX[0];
  }

  /* ======================================================================
     2. GENERATION
     ====================================================================== */

  /**
   * Renvoie les index des cases voisines (jusqu'a 8).
   * Les tests de bornes evitent qu'une case du bord gauche soit consideree
   * comme voisine d'une case du bord droit de la ligne precedente.
   */
  function voisins(index, lignes, colonnes) {
    const ligne = Math.floor(index / colonnes);
    const colonne = index % colonnes;
    const resultat = [];
    for (let dl = -1; dl <= 1; dl++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dl === 0 && dc === 0) continue;
        const l = ligne + dl;
        const c = colonne + dc;
        if (l < 0 || l >= lignes || c < 0 || c >= colonnes) continue;
        resultat.push(l * colonnes + c);
      }
    }
    return resultat;
  }

  /**
   * Place les mines au hasard EN EVITANT la case du premier clic et ses
   * voisines. C'est la regle des demineurs modernes : le premier clic ouvre
   * toujours une zone, jamais une mine.
   */
  function poserMines(etatJeu, premierIndex) {
    const total = etatJeu.lignes * etatJeu.colonnes;

    // Cases interdites : le premier clic + ses 8 voisines.
    const interdites = voisins(premierIndex, etatJeu.lignes, etatJeu.colonnes);
    interdites.push(premierIndex);

    // Liste de toutes les cases autorisees, melangee : les `mines` premieres
    // deviennent des mines. C'est plus sur qu'un tirage avec repetition,
    // qui pourrait boucler longtemps sur une grille tres dense.
    const possibles = [];
    for (let i = 0; i < total; i++) {
      if (interdites.indexOf(i) === -1) possibles.push(i);
    }
    Outils.melanger(possibles);

    // Securite : sur une toute petite grille tres minee, on ne pourrait pas
    // epargner les 9 cases. On reduit alors la zone protegee au seul clic.
    let candidats = possibles;
    if (candidats.length < etatJeu.mines) {
      candidats = [];
      for (let i = 0; i < total; i++) if (i !== premierIndex) candidats.push(i);
      Outils.melanger(candidats);
    }

    for (let k = 0; k < etatJeu.mines; k++) etatJeu.estMine[candidats[k]] = true;

    // Comptage des mines voisines, une fois pour toutes.
    for (let i = 0; i < total; i++) {
      if (etatJeu.estMine[i]) { etatJeu.voisines[i] = -1; continue; }
      let compte = 0;
      const v = voisins(i, etatJeu.lignes, etatJeu.colonnes);
      for (let k = 0; k < v.length; k++) if (etatJeu.estMine[v[k]]) compte++;
      etatJeu.voisines[i] = compte;
    }
    etatJeu.minesPosees = true;
  }

  /* ======================================================================
     3. ETAT ET INTERFACE
     ====================================================================== */

  let etat = null;
  let vue = null;
  let chrono = null;

  function etatNeuf(niveau) {
    const total = niveau.lignes * niveau.colonnes;
    return {
      niveau: niveau.id,
      lignes: niveau.lignes,
      colonnes: niveau.colonnes,
      mines: niveau.mines,
      estMine: new Array(total).fill(false),     // ou se trouvent les mines
      voisines: new Array(total).fill(0),       // nombre de mines autour
      decouvertes: new Array(total).fill(false),
      drapeaux: new Array(total).fill(false),
      minesPosees: false,                       // false tant qu'on n'a pas clique
      terminee: null,                           // null | 'gagne' | 'perdu'
      caseFatale: -1,
      modeDrapeau: false,
      temps: 0
    };
  }

  function construireInterface(conteneur) {
    Outils.vider(conteneur);

    const bandeau = Outils.creer('div', { classe: 'bandeau-jeu' });
    const infoMines  = creerInfo('Mines', '0');
    const infoTemps  = creerInfo('Temps', '00:00');
    const infoRecord = creerInfo('Record', '--:--');
    bandeau.append(infoMines.bloc, infoTemps.bloc, infoRecord.bloc);
    conteneur.appendChild(bandeau);

    const cadre = Outils.creer('div', { classe: 'cadre-demineur' });
    const grille = Outils.creer('div', {
      classe: 'grille-demineur',
      attributs: { role: 'grid', 'aria-label': 'Grille du demineur' }
    });
    cadre.appendChild(grille);
    conteneur.appendChild(cadre);

    const actions = Outils.creer('div', { classe: 'barre-actions' });
    const boutonDrapeau = Outils.creer('button', {
      classe: 'bouton', texte: DRAPEAU + ' Drapeau', attributs: { type: 'button' }
    });
    const boutonNouvelle = Outils.creer('button', {
      classe: 'bouton', texte: 'Nouvelle partie', attributs: { type: 'button' }
    });
    actions.append(boutonDrapeau, boutonNouvelle);
    conteneur.appendChild(actions);

    const aide = Outils.creer('p', {
      classe: 'pied-page',
      texte: 'Clic droit ou appui long pour poser un drapeau. Appuyez sur un chiffre deja decouvert pour ouvrir ses voisines.'
    });
    conteneur.appendChild(aide);

    vue = {
      conteneur: conteneur,
      grille: grille,
      cases: [],
      boutonDrapeau: boutonDrapeau,
      valeurMines: infoMines.valeur,
      valeurTemps: infoTemps.valeur,
      valeurRecord: infoRecord.valeur
    };

    boutonDrapeau.addEventListener('click', function () {
      etat.modeDrapeau = !etat.modeDrapeau;
      boutonDrapeau.classList.toggle('actif', etat.modeDrapeau);
      Outils.info(etat.modeDrapeau ? 'Mode drapeau : chaque appui pose un drapeau.'
                                   : 'Mode normal : chaque appui decouvre la case.');
    });
    boutonNouvelle.addEventListener('click', demanderNouvellePartie);

    brancherEvenements(grille);
  }

  function creerInfo(etiquette, valeurInitiale) {
    const bloc = Outils.creer('div', { classe: 'info-jeu' });
    bloc.appendChild(Outils.creer('span', { classe: 'etiquette', texte: etiquette }));
    const valeur = Outils.creer('span', { classe: 'valeur', texte: valeurInitiale });
    bloc.appendChild(valeur);
    return { bloc: bloc, valeur: valeur };
  }

  /** Cree les boutons de la grille et calcule la taille des cases. */
  function dessinerGrille() {
    Outils.vider(vue.grille);
    vue.cases = [];

    vue.grille.style.setProperty('--colonnes', etat.colonnes);
    vue.grille.style.setProperty('--taille-case', calculerTailleCase() + 'px');

    const total = etat.lignes * etat.colonnes;
    for (let i = 0; i < total; i++) {
      const bouton = Outils.creer('button', {
        classe: 'case-mine',
        attributs: { type: 'button', 'data-index': String(i) }
      });
      vue.grille.appendChild(bouton);
      vue.cases.push(bouton);
    }
    rafraichir();
  }

  /**
   * Taille d'une case en pixels.
   * On essaie de faire tenir toute la grille dans la largeur disponible,
   * sans jamais descendre sous 26 px (sinon impossible de viser au doigt).
   * Si la grille reste trop large - le niveau Expert sur telephone - le
   * conteneur .cadre-demineur permet de la faire defiler horizontalement.
   */
  function calculerTailleCase() {
    const largeurDispo = vue.conteneur.clientWidth || 360;
    const espaceEntreCases = 2;
    const brut = (largeurDispo - 16 - espaceEntreCases * (etat.colonnes - 1)) / etat.colonnes;
    return Math.max(26, Math.min(40, Math.floor(brut)));
  }

  /* ======================================================================
     4. EVENEMENTS ET ACTIONS
     ====================================================================== */

  let minuteurAppuiLong = null;
  let appuiLongDeclenche = false;
  let departAppui = null;        // position du doigt au debut de l'appui

  function brancherEvenements(grille) {

    // --- Souris : clic droit = drapeau -------------------------------
    grille.addEventListener('contextmenu', function (evenement) {
      evenement.preventDefault();       // pas de menu contextuel du navigateur
      const index = indexDe(evenement.target);
      if (index !== null) basculerDrapeau(index);
    });

    // --- Tactile : appui long = drapeau ------------------------------
    grille.addEventListener('pointerdown', function (evenement) {
      appuiLongDeclenche = false;
      if (evenement.pointerType === 'mouse') return;   // la souris a le clic droit
      const index = indexDe(evenement.target);
      if (index === null) return;
      departAppui = { x: evenement.clientX, y: evenement.clientY };
      minuteurAppuiLong = setTimeout(function () {
        appuiLongDeclenche = true;
        basculerDrapeau(index);
        Outils.vibrer(35);
      }, 450);
    });

    // Un doigt n'est jamais parfaitement immobile : on ne considere l'appui
    // comme annule que si le deplacement depasse une dizaine de pixels.
    grille.addEventListener('pointermove', function (evenement) {
      if (!departAppui) return;
      const dx = evenement.clientX - departAppui.x;
      const dy = evenement.clientY - departAppui.y;
      if (Math.sqrt(dx * dx + dy * dy) > 12) annulerAppuiLong();
    });

    // Si le doigt se leve avant les 450 ms, ce n'est pas un appui long.
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (nom) {
      grille.addEventListener(nom, annulerAppuiLong);
    });

    // --- Clic simple : decouvrir --------------------------------------
    grille.addEventListener('click', function (evenement) {
      // Un appui long vient de poser un drapeau : on ignore le clic qui suit.
      if (appuiLongDeclenche) { appuiLongDeclenche = false; return; }
      const index = indexDe(evenement.target);
      if (index === null) return;
      if (etat.modeDrapeau) basculerDrapeau(index);
      else jouer(index);
    });
  }

  function annulerAppuiLong() {
    clearTimeout(minuteurAppuiLong);
    departAppui = null;
  }

  function indexDe(element) {
    const bouton = element.closest ? element.closest('.case-mine') : null;
    return bouton ? Number(bouton.dataset.index) : null;
  }

  /** Action principale : decouvrir une case (ou ouvrir les voisines d'un chiffre). */
  function jouer(index) {
    if (!etat || etat.terminee) return;
    if (etat.drapeaux[index]) return;              // on ne decouvre pas un drapeau

    // Premier clic de la partie : c'est maintenant qu'on pose les mines.
    if (!etat.minesPosees) {
      poserMines(etat, index);
      chrono.demarrer(etat.temps);
    }

    if (etat.decouvertes[index]) {
      ouvrirVoisines(index);                       // « chord » sur un chiffre
      return;
    }

    if (etat.estMine[index]) {
      etat.caseFatale = index;
      terminerPartie('perdu');
      return;
    }

    revelerEnCascade(index);
    rafraichir();
    verifierVictoire();
    sauvegarder();
  }

  /**
   * Revelation en cascade.
   * Quand on ouvre une case sans mine voisine (0), toutes ses voisines
   * s'ouvrent aussi, et ainsi de suite. On utilise une PILE plutot qu'une
   * fonction recursive : sur la grille Expert, la recursion pourrait
   * atteindre plusieurs centaines de niveaux d'imbrication.
   */
  function revelerEnCascade(depart) {
    const pile = [depart];
    while (pile.length > 0) {
      const index = pile.pop();
      if (etat.decouvertes[index] || etat.drapeaux[index]) continue;
      etat.decouvertes[index] = true;
      if (etat.voisines[index] === 0) {
        const v = voisins(index, etat.lignes, etat.colonnes);
        for (let k = 0; k < v.length; k++) {
          if (!etat.decouvertes[v[k]]) pile.push(v[k]);
        }
      }
    }
  }

  /**
   * Ouvre d'un coup les voisines d'un chiffre deja decouvert, a condition
   * d'avoir pose exactement autant de drapeaux que le chiffre l'indique.
   * Attention : si un drapeau est mal place, on perd la partie - c'est la
   * regle du jeu original.
   */
  function ouvrirVoisines(index) {
    const chiffre = etat.voisines[index];
    if (chiffre <= 0) return;

    const v = voisins(index, etat.lignes, etat.colonnes);
    let drapeauxPoses = 0;
    for (let k = 0; k < v.length; k++) if (etat.drapeaux[v[k]]) drapeauxPoses++;
    if (drapeauxPoses !== chiffre) return;

    for (let k = 0; k < v.length; k++) {
      const voisin = v[k];
      if (etat.drapeaux[voisin] || etat.decouvertes[voisin]) continue;
      if (etat.estMine[voisin]) {
        etat.caseFatale = voisin;
        terminerPartie('perdu');
        return;
      }
      revelerEnCascade(voisin);
    }
    rafraichir();
    verifierVictoire();
    sauvegarder();
  }

  function basculerDrapeau(index) {
    if (!etat || etat.terminee) return;
    if (etat.decouvertes[index]) return;
    etat.drapeaux[index] = !etat.drapeaux[index];
    rafraichir();
    sauvegarder();
  }

  /* ======================================================================
     AFFICHAGE
     ====================================================================== */

  function rafraichir() {
    if (!etat || !vue) return;

    let drapeauxPoses = 0;
    for (let i = 0; i < etat.drapeaux.length; i++) if (etat.drapeaux[i]) drapeauxPoses++;
    vue.valeurMines.textContent = String(etat.mines - drapeauxPoses);

    for (let i = 0; i < vue.cases.length; i++) {
      const bouton = vue.cases[i];
      let classes = 'case-mine';
      let texte = '';

      if (etat.decouvertes[i]) {
        classes += ' decouverte';
        if (etat.estMine[i]) {
          classes += ' mine';
          texte = MINE;
          if (i === etat.caseFatale) classes += ' explosee';
        } else if (etat.voisines[i] > 0) {
          classes += ' n' + etat.voisines[i];
          texte = String(etat.voisines[i]);
        }
      } else if (etat.drapeaux[i]) {
        classes += ' drapeau';
        texte = DRAPEAU;
        // En fin de partie perdue, on barre les drapeaux mal places.
        if (etat.terminee === 'perdu' && !etat.estMine[i]) classes += ' mauvais-drapeau';
      }

      bouton.className = classes;
      bouton.textContent = texte;
    }
  }

  function afficherTemps(ms) {
    if (vue) vue.valeurTemps.textContent = Outils.formaterTemps(ms);
  }

  function afficherRecord() {
    const meilleur = Records.meilleur(ID, 'temps', etat.niveau);
    vue.valeurRecord.textContent = meilleur === null ? '--:--' : Outils.formaterTemps(meilleur);
  }

  /* ======================================================================
     5. FIN DE PARTIE
     ====================================================================== */

  function verifierVictoire() {
    const total = etat.lignes * etat.colonnes;
    let restantes = 0;
    for (let i = 0; i < total; i++) {
      if (!etat.decouvertes[i] && !etat.estMine[i]) restantes++;
    }
    if (restantes === 0) terminerPartie('gagne');
  }

  function terminerPartie(resultat) {
    etat.terminee = resultat;
    etat.temps = chrono.temps();
    chrono.arreter();
    Parties.effacer(ID);

    if (resultat === 'gagne') {
      // Confort : on pose automatiquement les drapeaux manquants.
      for (let i = 0; i < etat.estMine.length; i++) {
        if (etat.estMine[i]) etat.drapeaux[i] = true;
      }
      Outils.vibrer([30, 60, 30]);
    } else {
      // Defaite : on devoile toutes les mines.
      for (let i = 0; i < etat.estMine.length; i++) {
        if (etat.estMine[i] && !etat.drapeaux[i]) etat.decouvertes[i] = true;
      }
      Outils.vibrer([60, 40, 120]);
    }
    rafraichir();

    let record = false;
    if (resultat === 'gagne') {
      record = Records.enregistrer(ID, 'temps', etat.niveau, etat.temps);
      afficherRecord();
    }

    const niveau = trouverNiveau(etat.niveau);
    Outils.modale({
      titre: resultat === 'gagne' ? (record ? 'Nouveau record !' : 'Terrain deminé !') : 'Boum !',
      message: resultat === 'gagne'
        ? 'Niveau ' + niveau.nom + ' termine en ' + Outils.formaterTemps(etat.temps) + '.'
        : 'Vous avez decouvert une mine. Les autres mines sont maintenant visibles.',
      boutons: [
        { texte: 'Rejouer', valeur: 'rejouer', principal: true },
        { texte: 'Retour au menu', valeur: 'menu' }
      ]
    }).then(function (choix) {
      if (choix === 'rejouer') lancerPartie(etat.niveau, false);
      else if (choix === 'menu') App.retour();
    });
  }

  function demanderNouvellePartie() {
    if (etat.terminee || !etat.minesPosees) { lancerPartie(etat.niveau, false); return; }
    Outils.modale({
      titre: 'Nouvelle partie ?',
      message: 'La partie en cours sera perdue.',
      boutons: [
        { texte: 'Nouvelle partie', valeur: true, principal: true },
        { texte: 'Continuer a jouer', valeur: false }
      ]
    }).then(function (confirme) {
      if (confirme) lancerPartie(etat.niveau, false);
    });
  }

  /* ======================================================================
     SAUVEGARDE
     ====================================================================== */

  function sauvegarder() {
    if (!etat || etat.terminee || !etat.minesPosees) return;
    Parties.sauvegarder(ID, {
      niveau: etat.niveau,
      lignes: etat.lignes,
      colonnes: etat.colonnes,
      mines: etat.mines,
      estMine: etat.estMine,
      voisines: etat.voisines,
      decouvertes: etat.decouvertes,
      drapeaux: etat.drapeaux,
      temps: chrono ? chrono.temps() : 0
    });
  }

  function lancerPartie(idNiveau, reprendre) {
    const sauvegarde = reprendre ? Parties.charger(ID) : null;

    if (sauvegarde && sauvegarde.estMine) {
      etat = etatNeuf(trouverNiveau(sauvegarde.niveau));
      etat.lignes = sauvegarde.lignes;
      etat.colonnes = sauvegarde.colonnes;
      etat.mines = sauvegarde.mines;
      etat.estMine = sauvegarde.estMine;
      etat.voisines = sauvegarde.voisines;
      etat.decouvertes = sauvegarde.decouvertes;
      etat.drapeaux = sauvegarde.drapeaux;
      etat.minesPosees = true;
      etat.temps = sauvegarde.temps || 0;
    } else {
      etat = etatNeuf(trouverNiveau(idNiveau));
      Parties.effacer(ID);
    }

    App.definirTitre('Demineur - ' + trouverNiveau(etat.niveau).nom);

    dessinerGrille();
    afficherRecord();
    vue.boutonDrapeau.classList.remove('actif');

    if (chrono) chrono.arreter();
    chrono = new Chrono(afficherTemps);
    // Le chronometre ne demarre qu'au premier clic (regle du demineur),
    // sauf si l'on reprend une partie deja commencee.
    afficherTemps(etat.temps);
    if (etat.minesPosees) chrono.demarrer(etat.temps);
  }

  window.addEventListener('resize', function () {
    if (vue && etat) vue.grille.style.setProperty('--taille-case', calculerTailleCase() + 'px');
  });

  /* ======================================================================
     INSCRIPTION DU JEU DANS LE MENU
     ====================================================================== */

  window.Jeux[ID] = {
    id: ID,
    nom: 'Demineur',
    emoji: MINE,
    description: 'Trois niveaux, premier clic toujours sans danger.',
    themes: null,
    niveaux: NIVEAUX,

    texteRecord: function (idNiveau) {
      const meilleur = Records.meilleur(ID, 'temps', idNiveau);
      return meilleur === null ? '' : 'Record ' + Outils.formaterTemps(meilleur);
    },

    sauvegardeExiste: function () {
      const s = Parties.charger(ID);
      return !!(s && s.estMine);
    },

    descriptionSauvegarde: function () {
      const s = Parties.charger(ID);
      if (!s) return '';
      return trouverNiveau(s.niveau).nom + ' - ' + Outils.formaterTemps(s.temps || 0);
    },

    /** Force une sauvegarde (appele par app.js avant la mise en arriere-plan). */
    sauvegarder: function () { sauvegarder(); },

    demarrer: function (conteneur, options) {
      construireInterface(conteneur);
      lancerPartie(options.niveau, options.reprendre === true);
    },

    arreter: function () {
      sauvegarder();
      if (chrono) { chrono.arreter(); chrono = null; }
      clearTimeout(minuteurAppuiLong);
      etat = null;
      vue = null;
    }
  };

})();

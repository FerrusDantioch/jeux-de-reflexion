/* ==========================================================================
   mots-meles.js - Le jeu de Mots Meles (en francais)
   --------------------------------------------------------------------------
   SOMMAIRE
     1. Les listes de mots par theme
     2. Reglages des niveaux de difficulte
     3. Generation aleatoire de la grille
     4. Construction de l'interface
     5. La selection par glissement (souris ET tactile)
     6. Sauvegarde, victoire, inscription au menu

   POURQUOI DES MOTS SANS ACCENT ?
     Une grille de mots meles se lit lettre par lettre. Melanger "E" et "É"
     rendrait la recherche penible et l'affichage irregulier. Les mots sont
     donc ecrits en majuscules non accentuees, comme dans les magazines de
     jeux imprimes.
   ========================================================================== */

window.Jeux = window.Jeux || {};

(function () {
  'use strict';

  const ID = 'mots-meles';

  /* ======================================================================
     1. LES THEMES
     ====================================================================== */

  const THEMES = [
    {
      id: 'animaux',
      nom: 'Animaux',
      mots: ['LION', 'TIGRE', 'OURS', 'LOUP', 'RENARD', 'CERF', 'BICHE', 'SANGLIER',
             'ECUREUIL', 'HERISSON', 'BLAIREAU', 'MARMOTTE', 'CHOUETTE', 'HIBOU',
             'AIGLE', 'FAUCON', 'CORBEAU', 'PIGEON', 'MOINEAU', 'MESANGE',
             'CANARD', 'POULE', 'LAPIN', 'LIEVRE', 'SOURIS', 'TAUPE', 'BALEINE',
             'DAUPHIN', 'REQUIN', 'TORTUE', 'GRENOUILLE', 'ABEILLE', 'FOURMI',
             'PAPILLON', 'ARAIGNEE', 'CHEVAL', 'VACHE', 'MOUTON', 'CHEVRE', 'ANE']
    },
    {
      id: 'nature',
      nom: 'Nature',
      mots: ['FORET', 'RIVIERE', 'MONTAGNE', 'VALLEE', 'PRAIRIE', 'OCEAN', 'PLAGE',
             'FALAISE', 'CASCADE', 'TORRENT', 'ETANG', 'MARAIS', 'DUNE', 'GLACIER',
             'VOLCAN', 'NUAGE', 'ORAGE', 'ECLAIR', 'BRUME', 'ROSEE', 'NEIGE',
             'GIVRE', 'SOLEIL', 'LUNE', 'ETOILE', 'AUTOMNE', 'PRINTEMPS', 'ARBRE',
             'FEUILLE', 'RACINE', 'BRANCHE', 'FLEUR', 'HERBE', 'MOUSSE', 'SAPIN',
             'CHENE', 'BOULEAU', 'FOUGERE', 'SABLE', 'GALET']
    },
    {
      id: 'cuisine',
      nom: 'Cuisine',
      mots: ['FARINE', 'SUCRE', 'BEURRE', 'CREME', 'FROMAGE', 'PAIN', 'BRIOCHE',
             'GATEAU', 'TARTE', 'CREPE', 'SOUPE', 'POTAGE', 'SALADE', 'SAUCE',
             'POIVRE', 'EPICE', 'THYM', 'BASILIC', 'PERSIL', 'OIGNON', 'TOMATE',
             'CAROTTE', 'POMME', 'POIRE', 'FRAISE', 'CERISE', 'CHOCOLAT', 'MIEL',
             'CONFITURE', 'POELE', 'MARMITE', 'COUTEAU', 'ASSIETTE', 'FOURCHETTE',
             'CUILLERE', 'RECETTE', 'FOUR', 'RIZ', 'PATES', 'LENTILLE']
    },
    {
      id: 'sport',
      nom: 'Sport',
      mots: ['FOOTBALL', 'RUGBY', 'TENNIS', 'BASKET', 'HANDBALL', 'VOLLEY',
             'NATATION', 'CYCLISME', 'COURSE', 'MARATHON', 'JUDO', 'KARATE',
             'BOXE', 'ESCRIME', 'SURF', 'VOILE', 'AVIRON', 'GOLF', 'HOCKEY',
             'PATINAGE', 'EQUIPE', 'ARBITRE', 'STADE', 'MEDAILLE', 'VICTOIRE',
             'BALLON', 'RAQUETTE', 'FILET', 'MAILLOT', 'DOSSARD', 'PISTE',
             'TREMPLIN', 'RELAIS', 'SPRINT', 'ENDURANCE', 'TROPHEE', 'PODIUM',
             'MATCH', 'PENALTY', 'ESCALADE']
    },
    {
      id: 'musique',
      nom: 'Musique',
      mots: ['PIANO', 'GUITARE', 'VIOLON', 'FLUTE', 'TROMPETTE', 'BATTERIE',
             'HARPE', 'CLARINETTE', 'SAXOPHONE', 'ACCORDEON', 'ORGUE', 'BANJO',
             'NOTE', 'PARTITION', 'MELODIE', 'HARMONIE', 'RYTHME', 'TEMPO',
             'ACCORD', 'GAMME', 'CHANSON', 'REFRAIN', 'COUPLET', 'CHORALE',
             'ORCHESTRE', 'CONCERT', 'SCENE', 'MICRO', 'SILENCE', 'SOLFEGE',
             'CROCHE', 'CLAVIER', 'ARCHET', 'CORDE', 'PUPITRE', 'CHEF',
             'DUO', 'SOLISTE', 'TAMBOUR', 'CYMBALE']
    }
  ];

  function trouverTheme(idTheme) {
    return THEMES.find(function (t) { return t.id === idTheme; }) || THEMES[0];
  }

  /* ======================================================================
     2. NIVEAUX DE DIFFICULTE
     ----------------------------------------------------------------------
     Une direction s'ecrit [deltaLigne, deltaColonne] :
        [0, 1]  = vers la droite        [1, 0]  = vers le bas
        [1, 1]  = diagonale bas-droite  [-1, 1] = diagonale haut-droite
        [0, -1] = vers la gauche (mot ecrit a l'envers), etc.
     ====================================================================== */

  const DIRECTIONS = {
    droite:       [0, 1],
    bas:          [1, 0],
    diagonaleBD:  [1, 1],
    diagonaleHD:  [-1, 1],
    gauche:       [0, -1],
    haut:         [-1, 0],
    diagonaleHG:  [-1, -1],
    diagonaleBG:  [1, -1]
  };

  const NIVEAUX = [
    {
      id: 'facile', nom: 'Facile', detail: 'Grille 9x9, 8 mots, horizontal et vertical',
      taille: 9, nbMots: 8, longueurMax: 8,
      directions: [DIRECTIONS.droite, DIRECTIONS.bas]
    },
    {
      id: 'moyen', nom: 'Moyen', detail: 'Grille 12x12, 10 mots, avec diagonales',
      taille: 12, nbMots: 10, longueurMax: 10,
      directions: [DIRECTIONS.droite, DIRECTIONS.bas, DIRECTIONS.diagonaleBD, DIRECTIONS.diagonaleHD]
    },
    {
      id: 'difficile', nom: 'Difficile', detail: 'Grille 14x14, 12 mots, mots a l\'envers',
      taille: 14, nbMots: 12, longueurMax: 12,
      directions: [DIRECTIONS.droite, DIRECTIONS.bas, DIRECTIONS.diagonaleBD, DIRECTIONS.diagonaleHD,
                   DIRECTIONS.gauche, DIRECTIONS.haut, DIRECTIONS.diagonaleHG, DIRECTIONS.diagonaleBG]
    }
  ];

  function trouverNiveau(idNiveau) {
    return NIVEAUX.find(function (n) { return n.id === idNiveau; }) || NIVEAUX[0];
  }

  /* ======================================================================
     3. GENERATION DE LA GRILLE
     ====================================================================== */

  /* Lettres utilisees pour boucher les trous. La liste contient plusieurs
     fois les lettres frequentes en francais (E, A, S, R...) : les lettres
     parasites ressemblent ainsi davantage a du vrai texte, ce qui rend la
     recherche plus interessante qu'avec un tirage uniforme. */
  const LETTRES_PARASITES = 'EEEEEEEEEAAAAAAASSSSSSRRRRRRIIIIIINNNNNTTTTTOOOOOLLLLUUUUDDDCCCMMMPPGGBBVVHHFQJXYZK';

  /**
   * Essaie de placer un mot dans la grille.
   * On teste toutes les positions/directions possibles dans un ordre
   * aleatoire et on retient la premiere qui convient. Un mot « convient »
   * si chaque case visee est soit vide, soit deja occupee par la MEME lettre
   * (c'est ainsi que les mots se croisent).
   *
   * @returns {object|null} { mot, cases: [index...] } ou null si impossible
   */
  function placerMot(grille, taille, mot, directions) {
    // On construit la liste de tous les departs possibles, puis on la melange.
    const essais = [];
    for (let ligne = 0; ligne < taille; ligne++) {
      for (let colonne = 0; colonne < taille; colonne++) {
        for (let d = 0; d < directions.length; d++) {
          essais.push([ligne, colonne, directions[d]]);
        }
      }
    }
    Outils.melanger(essais);

    for (let e = 0; e < essais.length; e++) {
      const ligne = essais[e][0];
      const colonne = essais[e][1];
      const direction = essais[e][2];
      const cases = verifierPlacement(grille, taille, mot, ligne, colonne, direction);
      if (cases) {
        // Placement valide : on ecrit reellement les lettres.
        for (let k = 0; k < mot.length; k++) grille[cases[k]] = mot[k];
        return { mot: mot, cases: cases };
      }
    }
    return null;
  }

  /** Verifie qu'un mot tient a cet endroit ; renvoie la liste des index. */
  function verifierPlacement(grille, taille, mot, ligne, colonne, direction) {
    const cases = [];
    for (let k = 0; k < mot.length; k++) {
      const l = ligne + direction[0] * k;
      const c = colonne + direction[1] * k;
      if (l < 0 || l >= taille || c < 0 || c >= taille) return null;   // sort de la grille
      const index = l * taille + c;
      const occupee = grille[index];
      if (occupee !== '' && occupee !== mot[k]) return null;           // conflit de lettre
      cases.push(index);
    }
    return cases;
  }

  /**
   * Construit une grille complete : choix des mots, placement, remplissage.
   * On pioche dans le theme jusqu'a avoir place le nombre de mots voulu ;
   * si un mot ne rentre nulle part, on passe simplement au suivant.
   */
  function genererGrille(theme, niveau) {
    const taille = niveau.taille;
    const grille = new Array(taille * taille).fill('');

    // Mots utilisables : pas trop longs pour la grille choisie.
    const pioche = theme.mots.filter(function (mot) {
      return mot.length <= Math.min(niveau.longueurMax, taille);
    });
    Outils.melanger(pioche);

    // Les mots longs sont places en premier : ils sont les plus difficiles a
    // caser, autant le faire quand la grille est encore vide.
    const selection = pioche.slice(0, niveau.nbMots * 2);
    selection.sort(function (a, b) { return b.length - a.length; });

    const placements = [];
    for (let i = 0; i < selection.length && placements.length < niveau.nbMots; i++) {
      const resultat = placerMot(grille, taille, selection[i], niveau.directions);
      if (resultat) placements.push(resultat);
    }

    // Remplissage des cases restantes par des lettres parasites.
    for (let i = 0; i < grille.length; i++) {
      if (grille[i] === '') {
        grille[i] = LETTRES_PARASITES[Outils.hasard(LETTRES_PARASITES.length)];
      }
    }

    // On affiche la liste des mots par ordre alphabetique : plus lisible.
    const mots = placements.map(function (p) { return p.mot; }).sort();

    return { grille: grille, taille: taille, mots: mots, placements: placements };
  }

  /* ======================================================================
     4. ETAT ET INTERFACE
     ====================================================================== */

  let etat = null;
  let vue = null;
  let chrono = null;

  function construireInterface(conteneur) {
    Outils.vider(conteneur);

    const bandeau = Outils.creer('div', { classe: 'bandeau-jeu' });
    const infoTemps  = creerInfo('Temps', '00:00');
    const infoTrouves = creerInfo('Trouves', '0 / 0');
    const infoRecord = creerInfo('Record', '--:--');
    bandeau.append(infoTemps.bloc, infoTrouves.bloc, infoRecord.bloc);
    conteneur.appendChild(bandeau);

    const zone = Outils.creer('div', { classe: 'zone-mots' });
    const grille = Outils.creer('div', {
      classe: 'grille-mots',
      attributs: { role: 'grid', 'aria-label': 'Grille de lettres' }
    });
    zone.appendChild(grille);

    const liste = Outils.creer('div', { classe: 'liste-mots' });
    zone.appendChild(liste);
    conteneur.appendChild(zone);

    const actions = Outils.creer('div', { classe: 'barre-actions' });
    const boutonNouvelle = Outils.creer('button', {
      classe: 'bouton', texte: 'Nouvelle grille', attributs: { type: 'button' }
    });
    actions.appendChild(boutonNouvelle);
    conteneur.appendChild(actions);

    vue = {
      conteneur: conteneur,
      grille: grille,
      liste: liste,
      cases: [],
      etiquettes: {},
      valeurTemps: infoTemps.valeur,
      valeurTrouves: infoTrouves.valeur,
      valeurRecord: infoRecord.valeur
    };

    boutonNouvelle.addEventListener('click', demanderNouvelleGrille);
    brancherGlissement(grille);
  }

  function creerInfo(etiquette, valeurInitiale) {
    const bloc = Outils.creer('div', { classe: 'info-jeu' });
    bloc.appendChild(Outils.creer('span', { classe: 'etiquette', texte: etiquette }));
    const valeur = Outils.creer('span', { classe: 'valeur', texte: valeurInitiale });
    bloc.appendChild(valeur);
    return { bloc: bloc, valeur: valeur };
  }

  /** Dessine la grille de lettres et la liste des mots a trouver. */
  function dessinerGrille() {
    Outils.vider(vue.grille);
    vue.cases = [];
    vue.grille.style.setProperty('--colonnes', etat.taille);

    for (let i = 0; i < etat.grille.length; i++) {
      const c = Outils.creer('div', {
        classe: 'case-mot',
        texte: etat.grille[i],
        attributs: { 'data-index': String(i) }
      });
      vue.grille.appendChild(c);
      vue.cases.push(c);
    }

    Outils.vider(vue.liste);
    vue.etiquettes = {};
    etat.mots.forEach(function (mot) {
      const etiquette = Outils.creer('span', { classe: 'mot-a-trouver', texte: mot });
      vue.liste.appendChild(etiquette);
      vue.etiquettes[mot] = etiquette;
    });

    ajusterTaillePolice();
  }

  /**
   * La taille des lettres depend du nombre de colonnes ET de la largeur reelle
   * disponible. On la calcule en JavaScript plutot qu'en CSS : c'est le seul
   * moyen fiable d'obtenir le meme rendu sur toutes les tailles d'ecran.
   */
  function ajusterTaillePolice() {
    if (!vue || !etat) return;
    const largeur = vue.grille.clientWidth;
    if (!largeur) return;
    const tailleCase = largeur / etat.taille;
    vue.grille.style.fontSize = Math.max(8, Math.floor(tailleCase * 0.55)) + 'px';
  }

  /* ======================================================================
     5. SELECTION PAR GLISSEMENT
     ----------------------------------------------------------------------
     On utilise les « evenements pointeur » (pointerdown / pointermove /
     pointerup). Gros avantage : ils fonctionnent a l'identique pour la
     souris, le doigt et le stylet. Un seul code pour tous les appareils.
     ====================================================================== */

  let selectionEnCours = null;   // { depart: index, cases: [index...] }

  function brancherGlissement(grille) {
    grille.addEventListener('pointerdown', debutSelection);
    grille.addEventListener('pointermove', continuerSelection);
    grille.addEventListener('pointerup', finSelection);
    grille.addEventListener('pointercancel', annulerSelection);
  }

  /** Retrouve l'index de la case situee sous le pointeur. */
  function caseSousPointeur(evenement) {
    // elementFromPoint fonctionne meme avec la « capture de pointeur », ce qui
    // n'est pas le cas de evenement.target (fige sur la case de depart).
    const element = document.elementFromPoint(evenement.clientX, evenement.clientY);
    if (!element || !element.classList.contains('case-mot')) return null;
    if (element.parentNode !== vue.grille) return null;
    return Number(element.dataset.index);
  }

  function debutSelection(evenement) {
    if (!etat || etat.terminee) return;
    const index = caseSousPointeur(evenement);
    if (index === null) return;
    evenement.preventDefault();
    // La capture garantit qu'on recevra bien les evenements suivants meme si
    // le doigt sort de la grille. On la protege par un try/catch : le
    // navigateur refuse la capture si le pointeur n'est plus actif, et cette
    // exception interromprait la selection en cours.
    try { vue.grille.setPointerCapture(evenement.pointerId); } catch (e) { /* sans capture, ca marche quand meme */ }
    selectionEnCours = { depart: index, cases: [index] };
    afficherSelection();
  }

  function continuerSelection(evenement) {
    if (!selectionEnCours) return;
    const index = caseSousPointeur(evenement);
    if (index === null) return;
    const cases = ligneEntre(selectionEnCours.depart, index);
    if (cases) {
      selectionEnCours.cases = cases;
      afficherSelection();
    }
  }

  function finSelection(evenement) {
    if (!selectionEnCours) return;
    try { vue.grille.releasePointerCapture(evenement.pointerId); } catch (e) { /* deja relache */ }

    // On recalcule la ligne a partir de la position exacte du relachement.
    // Un geste tres rapide peut en effet ne produire aucun « pointermove »
    // au-dessus de la derniere lettre : sans cela, le mot serait ignore.
    const arrivee = caseSousPointeur(evenement);
    if (arrivee !== null) {
      const cases = ligneEntre(selectionEnCours.depart, arrivee);
      if (cases) selectionEnCours.cases = cases;
    }

    validerSelection(selectionEnCours.cases);
    selectionEnCours = null;
    afficherSelection();
  }

  function annulerSelection() {
    selectionEnCours = null;
    afficherSelection();
  }

  /**
   * Renvoie la liste des cases formant une ligne droite entre deux index,
   * ou null si les deux cases ne sont pas alignees (ni meme ligne, ni meme
   * colonne, ni diagonale parfaite).
   */
  function ligneEntre(depart, arrivee) {
    const taille = etat.taille;
    const ligneA = Math.floor(depart / taille), colonneA = depart % taille;
    const ligneB = Math.floor(arrivee / taille), colonneB = arrivee % taille;

    const dl = ligneB - ligneA;
    const dc = colonneB - colonneA;

    // Alignement valide : horizontal (dl=0), vertical (dc=0) ou diagonal (|dl|=|dc|)
    const aligne = (dl === 0) || (dc === 0) || (Math.abs(dl) === Math.abs(dc));
    if (!aligne) return null;

    const longueur = Math.max(Math.abs(dl), Math.abs(dc)) + 1;
    // Math.sign donne -1, 0 ou 1 : exactement le « pas » a appliquer.
    const pasL = Math.sign(dl);
    const pasC = Math.sign(dc);

    const cases = [];
    for (let k = 0; k < longueur; k++) {
      cases.push((ligneA + pasL * k) * taille + (colonneA + pasC * k));
    }
    return cases;
  }

  /** Met a jour les classes CSS des cases (selection en cours + mots trouves). */
  function afficherSelection() {
    if (!vue || !etat) return;
    const enCours = selectionEnCours ? selectionEnCours.cases : [];
    for (let i = 0; i < vue.cases.length; i++) {
      const c = vue.cases[i];
      c.classList.toggle('en-cours', enCours.indexOf(i) !== -1);
      c.classList.toggle('trouvee', etat.casesTrouvees.indexOf(i) !== -1);
    }
  }

  /** Verifie si la selection correspond a un mot restant a trouver. */
  function validerSelection(cases) {
    if (!cases || cases.length < 2) return;

    let mot = '';
    for (let k = 0; k < cases.length; k++) mot += etat.grille[cases[k]];

    // On accepte le trace dans les deux sens : c'est plus agreable a jouer.
    const motInverse = mot.split('').reverse().join('');

    let trouve = null;
    if (etat.mots.indexOf(mot) !== -1 && etat.trouves.indexOf(mot) === -1) trouve = mot;
    else if (etat.mots.indexOf(motInverse) !== -1 && etat.trouves.indexOf(motInverse) === -1) trouve = motInverse;

    if (!trouve) return;

    etat.trouves.push(trouve);
    cases.forEach(function (index) {
      if (etat.casesTrouvees.indexOf(index) === -1) etat.casesTrouvees.push(index);
    });

    vue.etiquettes[trouve].classList.add('trouve');
    Outils.vibrer(25);
    majCompteur();
    sauvegarder();
    verifierVictoire();
  }

  function majCompteur() {
    vue.valeurTrouves.textContent = etat.trouves.length + ' / ' + etat.mots.length;
  }

  function afficherTemps(ms) {
    if (vue) vue.valeurTemps.textContent = Outils.formaterTemps(ms);
  }

  function variante() {
    return etat.theme + '|' + etat.niveau;
  }

  function afficherRecord() {
    const meilleur = Records.meilleur(ID, 'temps', variante());
    vue.valeurRecord.textContent = meilleur === null ? '--:--' : Outils.formaterTemps(meilleur);
  }

  /* ======================================================================
     6. VICTOIRE, SAUVEGARDE, NOUVELLE GRILLE
     ====================================================================== */

  function verifierVictoire() {
    if (etat.trouves.length < etat.mots.length) return;

    etat.terminee = true;
    const temps = chrono.temps();
    chrono.arreter();
    Parties.effacer(ID);
    Outils.vibrer([30, 60, 30]);

    const record = Records.enregistrer(ID, 'temps', variante(), temps);
    afficherRecord();

    Outils.modale({
      titre: record ? 'Nouveau record !' : 'Bravo !',
      message: 'Les ' + etat.mots.length + ' mots ont ete trouves en ' +
               Outils.formaterTemps(temps) + '.',
      boutons: [
        { texte: 'Nouvelle grille', valeur: 'nouvelle', principal: true },
        { texte: 'Retour au menu', valeur: 'menu' }
      ]
    }).then(function (choix) {
      if (choix === 'nouvelle') lancerPartie(etat.theme, etat.niveau, false);
      else if (choix === 'menu') App.retour();
    });
  }

  function demanderNouvelleGrille() {
    Outils.modale({
      titre: 'Nouvelle grille ?',
      message: 'La grille en cours sera perdue.',
      boutons: [
        { texte: 'Nouvelle grille', valeur: true, principal: true },
        { texte: 'Continuer a jouer', valeur: false }
      ]
    }).then(function (confirme) {
      if (confirme) lancerPartie(etat.theme, etat.niveau, false);
    });
  }

  function sauvegarder() {
    if (!etat || etat.terminee) return;
    Parties.sauvegarder(ID, {
      theme: etat.theme,
      niveau: etat.niveau,
      taille: etat.taille,
      grille: etat.grille,
      mots: etat.mots,
      trouves: etat.trouves,
      casesTrouvees: etat.casesTrouvees,
      temps: chrono ? chrono.temps() : 0
    });
  }

  function lancerPartie(idTheme, idNiveau, reprendre) {
    const sauvegarde = reprendre ? Parties.charger(ID) : null;

    if (sauvegarde && sauvegarde.grille) {
      etat = {
        theme: sauvegarde.theme,
        niveau: sauvegarde.niveau,
        taille: sauvegarde.taille,
        grille: sauvegarde.grille,
        mots: sauvegarde.mots,
        trouves: sauvegarde.trouves || [],
        casesTrouvees: sauvegarde.casesTrouvees || [],
        temps: sauvegarde.temps || 0,
        terminee: false
      };
    } else {
      const theme = trouverTheme(idTheme);
      const niveau = trouverNiveau(idNiveau);
      const resultat = genererGrille(theme, niveau);
      etat = {
        theme: theme.id,
        niveau: niveau.id,
        taille: resultat.taille,
        grille: resultat.grille,
        mots: resultat.mots,
        trouves: [],
        casesTrouvees: [],
        temps: 0,
        terminee: false
      };
      Parties.effacer(ID);
    }

    App.definirTitre('Mots Meles - ' + trouverTheme(etat.theme).nom);

    dessinerGrille();
    // Les mots deja trouves lors d'une partie reprise doivent rester barres.
    etat.trouves.forEach(function (mot) {
      if (vue.etiquettes[mot]) vue.etiquettes[mot].classList.add('trouve');
    });
    afficherSelection();
    majCompteur();
    afficherRecord();

    if (chrono) chrono.arreter();
    chrono = new Chrono(afficherTemps);
    chrono.demarrer(etat.temps);
    sauvegarder();
  }

  // Si l'ecran change de taille (rotation du telephone), on recalcule la police.
  window.addEventListener('resize', ajusterTaillePolice);

  /* ======================================================================
     INSCRIPTION DU JEU DANS LE MENU
     ====================================================================== */

  window.Jeux[ID] = {
    id: ID,
    nom: 'Mots Meles',
    emoji: '🔤',
    description: '5 themes francais, grilles generees aleatoirement.',
    themes: THEMES.map(function (t) { return { id: t.id, nom: t.nom }; }),
    niveaux: NIVEAUX,

    texteRecord: function (idNiveau, idTheme) {
      const meilleur = Records.meilleur(ID, 'temps', idTheme + '|' + idNiveau);
      return meilleur === null ? '' : 'Record ' + Outils.formaterTemps(meilleur);
    },

    sauvegardeExiste: function () {
      const s = Parties.charger(ID);
      return !!(s && s.grille);
    },

    descriptionSauvegarde: function () {
      const s = Parties.charger(ID);
      if (!s) return '';
      return trouverTheme(s.theme).nom + ' - ' + trouverNiveau(s.niveau).nom + ' - ' +
             (s.trouves ? s.trouves.length : 0) + '/' + s.mots.length + ' mots';
    },

    /** Force une sauvegarde (appele par app.js avant la mise en arriere-plan). */
    sauvegarder: function () { sauvegarder(); },

    demarrer: function (conteneur, options) {
      construireInterface(conteneur);
      lancerPartie(options.theme, options.niveau, options.reprendre === true);
    },

    arreter: function () {
      sauvegarder();
      if (chrono) { chrono.arreter(); chrono = null; }
      selectionEnCours = null;
      etat = null;
      vue = null;
    }
  };

})();

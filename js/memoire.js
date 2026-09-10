/* ==========================================================================
   memoire.js - Le jeu de Memoire (jeu des paires)
   --------------------------------------------------------------------------
   SOMMAIRE
     1. Les themes de cartes
     2. Reglages des niveaux
     3. Distribution aleatoire des cartes
     4. Interface et animation de retournement
     5. Regles du jeu, victoire, sauvegarde

   PRINCIPE
     On fabrique une liste contenant chaque motif EN DOUBLE, on la melange,
     puis on affiche les cartes face cachee. Le joueur en retourne deux : si
     les motifs sont identiques les cartes restent visibles, sinon elles se
     retournent a nouveau au bout d'un court instant.
   ========================================================================== */

window.Jeux = window.Jeux || {};

(function () {
  'use strict';

  const ID = 'memoire';

  /* ======================================================================
     1. THEMES
     ----------------------------------------------------------------------
     Aucun fichier image n'est utilise : uniquement des caracteres Unicode et
     des couleurs. L'application reste donc tres legere, fonctionne hors-ligne
     sans telechargement, et n'utilise aucune illustration protegee.
     ====================================================================== */

  const THEMES = [
    {
      id: 'symboles',
      nom: 'Symboles',
      type: 'texte',
      motifs: ['🍎', '🍌', '🍇', '🍓', '🍋', '🍒', '🥕', '🌰', '🌻', '🌵',
               '🐢', '🐬', '🦋', '🐝', '🦉', '🐙', '⛄', '🚀']
    },
    {
      id: 'formes',
      nom: 'Formes',
      type: 'texte',
      motifs: ['▲', '▼', '◀', '▶', '■', '□', '●', '○', '◆', '◇',
               '★', '☆', '♠', '♥', '♦', '♣', '✚', '✖']
    },
    {
      id: 'couleurs',
      nom: 'Couleurs',
      type: 'couleur',
      motifs: ['#e6534f', '#f28c28', '#f5c518', '#8ac926', '#3ecf8e', '#2ec4b6',
               '#4cc9f0', '#4361ee', '#7b61ff', '#b5179e', '#f72585', '#ff8fab',
               '#c9ada7', '#8d6e63', '#607d8b', '#26a69a', '#9e9d24', '#ef6c9c']
    }
  ];

  function trouverTheme(idTheme) {
    return THEMES.find(function (t) { return t.id === idTheme; }) || THEMES[0];
  }

  /* ======================================================================
     2. NIVEAUX
     ====================================================================== */

  const NIVEAUX = [
    { id: 'facile',    nom: 'Facile',    paires: 6,  colonnes: 4, detail: '6 paires (12 cartes)' },
    { id: 'moyen',     nom: 'Moyen',     paires: 12, colonnes: 6, detail: '12 paires (24 cartes)' },
    { id: 'difficile', nom: 'Difficile', paires: 18, colonnes: 6, detail: '18 paires (36 cartes)' }
  ];

  function trouverNiveau(idNiveau) {
    return NIVEAUX.find(function (n) { return n.id === idNiveau; }) || NIVEAUX[0];
  }

  /* ======================================================================
     3. DISTRIBUTION DES CARTES
     ====================================================================== */

  /**
   * Fabrique le paquet melange.
   * Chaque carte est un objet { motif, paire } ou `paire` est un numero
   * commun aux deux cartes identiques : c'est lui que l'on comparera.
   */
  function distribuer(theme, niveau) {
    const motifs = Outils.melanger(theme.motifs.slice()).slice(0, niveau.paires);
    const paquet = [];
    motifs.forEach(function (motif, numeroPaire) {
      paquet.push({ motif: motif, paire: numeroPaire });
      paquet.push({ motif: motif, paire: numeroPaire });
    });
    return Outils.melanger(paquet);
  }

  /* ======================================================================
     4. ETAT ET INTERFACE
     ====================================================================== */

  let etat = null;
  let vue = null;
  let chrono = null;
  let minuteurComparaison = null;

  function construireInterface(conteneur) {
    Outils.vider(conteneur);

    const bandeau = Outils.creer('div', { classe: 'bandeau-jeu' });
    const infoTemps  = creerInfo('Temps', '00:00');
    const infoCoups  = creerInfo('Coups', '0');
    const infoRecord = creerInfo('Record', '--');
    bandeau.append(infoTemps.bloc, infoCoups.bloc, infoRecord.bloc);
    conteneur.appendChild(bandeau);

    const grille = Outils.creer('div', {
      classe: 'grille-memoire',
      attributs: { role: 'grid', 'aria-label': 'Cartes a retourner' }
    });
    conteneur.appendChild(grille);

    const actions = Outils.creer('div', { classe: 'barre-actions' });
    const boutonNouvelle = Outils.creer('button', {
      classe: 'bouton', texte: 'Nouvelle partie', attributs: { type: 'button' }
    });
    actions.appendChild(boutonNouvelle);
    conteneur.appendChild(actions);

    vue = {
      conteneur: conteneur,
      grille: grille,
      cartes: [],
      valeurTemps: infoTemps.valeur,
      valeurCoups: infoCoups.valeur,
      valeurRecord: infoRecord.valeur
    };

    boutonNouvelle.addEventListener('click', demanderNouvellePartie);

    // Delegation : un seul ecouteur pour toutes les cartes.
    grille.addEventListener('click', function (evenement) {
      const bouton = evenement.target.closest('.carte-memoire');
      if (!bouton) return;
      retournerCarte(Number(bouton.dataset.index));
    });
  }

  function creerInfo(etiquette, valeurInitiale) {
    const bloc = Outils.creer('div', { classe: 'info-jeu' });
    bloc.appendChild(Outils.creer('span', { classe: 'etiquette', texte: etiquette }));
    const valeur = Outils.creer('span', { classe: 'valeur', texte: valeurInitiale });
    bloc.appendChild(valeur);
    return { bloc: bloc, valeur: valeur };
  }

  /** Cree les cartes dans le DOM. */
  function dessinerCartes() {
    Outils.vider(vue.grille);
    vue.cartes = [];

    const niveau = trouverNiveau(etat.niveau);
    const theme = trouverTheme(etat.theme);
    vue.grille.style.setProperty('--colonnes', niveau.colonnes);

    etat.cartes.forEach(function (carte, index) {
      const bouton = Outils.creer('button', {
        classe: 'carte-memoire',
        attributs: { type: 'button', 'data-index': String(index), 'aria-label': 'Carte ' + (index + 1) }
      });

      const interieur = Outils.creer('div', { classe: 'interieur-carte' });
      const dos = Outils.creer('div', { classe: 'face-carte face-dos', texte: '?' });
      const avant = Outils.creer('div', { classe: 'face-carte face-avant' });

      if (theme.type === 'couleur') {
        // Theme « Couleurs » : une pastille coloree au lieu d'un caractere.
        avant.appendChild(Outils.creer('div', {
          classe: 'pastille-couleur',
          style: { 'background-color': carte.motif }
        }));
      } else {
        avant.textContent = carte.motif;
      }

      interieur.append(dos, avant);
      bouton.appendChild(interieur);
      vue.grille.appendChild(bouton);
      vue.cartes.push(bouton);
    });

    rafraichir();
  }

  /* ======================================================================
     5. REGLES DU JEU
     ====================================================================== */

  /**
   * Retourne une carte, puis compare des qu'il y en a deux de face.
   */
  function retournerCarte(index) {
    if (!etat || etat.terminee) return;
    if (etat.blocage) return;                       // comparaison en cours
    if (etat.appariees.indexOf(index) !== -1) return;   // deja gagnee
    if (etat.retournees.indexOf(index) !== -1) return;  // deja retournee

    // Le chronometre demarre au premier retournement, pas avant.
    if (!chrono.enMarche()) chrono.demarrer(etat.temps);

    etat.retournees.push(index);
    rafraichir();

    if (etat.retournees.length < 2) { sauvegarder(); return; }

    // Deux cartes retournees : c'est un « coup ».
    etat.coups++;
    majCoups();

    const a = etat.retournees[0];
    const b = etat.retournees[1];

    if (etat.cartes[a].paire === etat.cartes[b].paire) {
      // Paire trouvee : les cartes restent visibles.
      etat.appariees.push(a, b);
      etat.retournees = [];
      Outils.vibrer(25);
      rafraichir();
      sauvegarder();
      verifierVictoire();
    } else {
      // Echec : on laisse les cartes visibles un instant avant de les cacher.
      etat.blocage = true;
      vue.cartes[a].classList.add('ratee');
      vue.cartes[b].classList.add('ratee');
      minuteurComparaison = setTimeout(function () {
        vue.cartes[a].classList.remove('ratee');
        vue.cartes[b].classList.remove('ratee');
        etat.retournees = [];
        etat.blocage = false;
        rafraichir();
        sauvegarder();
      }, 850);
    }
  }

  function rafraichir() {
    if (!etat || !vue) return;
    for (let i = 0; i < vue.cartes.length; i++) {
      const visible = etat.retournees.indexOf(i) !== -1 || etat.appariees.indexOf(i) !== -1;
      vue.cartes[i].classList.toggle('retournee', visible);
      vue.cartes[i].classList.toggle('appariee', etat.appariees.indexOf(i) !== -1);
    }
  }

  function majCoups() {
    vue.valeurCoups.textContent = String(etat.coups);
  }

  function afficherTemps(ms) {
    if (vue) vue.valeurTemps.textContent = Outils.formaterTemps(ms);
  }

  function variante() {
    return etat.theme + '|' + etat.niveau;
  }

  function afficherRecord() {
    const coups = Records.meilleur(ID, 'coups', variante());
    const temps = Records.meilleur(ID, 'temps', variante());
    if (coups === null && temps === null) { vue.valeurRecord.textContent = '--'; return; }
    // On affiche le meilleur nombre de coups, la mesure la plus parlante ici.
    vue.valeurRecord.textContent = coups === null ? Outils.formaterTemps(temps) : coups + ' coups';
  }

  function verifierVictoire() {
    if (etat.appariees.length < etat.cartes.length) return;

    etat.terminee = true;
    etat.temps = chrono.temps();
    chrono.arreter();
    Parties.effacer(ID);
    Outils.vibrer([30, 60, 30]);

    // Deux records independants : le moins de coups et le moins de temps.
    const recordCoups = Records.enregistrer(ID, 'coups', variante(), etat.coups);
    const recordTemps = Records.enregistrer(ID, 'temps', variante(), etat.temps);
    afficherRecord();

    let message = 'Toutes les paires trouvees en ' + etat.coups + ' coups et ' +
                  Outils.formaterTemps(etat.temps) + '.';
    if (recordCoups) message += ' Nouveau record de coups !';
    if (recordTemps) message += ' Nouveau record de temps !';

    Outils.modale({
      titre: (recordCoups || recordTemps) ? 'Nouveau record !' : 'Bravo !',
      message: message,
      boutons: [
        { texte: 'Rejouer', valeur: 'rejouer', principal: true },
        { texte: 'Retour au menu', valeur: 'menu' }
      ]
    }).then(function (choix) {
      if (choix === 'rejouer') lancerPartie(etat.theme, etat.niveau, false);
      else if (choix === 'menu') App.retour();
    });
  }

  function demanderNouvellePartie() {
    if (etat.coups === 0) { lancerPartie(etat.theme, etat.niveau, false); return; }
    Outils.modale({
      titre: 'Nouvelle partie ?',
      message: 'La partie en cours sera perdue.',
      boutons: [
        { texte: 'Nouvelle partie', valeur: true, principal: true },
        { texte: 'Continuer a jouer', valeur: false }
      ]
    }).then(function (confirme) {
      if (confirme) lancerPartie(etat.theme, etat.niveau, false);
    });
  }

  /* ======================================================================
     SAUVEGARDE
     ====================================================================== */

  function sauvegarder() {
    if (!etat || etat.terminee) return;
    Parties.sauvegarder(ID, {
      theme: etat.theme,
      niveau: etat.niveau,
      cartes: etat.cartes,
      appariees: etat.appariees,
      coups: etat.coups,
      temps: chrono ? chrono.temps() : 0
    });
  }

  function lancerPartie(idTheme, idNiveau, reprendre) {
    clearTimeout(minuteurComparaison);
    const sauvegarde = reprendre ? Parties.charger(ID) : null;

    if (sauvegarde && sauvegarde.cartes) {
      etat = {
        theme: sauvegarde.theme,
        niveau: sauvegarde.niveau,
        cartes: sauvegarde.cartes,
        appariees: sauvegarde.appariees || [],
        // On ne restaure jamais une carte « en attente » : ce serait donner
        // une information au joueur qui reprend sa partie.
        retournees: [],
        coups: sauvegarde.coups || 0,
        temps: sauvegarde.temps || 0,
        blocage: false,
        terminee: false
      };
    } else {
      const theme = trouverTheme(idTheme);
      const niveau = trouverNiveau(idNiveau);
      etat = {
        theme: theme.id,
        niveau: niveau.id,
        cartes: distribuer(theme, niveau),
        appariees: [],
        retournees: [],
        coups: 0,
        temps: 0,
        blocage: false,
        terminee: false
      };
      Parties.effacer(ID);
    }

    App.definirTitre('Memoire - ' + trouverTheme(etat.theme).nom);

    dessinerCartes();
    majCoups();
    afficherRecord();

    if (chrono) chrono.arreter();
    chrono = new Chrono(afficherTemps);
    afficherTemps(etat.temps);
    // Comme au demineur, le temps ne court qu'a partir du premier coup...
    // sauf si l'on reprend une partie deja entamee.
    if (etat.coups > 0) chrono.demarrer(etat.temps);
  }

  /* ======================================================================
     INSCRIPTION DU JEU DANS LE MENU
     ====================================================================== */

  window.Jeux[ID] = {
    id: ID,
    nom: 'Memoire',
    emoji: '🃏',
    description: 'Retrouvez les paires : 3 themes, 3 niveaux.',
    themes: THEMES.map(function (t) { return { id: t.id, nom: t.nom }; }),
    niveaux: NIVEAUX,

    texteRecord: function (idNiveau, idTheme) {
      const cle = idTheme + '|' + idNiveau;
      const coups = Records.meilleur(ID, 'coups', cle);
      const temps = Records.meilleur(ID, 'temps', cle);
      if (coups === null && temps === null) return '';
      const morceaux = [];
      if (coups !== null) morceaux.push(coups + ' coups');
      if (temps !== null) morceaux.push(Outils.formaterTemps(temps));
      return 'Record ' + morceaux.join(' / ');
    },

    sauvegardeExiste: function () {
      const s = Parties.charger(ID);
      return !!(s && s.cartes);
    },

    descriptionSauvegarde: function () {
      const s = Parties.charger(ID);
      if (!s) return '';
      const paires = (s.appariees ? s.appariees.length : 0) / 2;
      return trouverTheme(s.theme).nom + ' - ' + trouverNiveau(s.niveau).nom + ' - ' +
             paires + '/' + (s.cartes.length / 2) + ' paires';
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
      clearTimeout(minuteurComparaison);
      etat = null;
      vue = null;
    }
  };

})();

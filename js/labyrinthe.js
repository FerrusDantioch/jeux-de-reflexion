/* ==========================================================================
   labyrinthe.js - Le jeu du Labyrinthe (affichage, controles, integration)
   --------------------------------------------------------------------------
   Ce fichier s'occupe de tout ce que js/labyrinthe-moteur.js ne fait pas :
   dessiner sur un <canvas>, ecouter le clavier et le doigt, jouer des sons,
   sauvegarder la partie, et s'inscrire dans le menu de l'application.

   SOMMAIRE
     1. Reglages d'affichage et persistance (Stockage)
     2. Le "code du labyrinthe" (partager une graine + des reglages)
     3. Ecran de configuration (difficulte, taille, code, reglages)
     4. Ecran de jeu : construction de l'interface
     5. Rendu Canvas (calque des murs pre-dessine, camera, brouillard)
     6. Deplacement du joueur et animation
     7. Entrees : clavier, glissement tactile, manette a l'ecran
     8. Indice, pause, apercu global
     9. Victoire, sauvegarde de la partie en cours
     10. Inscription du jeu dans le menu

   REPRESENTATION
     Comme les autres jeux, une cellule est un seul entier :
       index = y * largeur + x
     Le moteur (js/labyrinthe-moteur.js) fournit les murs, le solveur et le
     generateur ; ce fichier ne fait QUE de l'affichage et des controles.
   ========================================================================== */

window.Jeux = window.Jeux || {};

(function () {
  'use strict';

  const ID = 'labyrinthe';
  const Moteur = window.LabyrintheMoteur;

  /* ======================================================================
     1. REGLAGES ET PERSISTANCE
     ====================================================================== */

  const CLE_REGLAGES = 'labyrinthe.reglages';

  function lireReglages() {
    return Stockage.lire(CLE_REGLAGES, {
      difficulte: 'normal',
      taille: 'moyen',
      manette: false,
      vibrations: true
    });
  }

  function ecrireReglages(partiel) {
    Stockage.ecrire(CLE_REGLAGES, Object.assign({}, lireReglages(), partiel));
  }

  function vibrationsActives() {
    return lireReglages().vibrations !== false;
  }

  // Petits textes d'aide affiches sous chaque bouton de difficulte, sur
  // l'ecran de configuration.
  const DETAIL_DIFFICULTE = {
    facile:    'Plusieurs chemins possibles - indices illimites',
    normal:    'Un seul chemin - 3 indices',
    difficile: 'Beaucoup d\'impasses - 1 indice',
    expert:    'Brouillard autour du joueur - aucun indice'
  };

  function difficulteActuelle() {
    return Moteur.DIFFICULTES[etat.difficulte];
  }

  /* ======================================================================
     2. LE "CODE DU LABYRINTHE"
     ------------------------------------------------------------------------
     Un labyrinthe est entierement determine par 3 informations : la
     difficulte, la taille et la graine. On les encode dans un petit texte
     court, facile a copier-coller ou a dicter, par exemple "NG-3XA1F9"
     (Normal, Grand, graine 3xa1f9 en base 36).
     ====================================================================== */

  const LETTRE_DIFFICULTE = { facile: 'F', normal: 'N', difficile: 'D', expert: 'X' };
  const DIFFICULTE_DEPUIS_LETTRE = { F: 'facile', N: 'normal', D: 'difficile', X: 'expert' };
  const LETTRE_TAILLE = { petit: 'P', moyen: 'M', grand: 'G', immense: 'I' };
  const TAILLE_DEPUIS_LETTRE = { P: 'petit', M: 'moyen', G: 'grand', I: 'immense' };

  function encoderCode(reglages) {
    return LETTRE_DIFFICULTE[reglages.difficulte] + LETTRE_TAILLE[reglages.taille] +
      '-' + reglages.graine.toString(36).toUpperCase();
  }

  /** @returns {{difficulte:string, taille:string, graine:number}|null} null si le code est invalide */
  function decoderCode(code) {
    if (!code) return null;
    const nettoye = code.trim().toUpperCase();
    const correspondance = /^([FNDX])([PMGI])-([0-9A-Z]+)$/.exec(nettoye);
    if (!correspondance) return null;
    const graine = parseInt(correspondance[3], 36);
    if (!Number.isFinite(graine) || graine < 0) return null;
    return {
      difficulte: DIFFICULTE_DEPUIS_LETTRE[correspondance[1]],
      taille: TAILLE_DEPUIS_LETTRE[correspondance[2]],
      graine: graine >>> 0
    };
  }

  /* ======================================================================
     ETAT DU JEU
     ------------------------------------------------------------------------
     Comme dans les autres jeux, `etat` et `vue` sont remis a zero a chaque
     nouvelle partie. `conteneurPrincipal` est l'element fourni par app.js
     (zone-jeu) : on le vide et on le reconstruit a chaque changement d'ecran
     interne (configuration <-> partie).
     ====================================================================== */

  let conteneurPrincipal = null;
  let etat = null;
  let vue = null;
  let chrono = null;
  let enPause = false;

  function positionCellule(index) {
    return { x: index % etat.largeur, y: Math.floor(index / etat.largeur) };
  }

  function texteIndices(n) {
    return Number.isFinite(n) ? String(n) : '∞'; // infini
  }

  /* ======================================================================
     3. ECRAN DE CONFIGURATION
     ====================================================================== */

  function creerBoutonBascule(texte, valeurInitiale, surChangement) {
    let valeur = !!valeurInitiale;
    const bouton = Outils.creer('button', {
      classe: 'bouton' + (valeur ? ' actif' : ''),
      texte: texte,
      attributs: { type: 'button' }
    });
    bouton.addEventListener('click', function () {
      valeur = !valeur;
      bouton.classList.toggle('actif', valeur);
      surChangement(valeur);
    });
    return bouton;
  }

  function afficherConfiguration() {
    desactiverEcoute();
    chrono = null;
    etat = null;

    const conteneur = conteneurPrincipal;
    Outils.vider(conteneur);
    App.definirTitre('Labyrinthe');

    const reglages = lireReglages();
    let difficulteChoisie = Moteur.DIFFICULTES[reglages.difficulte] ? reglages.difficulte : 'normal';
    let tailleChoisie = Moteur.TAILLES[reglages.taille] ? reglages.taille : 'moyen';

    conteneur.appendChild(Outils.creer('p', {
      classe: 'intro',
      texte: 'Choisissez la difficulte et la taille, ou entrez le code d\'un labyrinthe precis.'
    }));

    const blocDifficulte = Outils.creer('div', { classe: 'bloc-options' });
    blocDifficulte.appendChild(Outils.creer('h3', { classe: 'titre-option', texte: 'Difficulte' }));
    const grilleDifficulte = Outils.creer('div', { classe: 'grille-choix-labyrinthe' });
    blocDifficulte.appendChild(grilleDifficulte);
    conteneur.appendChild(blocDifficulte);

    const blocTaille = Outils.creer('div', { classe: 'bloc-options' });
    blocTaille.appendChild(Outils.creer('h3', { classe: 'titre-option', texte: 'Taille' }));
    const grilleTaille = Outils.creer('div', { classe: 'grille-choix-labyrinthe' });
    blocTaille.appendChild(grilleTaille);
    conteneur.appendChild(blocTaille);

    const zoneRecord = Outils.creer('p', { classe: 'record-labyrinthe' });
    conteneur.appendChild(zoneRecord);

    function rafraichir() {
      Outils.vider(grilleDifficulte);
      Moteur.ORDRE_DIFFICULTES.forEach(function (id) {
        const d = Moteur.DIFFICULTES[id];
        const bouton = Outils.creer('button', {
          classe: 'bouton carte-choix' + (id === difficulteChoisie ? ' actif' : ''),
          attributs: { type: 'button' }
        });
        bouton.appendChild(Outils.creer('span', { classe: 'nom-choix', texte: d.nom }));
        bouton.appendChild(Outils.creer('span', { classe: 'detail-choix', texte: DETAIL_DIFFICULTE[id] }));
        bouton.addEventListener('click', function () { difficulteChoisie = id; rafraichir(); });
        grilleDifficulte.appendChild(bouton);
      });

      Outils.vider(grilleTaille);
      Moteur.ORDRE_TAILLES.forEach(function (id) {
        const t = Moteur.TAILLES[id];
        const bouton = Outils.creer('button', {
          classe: 'bouton carte-choix' + (id === tailleChoisie ? ' actif' : ''),
          attributs: { type: 'button' }
        });
        bouton.appendChild(Outils.creer('span', { classe: 'nom-choix', texte: t.nom }));
        bouton.appendChild(Outils.creer('span', { classe: 'detail-choix', texte: t.largeur + ' x ' + t.hauteur }));
        bouton.addEventListener('click', function () { tailleChoisie = id; rafraichir(); });
        grilleTaille.appendChild(bouton);
      });

      const variante = difficulteChoisie + '|' + tailleChoisie;
      const meilleurTemps = Records.meilleur(ID, 'temps', variante);
      const meilleurPas = Records.meilleur(ID, 'pas', variante);
      zoneRecord.textContent = meilleurTemps === null
        ? 'Aucun record pour cette combinaison.'
        : 'Meilleur score : ' + Outils.formaterTemps(meilleurTemps) + ' - ' + meilleurPas + ' pas';
    }
    rafraichir();

    const blocCode = Outils.creer('div', { classe: 'bloc-options' });
    blocCode.appendChild(Outils.creer('h3', { classe: 'titre-option', texte: 'Code du labyrinthe (facultatif)' }));
    const champCode = Outils.creer('input', {
      classe: 'champ-code',
      attributs: { type: 'text', placeholder: 'ex. NG-3XA1F9', autocomplete: 'off', spellcheck: 'false' }
    });
    blocCode.appendChild(champCode);
    conteneur.appendChild(blocCode);

    const blocReglages = Outils.creer('div', { classe: 'bloc-options' });
    blocReglages.appendChild(Outils.creer('h3', { classe: 'titre-option', texte: 'Reglages' }));
    const ligneReglages = Outils.creer('div', { classe: 'liste-choix' });
    ligneReglages.appendChild(creerBoutonBascule('Manette a l\'ecran', reglages.manette, function (v) { ecrireReglages({ manette: v }); }));
    ligneReglages.appendChild(creerBoutonBascule('Son', Sons.estActif(), function (v) { Sons.activer(v); }));
    ligneReglages.appendChild(creerBoutonBascule('Vibrations', reglages.vibrations, function (v) { ecrireReglages({ vibrations: v }); }));
    blocReglages.appendChild(ligneReglages);
    conteneur.appendChild(blocReglages);

    const boutonJouer = Outils.creer('button', {
      classe: 'bouton bouton-principal bouton-large',
      texte: 'Jouer',
      attributs: { type: 'button' }
    });
    boutonJouer.style.marginTop = '18px';
    conteneur.appendChild(boutonJouer);

    boutonJouer.addEventListener('click', function () {
      const code = champCode.value.trim();
      if (code) {
        const decode = decoderCode(code);
        if (!decode) { Outils.info('Code de labyrinthe invalide.'); return; }
        ecrireReglages({ difficulte: decode.difficulte, taille: decode.taille });
        demarrerPartie(decode.difficulte, decode.taille, decode.graine);
        return;
      }
      ecrireReglages({ difficulte: difficulteChoisie, taille: tailleChoisie });
      demarrerPartie(difficulteChoisie, tailleChoisie, null);
    });
  }

  /* ======================================================================
     4. ECRAN DE JEU : CONSTRUCTION DE L'INTERFACE
     ====================================================================== */

  function creerInfo(etiquette, valeurInitiale) {
    const bloc = Outils.creer('div', { classe: 'info-jeu' });
    bloc.appendChild(Outils.creer('span', { classe: 'etiquette', texte: etiquette }));
    const valeur = Outils.creer('span', { classe: 'valeur', texte: valeurInitiale });
    bloc.appendChild(valeur);
    return { bloc: bloc, valeur: valeur };
  }

  function construireManette() {
    const manette = Outils.creer('div', { classe: 'manette-labyrinthe' });
    const boutonHaut   = Outils.creer('button', { classe: 'touche-manette touche-haut',   texte: '▲', attributs: { type: 'button', 'aria-label': 'Haut' } });
    const boutonGauche = Outils.creer('button', { classe: 'touche-manette touche-gauche', texte: '◀', attributs: { type: 'button', 'aria-label': 'Gauche' } });
    const boutonDroite = Outils.creer('button', { classe: 'touche-manette touche-droite', texte: '▶', attributs: { type: 'button', 'aria-label': 'Droite' } });
    const boutonBas    = Outils.creer('button', { classe: 'touche-manette touche-bas',    texte: '▼', attributs: { type: 'button', 'aria-label': 'Bas' } });
    manette.append(boutonHaut, boutonGauche, boutonDroite, boutonBas);

    activerRepetition(boutonHaut, Moteur.HAUT);
    activerRepetition(boutonBas, Moteur.BAS);
    activerRepetition(boutonGauche, Moteur.GAUCHE);
    activerRepetition(boutonDroite, Moteur.DROITE);
    return manette;
  }

  /** Deplacement immediat au premier appui, puis repetition tant que le doigt reste pose. */
  function activerRepetition(element, direction) {
    let attente = null;
    let intervalle = null;
    function demarrer(evenement) {
      evenement.preventDefault();
      tenterDeplacement(direction);
      attente = setTimeout(function () {
        intervalle = setInterval(function () { tenterDeplacement(direction); }, 130);
      }, 350);
    }
    function relacher() {
      clearTimeout(attente);
      clearInterval(intervalle);
    }
    element.addEventListener('pointerdown', demarrer);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (nom) {
      element.addEventListener(nom, relacher);
    });
  }

  function construireEcranJeu() {
    desactiverEcoute();

    const conteneur = conteneurPrincipal;
    Outils.vider(conteneur);
    App.definirTitre('Labyrinthe - ' + Moteur.DIFFICULTES[etat.difficulte].nom + ' / ' + Moteur.TAILLES[etat.taille].nom);

    const bandeau = Outils.creer('div', { classe: 'bandeau-jeu' });
    const infoTemps   = creerInfo('Temps', '00:00');
    const infoPas     = creerInfo('Pas', '0');
    const infoIndices = creerInfo('Indices', texteIndices(etat.indicesRestants));
    bandeau.append(infoTemps.bloc, infoPas.bloc, infoIndices.bloc);
    conteneur.appendChild(bandeau);

    const zone = Outils.creer('div', { classe: 'zone-labyrinthe' });
    const canvas = document.createElement('canvas');
    canvas.className = 'canvas-labyrinthe';
    zone.appendChild(canvas);

    const reglages = lireReglages();
    if (reglages.manette) zone.appendChild(construireManette());

    if (!difficulteActuelle().brouillard) {
      const boutonApercu = Outils.creer('button', {
        classe: 'bouton-apercu',
        texte: '\u{1F5FA}',
        attributs: { type: 'button', 'aria-label': 'Apercu global du labyrinthe' }
      });
      boutonApercu.addEventListener('click', afficherApercu);
      zone.appendChild(boutonApercu);
    }

    conteneur.appendChild(zone);

    const actions = Outils.creer('div', { classe: 'barre-actions' });
    const boutonPause   = Outils.creer('button', { classe: 'bouton', texte: 'Pause', attributs: { type: 'button' } });
    const boutonIndice  = Outils.creer('button', { classe: 'bouton', texte: 'Indice', attributs: { type: 'button' } });
    const boutonNouveau = Outils.creer('button', { classe: 'bouton', texte: 'Nouveau labyrinthe', attributs: { type: 'button' } });
    const boutonMenu    = Outils.creer('button', { classe: 'bouton', texte: 'Menu', attributs: { type: 'button' } });
    actions.append(boutonPause, boutonIndice, boutonNouveau, boutonMenu);
    conteneur.appendChild(actions);

    vue = {
      conteneurJeu: zone,
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      canvasCss: { w: 0, h: 0 },
      infoTemps: infoTemps.valeur,
      infoPas: infoPas.valeur,
      infoIndices: infoIndices.valeur,
      couleurs: lireCouleursTheme(),
      REF: 28,
      offscreen: null,
      animation: null,
      idAnimation: null,
      indiceCellules: null,
      minuteurIndice: null,
      modeCamera: false,
      fenetreCells: 9,
      cellPx: 24,
      origine: { x: 0, y: 0 },
      decalageCellules: { x: 0, y: 0 }
    };

    boutonPause.addEventListener('click', basculerPause);
    boutonIndice.addEventListener('click', declencherIndice);
    boutonNouveau.addEventListener('click', demanderNouveauLabyrinthe);
    boutonMenu.addEventListener('click', function () { App.retour(); });

    brancherEntreesTactiles(canvas);
    activerEcoute();
  }

  function lireCouleursTheme() {
    const style = getComputedStyle(document.documentElement);
    function v(nom, repli) {
      const valeur = style.getPropertyValue(nom).trim();
      return valeur || repli;
    }
    return {
      fond: v('--fond', '#10151f'),
      bordure: v('--bordure', '#2c3852'),
      accentClair: v('--accent-clair', '#7ba3ff'),
      succes: v('--succes', '#3ecf8e'),
      alerte: v('--alerte', '#ffc857')
    };
  }

  /* ======================================================================
     5. RENDU CANVAS
     ------------------------------------------------------------------------
     Les murs ne changent jamais pendant une partie : on les dessine UNE
     SEULE FOIS sur un canvas "hors ecran" (invisible, jamais affiche tel
     quel), a une resolution fixe (REF pixels par cellule). A chaque image,
     on se contente de recopier (drawImage) le morceau de ce calque qui doit
     etre visible, ce qui est beaucoup plus rapide que redessiner tous les
     murs a chaque fois - important sur un telephone d'entree de gamme.
     ====================================================================== */

  function preRendreMurs() {
    const REF = vue.REF;
    const off = document.createElement('canvas');
    off.width = etat.largeur * REF;
    off.height = etat.hauteur * REF;
    const c = off.getContext('2d');

    c.fillStyle = vue.couleurs.fond;
    c.fillRect(0, 0, off.width, off.height);

    c.strokeStyle = vue.couleurs.bordure;
    c.lineWidth = Math.max(2, Math.round(REF * 0.14));
    c.lineCap = 'round';

    for (let y = 0; y < etat.hauteur; y++) {
      for (let x = 0; x < etat.largeur; x++) {
        const i = y * etat.largeur + x;
        const m = etat.murs[i];
        const px = x * REF;
        const py = y * REF;
        c.beginPath();
        // On ne dessine chaque mur interieur qu'UNE fois (cote HAUT et
        // GAUCHE de chaque cellule) ; les bords exterieurs bas et droit de
        // la grille sont ajoutes a part, sinon ils ne seraient jamais tracés.
        if (m & Moteur.HAUT)   { c.moveTo(px, py); c.lineTo(px + REF, py); }
        if (m & Moteur.GAUCHE) { c.moveTo(px, py); c.lineTo(px, py + REF); }
        if (y === etat.hauteur - 1 && (m & Moteur.BAS))    { c.moveTo(px, py + REF); c.lineTo(px + REF, py + REF); }
        if (x === etat.largeur - 1 && (m & Moteur.DROITE)) { c.moveTo(px + REF, py); c.lineTo(px + REF, py + REF); }
        c.stroke();
      }
    }

    dessinerRepere(c, etat.depart, vue.couleurs.accentClair, 'rond', REF);
    dessinerRepere(c, etat.arrivee, vue.couleurs.succes, 'losange', REF);

    vue.offscreen = off;
  }

  /** Depart (rond) et arrivee (losange) : deux formes differentes, pour rester
   *  lisible meme pour un joueur qui ne distingue pas bien les couleurs. */
  function dessinerRepere(c, index, couleur, forme, REF) {
    const x = index % etat.largeur;
    const y = Math.floor(index / etat.largeur);
    const cx = x * REF + REF / 2;
    const cy = y * REF + REF / 2;
    const r = REF * 0.3;
    c.fillStyle = couleur;
    c.beginPath();
    if (forme === 'rond') {
      c.arc(cx, cy, r, 0, Math.PI * 2);
    } else {
      c.moveTo(cx, cy - r); c.lineTo(cx + r, cy); c.lineTo(cx, cy + r); c.lineTo(cx - r, cy); c.closePath();
    }
    c.fill();
  }

  /**
   * Calcule la taille du canevas et decide du mode d'affichage :
   *  - vue entiere si toute la grille tient avec des cellules d'au moins 16px ;
   *  - mode camera sinon (ou toujours en difficulte Expert, a cause du
   *    brouillard, qui n'a de sens que sur une zone limitee autour du joueur).
   */
  function calculerDisposition() {
    if (!vue || !etat) return;
    const zone = vue.conteneurJeu;
    const rectZone = zone.getBoundingClientRect();
    // Marge pour laisser la place a la barre d'actions sous le canevas, sans
    // faire defiler la page.
    const hautDisponible = window.innerHeight - rectZone.top - 84;
    const largeurDisponible = zone.clientWidth || 320;
    const cote = Math.max(220, Math.min(hautDisponible, largeurDisponible));

    vue.canvas.style.width = cote + 'px';
    vue.canvas.style.height = cote + 'px';
    const dpr = window.devicePixelRatio || 1;
    vue.canvas.width = Math.round(cote * dpr);
    vue.canvas.height = Math.round(cote * dpr);
    vue.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    vue.canvasCss = { w: cote, h: cote };

    const cellPleinEcran = cote / Math.max(etat.largeur, etat.hauteur);
    if (!difficulteActuelle().brouillard && cellPleinEcran >= 16) {
      vue.modeCamera = false;
      vue.cellPx = cellPleinEcran;
    } else {
      vue.modeCamera = true;
      vue.fenetreCells = Math.max(5, Math.min(9, etat.largeur, etat.hauteur));
      vue.cellPx = cote / vue.fenetreCells;
    }
  }

  /** Position (fractionnaire pendant une animation) du joueur, en cellules. */
  function positionInterpolee() {
    if (vue.animation) {
      let t = (performance.now() - vue.animation.debut) / vue.animation.duree;
      if (t > 1) t = 1; else if (t < 0) t = 0;
      t = t * t * (3 - 2 * t); // lissage ("smoothstep") : depart et arrivee en douceur
      const de = positionCellule(vue.animation.de);
      const vers = positionCellule(vue.animation.vers);
      return { x: de.x + (vers.x - de.x) * t, y: de.y + (vers.y - de.y) * t };
    }
    return positionCellule(etat.joueur);
  }

  /** Coin haut-gauche, en pixels ecran, d'une cellule (coordonnees en cellules). */
  function celluleEnEcran(cx, cy) {
    return {
      x: vue.origine.x + (cx - vue.decalageCellules.x) * vue.cellPx,
      y: vue.origine.y + (cy - vue.decalageCellules.y) * vue.cellPx
    };
  }

  function dessiner() {
    if (!vue || !vue.ctx || !etat) return;
    const ctx = vue.ctx;
    ctx.clearRect(0, 0, vue.canvasCss.w, vue.canvasCss.h);

    const REF = vue.REF;
    const pos = positionInterpolee();
    let srcCote, destCote, decX = 0, decY = 0;

    if (vue.modeCamera) {
      const fenetre = vue.fenetreCells;
      decX = Math.max(0, Math.min(etat.largeur - fenetre, pos.x + 0.5 - fenetre / 2));
      decY = Math.max(0, Math.min(etat.hauteur - fenetre, pos.y + 0.5 - fenetre / 2));
      srcCote = fenetre * REF;
      destCote = vue.cellPx * fenetre;
    } else {
      srcCote = etat.largeur * REF; // toutes les tailles du jeu sont carrees
      destCote = etat.largeur * vue.cellPx;
    }

    vue.origine = { x: (vue.canvasCss.w - destCote) / 2, y: (vue.canvasCss.h - destCote) / 2 };
    vue.decalageCellules = { x: decX, y: decY };

    ctx.drawImage(vue.offscreen, decX * REF, decY * REF, srcCote, srcCote, vue.origine.x, vue.origine.y, destCote, destCote);

    dessinerTrace(ctx);
    if (difficulteActuelle().brouillard) dessinerBrouillard(ctx, pos);
    if (vue.indiceCellules) dessinerIndiceCanvas(ctx);
    dessinerJoueur(ctx, pos);
  }

  /** Petits points discrets sur les cellules deja visitees : aide a se reperer. */
  function dessinerTrace(ctx) {
    ctx.fillStyle = vue.couleurs.accentClair;
    const rayon = vue.cellPx * 0.09;
    const marge = 1;
    for (let i = 0; i < etat.visitees.length; i++) {
      if (!etat.visitees[i] || i === etat.joueur) continue;
      const p = positionCellule(i);
      if (vue.modeCamera && (p.x < vue.decalageCellules.x - marge || p.x > vue.decalageCellules.x + vue.fenetreCells + marge ||
                              p.y < vue.decalageCellules.y - marge || p.y > vue.decalageCellules.y + vue.fenetreCells + marge)) continue;
      const e = celluleEnEcran(p.x + 0.5, p.y + 0.5);
      ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(e.x, e.y, rayon, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /**
   * Brouillard de la difficulte Expert : zone visible circulaire autour du
   * joueur, avec un degrade doux, et les cellules deja visitees qui restent
   * FAIBLEMENT visibles meme hors de portee (au lieu de redevenir noires).
   */
  function dessinerBrouillard(ctx, pos) {
    const fenetre = vue.fenetreCells;
    const rayonProche = 1.7;
    const rayonLoin = 3.6;
    for (let ly = 0; ly < fenetre; ly++) {
      for (let lx = 0; lx < fenetre; lx++) {
        const cx = vue.decalageCellules.x + lx;
        const cy = vue.decalageCellules.y + ly;
        if (cx < 0 || cy < 0 || cx >= etat.largeur || cy >= etat.hauteur) continue;
        const index = Math.floor(cy) * etat.largeur + Math.floor(cx);
        const dist = Math.hypot(cx + 0.5 - (pos.x + 0.5), cy + 0.5 - (pos.y + 0.5));
        let opacite;
        if (dist <= rayonProche) opacite = 0;
        else if (dist >= rayonLoin) opacite = 0.95;
        else opacite = (dist - rayonProche) / (rayonLoin - rayonProche);
        if (etat.visitees[index]) opacite = Math.min(opacite, 0.55);
        if (opacite <= 0.02) continue;
        const e = celluleEnEcran(cx, cy);
        ctx.fillStyle = 'rgba(6, 9, 16, ' + opacite + ')';
        ctx.fillRect(e.x - 1, e.y - 1, vue.cellPx + 2, vue.cellPx + 2);
      }
    }
  }

  function dessinerIndiceCanvas(ctx) {
    ctx.fillStyle = vue.couleurs.succes;
    ctx.globalAlpha = 0.4;
    vue.indiceCellules.forEach(function (index, i) {
      if (i === 0) return; // la premiere cellule est celle ou se trouve deja le joueur
      const p = positionCellule(index);
      const e = celluleEnEcran(p.x + 0.5, p.y + 0.5);
      ctx.beginPath(); ctx.arc(e.x, e.y, vue.cellPx * 0.22, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function dessinerJoueur(ctx, pos) {
    const e = celluleEnEcran(pos.x + 0.5, pos.y + 0.5);
    ctx.fillStyle = vue.couleurs.alerte;
    ctx.beginPath();
    ctx.arc(e.x, e.y, vue.cellPx * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ======================================================================
     6. DEPLACEMENT DU JOUEUR
     ====================================================================== */

  const DELTA_DIRECTION = {}; // rempli juste apres, une fois Moteur disponible
  DELTA_DIRECTION[Moteur.HAUT]   = { dx: 0, dy: -1 };
  DELTA_DIRECTION[Moteur.DROITE] = { dx: 1, dy: 0 };
  DELTA_DIRECTION[Moteur.BAS]    = { dx: 0, dy: 1 };
  DELTA_DIRECTION[Moteur.GAUCHE] = { dx: -1, dy: 0 };

  function reduireMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function tenterDeplacement(direction) {
    if (!etat || etat.terminee || enPause || vue.animation) return;

    if (etat.murs[etat.joueur] & direction) {
      // Un mur bloque le passage : retour sensoriel, mais aucun pas compte.
      Sons.jouer('mur');
      if (vibrationsActives()) Outils.vibrer(15);
      return;
    }

    const delta = DELTA_DIRECTION[direction];
    const pos = positionCellule(etat.joueur);
    const cible = (pos.y + delta.dy) * etat.largeur + (pos.x + delta.dx);

    const depart = etat.joueur;
    etat.joueur = cible;
    etat.pas++;
    etat.visitees[cible] = 1;
    Sons.jouer('pas');
    miseAJourHUD();
    sauvegarder();

    const duree = reduireMotion() ? 0 : 130;
    if (duree === 0) {
      dessiner();
      apresArriveeCellule();
    } else {
      vue.animation = { de: depart, vers: cible, debut: performance.now(), duree: duree };
      lancerBoucleAnimation();
    }
  }

  function lancerBoucleAnimation() {
    function etape() {
      dessiner();
      if (vue.animation && performance.now() - vue.animation.debut < vue.animation.duree) {
        vue.idAnimation = requestAnimationFrame(etape);
      } else {
        vue.animation = null;
        dessiner();
        apresArriveeCellule();
      }
    }
    vue.idAnimation = requestAnimationFrame(etape);
  }

  function apresArriveeCellule() {
    if (etat && etat.joueur === etat.arrivee) terminerPartie();
  }

  /* ======================================================================
     7. ENTREES : CLAVIER, GLISSEMENT TACTILE, MANETTE
     ====================================================================== */

  // event.code identifie la touche PHYSIQUE, independamment de la disposition
  // du clavier : KeyW correspond a la touche portant un Z sur un clavier
  // AZERTY francais. Ainsi, "WASD" et "ZQSD" sont geres par le meme code.
  const TOUCHE_VERS_DIRECTION = {};
  function remplirTouches() {
    TOUCHE_VERS_DIRECTION.ArrowUp = Moteur.HAUT;
    TOUCHE_VERS_DIRECTION.KeyW = Moteur.HAUT;
    TOUCHE_VERS_DIRECTION.ArrowRight = Moteur.DROITE;
    TOUCHE_VERS_DIRECTION.KeyD = Moteur.DROITE;
    TOUCHE_VERS_DIRECTION.ArrowDown = Moteur.BAS;
    TOUCHE_VERS_DIRECTION.KeyS = Moteur.BAS;
    TOUCHE_VERS_DIRECTION.ArrowLeft = Moteur.GAUCHE;
    TOUCHE_VERS_DIRECTION.KeyA = Moteur.GAUCHE;
  }
  remplirTouches();

  function gestionnaireClavier(evenement) {
    if (!etat) return;
    const direction = TOUCHE_VERS_DIRECTION[evenement.code];
    if (direction) { evenement.preventDefault(); tenterDeplacement(direction); return; }
    if (evenement.code === 'Escape' || evenement.code === 'KeyP') { evenement.preventDefault(); basculerPause(); return; }
    if (evenement.code === 'KeyH') { evenement.preventDefault(); declencherIndice(); }
  }

  /**
   * Un seul gestionnaire gere a la fois le glissement rapide (swipe) et le
   * glissement continu (maintenir le doigt et tracer un chemin) : a chaque
   * fois que le doigt s'est deplace de plus d'un certain seuil, on avance
   * d'une case et on reprend la mesure a partir de la position actuelle.
   */
  function brancherEntreesTactiles(canvas) {
    let reference = null;

    canvas.addEventListener('pointerdown', function (evenement) {
      canvas.setPointerCapture(evenement.pointerId);
      reference = { x: evenement.clientX, y: evenement.clientY };
    });

    canvas.addEventListener('pointermove', function (evenement) {
      if (!reference || enPause) return;
      const dx = evenement.clientX - reference.x;
      const dy = evenement.clientY - reference.y;
      const seuil = Math.max(20, (vue.cellPx || 24) * 0.55);
      if (Math.abs(dx) < seuil && Math.abs(dy) < seuil) return;

      const direction = Math.abs(dx) > Math.abs(dy)
        ? (dx > 0 ? Moteur.DROITE : Moteur.GAUCHE)
        : (dy > 0 ? Moteur.BAS : Moteur.HAUT);
      tenterDeplacement(direction);
      reference = { x: evenement.clientX, y: evenement.clientY };
    });

    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (nom) {
      canvas.addEventListener(nom, function () { reference = null; });
    });
  }

  let gestionnaireClavierActif = null;
  let gestionnaireRedimActif = null;

  function activerEcoute() {
    gestionnaireClavierActif = gestionnaireClavier;
    gestionnaireRedimActif = function () { calculerDisposition(); dessiner(); };
    window.addEventListener('keydown', gestionnaireClavierActif);
    window.addEventListener('resize', gestionnaireRedimActif);
    window.addEventListener('orientationchange', gestionnaireRedimActif);
  }

  function desactiverEcoute() {
    if (gestionnaireClavierActif) window.removeEventListener('keydown', gestionnaireClavierActif);
    if (gestionnaireRedimActif) {
      window.removeEventListener('resize', gestionnaireRedimActif);
      window.removeEventListener('orientationchange', gestionnaireRedimActif);
    }
    gestionnaireClavierActif = null;
    gestionnaireRedimActif = null;
    if (vue && vue.idAnimation) cancelAnimationFrame(vue.idAnimation);
    if (vue && vue.minuteurIndice) clearTimeout(vue.minuteurIndice);
  }

  /* ======================================================================
     8. INDICE, PAUSE, APERCU GLOBAL
     ====================================================================== */

  function declencherIndice() {
    if (!etat || etat.terminee || enPause) return;
    if (etat.indicesRestants <= 0) { Outils.info('Plus d\'indice disponible pour cette difficulte.'); return; }

    const chemin = Moteur.resoudre(etat.murs, etat.largeur, etat.hauteur, etat.joueur, etat.arrivee);
    if (!chemin) return;

    vue.indiceCellules = chemin.slice(0, Math.min(6, chemin.length));
    Sons.jouer('indice');
    if (Number.isFinite(etat.indicesRestants)) { etat.indicesRestants--; miseAJourHUD(); }
    dessiner();

    clearTimeout(vue.minuteurIndice);
    vue.minuteurIndice = setTimeout(function () { vue.indiceCellules = null; dessiner(); }, 1600);
    sauvegarder();
  }

  function basculerPause() {
    if (!etat || etat.terminee || enPause) return;
    enPause = true;
    chrono.pause();
    Outils.modale({
      titre: 'Pause',
      message: 'La partie est en pause.',
      boutons: [
        { texte: 'Reprendre', valeur: 'reprendre', principal: true },
        { texte: 'Quitter au menu', valeur: 'menu' }
      ]
    }).then(function (choix) {
      enPause = false;
      if (choix === 'menu') { App.retour(); return; }
      chrono.demarrer();
      dessiner();
    });
  }

  function afficherApercu() {
    if (!etat || difficulteActuelle().brouillard) return;
    const REF = vue.REF;
    const tailleMax = Math.min(window.innerWidth, window.innerHeight) * 0.86;
    const echelle = tailleMax / Math.max(etat.largeur * REF, etat.hauteur * REF);

    const overlay = Outils.creer('div', { classe: 'apercu-labyrinthe' });
    const canvasApercu = document.createElement('canvas');
    canvasApercu.width = Math.round(etat.largeur * REF * echelle);
    canvasApercu.height = Math.round(etat.hauteur * REF * echelle);
    canvasApercu.style.width = canvasApercu.width + 'px';
    canvasApercu.style.height = canvasApercu.height + 'px';

    const c = canvasApercu.getContext('2d');
    c.drawImage(vue.offscreen, 0, 0, canvasApercu.width, canvasApercu.height);
    const pos = positionCellule(etat.joueur);
    c.fillStyle = vue.couleurs.alerte;
    c.beginPath();
    c.arc((pos.x + 0.5) * REF * echelle, (pos.y + 0.5) * REF * echelle, Math.max(3, REF * echelle * 0.4), 0, Math.PI * 2);
    c.fill();

    overlay.appendChild(canvasApercu);
    overlay.appendChild(Outils.creer('p', { classe: 'astuce-apercu', texte: 'Touchez l\'ecran pour revenir a la partie.' }));
    overlay.addEventListener('click', function () { overlay.remove(); });
    vue.conteneurJeu.appendChild(overlay);
  }

  function demanderNouveauLabyrinthe() {
    if (!etat) return;
    if (etat.pas === 0) { demarrerPartie(etat.difficulte, etat.taille, null); return; }
    Outils.modale({
      titre: 'Nouveau labyrinthe ?',
      message: 'La partie en cours sera perdue.',
      boutons: [
        { texte: 'Nouveau labyrinthe', valeur: true, principal: true },
        { texte: 'Continuer a jouer', valeur: false }
      ]
    }).then(function (confirme) {
      if (confirme) demarrerPartie(etat.difficulte, etat.taille, null);
    });
  }

  /* ======================================================================
     9. VICTOIRE ET SAUVEGARDE
     ====================================================================== */

  function afficherTemps(ms) {
    if (vue) vue.infoTemps.textContent = Outils.formaterTemps(ms);
  }

  function miseAJourHUD() {
    if (!vue) return;
    vue.infoPas.textContent = String(etat.pas);
    vue.infoIndices.textContent = texteIndices(etat.indicesRestants);
  }

  function copierCode(code) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code)
        .then(function () { Outils.info('Code copie : ' + code); })
        .catch(function () { Outils.info('Code : ' + code); });
    } else {
      Outils.info('Code : ' + code);
    }
  }

  function terminerPartie() {
    etat.terminee = true;
    const tempsFinal = chrono.temps();
    chrono.arreter();
    Parties.effacer(ID);
    Sons.jouer('victoire');
    if (vibrationsActives()) Outils.vibrer([30, 60, 30, 60, 120]);
    dessiner();

    const variante = etat.difficulte + '|' + etat.taille;
    const recordTemps = Records.enregistrer(ID, 'temps', variante, tempsFinal);
    const recordPas = Records.enregistrer(ID, 'pas', variante, etat.pas);
    const meilleurTemps = Records.meilleur(ID, 'temps', variante);
    const meilleurPas = Records.meilleur(ID, 'pas', variante);

    const optimal = etat.cheminOptimalLongueur;
    const ratio = optimal > 0 ? etat.pas / optimal : 1;
    const etoiles = ratio <= 1.10 ? 3 : (ratio <= 1.5 ? 2 : 1);
    const etoilesTexte = '★'.repeat(etoiles) + '☆'.repeat(3 - etoiles);

    const code = encoderCode({ difficulte: etat.difficulte, taille: etat.taille, graine: etat.graine });

    const corps =
      '<p>Temps : <strong>' + Outils.formaterTemps(tempsFinal) + '</strong><br>' +
      'Pas : <strong>' + etat.pas + '</strong> (chemin le plus court : ' + optimal + ')</p>' +
      '<p style="font-size:1.5rem;letter-spacing:3px;color:var(--alerte);">' + etoilesTexte + '</p>' +
      '<p>Meilleur score : ' + Outils.formaterTemps(meilleurTemps) + ' - ' + meilleurPas + ' pas</p>' +
      '<p>Code du labyrinthe : <code>' + code + '</code></p>';

    Outils.modale({
      titre: (recordTemps || recordPas) ? 'Nouveau record !' : 'Labyrinthe resolu !',
      messageHtml: corps,
      boutons: [
        { texte: 'Rejouer le meme', valeur: 'meme', principal: true },
        { texte: 'Nouveau labyrinthe', valeur: 'nouveau' },
        { texte: 'Copier le code', valeur: 'copier' },
        { texte: 'Changer les reglages', valeur: 'reglages' }
      ]
    }).then(function (choix) {
      if (choix === 'meme') demarrerPartie(etat.difficulte, etat.taille, etat.graine);
      else if (choix === 'nouveau') demarrerPartie(etat.difficulte, etat.taille, null);
      else if (choix === 'copier') copierCode(code);
      else afficherConfiguration();
    });
  }

  function sauvegarder() {
    if (!etat || etat.terminee) return;
    const visitees = [];
    for (let i = 0; i < etat.visitees.length; i++) if (etat.visitees[i]) visitees.push(i);
    Parties.sauvegarder(ID, {
      difficulte: etat.difficulte,
      taille: etat.taille,
      graine: etat.graine,
      position: etat.joueur,
      pas: etat.pas,
      // JSON ne sait pas representer Infinity (il le transformerait en null) :
      // on utilise -1 comme code special pour "indices illimites".
      indicesRestants: Number.isFinite(etat.indicesRestants) ? etat.indicesRestants : -1,
      cellulesVisitees: visitees,
      temps: chrono ? chrono.temps() : 0
    });
  }

  /** Construit l'etat de jeu a partir d'un labyrinthe fraichement genere. */
  function construireEtat(laby, restauration) {
    const distances = Moteur.calculerDistances(laby.murs, laby.largeur, laby.hauteur, laby.depart);
    const visitees = new Uint8Array(laby.largeur * laby.hauteur);
    const joueur = restauration && typeof restauration.position === 'number' ? restauration.position : laby.depart;

    if (restauration && restauration.cellulesVisitees) {
      restauration.cellulesVisitees.forEach(function (i) { visitees[i] = 1; });
    }
    visitees[joueur] = 1;

    return {
      difficulte: laby.difficulte,
      taille: laby.taille,
      graine: laby.graine,
      largeur: laby.largeur,
      hauteur: laby.hauteur,
      murs: laby.murs,
      depart: laby.depart,
      arrivee: laby.arrivee,
      joueur: joueur,
      pas: restauration ? (restauration.pas || 0) : 0,
      indicesRestants: restauration
        ? (restauration.indicesRestants === -1 ? Infinity : restauration.indicesRestants)
        : Moteur.DIFFICULTES[laby.difficulte].indices,
      cheminOptimalLongueur: distances[laby.arrivee],
      visitees: visitees,
      terminee: false
    };
  }

  function demarrerPartie(idDifficulte, idTaille, graine) {
    const laby = Moteur.genererLabyrinthe({ difficulte: idDifficulte, taille: idTaille, graine: graine });
    etat = construireEtat(laby, null);
    Parties.effacer(ID);

    construireEcranJeu();
    preRendreMurs();
    calculerDisposition();

    if (chrono) chrono.arreter();
    chrono = new Chrono(afficherTemps);
    chrono.demarrer(0);

    miseAJourHUD();
    dessiner();
    sauvegarder();
  }

  function essaieReprendre() {
    const sauvegarde = Parties.charger(ID);
    if (!sauvegarde) { afficherConfiguration(); return; }

    const laby = Moteur.genererLabyrinthe({ difficulte: sauvegarde.difficulte, taille: sauvegarde.taille, graine: sauvegarde.graine });
    etat = construireEtat(laby, sauvegarde);

    construireEcranJeu();
    preRendreMurs();
    calculerDisposition();

    if (chrono) chrono.arreter();
    chrono = new Chrono(afficherTemps);
    chrono.demarrer(sauvegarde.temps || 0);

    miseAJourHUD();
    dessiner();
  }

  /* ======================================================================
     10. INSCRIPTION DU JEU DANS LE MENU
     ------------------------------------------------------------------------
     Le menu generique de app.js attend une liste de "niveaux" a choisir en un
     clic. Le Labyrinthe a besoin de deux reglages independants (difficulte
     ET taille) plus un code facultatif : on lui fournit donc un seul
     "niveau" qui ouvre notre propre ecran de configuration (section 3),
     construit a l'interieur du meme conteneur.
     ====================================================================== */

  const NIVEAUX_MENU = [
    { id: 'jouer', nom: 'Jouer', detail: 'Difficulte et taille au choix, ou code de partage' }
  ];

  window.Jeux[ID] = {
    id: ID,
    nom: 'Labyrinthe',
    emoji: '\u{1F9ED}', // boussole
    description: '4 difficultes, 4 tailles, labyrinthes partageables par code.',
    themes: null,
    niveaux: NIVEAUX_MENU,

    texteRecord: function () {
      return ''; // les records sont affiches, plus precisement, sur l'ecran de configuration
    },

    sauvegardeExiste: function () {
      return !!Parties.charger(ID);
    },

    descriptionSauvegarde: function () {
      const s = Parties.charger(ID);
      if (!s) return '';
      const d = Moteur.DIFFICULTES[s.difficulte];
      const t = Moteur.TAILLES[s.taille];
      return (d ? d.nom : s.difficulte) + ' / ' + (t ? t.nom : s.taille) + ' - ' +
        Outils.formaterTemps(s.temps || 0) + ', ' + (s.pas || 0) + ' pas';
    },

    sauvegarder: function () { sauvegarder(); },

    demarrer: function (conteneur, options) {
      conteneurPrincipal = conteneur;
      if (options && options.reprendre === true) essaieReprendre();
      else afficherConfiguration();
    },

    arreter: function () {
      sauvegarder();
      desactiverEcoute();
      if (chrono) { chrono.arreter(); chrono = null; }
      etat = null;
      vue = null;
      enPause = false;
    }
  };

})();

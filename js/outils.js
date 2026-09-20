/* ==========================================================================
   outils.js - Petites fonctions utilitaires partagees par les quatre jeux
   --------------------------------------------------------------------------
   Regrouper ces fonctions evite de recopier le meme code dans sudoku.js,
   mots-meles.js, demineur.js et memoire.js. Si un jour il faut corriger le
   melange aleatoire ou le format du chronometre, on ne le fait qu'ici.
   ========================================================================== */

const Outils = (function () {

  /* ----------------------------------------------------------------------
     HASARD
     ---------------------------------------------------------------------- */

  /** Entier aleatoire entre 0 (inclus) et max (exclu). */
  function hasard(max) {
    return Math.floor(Math.random() * max);
  }

  /** Element tire au hasard dans un tableau. */
  function auHasard(tableau) {
    return tableau[hasard(tableau.length)];
  }

  /**
   * Melange un tableau « sur place » avec l'algorithme de Fisher-Yates.
   * Principe : on parcourt le tableau depuis la fin et on echange chaque
   * element avec un element tire au hasard parmi ceux qui restent devant.
   * C'est le seul melange reellement equitable (contrairement au fameux
   * tableau.sort(() => Math.random() - 0.5), qui est biaise).
   */
  function melanger(tableau) {
    for (let i = tableau.length - 1; i > 0; i--) {
      const j = hasard(i + 1);
      const temp = tableau[i];
      tableau[i] = tableau[j];
      tableau[j] = temp;
    }
    return tableau;
  }

  /* ----------------------------------------------------------------------
     AFFICHAGE DU TEMPS
     ---------------------------------------------------------------------- */

  /**
   * Transforme une duree en millisecondes en texte lisible.
   * 65000  -> "01:05"
   * 3725000-> "1:02:05"
   */
  function formaterTemps(ms) {
    if (typeof ms !== 'number' || ms < 0) return '--:--';
    const totalSecondes = Math.floor(ms / 1000);
    const heures = Math.floor(totalSecondes / 3600);
    const minutes = Math.floor((totalSecondes % 3600) / 60);
    const secondes = totalSecondes % 60;
    // padStart(2, '0') ajoute un zero devant les nombres a un chiffre : 5 -> "05"
    const mm = String(minutes).padStart(2, '0');
    const ss = String(secondes).padStart(2, '0');
    return heures > 0 ? heures + ':' + mm + ':' + ss : mm + ':' + ss;
  }

  /* ----------------------------------------------------------------------
     CREATION D'ELEMENTS HTML
     ---------------------------------------------------------------------- */

  /**
   * Raccourci pour creer un element HTML.
   * Exemple : Outils.creer('button', { classe: 'bouton', texte: 'Rejouer' })
   *
   * @param {string} balise           'div', 'button', 'span'...
   * @param {object} [options]
   * @param {string} [options.classe]  liste de classes CSS
   * @param {string} [options.texte]   contenu textuel
   * @param {object} [options.attributs] attributs HTML supplementaires
   * @param {object} [options.style]   proprietes CSS en ligne
   */
  function creer(balise, options) {
    const element = document.createElement(balise);
    if (!options) return element;
    if (options.classe) element.className = options.classe;
    // textContent (et non innerHTML) : aucun risque d'injecter du HTML par erreur
    if (options.texte !== undefined) element.textContent = options.texte;
    if (options.attributs) {
      Object.keys(options.attributs).forEach(function (nom) {
        element.setAttribute(nom, options.attributs[nom]);
      });
    }
    if (options.style) {
      Object.keys(options.style).forEach(function (nom) {
        element.style.setProperty(nom, options.style[nom]);
      });
    }
    return element;
  }

  /** Supprime tous les enfants d'un element (plus propre que innerHTML = ''). */
  function vider(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
    return element;
  }

  /* ----------------------------------------------------------------------
     RETOUR HAPTIQUE (vibration)
     ---------------------------------------------------------------------- */

  /**
   * Fait vibrer le telephone si l'appareil le permet.
   * @param {number|number[]} motif duree en ms, ou alternance vibre/pause
   */
  function vibrer(motif) {
    try {
      if (navigator.vibrate) navigator.vibrate(motif);
    } catch (e) { /* non supporte : sans importance */ }
  }

  /* ----------------------------------------------------------------------
     FENETRE MODALE
     ---------------------------------------------------------------------- */

  const fondModale    = document.getElementById('fond-modale');
  const titreModale   = document.getElementById('titre-modale');
  const corpsModale   = document.getElementById('corps-modale');
  const actionsModale = document.getElementById('actions-modale');

  /**
   * Affiche une fenetre modale et renvoie une PROMESSE (Promise) qui se
   * resout avec la valeur du bouton clique.
   *
   * Exemple d'utilisation :
   *   const choix = await Outils.modale({
   *     titre: 'Nouvelle partie ?',
   *     message: 'La partie en cours sera perdue.',
   *     boutons: [
   *       { texte: 'Oui', valeur: true, principal: true },
   *       { texte: 'Annuler', valeur: false }
   *     ]
   *   });
   *
   * Une « promesse » represente un resultat qui n'existe pas encore : ici on
   * attend que l'utilisateur clique. Cela evite d'imbriquer des fonctions de
   * rappel les unes dans les autres.
   */
  function modale(config) {
    return new Promise(function (resoudre) {
      titreModale.textContent = config.titre || '';
      vider(corpsModale);

      if (config.messageHtml) {
        // Utilise uniquement avec du contenu que NOUS produisons (jamais une
        // saisie utilisateur), donc sans risque d'injection.
        corpsModale.innerHTML = config.messageHtml;
      } else if (config.message) {
        corpsModale.textContent = config.message;
      }

      vider(actionsModale);
      const boutons = config.boutons || [{ texte: 'Fermer', valeur: null, principal: true }];

      boutons.forEach(function (def) {
        const bouton = creer('button', {
          classe: 'bouton' + (def.principal ? ' bouton-principal' : ''),
          texte: def.texte,
          attributs: { type: 'button' }
        });
        bouton.addEventListener('click', function () {
          fermerModale();
          resoudre(def.valeur);
        });
        actionsModale.appendChild(bouton);
      });

      fondModale.hidden = false;
      // Donne le focus au premier bouton : pratique au clavier
      const premier = actionsModale.querySelector('button');
      if (premier) premier.focus();
    });
  }

  function fermerModale() {
    fondModale.hidden = true;
  }

  /* ----------------------------------------------------------------------
     BULLE D'INFORMATION TEMPORAIRE
     ---------------------------------------------------------------------- */

  const bulle = document.getElementById('bulle-info');
  let minuteurBulle = null;

  /** Affiche un court message en bas de l'ecran pendant quelques secondes. */
  function info(texte, duree) {
    bulle.textContent = texte;
    bulle.hidden = false;
    clearTimeout(minuteurBulle);
    minuteurBulle = setTimeout(function () { bulle.hidden = true; }, duree || 2200);
  }

  return {
    hasard: hasard,
    auHasard: auHasard,
    melanger: melanger,
    formaterTemps: formaterTemps,
    creer: creer,
    vider: vider,
    vibrer: vibrer,
    modale: modale,
    fermerModale: fermerModale,
    info: info
  };
})();


/* ==========================================================================
   Chrono - chronometre reutilisable
   --------------------------------------------------------------------------
   POINT TECHNIQUE IMPORTANT : on ne compte pas les « tics » du minuteur
   (setInterval n'est pas precis, et le navigateur le ralentit fortement quand
   l'onglet passe en arriere-plan). On memorise plutot l'HEURE de depart et on
   calcule la difference avec l'heure actuelle. Le temps affiche reste donc
   juste, meme apres avoir verrouille son telephone pendant dix minutes.
   ========================================================================== */
class Chrono {

  /** @param {function(number)} [surChangement] appelee ~4 fois par seconde */
  constructor(surChangement) {
    this.surChangement = surChangement || null;
    this.msAccumules   = 0;     // temps deja ecoule lors des periodes precedentes
    this.debut         = null;  // horodatage du demarrage de la periode en cours
    this.minuteur      = null;  // identifiant du setInterval
  }

  /** Temps total ecoule, en millisecondes. */
  temps() {
    const enCours = this.debut === null ? 0 : Date.now() - this.debut;
    return this.msAccumules + enCours;
  }

  /**
   * Lance (ou relance) le chronometre.
   * @param {number} [msInitial] temps de depart, pour reprendre une partie
   */
  demarrer(msInitial) {
    if (typeof msInitial === 'number') this.msAccumules = msInitial;
    if (this.debut !== null) return;              // deja en marche
    this.debut = Date.now();
    const self = this;
    this.minuteur = setInterval(function () {
      if (self.surChangement) self.surChangement(self.temps());
    }, 250);
    if (this.surChangement) this.surChangement(this.temps());
  }

  /** Met en pause sans perdre le temps deja ecoule. */
  pause() {
    if (this.debut === null) return;
    this.msAccumules += Date.now() - this.debut;
    this.debut = null;
    clearInterval(this.minuteur);
    this.minuteur = null;
  }

  /** Arrete definitivement et libere le minuteur. */
  arreter() {
    this.pause();
  }

  /** Remet le compteur a zero. */
  remettreAZero() {
    this.arreter();
    this.msAccumules = 0;
    if (this.surChangement) this.surChangement(0);
  }

  enMarche() {
    return this.debut !== null;
  }
}


/* ==========================================================================
   Sons - petits effets sonores synthetises (Web Audio API)
   --------------------------------------------------------------------------
   POURQUOI SYNTHETISER AU LIEU D'UTILISER DES FICHIERS AUDIO ?
   Un fichier .mp3 ou .wav pese plusieurs dizaines de kilo-octets et doit etre
   telecharge puis mis en cache par le service worker. En fabriquant les sons
   directement avec du code (un << oscillateur >> qui produit une frequence,
   dont on fait monter puis descendre le volume), on obtient des bips tres
   courts, sans aucun fichier, ce qui garde l'application ultra-legere.

   Ce module est partage : n'importe quel jeu peut appeler Sons.jouer('pas'),
   par exemple, sans avoir a re-ecrire la moindre ligne de Web Audio API.
   ========================================================================== */
const Sons = (function () {

  const CLE_ACTIF = 'reglages.son';
  let actif = Stockage.lire(CLE_ACTIF, true);

  // Le contexte audio n'est cree qu'au premier son joue : les navigateurs
  // interdisent de demarrer du son avant une interaction de l'utilisateur
  // (clic, appui), et le creer trop tot declencherait une erreur inutile.
  let contexte = null;
  function obtenirContexte() {
    if (contexte) return contexte;
    const Constructeur = window.AudioContext || window.webkitAudioContext;
    if (!Constructeur) return null;
    contexte = new Constructeur();
    return contexte;
  }

  /**
   * Joue une seule note synthetisee.
   * @param {number} frequence      en Hz (les aigus sont plus percutants)
   * @param {number} duree          en secondes
   * @param {string} [forme]        'sine' (doux), 'triangle' ou 'square' (dur)
   * @param {number} [delai]        decalage de depart, en secondes
   * @param {number} [volume]       0 a 1
   */
  function note(ctx, frequence, duree, forme, delai, volume) {
    const oscillateur = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillateur.type = forme || 'sine';
    oscillateur.frequency.value = frequence;

    const debut = ctx.currentTime + (delai || 0);
    // Enveloppe de volume : montee quasi instantanee, puis descente douce.
    // Sans cette descente ("fade out"), chaque son se terminerait par un
    // desagreable petit "clic" audible.
    gain.gain.setValueAtTime(0, debut);
    gain.gain.linearRampToValueAtTime(volume || 0.2, debut + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, debut + duree);

    oscillateur.connect(gain);
    gain.connect(ctx.destination);
    oscillateur.start(debut);
    oscillateur.stop(debut + duree + 0.02);
  }

  const EFFETS = {
    // Un pas : un tout petit clic aigu, discret car tres frequent.
    pas: function (ctx) { note(ctx, 720, 0.05, 'sine', 0, 0.12); },

    // Mur heurte : un son grave et bref, qui evoque un "cognement".
    mur: function (ctx) {
      note(ctx, 160, 0.09, 'square', 0, 0.14);
      note(ctx, 110, 0.09, 'square', 0.01, 0.10);
    },

    // Indice : un petit carillon a deux notes montantes.
    indice: function (ctx) {
      note(ctx, 660, 0.12, 'triangle', 0, 0.16);
      note(ctx, 990, 0.16, 'triangle', 0.1, 0.16);
    },

    // Victoire : un court arpege ascendant, plus long et plus joyeux.
    victoire: function (ctx) {
      [523, 659, 784, 1047].forEach(function (frequence, i) {
        note(ctx, frequence, 0.22, 'triangle', i * 0.09, 0.18);
      });
    }
  };

  /** Joue un effet nomme ('pas', 'mur', 'indice' ou 'victoire'), sauf si coupe. */
  function jouer(nomEffet) {
    if (!actif) return;
    const effet = EFFETS[nomEffet];
    if (!effet) return;
    try {
      const ctx = obtenirContexte();
      if (!ctx) return;
      // Un navigateur peut suspendre le contexte audio (economie d'energie) :
      // on le relance au besoin avant de jouer le son.
      if (ctx.state === 'suspended') ctx.resume();
      effet(ctx);
    } catch (e) { /* son non supporte : sans importance pour le jeu */ }
  }

  function estActif() { return actif; }

  function activer(valeur) {
    actif = !!valeur;
    Stockage.ecrire(CLE_ACTIF, actif);
  }

  return { jouer: jouer, estActif: estActif, activer: activer };
})();

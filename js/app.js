/* ==========================================================================
   app.js - Le « chef d'orchestre » de l'application
   --------------------------------------------------------------------------
   Ce fichier ne contient AUCUNE regle de jeu. Son role est de :
     1. construire le menu d'accueil a partir des jeux inscrits dans window.Jeux
     2. afficher l'ecran de choix du theme et de la difficulte
     3. lancer / arreter le jeu choisi
     4. gerer la navigation (bouton retour, bouton « precedent » du telephone)
     5. installer le service worker qui rend l'application utilisable hors-ligne

   Il est charge EN DERNIER dans index.html : a ce moment-la, les quatre jeux
   se sont deja inscrits dans window.Jeux et le menu peut donc etre construit.
   ========================================================================== */

const App = (function () {
  'use strict';

  // Ordre d'affichage des jeux sur l'ecran d'accueil.
  const ORDRE_DES_JEUX = ['sudoku', 'mots-meles', 'demineur', 'memoire', 'labyrinthe'];

  /* --- Raccourcis vers les elements de la page --------------------------- */
  const ecrans = {
    accueil: document.getElementById('ecran-accueil'),
    niveaux: document.getElementById('ecran-niveaux'),
    jeu:     document.getElementById('ecran-jeu')
  };
  const listeJeux      = document.getElementById('liste-jeux');
  const titreNiveaux   = document.getElementById('titre-niveaux');
  const blocThemes     = document.getElementById('bloc-themes');
  const listeThemes    = document.getElementById('liste-themes');
  const listeNiveaux   = document.getElementById('liste-niveaux');
  const boutonReprendre = document.getElementById('bouton-reprendre');
  const zoneJeu        = document.getElementById('zone-jeu');
  const boutonRetour   = document.getElementById('bouton-retour');
  const titreAppli     = document.getElementById('titre-appli');
  const boutonInstaller = document.getElementById('bouton-installer');

  /* --- Etat de la navigation -------------------------------------------- */
  let ecranActuel = 'accueil';
  let jeuChoisi   = null;   // le jeu dont on regarde les niveaux
  let jeuActif    = null;   // le jeu reellement en train de tourner
  let themeChoisi = null;

  /* ======================================================================
     NAVIGATION ENTRE LES ECRANS
     ----------------------------------------------------------------------
     On utilise l'historique du navigateur (history.pushState) pour que le
     bouton « precedent » du telephone se comporte naturellement : il revient
     a l'ecran precedent au lieu de quitter l'application.
     ====================================================================== */

  function afficherEcran(nom) {
    // Si l'on quitte un jeu, on l'arrete proprement (chronometre, ecouteurs...).
    if (ecranActuel === 'jeu' && nom !== 'jeu' && jeuActif) {
      jeuActif.arreter();
      jeuActif = null;
      Outils.vider(zoneJeu);
      Stockage.supprimer('session');
    }

    Object.keys(ecrans).forEach(function (cle) {
      ecrans[cle].hidden = (cle !== nom);
    });
    ecranActuel = nom;

    boutonRetour.hidden = (nom === 'accueil');
    Outils.fermerModale();

    if (nom === 'accueil') {
      definirTitre('Jeux de Reflexion');
      construireAccueil();       // on redessine : les records ont pu changer
    } else if (nom === 'niveaux') {
      construireEcranNiveaux();
    }

    window.scrollTo(0, 0);
  }

  /** Va vers un nouvel ecran en ajoutant une etape dans l'historique. */
  function naviguer(nom) {
    afficherEcran(nom);
    history.pushState({ ecran: nom }, '');
  }

  /** Revient a l'ecran precedent (utilise aussi par les fenetres de victoire). */
  function retour() {
    if (history.state && history.state.ecran && history.state.ecran !== 'accueil') {
      history.back();
    } else {
      afficherEcran('accueil');
    }
  }

  // Le bouton « precedent » du navigateur ou du telephone declenche popstate.
  window.addEventListener('popstate', function (evenement) {
    const cible = (evenement.state && evenement.state.ecran) ? evenement.state.ecran : 'accueil';
    afficherEcran(cible);
  });

  boutonRetour.addEventListener('click', retour);

  function definirTitre(texte) {
    titreAppli.textContent = texte;
  }

  /* ======================================================================
     ECRAN D'ACCUEIL
     ====================================================================== */

  function construireAccueil() {
    Outils.vider(listeJeux);

    ORDRE_DES_JEUX.forEach(function (idJeu) {
      const jeu = window.Jeux[idJeu];
      if (!jeu) return;   // un fichier de jeu n'a pas pu etre charge

      const carte = Outils.creer('button', { classe: 'carte-jeu', attributs: { type: 'button' } });
      carte.appendChild(Outils.creer('span', { classe: 'icone-jeu', texte: jeu.emoji }));

      const textes = Outils.creer('span');
      textes.appendChild(Outils.creer('span', { classe: 'nom-jeu', texte: jeu.nom }));
      textes.appendChild(Outils.creer('span', { classe: 'desc-jeu', texte: jeu.description }));
      carte.appendChild(textes);

      carte.addEventListener('click', function () {
        jeuChoisi = jeu;
        naviguer('niveaux');
      });

      listeJeux.appendChild(carte);
    });
  }

  /* ======================================================================
     ECRAN DES THEMES ET NIVEAUX
     ====================================================================== */

  function construireEcranNiveaux() {
    if (!jeuChoisi) { afficherEcran('accueil'); return; }

    definirTitre(jeuChoisi.nom);
    titreNiveaux.textContent = jeuChoisi.nom;

    /* --- Themes (uniquement pour les jeux qui en ont) --- */
    if (jeuChoisi.themes && jeuChoisi.themes.length > 0) {
      blocThemes.hidden = false;
      // On se souvient du dernier theme choisi pour ce jeu.
      const memorise = Stockage.lire('theme.' + jeuChoisi.id, null);
      const existe = jeuChoisi.themes.some(function (t) { return t.id === memorise; });
      themeChoisi = existe ? memorise : jeuChoisi.themes[0].id;
      dessinerThemes();
    } else {
      blocThemes.hidden = true;
      themeChoisi = null;
    }

    dessinerNiveaux();
    dessinerBoutonReprendre();
  }

  function dessinerThemes() {
    Outils.vider(listeThemes);
    jeuChoisi.themes.forEach(function (theme) {
      const bouton = Outils.creer('button', {
        classe: 'bouton' + (theme.id === themeChoisi ? ' actif' : ''),
        texte: theme.nom,
        attributs: { type: 'button', role: 'radio', 'aria-checked': String(theme.id === themeChoisi) }
      });
      bouton.addEventListener('click', function () {
        themeChoisi = theme.id;
        Stockage.ecrire('theme.' + jeuChoisi.id, theme.id);
        dessinerThemes();
        dessinerNiveaux();     // les records dependent du theme : on les remet a jour
      });
      listeThemes.appendChild(bouton);
    });
  }

  function dessinerNiveaux() {
    Outils.vider(listeNiveaux);

    jeuChoisi.niveaux.forEach(function (niveau) {
      const carte = Outils.creer('button', { classe: 'carte-niveau', attributs: { type: 'button' } });

      const textes = Outils.creer('span');
      textes.appendChild(Outils.creer('span', { classe: 'nom-niveau', texte: niveau.nom }));
      if (niveau.detail) {
        textes.appendChild(Outils.creer('span', { classe: 'detail-niveau', texte: niveau.detail }));
      }
      carte.appendChild(textes);

      const record = jeuChoisi.texteRecord(niveau.id, themeChoisi);
      if (record) carte.appendChild(Outils.creer('span', { classe: 'record', texte: record }));

      carte.addEventListener('click', function () {
        demarrerJeu(jeuChoisi, niveau.id, false);
      });

      listeNiveaux.appendChild(carte);
    });
  }

  function dessinerBoutonReprendre() {
    const existe = jeuChoisi.sauvegardeExiste();
    boutonReprendre.hidden = !existe;
    if (!existe) return;

    boutonReprendre.textContent = 'Reprendre : ' + jeuChoisi.descriptionSauvegarde();
    // On affecte la propriete onclick au lieu d'utiliser addEventListener :
    // chaque affectation remplace la precedente, donc aucun ecouteur ne
    // s'accumule quand on revient plusieurs fois sur cet ecran.
    boutonReprendre.onclick = function () {
      demarrerJeu(jeuChoisi, null, true);
    };
  }

  /* ======================================================================
     LANCEMENT D'UN JEU
     ====================================================================== */

  function demarrerJeu(jeu, idNiveau, reprendre) {
    jeuChoisi = jeu;

    // IMPORTANT : on affiche l'ecran AVANT de construire le jeu.
    // Certains jeux (mots meles, demineur) mesurent la largeur disponible
    // pour calculer la taille des cases ; un element masque mesure 0 pixel.
    naviguer('jeu');

    Outils.vider(zoneJeu);
    jeuActif = jeu;

    // Memorise la partie en cours : au rechargement de la page, on y revient.
    Stockage.ecrire('session', { jeu: jeu.id, niveau: idNiveau, theme: themeChoisi });

    jeu.demarrer(zoneJeu, {
      niveau: idNiveau,
      theme: themeChoisi,
      reprendre: reprendre === true
    });
  }

  /* ======================================================================
     REPRISE AUTOMATIQUE AU RECHARGEMENT
     ====================================================================== */

  function reprendreSession() {
    const session = Stockage.lire('session', null);
    if (!session) return false;

    const jeu = window.Jeux[session.jeu];
    if (!jeu || !jeu.sauvegardeExiste()) {
      Stockage.supprimer('session');
      return false;
    }

    jeuChoisi = jeu;
    themeChoisi = session.theme || null;

    // On reconstitue l'historique accueil -> niveaux -> jeu pour que le bouton
    // « precedent » ramene bien au menu et non hors de l'application.
    history.replaceState({ ecran: 'accueil' }, '');
    history.pushState({ ecran: 'niveaux' }, '');
    demarrerJeu(jeu, session.niveau, true);
    return true;
  }

  /* ======================================================================
     SAUVEGARDE AVANT FERMETURE
     ----------------------------------------------------------------------
     Les jeux enregistrent deja apres chaque coup, mais le chronometre, lui,
     avance en continu. On force donc une sauvegarde quand l'application passe
     en arriere-plan ou se ferme, pour ne pas perdre les secondes ecoulees.
     ====================================================================== */

  function sauvegarderMaintenant() {
    if (jeuActif && typeof jeuActif.sauvegarder === 'function') jeuActif.sauvegarder();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sauvegarderMaintenant();
  });
  window.addEventListener('pagehide', sauvegarderMaintenant);

  /* ======================================================================
     SERVICE WORKER : LE COEUR DU FONCTIONNEMENT HORS-LIGNE
     ----------------------------------------------------------------------
     Le service worker est un petit script qui tourne en arriere-plan et qui
     intercepte toutes les requetes reseau de l'application pour y repondre
     avec les fichiers mis en cache. C'est lui qui permet de lancer les jeux
     sans aucune connexion.

     A SAVOIR : un service worker ne fonctionne QUE sur https:// ou sur
     http://localhost. Ouvrir index.html avec un double-clic (file://) fait
     fonctionner les jeux, mais pas l'installation ni le cache hors-ligne.
     ====================================================================== */

  function installerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    // Chemin relatif : l'application fonctionne aussi dans un sous-dossier
    // (par exemple https://mon-site.fr/jeux/).
    navigator.serviceWorker.register('./service-worker.js').then(function (enregistrement) {
      console.log('Service worker actif, portee :', enregistrement.scope);
    }).catch(function (erreur) {
      console.warn('Service worker non installe :', erreur);
    });
  }

  /* ======================================================================
     BOUTON D'INSTALLATION (ajouter a l'ecran d'accueil)
     ====================================================================== */

  let invitationInstallation = null;

  window.addEventListener('beforeinstallprompt', function (evenement) {
    // On empeche la banniere automatique du navigateur et on garde
    // l'evenement de cote pour l'afficher quand l'utilisateur le decide.
    evenement.preventDefault();
    invitationInstallation = evenement;
    boutonInstaller.hidden = false;
  });

  boutonInstaller.addEventListener('click', function () {
    if (!invitationInstallation) return;
    invitationInstallation.prompt();
    invitationInstallation.userChoice.then(function () {
      invitationInstallation = null;
      boutonInstaller.hidden = true;
    });
  });

  window.addEventListener('appinstalled', function () {
    boutonInstaller.hidden = true;
    Outils.info('Application installee. Elle fonctionne desormais hors-ligne.');
  });

  /* ======================================================================
     DEMARRAGE
     ====================================================================== */

  function demarrer() {
    history.replaceState({ ecran: 'accueil' }, '');
    afficherEcran('accueil');
    reprendreSession();      // saute directement dans la partie en cours, s'il y en a une
    installerServiceWorker();
  }

  // Fonctions rendues publiques : les jeux s'en servent pour changer le titre
  // de la barre du haut et pour revenir au menu depuis un ecran de victoire.
  return {
    definirTitre: definirTitre,
    retour: retour,
    demarrer: demarrer
  };
})();

/* --------------------------------------------------------------------------
   ATTENTION, POINT SUBTIL MAIS ESSENTIEL
   Le demarrage doit avoir lieu ICI, apres l'affectation de la constante App,
   et surtout PAS a l'interieur de la fonction ci-dessus.
   Pourquoi ? Parce que la reprise automatique lance immediatement un jeu, et
   que ce jeu appelle App.definirTitre(). Or, tant que la fonction anonyme
   n'a pas fini de s'executer, la constante App n'existe pas encore : on
   obtiendrait l'erreur « App is not defined ».
   -------------------------------------------------------------------------- */
App.demarrer();

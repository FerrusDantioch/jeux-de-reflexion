/* ==========================================================================
   stockage.js - Enregistrement local (localStorage)
   --------------------------------------------------------------------------
   localStorage est un petit espace de stockage fourni par le navigateur.
   Il conserve des CHAINES DE CARACTERES, meme apres fermeture de l'appli,
   et reste disponible hors-ligne. C'est exactement ce qu'il nous faut pour :
     - la partie en cours de chaque jeu ;
     - les meilleurs temps / meilleurs scores par niveau.

   POURQUOI ENCAPSULER localStorage DANS UN OBJET ?
   Parce que localStorage peut lever une erreur (navigation privee sur iOS,
   quota depasse, cookies bloques...). En centralisant les acces ici, on gere
   ces erreurs une seule fois : le reste de l'application n'a plus a s'en
   soucier et l'appli continue de fonctionner meme sans sauvegarde.
   ========================================================================== */

/* On utilise une IIFE (fonction immediatement appelee) pour creer un espace
   prive : tout ce qui est declare a l'interieur reste invisible de l'exterieur,
   sauf ce que l'on renvoie explicitement a la fin. */
const Stockage = (function () {

  // Prefixe applique a toutes nos cles : evite d'entrer en conflit avec une
  // autre application hebergee sur le meme domaine.
  const PREFIXE = 'jdr.'; // jdr = Jeux De Reflexion

  // On teste une seule fois, au demarrage, si localStorage est utilisable.
  const disponible = (function () {
    try {
      const test = PREFIXE + 'test';
      localStorage.setItem(test, '1');
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      console.warn('Stockage local indisponible : les scores ne seront pas conserves.', e);
      return false;
    }
  })();

  /**
   * Lit une valeur et la reconvertit depuis le JSON.
   * @param {string} cle
   * @param {*} valeurParDefaut  renvoyee si la cle n'existe pas ou est illisible
   */
  function lire(cle, valeurParDefaut) {
    if (!disponible) return valeurParDefaut;
    try {
      const brut = localStorage.getItem(PREFIXE + cle);
      if (brut === null) return valeurParDefaut;
      return JSON.parse(brut);
    } catch (e) {
      // Donnee corrompue (ancienne version de l'appli, par exemple) :
      // on la supprime pour ne pas rester bloque dessus.
      supprimer(cle);
      return valeurParDefaut;
    }
  }

  /**
   * Enregistre une valeur (objet, tableau, nombre...) au format JSON.
   * @returns {boolean} true si l'ecriture a reussi
   */
  function ecrire(cle, valeur) {
    if (!disponible) return false;
    try {
      localStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
      return true;
    } catch (e) {
      console.warn('Impossible d\'enregistrer ' + cle, e);
      return false;
    }
  }

  function supprimer(cle) {
    if (!disponible) return;
    try {
      localStorage.removeItem(PREFIXE + cle);
    } catch (e) { /* sans importance */ }
  }

  /** Efface toutes les donnees de l'application (parties + records). */
  function toutEffacer() {
    if (!disponible) return;
    // On copie d'abord la liste des cles : supprimer pendant la boucle
    // decalerait les index et ferait sauter des elements.
    const cles = [];
    for (let i = 0; i < localStorage.length; i++) {
      const cle = localStorage.key(i);
      if (cle && cle.indexOf(PREFIXE) === 0) cles.push(cle);
    }
    cles.forEach(function (cle) { localStorage.removeItem(cle); });
  }

  return { lire: lire, ecrire: ecrire, supprimer: supprimer, toutEffacer: toutEffacer, disponible: disponible };
})();


/* ==========================================================================
   Records - meilleurs temps et meilleurs scores
   --------------------------------------------------------------------------
   Une « variante » identifie precisement une configuration de partie :
     sudoku + facile           -> "facile"
     mots-meles + animaux/moyen-> "animaux|moyen"
   Chaque jeu construit sa propre chaine de variante ; ici on se contente de
   la ranger dans un objet { variante: valeur } enregistre sous une seule cle.
   ========================================================================== */
const Records = (function () {

  function cleJeu(jeu, type) {
    return 'records.' + jeu + '.' + type; // ex : records.sudoku.temps
  }

  /**
   * Renvoie le meilleur resultat connu, ou null si aucun.
   * @param {string} jeu       identifiant du jeu ("sudoku", "demineur"...)
   * @param {string} type      "temps" (en millisecondes) ou "coups"
   * @param {string} variante  niveau, ou "theme|niveau"
   */
  function meilleur(jeu, type, variante) {
    const tous = Stockage.lire(cleJeu(jeu, type), {});
    const valeur = tous[variante];
    return typeof valeur === 'number' ? valeur : null;
  }

  /**
   * Enregistre un resultat s'il est meilleur que le precedent.
   * Pour le temps comme pour le nombre de coups, « meilleur » = « plus petit ».
   * @returns {boolean} true si c'est un nouveau record
   */
  function enregistrer(jeu, type, variante, valeur) {
    const cle = cleJeu(jeu, type);
    const tous = Stockage.lire(cle, {});
    const ancien = tous[variante];
    if (typeof ancien === 'number' && ancien <= valeur) return false;
    tous[variante] = valeur;
    Stockage.ecrire(cle, tous);
    return true;
  }

  return { meilleur: meilleur, enregistrer: enregistrer };
})();


/* ==========================================================================
   Parties - sauvegarde automatique de la partie en cours
   --------------------------------------------------------------------------
   Un seul emplacement de sauvegarde par jeu : recommencer une partie ecrase
   la precedente, ce qui correspond au comportement attendu par le joueur.
   ========================================================================== */
const Parties = (function () {

  function cle(jeu) { return 'partie.' + jeu; }

  /** @param {object} donnees etat complet de la partie (propre a chaque jeu) */
  function sauvegarder(jeu, donnees) {
    Stockage.ecrire(cle(jeu), donnees);
  }

  /** @returns {object|null} */
  function charger(jeu) {
    return Stockage.lire(cle(jeu), null);
  }

  function effacer(jeu) {
    Stockage.supprimer(cle(jeu));
  }

  function existe(jeu) {
    return charger(jeu) !== null;
  }

  return { sauvegarder: sauvegarder, charger: charger, effacer: effacer, existe: existe };
})();

/* ==========================================================================
   serveur-local.js - Petit serveur pour tester la PWA sur votre ordinateur
   --------------------------------------------------------------------------
   POURQUOI CE FICHIER ?
     Les jeux fonctionnent en ouvrant simplement index.html dans un
     navigateur. En revanche, deux fonctionnalites de la PWA sont bloquees
     par les navigateurs sur une adresse « file:// » :
        - le service worker (donc le vrai mode hors-ligne) ;
        - le bouton « Installer l'application ».
     Les navigateurs n'autorisent ces fonctions que sur « https:// » ou sur
     « http://localhost ». Ce fichier fournit ce localhost, sans installer
     la moindre bibliotheque.

   COMMENT S'EN SERVIR ?
     1. Installer Node.js (https://nodejs.org) si ce n'est pas deja fait.
     2. Ouvrir un terminal dans ce dossier.
     3. Taper :  node serveur-local.js
     4. Ouvrir http://localhost:5177 dans le navigateur.

     Ce fichier ne sert QU'AU TEST : il n'est pas necessaire une fois
     l'application hebergee sur un vrai site en https.
   ========================================================================== */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5177;
// __dirname est le dossier ou se trouve ce fichier : le serveur fonctionne
// donc quel que soit l'endroit d'ou on le lance.
const RACINE = __dirname;

// Le navigateur a besoin de connaitre le type de chaque fichier envoye.
const TYPES_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.txt':  'text/plain; charset=utf-8'
};

const serveur = http.createServer(function (requete, reponse) {
  // On enleve l'eventuelle partie « ?quelque-chose » de l'adresse.
  let adresse = decodeURIComponent(requete.url.split('?')[0]);
  if (adresse === '/') adresse = '/index.html';

  const fichier = path.join(RACINE, adresse);

  // Securite elementaire : interdire de sortir du dossier de l'application
  // avec une adresse du genre « /../../mes-documents ».
  if (!fichier.startsWith(RACINE)) {
    reponse.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    reponse.end('Acces interdit');
    return;
  }

  fs.readFile(fichier, function (erreur, contenu) {
    if (erreur) {
      reponse.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      reponse.end('Fichier introuvable : ' + adresse);
      return;
    }
    const extension = path.extname(fichier).toLowerCase();
    reponse.writeHead(200, {
      'Content-Type': TYPES_MIME[extension] || 'application/octet-stream',
      // Pendant le developpement, on evite que le navigateur garde
      // d'anciennes versions des fichiers en memoire.
      'Cache-Control': 'no-cache'
    });
    reponse.end(contenu);
  });
});

serveur.listen(PORT, function () {
  console.log('Jeux de Reflexion : http://localhost:' + PORT);
  console.log('(Ctrl+C pour arreter le serveur)');
});

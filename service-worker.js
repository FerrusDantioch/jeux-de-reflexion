/* ==========================================================================
   service-worker.js - Le fonctionnement hors-ligne
   --------------------------------------------------------------------------
   QU'EST-CE QU'UN SERVICE WORKER ?
     C'est un script qui tourne EN DEHORS de la page web, en arriere-plan,
     et qui se place entre l'application et le reseau. Il peut intercepter
     chaque requete (fichier CSS, image, script...) et decider d'y repondre
     lui-meme avec une copie mise en cache, sans passer par internet.

   CYCLE DE VIE (les trois evenements ci-dessous)
     install  : declenche une seule fois, a la premiere visite. On en profite
                pour telecharger et ranger TOUS les fichiers de l'application.
     activate : declenche quand cette version prend le relais. On supprime les
                caches des versions precedentes pour ne pas encombrer l'appareil.
     fetch    : declenche a CHAQUE requete. C'est ici qu'on repond depuis le
                cache, ce qui rend l'application utilisable sans connexion.

   METTRE A JOUR L'APPLICATION
     Il suffit de changer le numero de VERSION ci-dessous. Le navigateur
     detectera un service worker different, reinstallera tous les fichiers et
     supprimera l'ancien cache. Sans ce changement de version, les visiteurs
     continueraient a voir l'ancienne version indefiniment.

   IMPORTANT
     Un service worker ne fonctionne que via https:// ou http://localhost.
     C'est une regle de securite des navigateurs, pas une limite de ce code.
   ========================================================================== */

const VERSION = 'jeux-reflexion-v1';
const NOM_DU_CACHE = VERSION;

/* Liste EXHAUSTIVE des fichiers necessaires au fonctionnement hors-ligne.
   Si un fichier manque ici, l'application plantera des la premiere ouverture
   sans reseau : il faut donc penser a completer cette liste a chaque ajout. */
const FICHIERS_A_METTRE_EN_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './css/jeux.css',
  './js/stockage.js',
  './js/outils.js',
  './js/sudoku.js',
  './js/mots-meles.js',
  './js/demineur.js',
  './js/memoire.js',
  './js/app.js',
  './icones/favicon.png',
  './icones/icone-180.png',
  './icones/icone-192.png',
  './icones/icone-512.png',
  './icones/icone-maskable-512.png'
];

/* --------------------------------------------------------------------------
   INSTALLATION : on remplit le cache
   -------------------------------------------------------------------------- */
self.addEventListener('install', function (evenement) {
  // waitUntil dit au navigateur : « ne considere pas l'installation terminee
  // tant que cette promesse n'est pas resolue ».
  evenement.waitUntil(
    caches.open(NOM_DU_CACHE)
      .then(function (cache) {
        // addAll echoue en bloc si UN SEUL fichier est introuvable : c'est
        // voulu, cela evite une installation a moitie faite.
        return cache.addAll(FICHIERS_A_METTRE_EN_CACHE);
      })
      .then(function () {
        // Prend la main immediatement au lieu d'attendre la fermeture des
        // onglets ouverts : la mise a jour est ainsi appliquee tout de suite.
        return self.skipWaiting();
      })
  );
});

/* --------------------------------------------------------------------------
   ACTIVATION : on fait le menage des anciennes versions
   -------------------------------------------------------------------------- */
self.addEventListener('activate', function (evenement) {
  evenement.waitUntil(
    caches.keys()
      .then(function (noms) {
        return Promise.all(
          noms.map(function (nom) {
            if (nom !== NOM_DU_CACHE) return caches.delete(nom);
            return null;
          })
        );
      })
      .then(function () {
        // Prend le controle des pages deja ouvertes sans attendre un rechargement.
        return self.clients.claim();
      })
  );
});

/* --------------------------------------------------------------------------
   INTERCEPTION DES REQUETES
   --------------------------------------------------------------------------
   Strategie choisie : « cache d'abord » (cache first).
     1. Le fichier est-il dans le cache ? -> on le renvoie immediatement.
     2. Sinon on va le chercher sur le reseau, et on en garde une copie.
   C'est la strategie ideale pour une application dont les fichiers ne
   changent que lors des mises a jour : elle est instantanee et fonctionne
   evidemment sans connexion.
   -------------------------------------------------------------------------- */
self.addEventListener('fetch', function (evenement) {
  const requete = evenement.request;

  // On ne s'occupe que des lectures (GET). Rien d'autre n'existe ici, mais
  // c'est une precaution standard.
  if (requete.method !== 'GET') return;

  // On ignore les requetes vers d'autres domaines (il n'y en a aucune dans
  // cette application, mais autant etre explicite).
  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;

  evenement.respondWith(
    caches.match(requete).then(function (reponseEnCache) {
      if (reponseEnCache) return reponseEnCache;

      return fetch(requete)
        .then(function (reponseReseau) {
          // On ne met en cache que les reponses valides.
          if (!reponseReseau || reponseReseau.status !== 200 || reponseReseau.type !== 'basic') {
            return reponseReseau;
          }
          // Une reponse ne peut etre lue qu'une seule fois : on la clone,
          // une copie pour le cache et une copie pour la page.
          const copie = reponseReseau.clone();
          caches.open(NOM_DU_CACHE).then(function (cache) {
            cache.put(requete, copie);
          });
          return reponseReseau;
        })
        .catch(function () {
          // Hors-ligne et fichier absent du cache. Si l'utilisateur demandait
          // une page, on lui renvoie la page principale de l'application.
          if (requete.mode === 'navigate') {
            return caches.match('./index.html');
          }
          // Sinon, on laisse l'erreur remonter (une image manquante, par ex.).
          return Response.error();
        });
    })
  );
});

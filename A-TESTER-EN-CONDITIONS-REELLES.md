# À tester en conditions réelles (Labyrinthe)

Tout ce qui suit a été vérifié automatiquement (tests du moteur : voir
`ARCHITECTURE.md`) ou par un navigateur piloté en local, mais **pas sur un
vrai téléphone ni un vrai ordinateur**. À vérifier vous-même avant de
considérer le jeu terminé.

## Sur téléphone (tactile)

- [ ] **Glissement (swipe)** : un coup de doigt rapide dans une direction
      fait avancer le joueur d'une case.
- [ ] **Glissement continu** : maintenir le doigt posé et le déplacer
      lentement fait avancer le joueur case par case, sans avoir à relever
      le doigt entre chaque case.
- [ ] **Pas de défilement/zoom accidentel** de la page pendant qu'on joue
      (le doigt glisse sur le labyrinthe, pas sur la page entière).
- [ ] **Manette à l'écran** (à activer dans les réglages de l'écran de
      configuration) : les 4 boutons fonctionnent au doigt, y compris en
      appui maintenu (répétition automatique).
- [ ] **Bouton Aperçu global** (icône carte, en haut à droite du jeu, absent
      en Expert) : affiche tout le labyrinthe en réduit, se ferme au
      toucher.
- [ ] **Rotation de l'écran** (portrait ↔ paysage) en cours de partie : le
      labyrinthe se redimensionne sans être coupé et sans faire apparaître
      de défilement de la page.
- [ ] **Vibration** : une petite vibration au moment de heurter un mur, une
      autre (plus longue) à la victoire — et plus aucune vibration si le
      réglage « Vibrations » est désactivé.
- [ ] **Boutons assez grands** pour être touchés sans viser précisément
      (Pause, Indice, Nouveau labyrinthe, Menu, cartes de configuration).

## Sur ordinateur (clavier/souris)

- [ ] **Flèches directionnelles** ET **Z/Q/S/D** (clavier AZERTY français)
      font toutes deux avancer le joueur dans la bonne direction.
- [ ] **Échap** et **P** mettent en pause / affichent la fenêtre de pause.
- [ ] **H** déclenche l'indice (si des indices restent disponibles pour la
      difficulté choisie).
- [ ] **Maintenir une touche** enfoncée fait avancer le joueur en continu
      (répétition automatique du système d'exploitation).
- [ ] La page reste **utilisable uniquement au clavier** (les boutons
      restent atteignables et visibles au focus).

## Grandes grilles (taille Immense, 40x40)

- [ ] Sur petit écran, le **mode caméra** se déclenche bien (la vue suit le
      joueur au lieu d'essayer d'afficher toute la grille en minuscule).
- [ ] La génération reste rapide (pas d'attente perceptible en lançant une
      partie).

## Brouillard (difficulté Expert)

- [ ] Seule une zone autour du joueur est visible, avec un dégradé doux
      (pas de bord dur et carré).
- [ ] Les cellules déjà visitées restent **faiblement visibles** même après
      s'en être éloigné (elles ne redeviennent pas totalement noires).
- [ ] Le bouton **Aperçu global** est bien absent en Expert (il court-
      circuiterait le principe du brouillard).

## Reprise de partie

- [ ] Fermer l'application (ou l'onglet) en pleine partie, puis la rouvrir :
      le bouton « Reprendre » apparaît sur l'écran de configuration du jeu
      et restaure exactement la position, le temps, les pas et les indices
      utilisés.

## Hors-ligne (après installation de la PWA)

- [ ] Après une première visite en ligne (pour que le service worker
      installe le cache), couper complètement la connexion : le Labyrinthe
      se lance et se joue normalement, y compris pour démarrer un labyrinthe
      Immense.
- [ ] Le bouton « Installer » de l'application fonctionne toujours pour les
      4 autres jeux (aucune régression).

## Son

- [ ] 4 sons distincts et brefs : un pas, un heurt de mur, un indice, une
      victoire.
- [ ] Le réglage « Son » (dans l'écran de configuration du Labyrinthe) est
      un réglage **global** à toute l'application : le couper coupe aussi
      les futurs sons des autres jeux, s'ils en ajoutent un jour.

## Partage d'un labyrinthe

- [ ] Le bouton « Copier le code » (écran de victoire) copie bien un texte
      utilisable : le recopier dans le champ « Code du labyrinthe » de
      l'écran de configuration reproduit EXACTEMENT le même labyrinthe
      (mêmes murs, même départ, même arrivée).

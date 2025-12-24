# 🎵 Récapitulatif : Correction du Système de Playlist Collaborative

**Date :** 24 Décembre 2025  
**Sujet :** Transition d'une génération locale (Hôte uniquement) vers un système de "Pot Commun" (Track Pool).

---

## 1. Le Problème Identifié

**Symptôme :**  
Lors d'une partie, seules les musiques de l'Hôte étaient jouées. Les invités rejoignaient le salon, mais leurs goûts musicaux n'étaient jamais pris en compte dans la playlist finale.

**Cause Technique :**  
L'architecture initiale générait la playlist au moment du clic sur "Lancer la partie", en utilisant la fonction `MusicService.fetchTracksByCategory`. Cette fonction utilisait **uniquement le token Spotify de l'appareil qui lançait l'appel** (donc l'Hôte).

**Flux défaillant (Avant) :**
1. Hôte crée la partie.
2. Invité rejoint (rien ne se passe musicalement).
3. Hôte clique "Start" → `fetchTracks(HostToken)` → Playlist 100% Hôte.

---

## 2. La Solution : Architecture "Pot Commun" (Track Pool)

Nous avons mis en place une architecture distribuée où chaque appareil est responsable de récupérer ses propres musiques et de les verser dans un réservoir commun sur Firestore.

**Nouveau Flux (Après) :**
1. **Hôte** crée la partie → Envoie ses 20 musiques dans le `trackPool` (Firestore).
2. **Invité** rejoint → Détecte la catégorie → Envoie ses 20 musiques dans le même `trackPool`.
3. **Hôte** change de catégorie (ex: "Années 80") → Le `trackPool` est vidé → Tout le monde renvoie automatiquement des musiques "Années 80".
4. **Hôte** clique "Start" → Le jeu pioche aléatoirement dans le `trackPool` rempli par TOUS les joueurs pour créer la playlist finale.

---

## 3. Implémentation Technique

Voici les modifications clés apportées au code pour supporter cette logique.

### A. Context de Jeu (`contexts/GameContext.tsx`)

Nous avons ajouté des mécanismes pour gérer le pool et synchroniser la catégorie.

1.  **`setGameCategory(category)`** :
    *   Permet à l'hôte de changer la catégorie pour tout le monde.
    *   **Action critique :** Réinitialise le `trackPool` (`[]`) et le statut `setup.tracksPrepared` (`false`) pour forcer un rechargement des musiques.

2.  **`addToTrackPool(tracks)`** :
    *   Permet à n'importe quel joueur d'ajouter des morceaux au tableau `trackPool` dans Firestore.

### B. Écran du Lobby (`screens/LobbyScreen.tsx`)

C'est ici que réside "l'intelligence" de la contribution.

1.  **Synchronisation (Invités) :**
    *   Un `useEffect` écoute `gameState.category`. Si l'hôte change la catégorie, la sélection locale de l'invité se met à jour automatiquement.

2.  **Contribution Automatique (`shareUserTracks`) :**
    *   Un `useEffect` se déclenche quand la catégorie change ou qu'un joueur rejoint.
    *   **Logique :**
        *   Vérifie si le joueur a déjà contribué au pool actuel (pour éviter les doublons).
        *   Appelle `MusicService.fetchTracksByCategory` avec le **Token local** du joueur.
        *   Tague chaque track avec l'ID du joueur (`correctPlayer: firebaseUser.uid`).
        *   Envoie les tracks via `addToTrackPool`.

3.  **Lancement de la partie (`handleStartGame`) :**
    *   **Avant :** Appelait `fetchTracks` (API Spotify).
    *   **Maintenant :** Utilise directement `trackPool` (Données Firestore déjà chargées par tous les joueurs).
    *   Appelle `MusicService.generateVerifiedPlaylist(trackPool)` pour sélectionner et valider les extraits audio finaux.

---

## 4. Vérification et Tests

Pour confirmer que le système fonctionne :

1.  **Créer une partie (Hôte) :**
    *   Ouvrir les logs.
    *   Vérifier le message : `🎵 [Hôte] Préparation de la musique (TOP_RECENT)...`
    *   Vérifier Firestore : Le document de jeu doit avoir un champ `trackPool` avec ~20 éléments.

2.  **Rejoindre (Invité) :**
    *   L'invité entre le code.
    *   Vérifier les logs Invité : `🎵 [Invité] Préparation de la musique...`
    *   Vérifier Firestore : Le `trackPool` doit passer à ~40 éléments.

3.  **Changer de Catégorie (Hôte) :**
    *   Passer de "Top Récent" à "Années 80".
    *   Vérifier : Le `trackPool` se vide brièvement, puis se remplit à nouveau avec des titres des années 80 venant des deux appareils.

4.  **Lancer la partie :**
    *   Au Round 1, regarder le titre joué.
    *   Au Round 2, regarder le titre joué.
    *   La source doit varier (parfois track de l'Hôte, parfois track de l'Invité).

---

## 5. Prochaines Étapes (Améliorations UX)

*   **Indicateur visuel :** Ajouter une petite icône ou un compteur à côté de chaque joueur dans le Lobby pour montrer qu'il a fini d'envoyer ses musiques (ex: "Jules ✅", "Marie ⏳").
*   **Mode "Équitable" :** Modifier `generateVerifiedPlaylist` pour forcer une distribution exacte (ex: 5 tracks de l'hôte, 5 tracks de l'invité) plutôt que purement aléatoire.

Ce correctif assure maintenant une expérience véritablement multijoueur et collaborative ! 🚀

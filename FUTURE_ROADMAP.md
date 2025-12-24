# 🗺️ Roadmap & Todo List - Spotify App v2.0

Cette liste recense les prochaines étapes logiques pour transformer le prototype actuel en une application de production robuste et engageante.

## 🛡️ 1. Sécurité & Robustesse (Priorité Haute)
- [ ] **Firestore Rules (Anti-Triche) :**
    - Actuellement, les règles sont permissives.
    - *Objectif :* Empêcher un joueur d'écrire dans `currentTrack` (pour voir la réponse) ou de modifier le score d'un autre joueur.
- [ ] **Nettoyage Automatique (Cloud Functions) :**
    - Les parties abandonnées restent dans Firestore.
    - *Objectif :* Créer un script (CRON) qui supprime les parties vieilles de > 24h pour économiser la base de données.
- [ ] **Gestion des Erreurs Réseau (Mode Avion) :**
    - Tester ce qui se passe si on coupe le net en plein milieu d'une manche.
    - *Objectif :* Afficher une bannière "Connexion perdue" et mettre le jeu en pause locale.

## 🎮 2. Gameplay & Engagement
- [ ] **Mode "Speed" (Points Variables) :**
    - Actuellement, le score dépend du temps restant.
    - *Idée :* Ajouter un bonus "Premier !" pour le joueur qui clique le plus vite (+100 pts).
- [ ] **Effets Sonores (SFX) :**
    - Ajouter des sons pour : Compte à rebours final (Tic-tac), Bonne réponse (Ding!), Mauvaise réponse (Buzz), Victoire (Fanfare).
    - *Note :* Utiliser `SoundManager` pour charger ces petits sons.
- [ ] **Intégration "J'aime" :**
    - Ajouter un bouton ❤️ sur l'écran de résultat (`RevealScreen`) pour ajouter directement la musique découverte à sa bibliothèque Spotify/Deezer.

## 🎨 3. UI/UX & Polish
- [ ] **Avatars Personnalisés :**
    - Permettre l'upload d'une photo depuis la galerie du téléphone (via `expo-image-picker`) au lieu de juste l'image Spotify.
- [ ] **Transitions Animées :**
    - Utiliser `react-native-reanimated` pour faire glisser les cartes des joueurs lors des changements de classement (au lieu qu'elles sautent).
- [ ] **Skeleton Loaders :**
    - Remplacer les `ActivityIndicator` (roues qui tournent) par des "Squelettes" gris qui scintillent (comme sur Facebook/YouTube) pendant le chargement.

## 🔧 4. Dette Technique (Code Quality)
- [ ] **Chasse aux `any` :**
    - Il reste des types `any` dans `GameScreen.tsx` et `utils`.
    - *Action :* Typer strictement toutes les réponses API.
- [ ] **Tests Unitaires (Jest) :**
    - Écrire des tests pour `MusicService.ts` (vérifier que le filtrage fonctionne) et `calculator.ts` (logique de score).
- [ ] **Refactoring CSS :**
    - Centraliser toutes les couleurs, tailles de police et espacements dans un `theme.ts` pour gérer facilement un futur "Light Mode" ou des thèmes saisonniers.

## 🚀 5. Fonctionnalités "Whaou" (Long terme)
- [ ] **Mode "Paroles" :**
    - Utiliser une API de lyrics pour afficher les paroles trouées au lieu de jouer l'audio.
- [ ] **Partage Instagram :**
    - Générer une image du Podium final pour la partager en Story.

---
**Généré le :** 23 Décembre 2025
**Statut :** À planifier

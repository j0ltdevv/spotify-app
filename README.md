# 🎵 Who Listening

**Who Listening** est un jeu multijoueur de quiz musical où tes amis doivent deviner quelles musiques **tu** écoutes vraiment. Connecte ton compte Spotify, choisis une catégorie (Top Récent, Guilty Pleasures, Vieux Favoris…), et laisse tes amis découvrir tes vrais goûts musicaux — parfois embarrassants. 😄

---

## ✨ Fonctionnalités

- 🎧 **Connexion Spotify OAuth** : authentification sécurisée avec ton compte Spotify
- 🎮 **Plusieurs catégories de jeu** :
  - 🔥 **Top Récent** — tes morceaux du moment
  - 😳 **Guilty Pleasures** — tes plaisirs coupables musicaux
  - ⏰ **Vieux Favoris** — les hits que tu n'écoutes plus
  - 🎬 **Bandes Originales** — musiques de films et séries
  - 🎤 **Focus Artiste** — devine ton artiste préféré
- ⏱️ **Système de score** : gagne des points selon ta rapidité
- 🗳️ **Système de vote** : grille interactive pour sélectionner le « propriétaire » du morceau
- 🤖 **Bots** : ajoute des bots pour jouer même à moins de joueurs
- ⏰ **Timer robuste** : calcul du temps basé sur `Date.now()` pour éviter les désynchronisations
- 🎨 **Design moderne** : interface inspirée de Spotify, style glassmorphism avec animations fluides
- 📱 **Feedback haptique** : vibrations pour une meilleure expérience
- 💾 **Sauvegarde automatique** : reprends ta partie où tu l'as laissée
- ❤️ **Ajoute aux favoris** : ajoute directement les morceaux à ta bibliothèque Spotify
- 🌍 **Multilingue** : français (par défaut) et anglais
- 🔔 **Notifications push** : invitations de jeu (via Expo Push)

---

## 🛠️ Stack technique

| Domaine | Technologies |
|---|---|
| **Mobile** | React Native, Expo SDK 54, TypeScript |
| **Navigation** | React Navigation (native-stack) |
| **Authentification** | Spotify OAuth (expo-auth-session), Firebase Auth |
| **Realtime** | Firebase Firestore (sync des parties), WebSocket (backend) |
| **Audio** | Expo AV (extraits 30 s), iTunes Search API (secours) |
| **Animations** | React Native Animated API, Lottie |
| **Stockage** | AsyncStorage (réglages & tokens) |
| **Backend (exemple)** | Node.js, Express, Socket.IO, MongoDB, Redis, JWT |

---

## 📂 Structure du projet

```
who-listening/
├── App.tsx                  # Point d'entrée principal
├── app.json                 # Configuration Expo
├── config.ts                # Configuration Spotify / Deezer (client ID via @env)
├── constants.ts             # Constantes (couleurs, config jeu, catégories…)
├── types.ts                 # Types TypeScript partagés
├── contexts/
│   ├── AuthContext.tsx      # Gestion authentification Spotify
│   ├── GameContext.tsx      # Gestion état du jeu
│   ├── SettingsContext.tsx  # Réglages utilisateur
│   └── ToastContext.tsx     # Notifications in-app
├── screens/
│   ├── WelcomeScreen.tsx    # Connexion / choix de langue
│   ├── MenuScreen.tsx       # Menu principal
│   ├── LobbyScreen.tsx      # Création / rejoindre une partie
│   ├── GameScreen.tsx       # Écran de jeu principal
│   ├── RevealScreen.tsx     # Révélation du morceau
│   ├── GameOverScreen.tsx   # Podium final
│   ├── SettingsScreen.tsx   # Réglages
│   └── LegalScreen.tsx      # Mentions légales
├── components/              # Composants réutilisables (GlassCard, CircularTimer, Confetti…)
├── services/
│   ├── MusicService.ts      # Appels API Spotify
│   ├── UserService.ts       # Profil utilisateur
│   ├── FirebaseService.ts   # Interaction Firestore / Auth
│   └── SocketService.ts     # Client WebSocket
├── utils/                   # Helpers (spotifyHelper, spotifyRefresh, soundManager…)
├── assets/                  # Images, logos
├── firestore.rules          # Règles de sécurité Firestore
└── backend-example/         # Backend de référence (Express + Socket.IO + JWT)
```

---

## 🚀 Démarrage local

### Prérequis

- Node.js (v18 ou supérieur)
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`) ou l'application **Expo Go** sur ton téléphone
- Un compte développeur [Spotify](https://developer.spotify.com/dashboard)

### Étapes

1. **Clone le projet**
   ```bash
   git clone https://github.com/j0ltdevv/spotify-app.git
   cd spotify-app
   ```

2. **Installe les dépendances**
   ```bash
   npm install
   ```

3. **Configure ton application Spotify**
   - Va sur le [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Crée une nouvelle application
   - Ajoute `trackroulette://` dans les **Redirect URIs**
   - Note ton **Client ID** (et ton **Client Secret** si tu utilises le backend)

4. **Configure les variables d'environnement** (voir section suivante) — notamment `SPOTIFY_CLIENT_ID` dans un fichier `.env` à la racine.

5. **Lance l'application**
   ```bash
   npm start
   # ou
   expo start
   ```

6. **Scanne le QR code** avec Expo Go sur ton téléphone

---

## 🔐 Variables d'environnement

Le projet utilise les variables suivantes via `@env` (fichier `.env` à la racine, non versionné). **Ne commite jamais de vraies valeurs.**

| Variable | Description |
|---|---|
| `SPOTIFY_CLIENT_ID` | Client ID de ton application Spotify |
| `FIREBASE_API_KEY` | Clé API Firebase |
| `FIREBASE_AUTH_DOMAIN` | Domaine d'authentification Firebase |
| `FIREBASE_DATABASE_URL` | URL de la base Firestore |
| `FIREBASE_PROJECT_ID` | ID du projet Firebase |
| `FIREBASE_STORAGE_BUCKET` | Bucket de stockage Firebase |
| `FIREBASE_MESSAGING_SENDER_ID` | Sender ID Firebase Cloud Messaging |
| `FIREBASE_APP_ID` | App ID Firebase |
| `FIREBASE_MEASUREMENT_ID` | ID de mesure Firebase Analytics |

Le dossier `backend-example/` dispose de son propre `.env.example` (JWT_SECRET, MONGODB_URI, REDIS_URL, SPOTIFY_CLIENT_SECRET…) pour démarrer le backend de référence.

---

## 🎮 Comment jouer

1. **Connexion** : connecte-toi avec ton compte Spotify
2. **Lobby** : crée une partie (code à 4 chiffres) ou rejoins-en une
3. **Jeu** :
   - Un extrait audio de 30 secondes est joué
   - Les joueurs doivent deviner **qui** écoute ce morceau
   - Plus tu réponds vite, plus tu gagnes de points !
4. **Révélation** : découvre le morceau et l'artiste
5. **Résultats** : podium final en 3D après 5 à 10 manches

---

## ⚙️ Configuration avancée

- **Nombre de manches** : modifie `GAME_CONFIG.MAX_ROUNDS` dans `constants.ts`
- **Catégories personnalisées** : ajoute une entrée dans `CATEGORIES` (`constants.ts`), puis implémente la logique dans `GameScreen.tsx` (fonction `startRound`)

---

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésite pas à :

- Reporter des bugs via les issues GitHub
- Proposer de nouvelles fonctionnalités
- Améliorer la documentation

---

## 📄 Licence

Ce projet est sous licence **MIT** — voir le fichier [LICENSE](LICENSE).

---

## 🙏 Remerciements

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)
- [Expo](https://expo.dev/)
- La communauté React Native

---

**Prêt à découvrir les vrais goûts musicaux de tes amis ? 🎵**

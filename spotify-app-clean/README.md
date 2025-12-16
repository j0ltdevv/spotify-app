# 🎵 Track Roulette

**Le blind test social ultime avec Spotify !**

Track Roulette est un jeu multijoueur où tes amis doivent deviner quelles musiques **tu** écoutes. Connecte ton compte Spotify, choisis une catégorie (Top Récent, Guilty Pleasures, Vieux Favoris...), et laisse tes amis découvrir tes vrais goûts musicaux ! 📂

---

## ✨ Fonctionnalités

- 🎧 **Connexion Spotify OAuth** : Authentification sécurisée avec ton compte Spotify
- 🎮 **Plusieurs catégories de jeu** :
  - 🔥 **Top Récent** : Tes morceaux du moment
  - 😳 **Guilty Pleasures** : Tes plaisirs coupables musicaux
  - ⏰ **Vieux Favoris** : Les hits que tu n'écoutes plus
  - 🎬 **Bandes Originales** : Musiques de films et séries
  - 🎤 **Focus Artiste** : Devine ton artiste préféré
- ⏱️ **Système de score** : Gagne des points en fonction de ta rapidité
- 🎨 **Design moderne** : Interface inspirée de Spotify avec animations fluides
- 📱 **Feedback haptique** : Vibrations pour une meilleure expérience
- 💾 **Sauvegarde automatique** : Reprends ta partie où tu l'as laissée
- ❤️ **Ajoute aux favoris** : Ajoute directement les morceaux à ta bibliothèque Spotify

---

## 🚀 Installation

### Prérequis

- Node.js (v14 ou supérieur)
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Un compte Spotify (gratuit ou premium)
- Application Expo Go sur ton téléphone (iOS ou Android)

### Étapes

1. **Clone le projet**
```bash
git clone <url-du-repo>
cd track-roulette
```

2. **Installe les dépendances**
```bash
npm install
# ou
yarn install
```

3. **Configure ton application Spotify**
   - Va sur [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
   - Crée une nouvelle application
   - Ajoute `trackroulette://` dans les **Redirect URIs**
   - Copie ton **Client ID**

4. **Configure le Client ID**
   - Ouvre `config.ts`
   - Remplace le `CLIENT_ID` par le tien :
   ```typescript
   export const SPOTIFY_CONFIG = {
     CLIENT_ID: 'TON_CLIENT_ID_ICI',
     // ...
   };
   ```

5. **Lance l'application**
```bash
npm start
# ou
expo start
```

6. **Scanne le QR code** avec Expo Go sur ton téléphone

---

## 🎮 Comment jouer

1. **Connexion** : Connecte-toi avec ton compte Spotify
2. **Lobby** : Choisis une catégorie de musique
3. **Jeu** : 
   - Un extrait audio se joue pendant 30 secondes
   - Les autres joueurs doivent deviner qui écoute ce morceau
   - Plus tu réponds vite, plus tu gagnes de points !
4. **Révélation** : Découvre le morceau et l'artiste
5. **Résultats** : À la fin des 5 manches, vois le classement final !

---

## 📂 Structure du projet

```
track-roulette/
├── App.tsx                 # Point d'entrée principal
├── config.ts              # Configuration Spotify (Client ID, etc.)
├── constants.ts           # Constantes (couleurs, config jeu, etc.)
├── types.ts               # Types TypeScript
├── contexts/
│   ├── AuthContext.tsx    # Gestion authentification Spotify
│   └── GameContext.tsx    # Gestion état du jeu
├── screens/
│   ├── WelcomeScreen.tsx  # Écran de connexion
│   ├── LobbyScreen.tsx    # Sélection catégorie et joueurs
│   ├── GameScreen.tsx     # Écran de jeu principal
│   ├── RevealScreen.tsx   # Révélation du morceau
│   └── GameOverScreen.tsx # Écran de fin avec résultats
└── utils/
    └── spotifyRefresh.ts  # Utilitaires gestion token
```

---

## 🔧 Technologies utilisées

- **React Native** : Framework mobile
- **Expo** : Plateforme de développement
- **TypeScript** : Typage statique
- **React Navigation** : Navigation entre écrans
- **Expo Auth Session** : Authentification OAuth Spotify
- **Expo AV** : Lecture audio
- **Expo Haptics** : Feedback haptique
- **AsyncStorage** : Stockage local
- **Spotify Web API** : Récupération des données musicales
- **iTunes Search API** : Extraits audio de secours

---

## 🐛 Problèmes connus & Solutions

### Le son ne se lance pas
- Vérifie que ton téléphone n'est pas en mode silencieux
- Assure-toi d'avoir autorisé les permissions audio

### "Token expiré"
- Les tokens Spotify expirent après 1 heure
- Déconnecte-toi et reconnecte-toi depuis l'écran Welcome

### Pas d'extrait audio trouvé
- Certains morceaux n'ont pas de preview disponible
- L'app va automatiquement chercher un autre morceau
- Essaye une autre catégorie si le problème persiste

---

## 📝 Configuration avancée

### Changer le nombre de manches
Dans `constants.ts` :
```typescript
export const GAME_CONFIG = {
  MAX_ROUNDS: 5, // Modifie ce nombre
  // ...
};
```

### Ajouter des catégories personnalisées
Dans `constants.ts`, ajoute une entrée dans `CATEGORIES` :
```typescript
{
  key: 'MA_CATEGORIE',
  label: 'Ma Catégorie',
  icon: 'star',
  description: 'Description',
  gradient: ['#FF0000', '#00FF00'],
  emoji: '🎵'
}
```

Puis implémente la logique dans `GameScreen.tsx` (fonction `startRound`).

---

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésite pas à :
- Reporter des bugs
- Proposer de nouvelles fonctionnalités
- Améliorer la documentation

---

## 📄 Licence

Ce projet est sous licence MIT. Voir le fichier `LICENSE` pour plus de détails.

---

## 👨‍💻 Auteur

Créé avec ❤️ pour les amateurs de musique et de jeux entre amis !

---

## 🙏 Remerciements

- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/)
- [Expo](https://expo.dev/)
- La communauté React Native

---

## 📱 Captures d'écran

_(À ajouter : screenshots de l'app)_

---

**Prêt à découvrir les vrais goûts musicaux de tes amis ? 🎵**

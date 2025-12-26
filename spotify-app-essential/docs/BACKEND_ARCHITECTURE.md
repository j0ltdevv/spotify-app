# 🚀 Architecture Backend - Track Roulette

## 📋 Vue d'ensemble

Transformation de **l'architecture client-side** vers une **architecture hybride client-serveur** pour gérer :

- ✅ **Refresh Token Spotify automatique** (plus de reconnexion après 1h)
- ✅ **Mode Multijoueur temps réel** (WebSocket)
- ✅ **Sécurité renforcée** (clés API côté serveur)
- ✅ **Analytics & Monitoring** (logs, métriques, crashs)

---

## 🏗️ Architecture Recommandée

### **Stack Technique**

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Services   │  │   Contexts   │  │   Screens    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (Node.js + Express)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Auth Routes  │  │ Game Routes  │  │ Music Routes │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Services   │  │  WebSocket   │  │    Cache     │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    ┌────────┐     ┌─────────┐     ┌─────────┐
    │Spotify │     │Database │     │  Redis  │
    │  API   │     │(MongoDB)│     │ (Cache) │
    └────────┘     └─────────┘     └─────────┘
```

### **Technologies**

| Composant | Technologie | Pourquoi |
|-----------|-------------|----------|
| **Backend API** | Node.js + Express | Compatible avec votre stack TypeScript, léger, rapide |
| **Database** | MongoDB | NoSQL, flexible pour stocker users, games, analytics |
| **Cache** | Redis | Performance pour tokens, sessions, cache API |
| **WebSocket** | Socket.io | Temps réel pour le mode multijoueur |
| **Auth** | JWT + Spotify OAuth | Sécurisé, stateless, compatible mobile |
| **Déploiement** | Railway / Render | Gratuit pour démarrer, facile à scaler |

---

## 🔐 Flux d'Authentification Spotify (avec Refresh Token)

### **Problème Actuel**
- Token expire après **1 heure**
- L'utilisateur doit **se reconnecter manuellement**
- Pas de `refresh_token` côté client (pour des raisons de sécurité)

### **Solution Backend**

```
┌──────────┐                  ┌──────────┐                 ┌──────────┐
│  Mobile  │                  │ Backend  │                 │ Spotify  │
│   App    │                  │   API    │                 │   API    │
└────┬─────┘                  └────┬─────┘                 └────┬─────┘
     │                             │                             │
     │ 1. Login with Spotify       │                             │
     ├────────────────────────────>│                             │
     │                             │ 2. OAuth Flow               │
     │                             ├────────────────────────────>│
     │                             │                             │
     │                             │ 3. Code + Refresh Token     │
     │                             │<────────────────────────────┤
     │                             │                             │
     │                             │ 4. Store refresh_token      │
     │                             │    in database (encrypted)  │
     │                             │                             │
     │ 5. JWT Token (custom)       │                             │
     │<────────────────────────────┤                             │
     │                             │                             │
     │ 6. API Call with JWT        │                             │
     ├────────────────────────────>│                             │
     │                             │ 7. Validate JWT             │
     │                             │ 8. Get fresh Spotify token  │
     │                             │    (auto-refresh if expired)│
     │                             │                             │
     │                             │ 9. Call Spotify API         │
     │                             ├────────────────────────────>│
     │                             │                             │
     │                             │ 10. Response                │
     │                             │<────────────────────────────┤
     │ 11. Data                    │                             │
     │<────────────────────────────┤                             │
```

### **Avantages**
- ✅ **Pas de reconnexion** : Le backend gère automatiquement le refresh
- ✅ **Sécurité** : Le `refresh_token` Spotify reste côté serveur
- ✅ **Expérience fluide** : L'utilisateur ne voit jamais d'erreur d'expiration

---

## 🎮 Mode Multijoueur (WebSocket)

### **Architecture Temps Réel**

```typescript
// Backend: Game Room Management
class GameRoom {
  id: string;
  players: Player[];
  currentTrack: GameTrack | null;
  scores: Map<string, number>;
  state: 'lobby' | 'playing' | 'reveal' | 'finished';
}

// Events WebSocket
socket.on('create-room', (data) => { /* Créer une room */ });
socket.on('join-room', (roomId) => { /* Rejoindre une room */ });
socket.on('start-game', () => { /* Démarrer la partie */ });
socket.on('submit-answer', (answer) => { /* Répondre */ });
socket.on('next-round', () => { /* Round suivant */ });

// Broadcasts
socket.to(roomId).emit('player-joined', player);
socket.to(roomId).emit('game-started', gameData);
socket.to(roomId).emit('round-ended', results);
```

### **Fonctionnalités**
- ✅ **Rooms de jeu** (code à 6 chiffres)
- ✅ **Sync en temps réel** (tous les joueurs voient la même chose)
- ✅ **Gestion des déconnexions** (reconnexion automatique)
- ✅ **Leaderboard global** (sauvegardé en DB)

---

## 📊 Analytics & Monitoring

### **Données collectées**

| Métrique | Description | Stockage |
|----------|-------------|----------|
| **User Events** | Login, logout, games played | MongoDB |
| **Game Stats** | Scores, rounds, duration | MongoDB |
| **API Performance** | Response time, errors | Redis + Logs |
| **Music Sources** | Spotify/iTunes/Deezer usage | MongoDB |
| **Crashes** | Errors, stack traces | Sentry/LogRocket |

### **Endpoints Analytics**

```typescript
// Backend endpoints
GET  /api/analytics/user/:userId       // Stats utilisateur
GET  /api/analytics/leaderboard        // Top players global
GET  /api/analytics/popular-tracks     // Morceaux les plus joués
POST /api/analytics/event              // Log custom event
```

---

## 🔒 Sécurité

### **Protection des clés API**

**Avant (Client-side)** ❌
```typescript
// config.ts - EXPOSÉ dans l'app
export const SPOTIFY_CONFIG = {
  CLIENT_ID: '3765c558e9704334bbe1acebe13998fa', // ❌ Visible
  CLIENT_SECRET: 'xxx' // ❌ NE JAMAIS mettre côté client
};
```

**Après (Backend)** ✅
```typescript
// Backend .env - SÉCURISÉ
SPOTIFY_CLIENT_ID=3765c558e9704334bbe1acebe13998fa
SPOTIFY_CLIENT_SECRET=your_secret_here
JWT_SECRET=your_jwt_secret

// Client config.ts - PROPRE
export const API_CONFIG = {
  BASE_URL: 'https://your-backend.railway.app',
  WS_URL: 'wss://your-backend.railway.app'
};
```

### **Validation & Rate Limiting**

```typescript
// Backend middleware
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // Max 100 requêtes
});

app.use('/api/', limiter);
```

---

## 📁 Structure Backend

```
backend/
├── src/
│   ├── config/
│   │   ├── database.ts          # MongoDB connection
│   │   ├── redis.ts             # Redis connection
│   │   └── spotify.ts           # Spotify OAuth config
│   │
│   ├── controllers/
│   │   ├── authController.ts    # Login, logout, refresh
│   │   ├── musicController.ts   # Get tracks, search
│   │   ├── gameController.ts    # Game logic
│   │   └── userController.ts    # User profile
│   │
│   ├── services/
│   │   ├── SpotifyService.ts    # Spotify API wrapper
│   │   ├── MusicService.ts      # Music aggregation logic
│   │   ├── TokenService.ts      # JWT + Refresh token
│   │   └── CacheService.ts      # Redis cache
│   │
│   ├── models/
│   │   ├── User.ts              # User schema (MongoDB)
│   │   ├── Game.ts              # Game schema
│   │   └── Analytics.ts         # Analytics schema
│   │
│   ├── middleware/
│   │   ├── auth.ts              # JWT validation
│   │   ├── errorHandler.ts     # Error handling
│   │   └── rateLimiter.ts      # Rate limiting
│   │
│   ├── routes/
│   │   ├── auth.routes.ts       # /api/auth/*
│   │   ├── music.routes.ts      # /api/music/*
│   │   ├── game.routes.ts       # /api/game/*
│   │   └── analytics.routes.ts # /api/analytics/*
│   │
│   ├── websocket/
│   │   ├── gameSocket.ts        # WebSocket game events
│   │   └── roomManager.ts       # Room management
│   │
│   └── index.ts                 # Entry point
│
├── .env.example                 # Template variables
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🚀 Plan de Migration

### **Phase 1 : Backend Minimal (1 semaine)**
- [ ] Setup Express + TypeScript
- [ ] Authentification Spotify OAuth avec refresh token
- [ ] Endpoints de base : `/auth/login`, `/auth/refresh`, `/music/top-tracks`
- [ ] Déploiement sur Railway/Render

### **Phase 2 : Migration Progressive (1-2 semaines)**
- [ ] Migrer `MusicService` vers le backend
- [ ] Adapter le client pour utiliser les endpoints backend
- [ ] Tests avec l'app existante (mode hybride)

### **Phase 3 : Multijoueur (2 semaines)**
- [ ] Setup Socket.io
- [ ] Création des rooms et gestion des joueurs
- [ ] Sync temps réel des parties
- [ ] Tests multijoueur

### **Phase 4 : Analytics & Production (1 semaine)**
- [ ] Intégration MongoDB pour les stats
- [ ] Dashboard analytics
- [ ] Monitoring (Sentry, logs)
- [ ] Optimisations performance

---

## 💰 Coûts Estimés

| Service | Plan Gratuit | Plan Payant |
|---------|--------------|-------------|
| **Railway** | 500h/mois | $5/mois (Hobby) |
| **MongoDB Atlas** | 512MB gratuit | $9/mois (Shared) |
| **Redis Cloud** | 30MB gratuit | $7/mois (30MB) |
| **Sentry** | 5k événements/mois | $26/mois |
| **Total** | **Gratuit** | **~$47/mois** |

---

## 🎯 Recommandation

Pour votre cas (**toutes les fonctionnalités**), je recommande :

### **Solution Idéale : Backend Node.js + Express**

**Pourquoi ?**
- ✅ **Compatibilité totale** avec votre code TypeScript existant
- ✅ **Évolutif** : Facile d'ajouter des features progressivement
- ✅ **Coût maîtrisé** : Gratuit au départ, scalable ensuite
- ✅ **Contrôle total** : Pas de vendor lock-in (Firebase, Supabase)
- ✅ **Performances** : Redis + MongoDB = rapide

### **Alternative (plus rapide) : Firebase**

Si vous voulez déployer **rapidement** sans gérer de serveur :
- ✅ **Firebase Auth** (OAuth Spotify intégré)
- ✅ **Firestore** (database temps réel)
- ✅ **Cloud Functions** (backend serverless)
- ⚠️ **Limites** : Moins flexible, vendor lock-in

---

## 📝 Prochaines Étapes

Je peux vous aider avec :

1. **Créer le code backend complet** (Express + TypeScript)
2. **Adapter vos services client** pour utiliser le backend
3. **Guide de déploiement** (Railway/Render)
4. **Setup WebSocket** pour le multijoueur
5. **Dashboard analytics** (React Admin)

**Que souhaitez-vous que je fasse maintenant ?** 🚀

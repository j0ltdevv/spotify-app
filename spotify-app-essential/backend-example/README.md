# 🎵 Track Roulette Backend

Backend API pour l'application mobile Track Roulette.

## 🚀 Démarrage Rapide

### 1. Installation

```bash
cd backend-example
npm install
```

### 2. Configuration

Créer un fichier `.env` basé sur `.env.example` :

```bash
cp .env.example .env
```

Modifier les variables dans `.env` :
- `SPOTIFY_CLIENT_SECRET` : Votre secret Spotify
- `JWT_SECRET` : Générer avec `openssl rand -base64 32`
- `MONGODB_URI` : URL de votre base MongoDB
- `REDIS_URL` : URL de votre cache Redis

### 3. Lancer le serveur

**Mode développement :**
```bash
npm run dev
```

**Mode production :**
```bash
npm run build
npm start
```

Le serveur démarre sur `http://localhost:3000`

---

## 📡 Endpoints API

### **Authentication**

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/auth/spotify` | Initier OAuth Spotify |
| POST | `/api/auth/callback` | Callback OAuth (échange code) |
| POST | `/api/auth/refresh` | Refresh JWT token |
| POST | `/api/auth/logout` | Déconnexion |
| GET | `/api/auth/validate` | Valider JWT |

### **Music**

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/api/music/top-tracks` | ✅ | Top tracks utilisateur |
| GET | `/api/music/recent` | ✅ | Morceaux récents |
| GET | `/api/music/search` | ✅ | Recherche de morceaux |

### **User**

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/api/user/profile` | ✅ | Profil utilisateur |
| GET | `/api/user/stats` | ✅ | Statistiques utilisateur |

### **Game**

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/api/game/history` | ✅ | Historique des parties |
| GET | `/api/game/:roomId` | ✅ | Détails d'une partie |
| POST | `/api/game/finish` | ✅ | Terminer une partie |

### **Analytics**

| Méthode | Endpoint | Auth | Description |
|---------|----------|------|-------------|
| GET | `/api/analytics/leaderboard` | - | Classement global |
| GET | `/api/analytics/stats` | - | Statistiques globales |
| POST | `/api/analytics/event` | ✅ | Logger un événement |

---

## 🔌 WebSocket Events

### **Client → Server**

| Event | Data | Description |
|-------|------|-------------|
| `create-room` | `{hostUserId, hostName, category, totalRounds}` | Créer une room |
| `join-room` | `{roomId, userId, displayName, avatar}` | Rejoindre une room |
| `start-game` | `{roomId, tracks}` | Démarrer la partie |
| `submit-answer` | `{roomId, userId, answerId, isCorrect}` | Soumettre une réponse |
| `next-round` | `{roomId}` | Passer au round suivant |

### **Server → Client**

| Event | Data | Description |
|-------|------|-------------|
| `room-created` | `{roomId, game}` | Room créée avec succès |
| `player-joined` | `{player, players}` | Un joueur a rejoint |
| `game-started` | `{tracks, currentRound, totalRounds}` | Partie démarrée |
| `answer-submitted` | `{userId, answerId, isCorrect}` | Réponse soumise |
| `round-changed` | `{currentRound, totalRounds}` | Changement de round |
| `error` | `{message}` | Erreur |

---

## 📦 Base de Données (MongoDB)

### **Collections**

#### **users**
```typescript
{
  spotifyId: string;
  email: string;
  displayName: string;
  profileImage?: string;
  refreshToken: string; // Encrypted
  gamesPlayed: number;
  totalScore: number;
  lastLogin: Date;
}
```

#### **games**
```typescript
{
  roomId: string;
  hostUserId: string;
  players: [{userId, displayName, avatar, score}];
  tracks: [{trackId, title, artist, correctPlayerId}];
  status: 'lobby' | 'playing' | 'finished';
  currentRound: number;
  totalRounds: number;
  winner?: string;
}
```

---

## 🧪 Tests

Tester le serveur avec curl :

```bash
# Health check
curl http://localhost:3000/health

# Login (après OAuth)
curl -X POST http://localhost:3000/api/auth/callback \
  -H "Content-Type: application/json" \
  -d '{"code": "SPOTIFY_AUTH_CODE"}'

# Get profile (avec JWT)
curl http://localhost:3000/api/user/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🚀 Déploiement

### **Railway** (Recommandé)

1. Créer un compte sur [Railway.app](https://railway.app)
2. Installer Railway CLI :
   ```bash
   npm i -g @railway/cli
   ```
3. Déployer :
   ```bash
   railway login
   railway init
   railway up
   ```
4. Ajouter les variables d'environnement dans le dashboard Railway

### **Render**

1. Connecter votre repo GitHub
2. Créer un nouveau Web Service
3. Ajouter les variables d'environnement
4. Déployer automatiquement

---

## 📝 Scripts Disponibles

| Script | Description |
|--------|-------------|
| `npm run dev` | Lancer en mode développement (hot reload) |
| `npm run build` | Compiler TypeScript → JavaScript |
| `npm start` | Lancer en production |
| `npm test` | Lancer les tests |
| `npm run lint` | Vérifier le code |

---

## 🔐 Sécurité

- ✅ JWT pour l'authentification
- ✅ Refresh tokens Spotify chiffrés en DB
- ✅ Rate limiting (100 req/15min)
- ✅ Helmet.js (sécurité HTTP)
- ✅ CORS configuré
- ✅ Variables sensibles dans `.env`

---

## 📊 Monitoring (Optionnel)

Ajouter dans `.env` :

```bash
# Sentry (errors)
SENTRY_DSN=https://xxx@sentry.io/xxx

# Mixpanel (analytics)
MIXPANEL_TOKEN=xxx
```

---

## 🆘 Troubleshooting

### Port déjà utilisé
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux
lsof -ti:3000 | xargs kill -9
```

### MongoDB connection failed
- Vérifier que MongoDB tourne : `mongod --version`
- Ou utiliser MongoDB Atlas (gratuit)

### Redis not available
- Le backend fonctionne sans Redis (cache désactivé)
- Installer Redis localement ou utiliser Redis Cloud

---

## 📚 Documentation Complète

- [BACKEND_ARCHITECTURE.md](../BACKEND_ARCHITECTURE.md) : Architecture complète
- [BACKEND_MIGRATION_GUIDE.md](../BACKEND_MIGRATION_GUIDE.md) : Guide de migration client

---

## ✅ Checklist de Production

- [ ] Variables d'environnement configurées
- [ ] MongoDB Atlas configuré
- [ ] Redis Cloud configuré (optionnel)
- [ ] Domaine personnalisé configuré
- [ ] HTTPS activé
- [ ] Monitoring activé (Sentry)
- [ ] Backups DB configurés
- [ ] Rate limiting ajusté
- [ ] Logs persistants configurés

---

## 📞 Support

Pour toute question, ouvrir une issue sur GitHub.

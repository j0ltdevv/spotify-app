# 🚀 Guide de Setup Backend - Étape par Étape

Ce guide vous accompagne dans le déploiement complet du backend Track Roulette.

---

## 📋 Prérequis

Avant de commencer, assurez-vous d'avoir :

- ✅ **Node.js** ≥ 18.0.0 installé
- ✅ **npm** ≥ 9.0.0 installé
- ✅ Compte **Spotify Developer** (pour les clés API)
- ✅ Compte **Railway** ou **Render** (pour le déploiement)
- ✅ Compte **MongoDB Atlas** (gratuit)
- ✅ Compte **Redis Cloud** (gratuit, optionnel)

---

## 📝 Étape 1 : Configuration Spotify Developer

### 1.1 Créer une application Spotify

1. Aller sur [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Se connecter avec votre compte Spotify
3. Cliquer sur **"Create app"**
4. Remplir les informations :
   - **App name** : Track Roulette Backend
   - **App description** : Backend API for Track Roulette mobile game
   - **Redirect URIs** : 
     - `http://localhost:3000/api/auth/spotify/callback` (dev)
     - `https://your-backend.railway.app/api/auth/spotify/callback` (prod)
   - **APIs used** : Web API
5. Accepter les termes et cliquer sur **"Save"**

### 1.2 Récupérer les clés

1. Dans le dashboard de votre app, cliquer sur **"Settings"**
2. Copier :
   - **Client ID** : `3765c558e9704334bbe1acebe13998fa` (ou votre ID)
   - **Client Secret** : Cliquer sur "View client secret" et copier

⚠️ **Important** : Le Client Secret doit rester **confidentiel** !

---

## 🗄️ Étape 2 : Setup MongoDB Atlas

### 2.1 Créer un cluster gratuit

1. Aller sur [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Créer un compte (ou se connecter)
3. Créer un nouveau projet : **"Track Roulette"**
4. Cliquer sur **"Build a Database"**
5. Choisir **"M0 Free"** (gratuit)
6. Sélectionner une région proche de vous
7. Cliquer sur **"Create Cluster"**

### 2.2 Configurer l'accès

1. **Network Access** :
   - Aller dans "Network Access"
   - Cliquer sur "Add IP Address"
   - Choisir "Allow access from anywhere" (`0.0.0.0/0`)
   - Confirmer

2. **Database Access** :
   - Aller dans "Database Access"
   - Cliquer sur "Add New Database User"
   - Username : `trackroulette`
   - Password : Générer un mot de passe sécurisé
   - Database User Privileges : "Read and write to any database"
   - Ajouter l'utilisateur

### 2.3 Récupérer la connection string

1. Retourner sur "Database"
2. Cliquer sur **"Connect"** sur votre cluster
3. Choisir "Connect your application"
4. Copier la connection string :
   ```
   mongodb+srv://trackroulette:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. Remplacer `<password>` par le mot de passe créé
6. Ajouter le nom de la database : `/track-roulette` avant le `?`

**Résultat final :**
```
mongodb+srv://trackroulette:VotreMotDePasse@cluster0.xxxxx.mongodb.net/track-roulette?retryWrites=true&w=majority
```

---

## 🔴 Étape 3 : Setup Redis Cloud (Optionnel)

### 3.1 Créer une base Redis gratuite

1. Aller sur [Redis Cloud](https://redis.com/try-free/)
2. Créer un compte
3. Créer une nouvelle base :
   - **Cloud** : AWS
   - **Region** : Proche de vous
   - **Plan** : Free (30MB)
4. Confirmer

### 3.2 Récupérer la connection string

1. Cliquer sur votre base
2. Copier **"Public endpoint"** :
   ```
   redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345
   ```
3. Copier le **"Default user password"**

**Résultat final :**
```
redis://default:VotrePassword@redis-12345.c123.us-east-1-1.ec2.cloud.redislabs.com:12345
```

---

## 💻 Étape 4 : Setup Local (Dev)

### 4.1 Installation des dépendances

```bash
cd backend-example
npm install
```

### 4.2 Configuration `.env`

Créer le fichier `.env` :

```bash
cp .env.example .env
```

Modifier `.env` avec vos valeurs :

```bash
# Server
NODE_ENV=development
PORT=3000

# Frontend (CORS)
CLIENT_URL=http://localhost:19006

# Database
MONGODB_URI=mongodb+srv://trackroulette:VOTRE_PASSWORD@cluster0.xxxxx.mongodb.net/track-roulette

# Redis (optionnel)
REDIS_URL=redis://default:VOTRE_PASSWORD@redis-xxxxx.cloud.redislabs.com:12345

# JWT (générer avec: openssl rand -base64 32)
JWT_SECRET=gK7xY2mP9vL4nQ8wR5tE1zD3bS6fJ0hC

# Spotify
SPOTIFY_CLIENT_ID=3765c558e9704334bbe1acebe13998fa
SPOTIFY_CLIENT_SECRET=VOTRE_CLIENT_SECRET_ICI
SPOTIFY_REDIRECT_URI=http://localhost:3000/api/auth/spotify/callback
```

### 4.3 Lancer le serveur

```bash
npm run dev
```

Vous devriez voir :

```
✅ MongoDB connected successfully
✅ Redis connected successfully
✅ WebSocket initialized
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎵 Track Roulette Backend Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Server running on port 3000
📡 Environment: development
🌐 API: http://localhost:3000/api
🔌 WebSocket: ws://localhost:3000
💚 Health: http://localhost:3000/health
```

### 4.4 Tester le backend

```bash
# Test health check
curl http://localhost:3000/health

# Résultat attendu :
# {"status":"OK","timestamp":"...","uptime":...}
```

---

## ☁️ Étape 5 : Déploiement sur Railway

### 5.1 Installation Railway CLI

```bash
npm install -g @railway/cli
```

### 5.2 Login Railway

```bash
railway login
```

Un navigateur s'ouvre → Connexion avec GitHub

### 5.3 Initialiser le projet

```bash
cd backend-example
railway init
```

Choisir :
- **Create a new project** → "Track Roulette Backend"
- **Environment** → "production"

### 5.4 Ajouter les variables d'environnement

```bash
# Via CLI
railway variables set SPOTIFY_CLIENT_SECRET=votre_secret
railway variables set JWT_SECRET=votre_jwt_secret
railway variables set MONGODB_URI=votre_mongodb_uri
railway variables set REDIS_URL=votre_redis_url

# Ou via Dashboard
railway open
# → Variables → Add Variable
```

Ajouter toutes les variables de `.env` (sauf NODE_ENV et PORT).

### 5.5 Déployer

```bash
railway up
```

Le backend se déploie automatiquement ! 🚀

### 5.6 Récupérer l'URL publique

```bash
railway domain
```

Ou via le dashboard Railway → Settings → Generate Domain

**Résultat :** `https://track-roulette-backend-production.up.railway.app`

### 5.7 Mettre à jour Spotify Redirect URI

1. Retourner sur [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Éditer votre app
3. Ajouter dans **Redirect URIs** :
   ```
   https://track-roulette-backend-production.up.railway.app/api/auth/spotify/callback
   ```
4. Sauvegarder

---

## 📱 Étape 6 : Connecter le Client Mobile

### 6.1 Mettre à jour `config.ts`

```typescript
// config.ts
export const BACKEND_CONFIG = {
  API_URL: __DEV__ 
    ? 'http://localhost:3000/api'  // Dev
    : 'https://track-roulette-backend-production.up.railway.app/api', // Prod
};
```

### 6.2 Utiliser le BackendService

```typescript
// Dans vos screens
import BackendService from '../services/BackendService';

// Exemple : Get profile
const profile = await BackendService.getUserProfile();
if (profile.success) {
  console.log('User:', profile.data);
}
```

---

## 🧪 Étape 7 : Tests

### 7.1 Test Backend

```bash
# Health check
curl https://your-backend.railway.app/health

# Leaderboard (public)
curl https://your-backend.railway.app/api/analytics/leaderboard
```

### 7.2 Test Authentication (avec l'app mobile)

1. Lancer l'app mobile en dev : `npm start`
2. Cliquer sur "Se connecter avec Spotify"
3. Autoriser l'application
4. Vérifier dans les logs backend :
   ```
   ✅ Tokens exchanged successfully
   ✅ New user created: VotreNom
   ✅ JWT generated for user: VotreNom
   ```

### 7.3 Test WebSocket (optionnel)

Installer `wscat` :
```bash
npm install -g wscat
```

Tester WebSocket :
```bash
wscat -c wss://your-backend.railway.app
> {"type":"ping"}
```

---

## 🔧 Étape 8 : Monitoring & Logs

### 8.1 Voir les logs Railway

```bash
railway logs
```

Ou via le dashboard : Railway → Deployments → Logs

### 8.2 Monitoring (Optionnel - Sentry)

1. Créer un compte sur [Sentry.io](https://sentry.io)
2. Créer un nouveau projet Node.js
3. Copier le DSN
4. Ajouter dans Railway :
   ```bash
   railway variables set SENTRY_DSN=https://xxx@sentry.io/xxx
   ```

---

## ✅ Checklist Finale

### Backend Local (Dev)
- [ ] Node.js + npm installés
- [ ] Backend tourne sur `localhost:3000`
- [ ] MongoDB Atlas connecté
- [ ] Redis connecté (optionnel)
- [ ] Health check retourne `{"status":"OK"}`

### Backend Production (Railway)
- [ ] Déployé sur Railway
- [ ] Variables d'environnement configurées
- [ ] URL publique accessible
- [ ] Spotify Redirect URI mis à jour
- [ ] MongoDB Atlas accessible depuis Railway
- [ ] Logs visibles dans Railway

### Client Mobile
- [ ] `BackendService.ts` créé
- [ ] `BACKEND_CONFIG` configuré
- [ ] `JWT_TOKEN` ajouté dans `constants.ts`
- [ ] Test de login fonctionne
- [ ] Profile utilisateur récupéré

---

## 🐛 Troubleshooting

### Erreur : "Cannot connect to MongoDB"
- Vérifier que l'IP `0.0.0.0/0` est autorisée dans Network Access
- Vérifier le mot de passe dans la connection string
- Tester la connection : `mongosh "mongodb+srv://..."`

### Erreur : "Redis connection failed"
- Le backend fonctionne sans Redis (mode dégradé)
- Vérifier le password Redis Cloud
- Tester : `redis-cli -u redis://default:password@...`

### Erreur : "Spotify authentication failed"
- Vérifier le Client Secret
- Vérifier que le Redirect URI est exactement le même
- Vérifier les scopes OAuth

### Backend inaccessible depuis l'app mobile
- En dev local : utiliser votre IP locale (pas `localhost`)
- Ex : `http://192.168.1.10:3000/api`
- Vérifier que le firewall ne bloque pas le port 3000

---

## 📞 Support

Problème non résolu ? Vérifier :
- [Railway Docs](https://docs.railway.app)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)
- [Spotify API Docs](https://developer.spotify.com/documentation/web-api)

---

## 🎉 Félicitations !

Votre backend est maintenant déployé et fonctionnel ! 🚀

**Prochaines étapes :**
- 📊 Activer les analytics (Sentry, Mixpanel)
- 🎮 Implémenter le mode multijoueur (WebSocket)
- 🔒 Ajouter plus de sécurité (rate limiting personnalisé)
- 📈 Optimiser les performances (cache Redis)
- 🌐 Ajouter un CDN pour les assets

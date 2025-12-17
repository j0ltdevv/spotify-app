# 🔄 Guide de Migration Client → Backend

## 📋 Vue d'ensemble

Ce guide vous explique **comment migrer progressivement** votre application vers l'architecture backend, **sans casser l'existant**.

---

## 🎯 Stratégie de Migration (Mode Hybride)

### **Principe : Migration Progressive**

```
Phase 1: Backend + Client (Dual Mode)
┌─────────────────────────────────────┐
│  Client App                         │
│  ┌────────────────┐                 │
│  │  AuthService   │ ──┐             │
│  │  (Backend)     │   │ New ✨      │
│  └────────────────┘   │             │
│  ┌────────────────┐   │             │
│  │  MusicService  │ ──┤ Hybrid      │
│  │  (Local+API)   │   │             │
│  └────────────────┘   │             │
│  ┌────────────────┐   │             │
│  │  Old Contexts  │ ──┘ Legacy      │
│  └────────────────┘                 │
└─────────────────────────────────────┘

Phase 2: Full Backend
┌─────────────────────────────────────┐
│  Client App (Thin Client)           │
│  ┌────────────────┐                 │
│  │  API Services  │ ───> Backend    │
│  └────────────────┘                 │
└─────────────────────────────────────┘
```

---

## 🔧 Modifications Client - Par Fichier

### **1. `config.ts` - Configuration API**

**Avant :**
```typescript
// config.ts - Clés exposées ❌
export const SPOTIFY_CONFIG = {
  CLIENT_ID: '3765c558e9704334bbe1acebe13998fa',
  REDIRECT_SCHEME: 'trackroulette',
  SCOPES: [...]
};

export const API_ENDPOINTS = {
  SPOTIFY_AUTH: 'https://accounts.spotify.com/authorize',
  SPOTIFY_USER: 'https://api.spotify.com/v1/me',
  // ...
};
```

**Après :**
```typescript
// config.ts - Backend endpoints ✅
export const BACKEND_CONFIG = {
  API_URL: __DEV__ 
    ? 'http://localhost:3000/api'  // Dev local
    : 'https://your-app.railway.app/api', // Production
  WS_URL: __DEV__
    ? 'ws://localhost:3000'
    : 'wss://your-app.railway.app',
  TIMEOUT: 10000, // 10s
};

// Mode hybride : garder l'ancien pour fallback
export const SPOTIFY_CONFIG = {
  CLIENT_ID: '3765c558e9704334bbe1acebe13998fa',
  REDIRECT_SCHEME: 'trackroulette',
  SCOPES: [...], // Garder pour l'instant
};

// Les endpoints Spotify sont maintenant côté backend
export const API_ENDPOINTS = {
  // Backend endpoints
  AUTH_LOGIN: `${BACKEND_CONFIG.API_URL}/auth/login`,
  AUTH_REFRESH: `${BACKEND_CONFIG.API_URL}/auth/refresh`,
  AUTH_LOGOUT: `${BACKEND_CONFIG.API_URL}/auth/logout`,
  
  MUSIC_TOP_TRACKS: `${BACKEND_CONFIG.API_URL}/music/top-tracks`,
  MUSIC_RECENT: `${BACKEND_CONFIG.API_URL}/music/recent`,
  MUSIC_PREVIEW: `${BACKEND_CONFIG.API_URL}/music/preview`,
  
  USER_PROFILE: `${BACKEND_CONFIG.API_URL}/user/profile`,
  USER_STATS: `${BACKEND_CONFIG.API_URL}/user/stats`,
  
  // Fallback local (mode hybride)
  ITUNES_SEARCH: 'https://itunes.apple.com/search',
};
```

---

### **2. Nouveau Service : `BackendService.ts`**

Créer un nouveau service pour centraliser les appels backend :

```typescript
// services/BackendService.ts
import { BACKEND_CONFIG } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

class BackendService {
  private static instance: BackendService;
  private baseURL: string;

  private constructor() {
    this.baseURL = BACKEND_CONFIG.API_URL;
  }

  public static getInstance(): BackendService {
    if (!BackendService.instance) {
      BackendService.instance = new BackendService();
    }
    return BackendService.instance;
  }

  /**
   * Récupère le JWT token sauvegardé
   */
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
    } catch (error) {
      console.error('❌ Erreur récupération JWT:', error);
      return null;
    }
  }

  /**
   * Appel API générique avec gestion d'erreurs
   */
  private async fetchAPI<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = await this.getAuthToken();
      
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      // Ajouter le JWT si disponible
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        timeout: BACKEND_CONFIG.TIMEOUT,
      });

      const data = await response.json();

      if (!response.ok) {
        // Gestion des erreurs spécifiques
        if (response.status === 401) {
          // Token expiré, tenter le refresh
          const refreshed = await this.refreshToken();
          if (refreshed) {
            // Retry la requête
            return this.fetchAPI<T>(endpoint, options);
          }
          throw new Error('SESSION_EXPIRED');
        }
        
        throw new Error(data.message || `API Error: ${response.status}`);
      }

      return {
        success: true,
        data: data.data || data,
      };

    } catch (error) {
      console.error('❌ Backend API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Authentification Spotify via le backend
   */
  public async loginWithSpotify(spotifyCode: string): Promise<ApiResponse<{
    jwt: string;
    user: any;
  }>> {
    return this.fetchAPI('/auth/spotify/callback', {
      method: 'POST',
      body: JSON.stringify({ code: spotifyCode }),
    });
  }

  /**
   * Refresh du JWT token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const response = await this.fetchAPI<{ jwt: string }>('/auth/refresh', {
        method: 'POST',
      });

      if (response.success && response.data?.jwt) {
        await AsyncStorage.setItem(STORAGE_KEYS.JWT_TOKEN, response.data.jwt);
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Erreur refresh token:', error);
      return false;
    }
  }

  /**
   * Récupère les top tracks via le backend
   */
  public async getTopTracks(params: {
    timeRange?: 'short_term' | 'medium_term' | 'long_term';
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams(params as any).toString();
    return this.fetchAPI(`/music/top-tracks?${queryParams}`);
  }

  /**
   * Récupère les morceaux récents
   */
  public async getRecentTracks(limit: number = 50): Promise<ApiResponse<any[]>> {
    return this.fetchAPI(`/music/recent?limit=${limit}`);
  }

  /**
   * Récupère le profil utilisateur
   */
  public async getUserProfile(): Promise<ApiResponse<any>> {
    return this.fetchAPI('/user/profile');
  }

  /**
   * Log un événement analytics
   */
  public async logEvent(eventName: string, data: any): Promise<void> {
    try {
      await this.fetchAPI('/analytics/event', {
        method: 'POST',
        body: JSON.stringify({ event: eventName, data }),
      });
    } catch (error) {
      // Silencieux pour analytics
      console.warn('⚠️ Analytics log failed:', error);
    }
  }

  /**
   * Déconnexion
   */
  public async logout(): Promise<void> {
    try {
      await this.fetchAPI('/auth/logout', { method: 'POST' });
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.JWT_TOKEN,
        STORAGE_KEYS.GAME_STATE,
      ]);
    } catch (error) {
      console.error('❌ Erreur logout:', error);
    }
  }
}

export default BackendService.getInstance();
```

---

### **3. Adapter `AuthContext.tsx`**

**Modifications à faire :**

```typescript
// contexts/AuthContext.tsx
import BackendService from '../services/BackendService';

interface AuthContextType {
  // Avant : accessToken (Spotify direct)
  // Après : jwtToken (Backend JWT)
  jwtToken: string | null;
  setJwtToken: (token: string | null) => void;
  user: SpotifyUser | null;
  isLoading: boolean;
  logout: () => Promise<void>;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Charger le JWT au démarrage
  useEffect(() => {
    loadToken();
  }, []);

  const loadToken = async () => {
    try {
      const savedJWT = await AsyncStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
      
      if (savedJWT) {
        // Vérifier avec le backend
        const profileResult = await BackendService.getUserProfile();
        
        if (profileResult.success && profileResult.data) {
          setJwtToken(savedJWT);
          setUser(profileResult.data);
          console.log('✅ Session restaurée');
        } else {
          // Token invalide
          await AsyncStorage.removeItem(STORAGE_KEYS.JWT_TOKEN);
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await BackendService.logout();
    setJwtToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    jwtToken,
    setJwtToken,
    user,
    isLoading,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
```

---

### **4. Adapter `WelcomeScreen.tsx` (Login)**

**Modifications pour utiliser le backend OAuth :**

```typescript
// screens/WelcomeScreen.tsx
import BackendService from '../services/BackendService';
import { BACKEND_CONFIG } from '../config';

export default function WelcomeScreen() {
  const { setJwtToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Nouveau flow OAuth via backend
  const handleSpotifyLogin = async () => {
    try {
      setIsLoading(true);

      // 1. Redirection OAuth vers le backend
      const authURL = `${BACKEND_CONFIG.API_URL}/auth/spotify`;
      
      // Ouvrir le browser OAuth
      const result = await AuthSession.startAsync({
        authUrl: authURL,
        returnUrl: 'trackroulette://callback',
      });

      if (result.type === 'success' && result.params.code) {
        // 2. Échanger le code contre un JWT
        const loginResult = await BackendService.loginWithSpotify(result.params.code);
        
        if (loginResult.success && loginResult.data) {
          // 3. Sauvegarder le JWT
          await AsyncStorage.setItem(STORAGE_KEYS.JWT_TOKEN, loginResult.data.jwt);
          setJwtToken(loginResult.data.jwt);
          
          console.log('✅ Login réussi:', loginResult.data.user);
          navigation.navigate('Lobby');
        } else {
          Alert.alert('Erreur', loginResult.error || 'Connexion échouée');
        }
      }
    } catch (error) {
      console.error('❌ Erreur login:', error);
      Alert.alert('Erreur', 'Impossible de se connecter');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeContainer>
      {/* ... UI ... */}
      <TouchableOpacity 
        onPress={handleSpotifyLogin}
        disabled={isLoading}
      >
        <Text>{isLoading ? 'Connexion...' : 'Se connecter avec Spotify'}</Text>
      </TouchableOpacity>
    </SafeContainer>
  );
}
```

---

### **5. Adapter `MusicService.ts` (Mode Hybride)**

**Garder la logique locale + ajouter le fallback backend :**

```typescript
// services/MusicService.ts
import BackendService from './BackendService';

class MusicService {
  // ... code existant ...

  /**
   * Récupère les top tracks (avec fallback backend)
   */
  public async getTopTracks(
    accessToken: string | null, // Peut être null si mode backend
    players: Player[],
    timeRange: TimeRange = 'medium_term',
    tracksPerPlayer: number = 5
  ): Promise<MusicFetchResult> {
    try {
      // MODE 1: Backend API (préféré)
      if (!accessToken) {
        console.log('🌐 Utilisation du backend pour les top tracks');
        const result = await BackendService.getTopTracks({
          timeRange,
          limit: players.length * tracksPerPlayer,
        });

        if (result.success && result.data) {
          return this.processBackendTracks(result.data, players, tracksPerPlayer);
        }
      }

      // MODE 2: Appel direct Spotify (fallback)
      console.log('📱 Fallback: Appel direct Spotify API');
      return this.fetchSpotifyDirectly(accessToken!, players, timeRange, tracksPerPlayer);

    } catch (error) {
      console.error('❌ Erreur getTopTracks:', error);
      return {
        tracks: [],
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Process les tracks du backend
   */
  private processBackendTracks(
    tracks: any[],
    players: Player[],
    tracksPerPlayer: number
  ): MusicFetchResult {
    // Même logique que fetchSpotifyDirectly
    // ...
  }

  /**
   * Appel direct Spotify (ancien code)
   */
  private async fetchSpotifyDirectly(
    accessToken: string,
    players: Player[],
    timeRange: TimeRange,
    tracksPerPlayer: number
  ): MusicFetchResult {
    // Code existant inchangé
    // ...
  }
}
```

---

### **6. Nouveau fichier `constants.ts` (ajouter JWT)**

```typescript
// constants.ts
export const STORAGE_KEYS = {
  SPOTIFY_TOKEN: '@spotify_token',           // Legacy
  SPOTIFY_TOKEN_EXPIRY: '@spotify_expiry',   // Legacy
  JWT_TOKEN: '@jwt_token',                   // ✨ Nouveau
  GAME_STATE: '@game_state',
};
```

---

## 🧪 Tests de Migration

### **Test 1 : Authentification Backend**

```typescript
// Test dans WelcomeScreen
console.log('🧪 Test Backend Auth');

// 1. Login
const result = await BackendService.loginWithSpotify(code);
console.assert(result.success, 'Login should succeed');
console.assert(result.data?.jwt, 'JWT should be returned');

// 2. Profile
const profile = await BackendService.getUserProfile();
console.assert(profile.success, 'Profile should be fetched');
console.assert(profile.data?.display_name, 'User should have name');
```

### **Test 2 : Mode Hybride**

```typescript
// Test dans LobbyScreen
console.log('🧪 Test Hybrid Mode');

// Avec backend
const backendResult = await MusicService.getTopTracks(null, players);
console.log('Backend tracks:', backendResult.tracks.length);

// Avec Spotify direct (fallback)
const directResult = await MusicService.getTopTracks(spotifyToken, players);
console.log('Direct tracks:', directResult.tracks.length);
```

---

## 📊 Checklist de Migration

### **Étape 1 : Préparation (Client)**
- [ ] Créer `services/BackendService.ts`
- [ ] Ajouter `BACKEND_CONFIG` dans `config.ts`
- [ ] Ajouter `JWT_TOKEN` dans `constants.ts`
- [ ] Tester la connexion au backend local

### **Étape 2 : Authentification**
- [ ] Modifier `AuthContext.tsx` pour utiliser JWT
- [ ] Adapter `WelcomeScreen.tsx` (OAuth backend)
- [ ] Tester login/logout
- [ ] Vérifier la persistence du JWT

### **Étape 3 : Services (Mode Hybride)**
- [ ] Adapter `MusicService.ts` avec fallback backend
- [ ] Adapter `UserService.ts` avec fallback backend
- [ ] Tester les deux modes (backend + direct)

### **Étape 4 : Cleanup (Optionnel)**
- [ ] Supprimer le code legacy Spotify direct
- [ ] Supprimer `SPOTIFY_TOKEN` de `constants.ts`
- [ ] Cleanup `utils/spotifyHelper.ts` si inutile

---

## 🐛 Troubleshooting

### **Erreur : "Network request failed"**
```typescript
// Vérifier que le backend est accessible
const test = await fetch(`${BACKEND_CONFIG.API_URL}/health`);
console.log('Backend status:', test.status);
```

### **Erreur : "JWT expired"**
```typescript
// Le refresh automatique doit fonctionner
// Vérifier dans BackendService.fetchAPI()
```

### **Erreur : "Cannot read property of null"**
```typescript
// Vérifier que le JWT est bien sauvegardé
const jwt = await AsyncStorage.getItem(STORAGE_KEYS.JWT_TOKEN);
console.log('JWT saved:', jwt ? 'Yes' : 'No');
```

---

## 🎯 Avantages du Mode Hybride

✅ **Réversible** : Peut revenir en arrière facilement  
✅ **Testable** : Compare backend vs direct  
✅ **Progressif** : Migration feature par feature  
✅ **Sécurisé** : Fallback si backend down  

---

## 📝 Prochaines Étapes

Une fois la migration terminée, vous pourrez :
- 🎮 Ajouter le **mode multijoueur** (WebSocket)
- 📊 Activer les **analytics** serveur
- 🔒 Retirer les **clés API du client**
- 🚀 **Optimiser** les performances avec Redis

**Prêt à commencer ?** Je peux générer le code backend complet ! 🚀

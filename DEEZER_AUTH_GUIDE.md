# 🎵 Guide d'Implémentation - Authentification Deezer

**Date:** 2024
**Objectif:** Permettre aux utilisateurs Deezer de jouer sans compte Spotify

---

## 🎯 Objectif

Ajouter Deezer comme **alternative à Spotify** pour que les utilisateurs qui n'ont pas Spotify puissent jouer avec leur musique Deezer.

---

## 📋 Vue d'Ensemble

### Ce qui va changer

**WelcomeScreen:**
```
Avant:
- [Bouton] Continuer avec Spotify

Après:
- [Bouton] Continuer avec Spotify
- [Bouton] Continuer avec Deezer  ← NOUVEAU
```

**Flow utilisateur:**
```
1. Utilisateur arrive sur WelcomeScreen
2. Choisit Spotify OU Deezer
3. Authentification OAuth
4. Lobby avec sa musique
5. Joue avec ses tracks personnels
```

---

## 📝 Étape 1: Inscription Deezer Developers

### 1.1 Créer un compte développeur

1. Aller sur https://developers.deezer.com/
2. Cliquer "Sign Up" ou "Login"
3. Créer un compte (gratuit)

### 1.2 Créer une Application

1. Aller dans "My Apps"
2. Cliquer "Create new Application"
3. Remplir les informations:
   - **Application Name:** Track Roulette
   - **Application Description:** Blind test social avec votre musique
   - **Application Domain:** trackroulette.app (ou votre domaine)
   - **Redirect URL:** 
     - `trackroulette://callback/deezer` (pour mobile)
     - `exp://localhost:8081/--/callback/deezer` (pour dev Expo)

4. Valider et obtenir:
   - **App ID** (ex: 123456)
   - **Secret Key** (ex: abc123def456...)

### 1.3 Configuration des Permissions

Permissions nécessaires:
- ✅ `basic_access` - Infos de base
- ✅ `email` - Email utilisateur
- ✅ `offline_access` - Token permanent
- ✅ `manage_library` - Accès favoris
- ✅ `listening_history` - Historique

---

## 🔧 Étape 2: Configuration du Projet

### 2.1 Ajouter les credentials Deezer

**Fichier: `config.ts`**

```typescript
// Ajouter après SPOTIFY_CONFIG
export const DEEZER_CONFIG = {
  APP_ID: '123456', // Remplacer par votre App ID
  SECRET_KEY: 'abc123def456...', // Remplacer par votre Secret
  REDIRECT_URI: 'trackroulette://callback/deezer',
  // Pour dev Expo
  REDIRECT_URI_DEV: 'exp://localhost:8081/--/callback/deezer',
};

// Permissions Deezer
export const DEEZER_PERMISSIONS = [
  'basic_access',
  'email',
  'offline_access',
  'manage_library',
  'listening_history'
].join(',');
```

### 2.2 Ajouter les endpoints Deezer

**Fichier: `config.ts`**

```typescript
export const DEEZER_ENDPOINTS = {
  AUTH: 'https://connect.deezer.com/oauth/auth.php',
  TOKEN: 'https://connect.deezer.com/oauth/access_token.php',
  USER: 'https://api.deezer.com/user/me',
  TRACKS: 'https://api.deezer.com/user/me/tracks',
  PLAYLISTS: 'https://api.deezer.com/user/me/playlists',
  HISTORY: 'https://api.deezer.com/user/me/history',
  FLOW: 'https://api.deezer.com/user/me/flow',
  CHART: 'https://api.deezer.com/chart',
};
```

---

## 🔨 Étape 3: Créer les Fichiers Nécessaires

### 3.1 Créer le Helper d'Authentification Deezer

**Fichier: `utils/deezerAuth.ts`** (NOUVEAU)

```typescript
import { makeRedirectUri } from 'expo-auth-session';
import { DEEZER_CONFIG, DEEZER_PERMISSIONS } from '../config';

/**
 * Génère l'URL d'authentification Deezer
 */
export const getDeezerAuthUrl = (): string => {
  const redirectUri = __DEV__ 
    ? DEEZER_CONFIG.REDIRECT_URI_DEV 
    : DEEZER_CONFIG.REDIRECT_URI;
  
  const params = new URLSearchParams({
    app_id: DEEZER_CONFIG.APP_ID,
    redirect_uri: redirectUri,
    perms: DEEZER_PERMISSIONS,
  });

  return `${DEEZER_CONFIG.AUTH}?${params.toString()}`;
};

/**
 * Échange le code d'autorisation contre un token
 */
export const exchangeDeezerCode = async (code: string): Promise<string | null> => {
  try {
    const params = new URLSearchParams({
      app_id: DEEZER_CONFIG.APP_ID,
      secret: DEEZER_CONFIG.SECRET_KEY,
      code: code,
      output: 'json',
    });

    const response = await fetch(
      `${DEEZER_CONFIG.TOKEN}?${params.toString()}`
    );

    if (!response.ok) {
      console.error('Erreur échange code Deezer:', response.status);
      return null;
    }

    const data = await response.json();
    
    if (data.access_token) {
      console.log('✅ Token Deezer obtenu');
      return data.access_token;
    }

    console.error('Pas de token dans la réponse Deezer');
    return null;
  } catch (error) {
    console.error('Erreur exchangeDeezerCode:', error);
    return null;
  }
};
```

### 3.2 Créer le Service Deezer

**Fichier: `services/DeezerService.ts`** (NOUVEAU)

```typescript
import { DEEZER_ENDPOINTS } from '../config';

export interface DeezerUser {
  id: string;
  name: string;
  email?: string;
  picture?: string;
  country?: string;
}

export interface DeezerTrack {
  id: string;
  title: string;
  artist: {
    id: string;
    name: string;
  };
  album: {
    id: string;
    title: string;
    cover_medium?: string;
  };
  preview?: string;
  duration: number;
}

class DeezerService {
  private static instance: DeezerService;

  private constructor() {}

  public static getInstance(): DeezerService {
    if (!DeezerService.instance) {
      DeezerService.instance = new DeezerService();
    }
    return DeezerService.instance;
  }

  /**
   * Récupère le profil utilisateur Deezer
   */
  public async getUserProfile(accessToken: string): Promise<DeezerUser | null> {
    try {
      const response = await fetch(
        `${DEEZER_ENDPOINTS.USER}?access_token=${accessToken}`
      );

      if (!response.ok) {
        console.error('Erreur API Deezer profile:', response.status);
        return null;
      }

      const data = await response.json();
      
      return {
        id: data.id.toString(),
        name: data.name || 'Utilisateur Deezer',
        email: data.email,
        picture: data.picture_medium,
        country: data.country,
      };
    } catch (error) {
      console.error('Erreur getUserProfile Deezer:', error);
      return null;
    }
  }

  /**
   * Récupère les tracks favoris de l'utilisateur
   */
  public async getFavoriteTracks(
    accessToken: string,
    limit: number = 50
  ): Promise<DeezerTrack[]> {
    try {
      const response = await fetch(
        `${DEEZER_ENDPOINTS.TRACKS}?access_token=${accessToken}&limit=${limit}`
      );

      if (!response.ok) {
        console.error('Erreur API Deezer tracks:', response.status);
        return [];
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Erreur getFavoriteTracks:', error);
      return [];
    }
  }

  /**
   * Récupère l'historique d'écoute (similaire à recently played)
   */
  public async getListeningHistory(
    accessToken: string,
    limit: number = 50
  ): Promise<DeezerTrack[]> {
    try {
      const response = await fetch(
        `${DEEZER_ENDPOINTS.HISTORY}?access_token=${accessToken}&limit=${limit}`
      );

      if (!response.ok) {
        console.error('Erreur API Deezer history:', response.status);
        return [];
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Erreur getListeningHistory:', error);
      return [];
    }
  }

  /**
   * Récupère les playlists de l'utilisateur
   */
  public async getUserPlaylists(
    accessToken: string
  ): Promise<any[]> {
    try {
      const response = await fetch(
        `${DEEZER_ENDPOINTS.PLAYLISTS}?access_token=${accessToken}`
      );

      if (!response.ok) {
        console.error('Erreur API Deezer playlists:', response.status);
        return [];
      }

      const data = await response.json();
      return data.data || [];
    } catch (error) {
      console.error('Erreur getUserPlaylists:', error);
      return [];
    }
  }

  /**
   * Convertit un DeezerTrack en format SpotifyTrack pour compatibilité
   */
  public convertToSpotifyFormat(track: DeezerTrack): any {
    return {
      id: `deezer_${track.id}`,
      name: track.title,
      artists: [{ name: track.artist.name }],
      album: {
        name: track.album.title,
        images: track.album.cover_medium ? [{ url: track.album.cover_medium }] : [],
      },
      preview_url: track.preview,
      duration_ms: track.duration * 1000,
    };
  }
}

export default DeezerService.getInstance();
```

---

## 🎨 Étape 4: Modifier l'Interface Utilisateur

### 4.1 Modifier AuthContext pour supporter Deezer

**Fichier: `contexts/AuthContext.tsx`**

```typescript
// Ajouter un type pour la plateforme
export type MusicPlatform = 'spotify' | 'deezer';

interface AuthContextType {
  accessToken: string | null;
  platform: MusicPlatform | null; // NOUVEAU
  setAccessToken: (token: string | null) => void;
  setPlatform: (platform: MusicPlatform | null) => void; // NOUVEAU
  logout: () => void;
  isLoading: boolean;
}

// Dans le Provider
const [platform, setPlatform] = useState<MusicPlatform | null>(null);

// Sauvegarder aussi la plateforme
useEffect(() => {
  const loadToken = async () => {
    const token = await SecureStore.getItemAsync('accessToken');
    const savedPlatform = await SecureStore.getItemAsync('platform');
    setAccessToken(token);
    setPlatform((savedPlatform as MusicPlatform) || null);
    setIsLoading(false);
  };
  loadToken();
}, []);

// Sauvegarder la plateforme avec le token
const handleSetAccessToken = async (token: string | null) => {
  setAccessToken(token);
  if (token) {
    await SecureStore.setItemAsync('accessToken', token);
  } else {
    await SecureStore.deleteItemAsync('accessToken');
  }
};

const handleSetPlatform = async (newPlatform: MusicPlatform | null) => {
  setPlatform(newPlatform);
  if (newPlatform) {
    await SecureStore.setItemAsync('platform', newPlatform);
  } else {
    await SecureStore.deleteItemAsync('platform');
  }
};

// Logout
const logout = async () => {
  await SecureStore.deleteItemAsync('accessToken');
  await SecureStore.deleteItemAsync('platform');
  setAccessToken(null);
  setPlatform(null);
};

// Fournir dans le context
<AuthContext.Provider value={{ 
  accessToken, 
  platform,
  setAccessToken: handleSetAccessToken,
  setPlatform: handleSetPlatform,
  logout, 
  isLoading 
}}>
```

### 4.2 Modifier WelcomeScreen pour ajouter Deezer

**Fichier: `screens/WelcomeScreen.tsx`**

```typescript
import { getDeezerAuthUrl, exchangeDeezerCode } from '../utils/deezerAuth';
import DeezerService from '../services/DeezerService';

// Dans le composant
const { setAccessToken, setPlatform } = useAuth();
const [authenticatingPlatform, setAuthenticatingPlatform] = useState<'spotify' | 'deezer' | null>(null);

// Fonction pour Deezer
const handleDeezerLogin = async () => {
  try {
    Logger.auth.login('Deezer');
    setAuthenticatingPlatform('deezer');
    
    const authUrl = getDeezerAuthUrl();
    
    // Ouvrir le navigateur pour auth
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      __DEV__ ? DEEZER_CONFIG.REDIRECT_URI_DEV : DEEZER_CONFIG.REDIRECT_URI
    );

    if (result.type === 'success' && result.url) {
      // Extraire le code de l'URL de callback
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      
      if (code) {
        Logger.info('Code Deezer reçu, échange en cours...');
        
        // Échanger le code contre un token
        const token = await exchangeDeezerCode(code);
        
        if (token) {
          Logger.auth.success('Token Deezer obtenu');
          setAccessToken(token);
          setPlatform('deezer');
          showToast('Connexion Deezer réussie !', 'success', 2000);
          
          setTimeout(() => {
            Logger.nav('Lobby');
            navigation.replace('Lobby', {});
          }, 500);
        } else {
          throw new Error('Impossible d\'obtenir le token');
        }
      }
    } else if (result.type === 'cancel') {
      Logger.warn('Authentification Deezer annulée');
      showToast('Connexion annulée', 'error', 2000);
    }
  } catch (error) {
    Logger.auth.error('Erreur Deezer', error);
    showToast('Erreur de connexion Deezer', 'error', 3000);
  } finally {
    setAuthenticatingPlatform(null);
  }
};

// Dans le JSX - Ajouter le bouton Deezer
<View style={styles.footer}>
  {/* Bouton Spotify */}
  <TouchableOpacity
    style={[styles.loginButton, { backgroundColor: '#1DB954' }]}
    disabled={authenticatingPlatform !== null}
    activeOpacity={0.8}
    onPress={() => promptAsync()}
  >
    {authenticatingPlatform === 'spotify' ? (
      <>
        <ActivityIndicator color="white" size="small" />
        <Text style={styles.loginButtonText}>CONNEXION...</Text>
      </>
    ) : (
      <>
        <Ionicons name="musical-notes" size={24} color="white" />
        <Text style={styles.loginButtonText}>SPOTIFY</Text>
      </>
    )}
  </TouchableOpacity>

  {/* Bouton Deezer - NOUVEAU */}
  <TouchableOpacity
    style={[styles.loginButton, { backgroundColor: '#FF0092', marginTop: 12 }]}
    disabled={authenticatingPlatform !== null}
    activeOpacity={0.8}
    onPress={handleDeezerLogin}
  >
    {authenticatingPlatform === 'deezer' ? (
      <>
        <ActivityIndicator color="white" size="small" />
        <Text style={styles.loginButtonText}>CONNEXION...</Text>
      </>
    ) : (
      <>
        <Ionicons name="musical-note" size={24} color="white" />
        <Text style={styles.loginButtonText}>DEEZER</Text>
      </>
    )}
  </TouchableOpacity>

  <Text style={styles.version}>Version 1.0</Text>
</View>
```

---

## 🔄 Étape 5: Adapter le MusicService

### 5.1 Modifier MusicService pour supporter Deezer

**Fichier: `services/MusicService.ts`**

```typescript
import DeezerService from './DeezerService';

// Modifier fetchTracksByCategory pour accepter platform
public async fetchTracksByCategory(options: FetchTracksOptions & { platform?: MusicPlatform }): Promise<SpotifyTrack[]> {
  const { accessToken, category, limit = 100, platform = 'spotify' } = options;

  if (platform === 'deezer') {
    return await this.fetchDeezerTracks(accessToken, category, limit);
  }

  // Code Spotify existant...
}

// Nouvelle méthode pour Deezer
private async fetchDeezerTracks(
  accessToken: string,
  category: string,
  limit: number
): Promise<SpotifyTrack[]> {
  console.log(`🎵 Récupération des tracks Deezer pour: ${category}`);

  try {
    let deezerTracks: DeezerTrack[] = [];

    switch (category) {
      case 'LIKED_SHUFFLE':
      case 'TOP_RECENT':
        // Récupérer les favoris
        deezerTracks = await DeezerService.getFavoriteTracks(accessToken, limit);
        break;

      case 'TOP_5Y':
      case '5_ANS_PLUS':
        // Récupérer l'historique (plus ancien)
        deezerTracks = await DeezerService.getListeningHistory(accessToken, limit);
        break;

      case 'GUILTY_PLEASURES':
        // Mix favoris + playlists
        const favorites = await DeezerService.getFavoriteTracks(accessToken, 25);
        const history = await DeezerService.getListeningHistory(accessToken, 25);
        deezerTracks = [...favorites, ...history];
        break;

      default:
        deezerTracks = await DeezerService.getFavoriteTracks(accessToken, limit);
    }

    // Convertir en format Spotify pour compatibilité
    const convertedTracks = deezerTracks.map(track => 
      DeezerService.convertToSpotifyFormat(track)
    );

    console.log(`✅ ${convertedTracks.length} tracks Deezer récupérés`);
    return convertedTracks;

  } catch (error) {
    console.error('❌ Erreur fetchDeezerTracks:', error);
    return [];
  }
}
```

---

## 🎮 Étape 6: Adapter le GameScreen

**Fichier: `screens/GameScreen.tsx`**

```typescript
const { accessToken, platform } = useAuth();

// Dans fetchTracksByCategory
const tracks = await MusicService.fetchTracksByCategory({
  accessToken: accessToken || '',
  category: category || 'TOP_RECENT',
  excludedTrackIds: playedTracks,
  limit: 100,
  platform: platform || 'spotify', // AJOUTER
});
```

---

## 🎨 Étape 7: Adapter le LobbyScreen

**Fichier: `screens/LobbyScreen.tsx`**

```typescript
const { accessToken, platform } = useAuth();

// Charger le profil selon la plateforme
useEffect(() => {
  const loadUserProfile = async () => {
    if (!accessToken) {
      setIsLoadingProfile(false);
      return;
    }

    Logger.info(`Chargement du profil ${platform || 'Spotify'}...`);
    setIsLoadingProfile(true);
    
    if (platform === 'deezer') {
      // Charger profil Deezer
      const user = await DeezerService.getUserProfile(accessToken);
      
      if (user) {
        Logger.success(`Profil Deezer chargé: ${user.name}`);
        setPlayers(prevPlayers => 
          prevPlayers.map((player, index) => 
            index === 0 
              ? { ...player, name: user.name, image: user.picture }
              : player
          )
        );
        showToast(`Bienvenue ${user.name} !`, 'success', 2500);
      } else {
        Logger.error('Erreur chargement profil Deezer');
        showToast('Impossible de charger votre profil Deezer', 'error', 3000);
      }
    } else {
      // Code Spotify existant...
      const result = await UserService.fetchUserProfile(accessToken);
      // ...
    }
    
    setIsLoadingProfile(false);
  };

  loadUserProfile();
}, [accessToken, platform]);
```

---

## ✅ Résumé des Fichiers à Créer/Modifier

### Nouveaux Fichiers (3)

1. ✨ `utils/deezerAuth.ts` - Authentification OAuth
2. ✨ `services/DeezerService.ts` - Service API Deezer
3. ✨ `DEEZER_AUTH_GUIDE.md` - Cette documentation

### Fichiers à Modifier (5)

1. ✏️ `config.ts` - Ajouter config et endpoints Deezer
2. ✏️ `contexts/AuthContext.tsx` - Ajouter support plateforme
3. ✏️ `screens/WelcomeScreen.tsx` - Ajouter bouton Deezer
4. ✏️ `screens/LobbyScreen.tsx` - Charger profil Deezer
5. ✏️ `screens/GameScreen.tsx` - Passer la plateforme
6. ✏️ `services/MusicService.ts` - Supporter tracks Deezer

### Dépendances Nécessaires

Déjà installées normalement :
- ✅ `expo-auth-session`
- ✅ `expo-web-browser`
- ✅ `expo-secure-store`

---

## 📅 Planning de Développement

### Phase 1: Setup (30 min)
- ✅ Inscription Deezer Developers
- ✅ Créer l'application
- ✅ Obtenir App ID et Secret
- ✅ Ajouter dans config.ts

### Phase 2: Auth (2h)
- ✅ Créer deezerAuth.ts
- ✅ Créer DeezerService.ts
- ✅ Modifier AuthContext
- ✅ Tester l'authentification

### Phase 3: UI (1h)
- ✅ Ajouter bouton Deezer sur WelcomeScreen
- ✅ Tester le flow d'auth
- ✅ Gérer les erreurs

### Phase 4: Intégration (2h)
- ✅ Modifier LobbyScreen
- ✅ Modifier GameScreen
- ✅ Modifier MusicService
- ✅ Tester avec tracks Deezer

### Phase 5: Tests (1h)
- ✅ Tester flow complet Deezer
- ✅ Tester flow complet Spotify
- ✅ Tester basculement entre les deux
- ✅ Corriger les bugs

**Total estimé: 6-7 heures de développement**

---

## 🎯 Prochaines Étapes

**Voulez-vous que je :**

1. ✨ **Créer tous les fichiers maintenant** - Je crée deezerAuth.ts, DeezerService.ts, etc.
2. 📝 **Commencer par la config** - On ajoute les configs Deezer d'abord
3. 🧪 **Faire un prototype simple** - Version minimale pour tester
4. 📚 **Plus de détails** - Expliquer une partie spécifique en détail

Que préférez-vous ? 😊

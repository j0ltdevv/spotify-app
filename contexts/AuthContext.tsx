import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, TOKEN_CONFIG } from '../constants';
import { isTokenExpired, calculateExpiryTime, validateToken } from '../utils/spotifyRefresh';
import { getAuth, onAuthStateChanged, User, signInWithCredential, signOut, OAuthProvider } from 'firebase/auth'; // Import Firebase Auth modules
import { app } from '../services/FirebaseService'; // Import the Firebase app

// 1. Définition des types pour le contexte
interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  isLoading: boolean;
  tokenExpiry: number | null;
  checkTokenValidity: () => Promise<boolean>;
  logout: () => Promise<void>;
  firebaseUser: User | null; // Add Firebase user to context type
  loginWithSpotifyFirebase: (accessToken: string) => Promise<void>; // New function for Firebase Spotify login
}

// 2. Création du contexte
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Initialize Firebase Auth
const auth = getAuth(app);

// 3. Fournisseur du contexte (le wrapper)
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null); // State for Firebase user

  // Load token on startup
  useEffect(() => {
    loadToken();
  }, []);

  // Listen for Firebase Auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        // If Firebase user logs out, also clear Spotify token state
        setAccessToken(null);
        setTokenExpiry(null);
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Check token validity periodically (every 5 minutes)
  useEffect(() => {
    if (accessToken && tokenExpiry) {
      const interval = setInterval(() => {
        if (isTokenExpired(tokenExpiry)) {
          console.log('⚠️ Token expiré détecté, déconnexion automatique');
          logout();
        }
      }, 5 * 60 * 1000); // Check every 5 minutes

      return () => clearInterval(interval);
    }
  }, [accessToken, tokenExpiry, logout]); // Add logout to dependency array

  const loadToken = async () => {
    try {
      console.log('🔑 Chargement du token sauvegardé...');
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.SPOTIFY_TOKEN);
      const savedExpiry = await AsyncStorage.getItem(STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY);

      if (savedToken && savedExpiry) {
        const expiryTime = parseInt(savedExpiry, 10);

        // Check if the token has not expired
        if (!isTokenExpired(expiryTime)) {
          // Double check with Spotify API
          const isValid = await validateToken(savedToken);
          
          if (isValid) {
            console.log('✅ Token valide trouvé, reconnexion automatique');
            setAccessToken(savedToken);
            setTokenExpiry(expiryTime);
          } else {
            console.log('⚠️ Token invalide côté API, nettoyage...');
            await AsyncStorage.multiRemove([STORAGE_KEYS.SPOTIFY_TOKEN, STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY]);
          }
        } else {
          console.log('⚠️ Token expiré, nettoyage...');
          await AsyncStorage.multiRemove([STORAGE_KEYS.SPOTIFY_TOKEN, STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY]);
        }
      } else {
        console.log('ℹ️ Aucun token sauvegardé');
      }
    } catch (error) {
      console.error('❌ Erreur lors du chargement du token:', error);
      // In case of error, clear the token
      await AsyncStorage.multiRemove([STORAGE_KEYS.SPOTIFY_TOKEN, STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY]);
    } finally {
      // setIsLoading(false); // Auth state listener will handle isLoading
    }
  };

  // Save the token
  const setToken = useCallback(async (token: string | null) => {
    setAccessToken(token);
    
    try {
      if (token) {
        // Spotify tokens expire after 1 hour, save the expiry
        const expiryTime = calculateExpiryTime();
        setTokenExpiry(expiryTime);
        await AsyncStorage.setItem(STORAGE_KEYS.SPOTIFY_TOKEN, token);
        await AsyncStorage.setItem(STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY, expiryTime.toString());
        console.log('✅ Token sauvegardé avec succès');
        console.log(`⏰ Expiration prévue: ${new Date(expiryTime).toLocaleString()}`);
      } else {
        // If disconnecting, remove the token
        await logout();
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du token:', error);
    }
  }, [logout]);

  // Firebase Spotify Login
  const loginWithSpotifyFirebase = useCallback(async (spotifyAccessToken: string) => {
    try {
      setIsLoading(true);
      const provider = new OAuthProvider('spotify.com');
      const credential = provider.credential({
        accessToken: spotifyAccessToken,
      });
      await signInWithCredential(auth, credential);
      console.log('✅ Authentifié avec Spotify via Firebase!');
    } catch (error) {
      console.error('❌ Erreur authentification Spotify via Firebase:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check token validity
  const checkTokenValidity = useCallback(async (): Promise<boolean> => {
    if (!accessToken || !tokenExpiry) {
      return false;
    }

    // Check local expiry
    if (isTokenExpired(tokenExpiry)) {
      console.log('⚠️ Token expiré localement');
      await logout();
      return false;
    }

    // Check with API
    const isValid = await validateToken(accessToken);
    if (!isValid) {
      console.log('⚠️ Token invalide côté API');
      await logout();
      return false;
    }

    return true;
  }, [accessToken, tokenExpiry, logout]);

  // Clean logout
  const logout = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.SPOTIFY_TOKEN, 
        STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY,
        STORAGE_KEYS.GAME_STATE
      ]);
      await signOut(auth); // Sign out from Firebase
      setAccessToken(null);
      setTokenExpiry(null);
      setFirebaseUser(null);
      console.log('✅ Déconnexion réussie');
    } catch (error) {
      console.error('❌ Erreur lors de la déconnexion:', error);
    }
  }, []);

  const value: AuthContextType = {
    accessToken,
    setAccessToken: setToken,
    isLoading,
    tokenExpiry,
    checkTokenValidity,
    logout,
    firebaseUser, // Expose Firebase user
    loginWithSpotifyFirebase, // Expose new login function
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 4. Custom hook for easy use
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

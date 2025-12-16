import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, TOKEN_CONFIG } from '../constants';
import { isTokenExpired, calculateExpiryTime, validateToken } from '../utils/spotifyRefresh';

// 1. Définition des types pour le contexte
interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  isLoading: boolean;
  tokenExpiry: number | null;
  checkTokenValidity: () => Promise<boolean>;
  logout: () => Promise<void>;
}

// 2. Création du contexte
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Fournisseur du contexte (le wrapper)
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);

  // Charger le token au démarrage
  useEffect(() => {
    loadToken();
  }, []);

  // Vérifier périodiquement la validité du token (toutes les 5 minutes)
  useEffect(() => {
    if (accessToken && tokenExpiry) {
      const interval = setInterval(() => {
        if (isTokenExpired(tokenExpiry)) {
          console.log('⚠️ Token expiré détecté, déconnexion automatique');
          logout();
        }
      }, 5 * 60 * 1000); // Vérifier toutes les 5 minutes

      return () => clearInterval(interval);
    }
  }, [accessToken, tokenExpiry]);

  const loadToken = async () => {
    try {
      console.log('🔑 Chargement du token sauvegardé...');
      const savedToken = await AsyncStorage.getItem(STORAGE_KEYS.SPOTIFY_TOKEN);
      const savedExpiry = await AsyncStorage.getItem(STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY);

      if (savedToken && savedExpiry) {
        const expiryTime = parseInt(savedExpiry, 10);

        // Vérifier si le token n'a pas expiré
        if (!isTokenExpired(expiryTime)) {
          // Double vérification avec l'API Spotify
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
      // En cas d'erreur, nettoyer le token
      await AsyncStorage.multiRemove([STORAGE_KEYS.SPOTIFY_TOKEN, STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY]);
    } finally {
      setIsLoading(false);
    }
  };

  // Sauvegarder le token
  const setToken = useCallback(async (token: string | null) => {
    setAccessToken(token);
    
    try {
      if (token) {
        // Spotify tokens expirent après 1 heure, on sauvegarde l'expiration
        const expiryTime = calculateExpiryTime();
        setTokenExpiry(expiryTime);
        await AsyncStorage.setItem(STORAGE_KEYS.SPOTIFY_TOKEN, token);
        await AsyncStorage.setItem(STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY, expiryTime.toString());
        console.log('✅ Token sauvegardé avec succès');
        console.log(`⏰ Expiration prévue: ${new Date(expiryTime).toLocaleString()}`);
      } else {
        // Si on déconnecte, supprimer le token
        await logout();
      }
    } catch (error) {
      console.error('❌ Erreur lors de la sauvegarde du token:', error);
    }
  }, []);

  // Vérifier la validité du token
  const checkTokenValidity = useCallback(async (): Promise<boolean> => {
    if (!accessToken || !tokenExpiry) {
      return false;
    }

    // Vérifier l'expiration locale
    if (isTokenExpired(tokenExpiry)) {
      console.log('⚠️ Token expiré localement');
      await logout();
      return false;
    }

    // Vérifier avec l'API
    const isValid = await validateToken(accessToken);
    if (!isValid) {
      console.log('⚠️ Token invalide côté API');
      await logout();
      return false;
    }

    return true;
  }, [accessToken, tokenExpiry]);

  // Déconnexion propre
  const logout = useCallback(async () => {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.SPOTIFY_TOKEN, 
        STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY,
        STORAGE_KEYS.GAME_STATE
      ]);
      setAccessToken(null);
      setTokenExpiry(null);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// 4. Hook personnalisé pour une utilisation facile
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth doit être utilisé dans un AuthProvider');
  }
  return context;
};

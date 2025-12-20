import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, TOKEN_CONFIG } from '../constants';
import { isTokenExpired, calculateExpiryTime, validateToken } from '../utils/spotifyRefresh';
import { onAuthStateChanged, User, signInAnonymously, signOut, updateProfile, deleteUser } from 'firebase/auth'; 
import { doc, deleteDoc } from 'firebase/firestore';
import { app, auth, db } from '../services/FirebaseService'; 
import UserService from '../services/UserService'; 

// 1. Définition des types pour le contexte
interface AuthContextType {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  isLoading: boolean;
  tokenExpiry: number | null;
  checkTokenValidity: () => Promise<boolean>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>; // New function
  firebaseUser: User | null; 
  loginWithSpotifyFirebase: (accessToken: string) => Promise<void>; 
}

// 2. Création du contexte
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 3. Fournisseur du contexte (le wrapper)
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tokenExpiry, setTokenExpiry] = useState<number | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null); 

  // Load token on startup
  useEffect(() => {
    loadToken();
  }, []);

  // Sync Profile if missing (Self-healing for existing users)
  useEffect(() => {
    const syncProfile = async () => {
      if (accessToken && firebaseUser && (!firebaseUser.displayName || !firebaseUser.photoURL)) {
         console.log('🔄 Synchronisation du profil manquant...');
         const profileResult = await UserService.fetchUserProfile(accessToken, firebaseUser.uid);
         if (profileResult.success && profileResult.user) {
            await updateProfile(firebaseUser, {
                displayName: profileResult.user.display_name,
                photoURL: profileResult.user.images?.[0]?.url
            });
            // Force update local state
            setFirebaseUser({ ...firebaseUser, displayName: profileResult.user.display_name, photoURL: profileResult.user.images?.[0]?.url || null });
         }
      }
    };
    syncProfile();
  }, [accessToken, firebaseUser]); 

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
  }, [accessToken, tokenExpiry]); 

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

  // Firebase Spotify Login (Via Anonymous Auth for free tier support)
  const loginWithSpotifyFirebase = useCallback(async (spotifyAccessToken: string) => {
    try {
      setIsLoading(true);
      const userCredential = await signInAnonymously(auth);
      console.log('✅ Authentifié anonymement sur Firebase (Plan Gratuit)');

      // Fetch Spotify Profile
      const profileResult = await UserService.fetchUserProfile(spotifyAccessToken, userCredential.user.uid);
      
      if (profileResult.success && profileResult.user) {
          // Update Firebase User Profile
          await updateProfile(userCredential.user, {
              displayName: profileResult.user.display_name,
              photoURL: profileResult.user.images?.[0]?.url
          });
          
          // Force update local state to reflect changes immediately
          setFirebaseUser({ ...userCredential.user, displayName: profileResult.user.display_name, photoURL: profileResult.user.images?.[0]?.url || null });
          console.log('✅ Profil Firebase mis à jour avec infos Spotify');
      }

    } catch (error) {
      console.error('❌ Erreur authentification Firebase:', error);
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

  // Delete Account
  const deleteAccount = useCallback(async () => {
    if (!firebaseUser) return;
    try {
      setIsLoading(true);
      const uid = firebaseUser.uid;

      console.log(`🗑️ Suppression du compte ${uid}...`);

      // 1. Delete Firestore User Data
      try {
        await deleteDoc(doc(db, 'users', uid));
        console.log('   ✅ Données utilisateur supprimées');
      } catch (e) {
        console.warn('   ⚠️ Erreur suppression données users (peut être déjà vide)', e);
      }
      
      // 2. Delete Active Game (if host)
      try {
        await deleteDoc(doc(db, 'games', uid));
        console.log('   ✅ Partie active supprimée');
      } catch (e) {
        console.warn('   ⚠️ Pas de partie active à supprimer', e);
      }

      // 3. Local Cleanup
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.SPOTIFY_TOKEN, 
        STORAGE_KEYS.SPOTIFY_TOKEN_EXPIRY,
        STORAGE_KEYS.GAME_STATE
      ]);

      // 4. Delete Firebase Auth User
      await deleteUser(firebaseUser);
      console.log('   ✅ Utilisateur Auth supprimé');
      
      setAccessToken(null);
      setTokenExpiry(null);
      setFirebaseUser(null);
      
    } catch (error) {
      console.error('❌ Erreur critique lors de la suppression du compte:', error);
      // Force logout anyway
      await logout();
      throw error; 
    } finally {
      setIsLoading(false);
    }
  }, [firebaseUser, logout]);

  const value: AuthContextType = {
    accessToken,
    setAccessToken: setToken,
    isLoading,
    tokenExpiry,
    checkTokenValidity,
    logout,
    deleteAccount, // Add to context value
    firebaseUser, 
    loginWithSpotifyFirebase, 
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

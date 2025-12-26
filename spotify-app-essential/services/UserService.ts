/**
 * UserService.ts
 * Service centralisé pour les opérations utilisateur (profil Spotify)
 * Objectif : Séparer la logique métier de l'affichage
 */

import { API_ENDPOINTS } from '../config';
import { SpotifyUser } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore'; // Import Firestore modules
import { db } from './FirebaseService'; // Import the Firebase app


/**
 * Interface for user profile stored in Firestore
 */
interface FirestoreUserProfile extends SpotifyUser {
  lastUpdated: number;
}

/**
 * Résultat de la récupération du profil
 */
export interface UserProfileResult {
  user: SpotifyUser | null;
  success: boolean;
  error?: string;
}



/**
 * Service de gestion des utilisateurs
 */
class UserService {
  private static instance: UserService;
  private cachedUser: SpotifyUser | null = null;
  private cacheTimestamp: number = 0; // Local cache timestamp
  private readonly LOCAL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for local cache
  private readonly FIRESTORE_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for Firestore cache

  /**
   * Singleton pattern
   */
  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Récupère le profil utilisateur Spotify avec cache
   */
  public async fetchUserProfile(accessToken: string, firebaseUid: string | undefined, forceRefresh: boolean = false): Promise<UserProfileResult> {
    const userDocRef = firebaseUid ? doc(db, 'users', firebaseUid) : null;

    try {
      // 1. Try to get from local cache
      if (!forceRefresh && this.isLocalCacheValid()) {
        console.log('✅ Profil utilisateur récupéré depuis le cache local');
        return { user: this.cachedUser, success: true };
      }

      // 2. Try to get from Firestore
      if (userDocRef && !forceRefresh) {
        const docSnap = await getDoc(userDocRef);
        if (docSnap.exists()) {
          const firestoreUser = docSnap.data() as FirestoreUserProfile;
          if (this.isFirestoreCacheValid(firestoreUser.lastUpdated)) {
            console.log('✅ Profil utilisateur récupéré depuis Firestore');
            this.updateLocalCache(firestoreUser); // Update local cache from Firestore
            return { user: firestoreUser, success: true };
          } else {
            console.log('⏳ Profil Firestore expiré, rafraîchissement nécessaire.');
          }
        }
      }

      // 3. Fetch from Spotify API
      console.log('🔍 Récupération du profil utilisateur depuis Spotify API...');

      const response = await fetch(API_ENDPOINTS.SPOTIFY_USER, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const userData: SpotifyUser = await response.json();
      
      const userProfileToSave: FirestoreUserProfile = {
        ...userData,
        lastUpdated: Date.now(),
      };

      // 4. Save to Firestore
      if (userDocRef) {
        await setDoc(userDocRef, userProfileToSave, { merge: true });
        console.log('💾 Profil utilisateur sauvegardé sur Firestore.');
      }

      // 5. Update local cache
      this.updateLocalCache(userData);

      console.log('✅ Profil utilisateur récupéré et mis à jour:', userData.display_name);

      return {
        user: userData,
        success: true
      };

    } catch (error) {
      console.error('❌ Erreur fetchUserProfile:', error);
      return {
        user: null,
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  /**
   * Vérifie si le cache local est valide
   */
  private isLocalCacheValid(): boolean {
    if (!this.cachedUser) return false;
    const now = Date.now();
    return (now - this.cacheTimestamp) < this.LOCAL_CACHE_DURATION;
  }

  /**
   * Vérifie si le cache Firestore est valide
   */
  private isFirestoreCacheValid(lastUpdated: number): boolean {
    const now = Date.now();
    return (now - lastUpdated) < this.FIRESTORE_CACHE_DURATION;
  }

  /**
   * Met à jour le cache local
   */
  private updateLocalCache(user: SpotifyUser): void {
    this.cachedUser = user;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Vide le cache utilisateur local
   */
  public clearCache(): void {
    this.cachedUser = null;
    this.cacheTimestamp = 0;
    // Note: Clearing Firestore cache (deleting document) would require firebaseUid and explicit action
    console.log('🗑️ Cache utilisateur local vidé');
  }

  /**
   * Récupère le nom d'affichage de l'utilisateur
   */
  public getDisplayName(user: SpotifyUser | null): string {
    return user?.display_name || 'Utilisateur';
  }

  /**
   * Récupère l'image de profil de l'utilisateur
   */
  public getProfileImage(user: SpotifyUser | null): string | undefined {
    return user?.images?.[0]?.url;
  }

  /**
   * Vérifie si l'utilisateur a un compte Premium
   */
  public isPremium(user: SpotifyUser | null): boolean {
    return user?.product === 'premium';
  }

  /**
   * Met à jour manuellement le profil utilisateur (Firestore + Cache Local)
   */
  public async updateUserProfile(firebaseUid: string, updates: Partial<SpotifyUser>): Promise<void> {
    const userDocRef = doc(db, 'users', firebaseUid);
    
    try {
      const updatedData = {
        ...updates,
        lastUpdated: Date.now()
      };

      // Update Firestore
      await setDoc(userDocRef, updatedData, { merge: true });
      console.log('💾 Profil utilisateur mis à jour manuellement sur Firestore.');

      // Update local cache if exists
      if (this.cachedUser) {
        this.cachedUser = { ...this.cachedUser, ...updates };
        this.cacheTimestamp = Date.now();
      }
    } catch (error) {
       console.error("❌ Erreur updateUserProfile:", error);
       throw error;
    }
  }
}

export default UserService.getInstance();

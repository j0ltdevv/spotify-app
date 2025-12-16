/**
 * UserService.ts
 * Service centralisé pour les opérations utilisateur (profil Spotify)
 * Objectif : Séparer la logique métier de l'affichage
 */

import { API_ENDPOINTS } from '../config';
import { SpotifyUser } from '../types';

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
  private cacheTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

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
  public async fetchUserProfile(accessToken: string, forceRefresh: boolean = false): Promise<UserProfileResult> {
    try {
      // Vérifier le cache (sauf si forceRefresh)
      if (!forceRefresh && this.isCacheValid()) {
        console.log('✅ Profil utilisateur récupéré depuis le cache');
        return {
          user: this.cachedUser,
          success: true
        };
      }

      console.log('🔍 Récupération du profil utilisateur depuis Spotify...');

      const response = await fetch(API_ENDPOINTS.SPOTIFY_USER, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Spotify API error: ${response.status}`);
      }

      const userData: SpotifyUser = await response.json();
      
      // Mise à jour du cache
      this.cachedUser = userData;
      this.cacheTimestamp = Date.now();

      console.log('✅ Profil utilisateur récupéré:', userData.display_name);

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
   * Vérifie si le cache est valide
   */
  private isCacheValid(): boolean {
    if (!this.cachedUser) return false;
    const now = Date.now();
    return (now - this.cacheTimestamp) < this.CACHE_DURATION;
  }

  /**
   * Vide le cache utilisateur
   */
  public clearCache(): void {
    this.cachedUser = null;
    this.cacheTimestamp = 0;
    console.log('🗑️ Cache utilisateur vidé');
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
}

export default UserService.getInstance();

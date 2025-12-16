/**
 * BackendService.ts
 * Service centralisé pour les appels au backend API
 * Remplace progressivement les appels directs Spotify/iTunes/Deezer
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants';

// Configuration backend
const BACKEND_CONFIG = {
  API_URL: __DEV__ 
    ? 'http://localhost:3000/api'  // Dev local
    : 'https://your-app.railway.app/api', // Production
  TIMEOUT: 10000, // 10 secondes
};

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Service Backend - Centralise tous les appels API
 */
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

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), BACKEND_CONFIG.TIMEOUT);

      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

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
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          console.error('❌ Request timeout');
          return {
            success: false,
            error: 'Request timeout',
          };
        }
        console.error('❌ Backend API Error:', error.message);
        return {
          success: false,
          error: error.message,
        };
      }
      return {
        success: false,
        error: 'Unknown error',
      };
    }
  }

  // ========================================
  // AUTHENTICATION
  // ========================================

  /**
   * Authentification Spotify via le backend
   */
  public async loginWithSpotify(spotifyCode: string): Promise<ApiResponse<{
    jwt: string;
    user: any;
  }>> {
    return this.fetchAPI('/auth/callback', {
      method: 'POST',
      body: JSON.stringify({ code: spotifyCode }),
    });
  }

  /**
   * Refresh du JWT token
   */
  public async refreshToken(): Promise<boolean> {
    try {
      const response = await this.fetchAPI<{ jwt: string }>('/auth/refresh', {
        method: 'POST',
      });

      if (response.success && response.data?.jwt) {
        await AsyncStorage.setItem(STORAGE_KEYS.JWT_TOKEN, response.data.jwt);
        console.log('✅ JWT refreshed');
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Erreur refresh token:', error);
      return false;
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
      console.log('✅ Logged out');
    } catch (error) {
      console.error('❌ Erreur logout:', error);
    }
  }

  // ========================================
  // USER
  // ========================================

  /**
   * Récupère le profil utilisateur
   */
  public async getUserProfile(): Promise<ApiResponse<any>> {
    return this.fetchAPI('/user/profile');
  }

  /**
   * Récupère les statistiques utilisateur
   */
  public async getUserStats(): Promise<ApiResponse<any>> {
    return this.fetchAPI('/user/stats');
  }

  // ========================================
  // MUSIC
  // ========================================

  /**
   * Récupère les top tracks via le backend
   */
  public async getTopTracks(params: {
    timeRange?: 'short_term' | 'medium_term' | 'long_term';
    limit?: number;
  }): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams({
      timeRange: params.timeRange || 'medium_term',
      limit: String(params.limit || 50),
    }).toString();
    
    return this.fetchAPI(`/music/top-tracks?${queryParams}`);
  }

  /**
   * Récupère les morceaux récents
   */
  public async getRecentTracks(limit: number = 50): Promise<ApiResponse<any[]>> {
    return this.fetchAPI(`/music/recent?limit=${limit}`);
  }

  /**
   * Recherche de morceaux
   */
  public async searchTracks(query: string, limit: number = 10): Promise<ApiResponse<any[]>> {
    const queryParams = new URLSearchParams({ q: query, limit: String(limit) }).toString();
    return this.fetchAPI(`/music/search?${queryParams}`);
  }

  // ========================================
  // GAME
  // ========================================

  /**
   * Récupère l'historique des parties
   */
  public async getGameHistory(page: number = 1, limit: number = 10): Promise<ApiResponse<any>> {
    return this.fetchAPI(`/game/history?page=${page}&limit=${limit}`);
  }

  /**
   * Récupère les détails d'une partie
   */
  public async getGameDetails(roomId: string): Promise<ApiResponse<any>> {
    return this.fetchAPI(`/game/${roomId}`);
  }

  /**
   * Termine une partie et met à jour les stats
   */
  public async finishGame(data: {
    roomId: string;
    scores: Record<string, number>;
    winner?: string;
  }): Promise<ApiResponse<any>> {
    return this.fetchAPI('/game/finish', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ========================================
  // ANALYTICS
  // ========================================

  /**
   * Récupère le leaderboard global
   */
  public async getLeaderboard(limit: number = 10): Promise<ApiResponse<any[]>> {
    return this.fetchAPI(`/analytics/leaderboard?limit=${limit}`);
  }

  /**
   * Récupère les statistiques globales
   */
  public async getGlobalStats(): Promise<ApiResponse<any>> {
    return this.fetchAPI('/analytics/stats');
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

  // ========================================
  // HEALTH CHECK
  // ========================================

  /**
   * Vérifie si le backend est accessible
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`, {
        method: 'GET',
      });
      return response.ok;
    } catch (error) {
      console.error('❌ Backend unreachable:', error);
      return false;
    }
  }
}

export default BackendService.getInstance();

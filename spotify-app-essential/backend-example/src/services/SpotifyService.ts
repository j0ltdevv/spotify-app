/**
 * Spotify Service - Handle all Spotify API calls
 */

import axios, { AxiosInstance } from 'axios';
import { cacheGet, cacheSet } from '../config/redis';
import User from '../models/User';

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: Array<{ id: string; name: string }>;
  album: {
    id: string;
    name: string;
    images: Array<{ url: string; height: number; width: number }>;
  };
  preview_url: string | null;
  duration_ms: number;
}

class SpotifyService {
  private static instance: SpotifyService;
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private axiosInstance: AxiosInstance;

  private constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID || '';
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '';
    this.redirectUri = process.env.SPOTIFY_REDIRECT_URI || '';

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Spotify credentials missing in environment variables');
    }

    this.axiosInstance = axios.create({
      baseURL: 'https://api.spotify.com/v1',
      timeout: 10000,
    });
  }

  public static getInstance(): SpotifyService {
    if (!SpotifyService.instance) {
      SpotifyService.instance = new SpotifyService();
    }
    return SpotifyService.instance;
  }

  /**
   * Exchange authorization code for tokens
   */
  public async exchangeCodeForTokens(code: string): Promise<SpotifyTokenResponse> {
    try {
      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<SpotifyTokenResponse>(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: this.redirectUri,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`,
          },
        }
      );

      console.log('✅ Tokens exchanged successfully');
      return response.data;

    } catch (error) {
      console.error('❌ Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<SpotifyTokenResponse>(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`,
          },
        }
      );

      console.log('✅ Access token refreshed');
      return response.data.access_token;

    } catch (error) {
      console.error('❌ Error refreshing access token:', error);
      throw new Error('Failed to refresh access token');
    }
  }

  /**
   * Get fresh access token for user (auto-refresh if needed)
   */
  public async getFreshAccessToken(userId: string): Promise<string> {
    try {
      // Check cache first (valid for 50 minutes)
      const cacheKey = `spotify_token:${userId}`;
      const cachedToken = await cacheGet(cacheKey);

      if (cachedToken) {
        console.log('✅ Access token from cache');
        return cachedToken;
      }

      // Get user with refresh token
      const user = await User.findById(userId).select('+refreshToken');
      if (!user || !user.refreshToken) {
        throw new Error('User not found or missing refresh token');
      }

      // Refresh the access token
      const newAccessToken = await this.refreshAccessToken(user.refreshToken);

      // Cache for 50 minutes (expires in 60)
      await cacheSet(cacheKey, newAccessToken, 50 * 60);

      return newAccessToken;

    } catch (error) {
      console.error('❌ Error getting fresh access token:', error);
      throw error;
    }
  }

  /**
   * Get user profile from Spotify
   */
  public async getUserProfile(accessToken: string): Promise<any> {
    try {
      const response = await this.axiosInstance.get('/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return response.data;
    } catch (error) {
      console.error('❌ Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }

  /**
   * Get user's top tracks
   */
  public async getTopTracks(
    userId: string,
    timeRange: 'short_term' | 'medium_term' | 'long_term' = 'medium_term',
    limit: number = 50
  ): Promise<SpotifyTrack[]> {
    try {
      const accessToken = await this.getFreshAccessToken(userId);

      const response = await this.axiosInstance.get<{ items: SpotifyTrack[] }>(
        '/me/top/tracks',
        {
          params: { time_range: timeRange, limit },
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      console.log(`✅ Fetched ${response.data.items.length} top tracks`);
      return response.data.items;

    } catch (error) {
      console.error('❌ Error fetching top tracks:', error);
      throw new Error('Failed to fetch top tracks');
    }
  }

  /**
   * Get user's recently played tracks
   */
  public async getRecentlyPlayed(userId: string, limit: number = 50): Promise<SpotifyTrack[]> {
    try {
      const accessToken = await this.getFreshAccessToken(userId);

      const response = await this.axiosInstance.get<{
        items: Array<{ track: SpotifyTrack; played_at: string }>;
      }>('/me/player/recently-played', {
        params: { limit },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const tracks = response.data.items.map((item) => item.track);
      console.log(`✅ Fetched ${tracks.length} recently played tracks`);
      return tracks;

    } catch (error) {
      console.error('❌ Error fetching recently played:', error);
      throw new Error('Failed to fetch recently played tracks');
    }
  }

  /**
   * Search tracks
   */
  public async searchTracks(query: string, limit: number = 10): Promise<SpotifyTrack[]> {
    try {
      // For search, we can use client credentials flow (no user context)
      const accessToken = await this.getClientCredentialsToken();

      const response = await this.axiosInstance.get<{ tracks: { items: SpotifyTrack[] } }>(
        '/search',
        {
          params: { q: query, type: 'track', limit },
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      return response.data.tracks.items;

    } catch (error) {
      console.error('❌ Error searching tracks:', error);
      throw new Error('Failed to search tracks');
    }
  }

  /**
   * Get client credentials token (for public API calls)
   */
  private async getClientCredentialsToken(): Promise<string> {
    try {
      const cacheKey = 'spotify_client_token';
      const cachedToken = await cacheGet(cacheKey);

      if (cachedToken) {
        return cachedToken;
      }

      const authHeader = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

      const response = await axios.post<SpotifyTokenResponse>(
        'https://accounts.spotify.com/api/token',
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`,
          },
        }
      );

      await cacheSet(cacheKey, response.data.access_token, 50 * 60);
      return response.data.access_token;

    } catch (error) {
      console.error('❌ Error getting client credentials token:', error);
      throw new Error('Failed to get client credentials token');
    }
  }
}

export default SpotifyService.getInstance();

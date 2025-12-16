import { API_ENDPOINTS } from '../config';
import { SpotifyTopTracksResponse, SpotifyTrack, SpotifyRecentlyPlayedResponse, TimeRange } from '../types';

/**
 * Récupère les top tracks de l'utilisateur depuis Spotify
 */
export const fetchSpotifyTopTracks = async (
  accessToken: string,
  timeRange: TimeRange,
  limit: number = 50
): Promise<SpotifyTrack[]> => {
  try {
    // Augmenter la limite pour avoir plus de diversité (max 50 par appel Spotify)
    const response = await fetch(
      `${API_ENDPOINTS.SPOTIFY_TOP_TRACKS}?time_range=${timeRange}&limit=${Math.min(limit, 50)}&offset=0`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    if (!response.ok) {
      throw new Error(`Spotify API error: ${response.status}`);
    }
    
    const data: SpotifyTopTracksResponse = await response.json();
    let allTracks = data.items || [];
    
    // Si on veut plus de 50 tracks, faire un 2e appel avec offset
    if (limit > 50 && allTracks.length === 50) {
      const response2 = await fetch(
        `${API_ENDPOINTS.SPOTIFY_TOP_TRACKS}?time_range=${timeRange}&limit=50&offset=50`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
      
      if (response2.ok) {
        const data2: SpotifyTopTracksResponse = await response2.json();
        allTracks = [...allTracks, ...(data2.items || [])];
      }
    }
    
    // Ajouter lastPlayed à chaque track
    const recentResp = await fetch(
      `${API_ENDPOINTS.SPOTIFY_RECENTLY_PLAYED}?limit=50`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );
    
    const lastPlayedMap: { [trackId: string]: string } = {};
    
    if (recentResp.ok) {
      const recentData: SpotifyRecentlyPlayedResponse = await recentResp.json();
      (recentData.items || []).forEach((item) => {
        if (item.track && item.played_at) {
          lastPlayedMap[item.track.id] = item.played_at;
        }
      });
    }
    
    return allTracks.map((track) => ({
      ...track,
      lastPlayed: lastPlayedMap[track.id] || null,
    }));
  } catch (error) {
    console.error('❌ Erreur fetchSpotifyTopTracks:', error);
    throw error;
  }
};

/**
 * Mélange un tableau avec l'algorithme Fisher-Yates
 */
export const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

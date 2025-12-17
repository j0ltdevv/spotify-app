import { API_ENDPOINTS } from '../config';
import { SpotifyTopTracksResponse, SpotifyTrack, SpotifyRecentlyPlayedResponse, TimeRange } from '../types';

// 🚨 PLAYLIST DE SECOURS (MODE SYSTÈME D)
// Utilisée si Spotify nous bannit temporairement (Erreur 429)
const EMERGENCY_TRACKS: SpotifyTrack[] = [
    { id: '275PaZJkE5LOAdDx08Y3Sj', name: 'Get Lucky', artists: [{ name: 'Daft Punk', id: '1', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'Random Access Memories', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2734121faee8df82c526cbab2be', height: 640, width: 640 }], id: '1', href: '', release_date: '2013', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 80, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '1qDrWA6LYx8cFO48zFZnWC', name: 'Shape of You', artists: [{ name: 'Ed Sheeran', id: '2', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: '÷ (Deluxe)', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96', height: 640, width: 640 }], id: '2', href: '', release_date: '2017', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 85, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '4u7EnebtmKWzUu2Bd60n7H', name: 'Bohemian Rhapsody', artists: [{ name: 'Queen', id: '3', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'A Night At The Opera', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273ce4f1737bc8a646c8c4bd25a', height: 640, width: 640 }], id: '3', href: '', release_date: '1975', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 90, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '3ZFTkvIE7kyPtG5zwRUokK', name: 'Havana', artists: [{ name: 'Camila Cabello', id: '4', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'Camila', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2732ad98485cd4997184a44d0f6', height: 640, width: 640 }], id: '4', href: '', release_date: '2018', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 75, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '0bYg9bo50gSsH3LtXe2SQn', name: 'All I Want for Christmas Is You', artists: [{ name: 'Mariah Carey', id: '5', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'Merry Christmas', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2734246e3158421f5abb75abc4f', height: 640, width: 640 }], id: '5', href: '', release_date: '1994', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 95, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '7qiZfU4dY1lWllzX7mPBI3', name: 'Shape of You', artists: [{ name: 'Ed Sheeran', id: '6', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: '÷ (Divide)', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273ba5db46f4b838ef6027e6f96', height: 640, width: 640 }], id: '6', href: '', release_date: '2017', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 82, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '3S2R0EVwBSAVMd5UMgKTL0', name: 'Bad Guy', artists: [{ name: 'Billie Eilish', id: '7', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27350a3147b4edd7701a876c6ce', height: 640, width: 640 }], id: '7', href: '', release_date: '2019', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 88, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '0pqnGHJpmpxLKifKRmU6WP', name: 'Believer', artists: [{ name: 'Imagine Dragons', id: '8', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'Evolve', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b2735675e83f707f1d7271e5cf8a', height: 640, width: 640 }], id: '8', href: '', release_date: '2017', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 86, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '3KkXRkHbMCARz0aVfEt68P', name: 'Sunflower', artists: [{ name: 'Post Malone', id: '9', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'Spider-Man: Into the Spider-Verse', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b273e2e352d89826aef6dbd5ff8f', height: 640, width: 640 }], id: '9', href: '', release_date: '2018', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 84, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } },
    { id: '60nZcImufyMA1KT4eGO2Jn', name: 'Happy', artists: [{ name: 'Pharrell Williams', id: '10', href: '', type: 'artist', uri: '', external_urls: { spotify: '' } }], album: { name: 'G I R L', images: [{ url: 'https://i.scdn.co/image/ab67616d0000b27303c735d49480cb18731d102e', height: 640, width: 640 }], id: '10', href: '', release_date: '2014', release_date_precision: 'year', type: 'album', uri: '', external_urls: { spotify: '' } }, duration_ms: 30000, popularity: 78, preview_url: null, uri: '', href: '', type: 'track', external_urls: { spotify: '' } }
];

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
    
    // 🛡️ CIRCUIT BREAKER "SYSTÈME D"
    // Si on reçoit une erreur 429 (Trop de requêtes) ou autre erreur client
    if (response.status === 429 || response.status >= 500) {
        console.warn(`🔥 ALERTE SPOTIFY: Erreur ${response.status} (Rate Limit ou Panne).`);
        console.warn(`🛡️ Activation du mode SECOURS avec ${EMERGENCY_TRACKS.length} titres.`);
        return shuffleArray(EMERGENCY_TRACKS);
    }
    
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
    try {
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
    } catch (e) {
        console.warn("⚠️ Impossible de récupérer l'historique récent (non bloquant)", e);
    }
    
    return allTracks.map((track) => ({
      ...track,
      lastPlayed: null, // Simplification pour éviter complexité TS avec la map ci-dessus
    }));
  } catch (error) {
    console.error('❌ Erreur CRITIQUE fetchSpotifyTopTracks:', error);
    // En dernier recours, même si fetch plante (ex: pas d'internet), on peut renvoyer la liste de secours
    // si on veut un mode vraiment "offline". Pour l'instant on renvoie la liste de secours si erreur.
    console.warn("🛡️ Activation du mode SECOURS suite à exception.");
    return shuffleArray(EMERGENCY_TRACKS);
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

/**
 * MusicService.ts
 * Service centralisé pour toutes les opérations liées à la musique (Spotify + iTunes)
 * Objectif : Séparer la logique métier de l'affichage
 */

import { API_ENDPOINTS } from '../config';
import { 
  SpotifyTopTracksResponse, 
  SpotifyTrack, 
  SpotifyRecentlyPlayedResponse, 
  TimeRange,
  GameTrack 
} from '../types';
import { fetchAudioFromItunes } from '../utils/itunesHelper';
import { fetchAudioFromDeezer } from '../utils/deezerHelper';
import { fetchSpotifyTopTracks, shuffleArray } from '../utils/spotifyHelper';

/**
 * Options pour la récupération des tracks
 */
export interface FetchTracksOptions {
  accessToken: string;
  category: string;
  excludedTrackIds: string[];
  limit?: number;
}

/**
 * Résultat de la recherche d'un track jouable
 */
export interface PlayableTrackResult {
  track: GameTrack | null;
  success: boolean;
  error?: string;
}

/**
 * Interface pour le cache des previews
 */
interface PreviewCacheEntry {
  url: string;
  source: 'iTunes' | 'Spotify' | 'Deezer';
  timestamp: number;
  // Metadata optionnelles (si la source est iTunes/Deezer et diffère de Spotify)
  title?: string;
  artist?: string;
  album?: string;
  cover?: string;
}

/**
 * Service de gestion de la musique
 */
class MusicService {
  private static instance: MusicService;
  
  // Cache des previews (24h de validité)
  private previewCache: Map<string, PreviewCacheEntry> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 heures
  
  // Préchargement du prochain track
  private nextTrackPromise: Promise<PlayableTrackResult> | null = null;

  // Historique local pour éviter les doublons immédiats (protection latence Firestore)
  private recentHistory: Set<string> = new Set();

  private constructor() {}

  /**
   * Singleton pattern
   */
  public static getInstance(): MusicService {
    if (!MusicService.instance) {
      MusicService.instance = new MusicService();
    }
    return MusicService.instance;
  }

  /**
   * Réinitialise le service pour une nouvelle partie
   */
  public reset(): void {
    // console.log("🧹 [MusicService] Réinitialisation de l'historique et des préchargements.");
    if (this.recentHistory) {
      this.recentHistory.clear();
    } else {
      this.recentHistory = new Set();
    }
    this.nextTrackPromise = null;
  }

  /**
   * Récupère un preview depuis le cache
   */
  private getCachedPreview(trackId: string): PreviewCacheEntry | null {
    const cached = this.previewCache.get(trackId);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      // console.log(`   💾 Cache hit ! Source: ${cached.source} (économie de requêtes API)`);
      return cached;
    }
    
    if (cached) {
      // Cache expiré, le supprimer
      this.previewCache.delete(trackId);
    }
    
    return null;
  }

  /**
   * Ajoute un preview au cache
   */
  private cachePreview(
    trackId: string, 
    url: string, 
    source: 'iTunes' | 'Spotify' | 'Deezer',
    metadata?: { title: string, artist: string, album: string, cover: string }
  ): void {
    this.previewCache.set(trackId, {
      url,
      source,
      timestamp: Date.now(),
      ...metadata
    });
    // console.log(`   💾 Preview mis en cache (${this.previewCache.size} entrées totales)`);
  }

  /**
   * Précharge le prochain track en arrière-plan
   */
  public prefetchNextTrack(
    tracks: SpotifyTrack[],
    excludedTrackIds: string[],
    maxAttempts: number = 15
  ): void {
    // console.log(`\n⏩ Préchargement du prochain track en arrière-plan...`);
    this.nextTrackPromise = this.findPlayableTrack(tracks, excludedTrackIds, maxAttempts, false, true);
  }

  /**
   * Utilise le track préchargé s'il est disponible
   */
  private async usePrefetchedTrack(
    tracks: SpotifyTrack[],
    excludedTrackIds: string[]
  ): Promise<PlayableTrackResult | null> {
    if (this.nextTrackPromise) {
      // console.log(`\n🚀 Utilisation du track préchargé !`);
      const result = await this.nextTrackPromise;
      this.nextTrackPromise = null;

      if (result.success && result.track) {
        this.recentHistory.add(result.track.id);
        this.prefetchNextTrack(tracks, [...excludedTrackIds, result.track.id]);
      }

      return result;
    }
    return null;
  }

  /**
   * Récupère les top tracks selon la catégorie
   */
  public async fetchTracksByCategory(options: FetchTracksOptions): Promise<SpotifyTrack[]> {
    const { accessToken, category, limit = 100 } = options;

    try {
      console.log(`🎵 Récupération des tracks pour la catégorie: ${category}`);

      // Récupération du Top Récent (utilisé comme liste noire)
      const recentTracks = await fetchSpotifyTopTracks(accessToken, 'short_term', limit);
      const recentTrackIds = new Set(recentTracks.map(track => track.id));

      let targetTracks: SpotifyTrack[] = [];

      switch (category) {
        case 'LIKED_SHUFFLE':
          targetTracks = await this.fetchRandomLikedTracks(accessToken, limit);
          break;

        case 'TOP_5Y':
        case '5_ANS_PLUS':
          targetTracks = await this.fetchOldFavorites(accessToken, recentTrackIds, limit);
          break;

        case 'GUILTY_PLEASURES':
          targetTracks = await this.fetchGuiltyPleasures(accessToken, recentTrackIds, limit);
          break;

        case 'TOP_RECENT':
        default:
          targetTracks = recentTracks;
          break;
      }

      console.log(`✅ ${targetTracks.length} tracks récupérés pour ${category}`);
      return targetTracks;

    } catch (error) {
      console.error('❌ Erreur fetchTracksByCategory:', error);
      throw new Error(`Impossible de récupérer les tracks: ${error}`);
    }
  }

  /**
   * Récupère aléatoirement des tracks depuis les likes Spotify
   */
  private async fetchRandomLikedTracks(
    accessToken: string,
    limit: number
  ): Promise<SpotifyTrack[]> {
    console.log("🎲 Recherche aléatoire dans les likes...");

    try {
      // Étape 1: Obtenir le nombre total de titres likés
      const countResponse = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!countResponse.ok) {
        throw new Error(`Erreur API Spotify: ${countResponse.status}`);
      }

      const countData = await countResponse.json();
      const total = countData.total;

      console.log(`   📊 Total de likes: ${total}`);

      if (total === 0) {
        console.warn("   ⚠️ Aucun titre liké trouvé");
        return [];
      }

      // Étape 2: Calculer un offset aléatoire
      const maxOffset = Math.max(0, total - 50);
      const randomOffset = Math.floor(Math.random() * (maxOffset + 1));

      console.log(`   🎲 Offset aléatoire: ${randomOffset} (max: ${maxOffset})`);

      // Étape 3: Récupérer 50 tracks à partir de cet offset
      const tracksResponse = await fetch(
        `https://api.spotify.com/v1/me/tracks?limit=50&offset=${randomOffset}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!tracksResponse.ok) {
        throw new Error(`Erreur API Spotify: ${tracksResponse.status}`);
      }

      const tracksData = await tracksResponse.json();
      const tracks = tracksData.items.map((item: any) => item.track);

      console.log(`   ✅ ${tracks.length} tracks aléatoires récupérés`);

      return tracks;

    } catch (error) {
      console.error('❌ Erreur fetchRandomLikedTracks:', error);
      throw error;
    }
  }

  /**
   * Récupère les vieux favoris (plus écoutés maintenant)
   */
  private async fetchOldFavorites(
    accessToken: string,
    recentTrackIds: Set<string>,
    limit: number
  ): Promise<SpotifyTrack[]> {
    console.log("🕰️ Recherche des vieux favoris...");

    const longTermTracks = await fetchSpotifyTopTracks(accessToken, 'long_term', limit);
    const mediumTermTracks = await fetchSpotifyTopTracks(accessToken, 'medium_term', limit);
    const mediumTrackIds = new Set(mediumTermTracks.map(track => track.id));

    // Stratégie: Titres du long_term qui ne sont NI dans short_term NI dans medium_term
    let targetTracks = longTermTracks.filter(track => 
      !recentTrackIds.has(track.id) && !mediumTrackIds.has(track.id)
    );

    console.log(`   📊 Long term total: ${longTermTracks.length}`);
    console.log(`   📊 Exclus (récents): ${recentTrackIds.size}`);
    console.log(`   📊 Exclus (medium): ${mediumTrackIds.size}`);
    console.log(`   📊 Vieux favoris trouvés: ${targetTracks.length}`);

    // Fallback 1: Si trop peu, juste exclure le short_term
    if (targetTracks.length < 20) {
      console.log("   ⚠️ Peu de vieux favoris, fallback sur long_term sans recent...");
      targetTracks = longTermTracks.filter(track => !recentTrackIds.has(track.id));
    }

    // Fallback 2: Si toujours rien, tous les long_term
    if (targetTracks.length === 0) {
      console.log("   ⚠️ Aucun ancien titre distinct, utilisation de tous les long_term...");
      targetTracks = longTermTracks;
    }

    return targetTracks;
  }

  /**
   * Récupère les guilty pleasures
   */
  private async fetchGuiltyPleasures(
    accessToken: string,
    recentTrackIds: Set<string>,
    limit: number
  ): Promise<SpotifyTrack[]> {
    console.log("🎭 Recherche de Guilty Pleasures...");

    const longTermTracks = await fetchSpotifyTopTracks(accessToken, 'long_term', limit);
    const mediumTermTracks = await fetchSpotifyTopTracks(accessToken, 'medium_term', limit);

    // Stratégie 1: Titres du long_term qui ne sont PAS dans le short_term
    const oldFavorites = longTermTracks.filter(track => !recentTrackIds.has(track.id));

    // Stratégie 2: Recherche par mots-clés "guilty"
    const guiltyKeywords = [
      '80', '90', '2000', '70', 'eighties', 'nineties',
      'k-pop', 'kpop', 'anime', 'cartoon', 'disney', 'soundtrack', 'ost',
      'générique', 'opening', 'ending', 'theme',
      'karaoke', 'kids', 'child', 'enfant', 'tv', 'television', 'series',
      'musical', 'broadway', 'comédie', 'comedy',
      'guilty', 'pleasure', 'nostalgie', 'nostalgia', 'classic',
      'cover', 'remix', 'dance', 'party', 'hits'
    ];

    const guiltyByKeyword = [...longTermTracks, ...mediumTermTracks].filter(track => {
      const name = (track.name || '').toLowerCase();
      const album = (track.album?.name || '').toLowerCase();
      const artist = (track.artists && track.artists[0]?.name || '').toLowerCase();

      const searchText = `${name} ${album} ${artist}`;
      return guiltyKeywords.some(k => searchText.includes(k));
    });

    console.log(`   📊 Guilty par ancienneté: ${oldFavorites.length}`);
    console.log(`   📊 Guilty par mots-clés: ${guiltyByKeyword.length}`);

    // Combiner et dédupliquer
    const combinedSet = new Set([...oldFavorites, ...guiltyByKeyword]);
    let targetTracks = Array.from(combinedSet);

    // Fallback: titres moins populaires du long_term
    if (targetTracks.length === 0) {
      console.log("   ⚠️ Aucun guilty trouvé, fallback sur titres moins récents...");
      targetTracks = longTermTracks.slice(-50);
    }

    console.log(`   ✅ Total Guilty Pleasures trouvés: ${targetTracks.length}`);
    return targetTracks;
  }

  /**
   * Vérifie un seul track pour voir s'il est jouable
   */
  private async checkSingleTrack(track: SpotifyTrack): Promise<PlayableTrackResult | null> {
    try {
      const artistName = track.artists?.[0]?.name || '';
      let audioUrl: string | null = null;

      // VÉRIFIER LE CACHE D'ABORD
      const cached = this.getCachedPreview(track.id);
      if (cached) {
        console.log(`   💾 [CACHE] ${track.name} trouvé en cache (${cached.source})`);
        
        // Si on a des métadonnées en cache (iTunes), on les utilise
        let gameTrack = this.createGameTrack(track, cached.url, cached.source);
        if (cached.title) {
            gameTrack.title = cached.title;
            gameTrack.artist = cached.artist || gameTrack.artist;
            gameTrack.album = cached.album || gameTrack.album;
            gameTrack.albumImage = cached.cover || gameTrack.albumImage;
        }
        
        return {
          track: gameTrack,
          success: true
        };
      }

      // PRIORITÉ 1: iTunes (Retourne un objet avec métadonnées)
      const itunesResult = await fetchAudioFromItunes(track.name, artistName);
      if (itunesResult) {
        this.cachePreview(track.id, itunesResult.audioUrl, 'iTunes', {
            title: itunesResult.title,
            artist: itunesResult.artist,
            album: itunesResult.album,
            cover: itunesResult.cover
        });
        console.log(`   🍎 [ITUNES] ${track.name} trouvé ! (Metadata synchro: ${itunesResult.title})`);
        
        // On crée le track avec les métadonnées iTunes pour éviter la désynchronisation
        let gameTrack = this.createGameTrack(track, itunesResult.audioUrl, 'iTunes');
        gameTrack.title = itunesResult.title;
        gameTrack.artist = itunesResult.artist;
        gameTrack.album = itunesResult.album;
        gameTrack.albumImage = itunesResult.cover;

        return {
          track: gameTrack,
          success: true
        };
      }

      // PRIORITÉ 2: Deezer (Retourne string pour l'instant)
      audioUrl = await fetchAudioFromDeezer(track.name, artistName);
      if (audioUrl) {
        this.cachePreview(track.id, audioUrl, 'Deezer');
        console.log(`   🎵 [DEEZER] ${track.name} trouvé !`);
        return {
          track: this.createGameTrack(track, audioUrl, 'Deezer'),
          success: true
        };
      }

      // PRIORITÉ 3: Spotify Preview
      if (track.preview_url) {
        this.cachePreview(track.id, track.preview_url, 'Spotify');
        console.log(`   🟢 [SPOTIFY] ${track.name} trouvé !`);
        return {
          track: this.createGameTrack(track, track.preview_url, 'Spotify'),
          success: true
        };
      }

      // Échec pour ce track
      return null;

    } catch (error) {
      console.warn(`   ⚠️ Erreur check ${track.name}: ${error}`);
      return null;
    }
  }

  /**
   * Génère une playlist complète et vérifiée pour une partie
   * @param tracks Pool de tracks disponibles
   * @param count Nombre de tracks nécessaires
   * @returns Liste de GameTrack vérifiés (avec preview)
   */
  public async generateVerifiedPlaylist(
    tracks: SpotifyTrack[],
    count: number
  ): Promise<GameTrack[]> {
    console.log(`\n🏗️ Génération d'une playlist vérifiée de ${count} titres...`);
    
    // 1. Dédupliquer par ID
    const uniqueTracksMap = new Map<string, SpotifyTrack>();
    tracks.forEach(t => {
      if (t.id && !uniqueTracksMap.has(t.id)) {
        uniqueTracksMap.set(t.id, t);
      }
    });
    
    // 2. Mélanger
    let pool = shuffleArray(Array.from(uniqueTracksMap.values()));
    const verifiedPlaylist: GameTrack[] = [];
    
    console.log(`   📦 Pool initial : ${pool.length} titres uniques.`);

    // 3. Vérifier séquentiellement jusqu'à avoir assez de titres
    for (const track of pool) {
      if (verifiedPlaylist.length >= count) break;
      
      const result = await this.checkSingleTrack(track);
      if (result && result.success && result.track) {
        verifiedPlaylist.push(result.track);
        console.log(`   ✅ [${verifiedPlaylist.length}/${count}] ${result.track.title} validé.`);
      }
    }

    console.log(`\n✨ Playlist terminée : ${verifiedPlaylist.length} titres prêts.`);
    return verifiedPlaylist;
  }

  /**
   * Trouve un track jouable avec preview audio (iTunes prioritaire)
   * VERSION OPTIMISÉE : Recherche par lots parallèles
   */
  public async findPlayableTrack(
    tracks: SpotifyTrack[],
    excludedTrackIds: string[],
    maxAttempts: number = 15,
    degradedMode: boolean = false,
    isPrefetch: boolean = false
  ): Promise<PlayableTrackResult> {
    // Si ce n'est PAS un prefetch, on essaie d'utiliser ce qui a été préchargé
    if (!isPrefetch) {
      const prefetched = await this.usePrefetchedTrack(tracks, excludedTrackIds);
      if (prefetched && prefetched.success) {
        if (prefetched.track && !excludedTrackIds.includes(prefetched.track.id) && !this.recentHistory.has(prefetched.track.id)) {
          return prefetched;
        }
      }
    }

    // Filtrer et mélanger les tracks
    const availableTracks = shuffleArray(
        tracks.filter(t => !excludedTrackIds.includes(t.id) && !this.recentHistory.has(t.id))
    );

    console.log(`\n🔍 Recherche séquentielle d'un track jouable parmi ${availableTracks.length} tracks... (Mode Prefetch: ${isPrefetch})`);

    for (const track of availableTracks) {
      const result = await this.checkSingleTrack(track);
      if (result && result.success) {
        console.log(`\n🏆 GAGNANT TROUVÉ: ${result.track?.title}`);
        
        if (result.track) {
          this.recentHistory.add(result.track.id);
        }

        if (!isPrefetch) {
          this.prefetchNextTrack(tracks, [...excludedTrackIds, result.track!.id]);
        }
        
        return result;
      }
    }

    return {
      track: null,
      success: false,
      error: 'Aucun extrait audio trouvé après avoir tout scanné.'
    };
  }

  /**
   * Crée un objet GameTrack à partir d'un SpotifyTrack
   */
  private createGameTrack(
    track: SpotifyTrack,
    audioUrl: string,
    source: 'iTunes' | 'Spotify' | 'Deezer'
  ): GameTrack {
    return {
      id: track.id,
      title: track.name,
      artist: track.artists?.[0]?.name || 'Artiste inconnu',
      album: track.album?.name || '',
      albumImage: track.album?.images?.[0]?.url || '',
      preview_url: audioUrl,
      correctPlayer: track.correctPlayer || '?', // Use propagated ID or '?' as fallback
      lastPlayed: track.lastPlayed || null,
      source
    };
  }

  /**
   * Ajoute un track aux favoris Spotify
   */
  public async addTrackToLiked(trackId: string, accessToken: string): Promise<boolean> {
    try {
      const response = await fetch(`${API_ENDPOINTS.SPOTIFY_ADD_TRACK}?ids=${trackId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok || response.status === 200 || response.status === 201) {
        console.log(`✅ Track ${trackId} ajouté aux favoris`);
        return true;
      }

      console.error(`❌ Erreur ajout aux favoris: ${response.status}`);
      return false;
    } catch (error) {
      console.error('❌ Erreur réseau addTrackToLiked:', error);
      return false;
    }
  }
}

export default MusicService.getInstance();

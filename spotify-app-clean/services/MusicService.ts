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
   * Récupère un preview depuis le cache
   */
  private getCachedPreview(trackId: string): PreviewCacheEntry | null {
    const cached = this.previewCache.get(trackId);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`   💾 Cache hit ! Source: ${cached.source} (économie de requêtes API)`);
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
  private cachePreview(trackId: string, url: string, source: 'iTunes' | 'Spotify' | 'Deezer'): void {
    this.previewCache.set(trackId, {
      url,
      source,
      timestamp: Date.now()
    });
    console.log(`   💾 Preview mis en cache (${this.previewCache.size} entrées totales)`);
  }

  /**
   * Précharge le prochain track en arrière-plan
   */
  public prefetchNextTrack(
    tracks: SpotifyTrack[],
    excludedTrackIds: string[],
    maxAttempts: number = 15
  ): void {
    console.log(`\n⏩ Préchargement du prochain track en arrière-plan...`);
    this.nextTrackPromise = this.findPlayableTrack(tracks, excludedTrackIds, maxAttempts);
  }

  /**
   * Utilise le track préchargé s'il est disponible
   */
  private async usePrefetchedTrack(): Promise<PlayableTrackResult | null> {
    if (this.nextTrackPromise) {
      console.log(`\n🚀 Utilisation du track préchargé !`);
      const result = await this.nextTrackPromise;
      this.nextTrackPromise = null;
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
   * Trouve un track jouable avec preview audio (iTunes prioritaire)
   */
  public async findPlayableTrack(
    tracks: SpotifyTrack[],
    excludedTrackIds: string[],
    maxAttempts: number = 15,
    degradedMode: boolean = false
  ): Promise<PlayableTrackResult> {
    // Vérifier si on peut utiliser un track préchargé
    const prefetched = await this.usePrefetchedTrack();
    if (prefetched && prefetched.success) {
      return prefetched;
    }

    console.log(`\n🔍 Recherche d'un track jouable parmi ${tracks.length} tracks`);
    console.log(`   🔒 ${excludedTrackIds.length} tracks exclus`);
    if (degradedMode) {
      console.log(`   🔄 MODE DÉGRADÉ ACTIVÉ (seuils abaissés)`);
    }

    // Mélanger et filtrer les tracks déjà joués
    const shuffledTracks = shuffleArray(tracks);
    const availableTracks = shuffledTracks.filter(track => 
      !excludedTrackIds.includes(track.id)
    );

    console.log(`   ✅ ${availableTracks.length} tracks disponibles après filtrage`);

    if (availableTracks.length === 0) {
      return {
        track: null,
        success: false,
        error: 'Aucun track disponible'
      };
    }

    // Recherche d'un track avec preview
    for (let i = 0; i < Math.min(maxAttempts, availableTracks.length); i++) {
      const track = availableTracks[i];

      console.log(`\n${'='.repeat(80)}`);
      console.log(`🔍 TENTATIVE ${i + 1}/${maxAttempts}`);
      console.log(`📀 Track: "${track.name}"`);
      console.log(`🎤 Artiste: ${track.artists?.[0]?.name}`);
      console.log(`💿 Album: ${track.album?.name || 'N/A'}`);
      console.log(`🆔 Spotify ID: ${track.id}`);
      console.log(`${'='.repeat(80)}`);

      try {
        const artistName = track.artists?.[0]?.name || '';
        let audioUrl: string | null = null;
        let source: 'iTunes' | 'Spotify' | 'Deezer' = 'iTunes';

        // VÉRIFIER LE CACHE D'ABORD
        const cached = this.getCachedPreview(track.id);
        if (cached) {
          console.log(`\n🎉 🎉 🎉 SUCCÈS (Cache) ! 🎉 🎉 🎉`);
          console.log(`   Source: ${cached.source} (depuis le cache)`);
          return {
            track: this.createGameTrack(track, cached.url, cached.source),
            success: true
          };
        }

        // PRIORITÉ 1: iTunes (meilleur matching, moins de désynchronisation)
        console.log(`\n🍎 ═══════ PRIORITÉ 1 : iTunes ═══════`);
        audioUrl = await fetchAudioFromItunes(track.name, artistName);

        if (audioUrl) {
          this.cachePreview(track.id, audioUrl, 'iTunes');
          console.log(`\n🎉 🎉 🎉 SUCCÈS iTunes ! 🎉 🎉 🎉`);
          console.log(`   Source: iTunes`);
          console.log(`   URL: ${audioUrl.substring(0, 60)}...`);
          return {
            track: this.createGameTrack(track, audioUrl, 'iTunes'),
            success: true
          };
        }

        // PRIORITÉ 2: Deezer (excellent catalogue, API gratuite)
        console.log(`\n🎵 ═══════ PRIORITÉ 2 : Deezer ═══════`);
        console.log(`   iTunes échec, tentative avec Deezer...`);
        audioUrl = await fetchAudioFromDeezer(track.name, artistName);

        if (audioUrl) {
          this.cachePreview(track.id, audioUrl, 'Deezer');
          console.log(`\n🎉 🎉 🎉 SUCCÈS Deezer ! 🎉 🎉 🎉`);
          console.log(`   Source: Deezer`);
          console.log(`   URL: ${audioUrl.substring(0, 60)}...`);
          return {
            track: this.createGameTrack(track, audioUrl, 'Deezer'),
            success: true
          };
        }

        // PRIORITÉ 3: Spotify preview (fallback de dernière chance)
        console.log(`\n🎵 ═══════ PRIORITÉ 3 : Spotify Preview ═══════`);
        if (track.preview_url) {
          this.cachePreview(track.id, track.preview_url, 'Spotify');
          console.log(`   ✅ Spotify preview disponible !`);
          console.log(`\n🎉 🎉 🎉 SUCCÈS Spotify ! 🎉 🎉 🎉`);
          console.log(`   Source: Spotify`);
          console.log(`   URL: ${track.preview_url.substring(0, 60)}...`);
          return {
            track: this.createGameTrack(track, track.preview_url, 'Spotify'),
            success: true
          };
        }

        console.log(`   ❌ Pas de preview Spotify disponible`);
        console.log(`\n❌ ═══════ ÉCHEC TOTAL - Aucune source trouvée ═══════`);
        console.log(`   ⏭️  Passage au titre suivant...`);
      } catch (error) {
        console.warn(`\n⚠️ ═══════ ERREUR TECHNIQUE ═══════`);
        console.warn(`   ${error}`);
        console.warn(`   ⏭️  Passage au titre suivant...`);
      }
    }

    // MODE DÉGRADÉ : Si échec et pas encore en mode dégradé, réessayer avec paramètres plus permissifs
    if (!degradedMode) {
      console.log(`\n🔄 ═══════ ACTIVATION DU MODE DÉGRADÉ ═══════`);
      console.log(`   Nouvel essai avec plus de tentatives et paramètres assouplis`);
      return await this.findPlayableTrack(
        tracks, 
        excludedTrackIds, 
        Math.min(20, availableTracks.length),
        true // Mode dégradé activé
      );
    }

    return {
      track: null,
      success: false,
      error: 'Aucun extrait audio trouvé même en mode dégradé'
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
      correctPlayer: 'Moi',
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

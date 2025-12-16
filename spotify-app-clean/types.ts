// Types TypeScript pour l'application

export interface SpotifyImage {
  url: string;
  height: number;
  width: number;
}

export interface SpotifyArtist {
  id: string;
  name: string;
  uri?: string;
  external_urls?: {
    spotify: string;
  };
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: SpotifyImage[];
  release_date?: string;
  uri?: string;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
  preview_url?: string | null;
  duration_ms: number;
  uri?: string;
  popularity?: number;
  lastPlayed?: string | null;
}

export interface SpotifyUser {
  id: string;
  display_name: string;
  email?: string;
  images?: SpotifyImage[];
  country?: string;
  product?: string;
}

export interface SpotifyTopTracksResponse {
  items: SpotifyTrack[];
  total: number;
  limit: number;
  offset: number;
  next?: string;
  previous?: string;
}

export interface SpotifyRecentlyPlayedItem {
  track: SpotifyTrack;
  played_at: string;
}

export interface SpotifyRecentlyPlayedResponse {
  items: SpotifyRecentlyPlayedItem[];
  next?: string;
  cursors?: {
    after: string;
    before: string;
  };
}

export interface SpotifyTopArtistsResponse {
  items: SpotifyArtist[];
  total: number;
  limit: number;
  offset: number;
}

export interface Player {
  id: string;
  name: string;
  color: string;
  emoji: string;
  image?: string;
}

export interface PlayerAvatar {
  color: string;
  emoji: string;
}

export interface GameResult {
  name: string;
  score: number;
  avatar: PlayerAvatar;
}

export interface PlayerScores {
  [playerId: string]: number;
}

export interface GameTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumImage: string;
  preview_url: string;
  correctPlayer: string;
  lastPlayed?: string | null;
  source?: 'iTunes' | 'Spotify' | 'Deezer';
  roundId?: string;
}

export interface Category {
  key: string;
  label: string;
  icon: string;
  description: string;
  gradient: [string, string];
  emoji: string;
}

export interface ITunesSearchResult {
  resultCount: number;
  results: ITunesTrack[];
}

export interface ITunesTrack {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName: string;
  previewUrl?: string;
  artworkUrl100?: string;
  trackTimeMillis?: number;
}

export type TimeRange = 'short_term' | 'medium_term' | 'long_term';

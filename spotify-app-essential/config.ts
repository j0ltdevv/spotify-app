// Configuration de l'application
// ⚠️ NE PAS COMMITTER CE FICHIER AVEC DES VRAIES CLÉS EN PRODUCTION

import { SPOTIFY_CLIENT_ID } from '@env';

export const SPOTIFY_CONFIG = {
  CLIENT_ID: SPOTIFY_CLIENT_ID,
  REDIRECT_SCHEME: 'trackroulette',
  SCOPES: [
    'user-read-email',
    'user-top-read',
    'user-read-recently-played',
    'user-library-read',
    'user-library-modify',
  ],
};

export const DEEZER_CONFIG = {
  CLIENT_ID: 'YOUR_DEEZER_APP_ID', // À remplacer par votre ID Deezer
  REDIRECT_SCHEME: 'trackroulette',
  SCOPES: ['basic_access', 'email', 'listening_history', 'manage_library'],
};

export const API_ENDPOINTS = {
  SPOTIFY_AUTH: 'https://accounts.spotify.com/authorize',
  SPOTIFY_TOKEN: 'https://accounts.spotify.com/api/token',
  SPOTIFY_USER: 'https://api.spotify.com/v1/me',
  SPOTIFY_TOP_TRACKS: 'https://api.spotify.com/v1/me/top/tracks',
  SPOTIFY_TOP_ARTISTS: 'https://api.spotify.com/v1/me/top/artists',
  SPOTIFY_RECENTLY_PLAYED: 'https://api.spotify.com/v1/me/player/recently-played',
  SPOTIFY_ADD_TRACK: 'https://api.spotify.com/v1/me/tracks',
  
  DEEZER_AUTH: 'https://connect.deezer.com/oauth/auth.php',
  DEEZER_TOKEN: 'https://connect.deezer.com/oauth/access_token.php',
  DEEZER_USER: 'https://api.deezer.com/user/me',
  DEEZER_HISTORY: 'https://api.deezer.com/user/me/history',

  ITUNES_SEARCH: 'https://itunes.apple.com/search',
};

import { SPOTIFY_CONFIG, API_ENDPOINTS } from '../config';
import { TOKEN_CONFIG } from '../constants';

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

/**
 * Vérifie si le token est expiré ou va bientôt expirer
 */
export const isTokenExpired = (expiryTime: number): boolean => {
  const now = Date.now();
  return now >= expiryTime - TOKEN_CONFIG.EXPIRY_MARGIN;
};

/**
 * Calcule le timestamp d'expiration du token
 */
export const calculateExpiryTime = (expiresInSeconds: number = 3600): number => {
  return Date.now() + (expiresInSeconds * 1000);
};

/**
 * Gère l'erreur d'authentification Spotify
 * Retourne true si le token doit être renouvelé
 */
export const handleSpotifyAuthError = (statusCode: number): boolean => {
  switch (statusCode) {
    case 401:
      console.log('🔐 Token expiré, reconnexion nécessaire');
      return true;
    case 403:
      console.log('⚠️ Permissions insuffisantes');
      return false;
    case 429:
      console.log('⚠️ Rate limit atteint');
      return false;
    default:
      return false;
  }
};

/**
 * Wrapper pour les appels API Spotify avec gestion automatique du token expiré
 */
export const fetchWithAuth = async (
  url: string,
  accessToken: string,
  options: RequestInit = {}
): Promise<Response> => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    throw new Error('TOKEN_EXPIRED');
  }

  return response;
};

/**
 * Vérifie la validité du token en faisant un appel test
 */
export const validateToken = async (accessToken: string): Promise<boolean> => {
  try {
    const response = await fetch(API_ENDPOINTS.SPOTIFY_USER, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return response.ok;
  } catch (error) {
    console.error('❌ Erreur validation token:', error);
    return false;
  }
};

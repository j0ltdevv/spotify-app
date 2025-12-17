// Constantes de l'application

export const COLORS = {
  // Couleurs Spotify
  SPOTIFY_GREEN: '#1DB954',
  SPOTIFY_GREEN_LIGHT: '#1ed760',
  
  // Couleurs de fond
  DARK_BG: '#191414',
  DARK_SECONDARY: '#282828',
  DARK_TERTIARY: '#333333',
  
  // Couleurs de texte
  TEXT_PRIMARY: '#FFFFFF',
  TEXT_SECONDARY: '#B3B3B3',
  TEXT_MUTED: '#555555',
  
  // Couleurs d'accent
  ERROR_RED: '#FF6B6B',
  WARNING_ORANGE: '#FF8E8E',
  SUCCESS_GREEN: '#1DB954',
  INFO_BLUE: '#4ECDC4',
  GOLD: '#F5B041',
  DEEZER_PURPLE: '#9B51E0', // Mise à jour vers rgb(155, 81, 224)
  
  // Couleurs joueurs
  PLAYER_COLORS: {
    GREEN: '#1DB954',
    RED: '#FF6B6B',
    CYAN: '#4ECDC4',
    YELLOW: '#FFE66D',
    PURPLE: '#A78BFA',
  },
};

export const GAME_CONFIG = {
  MAX_ROUNDS: 10,
  INITIAL_TIME: 15,
  BASE_SCORE: 500,
  TIME_BONUS_MULTIPLIER: 30,
  MAX_TRACK_FETCH_ATTEMPTS: 15,
  AUDIO_STOP_DELAY: 100, // ms
  STATE_UPDATE_DELAY: 50, // ms
};

export const ANIMATION_CONFIG = {
  FADE_DURATION: 1000,
  SPRING_TENSION: 50,
  SPRING_FRICTION: 7,
  PULSE_DURATION: 400,
  TIMER_SCALE_DURATION: 200,
};

export const STORAGE_KEYS = {
  SPOTIFY_TOKEN: '@spotify_access_token',      // Legacy (pour migration progressive)
  SPOTIFY_TOKEN_EXPIRY: '@spotify_token_expiry', // Legacy
  JWT_TOKEN: '@jwt_token',                      // ✨ Nouveau (Backend JWT)
  GAME_STATE: '@game_state',
  PLAYER_PROFILES: '@player_profiles',
};

export const TOKEN_CONFIG = {
  EXPIRY_TIME: 60 * 60 * 1000, // 1 heure
  EXPIRY_MARGIN: 5 * 60 * 1000, // 5 minutes de marge
};

export const MOCK_PLAYERS = [
  { id: '1', name: 'Moi', color: COLORS.SPOTIFY_GREEN, emoji: '😎' },
  { id: '2', name: 'Julie', color: COLORS.ERROR_RED, emoji: '🎀' },
  { id: '3', name: 'Thomas', color: COLORS.INFO_BLUE, emoji: '🎸' },
  { id: '4', name: 'Léa', color: COLORS.PLAYER_COLORS.YELLOW, emoji: '✨' },
];

// Sous-modes pour le mode Aléatoire
export const GAME_MODES = [
  { 
    key: 'NORMAL', 
    label: 'Normal', 
    rounds: 10,
    description: '10 manches',
    emoji: '🎯',
    gradient: [COLORS.PLAYER_COLORS.PURPLE, '#C084FC'] as [string, string]
  },
  { 
    key: 'FLASH', 
    label: 'Flash', 
    rounds: 5,
    description: '5 manches',
    emoji: '⚡',
    gradient: [COLORS.GOLD, '#F39C12'] as [string, string]
  },
  { 
    key: 'LONG', 
    label: 'Long', 
    rounds: 15,
    description: '15 manches',
    emoji: '🎮',
    gradient: [COLORS.INFO_BLUE, '#6EDDD6'] as [string, string]
  },
  { 
    key: 'MARATHON', 
    label: 'Marathon', 
    rounds: 30,
    description: '30 manches',
    emoji: '🏃',
    gradient: [COLORS.ERROR_RED, COLORS.WARNING_ORANGE] as [string, string]
  },
];

export const CATEGORIES = [
  { 
    key: 'LIKED_SHUFFLE', 
    label: 'Aléatoire', 
    icon: 'shuffle',
    description: 'Pioche dans tes likes',
    gradient: [COLORS.PLAYER_COLORS.PURPLE, '#C084FC'] as [string, string],
    emoji: '🎲'
  },
  { 
    key: 'TOP_RECENT', 
    label: 'Top Récent', 
    icon: 'trending-up',
    description: 'Tes morceaux du moment',
    gradient: [COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN_LIGHT] as [string, string],
    emoji: '🔥'
  },
  { 
    key: 'GUILTY_PLEASURES', 
    label: 'Guilty Pleasures', 
    icon: 'heart',
    description: 'Tes plaisirs coupables',
    gradient: [COLORS.ERROR_RED, COLORS.WARNING_ORANGE] as [string, string],
    emoji: '😳'
  },
  { 
    key: 'TOP_5Y', 
    label: 'Vieux Favoris', 
    icon: 'time',
    description: 'Tes anciens hits',
    gradient: [COLORS.INFO_BLUE, '#6EDDD6'] as [string, string],
    emoji: '⏰'
  },
];

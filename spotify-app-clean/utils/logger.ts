/**
 * Système de logging amélioré pour le debug
 * Utilise des émojis pour une meilleure lisibilité dans la console
 */

const IS_DEV = __DEV__;

export const Logger = {
  // Informations générales
  info: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.log(`ℹ️ ${message}`, ...args);
    }
  },

  // Succès
  success: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.log(`✅ ${message}`, ...args);
    }
  },

  // Erreurs
  error: (message: string, error?: any, ...args: any[]) => {
    if (IS_DEV) {
      console.error(`❌ ${message}`, error, ...args);
    }
  },

  // Avertissements
  warn: (message: string, ...args: any[]) => {
    if (IS_DEV) {
      console.warn(`⚠️ ${message}`, ...args);
    }
  },

  // Debug API
  api: {
    request: (endpoint: string, method: string = 'GET') => {
      if (IS_DEV) {
        console.log(`🌐 API Request: ${method} ${endpoint}`);
      }
    },
    response: (endpoint: string, status: number, data?: any) => {
      if (IS_DEV) {
        const emoji = status >= 200 && status < 300 ? '✅' : '❌';
        console.log(`${emoji} API Response: ${endpoint} [${status}]`, data);
      }
    },
  },

  // Debug Audio
  audio: {
    play: (trackName: string) => {
      if (IS_DEV) {
        console.log(`🎵 Playing: ${trackName}`);
      }
    },
    stop: (trackName: string) => {
      if (IS_DEV) {
        console.log(`⏹️ Stopped: ${trackName}`);
      }
    },
    error: (message: string, error?: any) => {
      if (IS_DEV) {
        console.error(`🔇 Audio Error: ${message}`, error);
      }
    },
  },

  // Debug Navigation
  nav: (screenName: string, params?: any) => {
    if (IS_DEV) {
      console.log(`🧭 Navigation → ${screenName}`, params);
    }
  },

  // Debug Game
  game: {
    start: (round: number, category: string) => {
      if (IS_DEV) {
        console.log(`🎮 Game Start - Round ${round} | Category: ${category}`);
      }
    },
    answer: (correct: boolean, score: number) => {
      if (IS_DEV) {
        const emoji = correct ? '✅' : '❌';
        console.log(`${emoji} Answer | Score: ${score}`);
      }
    },
    end: (finalScore: number) => {
      if (IS_DEV) {
        console.log(`🏁 Game Over | Final Score: ${finalScore}`);
      }
    },
  },

  // Debug Auth
  auth: {
    login: (provider: string) => {
      if (IS_DEV) {
        console.log(`🔐 Login attempt: ${provider}`);
      }
    },
    success: (username: string) => {
      if (IS_DEV) {
        console.log(`✅ Auth Success: ${username}`);
      }
    },
    logout: () => {
      if (IS_DEV) {
        console.log(`👋 Logout`);
      }
    },
    error: (message: string, error?: any) => {
      if (IS_DEV) {
        console.error(`❌ Auth Error: ${message}`, error);
      }
    },
  },
};

export default Logger;

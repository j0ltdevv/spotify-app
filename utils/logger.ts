import { logEvent as firebaseLogEvent } from '../services/FirebaseAnalyticsService'; // Import Firebase logEvent

/**
 * Système de logging amélioré pour le debug
 * Utilise des émojis pour une meilleure lisibilité dans la console
 */

const IS_DEV = __DEV__;
const SILENT = true; // ✅ Set this to true to silence all Logger output

export const Logger = {
  // Informations générales
  info: (message: string, ...args: any[]) => {
    if (IS_DEV && !SILENT) {
      console.log(`ℹ️ ${message}`, ...args);
    }
  },

  // Succès
  success: (message: string, ...args: any[]) => {
    if (IS_DEV && !SILENT) {
      console.log(`✅ ${message}`, ...args);
    }
  },

  // Erreurs
  error: (message: string, error?: any, ...args: any[]) => {
    if (IS_DEV && !SILENT) {
      console.error(`❌ ${message}`, error, ...args);
    }
  },

  // Avertissements
  warn: (message: string, ...args: any[]) => {
    if (IS_DEV && !SILENT) {
      console.warn(`⚠️ ${message}`, ...args);
    }
  },

  // Debug générique
  debug: (message: string, ...args: any[]) => {
    if (IS_DEV && !SILENT) {
      console.log(`🐛 ${message}`, ...args);
    }
  },

  // Debug API
  api: {
    request: (endpoint: string, method: string = 'GET') => {
      if (IS_DEV && !SILENT) {
        console.log(`🌐 API Request: ${method} ${endpoint}`);
      }
    },
    response: (endpoint: string, status: number, data?: any) => {
      if (IS_DEV && !SILENT) {
        const emoji = status >= 200 && status < 300 ? '✅' : '❌';
        console.log(`${emoji} API Response: ${endpoint} [${status}]`, data);
      }
    },
  },

  // Debug Audio
  audio: {
    play: (trackName: string) => {
      if (IS_DEV && !SILENT) {
        console.log(`🎵 Playing: ${trackName}`);
      }
    },
    stop: (trackName: string) => {
      if (IS_DEV && !SILENT) {
        console.log(`⏹️ Stopped: ${trackName}`);
      }
    },
    error: (message: string, error?: any) => {
      if (IS_DEV && !SILENT) {
        console.error(`🔇 Audio Error: ${message}`, error);
      }
    },
  },

  // Debug Navigation
  nav: (screenName: string, params?: any) => {
    if (IS_DEV && !SILENT) {
      console.log(`🧭 Navigation → ${screenName}`, params);
    }
  },

  // Debug Game
  game: {
    start: (round: number, category: string) => {
      if (IS_DEV && !SILENT) {
        console.log(`🎮 Game Start - Round ${round} | Category: ${category}`);
      }
      firebaseLogEvent('game_start', { round, category }); // Log to Firebase Analytics
    },
    answer: (correct: boolean, score: number) => {
      if (IS_DEV && !SILENT) {
        const emoji = correct ? '✅' : '❌';
        console.log(`${emoji} Answer | Score: ${score}`);
      }
      firebaseLogEvent('game_answer', { correct, score }); // Log to Firebase Analytics
    },
    end: (finalScore: number) => {
      if (IS_DEV && !SILENT) {
        console.log(`🏁 Game Over | Final Score: ${finalScore}`);
      }
      firebaseLogEvent('game_end', { finalScore }); // Log to Firebase Analytics
    },
  },

  // Debug Auth
  auth: {
    login: (provider: string) => {
      if (IS_DEV && !SILENT) {
        console.log(`🔐 Login attempt: ${provider}`);
      }
      firebaseLogEvent('login_attempt', { provider }); // Log to Firebase Analytics
    },
    success: (username: string) => {
      if (IS_DEV && !SILENT) {
        console.log(`✅ Auth Success: ${username}`);
      }
      firebaseLogEvent('login_success', { username }); // Log to Firebase Analytics
    },
    logout: () => {
      if (IS_DEV && !SILENT) {
        console.log(`👋 Logout`);
      }
      firebaseLogEvent('logout'); // Log to Firebase Analytics
    },
    error: (message: string, error?: any) => {
      if (IS_DEV && !SILENT) {
        console.error(`❌ Auth Error: ${message}`, error);
      }
      firebaseLogEvent('auth_error', { message, error: error?.message || 'unknown' }); // Log to Firebase Analytics
    },
  },

  // Firebase Analytics specific logging
  analytics: {
    logEvent: (eventName: string, params?: { [key: string]: any }) => {
      firebaseLogEvent(eventName, params);
    },
  },
};

export default Logger;

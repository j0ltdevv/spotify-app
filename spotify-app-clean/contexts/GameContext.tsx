import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, GAME_CONFIG } from '../constants';
import { PlayerScores } from '../types';

interface GameState {
  currentRound: number;
  playerScores: PlayerScores;
  playedTracks: string[];
  category: string;
  gameId: number | null;
  isGameActive: boolean;
}

interface GameContextType extends GameState {
  startNewGame: (category: string) => void;
  nextRound: () => void;
  updatePlayerScore: (playerId: string, score: number) => void;
  addPlayedTrack: (trackId: string) => void;
  resetGame: () => void;
  saveGameState: () => Promise<void>;
  loadGameState: () => Promise<void>;
}

const initialGameState: GameState = {
  currentRound: 1,
  playerScores: {
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
  },
  playedTracks: [],
  category: 'TOP_RECENT',
  gameId: null,
  isGameActive: false,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);

  // Charger l'état du jeu au démarrage
  useEffect(() => {
    loadGameState();
  }, []);

  const startNewGame = (category: string) => {
    const newState: GameState = {
      ...initialGameState,
      category,
      gameId: Date.now(),
      isGameActive: true,
    };
    setGameState(newState);
    saveGameStateToStorage(newState);
    console.log('🎮 Nouvelle partie démarrée:', category);
  };

  const nextRound = () => {
    if (gameState.currentRound >= GAME_CONFIG.MAX_ROUNDS) {
      // Fin de partie
      setGameState(prev => ({ ...prev, isGameActive: false }));
      return;
    }

    setGameState(prev => {
      const newState = { ...prev, currentRound: prev.currentRound + 1 };
      saveGameStateToStorage(newState);
      return newState;
    });
    console.log('➡️ Manche suivante:', gameState.currentRound + 1);
  };

  const updatePlayerScore = (playerId: string, score: number) => {
    setGameState(prev => {
      const newState = {
        ...prev,
        playerScores: {
          ...prev.playerScores,
          [playerId]: (prev.playerScores[playerId] || 0) + score,
        },
      };
      saveGameStateToStorage(newState);
      return newState;
    });
    console.log(`📊 Score mis à jour pour joueur ${playerId}: +${score}`);
  };

  const addPlayedTrack = (trackId: string) => {
    setGameState(prev => {
      const newState = {
        ...prev,
        playedTracks: [...prev.playedTracks, trackId],
      };
      saveGameStateToStorage(newState);
      return newState;
    });
  };

  const resetGame = () => {
    setGameState(initialGameState);
    AsyncStorage.removeItem(STORAGE_KEYS.GAME_STATE);
    console.log('🔄 Jeu réinitialisé');
  };

  const saveGameStateToStorage = async (state: GameState) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.GAME_STATE, JSON.stringify(state));
    } catch (error) {
      console.error('❌ Erreur sauvegarde état du jeu:', error);
    }
  };

  const saveGameState = async () => {
    await saveGameStateToStorage(gameState);
  };

  const loadGameState = async () => {
    try {
      const savedState = await AsyncStorage.getItem(STORAGE_KEYS.GAME_STATE);
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // Ne charger que si le jeu était actif et pas trop ancien (moins de 24h)
        if (parsedState.isGameActive && parsedState.gameId) {
          const gameAge = Date.now() - parsedState.gameId;
          const oneDayInMs = 24 * 60 * 60 * 1000;
          
          if (gameAge < oneDayInMs) {
            setGameState(parsedState);
            console.log('✅ État du jeu restauré');
          } else {
            console.log('⚠️ Partie trop ancienne, réinitialisation');
            await AsyncStorage.removeItem(STORAGE_KEYS.GAME_STATE);
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur chargement état du jeu:', error);
    }
  };

  const value: GameContextType = {
    ...gameState,
    startNewGame,
    nextRound,
    updatePlayerScore,
    addPlayedTrack,
    resetGame,
    saveGameState,
    loadGameState,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};

export const useGame = () => {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame doit être utilisé dans un GameProvider');
  }
  return context;
};

import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, GAME_CONFIG } from '../constants';
import { PlayerScores } from '../types';
import { useAuth } from './AuthContext'; // Import useAuth
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore'; // Import Firestore modules
import { app } from '../services/FirebaseService'; // Import the Firebase app

interface GameState {
  currentRound: number;
  playerScores: PlayerScores;
  playedTracks: string[];
  category: string;
  gameId: number | null;
  isGameActive: boolean;
  userId?: string; // Add userId to GameState
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
  userId: undefined,
};

const GameContext = createContext<GameContextType | undefined>(undefined);

// Initialize Firestore
const db = getFirestore(app);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const { firebaseUser, isLoading: isAuthLoading } = useAuth(); // Get firebaseUser from AuthContext

  // Charger l'état du jeu au démarrage et quand l'utilisateur Firebase change
  useEffect(() => {
    if (!isAuthLoading && firebaseUser) {
      loadGameState();
      // Setup Firestore real-time listener
      const gameDocRef = doc(db, 'games', firebaseUser.uid);
      const unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const firestoreState = docSnap.data() as GameState;
          // Only update if the state coming from Firestore is different from current local state
          // This helps avoid unnecessary re-renders and potential loops
          if (JSON.stringify(firestoreState) !== JSON.stringify(gameState)) {
            setGameState(firestoreState);
            console.log('🔄 État du jeu mis à jour en temps réel depuis Firestore');
          }
        } else {
          console.log('ℹ️ Le document de jeu Firestore n\'existe plus, réinitialisation locale.');
          setGameState(initialGameState);
        }
      }, (error) => {
        console.error('❌ Erreur d\'écoute Firestore:', error);
      });

      // Cleanup listener on unmount or user change
      return () => {
        unsubscribe();
        console.log('🔌 Listener Firestore déconnecté.');
      };
    } else if (!isAuthLoading && !firebaseUser) {
      // Si l'utilisateur se déconnecte, réinitialiser le jeu localement
      setGameState(initialGameState);
    }
  }, [firebaseUser, isAuthLoading]); // Added gameState to dependencies to prevent infinite loop


  const startNewGame = (category: string) => {
    const newState: GameState = {
      ...initialGameState,
      category,
      gameId: Date.now(),
      isGameActive: true,
      userId: firebaseUser?.uid, // Assurez-vous que l'userId est défini lors de la création
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

  const resetGame = async () => { // Make async
    setGameState(initialGameState);
    if (!firebaseUser) {
      console.warn('⚠️ Impossible de réinitialiser: aucun utilisateur Firebase connecté.');
      return;
    }
    try {
      const gameDocRef = doc(db, 'games', firebaseUser.uid);
      await deleteDoc(gameDocRef);
      console.log('🔄 Jeu réinitialisé et supprimé de Firestore');
    } catch (error) {
      console.error('❌ Erreur lors de la suppression du jeu sur Firestore:', error);
    }
  };

  const saveGameStateToStorage = async (state: GameState) => {
    if (!firebaseUser) {
      console.warn('⚠️ Impossible de sauvegarder: aucun utilisateur Firebase connecté.');
      return;
    }
    try {
      // Utilisez l'UID de l'utilisateur comme ID de document pour sauvegarder son état de jeu unique
      const gameDocRef = doc(db, 'games', firebaseUser.uid);
      await setDoc(gameDocRef, { ...state, userId: firebaseUser.uid }, { merge: true }); // Merge pour mettre à jour partiellement
      console.log('✅ État du jeu sauvegardé sur Firestore pour l\'utilisateur:', firebaseUser.uid);
    } catch (error) {
      console.error('❌ Erreur sauvegarde état du jeu sur Firestore:', error);
    }
  };

  const saveGameState = async () => {
    await saveGameStateToStorage(gameState);
  };

  const loadGameState = async () => {
    if (!firebaseUser) {
      console.warn('⚠️ Impossible de charger: aucun utilisateur Firebase connecté.');
      return;
    }
    try {
      const gameDocRef = doc(db, 'games', firebaseUser.uid);
      const gameDoc = await getDoc(gameDocRef);

      if (gameDoc.exists()) {
        const loadedState = gameDoc.data() as GameState;
        // Ne charger que si le jeu était actif et pas trop ancien (moins de 24h)
        if (loadedState.isGameActive && loadedState.gameId) {
          const gameAge = Date.now() - loadedState.gameId;
          const oneDayInMs = 24 * 60 * 60 * 1000;
          
          if (gameAge < oneDayInMs) {
            setGameState(loadedState);
            console.log('✅ État du jeu restauré depuis Firestore');
          } else {
            console.log('⚠️ Partie trop ancienne sur Firestore, réinitialisation');
            await deleteDoc(gameDocRef); // Supprimer l'ancienne partie
            setGameState(initialGameState); // Réinitialiser l'état local
          }
        } else {
          // Si le document existe mais que le jeu n'est pas actif, le supprimer
          await deleteDoc(gameDocRef);
          setGameState(initialGameState);
        }
      } else {
        console.log('ℹ️ Aucun état de jeu trouvé sur Firestore pour l\'utilisateur:', firebaseUser.uid);
        setGameState(initialGameState); // S'assurer que l'état local est initial
      }
    } catch (error) {
      console.error('❌ Erreur chargement état du jeu depuis Firestore:', error);
      setGameState(initialGameState); // En cas d'erreur, revenir à l'état initial
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

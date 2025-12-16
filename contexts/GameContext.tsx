import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, GAME_CONFIG } from '../constants';
import { PlayerScores, Player } from '../types';
import { useAuth } from './AuthContext';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  deleteDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  arrayUnion, 
  arrayRemove 
} from 'firebase/firestore'; 
import { app } from '../services/FirebaseService';
import UserService from '../services/UserService'; // To get user profile info

interface GameState {
  currentRound: number;
  playerScores: PlayerScores;
  playedTracks: string[];
  category: string;
  gameId: number | null;
  isGameActive: boolean;
  userId?: string; 
  // Multiplayer fields
  roomCode?: string;
  hostId?: string;
  players: Player[];
  status: 'waiting' | 'playing' | 'finished';
}

interface GameContextType extends GameState {
  startNewGame: (category: string) => void;
  nextRound: () => void;
  updatePlayerScore: (playerId: string, score: number) => void;
  addPlayedTrack: (trackId: string) => void;
  resetGame: () => Promise<void>;
  saveGameState: () => Promise<void>;
  loadGameState: () => Promise<void>;
  // Multiplayer methods
  createGame: () => Promise<string>; // Returns room code
  joinGame: (code: string) => Promise<boolean>;
  leaveGame: () => Promise<void>;
  isHost: boolean;
  activeGameDocId: string | null;
}

const initialGameState: GameState = {
  currentRound: 1,
  playerScores: {},
  playedTracks: [],
  category: 'TOP_RECENT',
  gameId: null,
  isGameActive: false,
  userId: undefined,
  roomCode: undefined,
  hostId: undefined,
  players: [],
  status: 'waiting',
};

const GameContext = createContext<GameContextType | undefined>(undefined);

// Initialize Firestore
const db = getFirestore(app);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const { firebaseUser, isLoading: isAuthLoading, accessToken } = useAuth();
  
  // Track which document we are listening to (Host UID)
  const [activeGameDocId, setActiveGameDocId] = useState<string | null>(null);

  // Helper: Generate 4-digit code
  const generateRoomCode = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
  };

  // 1. LISTENER: Listen to the active game document (Host or Joined)
  useEffect(() => {
    let unsubscribe: () => void;

    if (!isAuthLoading && activeGameDocId) {
      console.log(`🎧 Start listening to game: ${activeGameDocId}`);
      const gameDocRef = doc(db, 'games', activeGameDocId);
      
      unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const firestoreState = docSnap.data() as GameState;
          
          // Basic sync: Update local state from Firestore
          // We intentionally overwrite local state to keep everyone in sync
          setGameState(prevState => {
             if (JSON.stringify(prevState) !== JSON.stringify(firestoreState)) {
                 console.log('🔄 Game State Synced from Firestore');
                 return firestoreState;
             }
             return prevState;
          });

        } else {
          console.log('⚠️ Game document deleted. Resetting.');
          setGameState(initialGameState);
          setActiveGameDocId(null);
        }
      }, (error) => {
        console.error('❌ Firestore listener error:', error);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
        console.log('🔌 Listener disconnected');
      }
    };
  }, [activeGameDocId, isAuthLoading]);

  // 2. CREATE GAME (HOST)
  const createGame = async (): Promise<string> => {
    if (!firebaseUser) throw new Error("Must be logged in");

    const code = generateRoomCode();
    
    // Get Host Profile
    let hostName = "Hôte";
    let hostImage = undefined;
    
    // Try to get cached profile or fetch if possible
    if (accessToken) {
       const userProfile = await UserService.fetchUserProfile(accessToken, firebaseUser.uid);
       if (userProfile.success && userProfile.user) {
           hostName = userProfile.user.display_name;
           hostImage = userProfile.user.images?.[0]?.url;
       }
    }

    const hostPlayer: Player = {
        id: firebaseUser.uid,
        name: hostName,
        image: hostImage || undefined, // undefined is problematic for Firestore if not ignored, let's use null or omit if strict
        color: '#1DB954', // Spotify Green
        emoji: '👑'
    };

    // Firestore clean object
    const cleanHostPlayer = JSON.parse(JSON.stringify(hostPlayer));

    const newGame: GameState = {
      ...initialGameState,
      gameId: Date.now(),
      isGameActive: true,
      userId: firebaseUser.uid,
      roomCode: code,
      hostId: firebaseUser.uid,
      players: [cleanHostPlayer],
      status: 'waiting',
      playerScores: { [firebaseUser.uid]: 0 }
    };

    // Save to Firestore (Doc ID = Host UID)
    await setDoc(doc(db, 'games', firebaseUser.uid), newGame);
    
    setGameState(newGame);
    setActiveGameDocId(firebaseUser.uid);
    console.log(`✅ Game Created. Code: ${code}`);
    return code;
  };

  // 3. JOIN GAME (GUEST)
  const joinGame = async (code: string): Promise<boolean> => {
    if (!firebaseUser) return false;

    console.log(`🔍 Searching for room: ${code}`);
    const q = query(collection(db, 'games'), where("roomCode", "==", code));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.warn("❌ Room not found");
      return false;
    }

    const gameDoc = querySnapshot.docs[0];
    const gameData = gameDoc.data() as GameState;
    const hostUid = gameDoc.id;

    // Check if already in
    const isAlreadyJoined = gameData.players.some(p => p.id === firebaseUser.uid);

    if (!isAlreadyJoined) {
        // Get Guest Profile
        let guestName = "Invité";
        let guestImage = undefined;
        if (accessToken) {
             const userProfile = await UserService.fetchUserProfile(accessToken, firebaseUser.uid);
             if (userProfile.success && userProfile.user) {
                 guestName = userProfile.user.display_name;
                 guestImage = userProfile.user.images?.[0]?.url;
             }
        }

        const newPlayer: Player = {
            id: firebaseUser.uid,
            name: guestName,
            image: guestImage,
            color: '#'+(Math.random()*0xFFFFFF<<0).toString(16).padStart(6, '0'), // Random color
            emoji: '👋'
        };

        // Clean for Firestore
        const cleanNewPlayer = JSON.parse(JSON.stringify(newPlayer));

        // Add self to players list in Firestore
        await updateDoc(doc(db, 'games', hostUid), {
            players: arrayUnion(cleanNewPlayer),
            [`playerScores.${firebaseUser.uid}`]: 0 // Initialize score
        });
        console.log("✅ Joined game document");
    } else {
        console.log("ℹ️ Already in this game");
    }

    // Switch listener to Host's ID
    setActiveGameDocId(hostUid);
    return true;
  };

  // 4. LEAVE GAME
  const leaveGame = async () => {
    if (!firebaseUser || !activeGameDocId) return;

    if (activeGameDocId === firebaseUser.uid) {
        // I am Host -> End game? Or just reset?
        // For now, delete game
        await deleteDoc(doc(db, 'games', firebaseUser.uid));
        setActiveGameDocId(null);
        setGameState(initialGameState);
    } else {
        // I am Guest -> Remove myself
        const playerToRemove = gameState.players.find(p => p.id === firebaseUser.uid);
        if (playerToRemove) {
            await updateDoc(doc(db, 'games', activeGameDocId), {
                players: arrayRemove(playerToRemove)
            });
        }
        setActiveGameDocId(null);
        setGameState(initialGameState);
    }
  };

  // Legacy methods wrappers (Host only usually, but updated for sync)
  const startNewGame = (category: string) => {
    if (firebaseUser?.uid !== gameState.hostId) return; // Only host
    const updates = {
      category,
      isGameActive: true,
      status: 'playing',
      currentRound: 1,
      gameId: Date.now()
    };
    // Optimistic update
    setGameState(prev => ({ ...prev, ...updates } as GameState)); 
    // Firestore update
    if (activeGameDocId) {
        updateDoc(doc(db, 'games', activeGameDocId), updates);
    }
  };

  const nextRound = () => {
    if (firebaseUser?.uid !== gameState.hostId) return; // Only host
    if (gameState.currentRound >= GAME_CONFIG.MAX_ROUNDS) {
         updateDoc(doc(db, 'games', activeGameDocId!), { isGameActive: false, status: 'finished' });
         return;
    }
    const updates = { currentRound: gameState.currentRound + 1 };
    updateDoc(doc(db, 'games', activeGameDocId!), updates);
  };

  const updatePlayerScore = (playerId: string, score: number) => {
    // Anyone can update their own score, or host updates all?
    // Usually game logic: verifying answer. 
    // Let's assume this is called when a player answers correctly.
    // If it's *my* score, I update it.
    
    // Calculate new score locally first for speed
    const currentScore = gameState.playerScores[playerId] || 0;
    const newScore = currentScore + score;
    
    if (activeGameDocId) {
        updateDoc(doc(db, 'games', activeGameDocId), {
            [`playerScores.${playerId}`]: newScore
        });
    }
  };

  const addPlayedTrack = (trackId: string) => {
    if (firebaseUser?.uid !== gameState.hostId) return;
    if (activeGameDocId) {
        updateDoc(doc(db, 'games', activeGameDocId), {
            playedTracks: arrayUnion(trackId)
        });
    }
  };

  const resetGame = async () => {
     await leaveGame();
  };

  const saveGameState = async () => { /* No-op now, handled by updates */ };
  const loadGameState = async () => { 
      // Check if we have an active game in memory/cache? 
      // For now, rely on create/join to set activeGameDocId
      // Potential improvement: Check Firestore if I'm already hosting
      if (firebaseUser) {
          const docSnap = await getDoc(doc(db, 'games', firebaseUser.uid));
          if (docSnap.exists()) {
             // I was hosting a game
             setActiveGameDocId(firebaseUser.uid);
          }
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
    createGame,
    joinGame,
    leaveGame,
    isHost: firebaseUser?.uid === gameState.hostId,
    activeGameDocId
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

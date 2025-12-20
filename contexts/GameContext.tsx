import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { doc, onSnapshot, setDoc, query, collection, where, getDocs, updateDoc, arrayUnion, deleteDoc, arrayRemove, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/FirebaseService';
import { useAuth } from './AuthContext';
import UserService from '../services/UserService';
import MusicService from '../services/MusicService';
import { getBestImage, getRandomColor, getRandomEmoji } from '../utils/userUtils';
import { GameTrack, PlayerScores, Player, SpotifyTrack } from '../types';

interface GameState {
  currentRound: number;
  playerScores: PlayerScores;
  playedTracks: string[];
  category: string;
  gameId: number | null;
  isGameActive: boolean;
  userId?: string;
  roomCode?: string;
  hostId?: string;
  players: Player[];
  status: 'waiting' | 'READY' | 'playing' | 'finished';
  currentTrack?: any;
  playlist?: GameTrack[]; // Verified sequence of tracks
  trackPool: SpotifyTrack[];
  setup: {
    tracksPrepared: boolean;
    preparedAt?: any;
  };
}

interface GameContextType extends GameState {
  startNewGame: (category: string) => void;
  markSetupAsComplete: () => void;
  returnToLobby: () => Promise<void>;
  nextRound: () => void;
  updatePlayerScore: (playerId: string, score: number) => void;
  addPlayedTrack: (trackId: string) => void;
  setGameTrack: (track: any) => void;
  setGamePlaylist: (playlist: GameTrack[]) => void;
  addToTrackPool: (tracks: SpotifyTrack[]) => Promise<void>;
  addBots: () => Promise<void>;
  resetGame: () => Promise<void>;
  createGame: () => Promise<string>;
  joinGame: (code: string) => Promise<boolean>;
  leaveGame: () => Promise<void>;
  isHost: boolean;
  activeGameDocId: string | null;
}

const getInitialGameState = (): GameState => ({
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
  currentTrack: null,
  playlist: [],
  trackPool: [],
  setup: {
    tracksPrepared: false,
  },
});

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [gameState, setGameState] = useState<GameState>(getInitialGameState());
  const { firebaseUser, isLoading: isAuthLoading, accessToken } = useAuth();
  const [activeGameDocId, setActiveGameDocId] = useState<string | null>(null);
  
  // Optimistic local storage for played tracks to avoid latency issues
  const [localPlayedTracks, setLocalPlayedTracks] = useState<Set<string>>(new Set());

  useEffect(() => {
    let unsubscribe: () => void;
    if (!isAuthLoading && activeGameDocId && firebaseUser) {
      console.log(`🔥 [GameContext] Subscribing to game doc: ${activeGameDocId}`);
      const gameDocRef = doc(db, 'games', activeGameDocId);
      unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const firestoreState = docSnap.data() as GameState;
          console.log(`🔥 [GameContext] Snapshot received! Status: ${firestoreState.status}, Round: ${firestoreState.currentRound}, Track: ${firestoreState.currentTrack?.title}`);
          setGameState(firestoreState);
        } else {
          console.log("🔥 [GameContext] Game document does not exist (or was deleted). Resetting state.");
          setGameState(getInitialGameState());
          setActiveGameDocId(null);
          setLocalPlayedTracks(new Set()); // Clear local history on reset
        }
      });
    }
    return () => {
      if (unsubscribe) {
          console.log("🔥 [GameContext] Unsubscribing from game doc.");
          unsubscribe();
      }
    };
  }, [activeGameDocId, isAuthLoading, firebaseUser]);

  const createGame = async (): Promise<string> => {
    if (!firebaseUser) throw new Error("Must be logged in");
    console.log("🔥 [GameContext] Creating new game...");
    
    setLocalPlayedTracks(new Set()); 
    MusicService.reset(); // Clear music history

    if (activeGameDocId || gameState.roomCode) {
      await leaveGame();
      await new Promise(r => setTimeout(r, 150));
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const userProfile = accessToken ? await UserService.fetchUserProfile(accessToken, firebaseUser.uid) : null;
    const hostPlayer: Player = {
      id: firebaseUser.uid,
      name: userProfile?.user?.display_name || "Hôte",
      image: userProfile?.user ? getBestImage(userProfile.user.images) : undefined,
      color: getRandomColor(),
      emoji: getRandomEmoji()
    };

    const newGame: GameState = {
      ...getInitialGameState(),
      gameId: Date.now(),
      userId: firebaseUser.uid, // Explicitly set userId
      isGameActive: true,      // Explicitly set game as active
      roomCode: code,
      hostId: firebaseUser.uid,
      players: [JSON.parse(JSON.stringify(hostPlayer))],
      playerScores: { [firebaseUser.uid]: 0 }
    };

    try {
        await setDoc(doc(db, 'games', firebaseUser.uid), newGame);
        setGameState(newGame);
        setActiveGameDocId(firebaseUser.uid);
        console.log(`🔥 [GameContext] Game created with code: ${code}`);
        return code;
    } catch(e) {
        console.error("🔥 [GameContext] Create Game Error:", e);
        throw e;
    }
  };

  const joinGame = async (code: string): Promise<boolean> => {
    console.log(`🔥 [GameContext] Attempting to join game with code: ${code}`);
    if (!firebaseUser) return false;

    const q = query(collection(db, 'games'), where("roomCode", "==", code));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        console.warn("🔥 [GameContext] No game found with this code.");
        return false;
    }

    const gameDoc = querySnapshot.docs[0];
    const gameData = gameDoc.data() as GameState;
    const hostUid = gameDoc.id;

    if (!gameData.players.some(p => p.id === firebaseUser.uid)) {
      const userProfile = accessToken ? await UserService.fetchUserProfile(accessToken, firebaseUser.uid) : null;
      const newPlayer: Player = {
        id: firebaseUser.uid,
        name: userProfile?.user?.display_name || "Invité",
        image: userProfile?.user ? getBestImage(userProfile.user.images) : undefined,
        color: getRandomColor(),
        emoji: getRandomEmoji()
      };
      await updateDoc(doc(db, 'games', hostUid), {
          players: arrayUnion(JSON.parse(JSON.stringify(newPlayer))),
          [`playerScores.${firebaseUser.uid}`]: 0
      });
      console.log("🔥 [GameContext] Player added to game.");
    }
    setActiveGameDocId(hostUid);
    return true;
  };

  const leaveGame = async () => {
    console.log("🔥 [GameContext] Leaving game...");
    if (!firebaseUser || !activeGameDocId) return;
    try {
      if (activeGameDocId === firebaseUser.uid) {
        console.log("🔥 [GameContext] Host leaving -> Deleting game doc.");
        await deleteDoc(doc(db, 'games', firebaseUser.uid));
      } else {
        const playerToRemove = gameState.players.find(p => p.id === firebaseUser.uid);
        if (playerToRemove) {
          console.log("🔥 [GameContext] Player leaving -> Removing from player list.");
          await updateDoc(doc(db, 'games', activeGameDocId), {
            players: arrayRemove(playerToRemove)
          });
        }
      }
    } catch(e) {
      console.warn("🔥 [GameContext] Error during leaveGame (ignoring):", e);
    } finally {
      setActiveGameDocId(null);
      setGameState(getInitialGameState());
      setLocalPlayedTracks(new Set()); // CRITICAL: Reset local played tracks history
    }
  };

  const markSetupAsComplete = () => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log("🔥 [GameContext] Marking setup as complete.");
    updateDoc(doc(db, 'games', activeGameDocId), {
      "setup.tracksPrepared": true,
      "setup.preparedAt": serverTimestamp(),
      status: 'READY'
    });
  };

  const returnToLobby = async () => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log("🔥 [GameContext] Returning to lobby and resetting game data...");
    
    MusicService.reset(); // Reset local music state

    // Reset all player scores to 0
    const resetScores: PlayerScores = {};
    gameState.players.forEach(p => {
        resetScores[p.id] = 0;
    });

    await updateDoc(doc(db, 'games', activeGameDocId), {
      status: 'waiting', // Change to waiting to allow fresh track loading
      currentRound: 1,
      playerScores: resetScores,
      playedTracks: [],
      currentTrack: null,
      playlist: [], // Clear old playlist
      trackPool: [], // Clear old pool
      isGameActive: true,
      "setup.tracksPrepared": false // Allow reloading tracks
    });
  };

  const startNewGame = (category: string) => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log(`🔥 [GameContext] Starting new game. Category: ${category}`);
    const updates = {
      category,
      status: 'playing',
      currentRound: 1,
      gameId: Date.now(),
      playedTracks: [], // Reset played tracks for new match
      currentTrack: null // Reset shared track
    };
    updateDoc(doc(db, 'games', activeGameDocId), updates);
  };

  const nextRound = () => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log(`🔥 [GameContext] Requesting next round. Current: ${gameState.currentRound}`);
    if (gameState.currentRound >= (gameState.players.length * 2)) { // Example logic
      updateDoc(doc(db, 'games', activeGameDocId), { status: 'finished' });
    } else {
      updateDoc(doc(db, 'games', activeGameDocId), { currentRound: gameState.currentRound + 1 });
    }
  };

  const updatePlayerScore = (playerId: string, score: number) => {
    if (!activeGameDocId) return;
    console.log(`🔥 [GameContext] Updating score for ${playerId}: +${score}`);
    const currentScore = gameState.playerScores[playerId] || 0;
    updateDoc(doc(db, 'games', activeGameDocId), { [`playerScores.${playerId}`]: currentScore + score });
  };

  const addPlayedTrack = (trackId: string) => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    
    // Optimistic update
    setLocalPlayedTracks(prev => {
        const newSet = new Set(prev);
        newSet.add(trackId);
        return newSet;
    });
    
    updateDoc(doc(db, 'games', activeGameDocId), { playedTracks: arrayUnion(trackId) });
  };

  const setGameTrack = (track: any) => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log(`🔥 [GameContext] Setting shared game track: ${track?.title || 'NULL'}`);
    updateDoc(doc(db, 'games', activeGameDocId), { currentTrack: track });
  };

  const setGamePlaylist = (playlist: GameTrack[]) => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log(`🔥 [GameContext] Setting shared game playlist: ${playlist.length} tracks`);
    updateDoc(doc(db, 'games', activeGameDocId), { playlist });
  };

  const addToTrackPool = async (tracks: SpotifyTrack[]) => {
    if (!activeGameDocId) throw new Error("Game document not active");
    const cleanTracks = tracks.slice(0, 50).map(t => JSON.parse(JSON.stringify(t)));
    await updateDoc(doc(db, 'games', activeGameDocId), { trackPool: arrayUnion(...cleanTracks) });
  };

  const addBots = async () => {
    if (!activeGameDocId || firebaseUser?.uid !== gameState.hostId) return;
    const bots: Player[] = Array.from({length: 3}).map((_, i) => ({
      id: `bot-${i+1}-${Date.now()}`, name: `Bot ${i+1}`, color: getRandomColor(), emoji: "🤖"
    }));
    const cleanBots = bots.map(b => JSON.parse(JSON.stringify(b)));
    const botScoreUpdates = Object.fromEntries(bots.map(b => [`playerScores.${b.id}`, 0]));
    await updateDoc(doc(db, 'games', activeGameDocId), {
        players: arrayUnion(...cleanBots),
        ...botScoreUpdates
    });
  };

  const resetGame = async () => { await leaveGame(); };

  // Merge Firestore state with optimistic local state
  const mergedPlayedTracks = Array.from(new Set([
      ...gameState.playedTracks,
      ...Array.from(localPlayedTracks)
  ]));

  const value: GameContextType = {
    ...gameState,
    playedTracks: mergedPlayedTracks, // Use merged list
    startNewGame,
    markSetupAsComplete,
    returnToLobby,
    nextRound,
    updatePlayerScore,
    addPlayedTrack,
    setGameTrack,
    setGamePlaylist,
    addToTrackPool,
    addBots,
    resetGame,
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
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
};

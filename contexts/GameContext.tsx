import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import { doc, onSnapshot, setDoc, query, collection, where, getDocs, updateDoc, arrayUnion, deleteDoc, arrayRemove, getDoc, serverTimestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../services/FirebaseService';
import { useAuth } from './AuthContext';
import UserService from '../services/UserService';
import MusicService from '../services/MusicService';
import { getBestImage, getRandomColor, getRandomEmoji } from '../utils/userUtils';
import { GameTrack, PlayerScores, Player, SpotifyTrack } from '../types';

const LAST_GAME_ID_KEY = 'last_active_game_id';

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
  status: 'waiting' | 'READY' | 'playing' | 'revealing' | 'finished';
  currentTrack?: GameTrack | null;
  playlist?: GameTrack[]; // Verified sequence of tracks
  trackPool: SpotifyTrack[];
  votes: string[]; // Track who voted in the current round
  readyPlayers: string[]; // Players who clicked "Next" in Reveal
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
  markPlayerReady: () => void;
  updatePlayerScore: (playerId: string, score: number) => void;
  registerVote: (playerId: string) => void;
  addPlayedTrack: (trackId: string) => void;
  setGameTrack: (track: GameTrack | null) => void;
  setGamePlaylist: (playlist: GameTrack[]) => void;
  setGameCategory: (category: string) => Promise<void>;
  addToTrackPool: (tracks: SpotifyTrack[]) => Promise<void>;
  addBot: () => Promise<void>;
  resetGame: () => Promise<void>;
  createGame: () => Promise<string>;
  joinGame: (code: string) => Promise<boolean>;
  tryRejoinLastGame: () => Promise<boolean>;
  leaveGame: () => Promise<void>;
  kickPlayer: (playerId: string) => Promise<void>;
  startRoundAction: () => void; // New action to manually trigger "playing" status
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
  votes: [],
  readyPlayers: [],
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

  // --- 💾 RECONNECTION LOGIC: Save/Clear last active game ---
  useEffect(() => {
    if (activeGameDocId) {
        console.log(`💾 [RECONNECT] Saving last game ID: ${activeGameDocId}`);
        AsyncStorage.setItem(LAST_GAME_ID_KEY, activeGameDocId);
    } else {
        console.log(`💾 [RECONNECT] Clearing last game ID.`);
        AsyncStorage.removeItem(LAST_GAME_ID_KEY);
    }
  }, [activeGameDocId]);

  useEffect(() => {
    let unsubscribe: () => void;
    if (!isAuthLoading && activeGameDocId && firebaseUser) {
      console.log(`🔥 [GameContext] Subscribing to game doc: ${activeGameDocId}`);
      const gameDocRef = doc(db, 'games', activeGameDocId);
      unsubscribe = onSnapshot(gameDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const firestoreState = docSnap.data() as GameState;
          const source = docSnap.metadata.hasPendingWrites ? "Local" : "Server";
          
          console.log(`🔍 [CTX] 🔥 SNAPSHOT RECEIVED from Firestore! 
          > 📡 Source: ${source}
          > DocID: ${gameDocRef.id}
          > Status: ${firestoreState.status}
          > Round: ${firestoreState.currentRound}
          > Host: ${firestoreState.hostId}
          > PlaylistSize: ${firestoreState.playlist?.length}
          > CurrentTrack: ${firestoreState.currentTrack?.title}
          `);

          // 🛡️ Protection anti-rollback : ignorer les snapshots périmés (Round X -> Round X-1)
          // Sauf si c'est un reset de partie (gameId différent ou status 'waiting')
          /* 
          // [SECURITY FIX] Removed client-side rollback protection to allow server (Host) to correct state.
          if (firestoreState.gameId === gameState.gameId && 
              firestoreState.status !== 'waiting' &&
              firestoreState.currentRound < gameState.currentRound) {
             console.warn(`🔍 [CTX] 🛑 IGNORING STALE SNAPSHOT. Local Round: ${gameState.currentRound}, Received: ${firestoreState.currentRound}`);
             return;
          }
          */

          // HOST LOGIC: Check if all players have voted (during playing)
          if (firestoreState.hostId === firebaseUser.uid && 
              firestoreState.status === 'playing' && 
              firestoreState.votes && 
              firestoreState.votes.length >= firestoreState.players.length) {
              console.log(`🔍 [CTX] 🗳️ ALL VOTES RECEIVED. Switching to REVEALING.`);
              updateDoc(doc(db, 'games', firestoreState.hostId), { status: 'revealing' });
          }

          // HOST LOGIC: Check if all players are READY for next round (during revealing)
          if (firestoreState.hostId === firebaseUser.uid &&
              firestoreState.status === 'revealing' &&
              firestoreState.readyPlayers &&
              firestoreState.readyPlayers.length >= firestoreState.players.length) {
              console.log(`🔍 [CTX] 🚀 ALL PLAYERS READY (${firestoreState.readyPlayers.length}). Auto-starting next round.`);
              
              // Direct update to avoid circular dependency with nextRound function if defined below
              // But we can just duplicate the nextRound logic here for safety or move nextRound up.
              // Simpler: Just do the update.
              updateDoc(doc(db, 'games', firestoreState.hostId), { 
                currentRound: firestoreState.currentRound + 1,
                votes: [], 
                readyPlayers: [], // Reset ready status
                status: 'playing' 
              });
          }

          setGameState(firestoreState);
        } else {
          console.log("🔍 [CTX] 🗑️ Game document does not exist (or was deleted). Resetting state.");
          setGameState(getInitialGameState());
          setActiveGameDocId(null);
          setLocalPlayedTracks(new Set()); // Clear local history on reset
        }
      });
    }
    return () => {
      if (unsubscribe) {
          console.log("🔍 [CTX] 🔌 Unsubscribing from game doc.");
          unsubscribe();
      }
    };
  }, [activeGameDocId, isAuthLoading, firebaseUser]);

  const createGame = async (): Promise<string> => {
    // ... (rest of createGame remains same, just ensure context is preserved if needed, but here we focus on snapshot/nextRound)
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
      userId: firebaseUser.uid, 
      isGameActive: true,      
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

    // IMPORTANT FOR RECONNECT: We don't re-add the player if they're already in the list.
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

  const tryRejoinLastGame = async (): Promise<boolean> => {
    console.log("💾 [RECONNECT] Trying to rejoin last game...");
    const lastGameId = await AsyncStorage.getItem(LAST_GAME_ID_KEY);
    if (!lastGameId) {
      console.log("💾 [RECONNECT] No last game ID found.");
      return false;
    }

    const gameDocRef = doc(db, 'games', lastGameId);
    const gameDocSnap = await getDoc(gameDocRef);

    if (gameDocSnap.exists()) {
      console.log("💾 [RECONNECT] ✅ Game still exists! Re-joining...");
      setActiveGameDocId(lastGameId);
      return true;
    } else {
      console.log("💾 [RECONNECT] ❌ Game does not exist anymore. Clearing stored ID.");
      await AsyncStorage.removeItem(LAST_GAME_ID_KEY);
      return false;
    }
  };

  const kickPlayer = async (playerId: string) => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    const playerToRemove = gameState.players.find(p => p.id === playerId);
    if (!playerToRemove) return;

    console.log(`🔥 [GameContext] Kicking player: ${playerId}`);
    try {
        await updateDoc(doc(db, 'games', activeGameDocId), {
            players: arrayRemove(playerToRemove),
            // Remove traces to clean up
            votes: arrayRemove(playerId),
            readyPlayers: arrayRemove(playerId)
        });
    } catch(e) {
        console.error("Error kicking player:", e);
    }
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
          console.log("🔥 [GameContext] Player leaving -> Removing from player list, votes and ready status.");
          await updateDoc(doc(db, 'games', activeGameDocId), {
            players: arrayRemove(playerToRemove),
            votes: arrayRemove(firebaseUser.uid),       // Remove their vote if any
            readyPlayers: arrayRemove(firebaseUser.uid) // Remove their ready status if any
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

  const markPlayerReady = () => {
    if (!activeGameDocId || !firebaseUser) return;
    console.log(`🔥 [GameContext] Player ${firebaseUser.uid} is ready for next round.`);
    updateDoc(doc(db, 'games', activeGameDocId), { readyPlayers: arrayUnion(firebaseUser.uid) });
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
      votes: [], // Clear votes
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
      votes: [], // Clear votes
      currentTrack: null // Reset shared track
    };
    updateDoc(doc(db, 'games', activeGameDocId), updates);
  };

  const nextRound = async () => {
    console.log(`🔍 [CTX] 👉 nextRound CALLED! 
    > IsHost: ${firebaseUser?.uid === gameState.hostId}
    > ActiveDoc: ${activeGameDocId}
    > CurrentStatus: ${gameState.status}
    > CurrentRound: ${gameState.currentRound}`);

    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) {
        console.warn("🔍 [CTX] ❌ nextRound ABORTED: Not Host or No Active Game.");
        return;
    }
    
    // GUARD: If game is already finished, do NOT proceed
    if (gameState.status === 'finished') {
        console.warn("🔍 [CTX] 🛑 nextRound ABORTED: Game is already finished.");
        return;
    }

    console.log(`🔥 [GameContext] MASTER: Launching Round ${gameState.currentRound + 1}`);

    // 1. D'abord on reset tout le monde en "Attente" pour éviter les faux départs
    // [ARCH FIX] Removed setTimeout race condition. 
    // The Host's GameScreen will now detect 'waiting', prepare the track, 
    // and THEN call startRoundAction() to switch to 'playing'.
    await updateDoc(doc(db, 'games', activeGameDocId), {
        status: 'waiting', // Tout le monde se met en pause
        currentTrack: null, // On nettoie la musique précédente
        "setup.tracksPrepared": false, // On signale qu'on cherche une nouvelle musique
        currentRound: gameState.currentRound + 1, // We increment immediately so everyone knows where we are
        votes: [], 
        readyPlayers: [], 
    });
  };

  const startRoundAction = async () => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log("🔥 [GameContext] MASTER: Starting the round (Switching to PLAYING).");
    await updateDoc(doc(db, 'games', activeGameDocId), {
        status: 'playing' 
    });
  };

  const updatePlayerScore = (playerId: string, score: number) => {
    if (!activeGameDocId) return;
    console.log(`🔥 [GameContext] Updating score for ${playerId}: +${score}`);
    const currentScore = gameState.playerScores[playerId] || 0;
    updateDoc(doc(db, 'games', activeGameDocId), { [`playerScores.${playerId}`]: currentScore + score });
  };

  const registerVote = (playerId: string) => {
    if (!activeGameDocId) return;
    console.log(`🔥 [GameContext] Registering vote for ${playerId}`);
    updateDoc(doc(db, 'games', activeGameDocId), { votes: arrayUnion(playerId) });
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

  const setGameCategory = async (category: string) => {
    if (firebaseUser?.uid !== gameState.hostId || !activeGameDocId) return;
    console.log(`🔥 [GameContext] Updating game category to: ${category}`);
    
    // Changing category resets the pool and setup status to allow everyone to contribute new tracks
    await updateDoc(doc(db, 'games', activeGameDocId), { 
        category,
        trackPool: [], 
        "setup.tracksPrepared": false,
        status: 'waiting'
    });
  };

  const addToTrackPool = async (tracks: SpotifyTrack[]) => {
    if (!activeGameDocId) throw new Error("Game document not active");
    const cleanTracks = tracks.slice(0, 50).map(t => JSON.parse(JSON.stringify(t)));
    await updateDoc(doc(db, 'games', activeGameDocId), { trackPool: arrayUnion(...cleanTracks) });
  };

  const addBot = async () => {
    if (!activeGameDocId || firebaseUser?.uid !== gameState.hostId) return;
    
    const botCount = gameState.players.filter(p => p.id.startsWith('bot-')).length;
    const newBot: Player = {
      id: `bot-${Date.now()}`, 
      name: `Bot ${botCount + 1}`, 
      color: getRandomColor(), 
      emoji: "🤖"
    };
    
    const cleanBot = JSON.parse(JSON.stringify(newBot));
    await updateDoc(doc(db, 'games', activeGameDocId), {
        players: arrayUnion(cleanBot),
        [`playerScores.${newBot.id}`]: 0
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
    markPlayerReady,
    updatePlayerScore,
    registerVote,
    addPlayedTrack,
    setGameTrack,
    setGamePlaylist,
    setGameCategory,
    addToTrackPool,
    addBot,
    resetGame,
    createGame,
    joinGame,
    tryRejoinLastGame,
    leaveGame,
    kickPlayer,
    startRoundAction,
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

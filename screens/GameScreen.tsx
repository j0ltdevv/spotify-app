import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Alert, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { GAME_CONFIG, COLORS } from '../constants';
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
import SoundManager from '../utils/SoundManager';
import { GameTrack, PlayerScores } from '../types';
import CircularTimer from '../components/CircularTimer';
import GlassCard from '../components/GlassCard';
import PressableCard from '../components/PressableCard';
import Logger from '../utils/logger';

const { width } = Dimensions.get('window');

export default function GameScreen(props: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Game'>;
  route: RouteProp<RootStackParamList, 'Game'>;
}) {
  const { navigation, route } = props;
  const { 
    isHost, 
    status: gameStatus,
    setGameTrack, 
    currentTrack: sharedTrack, 
    trackPool, 
    players, 
    leaveGame, 
    updatePlayerScore,
    addPlayedTrack,
    playedTracks: contextPlayedTracks
  } = useGame();
  
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();

  const { round = 1, category = 'TOP_RECENT', playerScores: initialScores, maxRounds = GAME_CONFIG.MAX_ROUNDS } = (route.params || {}) as any;
  
  const [currentTrack, setCurrentTrack] = useState<GameTrack | null>(null);
  // Ref to hold the latest track object to avoid closure staleness in setInterval/timeouts
  const currentTrackRef = useRef<GameTrack | null>(null);

  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.INITIAL_TIME);
  const timeLeftRef = useRef(GAME_CONFIG.INITIAL_TIME); // ✅ Ref for synchronous timer access

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [playerScores, setPlayerScores] = useState<PlayerScores>(initialScores || {});
  const [screenStatus, setScreenStatus] = useState< 'PREPARING_ROUND' | 'PLAYING' | 'VOTED'>('PREPARING_ROUND');
  
  const roundLock = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const anims = { loadingIcon: useRef(new Animated.Value(1)).current };

  // Sync ref with state for track
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // --- 🔥 ROBUST TIMER LOGIC ---
  // This effect is the ONLY master of time. It starts/stops based on screen status.
  useEffect(() => {
    // 1. Always clear existing timer first (Zombie killer)
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }

    // 2. Only start if we are strictly in PLAYING mode
    if (screenStatus === 'PLAYING') {
        console.log("🎮 [GameScreen] Status is PLAYING -> Starting NEW Timer.");
        
        // Reset values
        timeLeftRef.current = GAME_CONFIG.INITIAL_TIME;
        setTimeLeft(GAME_CONFIG.INITIAL_TIME);

        timerRef.current = setInterval(() => {
            timeLeftRef.current -= 1;
            setTimeLeft(timeLeftRef.current); // Update UI

            if (timeLeftRef.current <= 0) {
                console.log("🎮 [GameScreen] Timer finished naturally.");
                if (timerRef.current) clearInterval(timerRef.current);
                handleTimeOut();
            }
        }, 1000);
    } else {
        console.log(`🎮 [GameScreen] Status is ${screenStatus} -> Timer stopped.`);
    }

    // 3. Cleanup on unmount or status change
    return () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };
  }, [screenStatus]); // Only re-run when status changes

  // --- Core Game Flow ---

  useFocusEffect(
    React.useCallback(() => {
      console.log(`🎮 [GameScreen] Focus Effect triggered. Round: ${round}, Status: ${gameStatus}`);
      if (gameStatus !== 'playing') return;
      if (round > maxRounds) {
        const results = players.map(p => ({
          name: p.name,
          score: playerScores[p.id] || 0,
          avatar: {
            color: p.color,
            emoji: p.emoji,
            image: p.image
          }
        })).sort((a, b) => b.score - a.score);

        navigation.replace('GameOver', { results });
        return;
      }
      if (roundLock.current === round) {
          console.log("🎮 [GameScreen] Round locked (already loaded), skipping loadRoundData.");
          return;
      }

      let isActive = true;
      const loadRoundData = async () => {
        console.log("🎮 [GameScreen] loadRoundData started...");
        if (!isHost || !isActive) return;
        
        roundLock.current = round;
        setScreenStatus('PREPARING_ROUND');
        setSelectedPlayer(null);
        setTimeLeft(GAME_CONFIG.INITIAL_TIME);
        
        // IMPORTANT: Reset shared track AND REF to avoid stale data triggering startRound early
        setGameTrack(null);
        currentTrackRef.current = null;

        try {
            if (trackPool.length === 0) {
            showToast("Le pot commun est vide !", "error");
            await leaveGame();
            navigation.navigate('Menu');
            return;
            }

            console.log("🎮 [GameScreen] Asking MusicService for a playable track...");
            const playableTrackResult = await MusicService.findPlayableTrack(trackPool, contextPlayedTracks);

            if (isActive && playableTrackResult.success && playableTrackResult.track) {
            console.log(`🎮 [GameScreen] Track found! Setting as GameTrack: ${playableTrackResult.track.title}`);
            setGameTrack(playableTrackResult.track);
            addPlayedTrack(playableTrackResult.track.id);
            } else if (isActive) {
            console.warn("🎮 [GameScreen] No playable track found.");
            showToast(playableTrackResult.error || "Aucune musique jouable trouvée.", "error");
            await leaveGame();
            navigation.navigate('Menu');
            }
        } catch (error) {
            Logger.error("Erreur critique loadRoundData", error);
            showToast("Erreur lors de la préparation de la manche.", "error");
            await leaveGame();
            navigation.navigate('Menu');
        }
      };

      loadRoundData();

      return () => {
        console.log("🎮 [GameScreen] Cleanup (Unfocus). Stopping sound.");
        isActive = false;
        if (timerRef.current) clearInterval(timerRef.current);
        SoundManager.stopSound();
      };
    }, [round, isHost, gameStatus, trackPool, contextPlayedTracks])
  );

  useEffect(() => {
    // Only start if we have a valid track, it's new, AND we are actually waiting for it
    console.log(`🎮 [GameScreen] SharedTrack Effect. Shared: ${sharedTrack?.id}, Current: ${currentTrack?.id}, ScreenStatus: ${screenStatus}`);
    
    if (sharedTrack && sharedTrack.id !== currentTrack?.id && screenStatus === 'PREPARING_ROUND') {
      console.log("🎮 [GameScreen] ✅ Condition met! Calling startRound.");
      startRound(sharedTrack as GameTrack);
    } else if (sharedTrack?.id === currentTrack?.id) {
        console.log("🎮 [GameScreen] ⏳ Skipping startRound: Track ID matches current track.");
    } else {
        console.log("🎮 [GameScreen] ⏳ Condition NOT met. Waiting...");
    }

    // Cleanup timer on unmount or track change to prevent ghost timers
    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [sharedTrack, screenStatus]);

  // --- Core Game Flow ---

  const startRound = async (track: GameTrack) => {
    console.log(`🎮 [GameScreen] startRound triggered for track: ${track.title} (ID: ${track.id})`);
    
    // Immediate ref update for safety
    currentTrackRef.current = track;
    setCurrentTrack(track);

    try {
      if (track.preview_url) {
        console.log("🎮 [GameScreen] Requesting SoundManager to play...");
        // Explicitly stop previous sound to be safe
        await SoundManager.stopSound();
        await SoundManager.playSound(track.preview_url, track.id);
      } else {
        console.warn("🎮 [GameScreen] No preview URL for this track.");
        showToast("Aucun extrait audio pour ce titre.", "info");
      }
      
      // ✅ This state change triggers the Timer useEffect above
      setScreenStatus('PLAYING'); 

    } catch (error) {
      Logger.error("Erreur en démarrant le son", { error, track });
      showToast("Cet extrait n'a pas pu être chargé.", "error");
      if (isHost) {
        roundLock.current = 0;
        navigation.replace('Game', { gameId: Date.now(), round, playerScores, category, maxRounds });
      }
    }
  };

  const handleVoteAction = async (playerId: string) => {
    console.log(`🎮 [GameScreen] Vote action for player: ${playerId}`);
    if (screenStatus !== 'PLAYING') return;
    
    setScreenStatus('VOTED');
    setSelectedPlayer(playerId);
    await SoundManager.stopSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    // Use REF here too just in case
    const track = currentTrackRef.current;
    
    const isCorrect = track?.correctPlayer === playerId;
    const score = isCorrect ? 500 + (timeLeft * 30) : 0;
    const myPlayerId = firebaseUser?.uid;
    const newScores = { ...playerScores };
    
    if (myPlayerId && score > 0) {
      newScores[myPlayerId] = (newScores[myPlayerId] || 0) + score;
      if (updatePlayerScore) updatePlayerScore(myPlayerId, score);
    }

    (navigation.navigate as any)('Reveal', { 
        correctPlayer: players.find(p => p.id === track?.correctPlayer)?.name || '?',
        track: track, // Pass null/track explicitly
        score, round, 
        playerScores: newScores, 
        previousScores: playerScores, // Add this
        selectedPlayer: playerId, category, maxRounds 
    });
  };

  const handleTimeOut = async () => {
    console.log("🎮 [GameScreen] handleTimeOut called.");
    
    // Use REF to get the latest track value, bypassing closure staleness
    const track = currentTrackRef.current;
    console.log(`🎮 [GameScreen] handleTimeOut using track: ${track?.title || 'NULL'}`);

    if (!track) {
        console.warn("⚠️ handleTimeOut blocked: No track available in ref. Ghost timer?");
        return;
    }

    await SoundManager.stopSound();
    setScreenStatus('VOTED');

    (navigation.navigate as any)('Reveal', { 
        correctPlayer: players.find(p => p.id === track?.correctPlayer)?.name || '?', 
        track: track, // Pass the ref value
        score: 0, round, 
        playerScores, 
        previousScores: playerScores, // Add this
        selectedPlayer: undefined, category, maxRounds 
    });
  };

  const handleQuit = () => {
    Alert.alert(
      "Quitter la partie",
      "Es-tu sûr de vouloir quitter ? Ta progression sera perdue.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Quitter", 
          style: "destructive", 
          onPress: async () => {
            await SoundManager.stopSound();
            if (timerRef.current) clearInterval(timerRef.current);
            await leaveGame();
            navigation.navigate('Menu');
          } 
        }
      ]
    );
  };

  if (screenStatus === 'PREPARING_ROUND') {
    return (
      <SafeContainer>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingTitle}>MANCHE {round}</Text>
          <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
          <Text style={styles.loadingText}>Préparation de la musique...</Text>
        </View>
      </SafeContainer>
    );
  }

  return (
    <SafeContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>
            <Ionicons name="close" size={24} color="#FF6B6B" />
          </TouchableOpacity>
          <Text style={styles.roundIndicator}>MANCHE {round} / {maxRounds}</Text>
          <View style={{ width: 40 }} /> 
        </View>
        <CircularTimer timeLeft={timeLeft} maxTime={GAME_CONFIG.INITIAL_TIME} />
        <View style={styles.playersGrid}>
          {players.map(p => (
            <PressableCard key={p.id} style={styles.playerVoteWrapper} onPress={() => handleVoteAction(p.id)}>
              <GlassCard style={[styles.playerVote, selectedPlayer === p.id && styles.playerVoteSelected]}>
                  {p.image ? (
                    <Image source={{ uri: p.image }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarImage, { backgroundColor: p.color || '#555', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: 40 }}>{p.emoji || '👤'}</Text>
                    </View>
                  )}
                  <Text style={styles.playerVoteName} numberOfLines={1}>{p.name}</Text>
                  {selectedPlayer === p.id && (
                    <View style={styles.checkmarkBadge}><Ionicons name="checkmark" size={18} color="#fff" /></View>
                  )}
              </GlassCard>
            </PressableCard>
          ))}
        </View>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 20, alignItems: 'center' },
  header: { 
    width: '100%', 
    marginBottom: 20, 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between' 
  },
  quitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  roundIndicator: { color: 'white', fontWeight: '800', fontSize: 20, textAlign: 'center', letterSpacing: 1 },
  playersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 'auto', paddingBottom: 20 },
  playerVoteWrapper: { width: '45%' },
  playerVote: { padding: 8, alignItems: 'center', borderWidth: 3, borderColor: 'transparent', borderRadius: 20 },
  playerVoteSelected: { borderColor: COLORS.SPOTIFY_GREEN },
  avatarImage: { width: 100, height: 100, borderRadius: 50, marginBottom: 8 },
  playerVoteName: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  checkmarkBadge: { position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.SPOTIFY_GREEN, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  loadingTitle: { fontSize: 24, fontWeight: '900', color: 'white', letterSpacing: 2 },
  loadingText: { fontSize: 18, fontWeight: '700', color: '#AAA' },
});

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Alert, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect, useIsFocused } from '@react-navigation/native';
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
  const isScreenFocused = useIsFocused();
  const { 
    isHost, 
    status: gameStatus,
    setGameTrack, 
    currentTrack: sharedTrack, 
    trackPool, 
    players, 
    leaveGame, 
    updatePlayerScore,
    registerVote, 
    addPlayedTrack,
    playedTracks: contextPlayedTracks,
    activeGameDocId,
    playlist
  } = useGame();
  
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useSettings();

  const { round = 1, category = 'TOP_RECENT', playerScores: initialScores, maxRounds = GAME_CONFIG.MAX_ROUNDS } = (route.params || {}) as any;
  
  // -- Automatic session cleanup --
  useEffect(() => {
    if (!activeGameDocId && gameStatus !== 'playing' && gameStatus !== 'revealing') {
      console.log("🎮 [GameScreen] No active game detected. Returning to Menu.");
      navigation.navigate('Menu');
    }
  }, [activeGameDocId, gameStatus]);

  const [currentTrack, setCurrentTrack] = useState<GameTrack | null>(null);
  const currentTrackRef = useRef<GameTrack | null>(null);

  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.INITIAL_TIME);
  const timeLeftRef = useRef(GAME_CONFIG.INITIAL_TIME);

  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [localScore, setLocalScore] = useState<number>(0); 
  const [hasVoted, setHasVoted] = useState(false); 
  const [playerScores, setPlayerScores] = useState<PlayerScores>(initialScores || {});
  const [screenStatus, setScreenStatus] = useState< 'PREPARING_ROUND' | 'PLAYING' | 'VOTED'>('PREPARING_ROUND');
  
  const roundLock = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const anims = { loadingIcon: useRef(new Animated.Value(1)).current };

  // --- 🔥 PARANOID LOGGING & LIFECYCLE ---
  useEffect(() => {
     console.log(`🔍 [LIFECYCLE] 🟢 MOUNT GameScreen (Round ${round})`);
     console.log(`🔍 [DATA] 📊 Scores Hash/Len: ${JSON.stringify(playerScores).length} chars`);
     return () => {
         console.log(`🔍 [LIFECYCLE] 🔴 UNMOUNT GameScreen (Round ${round})`);
     };
  }, [round]);

  // Sync ref with state for track
  useEffect(() => {
    currentTrackRef.current = currentTrack;
  }, [currentTrack]);

  // --- 🔥 SYNCHRONIZED REVEAL LOGIC ---
  useEffect(() => {
    if (gameStatus === 'revealing') {
        console.log("🎮 [GameScreen] Status is REVEALING -> Navigating to RevealScreen.");
        
        SoundManager.stopSound();
        if (timerRef.current) clearInterval(timerRef.current);

        const track = currentTrackRef.current;
        const myPlayerId = firebaseUser?.uid;
        
        (navigation.navigate as any)('Reveal', { 
            correctPlayer: players.find(p => p.id === track?.correctPlayer)?.name || '?',
            track: track,
            score: localScore, 
            round, 
            playerScores, 
            previousScores: playerScores, 
            selectedPlayer: selectedPlayer, 
            category, 
            maxRounds 
        });
    }
  }, [gameStatus]);

  // --- 🔥 ROBUST TIMER LOGIC ---
  useEffect(() => {
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }

    if (screenStatus === 'PLAYING' && isScreenFocused) {
        console.log("🎮 [GameScreen] Status is PLAYING -> Starting NEW Robust Timer.");
        
        const startTime = Date.now();
        const duration = GAME_CONFIG.INITIAL_TIME * 1000;
        const endTime = startTime + duration;

        timeLeftRef.current = GAME_CONFIG.INITIAL_TIME;
        setTimeLeft(GAME_CONFIG.INITIAL_TIME);

        timerRef.current = setInterval(() => {
            // On laisse le timer tourner même en arrière-plan grâce au mode Audio
            const now = Date.now();
            const remaining = Math.ceil((endTime - now) / 1000);
            
            if (remaining !== timeLeftRef.current) {
                timeLeftRef.current = remaining;
                setTimeLeft(Math.max(0, remaining));
            }

            if (remaining <= 0) {
                console.log("🎮 [GameScreen] Timer finished naturally (Timestamp check).");
                if (timerRef.current) clearInterval(timerRef.current);
                handleTimeOut();
            }
        }, 500); 
    } else {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    }

    return () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [screenStatus, isScreenFocused]);

  // --- Core Game Flow ---

  useFocusEffect(
    React.useCallback(() => {
      console.log(`🎮 [GameScreen] Focus Effect triggered. Round: ${round}, Status: ${gameStatus}`);
      if (timerRef.current) clearInterval(timerRef.current);
      
      if (gameStatus !== 'playing') {
          console.log("🎮 [GameScreen] 🛑 Status mismatch (not playing). Aborting logic.");
          return;
      }
      
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
        if (!isHost || !isActive) return;
        if (gameStatus !== 'playing') {
            console.warn("🎮 [GameScreen] ⚠️ loadRoundData aborted: GameStatus changed to", gameStatus);
            return;
        }
        
        console.log("🎮 [GameScreen] loadRoundData started...");
        roundLock.current = round;
        
        setScreenStatus('PREPARING_ROUND');
        setSelectedPlayer(null);
        setHasVoted(false);
        setLocalScore(0);
        timeLeftRef.current = GAME_CONFIG.INITIAL_TIME;
        setTimeLeft(GAME_CONFIG.INITIAL_TIME);
        
        setGameTrack(null);
        currentTrackRef.current = null;

        try {
            if (playlist && playlist.length >= round) {
                const playlistTrack = playlist[round - 1];
                if (playlistTrack) {
                    console.log(`🎮 [GameScreen] Playlist Track: ${playlistTrack.title}`);
                    const trackWithRound = { ...playlistTrack, roundId: round };
                    setGameTrack(trackWithRound);
                    addPlayedTrack(playlistTrack.id);
                } else {
                    console.error("🎮 [GameScreen] Playlist index error.");
                }
                return;
            }

            console.log("🎮 [GameScreen] Playlist absente, fallback sur recherche dynamique...");
            if (trackPool.length === 0) {
              showToast(t('pool_empty'), "error");
              await leaveGame();
              navigation.navigate('Menu');
              return;
            }

            console.log("🎮 [GameScreen] Asking MusicService for a playable track...");
            const playableTrackResult = await MusicService.findPlayableTrack(trackPool, contextPlayedTracks);

            if (isActive && playableTrackResult.success && playableTrackResult.track) {
              setGameTrack(playableTrackResult.track);
              addPlayedTrack(playableTrackResult.track.id);
            } else if (isActive) {
              console.warn("🎮 [GameScreen] No playable track found.");
              showToast(playableTrackResult.error || t('no_playable_track'), "error");
              await leaveGame();
              navigation.navigate('Menu');
            }
        } catch (error) {
            Logger.error("Erreur critique loadRoundData", error);
            showToast(t('round_prep_error'), "error");
            await leaveGame();
            navigation.navigate('Menu');
        }
      };

      const timeoutId = setTimeout(() => {
          loadRoundData();
      }, 100);

      return () => {
        console.log("🎮 [GameScreen] Cleaning up Effect (Unfocus/Unmount)");
        isActive = false;
        clearTimeout(timeoutId);
        if (timerRef.current) clearInterval(timerRef.current);
        if (currentTrackRef.current?.id) {
            SoundManager.stopSound(currentTrackRef.current.id);
        }
      };
    }, [round, isHost, gameStatus, trackPool, contextPlayedTracks, playlist])
  );

  useEffect(() => {
    const isCorrectTrackForRound = sharedTrack && Number(sharedTrack.roundId) === Number(round);

    if (isCorrectTrackForRound && sharedTrack?.id !== currentTrack?.id && screenStatus === 'PREPARING_ROUND' && isScreenFocused) {
      console.log("🎮 [GameScreen] ✅ Condition met! Calling startRound.");
      startRound(sharedTrack as GameTrack);
    }
  }, [sharedTrack, screenStatus, isScreenFocused]);

  const startRound = async (track: GameTrack) => {
    if (gameStatus !== 'playing') {
        console.warn("🎮 [GameScreen] startRound blocked: GameStatus is not playing.");
        return;
    }

    console.log(`🎮 [GameScreen] startRound triggered for track: ${track.title} (ID: ${track.id})`);
    
    currentTrackRef.current = track;
    setCurrentTrack(track);

    timeLeftRef.current = GAME_CONFIG.INITIAL_TIME;
    setTimeLeft(GAME_CONFIG.INITIAL_TIME);

    try {
      if (track.preview_url) {
        console.log("🔍 [AUDIO] ⏳ GameScreen requesting SoundManager to play...");
        await SoundManager.stopSound();
        await SoundManager.playSound(track.preview_url, track.id);
        console.log("🔍 [AUDIO] ✅ GameScreen received control back from SoundManager.");
        
        // Only start the game loop if sound is confirmed valid
        setScreenStatus('PLAYING'); 
        setHasVoted(false); 
      } else {
        console.warn("🎮 [GameScreen] No preview URL for this track. Aborting round start.");
        showToast(t('no_preview'), "error");
        
        // Force retry logic if host
        if (isHost) {
             console.log("🎮 [GameScreen] Host forcing round retry due to missing preview...");
             // Slightly delay to avoid infinite fast loops
             setTimeout(() => {
                 roundLock.current = 0; // Unlock
                 // Trigger re-render/re-fetch by updating params slightly or just forcing reload logic
                 // Since we are inside the component, we can just call loadRoundData logic again via navigation reset or similar
                 // Safest is to replace screen to reset state completely
                 navigation.replace('Game', { gameId: Date.now(), round, playerScores, category, maxRounds });
             }, 1000);
        }
        return;
      }

    } catch (error) {
      Logger.error("Erreur en démarrant le son", { error, track });
      showToast(t('track_load_error'), "error");
      if (isHost) {
        roundLock.current = 0;
        navigation.replace('Game', { gameId: Date.now(), round, playerScores, category, maxRounds });
      }
    }
  };

  const handleVoteAction = async (playerId: string) => {
    console.log(`🎮 [GameScreen] Vote action for player: ${playerId}`);
    if (screenStatus !== 'PLAYING' || hasVoted) return;
    
    setScreenStatus('VOTED');
    setHasVoted(true); 
    setSelectedPlayer(playerId);
    
    if (timerRef.current) clearInterval(timerRef.current);
    await SoundManager.stopSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const track = currentTrackRef.current;
    
    const isCorrect = track?.correctPlayer === playerId;
    const score = isCorrect ? 500 + (timeLeft * 30) : 0;
    const myPlayerId = firebaseUser?.uid;
    
    setLocalScore(score); 

    if (myPlayerId) {
      if (score > 0) {
        setPlayerScores(prev => ({
            ...prev,
            [myPlayerId]: (prev[myPlayerId] || 0) + score
        }));
        if (updatePlayerScore) updatePlayerScore(myPlayerId, score);
      }
      registerVote(myPlayerId);
    }

    navigation.replace('Reveal', { 
        correctPlayer: players.find(p => p.id === track?.correctPlayer)?.name || '?',
        track: track,
        score, round, 
        playerScores: newScores, 
        previousScores: playerScores,
        selectedPlayer: playerId, category, maxRounds 
    });
  };

  const handleTimeOut = async () => {
    if (screenStatus !== 'PLAYING' || !isScreenFocused) {
        console.warn(`⚠️ [GameScreen] handleTimeOut ignoré. Status: ${screenStatus}, Focused: ${isScreenFocused}`);
        return;
    }

    console.log("🎮 [GameScreen] handleTimeOut called.");
    
    if (timerRef.current) clearInterval(timerRef.current);
    setScreenStatus('VOTED');
    setHasVoted(true);
    setLocalScore(0);
    
    const track = currentTrackRef.current;
    await SoundManager.stopSound();

    const myPlayerId = firebaseUser?.uid;
    if (myPlayerId) {
        registerVote(myPlayerId);
    }

    navigation.replace('Reveal', { 
        correctPlayer: players.find(p => p.id === track?.correctPlayer)?.name || '?', 
        track: track,
        score: 0, round, 
        playerScores, 
        previousScores: playerScores,
        selectedPlayer: undefined, category, maxRounds 
    });
  };

  const handleQuit = () => {
    Alert.alert(
      t('quit_title'),
      t('quit_game_confirm'),
      [
        { text: t('cancel'), style: "cancel" },
        { 
          text: t('quit'), 
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
          <Text style={styles.loadingTitle}>{t('round_label')} {round}</Text>
          <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
          <Text style={styles.loadingText}>{t('preparing_music')}</Text>
        </View>
      </SafeContainer>
    );
  }

  // --- Dynamic Layout Calculation ---
  const numPlayers = players.length;
  let cardWidth = '45%';
  let avatarSize = 100;
  let nameSize = 16;
  let gap = 16;

  if (numPlayers <= 2) {
    cardWidth = '80%';
    avatarSize = 140;
    nameSize = 20;
  } else if (numPlayers <= 4) {
    cardWidth = '45%';
    avatarSize = 100;
    nameSize = 16;
  } else if (numPlayers <= 6) {
    cardWidth = '45%';
    avatarSize = 80;
    nameSize = 14;
    gap = 12;
  } else {
    cardWidth = '30%';
    avatarSize = 60;
    nameSize = 12;
    gap = 8;
  }

  return (
    <SafeContainer>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>
            <Ionicons name="close" size={24} color="#FF6B6B" />
          </TouchableOpacity>
          <Text style={styles.roundIndicator}>{t('round_x_of_y').replace('{0}', String(round)).replace('{1}', String(maxRounds))}</Text>
          <View style={{ width: 40 }} /> 
        </View>
        {/* Ajout de la clé 'round' pour forcer le remontage et relancer l'animation fluide à chaque manche */}
        <CircularTimer key={round} timeLeft={timeLeft} maxTime={GAME_CONFIG.INITIAL_TIME} />
        
        <View style={styles.voteInstructionContainer}>
          <Text style={styles.voteInstructionText}>{t('find_listener')}</Text>
        </View>

        <View style={[styles.playersGrid, { gap }]}>
          {players.map(p => (
            <PressableCard key={p.id} style={{ width: cardWidth as any }} onPress={() => handleVoteAction(p.id)}>
              <GlassCard style={[styles.playerVote, selectedPlayer === p.id && styles.playerVoteSelected]}>
                  {!!p.image ? (
                    <Image source={{ uri: p.image }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, marginBottom: 8 }} />
                  ) : (
                    <View style={[{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, marginBottom: 8 }, { backgroundColor: p.color || '#555', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={{ fontSize: avatarSize * 0.4 }}>{p.emoji || '👤'}</Text>
                    </View>
                  )}
                  <Text style={[styles.playerVoteName, { fontSize: nameSize }]} numberOfLines={1}>{p.name}</Text>
                  {selectedPlayer === p.id ? (<View style={styles.checkmarkBadge}><Ionicons name="checkmark" size={avatarSize * 0.18} color="#fff" /></View>) : null}
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
  voteInstructionContainer: {
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  voteInstructionText: {
    color: '#B3B3B3',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  playersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'auto', paddingBottom: 20 },
  playerVote: { padding: 8, alignItems: 'center', borderWidth: 3, borderColor: 'transparent', borderRadius: 20, width: '100%' },
  playerVoteSelected: { borderColor: COLORS.SPOTIFY_GREEN },
  playerVoteName: { color: 'white', fontWeight: '700', textAlign: 'center' },
  checkmarkBadge: { position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.SPOTIFY_GREEN, justifyContent: 'center', alignItems: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  loadingTitle: { fontSize: 24, fontWeight: '900', color: 'white', letterSpacing: 2 },
  loadingText: { fontSize: 18, fontWeight: '700', color: '#AAA' },
});
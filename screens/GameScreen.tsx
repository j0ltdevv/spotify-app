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
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

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
  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.INITIAL_TIME);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [playerScores, setPlayerScores] = useState<PlayerScores>(initialScores || {});
  
  // State Machine for the screen
  type ScreenStatus = 'PREPARING_ROUND' | 'PLAYING' | 'VOTED';
  const [screenStatus, setScreenStatus] = useState<ScreenStatus>('PREPARING_ROUND');
  
  // Refs
  const roundLock = useRef(0); // Prevents duplicate logic execution for the same round
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const anims = {
    loadingIcon: useRef(new Animated.Value(1)).current,
    mainContent: useRef(new Animated.Value(0)).current
  };

  // --- Core Game Flow ---

  useFocusEffect(() => {
    if (gameStatus !== 'playing') return;
    if (round > maxRounds) {
      navigation.replace('GameOver', { playerScores, players });
      return;
    }
    if (roundLock.current === round) return;

    let isActive = true;
    const loadRoundData = async () => {
      if (!isHost || !isActive) return;
      
      roundLock.current = round;
      setScreenStatus('PREPARING_ROUND');
      setTimeLeft(GAME_CONFIG.INITIAL_TIME);

      if (trackPool.length === 0) {
        showToast("Le pot commun est vide ! Impossible de continuer.", "error");
        await leaveGame();
        navigation.navigate('Menu');
        return;
      }

      const playableTrackResult = await MusicService.findPlayableTrack(trackPool, contextPlayedTracks);

      if (isActive && playableTrackResult.success && playableTrackResult.track) {
        startRound(playableTrackResult.track);
        setGameTrack(playableTrackResult.track);
        addPlayedTrack(playableTrackResult.track.id);
      } else if (isActive) {
        showToast(playableTrackResult.error || "Aucune musique jouable n'a été trouvée.", "error");
        await leaveGame();
        navigation.navigate('Menu');
      }
    };

    loadRoundData();

    return () => {
      isActive = false;
      if (timerRef.current) clearInterval(timerRef.current);
      stopSound(true);
    };
  });

  // This effect listens for the track chosen by the host and starts the round for everyone.
  useEffect(() => {
    if (sharedTrack && sharedTrack.id !== currentTrack?.id) {
      Logger.info(`New shared track received: ${sharedTrack.title}`);
      
      const startRound = async (track: GameTrack) => {
        try {
          if (!track.preview_url) {
            throw new Error("Preview URL is missing.");
          }
          await SoundManager.playSound(track.preview_url, track.id);
          setCurrentTrack(track);
          setScreenStatus('PLAYING');

          // Start countdown
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                clearInterval(timerRef.current!);
                handleTimeOut();
                return 0;
              }
              return prev - 1;
            });
          }, 1000);

        } catch (error) {
          Logger.error("Erreur en démarrant le son", { error, track });
          showToast("Cet extrait n'a pas pu être chargé.", "error");
          if (isHost) {
            roundLock.current = 0; // Reset guard to allow refetch
            navigation.replace('Game', { gameId: Date.now(), round, playerScores, category, maxRounds });
          }
        }
      };
      
      startRound(sharedTrack as GameTrack);
    }
  }, [sharedTrack]);

  // --- Handlers ---

  const handleVoteAction = async (playerId: string) => {
    Logger.debug(`Vote attempt for ${playerId}. Current screen status: ${screenStatus}`);
    if (screenStatus !== 'PLAYING') return;
    
    setScreenStatus('VOTED');
    setSelectedPlayer(playerId);
    await stopSound();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const isCorrect = currentTrack?.correctPlayer === playerId;
    let score = isCorrect ? 500 + (timeLeft * 30) : 0;
    
    const myPlayerId = firebaseUser?.uid;
    const newScores = { ...playerScores };
    
    if (myPlayerId && score > 0) {
      newScores[myPlayerId] = (newScores[myPlayerId] || 0) + score;
      if (updatePlayerScore) {
        updatePlayerScore(myPlayerId, score);
      }
    }

    navigation.navigate('Reveal', { 
        correctPlayer: players.find(p => p.id === currentTrack?.correctPlayer)?.name || '?',
        track: currentTrack, 
        score, round, playerScores: newScores, 
        selectedPlayer: playerId, category, maxRounds 
    });
  };

  const handleTimeOut = async () => {
    await stopSound(true);
    setScreenStatus('VOTED');
    navigation.navigate('Reveal', { 
        correctPlayer: players.find(p => p.id === currentTrack?.correctPlayer)?.name || '?', 
        track: currentTrack, score: 0, round, playerScores, 
        selectedPlayer: undefined, category, maxRounds 
    });
  };

  // --- Render ---

  if (screenStatus === 'PREPARING_ROUND') {
    return (
      <SafeContainer>
        <View style={styles.loadingContainer}>
          <Animated.View style={[styles.loadingBadge, { transform: [{ scale: anims.loadingIcon }] }]}>
            <Ionicons name="musical-notes" color={COLORS.SPOTIFY_GREEN} size={24} />
          </Animated.View>
          <Text style={styles.loadingTitle}>MANCHE {round}</Text>
          <View style={styles.loadingAnimation}>
            <View style={styles.loadingCircle}><ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} /></View>
          </View>
          <View style={styles.loadingMessage}><Text style={styles.loadingText}>Recherche d'un extrait...</Text></View>
        </View>
      </SafeContainer>
    );
  }

  return (
    <SafeContainer>
      <View style={styles.container}>
        <View style={styles.header}><Text style={styles.roundIndicator}>MANCHE {round} / {maxRounds}</Text></View>
        <Animated.View style={styles.timerContainer}><CircularTimer timeLeft={timeLeft} maxTime={15} size={170} /></Animated.View>
        <View style={styles.playersGrid}>{players.map(p => (<PressableCard key={p.id} style={styles.playerVoteWrapper} onPress={() => handleVoteAction(p.id)}><GlassCard style={[styles.playerVote, selectedPlayer === p.id && { borderColor: COLORS.SPOTIFY_GREEN }]}><View style={styles.playerVoteContent}><View style={styles.avatarContainer}>{p.image ? (<Image source={{ uri: p.image }} style={styles.avatarImage} />) : (<View style={[styles.avatar, { backgroundColor: p.color }]}><Text style={styles.avatarEmoji}>{p.emoji}</Text></View>)}</View><Text style={styles.playerVoteName} numberOfLines={1}>{p.name}</Text></View></GlassCard></PressableCard>))}</View>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, paddingTop: 16, paddingHorizontal: 20, justifyContent: 'space-between' },
    header: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    roundIndicator: { color: COLORS.TEXT_PRIMARY, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
    timerContainer: { alignItems: 'center', marginBottom: 24 },
    playersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', width: '100%', gap: 16, paddingBottom: 20 },
    playerVoteWrapper: { width: '45%' },
    playerVote: { width: '100%', minHeight: 150, borderRadius: 20, borderWidth: 2, borderColor: 'transparent' },
    playerVoteContent: { padding: 16, alignItems: 'center' },
    avatarContainer: { marginBottom: 12, width: 80, height: 80 },
    avatar: { width: '100%', height: '100%', borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
    avatarEmoji: { fontSize: 40 },
    avatarImage: { width: '100%', height: '100%', borderRadius: 40 },
    playerVoteName: { color: COLORS.TEXT_PRIMARY, fontSize: 15, fontWeight: '700', textAlign: 'center' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    loadingBadge: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(29, 185, 84, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 2, borderColor: 'rgba(29, 185, 84, 0.3)' },
    loadingTitle: { fontSize: 24, fontWeight: '900', color: COLORS.TEXT_PRIMARY, letterSpacing: 2, marginBottom: 8 },
    loadingAnimation: { marginVertical: 40 },
    loadingCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(29, 185, 84, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: 'rgba(29, 185, 84, 0.3)' },
    loadingMessage: { alignItems: 'center' },
    loadingText: { fontSize: 18, fontWeight: '700', color: COLORS.TEXT_PRIMARY, marginBottom: 8 },
});

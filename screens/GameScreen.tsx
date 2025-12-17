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

const { width, height } = Dimensions.get('window');
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function GameScreen(props: {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Game'>;
  route: RouteProp<RootStackParamList, 'Game'>;
}) {
  const { navigation, route } = props;
  const { isHost, setGameTrack, currentTrack: sharedTrack, trackPool, players } = useGame();
  const { accessToken: rawAccessToken } = useAuth();
  const { showToast } = useToast();
  const accessToken = rawAccessToken || '';

  const { gameId, round = 1, category = 'TOP_RECENT', playerScores: initialScores, tracks: localTracks, maxRounds = GAME_CONFIG.MAX_ROUNDS } = (route.params || {}) as any;
  
  const [currentTrack, setCurrentTrack] = useState<GameTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.INITIAL_TIME);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playedTracks, setPlayedTracks] = useState<string[]>([]);
  const [playerScores, setPlayerScores] = useState<PlayerScores>(initialScores || { '1': 0, '2': 0, '3': 0, '4': 0 });

  // Animations Refs pour le design "super beau"
  const bgAnim1 = useRef(new Animated.Value(0)).current;
  const bgAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const barAnims = useRef(Array.from({ length: 15 }, () => new Animated.Value(0.3))).current;
  const playedTracksGlobalRef = useRef<Set<string>>(new Set());
  const isLoadingRef = useRef(false);
  const roundIdRef = useRef<string>('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isFocusedRef = useRef(true);

  // Background Animation Loop
  useEffect(() => {
    const createLoop = (val: Animated.Value, duration: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration, useNativeDriver: true }),
        ])
      ).start();
    };
    createLoop(bgAnim1, 5000);
    createLoop(bgAnim2, 7000);
  }, []);

  // Synchronisation visuelle avec la musique
  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
      
      const interval = setInterval(() => {
        barAnims.forEach(bar => {
          Animated.spring(bar, { toValue: Math.random() * 1.2 + 0.2, friction: 3, useNativeDriver: false }).start();
        });
      }, 150);
      return () => clearInterval(interval);
    } else {
      pulseAnim.setValue(1);
      barAnims.forEach(bar => bar.setValue(0.3));
    }
  }, [isPlaying]);

  useFocusEffect(
    React.useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
        SoundManager.stopSound();
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [])
  );

  useEffect(() => {
    if (round === 1) {
      setPlayedTracks([]);
      setPlayerScores({ '1': 0, '2': 0, '3': 0, '4': 0 });
    }
    if (round > maxRounds) {
      const results = players.map(p => ({
        name: p.name,
        score: playerScores[p.id] || 0,
        avatar: { color: p.color, emoji: p.emoji, image: p.image }
      }));
      navigation.replace('GameOver', { results });
      return;
    }
    setTimeLeft(GAME_CONFIG.INITIAL_TIME);
    setSelectedPlayer(null);
    if (accessToken && isFocusedRef.current) startRound();
  }, [round]);

  const stopSound = async () => {
    await SoundManager.stopSound();
    setIsPlaying(false);
  };

  const playTrackLogic = async (track: GameTrack) => {
    setCurrentTrack(track);
    setPlayedTracks(prev => [...prev, track.id]);
    const success = await SoundManager.playSound(track.preview_url, track.id, {
      onPlaybackStatusUpdate: (playing) => setIsPlaying(playing),
    });
    if (success) {
      setIsPlaying(true);
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isHost && sharedTrack && sharedTrack.id !== currentTrack?.id) {
      playTrackLogic(sharedTrack);
    }
  }, [sharedTrack]);

  const startRound = async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoading(true);
    const currentRoundId = `round-${round}-${Date.now()}`;
    roundIdRef.current = currentRoundId;
    await stopSound();

    try {
      if (!isHost) return;
      let tracks = localTracks || (trackPool?.length ? trackPool : await MusicService.fetchTracksByCategory({
        accessToken, category, excludedTrackIds: playedTracks, limit: 100
      }));

      const result = await MusicService.findPlayableTrack(tracks, [...playedTracks, ...Array.from(playedTracksGlobalRef.current)], 15);
      if (result.success && result.track) {
        const trackWithId = { ...result.track, roundId: currentRoundId };
        setGameTrack(trackWithId);
        await playTrackLogic(trackWithId);
      }
    } catch (e) {
      showToast("Erreur de session", "error");
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  useEffect(() => {
    if (!loading && currentTrack && !selectedPlayer && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            timerRef.current = null;
            navigation.navigate('Reveal', { correctPlayer: currentTrack.correctPlayer, track: currentTrack, score: 0, round, playerScores, category, maxRounds });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); timerRef.current = null; };
  }, [loading, currentTrack, selectedPlayer]);

  const handleVoteAction = async (playerId: string) => {
    if (selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedPlayer(playerId);
    await stopSound();
    const score = 500 + (timeLeft * 30);
    const newScores = { ...playerScores, [playerId]: (playerScores[playerId] || 0) + score };
    setPlayerScores(newScores);
    navigation.navigate('Reveal', { correctPlayer: currentTrack?.correctPlayer, track: currentTrack, score, round, playerScores: newScores, selectedPlayer: playerId, category, maxRounds });
  };

  if (loading) {
    return (
      <SafeContainer>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
          <Text style={styles.loadingText}>Préparation de la manche {round}...</Text>
        </View>
      </SafeContainer>
    );
  }

  return (
    <SafeContainer>
      <View style={StyleSheet.absoluteFill}>
        <AnimatedLinearGradient colors={[COLORS.SPOTIFY_GREEN, 'transparent']} style={[styles.bgCircle, { top: -100, left: -50, transform: [{ translateY: bgAnim1.interpolate({ inputRange: [0, 1], outputRange: [-80, 80] }) }] }]} />
        <AnimatedLinearGradient colors={['#9b51e0', 'transparent']} style={[styles.bgCircle, { bottom: -100, right: -50, transform: [{ translateY: bgAnim2.interpolate({ inputRange: [0, 1], outputRange: [80, -80] }) }] }]} />
      </View>

      <View style={styles.container}>
        <View style={styles.header}>
          <GlassCard style={styles.mancheBadge}><Text style={styles.mancheText}>MANCHE {round}/{maxRounds}</Text></GlassCard>
          <TouchableOpacity onPress={() => Alert.alert("Quitter ?", "Vraiment ?", [{ text: "Non" }, { text: "Oui", onPress: () => navigation.replace('Menu') }])}>
            <Ionicons name="close-circle" size={32} color={COLORS.ERROR_RED} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.timerWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <CircularTimer timeLeft={timeLeft} maxTime={15} size={170} />
          <Text style={styles.pointsPreview}>{500 + (timeLeft * 30)} PTS</Text>
        </Animated.View>

        <View style={styles.visualizer}>
          {barAnims.map((anim, i) => (
            <Animated.View key={i} style={[styles.bar, { height: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 50] }), opacity: anim }]} />
          ))}
        </View>

        <View style={styles.grid}>
          {players.map(p => (
            <PressableCard key={p.id} style={styles.cardContainer} onPress={() => handleVoteAction(p.id)}>
              <GlassCard style={[styles.playerCard, selectedPlayer === p.id && styles.selectedCard]}>
                <View style={[styles.avatarBorder, { borderColor: p.color }]}>
                  {p.image ? <Image source={{ uri: p.image }} style={styles.avatarImg} /> : <Text style={styles.avatarEmoji}>{p.emoji}</Text>}
                </View>
                <Text style={styles.playerName} numberOfLines={1}>{p.name}</Text>
                {selectedPlayer === p.id && <Ionicons name="checkmark-circle" size={22} color={COLORS.SPOTIFY_GREEN} style={styles.check} />}
              </GlassCard>
            </PressableCard>
          ))}
        </View>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'space-between' },
  bgCircle: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, opacity: 0.12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mancheBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  mancheText: { color: 'white', fontWeight: '900', letterSpacing: 1 },
  timerWrapper: { alignItems: 'center', marginTop: 10 },
  pointsPreview: { color: COLORS.SPOTIFY_GREEN, fontWeight: '900', fontSize: 20, marginTop: 10, textShadowColor: COLORS.SPOTIFY_GREEN, textShadowRadius: 8 },
  visualizer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', height: 60, gap: 4 },
  bar: { width: 6, backgroundColor: COLORS.SPOTIFY_GREEN, borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12, paddingBottom: 20 },
  cardContainer: { width: '48%' },
  playerCard: { padding: 16, borderRadius: 24, alignItems: 'center', minHeight: 140, justifyContent: 'center' },
  selectedCard: { borderColor: COLORS.SPOTIFY_GREEN, borderWidth: 2, backgroundColor: 'rgba(29, 185, 84, 0.1)' },
  avatarBorder: { width: 64, height: 64, borderRadius: 32, borderWidth: 3, justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  avatarImg: { width: '100%', height: '100%', borderRadius: 32 },
  avatarEmoji: { fontSize: 28 },
  playerName: { color: 'white', fontWeight: '800', fontSize: 14 },
  check: { position: 'absolute', top: 8, right: 8 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: 'white', marginTop: 20, fontWeight: '700' }
});
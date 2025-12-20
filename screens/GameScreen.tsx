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
  const { isHost, setGameTrack, currentTrack: sharedTrack, trackPool, players, leaveGame, updatePlayerScore } = useGame(); // Multiplayer hooks
  
  // Récupération des paramètres avec valeurs par défaut
  const { accessToken: rawAccessToken, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const accessToken = rawAccessToken || '';

  const { gameId, round = 1, category = 'TOP_RECENT', playerScores: initialScores, tracks: localTracks, maxRounds = GAME_CONFIG.MAX_ROUNDS } = (route.params || {}) as any;
  
  const [currentTrack, setCurrentTrack] = useState<GameTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.INITIAL_TIME);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [playedTracks, setPlayedTracks] = useState<string[]>([]);
  const [playerScores, setPlayerScores] = useState<PlayerScores>(initialScores || {});

  // Animation values
  const musicIconScale = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bgAnim1 = useRef(new Animated.Value(0)).current;
  const bgAnim2 = useRef(new Animated.Value(0)).current;
  const barAnims = useRef(Array.from({ length: 16 }, () => new Animated.Value(0))).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const progressDotSize = {
    size: 10,
    completedSize: 10,
    currentSize: 14,
    gap: 6,
  };

  const stopSound = async (forceStop = false) => {
    // Stop the sound playback
    await SoundManager.stopSound();
    if(forceStop) {
      setIsPlaying(false);
    }
  };


  // --- (Animations and Effects) ---
  
  // Effect for loading icon animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    if (loading) {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(musicIconScale, {
            toValue: 1.1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(musicIconScale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
    }
    
    return () => {
      if (animation) {
        animation.stop();
      }
      musicIconScale.setValue(1);
    };
  }, [loading]);

  // Effect for game animations (timer pulse, background, visualizer)
  useEffect(() => {
    let animations: Animated.CompositeAnimation[] = [];
    if (!loading) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      );

      const move1 = Animated.loop(
        Animated.sequence([
          Animated.timing(bgAnim1, { toValue: 1, duration: 8000, useNativeDriver: true }),
          Animated.timing(bgAnim1, { toValue: 0, duration: 8000, useNativeDriver: true }),
        ])
      );

      const move2 = Animated.loop(
        Animated.sequence([
          Animated.timing(bgAnim2, { toValue: 1, duration: 8000, useNativeDriver: true }),
          Animated.timing(bgAnim2, { toValue: 0, duration: 8000, useNativeDriver: true }),
        ])
      );

      const barDance = Animated.loop(
        Animated.stagger(100,
          barAnims.map(anim =>
            Animated.sequence([
              Animated.timing(anim, {
                toValue: Math.random(),
                duration: 300,
                useNativeDriver: true,
              }),
              Animated.timing(anim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
              }),
            ])
          )
        )
      );

      animations = [pulse, move1, move2, barDance];
      animations.forEach(anim => anim.start());
    }

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [loading]);



  // ... (existing code)

  const handleVoteAction = async (playerId: string) => {
    if (selectedPlayer) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSelectedPlayer(playerId);
    await stopSound();
    
    // --- LOGIQUE DE SCORE CORRIGÉE ---
    // 1. Vérifier si c'est la bonne réponse
    // Note: currentTrack.correctPlayer contient l'ID du propriétaire du track
    const isCorrect = currentTrack?.correctPlayer === playerId;
    
    let score = 0;
    
    if (isCorrect) {
        // 2. Calcul du score (Base + Bonus Temps)
        // Plus on répond vite, plus on a de points
        score = 500 + (timeLeft * 30);
    }
    
    // 3. Attribuer les points À CELUI QUI JOUE (Moi), pas à celui qui est cliqué !
    const myPlayerId = firebaseUser?.uid;
    const newScores = { ...playerScores };
    
    if (myPlayerId && score > 0) {
        newScores[myPlayerId] = (newScores[myPlayerId] || 0) + score;
        
        // Sync with global context (Multiplayer)
        if (updatePlayerScore) {
            updatePlayerScore(myPlayerId, score);
        }
    }

    // Pass newScores explicitly to navigation to ensure next screen has latest data
    navigation.navigate('Reveal', { 
        correctPlayer: currentTrack?.correctPlayer || '?', 
        track: currentTrack, 
        score, // Score gagné par le joueur courant pour ce tour
        round, 
        playerScores: newScores, 
        selectedPlayer: playerId, 
        category, 
        maxRounds 
    });
  };

  const handleQuit = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Alert.alert(
      "Quitter la partie ?",
      "Êtes-vous sûr de vouloir abandonner la partie en cours ? Vos scores seront perdus.",
      [
        {
          text: "Annuler",
          style: "cancel",
          onPress: () => {
            Logger.info("Annulation de la sortie de partie");
          }
        },
        {
          text: "Quitter",
          style: "destructive",
          onPress: async () => {
            Logger.info("Quitter la partie - Arrêt du son et retour au menu");
            
            try {
                if (timerRef.current) {
                  clearInterval(timerRef.current);
                  timerRef.current = null;
                }
                
                await stopSound(true);
                setIsPlaying(false);
                
                await leaveGame();
            } catch (error) {
                Logger.error("Erreur lors de la sortie de partie", error);
            } finally {
                // Toujours retourner au menu, même en cas d'erreur
                navigation.replace('Menu', {});
            }
          }
        }
      ]
    );
  };

  const handleTimeOut = async () => {
    await stopSound(true);
    setIsPlaying(false);
    // No points for timeout
    const score = 0;
    navigation.navigate('Reveal', { 
        correctPlayer: currentTrack?.correctPlayer || '?', 
        track: currentTrack, 
        score, 
        round, 
        playerScores: playerScores, 
        selectedPlayer: undefined, 
        category, 
        maxRounds 
    });
  };

  if (loading) {
    return (
      <SafeContainer>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingHeader}>
            <Animated.View style={[styles.loadingBadge, { transform: [{ scale: musicIconScale }] }]}>
              <Ionicons name="musical-notes" color={COLORS.SPOTIFY_GREEN} size={24} />
            </Animated.View>
            <Text style={styles.loadingTitle}>PRÉPARATION</Text>
            <Text style={styles.loadingRound}>Manche {round} / {maxRounds}</Text>
          </View>

          <View style={styles.loadingAnimation}>
            <View style={styles.loadingCircle}>
              <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
            </View>
          </View>

          <View style={styles.loadingMessage}>
            <Text style={styles.loadingText}>Recherche d'un extrait...</Text>
            <Text style={styles.loadingText}>Veuillez patienter...</Text>
          </View>
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
          <Text style={styles.roundIndicator}>MANCHE {round} / {maxRounds}</Text>
          <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>
            <Ionicons name="close-circle" size={20} color={COLORS.ERROR_RED} />
            <Text style={styles.quitText}>QUITTER</Text>
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.timerContainer, { transform: [{ scale: pulseAnim }] }]}>
          <CircularTimer timeLeft={timeLeft} maxTime={15} size={170} />
          <Text style={styles.pointsPreview}>{500 + (timeLeft * 30)} PTS</Text>
        </Animated.View>

          {/* Indicateur de progression des manches */}
          <View style={[styles.roundProgress, { gap: progressDotSize.gap }]}>
            {Array.from({ length: maxRounds }).map((_, index) => (
              <View
                key={index}
                style={[
                  {
                    width: progressDotSize.size,
                    height: progressDotSize.size,
                    borderRadius: progressDotSize.size / 2,
                    backgroundColor: COLORS.DARK_TERTIARY,
                    borderWidth: 2,
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                  },
                  index < round && {
                    backgroundColor: COLORS.SPOTIFY_GREEN,
                    borderColor: COLORS.SPOTIFY_GREEN,
                    width: progressDotSize.completedSize,
                    height: progressDotSize.completedSize,
                    borderRadius: progressDotSize.completedSize / 2,
                  },
                  index === round - 1 && {
                    backgroundColor: COLORS.SPOTIFY_GREEN,
                    borderColor: COLORS.SPOTIFY_GREEN,
                    width: progressDotSize.currentSize,
                    height: progressDotSize.currentSize,
                    borderRadius: progressDotSize.currentSize / 2,
                    borderWidth: 3,
                  },
                ]}
              />
            ))}
          </View>

          {/* Visualizer audio fluide avec barres indépendantes */}
          <View style={styles.visualizerContainer}>
            {barAnims.map((barAnim, i) => {
              // Hauteur maximale pour chaque barre
              const maxHeight = 60;
              const animatedHeight = barAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [10, maxHeight],
              });
              
              return (
                <Animated.View 
                  key={i} 
                  style={[
                    styles.visualizerBar, 
                    { 
                      height: animatedHeight,
                    }
                  ]} 
                />
              );
            })}
          </View>

        <View style={styles.playersGrid}>
          {players.map(p => (
            <PressableCard key={p.id} style={styles.playerVoteWrapper} onPress={() => handleVoteAction(p.id)}>
              <GlassCard style={[styles.playerVote, selectedPlayer === p.id && { borderColor: COLORS.SPOTIFY_GREEN, backgroundColor: 'rgba(29, 185, 84, 0.1)' }]}>
                <View style={styles.playerVoteContent}>
                    <View style={styles.avatarContainer}>
                        <View style={[styles.avatarWrapper, { borderColor: p.color }]}>
                            {p.image ? (
                                <Image source={{ uri: p.image }} style={styles.avatarImage} />
                            ) : (
                                <View style={[styles.avatar, { backgroundColor: p.color }]}>
                                    <Text style={styles.avatarEmoji}>{p.emoji}</Text>
                                </View>
                            )}
                        </View>
                        {selectedPlayer === p.id && (
                            <View style={styles.checkmarkBadge}>
                                <Ionicons name="checkmark" size={18} color="#000" />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.playerVoteName, selectedPlayer === p.id && styles.playerVoteNameSelected]} numberOfLines={1}>
                        {p.name}
                    </Text>
                </View>
              </GlassCard>
            </PressableCard>
          ))}
        </View>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 20, justifyContent: 'space-between' },
  bgCircle: { position: 'absolute', width: width * 1.2, height: width * 1.2, borderRadius: width * 0.6, opacity: 0.12 },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  roundIndicator: { color: COLORS.TEXT_PRIMARY, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  quitButton: { 
    backgroundColor: 'rgba(239, 68, 68, 0.15)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  quitText: { 
    color: COLORS.ERROR_RED, 
    fontWeight: '700', 
    fontSize: 12, 
    textAlign: 'center' 
  },
  timerContainer: { alignItems: 'center', marginBottom: 16 },
  pointsPreview: { color: COLORS.SPOTIFY_GREEN, fontSize: 16, fontWeight: '900', marginTop: 10 },
  roundProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    maxWidth: width - 40,
    marginBottom: 20,
  },
  visualizerContainer: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    justifyContent: 'center', 
    height: 70, 
    marginBottom: 20,
    gap: 6,
    paddingHorizontal: 10,
  },
  visualizerBar: { 
    width: 8, 
    backgroundColor: COLORS.SPOTIFY_GREEN, 
    borderRadius: 4,
    shadowColor: COLORS.SPOTIFY_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 5,
  },
  playersGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    width: '100%', 
    gap: 12, 
    paddingBottom: 20,
  },
  playerVoteWrapper: { 
    width: '48%',
  },
  playerVote: { 
    width: '100%', 
    minHeight: 150,
    borderRadius: 20,
    backgroundColor: 'rgba(40, 40, 40, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  playerVoteContent: { 
    paddingVertical: 16, 
    paddingHorizontal: 10,
    alignItems: 'center',
    position: 'relative',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: 80,
    height: 80,
  },
  avatarWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 3,
    backgroundColor: COLORS.DARK_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { 
    width: '100%',
    height: '100%',
    borderRadius: 37, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  avatarEmoji: { 
    fontSize: 36 
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 37,
  },
  checkmarkBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.SUCCESS_GREEN,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.DARK_BG,
  },
  playerVoteName: { 
    color: COLORS.TEXT_PRIMARY, 
    fontSize: 15, 
    fontWeight: '700',
    textAlign: 'center',
  },
  playerVoteNameSelected: {
    color: COLORS.SUCCESS_GREEN,
    fontSize: 16,
    fontWeight: '900',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingHeader: {
    alignItems: 'center',
    marginBottom: 60,
  },
  loadingBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(29, 185, 84, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 2,
    marginBottom: 8,
  },
  loadingRound: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.SPOTIFY_GREEN,
    letterSpacing: 1,
  },
  loadingAnimation: {
    marginBottom: 40,
  },
  loadingCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  loadingMessage: {
    alignItems: 'center',
    marginBottom: 60,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
    marginBottom: 8,
  },
});
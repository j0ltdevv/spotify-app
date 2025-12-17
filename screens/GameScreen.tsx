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
<<<<<<< HEAD
  const { isHost, setGameTrack, currentTrack: sharedTrack, trackPool, players } = useGame();
=======
  const { isHost, setGameTrack, currentTrack: sharedTrack, trackPool, players, leaveGame } = useGame(); // Multiplayer hooks
  // Récupération des paramètres avec valeurs par défaut
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db
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

<<<<<<< HEAD
=======
  // Calcul dynamique de la taille des points de progression
  const getProgressDotSize = () => {
    if (maxRounds <= 5) return { size: 12, gap: 12, completedSize: 14, currentSize: 16 };
    if (maxRounds <= 8) return { size: 10, gap: 10, completedSize: 12, currentSize: 14 };
    if (maxRounds <= 12) return { size: 8, gap: 8, completedSize: 10, currentSize: 12 };
    if (maxRounds <= 15) return { size: 6, gap: 6, completedSize: 8, currentSize: 10 };
    return { size: 5, gap: 5, completedSize: 6, currentSize: 8 };
  };

  const progressDotSize = getProgressDotSize();

  // Animation de pulsation continue pour l'icône (loading + musique)
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db
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
<<<<<<< HEAD
    setCurrentTrack(track);
    setPlayedTracks(prev => [...prev, track.id]);
    const success = await SoundManager.playSound(track.preview_url, track.id, {
      onPlaybackStatusUpdate: (playing) => setIsPlaying(playing),
    });
    if (success) {
      setIsPlaying(true);
=======
      // Définir expectedTrackRef avec le roundId
      // Note: track.roundId should be set by host before sharing
      expectedTrackRef.current = track;
      
      // Définir currentTrack pour l'affichage
      setCurrentTrack(track);
      
      // Ajouter aux tracks joués (session + global)
      setPlayedTracks(prev => [...prev, track.id]);
      playedTracksGlobalRef.current.add(track.id);
      
      // Attendre un micro-délai
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // ✅ SOUNDMANAGER: Jouer l'audio
      const success = await SoundManager.playSound(
        track.preview_url,
        track.id,
        {
          shouldLoop: false,
          volume: 1.0,
          onPlaybackStatusUpdate: (playing) => {
            Logger.info(`Playback status: ${playing ? 'Playing' : 'Stopped'}`);
            setIsPlaying(playing);
          },
        }
      );

      if (!success) {
        Logger.audio.error("Impossible de lire l'audio");
        showToast("Erreur de lecture audio", 'error', 3000);
        setIsPlaying(false);
      } else {
        Logger.success('Audio démarré avec succès');
        setIsPlaying(true);
        setLoading(false);
        isLoadingRef.current = false;
        
        // Préchargement (seulement si host pour éviter double fetch ?) 
        // Les invités n'ont pas la liste des tracks, donc seul le host précharge et mettra en cache
        if (isHost && localTracks) { 
            // Prefetch logic if needed
        }
      }
  };

  // --- LISTENER POUR INVITÉS ---
  useEffect(() => {
    // Si je ne suis pas l'hôte et que je reçois un nouveau track
    if (!isHost && sharedTrack) {
        // Vérifier si c'est un nouveau track (par ID ou roundId)
        if (sharedTrack.id !== currentTrack?.id) {
            console.log("🎧 INVITÉ: Nouveau track reçu de l'hôte !", sharedTrack.title);
            playTrackLogic(sharedTrack);
        }
    }
  }, [sharedTrack, isHost]);

  const startRound = async () => {
    // Éviter les appels concurrents
    if (isLoadingRef.current) {
      Logger.warn("Démarrage déjà en cours, on ignore");
      return;
    }
    isLoadingRef.current = true;
    setLoading(true);
    
    // Générer un ID unique pour ce round
    const currentRoundId = `round-${round}-${Date.now()}`;
    roundIdRef.current = currentRoundId;
    
    // S'assurer qu'aucun son n'est en cours ET réinitialiser expectedTrackRef
    await stopSound(true);
    setCurrentTrack(null);
    expectedTrackRef.current = null;
    
    Logger.game.start(round, category || 'TOP_RECENT');
    Logger.info(`Démarrage de la manche ${round} avec ID: ${currentRoundId}`);
    try {
      if (!isHost) {
          Logger.info("Invité: En attente de la sélection de l'hôte...");
          // Si on a déjà le track partagé (cas de reconnexion ou délai), on le joue direct
          if (sharedTrack && sharedTrack.roundId === currentRoundId) {
               Logger.info("Invité: Track déjà disponible, lecture...");
               await playTrackLogic(sharedTrack);
          }
          return; // On arrête ici pour l'invité, le useEffect prendra le relais
      }

      // --- LOGIQUE HÔTE SEULEMENT ---
      let tracks: GameTrack[] = [];

      // ✅ LOGIC 1: Utiliser les tracks locaux (Deezer) s'ils existent
      if (localTracks && localTracks.length > 0) {
        Logger.info(`Utilisation des ${localTracks.length} tracks locaux (Deezer/Import)`);
        tracks = localTracks;
      } 
      // ✅ LOGIC 2: Utiliser le POT COMMUN (Mélange des joueurs)
      else if (trackPool && trackPool.length > 0 && category?.startsWith('TOP_')) {
        Logger.info(`🎱 Utilisation du Pot Commun (${trackPool.length} titres partagés)`);
        // On mélange le pool pour être sûr
        tracks = trackPool.sort(() => Math.random() - 0.5);
      }
      else {
        // ✅ LOGIC 3: Sinon, récupérer les tracks par catégorie (Spotify - Host Only)
        Logger.info('Récupération des tracks via MusicService (Spotify)');
        tracks = await MusicService.fetchTracksByCategory({
          accessToken: accessToken || '',
          category: category || 'TOP_RECENT',
          excludedTrackIds: playedTracks,
          limit: 100,
        });
      }

      // ✅ SERVICE: Trouver un track jouable (iTunes prioritaire)
      const result = await MusicService.findPlayableTrack(
        tracks,
        [...playedTracks, ...Array.from(playedTracksGlobalRef.current)],
        15
      );

      if (!result.success || !result.track) {
        Logger.warn('Aucun extrait audio trouvé', result.error);
        showToast(result.error || 'Aucun extrait audio trouvé', 'error', 3000);
        Alert.alert(
          "Pas de chance",
          result.error || "Aucun extrait audio trouvé pour cette manche.",
          [{ text: "Retour au menu", onPress: () => navigation.replace('Menu', {}) }]
        );
        isLoadingRef.current = false;
        setLoading(false);
        return;
      }

      // Vérifier qu'on est toujours dans le bon round
      if (roundIdRef.current !== currentRoundId) {
        Logger.warn("Round ID a changé, on annule le chargement");
        isLoadingRef.current = false;
        setLoading(false);
        return;
      }
      
      Logger.audio.play(`${result.track.artist} - ${result.track.title}`);
      Logger.info(`Track sélectionné: ${result.track.title}`);
      
      // ✅ AJOUTER LE ROUND ID AU TRACK POUR LA SYNCHRO
      const trackWithRoundId = { ...result.track, roundId: currentRoundId };

      // 1. Envoyer à Firebase (Hôte seulement)
      if (isHost) {
          console.log('📤 Envoi du track aux autres joueurs...');
          setGameTrack(trackWithRoundId);
      }

      // 2. Jouer localement
      await playTrackLogic(trackWithRoundId);

      // Préchargement (Host only)
      Logger.info("Lancement du préchargement du prochain track...");
      MusicService.prefetchNextTrack(
        tracks,
        [...playedTracks, result.track.id, ...Array.from(playedTracksGlobalRef.current)],
        15
      );

    } catch (error) {
      Logger.error('Erreur critique startRound', error);
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db
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

<<<<<<< HEAD
=======
  const handleQuit = async () => {
    // Feedback haptique léger
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Demander confirmation avant de quitter
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
            
            // Arrêter le timer
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            
            // Arrêter complètement le son
            await stopSound(true);
            setIsPlaying(false);
            
            // Quitter la session de jeu (nettoyer le contexte)
            await leaveGame();
            
            // Retourner au menu principal
            navigation.replace('Menu', {});
          }
        }
      ]
    );
  };

  const handleTimeOut = async () => {
    // ✅ Arrêter complètement le son avant de naviguer
    await stopSound(true);
    setIsPlaying(false);
    navigateToReveal(0);
  };

  // --- 5. RENDER ---
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db
  if (loading) {
    return (
      <SafeContainer>
        <View style={styles.loadingContainer}>
<<<<<<< HEAD
          <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
          <Text style={styles.loadingText}>Préparation de la manche {round}...</Text>
=======
          {/* Header avec indicateur de manche */}
          <View style={styles.loadingHeader}>
            <Animated.View style={[styles.loadingBadge, { transform: [{ scale: musicIconScale }] }]}>
              <Ionicons name="musical-notes" color={COLORS.SPOTIFY_GREEN} size={24} />
            </Animated.View>
            <Text style={styles.loadingTitle}>PRÉPARATION</Text>
            <Text style={styles.loadingRound}>Manche {round} / {maxRounds}</Text>
          </View>

          {/* Animation circulaire */}
          <View style={styles.loadingAnimation}>
            <View style={styles.loadingCircle}>
              <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
            </View>
          </View>

          {/* Message */}
          <View style={styles.loadingMessage}>
            <Text style={styles.loadingText}>Recherche d'un extrait...</Text>
            <Text style={styles.loadingSubText}>Préparez-vous ! 🎵</Text>
          </View>
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db
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
<<<<<<< HEAD
          <GlassCard style={styles.mancheBadge}><Text style={styles.mancheText}>MANCHE {round}/{maxRounds}</Text></GlassCard>
          <TouchableOpacity onPress={() => Alert.alert("Quitter ?", "Vraiment ?", [{ text: "Non" }, { text: "Oui", onPress: () => navigation.replace('Menu') }])}>
            <Ionicons name="close-circle" size={32} color={COLORS.ERROR_RED} />
=======
          <Text style={styles.roundIndicator}>MANCHE {round} / {maxRounds}</Text>
          <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>
            <Ionicons name="close-circle" size={20} color={COLORS.ERROR_RED} />
            <Text style={styles.quitText}>QUITTER</Text>
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db
          </TouchableOpacity>
        </View>

        <Animated.View style={[styles.timerWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <CircularTimer timeLeft={timeLeft} maxTime={15} size={170} />
          <Text style={styles.pointsPreview}>{500 + (timeLeft * 30)} PTS</Text>
        </Animated.View>

<<<<<<< HEAD
        <View style={styles.visualizer}>
          {barAnims.map((anim, i) => (
            <Animated.View key={i} style={[styles.bar, { height: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 50] }), opacity: anim }]} />
          ))}
=======
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
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db
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
<<<<<<< HEAD
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
=======
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 20, justifyContent: 'space-between' },
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
  centerSection: { alignItems: 'center', flex: 0 },
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
  loadingSubText: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '600',
  },
});
>>>>>>> 3f8301479caf13169640973703bfa6e68b8c77db

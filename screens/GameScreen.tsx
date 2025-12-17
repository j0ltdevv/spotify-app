import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext'; // Added useGame
import { useToast } from '../contexts/ToastContext';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Alert, ActivityIndicator, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GAME_CONFIG, COLORS } from '../constants';
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
import SoundManager from '../utils/SoundManager';
import { GameTrack, PlayerScores } from '../types';
import CircularTimer from '../components/CircularTimer';
import AudioVisualizer from '../components/AudioVisualizer';
import PressableCard from '../components/PressableCard';
import Logger from '../utils/logger';

type GameScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Game'>;
  route: RouteProp<RootStackParamList, 'Game'>;
};

const { width } = Dimensions.get('window');

export default function GameScreen(props: GameScreenProps) {
  const { navigation, route } = props;
  const { isHost, setGameTrack, currentTrack: sharedTrack, trackPool, players } = useGame(); // Multiplayer hooks
  // Récupération des paramètres avec valeurs par défaut
  const { accessToken: rawAccessToken } = useAuth();
  const { showToast } = useToast();
  // Force string pour les appels API
  const accessToken = rawAccessToken || '';
  // Typage robuste pour route.params
  const { gameId, round = 1, category = 'TOP_RECENT', playerScores: initialScores, tracks: localTracks, maxRounds = GAME_CONFIG.MAX_ROUNDS } = (route.params || {}) as { 
    gameId?: number; 
    round?: number; 
    category?: string; 
    playerScores?: PlayerScores;
    tracks?: GameTrack[];
    maxRounds?: number;
  };
  
  const [currentTrack, setCurrentTrack] = useState<GameTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(GAME_CONFIG.INITIAL_TIME);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [timerScale] = useState(new Animated.Value(1));
  const [musicIconScale] = useState(new Animated.Value(1)); // Animation pour l'icône de musique
  const [loading, setLoading] = useState(true);
  const [playedTracks, setPlayedTracks] = useState<string[]>([]);
  
  // Nouveau visualiseur - 12 barres avec animation réactive
  const barAnims = useRef(
    Array.from({ length: 12 }, () => new Animated.Value(0.3))
  ).current;
  // Stockage global des tracks joués (persiste entre les parties)
  const playedTracksGlobalRef = useRef<Set<string>>(new Set());
  // Nouveau : cumul des scores par joueur (récupéré depuis les params ou initialisé)
  const [playerScores, setPlayerScores] = useState<PlayerScores>(
    initialScores || {
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
    }
  );
  
  const isLoadingRef = useRef(false); // Pour éviter les appels concurrents
  const expectedTrackRef = useRef<GameTrack | null>(null); // Pour éviter les race conditions
  const roundIdRef = useRef<string>(''); // Identifiant unique du round en cours
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isFocusedRef = useRef(true); // Pour savoir si l'écran est visible

  // --- 1. GESTION DU FOCUS DE L'ÉCRAN ---
  // Empêcher la musique de démarrer si on est sur RevealScreen
  useFocusEffect(
    React.useCallback(() => {
      Logger.info('GameScreen focused');
      isFocusedRef.current = true;
      
      return () => {
        Logger.info('GameScreen unfocused - Arrêt du son');
        isFocusedRef.current = false;
        // Arrêter la musique quand on quitte l'écran
        SoundManager.stopSound();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [])
  );

  // Animation de pulsation continue pour l'icône (loading + musique)
  useEffect(() => {
    let pulseAnimation: Animated.CompositeAnimation;
    
    if (loading) {
      // Animation pendant le chargement (plus lente)
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(musicIconScale, {
            toValue: 1.25,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(musicIconScale, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    } else if (isPlaying) {
      // Animation pendant la musique (plus rapide, comme un battement)
      pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(musicIconScale, {
            toValue: 1.3,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(musicIconScale, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
    } else {
      // Retour à la normale
      Animated.timing(musicIconScale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
    
    return () => {
      if (pulseAnimation) {
        pulseAnimation.stop();
      }
    };
  }, [loading, isPlaying]);

  // --- 2. INITIALISATION ET BOUCLE DE JEU ---
  useEffect(() => {
    // Reset played tracks et scores pour nouvelle partie
    if (round === 1) {
      setPlayedTracks([]);
      setPlayerScores({ '1': 0, '2': 0, '3': 0, '4': 0 });
      
      // Log du cache global pour debug
      Logger.game.start(1, category || 'TOP_RECENT');
      Logger.info(`Nouvelle partie - Cache global: ${playedTracksGlobalRef.current.size} morceaux`);
    } else if (initialScores) {
      // Si on a des scores depuis les params, on les utilise
      setPlayerScores(initialScores);
    }

    // Vérification de fin de partie
    if (round > maxRounds) {
      // Générer les résultats finaux réels avec vérification
      Logger.info(`Fin de partie - Round ${round} | Scores:`, playerScores);
      
      const results = players.map(player => {
        const result = {
          name: player.name || 'Joueur inconnu',
          score: playerScores[player.id] || 0,
          avatar: { 
            color: player.color || '#1DB954', 
            emoji: player.emoji || '🎵',
            image: player.image
          }
        };
        Logger.info(`Joueur ${player.name}: ${result.score} points`);
        return result;
      }).filter(r => r.name); // Filtrer les résultats valides
      
      if (results.length === 0) {
        Logger.error('Aucun résultat généré - Retour au lobby');
        navigation.replace('Lobby', {});
        return;
      }
      
      Logger.game.end(results[0]?.score || 0);
      Logger.nav('GameOver', { totalPlayers: results.length });
      navigation.replace('GameOver', { results });
      return;
    }

    // Reset du timer et du joueur sélectionné pour chaque nouvelle manche
    Logger.info(`Reset du timer à ${GAME_CONFIG.INITIAL_TIME} secondes`);
    setTimeLeft(GAME_CONFIG.INITIAL_TIME);
    setSelectedPlayer(null);
    setIsPlaying(false);

    // Arrêter tout timer existant avant de démarrer une nouvelle manche
    if (timerRef.current) {
      Logger.info('Arrêt du timer existant');
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // ⚠️ IMPORTANT: Ne démarrer le round que si l'écran est focused
    if (accessToken && isFocusedRef.current) {
      startRound();
    }
    
    return () => { 
      // ✅ Utilisation du SoundManager pour le cleanup
      SoundManager.stopSound();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [accessToken, gameId, round]);

  const stopSound = async (clearExpectedTrack: boolean = true) => {
    // ✅ Utilisation du SoundManager
    await SoundManager.stopSound();
    
    if (clearExpectedTrack) {
      expectedTrackRef.current = null;
    }
    
    setIsPlaying(false);
  };

  const playTrackLogic = async (track: GameTrack) => {
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
          [{ text: "Suivant", onPress: () => handleSkip() }]
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
      setLoading(false);
      isLoadingRef.current = false;
      showToast("Erreur: Session expirée", 'error', 4000);
      Alert.alert(
        "Erreur",
        "Session expirée ou problème réseau. Reconnexion requise."
      );
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Timer countdown
  useEffect(() => {
    // Démarrer le timer seulement si on a un track, qu'on n'a pas encore voté, et qu'on n'est pas en loading
    if (!loading && currentTrack && !selectedPlayer && !timerRef.current) {
      Logger.info(`Démarrage du timer à ${timeLeft} secondes`);
      
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer terminé
            Logger.warn('Timer terminé - Temps écoulé !');
            if (timerRef.current) {
              clearInterval(timerRef.current);
              timerRef.current = null;
            }
            handleTimeOut();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => {
        if (timerRef.current) {
          Logger.info('Nettoyage du timer');
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }
  }, [loading, currentTrack, selectedPlayer]);

  // Animation du timer quand il reste peu de temps
  useEffect(() => {
    if (timeLeft <= 10 && timeLeft > 0) {
      // Vibration d'alerte quand le temps est bas
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      Animated.sequence([
        Animated.timing(timerScale, { toValue: 1.2, duration: 200, useNativeDriver: true }),
        Animated.timing(timerScale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [timeLeft]);

  // Nouveau système de visualiseur réactif - Simulation d'analyse audio réelle
  useEffect(() => {
    console.log(`🎵 Visualizer State: isPlaying=${isPlaying}, hasTrack=${!!currentTrack}, loading=${loading}`);
    
    if (isPlaying && !loading) {
      let isActive = true;
      let animationFrame: number;
      
      // Variables pour simuler l'énergie de la musique
      let bassEnergy = 0.5;
      let midEnergy = 0.5;
      let highEnergy = 0.5;
      let beatTimer = 0;
      
      const animate = () => {
        if (!isActive) return;
        
        const now = Date.now() / 1000;
        beatTimer += 0.016; // ~60fps
        
        // Simuler des changements d'énergie (comme une vraie analyse spectrale)
        // Les basses changent lentement
        bassEnergy += (Math.random() - 0.5) * 0.08;
        bassEnergy = Math.max(0.3, Math.min(1.0, bassEnergy));
        
        // Les médiums changent moyennement vite
        midEnergy += (Math.random() - 0.5) * 0.12;
        midEnergy = Math.max(0.2, Math.min(1.0, midEnergy));
        
        // Les aigus changent rapidement
        highEnergy += (Math.random() - 0.5) * 0.18;
        highEnergy = Math.max(0.2, Math.min(1.0, highEnergy));
        
        // Simuler des "beats" (pics rythmiques)
        const isBeat = beatTimer > (0.4 + Math.random() * 0.3); // Beat toutes les ~0.5s
        if (isBeat) {
          beatTimer = 0;
          bassEnergy = Math.min(1.2, bassEnergy + 0.4);
          midEnergy = Math.min(1.1, midEnergy + 0.3);
        }
        
        // Appliquer l'énergie à chaque barre selon sa fréquence
        barAnims.forEach((barAnim, index) => {
          let energy;
          
          // Barres 0-2: Basses (graves)
          if (index < 3) {
            energy = bassEnergy + Math.sin(now * 1.5 + index) * 0.15;
          }
          // Barres 3-5: Médiums
          else if (index < 6) {
            energy = midEnergy + Math.sin(now * 2.5 + index) * 0.2;
          }
          // Barres 6-7: Aigus
          else {
            energy = highEnergy + Math.sin(now * 3.5 + index) * 0.25;
          }
          
          // Ajouter du bruit pour effet naturel
          energy += (Math.random() - 0.5) * 0.1;
          
          // Clamper entre 0.15 et 1.3
          const targetValue = Math.max(0.15, Math.min(1.3, energy));
          
          // Animation ultra-rapide pour suivre la "musique"
          Animated.timing(barAnim, {
            toValue: targetValue,
            duration: 80, // Très rapide pour effet réactif
            useNativeDriver: false, // false car on anime height
          }).start();
        });
        
        // Continuer l'animation
        animationFrame = requestAnimationFrame(animate);
      };
      
      console.log('✨ Démarrage du visualiseur réactif');
      animate();
      
      return () => {
        console.log('🛑 Arrêt du visualiseur');
        isActive = false;
        if (animationFrame) {
          cancelAnimationFrame(animationFrame);
        }
        barAnims.forEach(barAnim => barAnim.stopAnimation());
      };
    } else {
      // Arrêt : barres au repos
      console.log('💤 Barres au repos (isPlaying=false ou loading=true)');
      barAnims.forEach((barAnim) => {
        barAnim.stopAnimation();
        Animated.timing(barAnim, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: false, // false car on anime height
        }).start();
      });
    }
  }, [isPlaying, loading]);

  // --- 4. ACTIONS JOUEUR ---
  // On passe aussi les scores cumulés à Reveal
  const navigateToReveal = (score: number) => {
    navigation.navigate('Reveal', {
      correctPlayer: currentTrack?.correctPlayer || 'Inconnu',
      track: currentTrack,
      score: score,
      round: round,
      playerScores: playerScores,
      selectedPlayer: selectedPlayer ?? undefined,
      category: category,
      maxRounds: maxRounds,
    });
  };

  const handleVote = async (playerId: string) => {
    if (selectedPlayer) return;
    
    // Feedback haptique fort au vote
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    const playerName = players.find(p => p.id === playerId)?.name || 'Unknown';
    Logger.game.answer(true, 500 + (timeLeft * 30));
    Logger.info(`Vote pour: ${playerName} | Temps restant: ${timeLeft}s`);
    
    // Arrêter le timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    setSelectedPlayer(playerId);
    
    // ✅ Arrêter complètement le son avant de naviguer
    await stopSound(true);
    setIsPlaying(false);

    const baseScore = 500;
    const timeBonus = timeLeft * 30;
    const totalScore = baseScore + timeBonus;
    
    // On incrémente le score du joueur sélectionné
    const newScores = {
      ...playerScores,
      [playerId]: (playerScores[playerId] || 0) + totalScore
    };
    setPlayerScores(newScores);
    Logger.nav('Reveal', { score: totalScore, round });
    navigateToReveal(totalScore);
  };

  const handleSkip = async () => {
    // Feedback haptique léger pour le skip
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Arrêter le timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // ✅ Arrêter complètement le son avant de naviguer
    await stopSound(true);
    setIsPlaying(false);
    navigateToReveal(0);
  };

  const handleTimeOut = async () => {
    // ✅ Arrêter complètement le son avant de naviguer
    await stopSound(true);
    setIsPlaying(false);
    navigateToReveal(0);
  };

  // --- 5. RENDER ---
  if (loading) {
    return (
      <SafeContainer>
        <View style={styles.loadingContainer}>
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

          {/* Indicateur de progression */}
          <View style={styles.loadingProgress}>
            {Array.from({ length: maxRounds }).map((_, index) => (
              <View
                key={index}
                style={[
                  styles.progressDot,
                  index < round && styles.progressDotCompleted,
                  index === round - 1 && styles.progressDotCurrent,
                ]}
              />
            ))}
          </View>
        </View>
      </SafeContainer>
    );
  }

  return (
    <SafeContainer>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.roundIndicator}>MANCHE {round} / {maxRounds}</Text>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipText}>PASSER</Text>
          </TouchableOpacity>
        </View>

        {/* Section centrale : Timer + Points + Visualizer */}
        <View style={styles.centerSection}>
          {/* Timer circulaire moderne */}
          <View style={styles.timerContainer}>
            <CircularTimer 
              timeLeft={timeLeft} 
              maxTime={15}
              size={160}
            />
            <Text style={styles.pointsPreview}>{500 + (timeLeft * 30)} pts</Text>
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
        </View>

        {/* Grille de joueurs avec design moderne */}
        <View style={styles.playersGrid}>
        {players.map((player) => (
          <TouchableOpacity
            key={player.id}
            activeOpacity={0.7}
            onPress={() => handleVote(player.id)}
            style={styles.playerVoteWrapper}
          >
            <View style={styles.playerVote}>
              <View style={styles.playerVoteContent}>
                {/* Avatar */}
                <View style={styles.avatarContainer}>
                  {/* Avatar principal avec bordure intégrée */}
                  <View style={[styles.avatarWrapper, { 
                    borderColor: player.color,
                    borderWidth: selectedPlayer === player.id ? 3 : 2,
                  }]}>
                    <View style={[styles.avatar, { backgroundColor: player.color }]}>
                      {player.image ? (
                        <Image source={{ uri: player.image }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarEmoji}>{player.emoji}</Text>
                      )}
                    </View>
                  </View>
                  
                  {/* Checkmark si sélectionné */}
                  {selectedPlayer === player.id && (
                    <View style={styles.checkmarkBadge}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                    </View>
                  )}
                </View>
                
                {/* Nom du joueur */}
                <Text style={[
                  styles.playerVoteName,
                  selectedPlayer === player.id && styles.playerVoteNameSelected
                ]}>{player.name}</Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}
        </View>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16, paddingHorizontal: 20, justifyContent: 'space-between' },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  roundIndicator: { color: COLORS.TEXT_PRIMARY, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  skipButton: { backgroundColor: COLORS.DARK_SECONDARY, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  skipText: { color: COLORS.TEXT_SECONDARY, fontWeight: '700', fontSize: 12, textAlign: 'center' },
  centerSection: { alignItems: 'center', flex: 0 },
  timerContainer: { alignItems: 'center', marginBottom: 20 },
  pointsPreview: { color: COLORS.SPOTIFY_GREEN, fontSize: 16, fontWeight: '900', marginTop: 10 },
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
  loadingProgress: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.DARK_TERTIARY,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressDotCompleted: {
    backgroundColor: COLORS.SPOTIFY_GREEN,
    borderColor: COLORS.SPOTIFY_GREEN,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  progressDotCurrent: {
    backgroundColor: COLORS.SPOTIFY_GREEN,
    borderColor: COLORS.SPOTIFY_GREEN,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
});

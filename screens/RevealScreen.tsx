import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image, Alert, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GAME_CONFIG, COLORS, ANIMATION_CONFIG } from '../constants';
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
import SoundManager from '../utils/SoundManager';
import { GameTrack, PlayerScores } from '../types';
import Confetti from '../components/Confetti';
import GlassCard from '../components/GlassCard';
import PressableCard from '../components/PressableCard';
import Logger from '../utils/logger';

type RevealScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Reveal'>;
  route: RouteProp<RootStackParamList, 'Reveal'>;
};

const { width } = Dimensions.get('window');

export default function RevealScreen({ navigation, route }: RevealScreenProps) {
  // On récupère le score, les scores cumulés et le joueur sélectionné
  const { correctPlayer, track, score = 0, round, playerScores = {}, selectedPlayer, category, maxRounds = GAME_CONFIG.MAX_ROUNDS } = route.params as {
    correctPlayer: string;
    track: GameTrack | null;
    score: number;
    round: number;
    playerScores?: PlayerScores;
    selectedPlayer?: string;
    category?: string;
    maxRounds?: number;
  };
  const { accessToken } = useAuth();
  const { players, leaveGame } = useGame();
  const { showToast } = useToast();

  // Sécurité : Si track est null, créer un objet par défaut
  const safeTrack = track || {
    id: '',
    title: 'Titre inconnu',
    artist: 'Artiste inconnu',
    album: 'Album inconnu',
    albumImage: '',
  };

  const [scaleAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scoreAnim] = useState(new Animated.Value(0));
  const [addedToLiked, setAddedToLiked] = useState(false);
  const [bgColor, setBgColor] = useState(COLORS.DARK_BG);
  const [showConfetti, setShowConfetti] = useState(false);
  const [flipAnim] = useState(new Animated.Value(0));
  
  useEffect(() => {
    // ✅ IMPORTANT : Arrêter tout son en cours dès l'arrivée sur l'écran Reveal
    SoundManager.stopSound();
    
    Logger.info(`Reveal - Score: ${score} | Round: ${round}/${maxRounds}`);
    Logger.info(`Track: ${safeTrack.artist} - ${safeTrack.title}`);
    
    // Feedback haptique uniquement (plus fiable que les sons externes)
    if (score > 0) {
      // Succès : feedback fort et positif
      Logger.success(`Bonne réponse ! +${score} points`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      // Double vibration pour renforcer le succès
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }, 100);
      
      // Afficher les confettis
      setShowConfetti(true);
      
      // Toast de succès après un court délai
      setTimeout(() => {
        showToast(`+${score} points !`, 'success', 2000);
      }, 500);
    } else {
      // Échec : feedback négatif
      Logger.warn('Mauvaise réponse ou temps écoulé');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Couleur de fond fixe (adaptive colors removed for Expo Go compatibility)
    setBgColor(COLORS.DARK_BG);

    // Séquence d'animation : Apparition infos -> Flip de carte -> Apparition Score
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: ANIMATION_CONFIG.SPRING_TENSION, friction: ANIMATION_CONFIG.SPRING_FRICTION, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(flipAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scoreAnim, { toValue: 1, friction: 4, useNativeDriver: true })
    ]).start();

    // Cleanup : Arrêter le son quand on quitte l'écran
    return () => {
      SoundManager.stopSound();
    };
  }, []);

  const handleNextRound = () => {
    // Feedback haptique au clic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    Logger.info(`Passage à la manche ${round + 1}`);
    
    // ✅ TOUJOURS naviguer vers GameScreen avec round + 1
    // GameScreen détectera automatiquement si round > MAX_ROUNDS et naviguera vers GameOver
    navigation.replace('Game', {
      gameId: Date.now(),
      round: round + 1,
      playerScores: playerScores,
      category: category || 'TOP_RECENT',
      maxRounds: maxRounds
    });
  };

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
            Logger.info("Quitter la partie depuis RevealScreen - Retour au menu");
            
            // Arrêter complètement le son
            SoundManager.stopSound();
            
            // Quitter la session de jeu (nettoyer le contexte)
            await leaveGame();
            
            // Retourner au menu principal
            navigation.replace('Menu', {});
          }
        }
      ]
    );
  };

  const handleAddToLiked = async () => {
    if (!accessToken) {
      Alert.alert('Erreur', 'Vous devez être connecté à Spotify');
      return;
    }

    if (!safeTrack.id) {
      Alert.alert('Erreur', 'ID de piste manquant');
      return;
    }

    // ✅ Utilisation du MusicService pour ajouter aux favoris
    const success = await MusicService.addTrackToLiked(safeTrack.id, accessToken);

    if (success) {
      setAddedToLiked(true);
      // Double feedback haptique pour confirmer l'ajout aux favoris
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }, 50);
    } else {
      Alert.alert('Erreur', "Impossible d'ajouter la piste aux favoris");
    }
  };

  // Animation de flip pour la pochette
  const flipInterpolate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <SafeContainer backgroundColor={bgColor}>
      {/* Confettis si bonne réponse */}
      {showConfetti && <Confetti />}
      
      {/* Header avec bouton quitter */}
      <View style={styles.headerBar}>
        <Text style={styles.roundIndicator}>MANCHE {round} / {maxRounds}</Text>
        <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>
          <Ionicons name="close-circle" size={20} color={COLORS.ERROR_RED} />
          <Text style={styles.quitText}>QUITTER</Text>
        </TouchableOpacity>
      </View>
      
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        
        {/* Header Résultat */}
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>C'ÉTAIT</Text>
          <Text style={styles.correctPlayerName}>{correctPlayer.toUpperCase()}</Text>
          
          {/* AFFICHAGE DU SCORE GAGNÉ */}
          <Animated.View style={{ transform: [{ scale: scoreAnim }], opacity: scoreAnim }}>
            {score > 0 ? (
              <Text style={styles.scoreGained}>+{Math.floor(score)} PTS 🚀</Text>
            ) : (
              <Text style={styles.scoreSkipped}>PAS DE POINTS 😢</Text>
            )}
          </Animated.View>
        </View>

        {/* Pochette Album avec effet de flip */}
        <Animated.View 
          style={[
            styles.coverContainer,
            { 
              transform: [{ rotateY: flipInterpolate }] 
            }
          ]}
        >
          {safeTrack.albumImage ? (
            <Image source={{ uri: safeTrack.albumImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes" color={COLORS.SPOTIFY_GREEN} size={60} />
            </View>
          )}
        </Animated.View>

        {/* Infos Titre */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle}>{safeTrack.title}</Text>
          <Text style={styles.trackArtist}>{safeTrack.artist}</Text>
          <Text style={styles.albumName}>{safeTrack.album}</Text>
        </View>

      </Animated.View>

      {/* Tableau des scores */}
      <GlassCard style={styles.scoreboardContainer}>
        <View style={styles.scoreboardHeader}>
          <Ionicons name="trophy" size={20} color={COLORS.SPOTIFY_GREEN} />
          <Text style={styles.scoreboardTitle}>CLASSEMENT</Text>
        </View>
        
        <ScrollView style={styles.scoreboardScroll} showsVerticalScrollIndicator={false}>
          {players
            .map(player => ({
              ...player,
              score: playerScores[player.id] || 0
            }))
            .sort((a, b) => b.score - a.score)
            .map((player, index) => (
              <View key={player.id} style={styles.scoreboardRow}>
                {/* Position */}
                <View style={styles.positionBadge}>
                  {index === 0 ? (
                    <Text style={styles.positionEmoji}>🥇</Text>
                  ) : index === 1 ? (
                    <Text style={styles.positionEmoji}>🥈</Text>
                  ) : index === 2 ? (
                    <Text style={styles.positionEmoji}>🥉</Text>
                  ) : (
                    <Text style={styles.positionText}>{index + 1}</Text>
                  )}
                </View>

                {/* Avatar */}
                <View style={[styles.scoreboardAvatar, { borderColor: player.color }]}>
                  {player.image ? (
                    <Image source={{ uri: player.image }} style={styles.scoreboardAvatarImage} />
                  ) : (
                    <Text style={styles.scoreboardAvatarEmoji}>{player.emoji}</Text>
                  )}
                </View>

                {/* Nom */}
                <Text style={styles.scoreboardPlayerName} numberOfLines={1}>
                  {player.name}
                </Text>

                {/* Score */}
                <View style={styles.scoreboardScoreContainer}>
                  <Text style={styles.scoreboardScore}>{player.score}</Text>
                  <Text style={styles.scoreboardScoreLabel}>pts</Text>
                </View>
              </View>
            ))}
        </ScrollView>
      </GlassCard>

      {/* Footer Boutons avec glassmorphism amélioré */}
      <View style={styles.footer}>
        <PressableCard 
          onPress={handleNextRound}
          style={{ width: '100%', marginBottom: 12 }}
        >
          <View style={styles.nextButton}>
            <View style={styles.buttonIconContainer}>
              <Ionicons name="arrow-forward" color={COLORS.TEXT_PRIMARY} size={20} />
            </View>
            <Text style={styles.nextButtonText}>Manche Suivante</Text>
          </View>
        </PressableCard>

        <PressableCard 
          onPress={handleAddToLiked}
          style={{ width: '100%' }}
          disabled={addedToLiked}
        >
          <View style={[styles.addButton, addedToLiked && styles.addedButton]}>
            <Ionicons 
              name={addedToLiked ? "checkmark-circle" : "heart-outline"} 
              color={addedToLiked ? COLORS.SUCCESS_GREEN : COLORS.ERROR_RED} 
              size={18} 
              style={styles.buttonIcon}
            />
            <Text style={[styles.addButtonText, addedToLiked && styles.addedButtonText]}>
              {addedToLiked ? 'Ajouté aux favoris !' : 'Ajouter aux favoris'}
            </Text>
          </View>
        </PressableCard>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  roundIndicator: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.5,
  },
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
    textAlign: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
    letterSpacing: 1.5,
  },
  correctPlayerName: {
    fontSize: 28,
    fontWeight: '900',
    color: COLORS.TEXT_PRIMARY,
    marginTop: 4,
    textAlign: 'center',
  },
  scoreGained: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.GOLD,
    marginTop: 8,
  },
  scoreSkipped: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.ERROR_RED,
    marginTop: 8,
  },
  coverContainer: {
    width: width * 0.6,
    height: width * 0.6,
    marginBottom: 20,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.DARK_SECONDARY,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
  },
  trackTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 16,
    color: COLORS.SPOTIFY_GREEN,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 4,
  },
  albumName: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  scoreboardContainer: {
    width: '90%',
    maxHeight: 180,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
  },
  scoreboardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  scoreboardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 1.2,
  },
  scoreboardScroll: {
    maxHeight: 120,
  },
  scoreboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    gap: 12,
  },
  positionBadge: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  positionEmoji: {
    fontSize: 20,
  },
  positionText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
  },
  scoreboardAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.DARK_SECONDARY,
  },
  scoreboardAvatarImage: {
    width: '100%',
    height: '100%',
  },
  scoreboardAvatarEmoji: {
    fontSize: 20,
  },
  scoreboardPlayerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  scoreboardScoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  scoreboardScore: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.SPOTIFY_GREEN,
  },
  scoreboardScoreLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    width: '100%',
  },
  nextButton: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.SPOTIFY_GREEN,
    borderRadius: 30,
  },
  buttonIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  nextButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  addButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderRadius: 30,
    borderWidth: 1.5,
    borderColor: COLORS.TEXT_SECONDARY,
  },
  addedButton: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderColor: COLORS.SUCCESS_GREEN,
  },
  buttonIcon: {
    marginRight: 6,
  },
  addButtonText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  addedButtonText: {
    color: COLORS.SUCCESS_GREEN,
  },
});
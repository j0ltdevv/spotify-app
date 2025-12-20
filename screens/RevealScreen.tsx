import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image, Alert, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, GAME_CONFIG } from '../constants';
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
import SoundManager from '../utils/SoundManager';
import { GameTrack, Player, PlayerScores } from '../types';
import Confetti from '../components/Confetti';
import PressableCard from '../components/PressableCard';
import Logger from '../utils/logger';

type RevealScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Reveal'>;
  route: RouteProp<RootStackParamList, 'Reveal'>;
};

const { width } = Dimensions.get('window');

export default function RevealScreen({ navigation, route }: RevealScreenProps) {
  const { correctPlayer, track, score = 0, round, playerScores = {}, selectedPlayer, category, maxRounds = GAME_CONFIG.MAX_ROUNDS } = route.params;
  const { firebaseUser } = useAuth();
  const { players, leaveGame } = useGame();
  const { showToast } = useToast();

  const safeTrack: GameTrack = track || { id: '', title: 'Titre inconnu', artist: 'Artiste inconnu', album: 'Album inconnu', albumImage: '', preview_url: '', correctPlayer: '?' };
  
  const myId = firebaseUser?.uid;
  const isGuessCorrect = myId ? score > 0 : false; // Only the player who voted gets a score
  const voter = players.find(p => p.id === myId);
  const correctPlayerObj = players.find(p => p.id === safeTrack.correctPlayer);

  const [anims] = useState({
    bgFade: new Animated.Value(0),
    coverScale: new Animated.Value(0.8),
    coverRotate: new Animated.Value(0),
    infoFade: new Animated.Value(0),
    buttonFade: new Animated.Value(0),
  });
  const [showConfetti, setShowConfetti] = useState(isGuessCorrect);

  const nextRoundTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    SoundManager.stopSound();

    if (isGuessCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    
    // Animate everything in
    Animated.sequence([
      Animated.timing(anims.bgFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(anims.coverScale, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
        Animated.timing(anims.coverRotate, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(anims.infoFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(anims.buttonFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    return () => {
      SoundManager.stopSound();
    };
  }, []);

  const handleNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (round >= maxRounds) {
        navigation.replace('GameOver', { playerScores, players });
    } else {
        navigation.replace('Game', {
          round: round + 1,
          playerScores,
          category,
          maxRounds
        });
    }
  };

  const coverRotate = anims.coverRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-15deg', '0deg'],
  });

  return (
    <SafeContainer>
      {isGuessCorrect && <Confetti />}
      <Animated.View style={[styles.container, { opacity: anims.bgFade }]}>
        
        {/* RESULT BANNER */}
        <LinearGradient
          colors={isGuessCorrect ? ['#1DB954', '#178F43'] : ['#555', '#333']}
          style={styles.resultBanner}
        >
          <Ionicons name={isGuessCorrect ? "checkmark-circle" : "close-circle"} size={32} color="white" />
          <Text style={styles.resultBannerText}>{isGuessCorrect ? "CORRECT !" : (selectedPlayer ? "INCORRECT" : "TEMPS ÉCOULÉ")}</Text>
          {isGuessCorrect && <Text style={styles.scoreGained}>+{Math.floor(score)} pts</Text>}
        </LinearGradient>
        
        <View style={styles.content}>
          <Animated.View style={{ transform: [{ scale: anims.coverScale }, { rotate: coverRotate }] }}>
            {safeTrack.albumImage ? (
                <Image source={{ uri: safeTrack.albumImage }} style={styles.coverImage} />
            ) : (
                <View style={[styles.coverImage, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>
                    <Ionicons name="musical-notes" size={80} color="#666" />
                </View>
            )}
            <View style={[styles.glow, isGuessCorrect ? styles.glowCorrect : styles.glowIncorrect]} />
          </Animated.View>
          
          <Animated.View style={[styles.trackInfo, { opacity: anims.infoFade }]}>
            <Text style={styles.trackTitle} numberOfLines={2}>{safeTrack.title}</Text>
            <Text style={styles.trackArtist}>{safeTrack.artist}</Text>
            <View style={styles.ownerInfo}>
              <Text style={styles.ownerText}>appartient à </Text>
              {correctPlayerObj?.image ? (
                <Image source={{ uri: correctPlayerObj.image }} style={styles.ownerAvatar} />
              ) : (
                <View style={[styles.ownerAvatar, { backgroundColor: correctPlayerObj?.color || '#555', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: 12 }}>{correctPlayerObj?.emoji || '👤'}</Text>
                </View>
              )}
              <Text style={styles.ownerName}>{correctPlayerObj?.name}</Text>
            </View>
          </Animated.View>
        </View>

        {/* FOOTER */}
        <Animated.View style={[styles.footer, { opacity: anims.buttonFade }]}>
          <PressableCard onPress={handleNext} style={{ width: '100%' }}>
            <LinearGradient colors={[COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN_LIGHT]} start={{x:0, y:0}} end={{x:1, y:0}} style={styles.nextButton}>
              <Text style={styles.nextButtonText}>{round >= maxRounds ? "Voir les scores" : "Manche Suivante"}</Text>
              <Ionicons name="arrow-forward" color="white" size={24} />
            </LinearGradient>
          </PressableCard>
        </Animated.View>
      </Animated.View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between' },
  resultBanner: {
    margin: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  resultBannerText: {
    flex: 1,
    fontSize: 24,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 1,
  },
  scoreGained: {
    fontSize: 20,
    fontWeight: '800',
    color: 'white',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  coverImage: {
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  glow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 24,
    zIndex: -1,
  },
  glowCorrect: {
    shadowColor: COLORS.SPOTIFY_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 25,
  },
  glowIncorrect: {
    shadowColor: '#888',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 15,
  },
  trackInfo: {
    alignItems: 'center',
    marginTop: 24,
    paddingHorizontal: 16,
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
    marginBottom: 8,
  },
  trackArtist: {
    fontSize: 18,
    fontWeight: '600',
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 16,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  ownerText: {
    color: '#B3B3B3',
    fontSize: 14,
  },
  ownerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginHorizontal: 8,
  },
  ownerName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    padding: 16,
  },
  nextButton: {
    paddingVertical: 20,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  }
});
